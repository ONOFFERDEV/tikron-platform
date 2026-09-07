/**
 * Combat VFX: a shared `THREE.Points` particle pool (spark/mote/ash/level-up bursts) plus
 * a handful of standalone meshes/sprites (cast ring, projectile flight, resurrection flash)
 * — all built from canvas-procedural textures, zero asset files. `net.ts`'s `handleCombat`
 * calls into this per combat event; there is no `rig.onUpdate` hook here because
 * `NetSession` already has its own per-frame `tick()` (driven by main.ts's frame loop),
 * so `VfxSystem.tick()` just rides that instead of registering a second callback.
 *
 * Every spawn method resolves a unit id to a world position via `UnitRenderer.get` +
 * `UnitRenderer.toWorld` and silently no-ops if the unit isn't currently known (AOI can
 * mean an event references a unit not rendered locally) — never throws.
 */
import * as THREE from "three";
import { UnitRenderer } from "./units.js";

// --- skill -> color rules (school-based; unrecognized ids fall back to physical) ---------

const FIRE_SKILLS = new Set(["mage-fireball", "mage-flame-pillar", "mage-meteor"]);
const FROST_SKILLS = new Set(["mage-frost-nova"]);
const HOLY_SKILLS = new Set([
  "cleric-heal",
  "cleric-regeneration",
  "cleric-purify",
  "cleric-holy-strike",
  "cleric-blessing",
  "cleric-resurrection",
  "goblin-shaman-mend",
]);
/** Skills that launch a real flying projectile (each has a `projectileSpeed` in the content
 *  pack), mapped to the visual they spawn. `arrow`/`javelin` are procedural meshes on a light
 *  parabola that home on the target's live position; `fireball`/`bolt` are additive glow sprites
 *  trailing embers. Anything not listed has no projectile (melee/self/AOE). */
type ProjectileKind = "arrow" | "javelin" | "fireball" | "bolt";
const PROJECTILE_KIND: Readonly<Record<string, ProjectileKind>> = {
  "skeleton-shot": "arrow",
  "goblin-throw": "javelin",
  "mage-fireball": "fireball",
  "wraith-bolt": "bolt",
};
/** Flight speed (world units/sec) and arc-height factor (× travel distance, capped) per kind —
 *  arrows loft more than the flat-shooting javelin; fireball/bolt fly straight. */
const PROJECTILE_SPEED: Readonly<Record<ProjectileKind, number>> = { arrow: 22, javelin: 20, fireball: 16, bolt: 18 };
const PROJECTILE_ARC: Readonly<Record<ProjectileKind, number>> = { arrow: 0.13, javelin: 0.06, fireball: 0, bolt: 0 };

/** Melee skills that sweep a fan-shaped slash arc in front of the caster on `skillFired` — the
 *  shared `melee-basic` auto-attack is included so every melee swing reads. `warrior-whirlwind`
 *  sweeps a full 360° ring instead and is listed separately. */
const WHIRL_SKILLS = new Set(["warrior-whirlwind"]);
const MELEE_SKILLS = new Set([
  "melee-basic",
  "monster-bite",
  "warrior-strike",
  "warrior-charge",
  "boar-charge",
  "cleric-holy-strike",
  "goblin-chief-cleave",
  "skeleton-strike",
  "golem-slam",
  "valen-cleave",
  "ember-lord-strike",
]);

const COLOR_FIRE = 0xff7a33;
const COLOR_FROST = 0x7fd8ff;
const COLOR_HOLY = 0xffd76a;
const COLOR_PHYSICAL = 0xd8d4c8;
const COLOR_BOLT = 0x9a5cff; // wraith spectral-bolt violet (projectile glow + trail + impact)

function colorForSkill(skillId: string): number {
  if (FIRE_SKILLS.has(skillId)) return COLOR_FIRE;
  if (FROST_SKILLS.has(skillId)) return COLOR_FROST;
  if (HOLY_SKILLS.has(skillId)) return COLOR_HOLY;
  return COLOR_PHYSICAL;
}

const COLOR_DAMAGE = 0xffb066;
const COLOR_HEAL = 0x5cff8a;
const COLOR_LEVELUP = 0xffd24a;
const COLOR_DEATH = 0x9a968c;
const COLOR_RESURRECT = 0xffab40;
/** Boss AOE telegraph decal (§7.3 phase, E3-adjacent) — danger red. */
const COLOR_TELEGRAPH = 0xff3320;
/** Space-dash afterimage streak — cool grey-white. */
const COLOR_DASH_TRAIL = 0xdfe4e8;

