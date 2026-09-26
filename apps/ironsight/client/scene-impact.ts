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

// Logical slots are reused for the lifetime of the scene. Every slot is drawn through
// two shared InstancedMeshes (normal and additive blending): at most two draws for all
// impacts and foot dust, instead of one draw per particle.
type Particle = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  color: THREE.Color;
  velocity: THREE.Vector3;
  origin: THREE.Vector3;
  size: THREE.Vector3;
  born: number;
  life: number;
  gravity: number;
  opacity: number;
  alpha: number;
  softness: number;
  grow: number;
  additive: boolean;
  visible: boolean;
};

export type SceneImpactOptions = { readonly brickMasonry?: boolean };
/** Read-only view of one live particle (tests and inspectors). */
export type ImpactParticleView = { readonly position: THREE.Vector3; readonly scale: THREE.Vector3;
  readonly quaternion: THREE.Quaternion; readonly color: THREE.Color; readonly opacity: number;
  readonly additive: boolean; readonly softness: number };

function particleMaterial(blending: THREE.Blending): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float impactAlpha;\nattribute float impactSoftness;\nvarying float vImpactAlpha;\n'
      + 'varying float vImpactSoftness;\nvarying vec3 impactNormal;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvImpactAlpha = impactAlpha; vImpactSoftness = impactSoftness;\n'
      // Per-instance normal matrix: the old per-mesh normalMatrix included the non-uniform size.
      + 'impactNormal = normalMatrix * (transpose(inverse(mat3(instanceMatrix))) * normal);',
    );
    // softness > 0: soft-edged puff; < 0: hollow ring (bright rim, clear centre).
    shader.fragmentShader = 'varying float vImpactAlpha;\nvarying float vImpactSoftness;\nvarying vec3 impactNormal;\n'
      + shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\nfloat edge = smoothstep(0.08, 0.85, abs(normalize(impactNormal).z));\nfloat rim = 1.0 - edge;\n'
        + 'diffuseColor.a *= vImpactAlpha * (vImpactSoftness < 0.0 ? clamp(rim * rim * 4.0, 0.0, 1.0) : mix(1.0, edge * edge, vImpactSoftness));');
  };
  material.customProgramCacheKey = () => 'pooled-impact-instanced-v3';
  return material;
}

