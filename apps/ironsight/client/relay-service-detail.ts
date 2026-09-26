import * as T from 'three';
import type { MapDef } from '../src/map/types.js';
import { ATLAS_W, ATLAS_H, tiles, relayServiceGeometry, relayStructureDetail, relayBoundaryDetail } from './relay-service-geometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintRelayDamage, relayDamageGeometry } from './relay-fieldworks.js';
import { relayYardDetail } from './relay-yard.js';
import { relayWorkshopDetail } from './relay-workshop-detail.js';
import { paintRelayInterior, relayInteriorDetail } from './relay-interior-detail.js';

export function buildRelayServiceDetail(scene: T.Scene, map: MapDef): void {
  const canvas = document.createElement('canvas'); canvas.width = ATLAS_W; canvas.height = ATLAS_H;
  const c = canvas.getContext('2d')!;
  let seed = 1207;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rect = (color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const text = (value: string, x: number, y: number, size: number, color = '#c8cbbb') => {
    c.fillStyle = color; c.font = `bold ${size}px Arial, "Noto Sans KR", "Malgun Gothic", sans-serif`; c.fillText(value, x, y);
  };
  const bolts = (x: number, y: number, w: number, h: number) => {
    for (const px of [x + 7, x + w - 7]) for (const py of [y + 7, y + h - 7]) {
      rect('#152b30', px - 2, py - 2, 5, 5); rect('#8d9995', px - 1, py - 1, 2, 2);
    }
  };
  rect('#393429', 0, 0, 128, 256);
  for (let plank = 0; plank < 6; plank++) {
    const x = 5 + plank * 20;
    rect(plank % 2 ? '#806d50' : '#756044', x, 5, 19, 246);
    rect('#a18b64', x + 1, 7, 1, 242);
    for (let grain = 0; grain < 7; grain++) rect('#615139', x + 3 + random() * 13, 10 + random() * 180, 1, 20 + random() * 45);
  }
  for (const y of [68, 202]) { rect('#36392f', 7, y, 114, 12); bolts(7, y - 1, 114, 14); }
  c.strokeStyle = '#49402e'; c.lineWidth = 12; c.beginPath(); c.moveTo(16, 193); c.lineTo(108, 92); c.stroke();
  rect('#b2a17a', 15, 24, 98, 27); text('STORES', 24, 44, 19, '#3c3c2e');
  text('SIGNAL / 07', 26, 233, 12, '#b7a780');

  rect('#514936', 128, 0, 128, 256);
  for (const x of [136, 173, 212]) rect('#796648', x, 0, 33, 256);
  rect('#302f25', 139, 41, 106, 162); rect('#94805c', 142, 44, 100, 154);
  rect('#b29b6e', 145, 47, 94, 3); rect('#4b4936', 149, 63, 86, 116);
  text('야전선', 151, 32, 13, '#c3b48e');
  c.strokeStyle = '#252a23'; c.lineWidth = 8; c.beginPath(); c.moveTo(157, 86); c.quadraticCurveTo(192, 64, 225, 86); c.stroke();
  for (const x of [157, 225]) { c.fillStyle = '#33362a'; c.beginPath(); c.ellipse(x, 91, 10, 16, 0, 0, Math.PI * 2); c.fill(); }
  for (const x of [169, 207]) { c.fillStyle = '#b19a65'; c.beginPath(); c.arc(x, 125, 5, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#292e25'; c.lineWidth = 3; c.beginPath(); c.moveTo(169, 129); c.bezierCurveTo(137, 160, 232, 183, 224, 206); c.stroke();
  rect('#ad9b70', 159, 153, 49, 12); text('07선', 163, 163, 9, '#3b3c2c');
  rect('#36392c', 235, 112, 8, 25); rect('#b39d69', 238, 130, 13, 5);
  text('습기 주의', 157, 233, 12, '#c2b38b'); bolts(142, 44, 100, 154);

  rect('#3c392c', 256, 0, 256, 128);
  for (let y = 7; y < 120; y += 23) {
    rect(y % 2 ? '#8a7756' : '#7a6749', 261, y, 246, 21);
    rect('#b09a70', 263, y, 242, 2);
    for (const x of [273, 492]) rect('#34362b', x, y + 8, 3, 3);
    for (let grain = 0; grain < 12; grain++) rect('#655239', 270 + random() * 170, y + 5 + random() * 12, 10 + random() * 32, 1);
  }
  rect('#514a36', 256, 128, 128, 128); rect('#b9ac87', 266, 135, 108, 111);
  text('통신반', 273, 164, 19, '#4b4a37'); text('07선', 279, 191, 15, '#4b4a37');
  for (let y = 202; y < 237; y += 8) rect('#827857', 279, y, y % 3 ? 79 : 60, 1);
  rect('#39382c', 384, 128, 128, 128);
  for (let y = 134; y < 252; y += 24) {
    rect('#84704e', 390, y, 116, 22); rect('#a38b60', 392, y, 112, 2);
  }
  for (const x of [400, 483]) { rect('#353a2e', x, 134, 10, 116); bolts(x, 134, 10, 116); }
  text('SIGNAL', 415, 190, 16, '#c3b384'); text('07', 435, 219, 22, '#c3b384');
  // Places B shares the existing atlas; no additional image or draw.
  rect('#d0c6a5', 512, 512, 512, 64); rect('#303a33', 520, 520, 496, 48);
  text('통신 / 서측', 542, 557, 37, '#d5d1b9');
  rect('#d0c6a5', 512, 960, 512, 64); rect('#303a33', 520, 968, 496, 48);
  text('LINES / EAST', 548, 1005, 37, '#d5d1b9');
  rect('#3a4238', 512, 576, 256, 128);
  text('ROOF ACCESS', 526, 623, 28); text('UP / 03 M', 542, 677, 28, '#c6b681');
  rect('#67583e', 512, 704, 256, 256);
  rect('#373d30', 523, 715, 234, 210);
  for (let y = 734; y < 901; y += 48) {
    text(`LINE ${1 + (y - 734) / 48}`, 535, y + 6, 15);
    for (const x of [640, 681, 723]) {
      c.fillStyle = '#b2a071'; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#20291f'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = '#938463'; c.lineWidth = 3; c.beginPath(); c.moveTo(640, y); c.bezierCurveTo(626, y + 35, 733, y + 40, 723, y); c.stroke();
  }
  text('FIELD RELAY // 07', 533, 945, 17);
  rect('#b6ab85', 768, 576, 256, 96); rect('#343b32', 775, 583, 242, 82);
  text('전선 참호', 784, 615, 27, '#d0c5a0'); text('-3m / 정비로', 790, 651, 24, '#bcb798');
  rect('#505548', 768, 672, 256, 192);
  for (const y of [714, 758, 802]) {
    rect('#232820', 770, y, 252, 19); rect('#6c6d59', 770, y+3, 252, 5);
    for (const x of [784, 897, 1004]) { rect('#969177', x, y-5, 8, 29); rect('#393d30', x+2, y-3, 3, 5); }
  }
  rect('#333a32', 768, 864, 256, 48); text('작업장 1', 779, 897, 28, '#c8c0a3');
  rect('#333a32', 768, 912, 256, 48); text('화물 3', 790, 945, 28, '#c8c0a3');
  paintRelayInterior(c);
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
  paintRelayDamage(c);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const parts = [relayServiceGeometry(map), relayDamageGeometry(map), relayStructureDetail(map), relayBoundaryDetail(map), relayYardDetail(), relayWorkshopDetail(), relayInteriorDetail(map)].filter(g => g.hasAttribute('position'));
  const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose());
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ map: texture, roughness: 0.94, alphaTest: .28 }));
  mesh.name = 'relay-service-detail'; mesh.receiveShadow = true; scene.add(mesh);
}
