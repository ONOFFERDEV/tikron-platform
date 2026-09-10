import * as T from 'three';
import type { MapDef } from '../src/map/types.js';

/** One opaque draw, continuous world UVs, a real hole in the yard. No alpha
 * cutout, extra pass, duplicate ground under the trench or per-frame work. */
export function terrainGeometry(map: MapDef): T.BufferGeometry {
  const faces = map.terrain?.faces ?? [{ minX: 0, maxX: map.bounds.width,
    minZ: 0, maxZ: map.bounds.depth, y: 0 }];
  const positions: number[] = [], normals: number[] = [], uv: number[] = [];
  for (const f of faces) for (const [x, z] of [[f.minX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.minZ],
    [f.maxX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.maxZ]] as const) {
    positions.push(x, f.y - .012, z); normals.push(0, 1, 0);
    uv.push(x / map.bounds.width, 1 - z / map.bounds.depth);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
