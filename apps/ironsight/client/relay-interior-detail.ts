import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../src/map/types.js';
import { ATLAS_W, ATLAS_H, tiles } from './relay-service-geometry.js';

/** Original paint, baked into the right half of the resident service atlas.
 * Instrument faces are unpowered hardware, not glowing screens or lights. */
export function paintRelayInterior(c: CanvasRenderingContext2D): void {
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color; c.fillRect(x, y, w, h);
  };
  const text = (s: string, x: number, y: number, size: number, color = '#b9b6a1') => {
    c.fillStyle = color; c.font = `bold ${size}px Arial`; c.fillText(s, x, y);
  };
  const line = (points: number[][], color: string, width = 2) => {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x!, y!) : c.moveTo(x!, y!)); c.stroke();
  };
  // Service recesses: a shaded lip, fastening rails, individual removable units.
  for (const [tx, control] of [[1024, false], [1280, true]] as const) {
    c.save(); c.translate(tx, 0);
    rect('#272d29', 0, 0, 256, 512); rect('#706f5e', 5, 5, 246, 502);
    rect('#171f1c', 10, 10, 236, 492); rect('#484e42', 17, 16, 222, 478);
    for (const x of [22, 228]) {
      rect('#828171', x, 23, 5, 462);
      for (let y = 28; y < 490; y += 24) { rect('#202722', x, y, 5, 5); rect('#aaa58c', x + 1, y, 2, 1); }
    }
    text(control ? 'LOCAL CONTROL' : 'COMMS / RX', 39, 40, 17);
    for (let row = 0; row < 5; row++) {
      const y = 54 + row * 79;
      rect('#111b18', 34, y, 186, 73); rect(control ? '#666856' : '#4c574a', 37, y + 3, 180, 67);
      rect('#959480', 38, y + 3, 178, 2); rect('#303b32', 39, y + 64, 176, 5);
      if (control) {
        for (const x of [76, 143]) {
          c.fillStyle = '#242d26'; c.beginPath(); c.arc(x, y + 28, 22, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#b0ad91'; c.beginPath(); c.arc(x, y + 27, 17, Math.PI, Math.PI * 2); c.fill();
          line([[x - 12, y + 27], [x + 10, y + 16]], '#343a2e');
          text(row % 2 ? 'V' : 'A', x - 3, y + 45, 10);
        }
        rect('#958254', 184, y + 21, 13, 27); rect('#282e27', 187, y + 20, 7, 15);
      } else {
        rect('#252f27', 47, y + 13, 86, 22);
        text(['074.80', '032.40', '018.25', '006.50', 'STANDBY'][row]!, 51, y + 28, 13, '#979e7f');
        for (const x of [157, 192]) {
          c.fillStyle = '#202922'; c.beginPath(); c.arc(x, y + 24, 12, 0, Math.PI * 2); c.fill();
          line([[x, y + 24], [x + 3, y + 16]], '#a4a088');
        }
        for (let x = 48; x < 125; x += 6) rect('#222c25', x, y + 46, 3, 11);
        text(`CH / 0${row + 1}`, 146, y + 56, 10);
      }
      for (const x of [41, 209]) for (const yy of [y + 8, y + 58]) rect('#aaa48c', x, yy, 3, 3);
    }
    rect('#9e9474', 43, 457, 168, 24); text(control ? 'ISOLATE / TEST' : 'FIELD LINK / 07', 51, 474, 14, '#30372c');
    c.restore();
  }
  // Printed schematic: a functional analogue mimic board, intentionally quiet.
  rect('#6a6d59', 1536, 0, 512, 256); rect('#b4b099', 1542, 6, 500, 244);
  rect('#3b453a', 1552, 16, 480, 224); text('RELAY / DISTRIBUTION', 1570, 48, 23);
  for (let row = 0; row < 3; row++) {
    const y = 88 + row * 58;
    line([[1574, y], [1660, y], [1660, y - 10], [1836, y - 10], [1836, y], [1995, y]], '#9c9e83', 3);
    for (const x of [1590, 1760, 1950]) {
      rect('#777d62', x, y - 15, 27, 27); rect('#343e32', x + 4, y - 11, 19, 19);
      text(`${row + 1}`, x + 9, y + 3, 12);
    }
  }
  rect('#4a5144', 1536, 256, 256, 256); rect('#222c25', 1543, 263, 242, 242);
  rect('#a59e81', 1550, 271, 223, 221); text('SHIFT / 07', 1562, 296, 22, '#3b4034');
  for (let i = 0; i < 8; i++) {
    rect('#6d715c', 1564, 314 + i * 18, i % 3 === 0 ? 175 : 138, 2);
    if (i < 6) rect('#4c5542', 1734, 309 + i * 18, 9, 8);
  }
  text('CHECK / SIGN / RETURN', 1560, 477, 14, '#434a38');
  for (const [ty, control] of [[256, false], [384, true]] as const) {
    c.save(); c.translate(1792, ty);
    rect('#29352b', 0, 0, 256, 128); rect('#858570', 4, 4, 248, 120);
    rect('#4c5946', 8, 8, 240, 112); rect('#303d30', 14, 32, 228, 53);
    text(control ? 'BUS / LOCAL OVERRIDE' : 'FIELD LINK / TRANSMIT', 17, 25, 14);
    for (const x of [34, 87, 140]) {
      if (control) {
        c.fillStyle = '#b6b397'; c.beginPath(); c.arc(x + 12, 57, 17, Math.PI, 2 * Math.PI); c.fill();
        line([[x + 12, 57], [x + 19, 42]], '#323d2e');
      } else {
        rect('#929c7d', x - 9, 40, 43, 21); text('074', x - 3, 55, 14, '#354530');
      }
    }
    rect('#a99563', 209, 42, 14, 30); rect('#273324', 212, 39, 8, 20);
    for (let x = 26; x < 186; x += 7) rect('#263426', x, 97, 3, 12);
    for (const x of [13, 239]) for (const y of [13, 111]) rect('#b1ac91', x, y, 3, 3);
    c.restore();
  }
  // Lower wall panels: chipped washable paint, with contact dirt at the foot.
  const [lx, ly, lw, lh] = tiles.lining;
  rect('#5b6052', lx, ly, lw, lh);
  const shade = c.createLinearGradient(0, ly, 0, ly + lh);
  shade.addColorStop(0, '#777967'); shade.addColorStop(.10, '#5c6352');
  shade.addColorStop(.78, '#4d5548'); shade.addColorStop(1, '#2c362e');
  c.fillStyle = shade; c.fillRect(lx, ly, lw, lh);
  for (const x of [lx + 8, lx + 252, lx + 502]) {
    rect('#394537', x, ly, 3, lh); rect('#828570', x + 3, ly, 2, lh);
    for (const y of [ly + 19, ly + 225]) rect('#92917a', x + 7, y, 3, 3);
  }
  let seed = 103;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 850; i++) {
    const y = ly + Math.pow(rand(), .5) * lh;
    c.globalAlpha = .14 + rand() * .18;
    rect(i % 3 ? '#303d30' : '#9a9980', lx + rand() * lw, y, 1 + rand() * 14, 1 + rand() * 3);
  }
  c.globalAlpha = 1;
  rect('#414b3d', 1024, 768, 512, 128);
  for (let j = 0; j < 4; j++) {
    const y = 786 + j * 25;
    rect('#253226', 1024, y + 4, 512, 11); rect('#7d8069', 1024, y, 512, 8);
    rect('#a1a087', 1024, y, 512, 2);
    for (const x of [1040, 1187, 1334, 1481]) { rect('#444d3b', x, y - 4, 9, 20); rect('#a09c83', x + 2, y - 3, 3, 3); }
  }
  rect('#707365', 1536, 512, 512, 256); rect('#303b31', 1544, 520, 496, 240);
  for (let y = 535; y < 740; y += 20) {
    rect('#747967', 1554, y, 476, 12); rect('#a1a48d', 1554, y, 476, 2);
  }
  rect('#6b705c', 1024, 896, 512, 128); rect('#333f32', 1030, 902, 500, 116);
  text('SERVICE / KEEP CLEAR', 1048, 956, 29, '#a7a082');
  text('AUTHORIZED PERSONNEL', 1077, 993, 22, '#8e957a');
}

