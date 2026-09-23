import * as THREE from 'three';
import { GAME } from '../src/game-config.js';
import type { MapSurface } from '../src/map/materials.js';

type Vec3 = { readonly x: number; readonly y: number; readonly z: number };
/** `brick` and `sandbag` are presentation kinds: brick is how masonry reads on the
 *  brick sites, sandbag is ready for when the map reports it (see AAA-PLAN-LOOK). */
export type ImpactKind = MapSurface | 'brick' | 'sandbag';
type ImpactTarget = ImpactKind | 'player';
type Chips = { readonly count: number; readonly color: number; readonly size: readonly [number, number, number];
  readonly speed: number; readonly gravity: number; readonly life: number; readonly lift?: number; readonly hot?: boolean };
type Dust = { readonly count: number; readonly color: number; readonly size: readonly [number, number, number];
  readonly opacity: number; readonly life: number };
type Profile = { readonly contact: number; readonly hot?: boolean; readonly chips: Chips; readonly dust: Dust; readonly ring?: boolean };

// Every hit uses exactly seven pooled particles: contact + chips (+ ring) + dust.
const PROFILES: Readonly<Record<ImpactKind, Profile>> = {
  concrete: { contact: 0xa6a294, chips: { count: 3, color: 0xa6a294, size: [.8, .55, 1.5], speed: 2.2, gravity: -7, life: 180 },
    dust: { count: 3, color: 0xc0baaa, size: [4.2, 3.3, 3.8], opacity: .42, life: 480 } },
  gravel: { contact: 0x8d887b, chips: { count: 3, color: 0x8d887b, size: [.8, .55, 1.5], speed: 2.2, gravity: -7, life: 180 },
    dust: { count: 3, color: 0xb2ad9b, size: [4.2, 3.3, 3.8], opacity: .42, life: 480 } },
  // Wet earth: dark clods thrown up and falling back, a heavy brown cloud.
  mud: { contact: 0x3a2c20, chips: { count: 4, color: 0x33261b, size: [2.6, 2.1, 2.6], speed: 2.8, gravity: -9, life: 380, lift: 1.8 },
    dust: { count: 2, color: 0x5f4b37, size: [5.8, 4.4, 5.4], opacity: .62, life: 620 } },
  // Timber: long pale splinters flicking off fast, little dust.
  wood: { contact: 0xe3cc9c, chips: { count: 5, color: 0xd9b67a, size: [.4, .4, 6], speed: 4.2, gravity: -6, life: 320, lift: .6 },
    dust: { count: 1, color: 0xb59d77, size: [3, 2.4, 3], opacity: .3, life: 380 } },
  // Sandbags: short grit spray and a big pale burlap puff.
  sandbag: { contact: 0xb39c72, chips: { count: 3, color: 0x8a7654, size: [.45, .45, .9], speed: 3, gravity: -7, life: 240 },
    dust: { count: 3, color: 0xcdb78d, size: [6, 4.8, 5.6], opacity: .55, life: 700 } },
  // Brick: red-brown chips and a rust-coloured dust cloud, kept orange-brown so it never reads as a blood hit.
  brick: { contact: 0xb08a6a, chips: { count: 4, color: 0x6e4a36, size: [1.7, 1.3, 1.9], speed: 3, gravity: -8, life: 320 },
    dust: { count: 2, color: 0xa8704e, size: [5, 4, 4.6], opacity: .56, life: 560 } },
  // Corrugated iron: white-hot contact, long sparks and a quick bright ring.
  metal: { contact: 0xfff0c0, hot: true, ring: true,
    chips: { count: 4, color: GAME.palette.impactSpark, size: [.3, .3, 7.5], speed: 5.5, gravity: -5, life: 200, hot: true },
    dust: { count: 1, color: 0x968c7b, size: [3, 2.4, 3], opacity: .32, life: 480 } },
};
const FORWARD = new THREE.Vector3(0, 0, 1);
const FOOT_DUST = { color: 0xb8a784, size: [13, 3.5, 13] as const, opacity: .24, life: 420, lift: .12 };
const IMPACT_POOL = 48, FOOT_POOL = 12;

