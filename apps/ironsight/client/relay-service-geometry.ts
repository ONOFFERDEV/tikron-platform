import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../src/map/types.js';

// Original painted service hardware. One 512x256 atlas (0.67 MiB with mips),
// one draw, no transparency sorting, lights, external assets or animated work.
export const ATLAS_W = 512, ATLAS_H = 256;
export const tiles = {
  hatch: [0, 0, 128, 256], cabinet: [128, 0, 128, 256],
  vent: [256, 0, 256, 128], label: [256, 128, 128, 128], case: [384, 128, 128, 128],
} as const;

/** Geometry is derived from existing solid faces, at most 12 mm outside them.
 * Exported separately so the collision envelope can be checked without a DOM. */
export function relayServiceGeometry(map: MapDef): T.BufferGeometry {
  const parts: T.BufferGeometry[] = [];
  const face = (tile: keyof typeof tiles, x: number, y: number, z: number, w: number, h: number, yaw: number, roof = false) => {
    const g = new T.PlaneGeometry(w, h);
    const [u, v, tw, th] = tiles[tile], uv = g.getAttribute('uv');
    // Half-texel inset and painted edge gutters keep neighboring tiles out of mips.
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      (u + 1 + uv.getX(i) * (tw - 2)) / ATLAS_W,
      1 - (v + 1 + (1 - uv.getY(i)) * (th - 2)) / ATLAS_H);
    if (roof) g.rotateX(-Math.PI / 2);
    g.rotateY(yaw); g.translate(x, y, z); parts.push(g);
  };
  for (const b of map.boxes) {
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
    const x = (b.min.x + b.max.x) / 2;
    if (h === 6 && w >= 20 && d === 6) {
      // Sealed roof access and recessed ventilation share the existing atlas.
      // Flush plates only: no rooftop machinery that could imply new cover.
      const roofY = b.max.y + 0.012, midZ = (b.min.z + b.max.z) / 2;
      face('hatch', x - 1.7, roofY, midZ, 1.16, Math.min(2.32, d - 0.4), 0, true);
      for (const side of [-1, 1])
        face('vent', x + 1.15, roofY, midZ + side * d * 0.24, 1.8, 0.72, 0, true);
      face('cabinet', x - 0.3, roofY, midZ, 0.46, Math.min(2.8, d - 0.4), 0, true);
      for (const side of [-1, 1]) {
        const z = (side < 0 ? b.min.z : b.max.z) + side * 0.012;
        const yaw = side < 0 ? Math.PI : 0;
        face('hatch', x - side * 1.7, b.min.y + 1.49, z, 1.16, 2.32, yaw);
        face('cabinet', x - side * 0.25, b.min.y + 1.45, z, 0.76, 1.52, yaw);
        face('vent', x + side * 1.6, b.min.y + 2.35, z, 1.48, 0.74, yaw);
        face('label', x + side * 1.6, b.min.y + 1.3, z, 0.54, 0.54, yaw);
      }
    } else if (h < 1.5 && w >= 1 && d >= 1) {
      for (const side of [-1]) {
        // Below the existing colored identification band; never wraps a corner.
        face('case', x, b.min.y + h * 0.30,
          (side < 0 ? b.min.z : b.max.z) + side * 0.012,
          Math.min(w - 0.3, 0.52), Math.min(h * 0.38, 0.40), side < 0 ? Math.PI : 0);
      }
    }
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(g => g.dispose());
  return geometry;
}

