import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GAME } from '../src/game-config.js';
import { GRENADE } from '../src/config.js';
import type { MapSurface } from '../src/map/materials.js';
import { acquireWeaponModel, cloneWeaponBundleNode, weaponSupportSource } from './weapon-loader.js';
import type { AssetLease } from './shared-gltf-cache.js';

type Vec3 = { x: number; y: number; z: number };
type Nade = Vec3 & { id: string; vx: number; vy: number; vz: number };
type GrenadeSlot = { mesh: THREE.Object3D; id: string; vx: number; vy: number; vz: number };
export type CombatFxOptions = {
  readonly candidatePreview?: boolean;
  readonly acquireWeaponModel?: (url: string) => AssetLease<GLTF>;
  readonly cloneWeaponBundleNode?: (gltf: GLTF, nodeName: string) => THREE.Object3D | undefined;
};
export const BOOM_LIFE_MS = 650;
export const GRENADE_VISUAL_TOLERANCE_M = .02;
const GRAVITY = -22, FORWARD = new THREE.Vector3(0, 0, 1);
const P = GAME.palette;

export const IMPACT_PROFILES: Readonly<Record<MapSurface, { readonly color: number; readonly sparks: number; readonly dust: number }>> = {
  mud: { color: 0x75624c, sparks: 0, dust: 6 },
  gravel: { color: 0x9a9181, sparks: 2, dust: 5 },
  wood: { color: 0x9b7048, sparks: 0, dust: 4 },
  metal: { color: 0xffd08a, sparks: 6, dust: 1 },
  concrete: { color: 0xb8b2a7, sparks: 2, dust: 6 },
  brick: { color: 0xa8704e, sparks: 1, dust: 6 },
  sandbag: { color: 0xcdb78d, sparks: 0, dust: 7 },
};

export function nearMissDistance(origin: Vec3, direction: Vec3, length: number, listener: Vec3): number {
  const magnitude = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(magnitude) || magnitude <= 0 || !Number.isFinite(length) || length <= 0) return Infinity;
  const dx = direction.x / magnitude, dy = direction.y / magnitude, dz = direction.z / magnitude;
  const along = Math.max(0, Math.min(length,
    (listener.x - origin.x) * dx + (listener.y - origin.y) * dy + (listener.z - origin.z) * dz));
  return Math.hypot(
    listener.x - (origin.x + dx * along),
    listener.y - (origin.y + dy * along),
    listener.z - (origin.z + dz * along),
  );
}

export type CombatCue =
  | (Vec3 & { readonly kind: 'impact'; readonly shotId: string; readonly material: MapSurface; readonly born: number; readonly intensity: number })
  | { readonly kind: 'near_miss'; readonly shotId: string; readonly distance: number; readonly born: number; readonly intensity: number };

export class CombatCuePool {
  private readonly impactCapacity: number;
  private readonly nearMissCapacity: number;
  private readonly dedupCapacity: number;
  private reducedMotion: boolean;
  private readonly impacts: CombatCue[] = [];
  private readonly nearMisses: CombatCue[] = [];
  private readonly ids = new Set<string>();
  private readonly idOrder: string[] = [];

  constructor(options: { readonly impactCapacity: number; readonly nearMissCapacity: number; readonly reducedMotion?: boolean; readonly dedupCapacity?: number }) {
    if (!Number.isSafeInteger(options.impactCapacity) || options.impactCapacity < 1 ||
        !Number.isSafeInteger(options.nearMissCapacity) || options.nearMissCapacity < 1 ||
        (options.dedupCapacity !== undefined && (!Number.isSafeInteger(options.dedupCapacity) || options.dedupCapacity < 1))) {
      throw new RangeError('combat cue capacities must be positive safe integers');
    }
    this.impactCapacity = options.impactCapacity;
    this.nearMissCapacity = options.nearMissCapacity;
    this.dedupCapacity = options.dedupCapacity ?? 256;
    this.reducedMotion = options.reducedMotion ?? false;
  }

  impact(value: Vec3 & { readonly shotId: string; readonly material: MapSurface }, now: number): boolean {
    if (!this.accept(`impact:${value.shotId}`)) return false;
    this.push(this.impacts, this.impactCapacity, { ...value, kind: 'impact', born: now, intensity: this.reducedMotion ? .45 : 1 });
    return true;
  }

