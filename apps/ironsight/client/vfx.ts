/**
 * Client-only VFX/SFX polish layer: remote muzzle flashes, ejected shell casings,
 * impact bursts (blood/spark), and the footstep-cadence scheduler that drives
 * `audio.ts`'s synthesized steps. Pure presentation, like `scene.ts` — it holds no
 * authority. Everything here is pooled and pre-added to the scene once at
 * construction; `spawn*` calls only reposition/reactivate a slot and `update(now)`
 * (called once per frame from `SceneRig.render`) ages them out. The per-frame
 * `update(now)` path never allocates, so a sustained firefight can't churn the GC;
 * the per-event `spawn*` calls (one per shot, not per frame) do allocate a few
 * short-lived `Vector3` temporaries for direction math, which is bounded by shot
 * rate rather than frame rate.
 */
import * as THREE from "three";
import { playFootstep } from "./audio.js";
import { GAME } from "../src/game-config.js";
import { flashEnvelope, weaponFlash, weaponFlashTexture } from './weapon-flash.js';

const PALETTE = GAME.palette;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const UP = new THREE.Vector3(0, 1, 0);

// --- remote muzzle flash -------------------------------------------------------
const MUZZLE_POOL = 8;

interface MuzzleSlot {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  light: THREE.PointLight;
  born: number;
  weapon: number;
}

// --- shell casings --------------------------------------------------------------
const CASING_POOL = 32;
const CASING_MAX_FLIGHT_MS = 900;
const CASING_FADE_MS = 1000;
const CASING_GRAVITY = -9.8;

interface CasingSlot {
  floor: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  vel: THREE.Vector3;
  born: number;
  grounded: boolean;
  groundedAt: number;
}

// --- impact bursts (blood / spark) ----------------------------------------------
const PARTICLE_POOL = 48;

interface ParticleSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  born: number;
  life: number;
  gravity: number;
  active: boolean;
  origin: THREE.Vector3;
  size: THREE.Vector3;
  kind: "spark" | "dust" | "core" | "blood";
}

// --- footsteps --------------------------------------------------------------
const FOOT_STEP_DIST_M = 2.2; // stride length; cadence emerges from distance/speed
const FOOT_SPEED_MIN = 1.2; // m/s — below this, no footstep (idle jitter)
const FOOT_MAX_DIST_M = 40; // remote footsteps inaudible past this
const FOOT_TELEPORT_M = 5; // no legitimate movement covers this much ground in one frame at 60fps

interface FootTrack {
  lastPos: THREE.Vector3;
  dist: number;
}

export class Vfx {
  private readonly muzzles: MuzzleSlot[] = [];
  private muzzleCursor = 0;
  private readonly casings: CasingSlot[] = [];
  private casingCursor = 0;
  private readonly particles: ParticleSlot[] = [];
  private particleCursor = 0;
  private readonly feet = new Map<string, FootTrack>();
  private readonly seenFeet = new Set<string>(); // ids stepFoot() saw this frame; reused, cleared in update()
  private lastTick = performance.now();

  constructor(private readonly scene: THREE.Scene, private readonly floorAt: (p: Vec3) => number = () => 0) {
    for (let i = 0; i < MUZZLE_POOL; i++) this.muzzles.push(this.buildMuzzle());
    for (let i = 0; i < CASING_POOL; i++) this.casings.push(this.buildCasing());
    for (let i = 0; i < PARTICLE_POOL; i++) this.particles.push(this.buildParticle());
  }

  // --- construction (once, at pool build time) ---------------------------------

