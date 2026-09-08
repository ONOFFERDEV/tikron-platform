import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { buildSiteGround } from './site-ground.js';

/** Power-distribution yard. Complete collider envelopes remain visibly solid;
 * millimetre face cladding cannot create a route, opening or extra cover.
 * Substation gantries and machinery stand entirely outside the playable bounds. */
export function buildSwitchyardEnvironment(scene: T.Scene, map: MapDef, bakeOnly = false): void {
  const colors = [0xb8bcb0, 0x33474c, 0x617a78, 0xdbaa57, 0x458d91, 0xdad6be];
  const materials = colors.map((color, i) => new T.MeshStandardMaterial({
    color, roughness: i === 1 || i === 2 ? 0.74 : 0.91, metalness: i === 1 || i === 2 ? 0.28 : 0.06,
  }));
  const batches = new Map<string, T.Matrix4[]>();
  const box = new T.BoxGeometry(1, 1, 1);
  const cylinder = new T.CylinderGeometry(0.5, 0.5, 1, 12);
  const add = (mat: number, x: number, y: number, z: number, w: number, h: number, d: number,
    zone: 'shell' | 'cladding' | 'exterior' | 'paint' = 'cladding', round = false, rotation = new T.Euler()) => {
    const key = `${zone}:${mat}:${round ? 'c' : 'b'}`, list = batches.get(key) ?? [];
    list.push(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(rotation), new T.Vector3(w, h, d)));
    batches.set(key, list);
  };
  if (!bakeOnly) buildSiteGround(scene, map);
  for (const b of map.boxes) {
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2, base = b.min.y;
    const low = h < 1.5, wall = w > 6;
    // Exact authority volume, including its top. No decorative gaps through cover.
    add(low ? 1 : 0, x, base + h / 2, z, w, h, d, 'shell');
    add(1, x, base + 0.12, z, w + 0.006, 0.24, d + 0.006);
    add(low ? 3 : 5, x, base + h - 0.08, z, w + 0.008, 0.15, d + 0.008);
    const accent = z < 20 ? 4 : 3;
    for (const side of [-1, 1]) {
      const face = z + side * (d / 2);
      if (low) {
        // Armoured transport cases; the middle platform stays walkable on top.
        for (let px = b.min.x + 0.2; px < b.max.x; px += 0.5)
          add(3, px, base + h * 0.7, face + side * 0.005, 0.18, 0.13, 0.008);
        add(2, x, base + h * 0.40, face + side * 0.008, w - 0.32, h * 0.28, 0.008);
      } else {
        // Repeated switchgear cabinet doors break long screens into human-scale bays.
        const bays = Math.max(1, Math.floor(w / 1.6));
        const bayWidth = (w - 0.30) / bays;
        for (let i = 0; i < bays; i++) {
          const px = x + (i - (bays - 1) / 2) * bayWidth;
          add(1, px, base + h * 0.48, face + side * 0.005, bayWidth - 0.07, h - 0.62, 0.008);
          add(wall ? 2 : accent, px, base + h * 0.48, face + side * 0.011, bayWidth - 0.16, h - 0.75, 0.006);
          add(5, px + bayWidth * 0.30, base + h * 0.46, face + side * 0.016, 0.045, 0.28, 0.004);
          for (let row = 0; row < 4; row++)
            add(1, px, base + 0.5 + row * 0.12, face + side * 0.016, bayWidth * 0.62, 0.045, 0.004);
          add(3, px - bayWidth * 0.23, base + h * 0.70, face + side * 0.016, 0.18, 0.22, 0.004);
        }
        add(accent, x, base + h - 0.31, face + side * 0.006, w - 0.1, 0.16, 0.01);
      }
    }
    // Visible end plates with inset louvers, useful from flanking routes.
    if (!low) for (const side of [-1, 1]) {
      const face = x + side * w / 2;
      add(2, face + side * 0.005, base + h / 2, z, 0.008, h - 0.4, d - 0.28);
      for (let row = 0; row < 7; row++)
        add(1, face + side * 0.011, base + 0.55 + row * (h - 1.1) / 7, z, 0.004, 0.06, d - 0.5);
    }
  }
  // Retaining walls sit outside the server's clamped rectangle, including trim.
  for (const z of [-0.46, 40.46]) {
    const height = z < 0 ? 1.4 : 2.8;
    add(0, 30, height / 2, z, 61.8, height, 0.9, 'exterior');
    add(1, 30, height - 0.06, z, 61.8, 0.12, 0.91, 'exterior');
    for (let x = 2; x < 60; x += 4) add(2, x, height / 2, z, 0.2, height, 0.915, 'exterior');
  }
  for (const x of [-0.46, 60.46]) {
    add(1, x, 2.6, 20, 0.9, 5.2, 40, 'exterior');
    for (let z = 2; z < 40; z += 4) {
      add(2, x, 2.6, z, 0.915, 5.2, 0.18, 'exterior');
      add(4, x, 3.4, z + 1.7, 0.915, 1.2, 2.3, 'exterior');
    }
  }
  // North substation: three portal frames and visible ceramic insulator stacks.
  // The generated transformer sits between these bays; all geometry is beyond z=0.
  for (const z of [-5, -13]) {
    for (const x of [10, 30, 50]) {
      for (const dx of [-5, 5]) {
        add(0, x + dx, 0.45, z, 1.5, 0.9, 1.6, 'exterior');
        add(2, x + dx, 6, z, 0.38, 12, 0.5, 'exterior');
        add(3, x + dx, 1.9, z, 0.39, 2.5, 0.51, 'exterior');
      }
      add(2, x, 11.3, z, 10.6, 0.35, 0.5, 'exterior');
      add(2, x, 12, z, 10.6, 0.22, 0.5, 'exterior');
      for (let dx = -4; dx <= 4; dx += 2) {
        add(2, x + dx, 11.65, z, 0.12, 0.8, 0.25, 'exterior', false, new T.Euler(0, 0, Math.PI / 4));
        add(1, x + dx, 10, z, 0.17, 2.3, 0.17, 'exterior', true);
        for (let yy = 9.3; yy < 10.8; yy += 0.24)
          add(5, x + dx, yy, z, 0.48, 0.10, 0.48, 'exterior', true);
        if (z === -5) add(3, x + dx, 8.8, z - 4, 0.075, 0.075, 8, 'exterior');
      }
    }
  }
  // Southern service hall and distant industrial masses balance the open substation.
  for (const [x, z, w, h, d] of [[16, 51, 24, 9, 15], [46, 55, 20, 15, 18], [-10, 16, 12, 14, 22], [72, 24, 16, 19, 26]] as const) {
    add(0, x, (h - 2) / 2, z, w, h - 2, d, 'exterior');
    add(1, x, h - 1, z, w + 0.1, 2, d + 0.1, 'exterior');
    add(2, x, h + 0.5, z, w * 0.7, 1, d * 0.7, 'exterior');
    for (let xx = x - w / 2 + 1; xx < x + w / 2; xx += 2.4)
      add(2, xx, h * 0.45, z, 0.18, h - 2.2, d + 0.012, 'exterior');
    add(4, x, h - 1, z, w + 0.12, 0.3, d + 0.12, 'exterior');
  }
  // In-ground cable raceways and crossings, not raised rail obstacles.
  for (const z of [13, 27]) for (const x of [10, 30, 50]) {
    add(1, x, 0.002, z, 13, 0.004, 0.30, 'paint');
    for (const side of [-1, 1]) add(5, x, 0.004, z + side * 0.27, 13, 0.005, 0.055, 'paint');
    for (let dx = -2; dx <= 2; dx++) add(3, x + dx * 0.5, 0.005, z + 0.85, 0.19, 0.006, 0.65, 'paint');
  }
  for (const x of [3, 57]) for (let z = 4; z <= 36; z += 4)
    add(5, x, 0.004, z, 0.085, 0.006, 2, 'paint');
  // Dashed perimeter of the switching deck; the deck itself remains empty.
  for (const b of map.boxes.filter(b => b.max.y === 1.2)) {
    for (const side of [-1, 1])
      add(3, (b.min.x + b.max.x) / 2, 1.204, (b.min.z + b.max.z) / 2 + side * ((b.max.z - b.min.z) / 2 - 0.10),
        b.max.x - b.min.x - 0.15, 0.006, 0.08, 'paint');
  }
  for (const [key, transforms] of batches) {
    const [zone, mat, shape] = key.split(':');
    const mesh = new T.InstancedMesh(shape === 'c' ? cylinder : box, materials[Number(mat)]!, transforms.length);
    transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.name = `switchyard-${zone}-${mat}-${shape}`;
    mesh.castShadow = zone !== 'paint'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); scene.add(mesh);
  }
  if (bakeOnly) return;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const labels = ['SWITCHYARD / 03', '01 / NORTH BUS', '02 / DECK', '03 / SOUTH SERVICE'];
  labels.forEach((label, i) => {
    ctx.fillStyle = '#283f44'; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = i === 1 ? '#79c3c2' : '#e6b76b'; ctx.fillRect(16, i * 128 + 18, 12, 92);
    ctx.fillStyle = '#e7e8db'; ctx.font = '600 58px Arial'; ctx.fillText(label, 46, i * 128 + 84);
  });
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const mat = new T.MeshBasicMaterial({ map: texture });
  const sign = (label: number, x: number, y: number, z: number, yaw = 0, width = 5.5) => {
    const geo = new T.PlaneGeometry(width, width / 8), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 3 - label) / 4);
    const mesh = new T.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.rotation.y = yaw; scene.add(mesh);
  };
  sign(0, 30, 0.75, 0.006, 0, 7);
  sign(1, 24, 2.15, 8.024);
  sign(3, 36, 2.15, 31.976, Math.PI);
  // The other half of this face meets a ramp. Keep the label on exposed wall.
  sign(2, 29, 0.8, 22.024, 0, 1.8);
  sign(0, 30, 2.05, 39.994, Math.PI, 7);
}