  nearMiss(value: { readonly shotId: string; readonly distance: number }, now: number): boolean {
    if (!this.accept(`near_miss:${value.shotId}`)) return false;
    this.push(this.nearMisses, this.nearMissCapacity, { ...value, kind: 'near_miss', born: now, intensity: this.reducedMotion ? .35 : 1 });
    return true;
  }

  active(now: number): readonly CombatCue[] {
    return [...this.impacts.filter(cue => now - cue.born < 480), ...this.nearMisses.filter(cue => now - cue.born < 350)];
  }

  inspect(): { readonly impacts: number; readonly nearMisses: number } {
    return { impacts: this.impacts.length, nearMisses: this.nearMisses.length };
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  private accept(key: string): boolean {
    if (key.endsWith(':') || this.ids.has(key)) return false;
    this.ids.add(key);
    this.idOrder.push(key);
    if (this.idOrder.length > this.dedupCapacity) {
      const evicted = this.idOrder.shift();
      if (evicted !== undefined) this.ids.delete(evicted);
    }
    return true;
  }

  private push(target: CombatCue[], capacity: number, cue: CombatCue): void {
    if (target.length === capacity) {
      target.shift();
    }
    target.push(cue);
  }
}

/** Fixed GPU resources for transient combat. Saturation replaces the oldest
 * cosmetic slot; it never drops a server event's damage or changes collision.
 * All meshes exist before SceneRig.prepare() uploads/warms them. */
export class CombatFx {
  private readonly scene: THREE.Scene;
  private readonly grenadeById = new Map<string, number>();
  private readonly grenades: GrenadeSlot[];
  private readonly blasts;
  private readonly traces;
  private grenadeCursor = 0;
  private blastCursor = 0;
  private traceCursor = 0;
  private readonly matrix = new THREE.Matrix4();
  private lastTick = performance.now();
  private grenadeLease: AssetLease<GLTF> | undefined;
  private grenadeModel: 'procedural' | 'authored' = 'procedural';
  private disposed = false;
  private readonly assetReady: Promise<void>;
  private grenadeGeometry: THREE.SphereGeometry | undefined;
  private grenadeMaterial: THREE.MeshStandardMaterial | undefined;

