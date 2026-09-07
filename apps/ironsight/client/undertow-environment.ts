import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { buildSiteGround } from './site-ground.js';

/** Original reclamation kit. The complete box envelope remains visibly solid;
 * turbine faces/windows are flush cladding, never holes or new playable cover.
 * Pipes, basin and skyline equipment live outside the movement rectangle. */
export function buildUndertowEnvironment(scene: T.Scene, map: MapDef, bakeOnly = false): void {
  const colors = [0x96b3aa, 0x5c7b82, 0x283e48, 0xd7d5bb, 0x648e79, 0xd6a35b, 0x9cdbd2];
  const mats = colors.map((color, i) => i === 6 ? new T.MeshBasicMaterial({ color })
    : new T.MeshStandardMaterial({ color, roughness: i === 2 ? 0.66 : 0.86, metalness: i === 2 ? 0.25 : 0.05 }));
  const batches = new Map<string, T.Matrix4[]>();
  const unit = new T.BoxGeometry(1, 1, 1), cylinder = new T.CylinderGeometry(0.5, 0.5, 1, 16);
  const add = (material: number, x: number, y: number, z: number, w: number, h: number, d: number, round = false, rx = 0, rz = 0, ry = 0) => {
    const key = `${material}-${round ? 'c' : 'b'}`, list = batches.get(key) ?? [];
    list.push(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(w, h, d)));
    batches.set(key, list);
  };
  if (!bakeOnly) buildSiteGround(scene, map, true);
  for (const b of map.boxes) {
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
    const low = h < 1.5, control = h > 4, screen = d > 8;
    add(low ? 2 : control ? 1 : 0, x, h / 2, z, w, h, d);
    add(2, x, 0.14, z, w + 0.004, 0.28, d + 0.004);
    add(low ? 5 : 3, x, h - 0.10, z, w + 0.006, 0.18, d + 0.006);
    if (low) {
      for (const sign of [-1, 1]) for (let px = b.min.x + 0.25; px < b.max.x; px += 0.45)
        add(5, px, h * 0.7, z + sign * (d / 2 + 0.004), 0.18, 0.12, 0.008);
    } else if (screen) {
      // Break the 14m deployment walls into readable service bays.
      for (let pz = b.min.z + 1; pz < b.max.z; pz += 2.2) for (const side of [-1, 1]) {
        add(2, x + side * (w / 2 + 0.004), 1.65, pz, 0.008, 2.2, 1.65);
        add(4, x + side * (w / 2 + 0.009), 1.65, pz, 0.006, 1.9, 1.36);
        add(6, x + side * (w / 2 + 0.013), 2.48, pz, 0.004, 0.035, 1);
      }
    } else {
      for (const side of [-1, 1]) {
        const face = z + side * (d / 2 + 0.006);
        if (control) {
          add(2, x, 2.4, face, w - 0.5, 1.05, 0.012);
          for (let px = b.min.x + 0.65; px < b.max.x - 0.4; px += 1.25) {
            add(1, px, 2.4, face + side * 0.008, 1.0, 0.8, 0.005);
            add(6, px, 2.7, face + side * 0.012, 0.84, 0.025, 0.004);
          }
          add(5, x, 0.85, face + side * 0.003, 0.8, 1.45, 0.01);
          add(2, x, 0.85, face + side * 0.01, 0.64, 1.30, 0.005);
        } else {
          // Flush turbine end plates: concentric rings with a six-spoke rotor.
          const count = Math.max(1, Math.floor(w / 2.2));
          for (let i = 0; i < count; i++) {
            const px = x + (i - (count - 1) / 2) * 2.35, diameter = Math.min(1.7, h - 0.5);
            add(2, px, h * 0.49, face, diameter, 0.015, diameter, true, Math.PI / 2);
            add(4, px, h * 0.49, face + side * 0.014, diameter * 0.80, 0.01, diameter * 0.80, true, Math.PI / 2);
            for (let blade = 0; blade < 6; blade++) {
              const angle = blade * Math.PI / 3;
              add(2, px + Math.sin(angle) * diameter * 0.23, h * 0.49 + Math.cos(angle) * diameter * 0.23,
                face + side * 0.023, 0.11, diameter * 0.42, 0.008, false, 0, -angle);
            }
            add(3, px, h * 0.49, face + side * 0.031, 0.25, 0.012, 0.25, true, Math.PI / 2);
          }
        }
        add(5, x, h - 0.35, face, w - 0.25, 0.12, 0.01);
      }
      for (const side of [-1, 1]) for (let k = 0; k < 6; k++)
        add(2, x + side * (w / 2 + 0.007), 0.7 + k * 0.20, z, 0.012, 0.07, d * 0.65);
    }
  }
  // Boundary walls and their inset maintenance panels.
  for (const z of [-0.45, 40.45]) {
    add(0, 30, 1.3, z, 61.8, 2.6, 0.9); add(2, 30, 2.7, z, 61.8, 0.2, 0.91);
    for (let x = 3; x < 60; x += 4) add(1, x, 1.4, z, 0.20, 2.8, 0.92);
  }
  for (const x of [-0.45, 60.45]) {
    add(2, x, 2.6, 20, 0.9, 5.2, 40);
    for (let z = 3; z < 40; z += 5) {
      add(1, x, 2.6, z, 0.91, 5.2, 0.24);
      add(4, x, 3.4, z + 1.5, 0.92, 1.4, 2.5);
    }
  }
  // Basin and paired clarifiers: skyline hero stays completely beyond z=0.
  add(2, 30, -0.01, -13, 54, 0.02, 20);
  add(4, 30, 0.005, -13, 51, 0.01, 17);
  for (let x = 7; x < 57; x += 2.4) {
    add(1, x, 0.015, -5.6, 1.1, 0.005, 0.025);
    add(1, x + 0.5, 0.015, -20, 0.7, 0.005, 0.018);
  }
  for (const x of [17, 43]) {
    add(0, x, 4, -13, 11, 8, 11, true);
    add(2, x, 7.55, -13, 11.15, 0.25, 11.15, true);
    add(4, x, 8.1, -13, 10.4, 0.6, 10.4, true);
    add(3, x, 8.48, -13, 8.8, 0.15, 8.8, true);
    for (const level of [1.1, 5.8]) add(1, x, level, -13, 11.08, 0.16, 11.08, true);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      add(1, x + Math.sin(angle) * 5.48, 4, -13 + Math.cos(angle) * 5.48, 0.13, 6.4, 0.12, false, 0, 0, angle);
    }
    add(5, x, 10.2, -13, 0.7, 3.4, 0.7);
    add(2, x, 11.75, -13, 12, 0.35, 0.65);
    for (const side of [-1, 1]) {
      add(1, x + side * 4, 2.8, -4, 1, 5.6, 1, true);
      add(1, x + side * 4, 5.55, -7, 1, 6, 1, true, Math.PI / 2);
    }
  }
  // A landmark control stack and steel service bridge; no route-crossing pipes.
  add(1, 30, 8, -18, 5, 16, 5);
  add(2, 30, 15, -18, 8, 2, 7);
  add(3, 30, 16.15, -18, 8.2, 0.3, 7.2);
  add(6, 30, 15.2, -14.48, 6.7, 0.35, 0.03);
  for (const level of [4, 7.2, 10.4]) {
    add(2, 30, level, -15.49, 3.8, 1.8, 0.025);
    for (let i = -2; i <= 2; i++) add(1, 30 + i * 0.65, level, -15.47, 0.15, 1.5, 0.015);
  }
  add(5, 30, 6.4, -5, 39, 0.5, 1.2);
  for (let x = 12; x < 50; x += 3) add(2, x, 5.95, -5, 0.12, 0.7, 1);
  for (const [x, z, w, h, d] of [[-10, 11, 12, 13, 18], [71, 26, 15, 17, 24], [18, 53, 22, 10, 14], [49, 55, 17, 14, 18]]) {
    add(1, x!, (h! - 2.4) / 2, z!, w!, h! - 2.4, d!);
    add(2, x!, h! - 1.2, z!, w! + 0.1, 2.4, d! + 0.1);
    add(4, x!, h! + 0.7, z!, w! * 0.7, 1.4, d! * 0.6);
  }
  // Floor-only circulation marks; caps retain the authority's positions.
  for (const cap of Object.values(map.caps)) for (const side of [-1, 1]) {
    add(3, cap.x + side * 2.7, 0.004, cap.z, 0.08, 0.008, 5.4);
    add(3, cap.x, 0.004, cap.z + side * 2.7, 5.4, 0.008, 0.08);
  }
  for (const z of [15.2, 34.5]) for (const x of [16, 30, 44]) {
    add(5, x, 0.005, z, 7, 0.01, 0.08);
    for (let i = -2; i <= 2; i++) add(3, x + i * 0.5, 0.006, z + 0.5, 0.2, 0.01, 0.65);
  }
  for (const [key, transforms] of batches) {
    const [material, shape] = key.split('-');
    const mesh = new T.InstancedMesh(shape === 'c' ? cylinder : unit, mats[Number(material)]!, transforms.length);
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.name = `undertow-${key}`; mesh.castShadow = material !== '6'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); scene.add(mesh);
  }
  if (bakeOnly) return;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const labels = ['A / WEST CONTROL', 'B / PUMP HALL', 'C / EAST CONTROL', 'UNDERTOW / 02',
    'WEST DECK', 'EAST DECK', 'PIPE ROUTE', 'MAINTENANCE'];
  labels.forEach((label, i) => {
    ctx.fillStyle = '#203b43'; ctx.fillRect(0, i * 128, 1024, 128);
    ctx.fillStyle = '#d7bd80'; ctx.fillRect(18, i * 128 + 22, 10, 84);
    ctx.fillStyle = '#dfe8dc'; ctx.font = '600 57px Arial'; ctx.fillText(label, 52, i * 128 + 83);
  });
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const material = new T.MeshBasicMaterial({ map: texture });
  const sign = (label: number, x: number, y: number, z: number, yaw: number, width = 5.2) => {
    const geo = new T.PlaneGeometry(width, width / 8), uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 7 - label) / 8);
    const mesh = new T.Mesh(geo, material); mesh.position.set(x, y, z); mesh.rotation.y = yaw; scene.add(mesh);
  };
  for (const [x, label] of [[17, 0], [43, 2]]) {
    sign(label!, x!, 3.45, 27.99, Math.PI); sign(label!, x!, 3.45, 32.01, 0);
  }
  sign(1, 30, 2.55, 12.016, 0); sign(1, 30, 2.55, 27.984, Math.PI);
  sign(3, 30, 14.8, -14.46, 0, 6); sign(3, 30, 2.1, 0.015, 0);
  sign(4, 17, 2.1, 0.015, 0, 4); sign(5, 43, 2.1, 0.015, 0, 4);
  sign(6, 30, 2.45, 7.984, Math.PI, 4.5);
  sign(7, 30, 2.1, 39.985, Math.PI, 6);
}
