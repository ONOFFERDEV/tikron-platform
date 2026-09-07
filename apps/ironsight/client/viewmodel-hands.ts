import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reloadPose } from './reload-presentation.js';

// Camera-local wrist frames for the five fitted weapon meshes. The pistol's
// support palm wraps the firing grip; long guns support the underside fore-end.
const WRISTS = [
  { right: [0.021, -0.057, -0.17], left: [-0.014, -0.043, -0.51] },
  { right: [0.021, -0.057, -0.28], left: [-0.014, -0.043, -0.40] },
  { right: [0.021, -0.057, -0.28], left: [-0.014, -0.043, -0.43] },
  { right: [0.021, -0.057, -0.28], left: [-0.014, -0.043, -0.45] },
  { right: [0.021, -0.057, -0.28], left: [-0.020, -0.058, -0.30] },
] as const;
const gloveMaterial = new T.MeshStandardMaterial({ color: 0x253035, roughness: 0.9 });
const armorMaterial = new T.MeshStandardMaterial({ color: 0x506968, roughness: 0.82, metalness: 0.08, flatShading: true });
const cuffMaterial = new T.MeshStandardMaterial({ color: 0xc09654, roughness: 0.8 });
function boxes(parts: number[][]): T.BufferGeometry {
  const pieces = parts.map(([x, y, z, w, h, d]) => new T.BoxGeometry(w, h, d).translate(x!, y!, z!));
  const merged = mergeGeometries(pieces)!; pieces.forEach(g => g.dispose()); return merged;
}
/** Original low-poly closed gloves and forearm armor. Six draw calls total;
 * individual fingers are merged at construction, no per-frame allocations. */
export class ViewmodelHands {
  readonly group = new T.Group();
  private readonly hands: { palm: T.Group; sleeve: T.Mesh; cuff: T.Mesh; side: number }[] = [];
  private readonly wrist = new T.Vector3(); private readonly elbow = new T.Vector3();
  private readonly delta = new T.Vector3(); private readonly up = new T.Vector3(0, 1, 0);
  constructor() {
    for (const side of [1, -1]) {
      const palm = new T.Group();
      const glove = new T.Mesh(boxes([
        [side * 0.025, -0.004, 0, 0.045, 0.055, 0.065],
        ...[0, 1, 2, 3].map(i => [-0.002, -0.030 + i * 0.014, -0.021, 0.062, 0.011, 0.024]),
        [side * -0.012, 0.023, 0.015, 0.025, 0.022, 0.045],
      ]), gloveMaterial);
      palm.add(glove);
      const sleeve = new T.Mesh(new T.CylinderGeometry(0.045, 0.065, 1, 6), armorMaterial);
      const cuff = new T.Mesh(new T.CylinderGeometry(0.037, 0.038, 0.042, 6), cuffMaterial);
      this.group.add(palm, sleeve, cuff); this.hands.push({ palm, sleeve, cuff, side });
    }
  }
  update(index: number, progress: number | null): void {
    const pose = reloadPose(progress);
    for (const { palm, sleeve, cuff, side } of this.hands) {
      const right = side === 1;
      const fit = WRISTS[index] ?? WRISTS[0]!;
      const wrist = right ? fit.right : fit.left;
      this.wrist.set(wrist[0], wrist[1], wrist[2]);
      if (!right && index === 0) {
        this.wrist.z += pose.reach * 0.15 + pose.bolt * 0.28;
        this.wrist.y -= pose.reach * 0.07 + pose.magazine * 0.20;
        this.wrist.x += pose.magazine * 0.052;
        this.wrist.y += pose.bolt * 0.13;
      }
      palm.position.copy(this.wrist);
      palm.rotation.set(right ? -0.18 : -0.25, 0, right ? -0.10 : 0.45);
      this.elbow.set(side * 0.27, -0.35, 0.08);
      this.delta.subVectors(this.wrist, this.elbow);
      sleeve.position.copy(this.elbow).addScaledVector(this.delta, 0.46);
      sleeve.scale.y = this.delta.length() * 0.87;
      sleeve.quaternion.setFromUnitVectors(this.up, this.delta.normalize());
      cuff.position.copy(this.wrist).addScaledVector(this.delta, -0.035);
      cuff.quaternion.copy(sleeve.quaternion);
    }
  }
}
