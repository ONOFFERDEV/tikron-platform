import * as THREE from 'three';
import { GAME } from '../src/game-config.js';

type Vec3 = { x: number; y: number; z: number };
type Nade = Vec3 & { id: string; vx: number; vy: number; vz: number };
export const BOOM_LIFE_MS = 650;
const GRAVITY = -22, FORWARD = new THREE.Vector3(0, 0, 1);
const P = GAME.palette;

/** Fixed GPU resources for transient combat. Saturation replaces the oldest
 * cosmetic slot; it never drops a server event's damage or changes collision.
 * All meshes exist before SceneRig.prepare() uploads/warms them. */
export class CombatFx {
  private readonly grenadeById = new Map<string, number>();
  private readonly grenades;
  private readonly blasts;
  private readonly traces;
  private grenadeCursor = 0;
  private blastCursor = 0;
  private traceCursor = 0;
  private readonly matrix = new THREE.Matrix4();
  private lastTick = performance.now();

  constructor(scene: THREE.Scene) {
    const grenadeGeometry = new THREE.SphereGeometry(.13, 10, 8);
    const grenadeMaterial = new THREE.MeshStandardMaterial({ color: P.grenadeMesh, roughness: .6, metalness: .3 });
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
      tracers: this.traces.filter(t => t.mesh.visible).length, grenades: this.grenadeById.size };
  }
}