  private buildMuzzle(): MuzzleSlot {
    const mat = new THREE.SpriteMaterial({
      color: 0xffffff,
      map: weaponFlashTexture(0),
      toneMapped: false,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.4);
    sprite.visible = false;
    this.scene.add(sprite);
    const light = new THREE.PointLight(PALETTE.muzzleLight, 0, 5, 2);
    this.scene.add(light);
    return { sprite, mat, light, born: -1e9, weapon: 0 };
  }

  private buildCasing(): CasingSlot {
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.casing,
      roughness: 0.4,
      metalness: 0.6,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 6), mat);
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, mat, vel: new THREE.Vector3(), born: -1e9, grounded: false, groundedAt: -1e9, floor: 0 };
  }

  private buildParticle(): ParticleSlot {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat);
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, mat, vel: new THREE.Vector3(), origin: new THREE.Vector3(),
      size: new THREE.Vector3(), kind: "spark", born: -1e9, life: 300, gravity: 0, active: false };
  }

  // --- spawn API (called from SceneRig) -----------------------------------------

  /** Brief flash + point light at a remote shooter's muzzle. */
  spawnMuzzleFlash(origin: Vec3, _dir: Vec3, weapon = 0): void {
    const slot = this.muzzles[this.muzzleCursor]!;
    this.muzzleCursor = (this.muzzleCursor + 1) % this.muzzles.length;
    slot.sprite.position.set(origin.x, origin.y, origin.z);
    const spec = weaponFlash(weapon);
    slot.weapon = weapon;
    slot.mat.map = weaponFlashTexture(weapon);
    slot.mat.rotation = spec.rotation;
    slot.sprite.scale.set(spec.width, spec.height, 1);
    slot.sprite.visible = true;
    slot.mat.opacity = 0.9;
    slot.light.position.copy(slot.sprite.position);
    slot.light.intensity = 4;
    slot.born = performance.now();
  }

  /** Eject a pooled casing from a hitscan shot's origin with a right+up impulse. */
  spawnCasing(origin: Vec3, dir: Vec3): void {
    const slot = this.casings[this.casingCursor]!;
    slot.floor = this.floorAt(origin) + .02;
    this.casingCursor = (this.casingCursor + 1) % this.casings.length;
    const d = normalize(dir);
    let right = new THREE.Vector3().crossVectors(d, UP);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    slot.mesh.position.set(origin.x, origin.y, origin.z);
    slot.vel.set(
      right.x * (1 + Math.random()) - d.x * 0.4 * Math.random(),
      1.5 + Math.random() * 1.5,
      right.z * (1 + Math.random()) - d.z * 0.4 * Math.random(),
    );
    slot.mesh.visible = true;
    slot.mat.opacity = 1;
    slot.born = performance.now();
    slot.grounded = false;
    slot.groundedAt = -1e9;
  }

  /** Impact burst at a shot's terminus: dark-red droplets on a player hit, a
   *  bright spark/dust burst otherwise. */
  spawnImpact(pos: Vec3, dir: Vec3, hitPlayer: boolean): void {
    const d = normalize(dir);
    const count = hitPlayer ? 5 : 7;
    const born = performance.now();
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor]!;
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;
      // Three temporal layers in the same seven slots: a short contact core,
      // three ballistic streaks, then three slower, expanding dust fragments.
      slot.kind = hitPlayer ? "blood" : i === 0 ? "core" : i < 4 ? "spark" : "dust";
      const dust = slot.kind === "dust", core = slot.kind === "core";
      const speed = hitPlayer ? 1.4 : dust ? 0.75 : core ? 0 : 3.8;
      // Bounce roughly away from the shot direction, spread into a hemisphere.
      const away = new THREE.Vector3(-d.x, -d.y, -d.z);
      const jitter = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      const v = away.addScaledVector(jitter, 0.9).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      slot.mesh.position.set(pos.x, pos.y, pos.z);
      slot.origin.copy(slot.mesh.position);
      slot.vel.copy(v);
      slot.mat.color.setHex(hitPlayer ? PALETTE.impactBlood : dust ? 0x968c7b : core ? 0xfff0c0 : PALETTE.impactSpark);
      slot.mat.blending = hitPlayer || dust ? THREE.NormalBlending : THREE.AdditiveBlending;
      slot.size.set(hitPlayer ? 0.7 : dust ? 1.3 : core ? 2.4 : 0.22,
        hitPlayer ? 0.7 : dust ? 1.0 : core ? 2.4 : 0.22,
        hitPlayer ? 1.8 : dust ? 1.2 : core ? 0.6 : 4.8);
      slot.mesh.scale.copy(slot.size);
      slot.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize());
      slot.mat.opacity = 1;
      slot.life = hitPlayer ? 340 : dust ? 480 : core ? 65 : 180 + i * 25;
      slot.gravity = hitPlayer ? -7 : dust ? -0.6 : core ? 0 : -4;
      slot.born = born;
      slot.active = true;
      slot.mesh.visible = true;
    }
  }

  /** Advance a footstep-cadence tracker for `id` ("me" or a remote session id) by
   *  distance travelled; plays a synthesized step through `audio.ts` when the
   *  accumulated distance crosses the stride length. `listenerPos` attenuates by
   *  distance (remotes); pass null for the self track (always full volume). */
  stepFoot(id: string, pos: Vec3, dtSec: number, grounded: boolean, listenerPos: Vec3 | null, threatGain = 1): void {
    this.seenFeet.add(id);
    let t = this.feet.get(id);
    if (!t) {
      t = { lastPos: new THREE.Vector3(pos.x, pos.y, pos.z), dist: 0 };
      this.feet.set(id, t);
      return;
    }
    if (!grounded || dtSec <= 0) {
      t.lastPos.set(pos.x, pos.y, pos.z);
      t.dist = 0;
      return;
    }
    const dx = pos.x - t.lastPos.x;
    const dz = pos.z - t.lastPos.z;
    const horiz = Math.hypot(dx, dz);
    t.lastPos.set(pos.x, pos.y, pos.z);
    if (horiz > FOOT_TELEPORT_M) {
      // Respawn/teleport snap (dead -> alive, self-respawn, or a reused id landing
      // far from its stale track) — swallow this frame's delta instead of reading
      // the jump as a stride, or it fires one spurious footstep.
      t.dist = 0;
      return;
    }
    const speed = horiz / dtSec;
    if (speed < FOOT_SPEED_MIN) {
      t.dist = 0;
      return;
    }
    t.dist += horiz;
    if (t.dist < FOOT_STEP_DIST_M) return;
    t.dist -= FOOT_STEP_DIST_M;
    let atten = 1;
    if (listenerPos) {
      const d = Math.hypot(pos.x - listenerPos.x, pos.y - listenerPos.y, pos.z - listenerPos.z);
      if (d > FOOT_MAX_DIST_M) return;
      atten = Math.min(1, 3 / Math.max(1, d));
    }
    playFootstep(listenerPos ? threatGain : atten, listenerPos ? { x: pos.x, y: pos.y + 0.15, z: pos.z } : undefined, pos);
  }

  // --- per-frame aging -----------------------------------------------------------

  update(now: number): void {
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;

    for (const m of this.muzzles) {
      if (!m.sprite.visible) continue;
      const age = now - m.born;
      const k = flashEnvelope(age, m.weapon);
      if (k === 0) {
        m.sprite.visible = false;
        m.mat.opacity = 0;
        m.light.intensity = 0;
      } else {
        m.mat.opacity = 0.9 * k;
        m.light.intensity = 4 * k;
      }
    }

    for (const c of this.casings) {
      if (!c.mesh.visible) continue;
      if (!c.grounded) {
        c.vel.y += CASING_GRAVITY * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += dt * 10;
        if (c.mesh.position.y <= c.floor || now - c.born >= CASING_MAX_FLIGHT_MS) {
          c.mesh.position.y = c.floor;
          c.grounded = true;
          c.groundedAt = now;
        }
      } else {
        const age = now - c.groundedAt;
        if (age >= CASING_FADE_MS) {
          c.mesh.visible = false;
          c.mat.opacity = 0;
        } else {
          c.mat.opacity = 1 - age / CASING_FADE_MS;
        }
      }
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      const age = now - p.born;
      if (age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const t = Math.max(0, age) / 1000, progress = Math.max(0, age) / p.life;
      p.mesh.position.copy(p.origin).addScaledVector(p.vel, t);
      p.mesh.position.y += 0.5 * p.gravity * t * t;
      if (p.kind === "dust") {
        p.mesh.scale.copy(p.size).multiplyScalar(1 + progress * 3);
        p.mat.opacity = 0.42 * (1 - progress) ** 2;
      } else {
        p.mesh.scale.copy(p.size).multiplyScalar(1 - progress * 0.55);
        p.mat.opacity = (1 - progress) ** 1.5;
      }
    }

    // Drop footstep trackers for ids stepFoot() didn't see this frame (disconnected
    // or despawned) so `feet` doesn't grow for the life of the session.
    for (const id of this.feet.keys()) {
      if (!this.seenFeet.has(id)) this.feet.delete(id);
    }
    this.seenFeet.clear();
  }
}

function normalize(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z).normalize();
}
