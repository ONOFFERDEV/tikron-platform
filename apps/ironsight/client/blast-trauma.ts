import * as THREE from 'three';
import { nearestBox, type Box, type Vec3 } from '../src/physics.js';

export const BLAST_TRAUMA = { maxRoll: 2 * Math.PI / 180, decayMs: 2000, range: 30 } as const;

/** Cosmetic pressure response. Roll preserves the central aim ray, including ADS.
 * No translation, random per-frame jitter, world-state writes or GPU resources. */
export class BlastTrauma {
  private trauma = 0;
  private last = 0;
  private started = 0;
  private endsAt = 0;
  private readonly saved = new THREE.Quaternion();
  roll = 0;

  clear(): void { this.trauma = 0; this.roll = 0; this.endsAt = 0; }
  private advance(now: number): void {
    if (!Number.isFinite(now)) return;
    now = Math.max(this.last, now);
    this.trauma = Math.max(0, (this.endsAt - now) / BLAST_TRAUMA.decayMs);
    this.last = now;
  }
  impact(source: Vec3, eye: Vec3, boxes: readonly Box[], now: number, strength = .85): void {
    if (![source.x, source.y, source.z, eye.x, eye.y, eye.z, now, strength].every(Number.isFinite)) return;
    const x = source.x - eye.x, y = source.y - eye.y, z = source.z - eye.z;
    const distance = Math.hypot(x, y, z);
    if (distance >= BLAST_TRAUMA.range || strength <= 0) return;
    // Use current collision, including ramp volumes and opening core shutters.
    if (distance > .001 && nearestBox(eye, { x: x / distance, y: y / distance, z: z / distance }, boxes, distance) < distance) return;
    this.advance(now);
    if (this.trauma === 0) this.started = this.last;
    const falloff = Math.max(0, 1 - Math.max(0, distance - 4) / (BLAST_TRAUMA.range - 4));
    this.trauma = Math.min(1, this.trauma + Math.min(1, strength) * falloff);
    this.endsAt = this.last + this.trauma * BLAST_TRAUMA.decayMs;
  }
  sample(now: number, ads = 0): number {
    this.advance(now);
    const t = (this.last - this.started) / 1000;
    const wave = .75 * Math.sin(t * Math.PI * 14) + .25 * Math.sin(t * Math.PI * 22);
    this.roll = BLAST_TRAUMA.maxRoll * this.trauma ** 2 * wave * (1 - .65 * Math.max(0, Math.min(1, ads)));
    return this.roll;
  }
  /** Restore even if rendering throws. Gameplay never observes the cosmetic pose. */
  render(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, scene: THREE.Scene, now: number, ads: number): void {
    const roll = this.sample(now, ads);
    this.saved.copy(camera.quaternion);
    try {
      camera.rotateZ(roll);
      renderer.render(scene, camera);
    } finally {
      camera.quaternion.copy(this.saved);
      camera.updateMatrixWorld(true);
    }
  }
  inspect() { return { trauma: this.trauma, rollRadians: this.roll, maxDegrees: 2 }; }
}
