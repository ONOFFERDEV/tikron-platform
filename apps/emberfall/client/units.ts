/**
 * UnitRenderer: spawns/updates/removes per-unit visuals in the scene from
 * plain sync data. Maps the authoritative 2D sim plane (x,y) onto the 3D
 * world (x,0,y) — height is cosmetic-only, per PLAN-EMBERFALL.md §1. Adds a
 * billboard nameplate+HP-bar canvas sprite per unit, and derives walk/idle
 * animation from the position delta between updates; one-off states
 * (attack/cast/hit) are driven explicitly via `trigger`.
 */
import * as THREE from "three";
import { AssetRegistry, type AnimState, type UnitVisual } from "./assets.js";

export interface UnitData {
  id: string;
  kind: string;
  /** Logical asset id, e.g. "unit.warrior" — looked up in the AssetRegistry manifest. */
  visual: string;
  x: number;
  y: number;
  /** Facing angle, radians, in the sim (x,y) plane. */
  facing: number;
  hp: number;
  maxHp: number;
  name: string;
  dead: boolean;
  /** Equipped weapon/armor manifest logical id (PLAN-EMBERFALL-M2 §7), when the unit
   *  has a gear override — omitted entirely for class-default appearance. Best-effort:
   *  attaches a small prop near the hand/torso (primitive fallback is fine — see
   *  `syncGearProp`). */
  weaponVisual?: string;
  armorVisual?: string;
}

/** One attached gear prop: the manifest logical id it was built from (to detect
 *  changes) plus the scene object, so it can be disposed when it changes or the unit
 *  despawns. */
interface GearProp {
  visual: string;
  object: THREE.Object3D;
}

interface UnitEntry {
  data: UnitData;
  root: THREE.Group;
  visual: UnitVisual;
  nameplateCanvas: HTMLCanvasElement;
  nameplateCtx: CanvasRenderingContext2D;
  nameplateTexture: THREE.CanvasTexture;
  moveState: "idle" | "walk";
  weapon: GearProp | null;
  armor: GearProp | null;
}

/** Best-effort attach offsets (local to the unit root) — a generic hand/torso position
 *  that reads reasonably for both the procedural humanoid and a future GLB rig, since
 *  neither exposes a bone attach point to this renderer. */
const WEAPON_OFFSET = new THREE.Vector3(0.4, 1.0, 0.15);
const ARMOR_OFFSET = new THREE.Vector3(0, 0.75, 0);
const GEAR_SCALE = 0.35;

const NAMEPLATE_WIDTH = 256;
const NAMEPLATE_HEIGHT = 64;
const MOVE_EPSILON = 1e-4;

