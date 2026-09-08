import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { ATLAS_W, ATLAS_H, tiles, relayServiceGeometry } from './relay-service-geometry.js';

export function buildRelayServiceDetail(scene: T.Scene, map: MapDef): void {
  const canvas = document.createElement('canvas'); canvas.width = ATLAS_W; canvas.height = ATLAS_H;
  const c = canvas.getContext('2d')!;
  let seed = 1207;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rect = (color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const text = (value: string, x: number, y: number, size: number, color = '#c8cbbb') => {
    c.fillStyle = color; c.font = `bold ${size}px Arial`; c.fillText(value, x, y);
  };
  const bolts = (x: number, y: number, w: number, h: number) => {
    for (const px of [x + 7, x + w - 7]) for (const py of [y + 7, y + h - 7]) {
      rect('#152b30', px - 2, py - 2, 5, 5); rect('#8d9995', px - 1, py - 1, 2, 2);
    }
  };
  // Sealed equipment hatch, explicitly labelled as a panel (not a playable door).
  rect('#293b40', 0, 0, 128, 256); rect('#89938a', 5, 5, 118, 246);
  rect('#1e3035', 10, 10, 108, 236); rect('#4c6265', 14, 14, 100, 226);
  rect('#738584', 15, 15, 97, 3); rect('#344a50', 18, 65, 92, 148);
  rect('#8eaaa7', 22, 70, 84, 2); rect('#253c43', 62, 67, 3, 143);
  rect('#c4b584', 20, 25, 88, 24); text('SERVICE', 25, 42, 16, '#273d41');
  text('07 / SEALED', 25, 60, 10); text('ACCESS PANEL', 22, 231, 9);
  for (const y of [84, 179]) { rect('#1c3138', 99, y, 9, 27); rect('#a4aea1', 99, y, 5, 20); }
  for (const y of [78, 173]) rect('#86968f', 17, y, 7, 25);
  bolts(5, 5, 118, 246);

  // Breaker cabinet, conduits, analog gauge and caution plate painted into one tile.
  rect('#657776', 128, 0, 128, 256);
  for (const x of [153, 180, 211]) {
    rect('#263f46', x, 0, 10, 256); rect('#a6afa2', x + 2, 0, 3, 256);
    for (const y of [10, 238]) rect('#2d464b', x - 4, y, 18, 7);
  }
  rect('#243940', 136, 37, 112, 183); rect('#b8b9a2', 139, 40, 106, 175);
  rect('#d0ceaf', 142, 43, 100, 3); rect('#687d7b', 147, 53, 90, 40);
  c.fillStyle = '#d5d6bd'; c.beginPath(); c.arc(169, 73, 13, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#273e43'; c.lineWidth = 3; c.beginPath(); c.moveTo(169, 73); c.lineTo(175, 64); c.stroke();
  for (let i = 0; i < 3; i++) rect(i === 0 ? '#568d87' : '#283e43', 193 + i * 12, 62, 7, 17);
  rect('#263d42', 146, 105, 91, 6); text('ISOLATE', 151, 130, 15, '#33494b');
  text('BEFORE SERVICE', 149, 144, 9, '#33494b');
  rect('#8e7947', 148, 159, 68, 30); text('440 V', 156, 179, 16, '#202f32');
  rect('#2d444a', 227, 162, 8, 27); bolts(139, 40, 106, 175);

  // Recessed louver, with baked lip highlights instead of additional geometry.
  rect('#344b50', 256, 0, 256, 128); rect('#a2aca1', 260, 4, 248, 120);
  rect('#253c42', 268, 12, 232, 104);
  for (let y = 18; y < 110; y += 15) { rect('#596f70', 274, y, 220, 9); rect('#8b9d95', 274, y, 220, 2); }
  bolts(260, 4, 248, 120);
  // Human-scale warning placard and armoured-case latches.
  rect('#273d43', 256, 128, 128, 128); rect('#b7ae82', 261, 133, 118, 118);
  c.fillStyle = '#303e3e'; c.beginPath(); c.moveTo(320, 146); c.lineTo(287, 194); c.lineTo(353, 194); c.closePath(); c.fill();
  text('!', 315, 186, 30, '#d8bd6e'); text('CAUTION', 277, 215, 18, '#2a3e40');
  text('LIVE EQUIPMENT', 273, 236, 10, '#2a3e40'); bolts(261, 133, 118, 118);
  rect('#30464d', 384, 128, 128, 128); rect('#5c7273', 390, 134, 116, 116);
  for (const x of [400, 482]) { rect('#1f363d', x, 145, 16, 54); rect('#b0b7a8', x + 3, 149, 10, 35); }
  rect('#b8b498', 424, 149, 50, 30); text('R / 07', 427, 169, 12, '#273b41');
  for (let x = 423; x < 473; x += 4) rect('#bdc1ab', x, 207, 2, 18);
  bolts(390, 134, 116, 116);
  // Deterministic edge chips, fastener runoff and scuffs. Baked once at creation;
  // keep central labels readable and large color fields quiet at combat distance.
  for (const [x, y, w, h] of Object.values(tiles)) {
    c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip();
    for (let i = 0; i < 130; i++) {
      const px = x + random() * w, py = y + random() * h;
      const edge = px < x + 15 || px > x + w - 15 || py > y + h - 20;
      c.globalAlpha = edge ? 0.5 : 0.12;
      rect(i % 3 ? '#273b3d' : '#c5be9b', px, py, 1 + random() * 5, 1 + random() * 2);
    }
    c.globalAlpha = 0.2;
    for (let i = 0; i < 10; i++) rect('#564b39', x + 7 + random() * (w - 14), y + 8, 1 + random() * 2, 8 + random() * 24);
    c.restore();
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const mesh = new T.Mesh(relayServiceGeometry(map), new T.MeshStandardMaterial({ map: texture, roughness: 0.91 }));
  mesh.name = 'relay-service-detail'; mesh.receiveShadow = true; scene.add(mesh);
}
