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
  /** Equipped weapon/armor manifest logical id (PLAN-EMBERFALL-M2 §7) — an explicit
   *  gear override. Omitted for the class-default appearance, in which case the renderer
   *  falls back to `DEFAULT_GEAR` keyed by class/kind (see `gearVisual`). Rigged units
   *  socket the prop onto a hand bone; others get a best-effort root-space prop. */
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
  /** B1: per-unit cloned flash materials, built lazily on first hit; null until then. */
  flashTargets: FlashTarget[] | null;
  /** B1: seconds since the current pulse started; >= FLASH_DURATION means inactive. */
  flashElapsed: number;
}

/** Fallback attach offsets (local to the unit root) — a generic hand/torso position
 *  used only for units whose visual has no hand bone to socket onto (the procedural
 *  capsule and the Quaternius/AI GLBs). Rigged KayKit units attach to a real hand bone
 *  instead (see `SLOT_BONE`), at native scale, so these offsets/`GEAR_SCALE` don't apply. */
const WEAPON_OFFSET = new THREE.Vector3(0.4, 1.0, 0.15);
const ARMOR_OFFSET = new THREE.Vector3(0, 0.75, 0);
const GEAR_SCALE = 0.35;

/** KayKit rig sockets: the main-hand weapon rides `handslot.r`, the off-hand prop
 *  (shield) rides `handslot.l`. Every KayKit Adventurers/Skeletons rig in this game
 *  exposes both (verified against the 23-joint hero and skeleton skeletons). Parenting
 *  to the bone makes the prop follow the arm animation for free. Units without these
 *  bones fall back to the root-space offsets above. */
const SLOT_BONE: Readonly<Record<"weapon" | "armor", string>> = { weapon: "handslot.r", armor: "handslot.l" };

/** Mirrors three.js `PropertyBinding.sanitizeNodeName`: GLTFLoader runs every node/bone
 *  name through this, stripping the reserved chars `[ ] . : /` and turning whitespace into
 *  `_`. The KayKit rig authors its sockets as `handslot.r`/`handslot.l`, so in the loaded
 *  scene graph the dot is gone and they become `handslotr`/`handslotl` (the original is kept
 *  only in `node.userData.name`). Without mirroring this, `getObjectByName("handslot.r")`
 *  never matches and the weapon silently falls back to a root-space prop. */
export function sanitizeNodeName(name: string): string {
  return name.replace(/\s/g, "_").replace(/[\[\]\.:\/]/g, "");
}

/** Finds a rig bone by its authored (file) name, tolerant of GLTFLoader's node-name
 *  sanitization. Tries the raw name first (procedural sources keep names verbatim), then the
 *  sanitized form used by GLB/glTF-loaded scene graphs. */
export function findBoneByName(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return root.getObjectByName(name) ?? root.getObjectByName(sanitizeNodeName(name));
}

/** Class/kind -> default gear visuals, used when a unit carries no explicit
 *  `weaponVisual`/`armorVisual` override (the common case — the server ships no gear
 *  fields yet). Players key by their `visual` id (the class mesh), NPCs by `kind`. Only
 *  hand-socketed KayKit units appear here; Quaternius/AI mobs stay unarmed, since a
 *  weapon on them would have no hand bone to ride and would float at the root. */
const DEFAULT_GEAR: Readonly<Record<string, { weapon?: string; armor?: string }>> = {
  "unit.warrior": { weapon: "weapon.sword", armor: "weapon.shield" },
  "unit.mage": { weapon: "weapon.staff" },
  "unit.cleric": { weapon: "weapon.wand" },
  skeleton_warrior: { weapon: "weapon.skeleton_blade", armor: "weapon.skeleton_shield" },
  skeleton_archer: { weapon: "weapon.skeleton_crossbow" },
  wraith_commander: { weapon: "weapon.greatsword" },
};

/** The effective gear visual for one slot: an explicit override wins, else the
 *  class/kind default, else empty (unarmed). */
