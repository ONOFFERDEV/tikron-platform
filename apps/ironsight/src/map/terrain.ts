import type { Box, Bounds, Vec3 } from '../physics.js';
import { nearestBox, rampSurfaceY } from '../physics.js';
import type { MapDef } from './types.js';
import type { Rect } from './structures.js';

export interface FloorFace extends Rect { readonly y: number }
export interface Terrain {
  readonly cut: Rect;
  /** Disjoint exposed horizontal faces; also the ground bake/UV layout. */
  readonly faces: readonly FloorFace[];
  /** Exact ground solids, referenced in MapDef.boxes for every collision query. */
  readonly boxes: readonly Box[];
}

/** One rectangular excavation in the yard datum. Retaining walls and stairs
 * are ordinary structures. The rest of the yard becomes solid earth, so a
 * below-grade shot, grenade or capsule cannot pass under the old ground. */
export function excavate(map: MapDef, cut: Rect, floor: number): MapDef {
  if (map.terrain || !Number.isFinite(floor) || floor >= 0 || floor < -3
    || ![cut.minX, cut.maxX, cut.minZ, cut.maxZ].every(Number.isFinite)
    || cut.minX <= 0 || cut.maxX >= map.bounds.width || cut.minZ <= 0 || cut.maxZ >= map.bounds.depth
    || cut.maxX <= cut.minX || cut.maxZ <= cut.minZ) throw Error('Invalid excavation');
  const { width, depth } = map.bounds;
  const faces: FloorFace[] = [
    { minX: 0, maxX: width, minZ: 0, maxZ: cut.minZ, y: 0 },
    { minX: 0, maxX: width, minZ: cut.maxZ, maxZ: depth, y: 0 },
    { minX: 0, maxX: cut.minX, minZ: cut.minZ, maxZ: cut.maxZ, y: 0 },
    { minX: cut.maxX, maxX: width, minZ: cut.minZ, maxZ: cut.maxZ, y: 0 },
    { ...cut, y: floor },
  ];
  const boxes = faces.map(f => ({ min: { x: f.minX, y: floor - .3, z: f.minZ },
    max: { x: f.maxX, y: f.y, z: f.maxZ } }));
  return { ...map, bounds: { ...map.bounds, floor }, terrain: { cut, faces, boxes }, boxes: [...map.boxes, ...boxes] };
}

/** Underlying route floor, deliberately excluding roofs and climbable cover.
 * This is a heightfield only for route planning/cosmetics; movement still
 * resolves the exact shared boxes and slopes. */
export function routeFloor(map: MapDef, x: number, z: number): number {
  const c = map.terrain?.cut;
  if (!c || x <= c.minX || x >= c.maxX || z <= c.minZ || z >= c.maxZ) return 0;
  for (const r of map.ramps ?? []) if ((r.baseY ?? 0) < 0
    && x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return rampSurfaceY(r, x, z);
  return map.bounds.floor ?? 0;
}

/** Ground-only ray fallback for maps without explicit earth solids. On an
 * excavated map the boxes include both yard and trench floor. */
export function groundRay(origin: Vec3, dir: Vec3, boxes: readonly Box[], bounds: Bounds, maxT: number): number {
  let best = nearestBox(origin, dir, boxes, maxT);
  if (dir.y < 0) {
    const t = ((bounds.floor ?? 0) - origin.y) / dir.y;
    if (t >= 0 && t <= maxT) best = Math.min(best, t);
  }
  return best;
}