  constructor(scene: THREE.Scene, options: CombatFxOptions = {}) {
    this.scene = scene;
    const grenadeGeometry = new THREE.SphereGeometry(.13, 10, 8);
    const grenadeMaterial = new THREE.MeshStandardMaterial({ color: P.grenadeMesh, roughness: .6, metalness: .3 });
    this.grenadeGeometry = grenadeGeometry;
    this.grenadeMaterial = grenadeMaterial;
    const ringGeometry = new THREE.RingGeometry(.4, .55, 40);
    const debrisGeometry = new THREE.BoxGeometry(.08, .08, .08);
    const traceGeometry = new THREE.BoxGeometry(.018, .018, 1);
    const add = <T extends THREE.Mesh>(mesh: T): T => { mesh.visible = false; scene.add(mesh); return mesh; };
    this.grenades = Array.from({ length: 32 }, () => ({
      mesh: add(new THREE.Mesh(grenadeGeometry, grenadeMaterial)), id: '', vx: 0, vy: 0, vz: 0,
    }));
    this.blasts = Array.from({ length: 12 }, () => {
      const ring = add(new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: P.boom.ring,
        transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
      ring.rotation.x = -Math.PI / 2;
      const parts = add(new THREE.InstancedMesh(debrisGeometry, new THREE.MeshBasicMaterial({ color: P.boom.parts,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 18));
      parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parts.frustumCulled = false;
      return { ring, parts, positions: Array.from({ length: 18 }, () => new THREE.Vector3()),
        velocities: Array.from({ length: 18 }, () => new THREE.Vector3()), born: -Infinity };
    });
    this.traces = Array.from({ length: 96 }, () => ({
      mesh: add(new THREE.Mesh(traceGeometry, new THREE.MeshBasicMaterial({ color: P.tracerMiss,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))),
      origin: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, segLen: 0, speed: 1, born: -Infinity,
    }));
    this.assetReady = this.installAuthoredGrenades(options);
  }

  ready(): Promise<void> { return this.assetReady; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of this.grenades) this.scene.remove(slot.mesh);
    this.releaseGrenadeLease(this.grenadeLease);
    this.grenadeGeometry?.dispose();
    this.grenadeMaterial?.dispose();
    this.grenadeGeometry = undefined;
    this.grenadeMaterial = undefined;
    this.grenadeById.clear();
  }

  spawnNade(e: Nade): void {
    const index = this.grenadeById.get(e.id) ?? this.grenadeCursor++ % this.grenades.length;
    const slot = this.grenades[index]!;
    if (slot.id) this.grenadeById.delete(slot.id);
    slot.id = e.id; slot.vx = e.vx; slot.vy = e.vy; slot.vz = e.vz;
    slot.mesh.position.set(e.x, e.y, e.z); slot.mesh.rotation.set(0, 0, 0); slot.mesh.visible = true;
    this.grenadeById.set(e.id, index);
  }

  bounceNade(e: Nade): void {
    const index = this.grenadeById.get(e.id);
    if (index === undefined) return;
    const slot = this.grenades[index]!;
    slot.mesh.position.set(e.x, e.y, e.z); slot.vx = e.vx; slot.vy = e.vy; slot.vz = e.vz;
  }

  boom(e: Vec3 & { id: string }, now: number): void {
    const index = this.grenadeById.get(e.id);
    if (index !== undefined) {
      const slot = this.grenades[index]!; slot.id = ''; slot.mesh.visible = false;
      this.grenadeById.delete(e.id);
    }
    const b = this.blasts[this.blastCursor++ % this.blasts.length]!;
    b.born = now; b.ring.position.set(e.x, Math.max(.05, e.y) + .05, e.z);
    b.ring.scale.set(1, 1, 1); b.ring.material.opacity = .9; b.parts.material.opacity = 1;
    b.ring.visible = b.parts.visible = true;
    for (let i = 0; i < 18; i++) {
      const pos = b.positions[i]!, v = b.velocities[i]!, angle = i / 18 * Math.PI * 2;
      pos.set(e.x, e.y + .2, e.z);
      v.set(Math.cos(angle) * (3 + Math.random() * 5), 4 + Math.random() * 6, Math.sin(angle) * (3 + Math.random() * 5));
      b.parts.setMatrixAt(i, this.matrix.makeTranslation(pos.x, pos.y, pos.z));
    }
    b.parts.instanceMatrix.needsUpdate = true;
  }

  addTracer(origin: Vec3, dir: Vec3, distance: number, hit: boolean, speed: number, now: number): void {
    const t = this.traces[this.traceCursor++ % this.traces.length]!;
    t.origin.set(origin.x, origin.y, origin.z); t.dir.set(dir.x, dir.y, dir.z).normalize();
    t.dist = Math.max(.5, distance); t.segLen = Math.min(t.dist * .15, 8); t.speed = Math.max(1, speed); t.born = now;
    t.mesh.material.color.set(hit ? P.tracerHit : P.tracerMiss); t.mesh.material.opacity = .85;
    t.mesh.position.copy(t.origin); t.mesh.quaternion.setFromUnitVectors(FORWARD, t.dir);
    t.mesh.scale.set(1, 1, 0); t.mesh.visible = true;
  }

  updateTracers(now: number): void {
    for (const t of this.traces) {
      if (!t.mesh.visible) continue;
      const head = t.speed * Math.max(0, now - t.born) / 1000;
      if (head >= t.dist) { t.mesh.visible = false; t.mesh.material.opacity = 0; continue; }
      const tail = Math.max(0, head - t.segLen);
      t.mesh.position.copy(t.origin).addScaledVector(t.dir, (head + tail) / 2);
      t.mesh.scale.z = head - tail;
      t.mesh.material.opacity = .85 * Math.min(1, (t.dist - head) / t.speed * 1000 / 25);
    }
  }

  update(now: number): void {
    const dt = Math.min(.1, Math.max(0, now - this.lastTick) / 1000); this.lastTick = now;
    for (const n of this.grenades) {
      if (!n.mesh.visible) continue;
      n.vy += GRAVITY * dt;
      n.mesh.position.x += n.vx * dt; n.mesh.position.y = Math.max(.13, n.mesh.position.y + n.vy * dt);
      n.mesh.position.z += n.vz * dt; n.mesh.rotation.x += dt * 6;
    }
    for (const b of this.blasts) {
      if (!b.ring.visible) continue;
      const progress = (now - b.born) / BOOM_LIFE_MS;
      if (progress >= 1) {
        b.ring.visible = b.parts.visible = false; b.ring.material.opacity = b.parts.material.opacity = 0; continue;
      }
      const scale = 1 + progress * 14; b.ring.scale.set(scale, scale, 1);
      b.ring.material.opacity = .9 * (1 - progress); b.parts.material.opacity = 1 - progress;
      for (let i = 0; i < 18; i++) {
        const pos = b.positions[i]!, v = b.velocities[i]!;
        v.y += GRAVITY * .6 * dt; pos.addScaledVector(v, dt);
        b.parts.setMatrixAt(i, this.matrix.makeTranslation(pos.x, pos.y, pos.z));
      }
      b.parts.instanceMatrix.needsUpdate = true;
    }
  }

  inspect() {
    return { explosions: this.blasts.filter(b => b.ring.visible).length,
      tracers: this.traces.filter(t => t.mesh.visible).length, grenades: this.grenadeById.size,
      grenadeModel: this.grenadeModel };
  }

  private async installAuthoredGrenades(options: CombatFxOptions): Promise<void> {
    const source = weaponSupportSource('grenade', { candidatePreview: options.candidatePreview });
    if (!source?.nodeName) return;
    const acquire = options.acquireWeaponModel ?? acquireWeaponModel;
    const clone = options.cloneWeaponBundleNode ?? cloneWeaponBundleNode;
    let lease: AssetLease<GLTF> | undefined;
    try {
      lease = acquire(source.url);
      this.grenadeLease = lease;
      const gltf = await lease.value;
      if (!gltf || this.disposed || this.grenadeLease !== lease) {
        this.releaseGrenadeLease(lease);
        return;
      }
      const replacements: THREE.Object3D[] = [];
      for (let i = 0; i < this.grenades.length; i++) {
        const object = clone(gltf, source.nodeName);
        const visual = object ? centerThrownGrenade(object, source.nodeName) : undefined;
        if (!visual) {
          this.releaseGrenadeLease(lease);
          return;
        }
        replacements.push(visual);
      }
      if (this.disposed || this.grenadeLease !== lease) return;
      for (let i = 0; i < this.grenades.length; i++) {
        const slot = this.grenades[i]!;
        const replacement = replacements[i]!;
        replacement.position.copy(slot.mesh.position);
        replacement.quaternion.copy(slot.mesh.quaternion);
        replacement.scale.copy(slot.mesh.scale);
        replacement.visible = slot.mesh.visible;
        this.scene.remove(slot.mesh);
        this.scene.add(replacement);
        slot.mesh = replacement;
      }
      this.grenadeGeometry?.dispose();
      this.grenadeMaterial?.dispose();
      this.grenadeGeometry = undefined;
      this.grenadeMaterial = undefined;
      this.grenadeModel = 'authored';
    } catch {
      this.releaseGrenadeLease(lease);
    }
  }

  private releaseGrenadeLease(lease: AssetLease<GLTF> | undefined): void {
    if (!lease || this.grenadeLease !== lease) return;
    this.grenadeLease = undefined;
    lease.release();
  }
}

function centerThrownGrenade(object: THREE.Object3D, name: string): THREE.Group | undefined {
  const visual = new THREE.Group();
  visual.name = name;
  visual.add(object);
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return undefined;
  object.position.sub(bounds.getCenter(new THREE.Vector3()));
  visual.updateMatrixWorld(true);
  const radius = maxVertexRadius(visual);
  if (!Number.isFinite(radius) || radius <= 0) return undefined;
  const allowedRadius = GRENADE.projRadius + GRENADE_VISUAL_TOLERANCE_M;
  if (radius > allowedRadius) {
    const fit = allowedRadius / radius;
    object.position.multiplyScalar(fit);
    object.scale.multiplyScalar(fit);
    visual.updateMatrixWorld(true);
  }
  return visual;
}

function maxVertexRadius(object: THREE.Object3D): number {
  const point = new THREE.Vector3();
  let radius = 0;
  object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const position = node.geometry.getAttribute('position');
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
      radius = Math.max(radius, point.length());
    }
  });
  return radius;
}
