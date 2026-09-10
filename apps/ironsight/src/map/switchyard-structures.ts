import type { Box } from '../physics.js';
import type { StructureDef } from './structures.js';

/** Paired service rooms replace the sealed 16 x 6 m south housings. All new
 * solids fit inside those old envelopes; a saved valid position is never
 * enclosed. Two yard doors, permanent firing windows, an internal stair and
 * a +3 m roof with a south escape. The yard remains the bot navigation layer. */
export const SWITCHYARD_MAINTENANCE: StructureDef = {
  id: 'west-maintenance', origin: { x: 34, y: 0, z: 58 }, width: 16, depth: 6,
  walls: [
    { axis: 'z', at: 0, from: 0, to: 6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 2.8, to: 4.5, bottom: 1.1, top: 2.35 }] },
    { axis: 'z', at: 15.6, from: 0, to: 6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 2.8, to: 4.5, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 0, from: .4, to: 15.6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 2, to: 5, bottom: 1.1, top: 2.35 },
        { from: 11, to: 14, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 5.6, from: .4, to: 15.6, thickness: .4, bottom: 0, top: 3,
      openings: [{ from: 5, to: 7, bottom: 0, top: 2.35 },
        { from: 9, to: 11, bottom: 0, top: 2.35 },
        { from: 7.2, to: 8.8, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 0, from: 0, to: 16, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 5.6, from: 0, to: 6.5, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 5.6, from: 9.5, to: 16, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 0, from: .4, to: 5.6, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 15.6, from: .4, to: 5.6, thickness: .4, bottom: 3, top: 4.1 },
  ],
  slabs: [{ minX: .4, maxX: 15.6, minZ: .4, maxZ: 5.6, bottom: 2.72, top: 3,
    openings: [{ minX: 5.4, maxX: 12.2, minZ: .4, maxZ: 2.7 }] }],
  stairs: [{ minX: 5.8, maxX: 12.2, minZ: .5, maxZ: 2.5, axis: 'x', dir: 1, topY: 3 }],
  cover: [
    { min: { x: 1.2, y: 0, z: 1.2 }, max: { x: 3.6, y: 1.1, z: 2.2 } },
    { min: { x: 7, y: 0, z: 3.5 }, max: { x: 9, y: 1.1, z: 4.3 } },
    { min: { x: 13.3, y: 0, z: 1.2 }, max: { x: 14.8, y: 1.1, z: 2.2 } },
  ],
};

const reflect = (x: number) => Math.round((16 - x) * 1e6) / 1e6;
export const SWITCHYARD_DISPATCH: StructureDef = {
  ...SWITCHYARD_MAINTENANCE, id: 'east-dispatch', origin: { x: 100, y: 0, z: 58 },
  walls: SWITCHYARD_MAINTENANCE.walls.map(w => w.axis === 'z'
    ? { ...w, at: reflect(w.at + w.thickness) }
    : { ...w, from: reflect(w.to), to: reflect(w.from),
      openings: w.openings?.map(h => ({ ...h, from: reflect(h.to), to: reflect(h.from) })) }),
  slabs: SWITCHYARD_MAINTENANCE.slabs.map(s => ({ ...s, minX: reflect(s.maxX), maxX: reflect(s.minX),
    openings: s.openings?.map(h => ({ ...h, minX: reflect(h.maxX), maxX: reflect(h.minX) })) })),
  stairs: SWITCHYARD_MAINTENANCE.stairs!.map(r => ({ ...r, minX: reflect(r.maxX), maxX: reflect(r.minX), dir: -1 })),
  cover: SWITCHYARD_MAINTENANCE.cover!.map(b => ({
    min: { ...b.min, x: reflect(b.max.x) }, max: { ...b.max, x: reflect(b.min.x) },
  })),
};
export const SWITCHYARD_BUILDINGS = [SWITCHYARD_MAINTENANCE, SWITCHYARD_DISPATCH] as const;

/** Frozen library ammo crates, base-centred at real size on the work benches.
 * Box authority remains present when the optional detail cannot load. */
export const SWITCHYARD_CRATES: readonly Box[] = [36.5, 48, 102, 113.5].map(x => ({
  min: { x: x - .531171 / 2, y: 1.1, z: 59.7 - .598316 / 2 },
  max: { x: x + .531171 / 2, y: 2.25, z: 59.7 + .598316 / 2 },
}));