/** Cosmetic-only travel distance for the caster-facing fallback (see `fireProjectile`). */
const PROJECTILE_RANGE = 10;
/** Outer radius of the melee slash-arc ribbon (see `meleeSwing`). */
const SWING_RADIUS = 1.2;

// --- procedural textures (2 canvas-generated variants — no external assets) --------------

function createGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.7)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRingTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.48);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- shared particle pool (spark/mote/ash/level-up bursts) -------------------------------

/** Concurrent particle budget for the shared pool — the bulk of the ~500-vertex target;
 *  the handful of standalone ring/projectile/flash meshes below add only a few vertices
 *  each on top of this. */
const POOL_SIZE = 480;

interface BurstOptions {
  life: number;
  speedMin: number;
  speedMax: number;
  /** Applied to vertical velocity every tick — negative arcs down (spark/ash), positive
   *  gives a floaty rise (heal/level-up). */
  gravity: number;
  /** true = mostly-vertical cone (heal mote / level-up column); false = full radial sphere
   *  (damage spark / death ash). */
  upward: boolean;
  /** Horizontal jitter for the upward cone (ignored when `upward` is false). */
  spread: number;
}

function randomSphereDir(): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
}

function randomUpConeDir(spread: number): THREE.Vector3 {
  return new THREE.Vector3((Math.random() * 2 - 1) * spread, 1, (Math.random() * 2 - 1) * spread).normalize();
}

/** A flat annulus-sector ribbon in the XZ plane, centred on the +X axis and spanning `angleRad`.
 *  Per-vertex colour fades from bright (inner rim) to black (outer rim) — and, for arcs under a
 *  full turn, toward the two angular ends — so under additive blending (with vertex colours) it
 *  reads as a glowing slash edge that tapers off. Shared across swings; the caller supplies the
 *  skill colour via the mesh material. */
