import type { Box } from '../physics.js';

export interface RelayYardPart { readonly box: Box; readonly finish: 'wall' | 'bench' | 'cargo'; readonly west: boolean; }
const box = (x0: number, z0: number, x1: number, z1: number, top: number, bottom = 0): Box =>
  ({ min: { x: x0, y: bottom, z: z0 }, max: { x: x1, y: top, z: z1 } });

/** Open yard cover, not additional roofed rooms. Every part is a subtraction
 * of one former sealed freight block. One-metre offsets, broken returns and
 * staggered cargo change the repeated tile rhythm while paired power remains.
 * Real walls stay axis aligned: rotating just their art creates ghost corners.
 */
const west: readonly Omit<RelayYardPart, 'west'>[] = [
  // Rear workshop court, formerly one 18 x 6 x 6 m solid. A broad front, a
  // 3m north breach and two waist-height southern returns give it two ways out.
  { box: box(23, 80, 29, 81, 3), finish: 'wall' },
  { box: box(32, 80, 39, 81, 3), finish: 'wall' },
  { box: box(23, 81, 24, 85, 3), finish: 'wall' },
  { box: box(38, 81, 39, 84, 3), finish: 'wall' },
  { box: box(25, 85, 28, 86, 1.1), finish: 'bench' },
  { box: box(33, 85, 37, 86, 1.1), finish: 'bench' },
  { box: box(25, 82, 28, 83, 1.1), finish: 'bench' },
  // Surviving stepped masonry is supported, solid and below the old roof.
  { box: box(23, 80, 26, 81, 5, 3), finish: 'wall' },
  { box: box(26, 80, 28, 81, 4, 3), finish: 'wall' },
  // Inner freight compound, formerly one 10 x 6 x 6 m box: an offset L with
  // an open staging pocket and a lower loading bench facing the trench exit.
  { box: box(53, 84, 55, 89, 3), finish: 'cargo' },
  { box: box(55, 87, 61, 89, 3), finish: 'cargo' },
  { box: box(57, 84, 60, 85, 1.1), finish: 'bench' },
];

export const RELAY_YARD_PARTS: readonly RelayYardPart[] = [
  ...west.map(p => ({ ...p, west: true })),
  ...west.map(p => ({ ...p, west: false, box: {
    min: { ...p.box.min, x: 150 - p.box.max.x }, max: { ...p.box.max, x: 150 - p.box.min.x },
  } })),
];

/** Original tile volumes replaced by the open yard. */
export const RELAY_YARD_OLD_BLOCKS: readonly Box[] = [
  box(22, 80, 40, 86, 6), box(110, 80, 128, 86, 6),
  box(52, 84, 62, 90, 6), box(88, 84, 98, 90, 6),
];

export function isReplacedRelayYardBlock(b: Box): boolean {
  return RELAY_YARD_OLD_BLOCKS.some(old => old.min.x === b.min.x && old.max.x === b.max.x &&
    old.min.z === b.min.z && old.max.z === b.max.z);
}
