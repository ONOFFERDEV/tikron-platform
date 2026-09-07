import type { Box, Bounds, Vec3 } from '../physics.js';
import { ARENA } from '../config.js';
import type { MapDef, RampDef } from './types.js';

/** UNDERTOW / water reclamation plant. Original shared M2 blockout.
 * West/east service screens shelter four deployments; A/C sit in home courts,
 * B has four diagonal approaches around offset pump housings. The two control
 * decks have true ramps at both ends. No legacy index-based dressing may load.
 * Art in M3 must stay inside these shared collision envelopes.
 */
const box = (x0: number, z0: number, x1: number, z1: number, height: number): Box =>
  ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: height, z: z1 } });
const west: Box[] = [
  box(10, 4, 12, 18, 3.6), box(10, 22, 12, 36, 3.6), // deployment screens
  box(14, 6, 20, 10, 1.2), // control ledge, twin ramps along z
  box(14, 28, 20, 32, 4.2), // pump control building
  box(20, 18, 23, 22, 2.8), // breaks the long home-to-home axis
  box(22, 8, 24, 12, 1.1), box(22, 28, 24, 32, 1.1),
  box(16, 24, 18, 26, 1.1), // recovery cover below home A
  box(24.5, 14, 27.8, 18.5, 2.4), box(24.5, 21.5, 27.8, 26, 2.4), // diagonal LOS baffles
];
const mirror = (b: Box): Box => ({ min: { ...b.min, x: 60 - b.max.x }, max: { ...b.max, x: 60 - b.min.x } });
const ramps: RampDef[] = [
  { minX: 14, maxX: 20, minZ: 2, maxZ: 6, axis: 'z', dir: 1, topY: 1.2 },
  { minX: 14, maxX: 20, minZ: 10, maxZ: 14, axis: 'z', dir: -1, topY: 1.2 },
];
const red: Vec3[] = [7, 15, 25, 33].map(z => ({ x: 5, y: 0, z }));
export const ARENA2: MapDef = {
  presentation: 'undertow',
  bounds: { width: ARENA.width, depth: ARENA.depth, ceiling: ARENA.ceiling },
  boxes: [...west, ...west.map(mirror), box(27, 8, 33, 12, 3), box(27, 28, 33, 32, 3)],
  ramps: [...ramps, ...ramps.map(r => ({ ...r, minX: 60 - r.maxX, maxX: 60 - r.minX }))],
  spawns: { red, blue: red.map(p => ({ ...p, x: 60 - p.x })) },
  caps: { a: { x: 16, y: 0, z: 20 }, b: { x: 30, y: 0, z: 20 }, c: { x: 44, y: 0, z: 20 } },
};
export const ARENA2_BOUNDS: Bounds = ARENA2.bounds;
export const ARENA2_BOXES: readonly Box[] = ARENA2.boxes;
export const ARENA2_SPAWNS = ARENA2.spawns;
export const ARENA2_CAPS = ARENA2.caps;