function gearVisual(data: UnitData, slot: "weapon" | "armor"): string {
  const override = slot === "weapon" ? data.weaponVisual : data.armorVisual;
  if (override) return override;
  const def = DEFAULT_GEAR[data.kind === "player" ? data.visual : data.kind];
  return (slot === "weapon" ? def?.weapon : def?.armor) ?? "";
}

const NAMEPLATE_WIDTH = 256;
const NAMEPLATE_HEIGHT = 64;
const MOVE_EPSILON = 1e-4;

// B1 hit flash (POLISH-EMBERFALL): a struck unit's body mesh does a brief hot
// white-red emissive pulse, distinct from the particle hit VFX ("몸에 맞았다").
const FLASH_DURATION = 0.1; // seconds
const FLASH_PEAK = 1.3; // emissiveIntensity at the pulse peak
const FLASH_COLOR = new THREE.Color(1.0, 0.4, 0.35); // hot white-red
const FLASH_WHITE = new THREE.Color(1, 1, 1);

/** One material driven by the hit flash, tagged by which channel we can pulse.
 *  Materials are cloned per unit before driving them (GLB clones share materials —
 *  mutating one would flash every unit of that kind), and restored to these saved
 *  base values when the pulse ends. */
type FlashTarget =
  | {
      kind: "emissive";
      mat: THREE.Material & { emissive: THREE.Color; emissiveIntensity: number };
      baseColor: THREE.Color;
      baseIntensity: number;
    }
  | { kind: "color"; mat: THREE.Material & { color: THREE.Color }; baseColor: THREE.Color };

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
      flashTargets: null,
      flashElapsed: FLASH_DURATION,
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
    // B1: hp dropped this sync => took damage; flash the body (material-only, never
    // touches transform/anim state, so it can't interfere with the death/revive paths).
    // `!prev.dead` still lets the killing blow flash but skips damage dealt to a corpse.
    if (data.hp < prev.hp && !prev.dead) this.startFlash(entry);
    entry.data = data;
    entry.root.position.copy(UnitRenderer.toWorld(data.x, data.y));
    entry.root.rotation.y = -data.facing + entry.visual.faceOffset;

    if (data.dead && !prev.dead) {
      entry.visual.anim.setState("death");
    } else if (!data.dead) {
      const revived = prev.dead;
      if (revived) entry.visual.anim.revive(); // unlocks the terminal "death" state before syncing move state
      const nextMove: "idle" | "walk" = moved ? "walk" : "idle";
      if (revived || nextMove !== entry.moveState) {
        entry.moveState = nextMove;
        entry.visual.anim.setState(nextMove);
      }
    }

    if (data.hp !== prev.hp || data.maxHp !== prev.maxHp || data.name !== prev.name) drawNameplate(entry);

    // Fire-and-forget: gear rarely changes and this runs every render frame for every
    // unit, so the async asset fetch must never be awaited here — only kicked off when
    // the equipped visual id actually changed since the last frame.
    if (
      gearVisual(data, "weapon") !== gearVisual(prev, "weapon") ||
      gearVisual(data, "armor") !== gearVisual(prev, "armor")
    ) {
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

  /** Advances every unit's animation controller and any active B1 hit flash. Call once
   *  per frame with the clamped frame dt. */
  tick(dt: number): void {
    for (const entry of this.units.values()) {
      entry.visual.anim.update(dt);
      if (entry.flashTargets && entry.flashElapsed < FLASH_DURATION) {
        entry.flashElapsed += dt;
        if (entry.flashElapsed >= FLASH_DURATION) {
          for (const t of entry.flashTargets) restoreFlash(t);
        } else {
          const factor = 1 - entry.flashElapsed / FLASH_DURATION;
          for (const t of entry.flashTargets) applyFlash(t, factor);
        }
      }
    }
  }

  /** Starts (or restarts) the B1 hit flash on a unit, cloning its body materials the first
   *  time so the pulse stays local to this unit. */
  private startFlash(entry: UnitEntry): void {
    entry.flashTargets ??= buildFlashTargets(entry.visual.object);
    entry.flashElapsed = 0;
    for (const t of entry.flashTargets) applyFlash(t, 1);
  }

  /** Root groups tagged with `userData.unitId`, for raycasting (input.ts). */
  targetables(): Array<{ id: string; object: THREE.Object3D }> {
    return [...this.units.values()].map((e) => ({ id: e.data.id, object: e.root }));
  }

  get(id: string): UnitData | undefined {
    return this.units.get(id)?.data;
  }

  /** Exposes the scene this renderer draws into — lets `net.ts` wire up `vfx.ts` (which
   *  needs to add/remove its own particles/meshes) without `main.ts` needing to pass a
   *  `SceneRig` reference through. */
  getScene(): THREE.Scene {
    return this.scene;
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
    const visual = gearVisual(entry.data, slot);
    const current = entry[slot];
    if ((current?.visual ?? "") === visual) return;
    if (current) {
      current.object.parent?.remove(current.object); // parent is the hand bone or the root
      disposeObject3D(current.object);
      entry[slot] = null;
    }
    if (!visual) return;
    const object = await this.assets.getPropVisual(visual);
    if (!this.units.has(entry.data.id)) return; // despawned mid-load
    if (gearVisual(entry.data, slot) !== visual) return; // superseded by a newer change
    const bone = findBoneByName(entry.visual.object, SLOT_BONE[slot]);
    if (bone) {
      // Rig socket: parent to the hand bone so the prop rides the arm animation. KayKit
      // weapons are authored native-scale with the grip at the mesh origin for exactly
      // this socket, so no GEAR_SCALE / root offset is applied.
      bone.add(object);
    } else {
      // No hand bone (procedural capsule, Quaternius/AI GLB): best-effort root-space prop.
      object.scale.multiplyScalar(GEAR_SCALE);
      object.position.copy(offset);
      entry.root.add(object);
    }
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

/** Clones every drivable material under a unit's body model and returns the flash
 *  targets. Cloning is essential: cached-GLB clones share material instances, so
 *  mutating them in place would flash every unit of that kind. Only materials with an
 *  `emissive` (preferred) or a plain `color` (fallback for e.g. MeshBasicMaterial) are
 *  driven; anything else is left untouched and keeps sharing its material. */
function buildFlashTargets(object: THREE.Object3D): FlashTarget[] {
  const targets: FlashTarget[] = [];
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const next = mats.map((m) => {
      const probe = m as THREE.Material & { emissive?: unknown; emissiveIntensity?: number; color?: unknown };
      if (probe.emissive instanceof THREE.Color) {
        const clone = m.clone() as THREE.Material & { emissive: THREE.Color; emissiveIntensity: number };
        targets.push({ kind: "emissive", mat: clone, baseColor: clone.emissive.clone(), baseIntensity: clone.emissiveIntensity ?? 1 });
        return clone;
      }
      if (probe.color instanceof THREE.Color) {
        const clone = m.clone() as THREE.Material & { color: THREE.Color };
        targets.push({ kind: "color", mat: clone, baseColor: clone.color.clone() });
        return clone;
      }
      return m;
    });
    node.material = Array.isArray(node.material) ? next : next[0];
  });
  return targets;
}

/** Drives one flash target toward its peak by `factor` (1 = full pulse, 0 = base). */
function applyFlash(t: FlashTarget, factor: number): void {
  if (t.kind === "emissive") {
    t.mat.emissive.copy(FLASH_COLOR);
    t.mat.emissiveIntensity = FLASH_PEAK * factor;
  } else {
    t.mat.color.copy(t.baseColor).lerp(FLASH_WHITE, 0.6 * factor);
  }
}

/** Restores a flash target to the base values captured when it was cloned. */
function restoreFlash(t: FlashTarget): void {
  if (t.kind === "emissive") {
    t.mat.emissive.copy(t.baseColor);
    t.mat.emissiveIntensity = t.baseIntensity;
  } else {
    t.mat.color.copy(t.baseColor);
  }
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