export class UnitRenderer {
  private readonly units = new Map<string, UnitEntry>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly assets: AssetRegistry,
  ) {}

  /** Sim (x,y) plane -> world (x,0,y); world y (height) is cosmetic-only. */
  static toWorld(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(x, 0, y);
  }

  /** Adds a new unit's visual to the scene, or updates it in place if already spawned. */
  async spawn(data: UnitData): Promise<void> {
    if (this.units.has(data.id)) {
      this.update(data);
      return;
    }
    const visual = await this.assets.getUnitVisual(data.visual);

    const root = new THREE.Group();
    root.userData.unitId = data.id;
    root.position.copy(UnitRenderer.toWorld(data.x, data.y));
    root.rotation.y = -data.facing + visual.faceOffset;
    root.add(visual.object);

    const nameplate = createNameplateSprite();
    nameplate.sprite.position.set(0, 1.9, 0);
    root.add(nameplate.sprite);

    this.scene.add(root);
    const entry: UnitEntry = {
      data,
      root,
      visual,
      nameplateCanvas: nameplate.canvas,
      nameplateCtx: nameplate.ctx,
      nameplateTexture: nameplate.texture,
      moveState: "idle",
      weapon: null,
      armor: null,
    };
    this.units.set(data.id, entry);
    drawNameplate(entry);
    if (data.dead) visual.anim.setState("death");
    await this.syncGear(entry);
  }

  /** Repositions/redraws an existing unit and derives walk/idle from the position delta since the last call. */
  update(data: UnitData): void {
    const entry = this.units.get(data.id);
    if (!entry) return;
    const prev = entry.data;
    const moved = Math.hypot(data.x - prev.x, data.y - prev.y) > MOVE_EPSILON;
    entry.data = data;
    entry.root.position.copy(UnitRenderer.toWorld(data.x, data.y));
    entry.root.rotation.y = -data.facing + entry.visual.faceOffset;

    if (data.dead && !prev.dead) {
      entry.visual.anim.setState("death");
    } else if (!data.dead) {
      const nextMove: "idle" | "walk" = moved ? "walk" : "idle";
      if (nextMove !== entry.moveState) {
        entry.moveState = nextMove;
        entry.visual.anim.setState(nextMove);
      }
    }

    if (data.hp !== prev.hp || data.maxHp !== prev.maxHp || data.name !== prev.name) drawNameplate(entry);

    // Fire-and-forget: gear rarely changes and this runs every render frame for every
    // unit, so the async asset fetch must never be awaited here — only kicked off when
    // the equipped visual id actually changed since the last frame.
    if (data.weaponVisual !== prev.weaponVisual || data.armorVisual !== prev.armorVisual) {
      void this.syncGear(entry);
    }
  }

  /** One-off animation state (attack/cast/hit) triggered by a gameplay event, not a position delta. */
  trigger(id: string, state: AnimState): void {
    const entry = this.units.get(id);
    if (!entry || entry.data.dead) return;
    entry.visual.anim.setState(state);
    if (state !== "idle" && state !== "walk") entry.moveState = "idle";
  }

  remove(id: string): void {
    const entry = this.units.get(id);
    if (!entry) return;
    this.scene.remove(entry.root);
    disposeObject3D(entry.root);
    entry.nameplateTexture.dispose();
    this.units.delete(id);
  }

  /** Advances every unit's animation controller. Call once per frame with the clamped frame dt. */
  tick(dt: number): void {
    for (const entry of this.units.values()) entry.visual.anim.update(dt);
  }

  /** Root groups tagged with `userData.unitId`, for raycasting (input.ts). */
  targetables(): Array<{ id: string; object: THREE.Object3D }> {
    return [...this.units.values()].map((e) => ({ id: e.data.id, object: e.root }));
  }

  get(id: string): UnitData | undefined {
    return this.units.get(id)?.data;
  }

  /** Syncs both gear slots to `entry.data`'s current `weaponVisual`/`armorVisual`. */
  private async syncGear(entry: UnitEntry): Promise<void> {
    await this.syncGearSlot(entry, "weapon", WEAPON_OFFSET);
    await this.syncGearSlot(entry, "armor", ARMOR_OFFSET);
  }

  /** Attaches/detaches one gear slot's prop to match `entry.data`, re-reading it (rather
   *  than trusting a snapshot) since this awaits an asset load and the unit may have
   *  changed gear again — or despawned — before it resolves. `getPropVisual` already
   *  falls back to a procedural primitive when the logical id is unlisted, so this is
   *  "best-effort" by construction: some cosmetic prop always renders, never nothing. */
  private async syncGearSlot(entry: UnitEntry, slot: "weapon" | "armor", offset: THREE.Vector3): Promise<void> {
    const key = slot === "weapon" ? "weaponVisual" : "armorVisual";
    const visual = entry.data[key] ?? "";
    const current = entry[slot];
    if ((current?.visual ?? "") === visual) return;
    if (current) {
      entry.root.remove(current.object);
      disposeObject3D(current.object);
      entry[slot] = null;
    }
    if (!visual) return;
    const object = await this.assets.getPropVisual(visual);
    if (!this.units.has(entry.data.id)) return; // despawned mid-load
    if ((entry.data[key] ?? "") !== visual) return; // superseded by a newer change
    object.scale.multiplyScalar(GEAR_SCALE);
    object.position.copy(offset);
    entry.root.add(object);
    entry[slot] = { visual, object };
  }
}

function createNameplateSprite(): { sprite: THREE.Sprite; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = NAMEPLATE_WIDTH;
  canvas.height = NAMEPLATE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  return { sprite, canvas, ctx, texture };
}

function drawNameplate(entry: UnitEntry): void {
  const { nameplateCtx: ctx, nameplateCanvas: canvas, data } = entry;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(data.name, canvas.width / 2 + 1, 25);
  ctx.fillStyle = "#e6edf3";
  ctx.fillText(data.name, canvas.width / 2, 24);

  const barX = 8;
  const barY = 34;
  const barW = canvas.width - 16;
  const barH = 10;
  ctx.fillStyle = "#161b22";
  ctx.fillRect(barX, barY, barW, barH);
  const pct = data.maxHp > 0 ? Math.max(0, Math.min(1, data.hp / data.maxHp)) : 0;
  ctx.fillStyle = pct > 0.5 ? "#3fb950" : pct > 0.2 ? "#d29922" : "#f85149";
  ctx.fillRect(barX, barY, barW * pct, barH);
  ctx.strokeStyle = "#30363d";
  ctx.strokeRect(barX, barY, barW, barH);

  entry.nameplateTexture.needsUpdate = true;
}

function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) m.dispose();
    }
  });
}
