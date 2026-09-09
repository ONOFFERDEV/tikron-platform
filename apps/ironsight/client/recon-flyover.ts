import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ReconFlight } from '../src/air-support.js';

/** Original unmanned delta-wing silhouette. Fixed two-aircraft pool, one draw
 * each, vertex colour only; well above playable collision, no shadow or light. */
export class ReconFlyover {
  readonly root = new THREE.Group();
  private readonly aircraft: THREE.Mesh[];
  constructor(scene: THREE.Scene, private readonly width: number, private readonly depth: number) {
    const parts: THREE.BufferGeometry[] = [];
    const part = (g: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) => {
      const flat = g.toNonIndexed(); g.dispose(); flat.translate(x, y, z);
      const c = new THREE.Color(color), colors = new Float32Array(flat.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
      flat.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(flat);
    };
    part(new THREE.BoxGeometry(1.2, .55, 6.5), 0xb3c6c7);
    const wing = new THREE.BufferGeometry();
    const positions = [0,0,3.8, -7,0,-2.6, 0,0,-1.2, 0,0,3.8, 0,0,-1.2, 7,0,-2.6];
    wing.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); wing.computeVertexNormals();
    // The wing is already non-indexed; keep the same attributes as the boxes.
    wing.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
    wing.setIndex([0,1,2,3,4,5]); part(wing, 0x839fa5);
    for (const x of [-2, 2]) {
      part(new THREE.BoxGeometry(.75, .7, 3), 0x233c48, x, .15, -1.3);
      part(new THREE.BoxGeometry(.5, .3, .18), 0xffd191, x, .15, -2.85);
      part(new THREE.BoxGeometry(.13, .1, 6), 0x85cbd0, x, .15, -5.9);
      part(new THREE.BoxGeometry(.12, 1.2, 1.3), 0xc3d4cf, x, .8, -1.8);
    }
    const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose());
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
    this.aircraft = Array.from({ length: 2 }, () => {
      const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.castShadow = false;
      this.root.add(mesh); return mesh;
    });
    this.root.name = 'recon-flyover'; scene.add(this.root);
  }
  update(flights: readonly ReconFlight[], now: number): void {
    for (let i = 0; i < this.aircraft.length; i++) {
      const mesh = this.aircraft[i]!, f = flights[i];
      mesh.visible = !!f && now >= f.startedAt && now < f.endsAt;
      if (!f || !mesh.visible) continue;
      const t = (now - f.startedAt) / (f.endsAt - f.startedAt), direction = f.team === 0 ? 1 : -1;
      mesh.position.set(-30 + (this.width + 60) * (direction > 0 ? t : 1 - t), 32 + f.team * 4,
        this.depth * .5 + (f.team === 0 ? -16 : 16));
      mesh.rotation.set(0, direction * Math.PI / 2, 0);
    }
  }
  inspect() { return this.aircraft.map(mesh => ({ visible: mesh.visible, position: mesh.position.toArray(), triangles: mesh.geometry.getAttribute('position').count / 3 })); }
}
