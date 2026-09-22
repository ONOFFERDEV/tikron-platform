import type { Box } from '../physics.js';
import { moveAndSlide } from '../physics.js';
import { MOVE, PLAYER } from '../config.js';
import type { MapDef } from './types.js';

export interface UndertowYardPart {
  readonly box: Box;
  readonly kind: 'wall' | 'bench';
  readonly west: boolean;
}
export type UndertowApproachSide = 'west' | 'east';
export type UndertowApproachName = `${UndertowApproachSide}.${'north' | 'south'}`;
export interface UndertowApproaches {
  readonly west: readonly [readonly UndertowApproachPoint[], readonly UndertowApproachPoint[]];
  readonly east: readonly [readonly UndertowApproachPoint[], readonly UndertowApproachPoint[]];
}
export interface UndertowApproachPoint { readonly x: number; readonly z: number }
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
export const UNDERTOW_B_APPROACHES: UndertowApproaches = {
  west: [
    [{ x: 18, z: 49 }, { x: 40, z: 49 }, { x: 42, z: 51 }, { x: 48, z: 51 }, { x: 54, z: 47 }, { x: 64, z: 47 }, { x: 68, z: 49 }, { x: 70, z: 49 }, { x: 72, z: 52 }, { x: 75, z: 55 }],
    [{ x: 18, z: 65 }, { x: 40, z: 65 }, { x: 56, z: 65 }, { x: 64, z: 65 }, { x: 70, z: 61 }, { x: 75, z: 55 }],
  ],
  east: [
    [{ x: 132, z: 49 }, { x: 110, z: 49 }, { x: 108, z: 51 }, { x: 102, z: 51 }, { x: 96, z: 47 }, { x: 86, z: 47 }, { x: 82, z: 49 }, { x: 80, z: 49 }, { x: 78, z: 52 }, { x: 75, z: 55 }],
    [{ x: 132, z: 65 }, { x: 110, z: 65 }, { x: 94, z: 65 }, { x: 86, z: 65 }, { x: 80, z: 61 }, { x: 75, z: 55 }],
  ],
};
export const UNDERTOW_SLUICE_PARTS: readonly UndertowYardPart[] = [
  { box: box(57, 48, 63, 50, 3), kind: 'wall', west: true },
  { box: box(57, 60, 63, 64, 3), kind: 'wall', west: true },
  { box: box(64, 50, 69, 51, 1.1), kind: 'bench', west: true },
  { box: box(64, 59, 69, 60, 1.1), kind: 'bench', west: true },
  { box: box(87, 48, 93, 50, 3), kind: 'wall', west: false },
  { box: box(87, 60, 93, 64, 3), kind: 'wall', west: false },
  { box: box(81, 50, 86, 51, 1.1), kind: 'bench', west: false },
  { box: box(81, 59, 86, 60, 1.1), kind: 'bench', west: false },
];

export function validateUndertowApproaches(
  map: Pick<MapDef, 'boxes' | 'bounds' | 'ramps'>,
  approaches: UndertowApproaches,
): UndertowApproachName[] {
  const blocked: UndertowApproachName[] = [];
  for (const side of ['west', 'east'] as const) {
    approaches[side].forEach((route, index) => {
      let clear = route.length >= 2;
      let position: { x: number; y: number; z: number } | undefined =
        route[0] === undefined ? undefined : { ...route[0], y: 0 };
      for (let segment = 1; clear && position && segment < route.length; segment++) {
        const to = route[segment]!;
        let steps = 0;
        while (Math.hypot(to.x - position.x, to.z - position.z) > .15 && steps++ < 2_000) {
          const dx: number = to.x - position.x;
          const dz: number = to.z - position.z;
          const distance = Math.hypot(dx, dz);
          const moved = moveAndSlide(position, PLAYER.radius, PLAYER.standHeight,
            { x: dx / distance * .1, y: -.025, z: dz / distance * .1 }, -.5,
            map.boxes, map.bounds, MOVE.stepUp, map.ramps);
          position = moved.pos;
          if (!moved.grounded || Math.abs(position.y) > 1e-6) {
            clear = false;
            break;
          }
        }
        clear = clear && Math.hypot(to.x - position.x, to.z - position.z) <= .15;
      }
      if (!clear) blocked.push(`${side}.${index === 0 ? 'north' : 'south'}`);
    });
  }
  return blocked;
}
export const UNDERTOW_YARD_OLD_BLOCKS: readonly Box[] = [
  box(24, 76, 46, 82, 6), box(104, 76, 126, 82, 6),
];
export function isReplacedUndertowSluiceBlock(b: Box): boolean {
  return b.min.x < 134 && b.max.x > 16 && b.min.z < 66 && b.max.z > 44;
}
export function isReplacedUndertowYardBlock(b: Box): boolean {
  return UNDERTOW_YARD_OLD_BLOCKS.some(old => old.min.x === b.min.x && old.max.x === b.max.x
    && old.min.z === b.min.z && old.max.z === b.max.z);
}

/** Frozen ammo-crate-stack dimensions, supported by two solid pump benches. */
export const UNDERTOW_YARD_CRATES: readonly Box[] = [29.5, 120.5].map(x => ({
  min: { x: x - .531171 / 2, y: 1.1, z: 78.75 - .598316 / 2 },
  max: { x: x + .531171 / 2, y: 2.25, z: 78.75 + .598316 / 2 },
}));