function makeSlashGeometry(angleRad: number, innerR: number, outerR: number, segments: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const half = angleRad / 2;
  const fullTurn = angleRad >= Math.PI * 1.99;
  for (let i = 0; i <= segments; i++) {
    const a = -half + (angleRad * i) / segments;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const taper = fullTurn ? 1 : 1 - Math.abs((2 * i) / segments - 1); // 0 at the arc ends, 1 mid
    positions.push(innerR * c, 0, innerR * s);
    colors.push(taper, taper, taper);
    positions.push(outerR * c, 0, outerR * s);
    colors.push(0, 0, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  geometry.setIndex(index);
  return geometry;
}

/** One shared `THREE.Points` buffer driving every burst-style effect. Slots are allocated
 *  once at construction; spawning claims free slots (a small one-off allocation per combat
 *  event, not per frame) and `tick` only mutates the existing typed arrays in place — no
 *  per-frame allocation. Fade-out is done by lerping each particle's color to black rather
 *  than per-vertex alpha, which reads identically under additive blending and avoids a
 *  custom shader. */
class ParticlePool {
  private readonly positions = new Float32Array(POOL_SIZE * 3);
  private readonly colors = new Float32Array(POOL_SIZE * 3);
  private readonly velocities = new Float32Array(POOL_SIZE * 3);
  private readonly baseColor = new Float32Array(POOL_SIZE * 3);
  private readonly gravity = new Float32Array(POOL_SIZE);
  private readonly age = new Float32Array(POOL_SIZE);
  private readonly life = new Float32Array(POOL_SIZE);
  private readonly active = new Uint8Array(POOL_SIZE);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly points: THREE.Points;

  constructor(scene: THREE.Scene, texture: THREE.Texture) {
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.geometry.setAttribute("position", this.posAttr);
    this.geometry.setAttribute("color", this.colorAttr);
    const material = new THREE.PointsMaterial({
      size: 0.35,
      map: texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, material);
    scene.add(this.points);
  }

  /** Claims up to `count` free slots and bursts them outward from `origin`. Silently spawns
   *  fewer than `count` if the pool is (very) close to full — never errors. */
  spawn(origin: THREE.Vector3, count: number, color: THREE.Color, opts: BurstOptions): void {
    let spawned = 0;
    for (let i = 0; i < POOL_SIZE && spawned < count; i++) {
      if (this.active[i]) continue;
      const ix = i * 3;
      this.positions[ix] = origin.x;
      this.positions[ix + 1] = origin.y;
      this.positions[ix + 2] = origin.z;
      const dir = opts.upward ? randomUpConeDir(opts.spread) : randomSphereDir();
      const speed = opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin);
      this.velocities[ix] = dir.x * speed;
      this.velocities[ix + 1] = dir.y * speed;
      this.velocities[ix + 2] = dir.z * speed;
      this.gravity[i] = opts.gravity;
      this.age[i] = 0;
      this.life[i] = opts.life;
      this.baseColor[ix] = color.r;
      this.baseColor[ix + 1] = color.g;
      this.baseColor[ix + 2] = color.b;
      this.colors[ix] = color.r;
      this.colors[ix + 1] = color.g;
      this.colors[ix + 2] = color.b;
      this.active[i] = 1;
      spawned++;
    }
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  tick(dt: number): void {
    let any = false;
    for (let i = 0; i < POOL_SIZE; i++) {
      if (!this.active[i]) continue;
      any = true;
      const ix = i * 3;
      this.age[i]! += dt;
      if (this.age[i]! >= this.life[i]!) {
        this.active[i] = 0;
        this.colors[ix] = 0;
        this.colors[ix + 1] = 0;
        this.colors[ix + 2] = 0;
        continue;
      }
      this.velocities[ix + 1]! += this.gravity[i]! * dt;
      this.positions[ix]! += this.velocities[ix]! * dt;
      this.positions[ix + 1]! += this.velocities[ix + 1]! * dt;
      this.positions[ix + 2]! += this.velocities[ix + 2]! * dt;
      const fade = 1 - this.age[i]! / this.life[i]!;
      this.colors[ix] = this.baseColor[ix]! * fade;
      this.colors[ix + 1] = this.baseColor[ix + 1]! * fade;
      this.colors[ix + 2] = this.baseColor[ix + 2]! * fade;
    }
    if (any) {
      this.posAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
    }
  }

  /** Clears every active particle immediately, without disposing the pool (zone transfer). */
  reset(): void {
    this.active.fill(0);
    this.colors.fill(0);
    this.colorAttr.needsUpdate = true;
  }
}

// --- standalone one-shot effects (cast ring / projectile / resurrect flash) ---------------

interface Transient {
  /** Advances by `dt`; returns false once finished (caller disposes and drops it). */
  update(dt: number): boolean;
  dispose(): void;
}

interface CastRingEntry {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  shrinkDurationSec: number;
  removing: boolean;
  fadeAge: number;
}

const RING_FADE_SEC = 0.15;
const RING_TIMEOUT_SEC = 3;
const RING_SPIN = 2.4; // rad/sec

export interface VfxSystem {
  /** Advances every active particle/ring/transient. Call once per render frame (dt seconds). */
  tick(dt: number): void;
  damageSpark(targetId: string, amount: number): void;
  healMote(targetId: string, amount: number): void;
  startCast(casterId: string, skillId: string, castTimeMs: number): void;
  endCast(casterId: string): void;
  /** Launches a real flying projectile for a ranged skill (arrow/javelin mesh or fireball/bolt
   *  glow), homing on `targetId`'s live position when given (else along the caster's facing), and
   *  bursts a small impact puff on arrival. No-op for non-projectile skills. */
  fireProjectile(casterId: string, skillId: string, targetId?: string): void;
  /** Sweeps a fan-shaped slash arc in front of the caster for a melee skill (360° for whirlwind),
   *  fading over ~0.25s. No-op for non-melee skills. */
  meleeSwing(casterId: string, skillId: string): void;
  levelUpBurst(unitId: string): void;
  deathPuff(unitId: string): void;
  resurrectFlash(unitId: string): void;
  /** Space-dash from->to afterimage streak (sim-plane coords), fading in ~0.3s. */
  dashTrail(fromX: number, fromY: number, toX: number, toY: number): void;
  /** Ground AOE warning decal at sim-plane `(x, y)`, radius `r`, lasting `ms` (§7.3 boss
   *  phase). A pulsing red ring marks the danger boundary while an inner fill contracts to
   *  center as a countdown; both vanish at expiry — the impact itself is a separate event. */
  showTelegraph(x: number, y: number, r: number, ms: number): void;
  /** Clears every active ring/transient/particle immediately — call on zone transfer so
   *  stale effects never outlive the room they belonged to. */
  reset(): void;
}

export function createVfxSystem(scene: THREE.Scene, units: UnitRenderer): VfxSystem {
  const glowTexture = createGlowTexture();
  const ringTexture = createRingTexture();
  const pool = new ParticlePool(scene, glowTexture);
  const ringGeometry = new THREE.PlaneGeometry(1, 1);

  // Projectile meshes (arrow/javelin) share geometry + material across shots; each shot is a
  // fresh THREE.Group of Meshes referencing these, removed (not disposed) on landing. Every part
  // is built pointing along local -Z so a per-frame `lookAt` aligns the nose with travel.
  const arrowShaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5).rotateX(Math.PI / 2);
  const arrowHeadGeo = new THREE.ConeGeometry(0.05, 0.14, 6).rotateX(-Math.PI / 2);
  const fletchGeo = new THREE.PlaneGeometry(0.12, 0.1);
  const javelinShaftGeo = new THREE.CylinderGeometry(0.028, 0.022, 0.95, 6).rotateX(Math.PI / 2);
  const javelinHeadGeo = new THREE.ConeGeometry(0.06, 0.18, 6).rotateX(-Math.PI / 2);
  const arrowShaftMat = new THREE.MeshBasicMaterial({ color: 0x8a7048 });
  const arrowHeadMat = new THREE.MeshBasicMaterial({ color: 0xc8c4b8 });
  const fletchMat = new THREE.MeshBasicMaterial({ color: 0xe6e2d6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const javelinShaftMat = new THREE.MeshBasicMaterial({ color: 0x6b5a44 });
  const javelinHeadMat = new THREE.MeshBasicMaterial({ color: 0xb0aca0 });

  function makeArrow(): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(arrowShaftGeo, arrowShaftMat));
    const head = new THREE.Mesh(arrowHeadGeo, arrowHeadMat);
    head.position.z = -0.32;
    const fin1 = new THREE.Mesh(fletchGeo, fletchMat);
    fin1.position.z = 0.18;
    fin1.rotation.y = Math.PI / 2;
    const fin2 = new THREE.Mesh(fletchGeo, fletchMat);
    fin2.position.z = 0.18;
    fin2.rotation.y = Math.PI / 2;
    fin2.rotation.z = Math.PI / 2;
    group.add(head, fin1, fin2);
    return group;
  }

  function makeJavelin(): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(javelinShaftGeo, javelinShaftMat));
    const head = new THREE.Mesh(javelinHeadGeo, javelinHeadMat);
    head.position.z = -0.56;
    group.add(head);
    return group;
  }

  // Slash-arc ribbons for melee swings — one 120° fan (most skills) and one 360° ring
  // (whirlwind), shared across swings; per-swing colour/opacity lives on a throwaway material.
  const slashArcGeo = makeSlashGeometry(Math.PI * (2 / 3), 0.65 * SWING_RADIUS, SWING_RADIUS, 12);
  const whirlArcGeo = makeSlashGeometry(Math.PI * 2, 0.5 * SWING_RADIUS, SWING_RADIUS, 32);

  const rings = new Map<string, CastRingEntry>();
  const transients: Transient[] = [];

  function worldPos(id: string): THREE.Vector3 | null {
    const data = units.get(id);
    return data ? UnitRenderer.toWorld(data.x, data.y) : null;
  }

  function damageSpark(targetId: string, amount: number): void {
    const pos = worldPos(targetId);
    if (!pos) return;
    pos.y += 1.0;
    const power = Math.min(Math.max(amount, 0) / 50, 1);
    const count = Math.round(6 + power * 4); // 6-10, scaled by damage (capped)
    const color = new THREE.Color(COLOR_DAMAGE).lerp(new THREE.Color(0xffffff), power * 0.35);
    pool.spawn(pos, count, color, { life: 0.3, speedMin: 2.5, speedMax: 3 + power * 2, gravity: -9, upward: false, spread: 0 });
  }

  function healMote(targetId: string, amount: number): void {
    const pos = worldPos(targetId);
    if (!pos) return;
    pos.y += 0.4;
    const count = Math.min(5 + Math.floor(Math.max(amount, 0) / 25), 8); // 5-8
    pool.spawn(pos, count, new THREE.Color(COLOR_HEAL), { life: 0.8, speedMin: 0.8, speedMax: 1.6, gravity: 0.4, upward: true, spread: 0.4 });
  }

  function levelUpBurst(unitId: string): void {
    const pos = worldPos(unitId);
    if (!pos) return;
    pool.spawn(pos, 24, new THREE.Color(COLOR_LEVELUP), { life: 1.0, speedMin: 1.5, speedMax: 3, gravity: 0.2, upward: true, spread: 0.25 });
  }

  function deathPuff(unitId: string): void {
    const pos = worldPos(unitId);
    if (!pos) return;
    pos.y += 0.6;
    pool.spawn(pos, 18, new THREE.Color(COLOR_DEATH), { life: 0.8, speedMin: 1, speedMax: 2.2, gravity: -1.6, upward: false, spread: 0 });
  }

  function resurrectFlash(unitId: string): void {
    const pos = worldPos(unitId);
    if (!pos) return;
    pos.y += 1.0;
    const material = new THREE.SpriteMaterial({
      map: glowTexture,
      color: COLOR_RESURRECT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 1,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(pos);
    sprite.scale.setScalar(0.4);
    scene.add(sprite);
    const duration = 0.5;
    let age = 0;
    transients.push({
      update(dt: number): boolean {
        age += dt;
        const t = Math.min(age / duration, 1);
        sprite.scale.setScalar(THREE.MathUtils.lerp(0.4, 3.2, t));
        material.opacity = 1 - t;
        return age < duration;
      },
      dispose(): void {
        scene.remove(sprite);
        material.dispose();
      },
    });
  }

  /** A small burst at a projectile's landing point, tinted per kind. */
  function impactPuff(pos: THREE.Vector3, kind: ProjectileKind): void {
    const color =
      kind === "fireball" ? new THREE.Color(COLOR_FIRE) : kind === "bolt" ? new THREE.Color(COLOR_BOLT) : new THREE.Color(COLOR_PHYSICAL);
    pool.spawn(pos, kind === "fireball" ? 8 : 5, color, { life: 0.3, speedMin: 1.5, speedMax: 3, gravity: -6, upward: false, spread: 0 });
  }

  /** Launches a real flying projectile for a ranged skill. Arrows/javelins are procedural meshes
   *  on a light parabola; fireball/bolt are additive glow sprites trailing embers. When `targetId`
   *  is given the flight homes on that unit's live position each frame (freezing at the last known
   *  point if it despawns); otherwise it flies a fixed distance along the caster's facing
   *  (sim-plane convention: forward = (cos, sin) of `UnitData.facing`, mapped to world (x,0,z)). */
  function fireProjectile(casterId: string, skillId: string, targetId?: string): void {
    const kind = PROJECTILE_KIND[skillId];
    if (!kind) return;
    const caster = units.get(casterId);
    if (!caster) return;
    const from = UnitRenderer.toWorld(caster.x, caster.y);
    from.y += 1.1;

    // Live target position (torso height), or null once the unit is gone / was never given.
    const targetWorld = (): THREE.Vector3 | null => {
      if (!targetId) return null;
      const t = units.get(targetId);
      if (!t) return null;
      const w = UnitRenderer.toWorld(t.x, t.y);
      w.y += 1.0;
      return w;
    };

    const facingDir = new THREE.Vector3(Math.cos(caster.facing), 0, Math.sin(caster.facing));
    let dest = targetWorld() ?? from.clone().addScaledVector(facingDir, PROJECTILE_RANGE);
    const dist = Math.max(from.distanceTo(dest), 0.5);
    const duration = Math.min(Math.max(dist / PROJECTILE_SPEED[kind], 0.12), 1.2);
    const arcPeak = Math.min(dist * PROJECTILE_ARC[kind], 2.2);
    const isMesh = kind === "arrow" || kind === "javelin";
    const hasTrail = kind === "fireball" || kind === "bolt";
    const trailColor = new THREE.Color(kind === "bolt" ? COLOR_BOLT : COLOR_FIRE);

    let spriteMat: THREE.SpriteMaterial | null = null;
    let obj: THREE.Object3D;
    if (isMesh) {
      obj = kind === "arrow" ? makeArrow() : makeJavelin();
    } else {
      spriteMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: kind === "bolt" ? COLOR_BOLT : COLOR_FIRE,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 1,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.setScalar(kind === "bolt" ? 0.42 : 0.55);
      obj = sprite;
    }
    obj.position.copy(from);
    scene.add(obj);

    let age = 0;
    let lastTrail = 0;
    const cur = new THREE.Vector3();
    transients.push({
      update(dt: number): boolean {
        age += dt;
        const t = Math.min(age / duration, 1);
        dest = targetWorld() ?? dest; // keep homing; freeze at the last known point when it's gone
        cur.lerpVectors(from, dest, t);
        cur.y += arcPeak * 4 * t * (1 - t); // symmetric parabola, peak at mid-flight
        obj.position.copy(cur);
        if (isMesh) {
          const slope = arcPeak * 4 * (1 - 2 * t); // vertical rate of the arc → nose tilt
          const look = new THREE.Vector3(dest.x - from.x, slope, dest.z - from.z);
          if (look.lengthSq() > 1e-6) obj.lookAt(cur.clone().add(look)); // local -Z follows travel
        } else if (spriteMat) {
          spriteMat.opacity = t < 0.85 ? 1 : Math.max(0, (1 - t) / 0.15);
        }
        if (hasTrail && age - lastTrail >= 0.03) {
          lastTrail = age;
          pool.spawn(cur, kind === "fireball" ? 2 : 1, trailColor, {
            life: 0.35,
            speedMin: 0.2,
            speedMax: 0.8,
            gravity: kind === "fireball" ? 0.6 : 0,
            upward: false,
            spread: 0.4,
          });
        }
        if (t >= 1) {
          impactPuff(cur, kind);
          return false;
        }
        return true;
      },
      dispose(): void {
        scene.remove(obj);
        if (spriteMat) spriteMat.dispose();
      },
    });
  }

  /** Sweeps a fan-shaped slash arc (120°, or a full 360° ring for whirlwind) in front of the
   *  caster at torso height, fading over ~0.25s while rotating a short sweep — a lightweight
   *  "swing" read for melee skills. No-op for non-melee skills. */
  function meleeSwing(casterId: string, skillId: string): void {
    const whirl = WHIRL_SKILLS.has(skillId);
    if (!whirl && !MELEE_SKILLS.has(skillId)) return;
    const caster = units.get(casterId);
    if (!caster) return;
    const material = new THREE.MeshBasicMaterial({
      color: colorForSkill(skillId),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.55,
    });
    const mesh = new THREE.Mesh(whirl ? whirlArcGeo : slashArcGeo, material);
    const start = UnitRenderer.toWorld(caster.x, caster.y);
    mesh.position.set(start.x, 0.9, start.z);
    // local +X (arc centre) → world (cos f, 0, sin f), matching the projectile facing convention
    const startRotY = -caster.facing;
    mesh.rotation.y = startRotY;
    scene.add(mesh);
    const duration = 0.25;
    const sweep = whirl ? Math.PI * 2 : 0.6; // whirlwind spins a full turn; others a short slash
    let age = 0;
    transients.push({
      update(dt: number): boolean {
        age += dt;
        const t = Math.min(age / duration, 1);
        material.opacity = 0.55 * (1 - t);
        mesh.rotation.y = startRotY + sweep * t;
        const c = units.get(casterId); // stay centred on a moving caster
        if (c) {
          const w = UnitRenderer.toWorld(c.x, c.y);
          mesh.position.set(w.x, 0.9, w.z);
        }
        return age < duration;
      },
      dispose(): void {
        scene.remove(mesh);
        material.dispose();
      },
    });
  }

  /** Space-dash afterimage: a short-lived grey-white streak sampled along the from->to lunge
   *  line (sim-plane coords), each sample a tiny low-speed burst so the whole thing reads as a
   *  motion trail that fades in ~0.3s. Purely cosmetic — the server already moved the unit. */
  function dashTrail(fromX: number, fromY: number, toX: number, toY: number): void {
    const from = UnitRenderer.toWorld(fromX, fromY);
    const to = UnitRenderer.toWorld(toX, toY);
    const color = new THREE.Color(COLOR_DASH_TRAIL);
    const samples = 6;
    for (let i = 0; i <= samples; i++) {
      const p = from.clone().lerp(to, i / samples);
      p.y = 0.9; // torso height, so the streak reads as a body afterimage rather than a ground mark
      pool.spawn(p, 3, color, { life: 0.3, speedMin: 0.2, speedMax: 0.8, gravity: 0, upward: false, spread: 0.5 });
    }
  }

  function showTelegraph(x: number, y: number, r: number, ms: number): void {
    const center = UnitRenderer.toWorld(x, y); // sim plane maps 1:1 to world x/z
    const duration = Math.max(0.05, ms / 1000);
    const diameter = Math.max(0.1, r * 2); // ringGeometry is a unit plane -> scale = diameter

    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTexture,
      color: COLOR_TELEGRAPH,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0.04, center.z);
    ring.scale.setScalar(diameter);

    const fillMat = new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: COLOR_TELEGRAPH,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.2,
    });
    const fill = new THREE.Mesh(ringGeometry, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(center.x, 0.03, center.z);
    fill.scale.setScalar(diameter);

    scene.add(ring, fill);
    let age = 0;
    transients.push({
      update(dt: number): boolean {
        age += dt;
        const t = Math.min(age / duration, 1);
        ringMat.opacity = 0.55 + 0.45 * Math.abs(Math.sin(age * 9)); // pulse
        fillMat.opacity = 0.18 + 0.32 * t; // reddens as impact nears
        fill.scale.setScalar(diameter * (1 - t)); // contracts to center (countdown)
        return age < duration;
      },
      dispose(): void {
        scene.remove(ring);
        scene.remove(fill);
        ringMat.dispose();
        fillMat.dispose();
      },
    });
  }

  function startCast(casterId: string, skillId: string, castTimeMs: number): void {
    const pos = worldPos(casterId);
    if (!pos) return;
    const existing = rings.get(casterId);
    if (existing) {
      scene.remove(existing.mesh);
      existing.material.dispose();
      rings.delete(casterId);
    }
    const material = new THREE.MeshBasicMaterial({
      map: ringTexture,
      color: colorForSkill(skillId),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.05, pos.z);
    mesh.scale.setScalar(1.3);
    scene.add(mesh);
    rings.set(casterId, {
      mesh,
      material,
      age: 0,
      shrinkDurationSec: castTimeMs > 0 ? castTimeMs / 1000 : 0.5,
      removing: false,
      fadeAge: 0,
    });
  }

  function endCast(casterId: string): void {
    const entry = rings.get(casterId);
    if (entry) entry.removing = true;
  }

  function tickRings(dt: number): void {
    for (const [casterId, entry] of rings) {
      if (entry.removing) {
        entry.fadeAge += dt;
        entry.material.opacity = Math.max(0, 1 - entry.fadeAge / RING_FADE_SEC);
        if (entry.fadeAge >= RING_FADE_SEC) {
          scene.remove(entry.mesh);
          entry.material.dispose();
          rings.delete(casterId);
        }
        continue;
      }
      entry.age += dt;
      entry.mesh.rotation.z += RING_SPIN * dt;
      const t = Math.min(entry.age / entry.shrinkDurationSec, 1);
      entry.mesh.scale.setScalar(THREE.MathUtils.lerp(1.3, 0.7, t));
      const casterPos = worldPos(casterId); // follows a still-casting/moving caster
      if (casterPos) entry.mesh.position.set(casterPos.x, 0.05, casterPos.z);
      if (entry.age >= RING_TIMEOUT_SEC) entry.removing = true;
    }
  }

  function tickTransients(dt: number): void {
    for (let i = transients.length - 1; i >= 0; i--) {
      const t = transients[i]!;
      if (!t.update(dt)) {
        t.dispose();
        transients.splice(i, 1);
      }
    }
  }

  function tick(dt: number): void {
    pool.tick(dt);
    tickRings(dt);
    tickTransients(dt);
  }

  function reset(): void {
    pool.reset();
    for (const entry of rings.values()) {
      scene.remove(entry.mesh);
      entry.material.dispose();
    }
    rings.clear();
    for (const t of transients) t.dispose();
    transients.length = 0;
  }

  return { tick, damageSpark, healMote, startCast, endCast, fireProjectile, meleeSwing, levelUpBurst, deathPuff, resurrectFlash, dashTrail, showTelegraph, reset };
}
