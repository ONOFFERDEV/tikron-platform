import * as THREE from 'three';
import { nearestBox, type Box, type Vec3 } from '../src/physics.js';
import { scopeGlintTexture } from './weapon-flash.js';

/** Optical warning, not an ADS indicator: hip-fired snipers are dangerous too.
 * Inputs are only the already-replicated held weapon, life/reload and aim pose.
 * Never synthesizes an unseen/AOI-absent player or changes a gameplay ray. */
export interface ScopeThreat {
  weapon: number; alive: boolean; reloadEnd?: number; yaw: number; pitch: number;
}
export const GLINT = { capacity: 16, innerDegrees: 4, outerDegrees: 14, maxRange: 120 } as const;
const inner = Math.cos(GLINT.innerDegrees * Math.PI / 180);
const outer = Math.cos(GLINT.outerDegrees * Math.PI / 180);
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** No delayed fade through cover. Test lens AND authoritative eye visibility:
 * an animated attachment poking around a solid corner must not reveal its owner.
 * The current shared hit boxes include ramp occluders and Relay gate state. */
export function scopeGlintStrength(p: ScopeThreat, eye: Vec3, lens: Vec3, viewer: Vec3,
  boxes: readonly Box[], serverNow: number): number {
  if (!p.alive || p.weapon !== 3 || (p.reloadEnd ?? 0) > serverNow) return 0;
  const dx = viewer.x - eye.x, dy = viewer.y - eye.y, dz = viewer.z - eye.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!(distance > 1 && distance < GLINT.maxRange)) return 0;
  const cp = Math.cos(p.pitch);
  const facing = (Math.sin(p.yaw) * cp * dx + Math.sin(p.pitch) * dy + Math.cos(p.yaw) * cp * dz) / distance;
  if (!(facing > outer)) return 0;
  for (const target of [eye, lens]) {
    const x = target.x - viewer.x, y = target.y - viewer.y, z = target.z - viewer.z;
    const length = Math.hypot(x, y, z);
    if (nearestBox(viewer, { x: x / length, y: y / length, z: z / length }, boxes, length) < length) return 0;
  }
  return smooth((facing - outer) / (inner - outer)) * smooth((distance - 1) / 2) * smooth((GLINT.maxRange - distance) / 20);
}

/** One fixed instanced draw for every visible scope. No lights, extra passes,
 * per-frame bake, GPU allocation, pulse or quality/Reduced-motion branch. */
export class ScopeGlints {
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private used = 0;
  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: scopeGlintTexture(), transparent: true, depthTest: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    }), GLINT.capacity);
    this.mesh.name = 'scope-glints';
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {}; // never a hybrid hit-claim target
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate instanceColor BEFORE preparation, even when no sniper is present.
    for (let i = 0; i < GLINT.capacity; i++) this.mesh.setColorAt(i, this.color.setRGB(0, 0, 0));
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0; scene.add(this.mesh);
  }
  begin(): void { this.used = 0; }
  add(lens: Vec3, strength: number, camera: THREE.PerspectiveCamera): void {
    if (!(strength > 0) || this.used === GLINT.capacity) return;
    const distance = camera.position.distanceTo(lens);
    // Modest angular footprint in long lanes, capped physically at 2m.
    // The small opaque core leaves the operator's surrounding silhouette clear.
    this.transform.position.copy(lens);
    this.transform.quaternion.copy(camera.quaternion);
    this.transform.scale.setScalar(Math.min(2, .3 + distance * .04));
    this.transform.updateMatrix();
    this.mesh.setMatrixAt(this.used, this.transform.matrix);
    this.mesh.setColorAt(this.used++, this.color.setRGB(strength * 1.6, strength * 1.6, strength * 1.6));
  }
  end(): void {
    this.mesh.count = this.used;
    if (this.used) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true; }
  }
  inspect() { return { active: this.mesh.count, capacity: GLINT.capacity }; }
}
