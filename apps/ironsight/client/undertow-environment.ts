import * as T from 'three';
import type { MapDef } from '../src/map/types.js';

/** M2 readable massing, deliberately short of the M3 machinery/art pass.
 * All playable masses exactly match MapDef. Basin and retaining walls are
 * outside the movement bounds. Six instanced material batches, one sign atlas. */
export function buildUndertowEnvironment(scene: T.Scene, map: MapDef): void {
  const colors = [0x8daca8, 0x45616d, 0x283e48, 0xd7c6a0, 0x79a894, 0xd39a50];
  const batches = colors.map(() => [] as T.Matrix4[]);
  const add = (material: number, x: number, y: number, z: number, w: number, h: number, d: number) => {
    batches[material]!.push(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion(), new T.Vector3(w, h, d)));
  };
  add(1, 30, -0.09, 20, 140, 0.15, 120);
  for (const b of map.boxes) {
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
    const color = h < 1.5 ? 2 : h > 4 ? 4 : 0;
    add(color, x, b.min.y + h / 2, z, w, h, d);
    // Painted edge bars are inset within the shared solid envelope.
    add(h < 1.5 ? 5 : 2, x, b.max.y - 0.11, z, w + 0.004, 0.12, d + 0.004);
  }
  for (const z of [-0.45, 40.45]) add(0, 30, 1.4, z, 61.8, 2.8, 0.9);
  for (const x of [-0.45, 60.45]) add(2, x, 1.4, 20, 0.9, 2.8, 40);
  // Flat opaque basin, no water simulation or transparent fullscreen work.
  add(4, 30, -0.01, -11, 48, 0.03, 15);
  for (const x of [12, 24, 36, 48]) add(2, x, 2, -12, 3, 4, 7);
  for (const cap of Object.values(map.caps)) {
    for (const sign of [-1, 1]) {
      add(3, cap.x + sign * 2.7, 0.012, cap.z, 0.10, 0.02, 5.4);
      add(3, cap.x, 0.012, cap.z + sign * 2.7, 5.4, 0.02, 0.10);
    }
  }
  const geometry = new T.BoxGeometry(1, 1, 1);
  batches.forEach((transforms, i) => {
    if (!transforms.length) return;
    const material = new T.MeshStandardMaterial({ color: colors[i], roughness: i === 1 ? 0.72 : 0.88 });
    const mesh = new T.InstancedMesh(geometry, material, transforms.length);
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); scene.add(mesh);
  });
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const labels = ['A / WEST CONTROL', 'B / PUMP HALL', 'C / EAST CONTROL', 'UNDERTOW / 02'];
  labels.forEach((label, i) => {
    ctx.fillStyle = '#203b43'; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = '#d7bd80'; ctx.fillRect(18, i * 128 + 22, 10, 84);
    ctx.fillStyle = '#dfe8dc'; ctx.font = '600 57px Arial'; ctx.fillText(label, 52, i * 128 + 83);
  });
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide });
  const sign = (label: number, x: number, y: number, z: number, yaw: number) => {
    const geo = new T.PlaneGeometry(5.2, 0.65), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 3 - label) / 4);
    const mesh = new T.Mesh(geo, material); mesh.position.set(x, y, z); mesh.rotation.y = yaw; scene.add(mesh);
  };
  sign(0, 17, 3.2, 28 - 0.006, Math.PI); sign(2, 43, 3.2, 28 - 0.006, Math.PI);
  sign(1, 30, 2.3, 12 + 0.006, 0); sign(3, 30, 2.1, -0.45 + 0.456, 0);
}
