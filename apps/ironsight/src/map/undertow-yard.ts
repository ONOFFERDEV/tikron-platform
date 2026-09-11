import type { Box } from '../physics.js';

export interface UndertowYardPart {
  readonly box: Box;
  readonly kind: 'wall' | 'bench';
  readonly west: boolean;
}
const box = (x0: number, z0: number, x1: number, z1: number, top: number, bottom = 0): Box =>
  ({ min: { x: x0, y: bottom, z: z0 }, max: { x: x1, y: top, z: z1 } });

/** Roofless service bays cut from the former southern pump solids. Every
 * solid stays inside a former block, preserving existing valid positions.
 * Power is paired; west pump masonry and east switchgear skins differ in art.
 * Rooms, +3m roofs, -3m channel and B's approach baffles remain separate. */
const west: readonly Omit<UndertowYardPart, 'west'>[] = [
  { box: box(25, 76, 33, 77, 3), kind: 'wall' },
  { box: box(37, 76, 45, 77, 3), kind: 'wall' },
  { box: box(25, 77, 26, 80, 3), kind: 'wall' },
  { box: box(44, 78, 45, 82, 3), kind: 'wall' },
  // Four-metre south opening offset one metre from the north breach.
  // The ends have pedestrian service openings too.
  { box: box(27, 81, 32, 82, 3), kind: 'wall' },
  { box: box(36, 81, 42, 82, 1.1), kind: 'bench' },
  { box: box(28, 78, 31, 79.5, 1.1), kind: 'bench' },
  { box: box(39, 78.5, 42, 79.5, 1.1), kind: 'bench' },
  // Supported jagged wall tops: silhouette changes also exist in collision.
  { box: box(25, 76, 28, 77, 6, 3), kind: 'wall' },
  { box: box(28, 76, 30, 77, 5, 3), kind: 'wall' },
  { box: box(41, 76, 45, 77, 5, 3), kind: 'wall' },
  { box: box(43, 76, 45, 77, 6, 5), kind: 'wall' },
];
export const UNDERTOW_YARD_PARTS: readonly UndertowYardPart[] = [
  ...west.map(p => ({ ...p, west: true })),
  ...west.map(p => ({ ...p, west: false, box: {
    min: { ...p.box.min, x: 150 - p.box.max.x }, max: { ...p.box.max, x: 150 - p.box.min.x },
  } })),
];
export const UNDERTOW_YARD_OLD_BLOCKS: readonly Box[] = [
  box(24, 76, 46, 82, 6), box(104, 76, 126, 82, 6),
];
export function isReplacedUndertowYardBlock(b: Box): boolean {
  return UNDERTOW_YARD_OLD_BLOCKS.some(old => old.min.x === b.min.x && old.max.x === b.max.x
    && old.min.z === b.min.z && old.max.z === b.max.z);
}

/** Frozen ammo-crate-stack dimensions, supported by two solid pump benches. */
export const UNDERTOW_YARD_CRATES: readonly Box[] = [29.5, 120.5].map(x => ({
  min: { x: x - .531171 / 2, y: 1.1, z: 78.75 - .598316 / 2 },
  max: { x: x + .531171 / 2, y: 2.25, z: 78.75 + .598316 / 2 },
}));
