import type { Box } from '../physics.js';

export interface SwitchyardYardPart {
  readonly box: Box;
  readonly kind: 'wall' | 'bench';
  readonly west: boolean;
}
const box = (x0: number, z0: number, x1: number, z1: number, top: number, bottom = 0): Box =>
  ({ min: { x: x0, y: bottom, z: z0 }, max: { x: x1, y: top, z: z1 } });

/** Open transformer service courts carved from the two sealed north housings.
 * Offset four-metre entries connect North bus to the deck approach. The west
 * masonry and east ribbed enclosure share power, but have different finishes.
 * Every solid is contained in an old block: existing saved positions stay valid.
 * Thin walls, stepped remnants and equipment all have exact visible shells. */
const west: readonly Omit<SwitchyardYardPart, 'west'>[] = [
  { box: box(40, 36, 45, 37, 3), kind: 'wall' },
  { box: box(49, 36, 54, 37, 3), kind: 'wall' },
  { box: box(40, 37, 41, 44, 3), kind: 'wall' },
  { box: box(53, 37, 54, 41, 3), kind: 'wall' },
  { box: box(41, 43, 44, 44, 3), kind: 'wall' },
  { box: box(48, 43, 52, 44, 1.1), kind: 'bench' },
  { box: box(42, 39, 44, 41, 1.1), kind: 'bench' },
  { box: box(49, 38.8, 52, 40.2, 1.1), kind: 'bench' },
  { box: box(40, 36, 42, 37, 6, 3), kind: 'wall' },
  { box: box(42, 36, 44, 37, 5, 3), kind: 'wall' },
  { box: box(50, 36, 54, 37, 5, 3), kind: 'wall' },
  { box: box(52, 36, 54, 37, 6, 5), kind: 'wall' },
  { box: box(40, 37, 41, 39, 5, 3), kind: 'wall' },
];
export const SWITCHYARD_YARD_PARTS: readonly SwitchyardYardPart[] = [
  ...west.map(p => ({ ...p, west: true })),
  ...west.map(p => ({ ...p, west: false, box: {
    min: { ...p.box.min, x: 150 - p.box.max.x }, max: { ...p.box.max, x: 150 - p.box.min.x },
  } })),
];
export const SWITCHYARD_YARD_OLD_BLOCKS: readonly Box[] = [
  box(40, 36, 54, 44, 6), box(96, 36, 110, 44, 6),
];
export function isReplacedSwitchyardYardBlock(b: Box): boolean {
  return SWITCHYARD_YARD_OLD_BLOCKS.some(old => old.min.x === b.min.x && old.max.x === b.max.x
    && old.min.z === b.min.z && old.max.z === b.max.z);
}

/** Frozen library crate stacks, with full authority/fallback at their real size. */
export const SWITCHYARD_YARD_CRATES: readonly Box[] = [43, 107].map(x => ({
  min: { x: x - .531171 / 2, y: 1.1, z: 40 - .598316 / 2 },
  max: { x: x + .531171 / 2, y: 2.25, z: 40 + .598316 / 2 },
}));