export class SceneImpact {
  private readonly geometry = new THREE.SphereGeometry(.035, 6, 5);
  private readonly particles: Particle[];
  private readonly feet: Particle[];
  private readonly slots: Particle[];
  private readonly meshes: THREE.InstancedMesh[];
  private readonly alpha: THREE.InstancedBufferAttribute[] = [];
  private readonly softness: THREE.InstancedBufferAttribute[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private cursor = 0;
  private footCursor = 0;
  private dirty = false;
  /** Reduced motion: contact and a still dust mark only; no flying debris, no foot dust. */
  reducedMotion = false;

  constructor(private readonly scene: THREE.Scene, private readonly options: SceneImpactOptions = {}) {
    const slot = (): Particle => ({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(), color: new THREE.Color(), velocity: new THREE.Vector3(), origin: new THREE.Vector3(),
      size: new THREE.Vector3(), born: 0, life: 0, gravity: 0, opacity: 0, alpha: 0, softness: 0, grow: 0,
      additive: false, visible: false });
    this.particles = Array.from({ length: IMPACT_POOL }, slot);
    this.feet = Array.from({ length: FOOT_POOL }, slot);
    this.slots = [...this.particles, ...this.feet];
    const capacity = this.slots.length;
    this.meshes = [THREE.NormalBlending, THREE.AdditiveBlending].map((blending, family) => {
      const geometry = this.geometry.clone();
      const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
      const soft = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('impactAlpha', alpha); geometry.setAttribute('impactSoftness', soft);
      this.alpha.push(alpha); this.softness.push(soft);
      const mesh = new THREE.InstancedMesh(geometry, particleMaterial(blending), capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < capacity; i++) { mesh.setMatrixAt(i, this.zero); mesh.setColorAt(i, new THREE.Color()); }
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      mesh.name = family === 0 ? 'impact-particles' : 'impact-particles-hot';
      mesh.frustumCulled = false; mesh.visible = false; mesh.raycast = () => {};
      scene.add(mesh);
      return mesh;
    });
  }

  private next(): Particle {
    const slot = this.particles[this.cursor];
    if (!slot) throw new RangeError('Impact pool cursor outside its fixed capacity');
    this.cursor = (this.cursor + 1) % this.particles.length;
    return slot;
  }

  private place(slot: Particle, position: Vec3, color: number, additive: boolean, size: readonly number[],
    life: number, gravity: number, opacity: number, softness: number, grow: number, born: number): void {
    slot.position.set(position.x, position.y, position.z);
    slot.origin.copy(slot.position);
    slot.color.setHex(color);
    slot.additive = additive;
    slot.size.set(size[0]!, size[1]!, size[2]!);
    slot.scale.copy(slot.size);
    if (slot.velocity.lengthSq() > 0) slot.quaternion.setFromUnitVectors(FORWARD, slot.velocity.clone().normalize());
    slot.alpha = opacity; slot.opacity = opacity; slot.softness = softness;
    slot.life = life; slot.gravity = gravity; slot.grow = grow; slot.born = born;
    slot.visible = true;
    this.dirty = true; // uploaded by the next update(), once per frame
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
    contact.velocity.set(0, 0, 0); contact.quaternion.identity();
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
        ring.quaternion.setFromUnitVectors(FORWARD, back);
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
    slot.velocity.set(0, FOOT_DUST.lift, 0); slot.quaternion.identity();
    this.place(slot, { x: ground.x, y: ground.y + .06, z: ground.z }, FOOT_DUST.color, false, FOOT_DUST.size,
      FOOT_DUST.life, 0, FOOT_DUST.opacity, 1, .6, performance.now());
  }

  update(now: number): void {
    if (!this.dirty) return;
    let live = false;
    for (const slot of this.slots) {
      if (!slot.visible) continue;
      const age = Math.max(0, now - slot.born);
      if (age >= slot.life) { slot.visible = false; continue; }
      live = true;
      const seconds = age / 1000, progress = age / slot.life;
      slot.position.copy(slot.origin).addScaledVector(slot.velocity, seconds);
      slot.position.y += .5 * slot.gravity * seconds * seconds;
      slot.scale.copy(slot.size).multiplyScalar(Math.max(.05, 1 + progress * slot.grow));
      slot.alpha = slot.softness > 0 ? slot.opacity * (1 - progress) ** 2 : slot.opacity * (1 - progress) ** 1.5;
    }
    this.write();
    this.dirty = live;
  }

  /** Upload live slots into their family's instance buffers. Soft puffs go first and
   *  chips, contacts and rings after, so solid debris draws over its own dust as it
   *  did when each particle was a separately sorted mesh. Unused instances collapse. */
  private write(): void {
    const next = [0, 0];
    for (const pass of [0, 1]) for (const slot of this.slots) {
      if (!slot.visible || (slot.softness > 0 ? 0 : 1) !== pass) continue;
      const family = slot.additive ? 1 : 0, i = next[family]!++;
      const mesh = this.meshes[family]!;
      mesh.setMatrixAt(i, this.matrix.compose(slot.position, slot.quaternion, slot.scale));
      mesh.setColorAt(i, slot.color);
      this.alpha[family]!.setX(i, slot.alpha); this.softness[family]!.setX(i, slot.softness);
    }
    this.meshes.forEach((mesh, family) => {
      for (let i = next[family]!; i < mesh.count; i++) mesh.setMatrixAt(i, this.zero);
      mesh.visible = next[family]! > 0;
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true;
      this.alpha[family]!.needsUpdate = true; this.softness[family]!.needsUpdate = true;
    });
  }

  /** Live particles, in slot order (tests and inspectors only). */
  particlesView(): ImpactParticleView[] {
    return this.slots.filter(slot => slot.visible).map(slot => ({ position: slot.position, scale: slot.scale,
      quaternion: slot.quaternion, color: slot.color, opacity: slot.alpha, additive: slot.additive, softness: slot.softness }));
  }

  /** The two instanced draws (resource and program-stability checks). */
  get drawMeshes(): readonly THREE.InstancedMesh[] { return this.meshes; }

  dispose(): void {
    if (this.particles.length === 0) return;
    for (const mesh of this.meshes) {
      this.scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose();
    }
    this.particles.length = 0;
    this.feet.length = 0;
    this.slots.length = 0;
    this.geometry.dispose();
  }
}
