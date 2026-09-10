import type { Box } from '../physics.js';
import type { StructureDef } from './structures.js';

/** Pump service replaces the two sealed 22 x 6m housings, in their existing
 * footprints. Ground rooms and paired +3m roofs answer each other across mid.
 * Two south-facing doors, permanent firing windows and an internal stair.
 * Bots use the ground rooms only; roofs remain human routes for this arc. */
export const UNDERTOW_PUMP: StructureDef = {
  id: 'west-pump-hall', origin: { x: 30, y: 0, z: 58 }, width: 22, depth: 6,
  walls: [
    { axis: 'z', at: 0, from: 0, to: 6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 2.8, to: 4.5, bottom: 1.1, top: 2.35 }] },
    { axis: 'z', at: 21.6, from: 0, to: 6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 2.8, to: 4.5, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 0, from: .4, to: 21.6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 3, to: 7, bottom: 1.1, top: 2.35 }, { from: 16, to: 20, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 5.6, from: .4, to: 21.6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 6, to: 8, bottom: 0, top: 2.35 }, { from: 14, to: 16, bottom: 0, top: 2.35 },
        { from: 9, to: 13, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 0, from: 0, to: 22, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 5.6, from: 0, to: 9, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 5.6, from: 13, to: 22, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 0, from: .4, to: 5.6, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 21.6, from: .4, to: 5.6, thickness: .4, bottom: 3, top: 4.1 },
  ],
  slabs: [{ minX: .4, maxX: 21.6, minZ: .4, maxZ: 5.6, bottom: 2.72, top: 3,
    openings: [{ minX: 8.6, maxX: 15.4, minZ: .4, maxZ: 2.7 }] }],
  stairs: [{ minX: 9, maxX: 15.4, minZ: .5, maxZ: 2.5, axis: 'x', dir: 1, topY: 3 }],
  cover: [
    { min: { x: 4.5, y: 0, z: 1.2 }, max: { x: 7, y: 1.1, z: 2.2 } },
    { min: { x: 10, y: 0, z: 3.2 }, max: { x: 12, y: 1.1, z: 4 } },
    { min: { x: 17.8, y: 0, z: 1.2 }, max: { x: 20.6, y: 1.1, z: 2.2 } },
  ],
};

const reflect = (x: number) => Math.round((22 - x) * 1e6) / 1e6;
export const UNDERTOW_OPERATIONS: StructureDef = {
  ...UNDERTOW_PUMP, id: 'east-operations', origin: { x: 98, y: 0, z: 58 },
  walls: UNDERTOW_PUMP.walls.map(w => w.axis === 'z'
    ? { ...w, at: reflect(w.at + w.thickness) }
    : { ...w, from: reflect(w.to), to: reflect(w.from),
      openings: w.openings?.map(h => ({ ...h, from: reflect(h.to), to: reflect(h.from) })) }),
  slabs: UNDERTOW_PUMP.slabs.map(s => ({ ...s, minX: reflect(s.maxX), maxX: reflect(s.minX),
    openings: s.openings?.map(h => ({ ...h, minX: reflect(h.maxX), maxX: reflect(h.minX) })) })),
  stairs: UNDERTOW_PUMP.stairs!.map(r => ({ ...r, minX: reflect(r.maxX), maxX: reflect(r.minX), dir: -1 })),
  cover: UNDERTOW_PUMP.cover!.map(b => ({ min: { ...b.min, x: reflect(b.max.x) }, max: { ...b.max, x: reflect(b.min.x) } })),
};

export const UNDERTOW_BUILDINGS = [UNDERTOW_PUMP, UNDERTOW_OPERATIONS] as const;

/** Four issued crate stacks sit on the solid console worktops, fitted to the
 * frozen prop-library envelope. The
 * server owns these solids even if the optional detailed visual fails to load. */
export const UNDERTOW_CRATES: readonly Box[] = [35.4, 49, 101, 114.6].map(x => ({
  min: { x: x - .531171 / 2, y: 1.1, z: 59.7 - .598316 / 2 },
  max: { x: x + .531171 / 2, y: 2.25, z: 59.7 + .598316 / 2 },
}));
