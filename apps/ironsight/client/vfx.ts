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
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { playFootstep } from "./audio.js";
import { GAME } from "../src/game-config.js";
import { flashEnvelope, weaponFlash, weaponFlashTexture } from './weapon-flash.js';
import { acquireWeaponModel, cloneWeaponBundleNode, weaponSupportSource } from './weapon-loader.js';
import type { AssetLease } from './shared-gltf-cache.js';

import { SceneImpact } from './scene-impact.js';
import type { MapSurface } from '../src/map/materials.js';

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
  mesh: THREE.Object3D;
  materials: THREE.Material[];
  vel: THREE.Vector3;
  born: number;
  grounded: boolean;
  groundedAt: number;
}

export type VfxOptions = {
  readonly candidatePreview?: boolean;
  readonly acquireWeaponModel?: (url: string) => AssetLease<GLTF>;
  readonly cloneWeaponBundleNode?: (gltf: GLTF, nodeName: string) => THREE.Object3D | undefined;
};

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
  private readonly impacts: SceneImpact;
  private readonly feet = new Map<string, FootTrack>();
  private readonly seenFeet = new Set<string>(); // ids stepFoot() saw this frame; reused, cleared in update()
  private lastTick = performance.now();
  private casingLease: AssetLease<GLTF> | undefined;
  private casingModel: 'procedural' | 'authored' = 'procedural';
  private disposed = false;
  private readonly assetReady: Promise<void>;

  constructor(private readonly scene: THREE.Scene, private readonly floorAt: (p: Vec3) => number = () => 0,
    options: VfxOptions = {}) {
    for (let i = 0; i < MUZZLE_POOL; i++) this.muzzles.push(this.buildMuzzle());
    for (let i = 0; i < CASING_POOL; i++) this.casings.push(this.buildCasing());
    this.impacts = new SceneImpact(scene);
    this.assetReady = this.installAuthoredCasings(options);
  }

  ready(): Promise<void> { return this.assetReady; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.impacts.dispose();
    for (const slot of this.casings) {
      this.scene.remove(slot.mesh);
      for (const material of slot.materials) material.dispose();
      if (this.casingModel === 'procedural') slot.mesh.traverse(node => {
        if (node instanceof THREE.Mesh) node.geometry.dispose();
      });
    }
    this.casings.length = 0;
    this.releaseCasingLease(this.casingLease);
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
    return { mesh, materials: [mat], vel: new THREE.Vector3(), born: -1e9, grounded: false, groundedAt: -1e9, floor: 0 };
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
    setOpacity(slot.materials, 1);
    slot.born = performance.now();
    slot.grounded = false;
    slot.groundedAt = -1e9;
  }

  spawnImpact(pos: Vec3, dir: Vec3, hitPlayer: boolean, surface: MapSurface = 'concrete'): void {
    this.impacts.spawn(pos, dir, hitPlayer ? 'player' : surface);
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
          setOpacity(c.materials, 0);
        } else {
          setOpacity(c.materials, 1 - age / CASING_FADE_MS);
        }
      }
    }

    this.impacts.update(now);

    // Drop footstep trackers for ids stepFoot() didn't see this frame (disconnected
    // or despawned) so `feet` doesn't grow for the life of the session.
    for (const id of this.feet.keys()) {
      if (!this.seenFeet.has(id)) this.feet.delete(id);
    }
    this.seenFeet.clear();
  }

  private async installAuthoredCasings(options: VfxOptions): Promise<void> {
    const source = weaponSupportSource('casing', { candidatePreview: options.candidatePreview });
    if (!source?.nodeName) return;
    const acquire = options.acquireWeaponModel ?? acquireWeaponModel;
    const clone = options.cloneWeaponBundleNode ?? cloneWeaponBundleNode;
    let lease: AssetLease<GLTF> | undefined;
    const replacements: { object: THREE.Object3D; materials: THREE.Material[] }[] = [];
    try {
      lease = acquire(source.url);
      this.casingLease = lease;
      const gltf = await lease.value;
      if (!gltf || this.disposed || this.casingLease !== lease) {
        this.releaseCasingLease(lease);
        return;
      }
      for (let i = 0; i < this.casings.length; i++) {
        const object = clone(gltf, source.nodeName);
        if (!object) {
          for (const replacement of replacements) for (const material of replacement.materials) material.dispose();
          this.releaseCasingLease(lease);
          return;
        }
        replacements.push({ object, materials: cloneFadeMaterials(object) });
      }
      if (this.disposed || this.casingLease !== lease) {
        for (const replacement of replacements) for (const material of replacement.materials) material.dispose();
        return;
      }
      for (let i = 0; i < this.casings.length; i++) {
        const slot = this.casings[i]!;
        const replacement = replacements[i]!;
        replacement.object.position.copy(slot.mesh.position);
        replacement.object.quaternion.copy(slot.mesh.quaternion);
        replacement.object.scale.copy(slot.mesh.scale);
        replacement.object.visible = slot.mesh.visible;
        this.scene.remove(slot.mesh);
        slot.mesh.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
        for (const material of slot.materials) material.dispose();
        this.scene.add(replacement.object);
        slot.mesh = replacement.object;
        slot.materials = replacement.materials;
      }
      this.casingModel = 'authored';
    } catch {
      for (const replacement of replacements) for (const material of replacement.materials) material.dispose();
      this.releaseCasingLease(lease);
    }
  }

  private releaseCasingLease(lease: AssetLease<GLTF> | undefined): void {
    if (!lease || this.casingLease !== lease) return;
    this.casingLease = undefined;
    lease.release();
  }
}

function setOpacity(materials: readonly THREE.Material[], opacity: number): void {
  for (const material of materials) material.opacity = opacity;
}

function cloneFadeMaterials(object: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];
  object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const clone = (material: THREE.Material): THREE.Material => {
      const result = material.clone();
      result.transparent = true;
      result.opacity = 0;
      materials.push(result);
      return result;
    };
    node.material = Array.isArray(node.material) ? node.material.map(clone) : clone(node.material);
  });
  return materials;
}

function normalize(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z).normalize();
}