export type InteriorFace = { tile: keyof typeof tiles; x: number; y: number; z: number;
  w: number; h: number; yaw: number; ceiling?: boolean };

/** All panels are at most 16mm off an existing solid. No doorway, window,
 * stair void or walkable floor gains geometry, even in the fallback build. */
export function relayInteriorFaces(map: MapDef): InteriorFace[] {
  const faces: InteriorFace[] = [];
  for (const room of map.structures ?? []) {
    if (!['cooling-comms', 'cooling-control'].includes(room.id)) continue;
    const east = room.id === 'cooling-control', f = room.footprint;
    const xAt = (x: number) => east ? 150 - x : x;
    const face = (tile: keyof typeof tiles, x: number, y: number, z: number, w: number, h: number, yaw = 0, ceiling = false) => {
      faces.push({ tile, x: xAt(x), y, z, w, h, yaw: east ? -yaw : yaw, ceiling });
    };
    for (const p of room.parts) {
      const b = p.box, w = b.max.x - b.min.x, d = b.max.z - b.min.z;
      if (p.kind !== 'wall' || b.min.y !== 0 || b.max.y < 1.05) continue;
      const alongX = w > d;
      const x = alongX ? (b.min.x + b.max.x) / 2
        : Math.abs(b.min.x - f.minX) < .01 ? b.max.x + .014 : b.min.x - .014;
      const z = !alongX ? (b.min.z + b.max.z) / 2
        : Math.abs(b.min.z - f.minZ) < .01 ? b.max.z + .014 : b.min.z - .014;
      const yaw = alongX ? (z < (f.minZ + f.maxZ) / 2 ? 0 : Math.PI)
        : (x < (f.minX + f.maxX) / 2 ? Math.PI / 2 : -Math.PI / 2);
      faces.push({ tile: 'lining', x, y: .57, z, w: (alongX ? w : d) - .04, h: .92, yaw });
    }
    face(east ? 'instruments' : 'radio', 35.6, 1.45, 34.416, 1.32, 2.15);
    face(east ? 'instruments' : 'radio', 42.0, 1.55, 34.416, 1.28, 1.82);
    face('circuit', 52.6, 1.65, 43.584, 3.6, 1.18, Math.PI);
    face('orders', 54.8, 1.65, 34.416, .9, .95);
    // Continuous cable trays follow intact upper walls and window lintels.
    for (const p of room.parts) {
      const b = p.box;
      if (p.kind !== 'wall' || b.min.y > 2.35 || b.max.y < 2.7 || b.max.y > 2.73 || b.max.z - b.min.z > .41) continue;
      faces.push({ tile: 'wiring', x: (b.min.x + b.max.x) / 2, y: 2.53,
        z: b.min.z < 39 ? b.max.z + .014 : b.min.z - .014,
        w: b.max.x - b.min.x - .04, h: .26, yaw: b.min.z < 39 ? 0 : Math.PI });
    }
    for (const x of [39.5, 51.8]) face('ceilingVent', x, 2.706, 39.8, 2.15, 1.05, 0, true);
    // Console sides distinguish actual equipment from loose cargo crates.
    for (const p of room.parts.filter(p => p.kind === 'cover')) {
      const b = p.box;
      faces.push({ tile: east ? 'instruments' : 'radio', x: b.max.x + .016, y: .56,
        z: (b.min.z + b.max.z) / 2, w: b.max.z - b.min.z - .08, h: .98, yaw: Math.PI / 2 });
      faces.push({ tile: 'floorService', x: (b.min.x + b.max.x) / 2, y: .54,
        z: b.min.z - .016, w: b.max.x - b.min.x - .12, h: .68, yaw: Math.PI });
    }
  }
  return faces;
}

export function relayInteriorDetail(map: MapDef): T.BufferGeometry {
  const parts = relayInteriorFaces(map).map(p => {
    const g = new T.PlaneGeometry(p.w, p.h), uv = g.getAttribute('uv');
    const [u, v, w, h] = tiles[p.tile];
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      (u + 2 + uv.getX(i) * (w - 4)) / ATLAS_W,
      1 - (v + 2 + (1 - uv.getY(i)) * (h - 4)) / ATLAS_H);
    if (p.ceiling) g.rotateX(Math.PI / 2);
    g.rotateY(p.yaw).translate(p.x, p.y, p.z); return g;
  });
  const geometry = parts.length ? mergeGeometries(parts)! : new T.BufferGeometry();
  parts.forEach(g => g.dispose()); return geometry;
}