// Mutable slots are reused for the lifetime of the scene, including shader uniforms.
type Particle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  softness: { value: number };
  velocity: THREE.Vector3;
  origin: THREE.Vector3;
  size: THREE.Vector3;
  born: number;
  life: number;
  gravity: number;
  opacity: number;
  grow: number;
};

export type SceneImpactOptions = { readonly brickMasonry?: boolean };

export class SceneImpact {
  private readonly geometry = new THREE.SphereGeometry(.035, 6, 5);
  private readonly particles: Particle[];
  private readonly feet: Particle[];
  private cursor = 0;
  private footCursor = 0;
  /** Reduced motion: contact and a still dust mark only; no flying debris, no foot dust. */
  reducedMotion = false;

  constructor(private readonly scene: THREE.Scene, private readonly options: SceneImpactOptions = {}) {
    this.particles = Array.from({ length: IMPACT_POOL }, () => this.slot());
    this.feet = Array.from({ length: FOOT_POOL }, () => this.slot());
  }

  private slot(): Particle {
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const softness = { value: 0 };
    material.onBeforeCompile = shader => {
      shader.uniforms.impactSoftness = softness;
      shader.vertexShader = `varying vec3 impactNormal;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nimpactNormal = normalMatrix * normal;',
      );
      // softness > 0: soft-edged puff; < 0: hollow ring (bright rim, clear centre).
      shader.fragmentShader = `uniform float impactSoftness;\nvarying vec3 impactNormal;\n${shader.fragmentShader}`.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float edge = smoothstep(0.08, 0.85, abs(normalize(impactNormal).z));
float rim = 1.0 - edge;
diffuseColor.a *= impactSoftness < 0.0 ? clamp(rim * rim * 4.0, 0.0, 1.0) : mix(1.0, edge * edge, impactSoftness);`,
      );
    };
    material.customProgramCacheKey = () => 'pooled-impact-soft-edge-v2';
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, softness, velocity: new THREE.Vector3(), origin: new THREE.Vector3(),
      size: new THREE.Vector3(), born: 0, life: 0, gravity: 0, opacity: 0, grow: 0 };
  }

  private next(): Particle {
    const slot = this.particles[this.cursor];
    if (!slot) throw new RangeError('Impact pool cursor outside its fixed capacity');
    this.cursor = (this.cursor + 1) % this.particles.length;
    return slot;
  }

  private place(slot: Particle, position: Vec3, color: number, additive: boolean, size: readonly number[],
    life: number, gravity: number, opacity: number, softness: number, grow: number, born: number): void {
    slot.mesh.position.set(position.x, position.y, position.z);
    slot.origin.copy(slot.mesh.position);
    slot.mesh.material.color.setHex(color);
    slot.mesh.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    slot.size.set(size[0]!, size[1]!, size[2]!);
    slot.mesh.scale.copy(slot.size);
    if (slot.velocity.lengthSq() > 0) slot.mesh.quaternion.setFromUnitVectors(FORWARD, slot.velocity.clone().normalize());
    slot.mesh.material.opacity = opacity;
    slot.opacity = opacity;
    slot.softness.value = softness;
    slot.life = life; slot.gravity = gravity; slot.grow = grow; slot.born = born;
    slot.mesh.visible = true;
  }

  spawn(position: Vec3, direction: Vec3, target: ImpactTarget): void {
    const born = performance.now();
    const back = new THREE.Vector3(direction.x, direction.y, direction.z).normalize().negate();
    const scatter = () => new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5);
    if (target === 'player') {
      for (let index = 0; index < 5; index++) {
        const slot = this.next();
        slot.velocity.copy(back).addScaledVector(scatter(), .9).normalize().multiplyScalar(this.reducedMotion ? 0 : 1.4 * (.5 + Math.random()));
        this.place(slot, position, GAME.palette.impactBlood, false, [.7, .7, 1.8], 340, this.reducedMotion ? 0 : -7, 1, 0, -.55, born);
      }
      return;
    }
    const kind = target === 'concrete' && this.options.brickMasonry ? 'brick' : target;
    const profile = PROFILES[kind];
    const contact = this.next();
    contact.velocity.set(0, 0, 0); contact.mesh.quaternion.identity();
    this.place(contact, position, profile.contact, profile.hot === true, [2.4, 2.4, .6], 65, 0, 1, 0, -.55, born);
    if (!this.reducedMotion) {
      for (let index = 1; index <= profile.chips.count; index++) {
        const chip = profile.chips, slot = this.next();
        slot.velocity.copy(back).addScaledVector(scatter(), .9);
        slot.velocity.y += chip.lift ?? 0;
        slot.velocity.normalize().multiplyScalar(chip.speed * (.5 + Math.random()));
        this.place(slot, position, chip.color, chip.hot === true, chip.size, chip.life + index * 25, chip.gravity, 1, 0, -.55, born);
      }
      if (profile.ring) {
        const ring = this.next();
        ring.velocity.set(0, 0, 0);
        ring.mesh.quaternion.setFromUnitVectors(FORWARD, back);
        this.place(ring, position, 0xfff2d0, true, [4, 4, .15], 140, 0, 1, -1, 4, born);
      }
    }
    // Reduced motion keeps the same total so the pool arithmetic never changes.
    const dustCount = 7 - 1 - (this.reducedMotion ? 0 : profile.chips.count + (profile.ring ? 1 : 0));
    for (let index = 0; index < dustCount; index++) {
      const slot = this.next();
      slot.velocity.copy(back).addScaledVector(scatter(), .9).normalize()
        .multiplyScalar(this.reducedMotion ? 0 : .75 * (.5 + Math.random()));
      this.place(slot, position, profile.dust.color, false, profile.dust.size, profile.dust.life,
        this.reducedMotion ? 0 : -.6, profile.dust.opacity, 1, this.reducedMotion ? 0 : 3, born);
    }
  }

  /** Muzzle-blast dust kicked up just ahead of a shooter's feet: low and faint, so
   *  it marks the shooter without ever hiding a torso or acting as cover. */
  muzzleDust(ground: Vec3): void {
    if (this.reducedMotion) return;
    const slot = this.feet[this.footCursor]!;
    this.footCursor = (this.footCursor + 1) % this.feet.length;
    slot.velocity.set(0, FOOT_DUST.lift, 0); slot.mesh.quaternion.identity();
    this.place(slot, { x: ground.x, y: ground.y + .06, z: ground.z }, FOOT_DUST.color, false, FOOT_DUST.size,
      FOOT_DUST.life, 0, FOOT_DUST.opacity, 1, .6, performance.now());
  }

  update(now: number): void {
    for (const pool of [this.particles, this.feet]) for (const slot of pool) {
      if (!slot.mesh.visible) continue;
      const age = Math.max(0, now - slot.born);
      if (age >= slot.life) { slot.mesh.visible = false; continue; }
      const seconds = age / 1000, progress = age / slot.life;
      slot.mesh.position.copy(slot.origin).addScaledVector(slot.velocity, seconds);
      slot.mesh.position.y += .5 * slot.gravity * seconds * seconds;
      slot.mesh.scale.copy(slot.size).multiplyScalar(Math.max(.05, 1 + progress * slot.grow));
      slot.mesh.material.opacity = slot.softness.value > 0 ? slot.opacity * (1 - progress) ** 2 : slot.opacity * (1 - progress) ** 1.5;
    }
  }

  dispose(): void {
    if (this.particles.length === 0) return;
    for (const slot of [...this.particles, ...this.feet]) { this.scene.remove(slot.mesh); slot.mesh.material.dispose(); }
    this.particles.length = 0;
    this.feet.length = 0;
    this.geometry.dispose();
  }
}
