import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ATLAS_W, ATLAS_H, tiles } from './relay-service-geometry.js';
import { FIELDWORKS_ATLAS } from './relay-fieldworks.js';

/** Exterior dust abrasion and equipment plates; shares the existing service
 * atlas/draw. The workshop wall remains opaque behind every face. */
export function relayWorkshopDetail(): T.BufferGeometry {
  const parts: T.BufferGeometry[] = [];
  const face = (tile: readonly number[], y: number, z: number, w: number, h: number) => {
    const g = new T.PlaneGeometry(w, h), uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      (tile[0]! + 2 + uv.getX(i) * (tile[2]! - 4)) / ATLAS_W,
      1 - (tile[1]! + 2 + (1 - uv.getY(i)) * (tile[3]! - 4)) / ATLAS_H);
    g.rotateY(Math.PI / 2).translate(-.0006, y, z); parts.push(g);
  };
  // Steel sheds shed paint and collect dust; concrete spall reads as plaster
  // pasted onto the metal, so use the resident abrasion tile instead.
  face(FIELDWORKS_ATLAS.dust, 3.9, 34.8, 4.5, 5.5);
  face(FIELDWORKS_ATLAS.dust, 2.5, 55.9, 2.6, 3.7);
  face(FIELDWORKS_ATLAS.dust, 8.4, 67, 3.7, 3.1);
  for (const z of [40.5, 58.3, 68.6]) {
    face(tiles.cabinet, 1.7, z, .75, 1.5);
    face(tiles.label, 3.0, z, .55, .55);
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(g => g.dispose()); return geometry;
}
