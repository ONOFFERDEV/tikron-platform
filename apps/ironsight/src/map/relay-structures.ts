import type { StructureDef } from './structures.js';

/** Places A: replace the western Cooling shelter's sealed 22x6m block.
 * Two opposed ground doors, four firing windows, a clear through-route and an
 * internal stair to a +3m roof. Bots use the through-route, never the roof.
 * The roof has waist parapets and a south drop, not a head-height duel edge.
 */
export const RELAY_COMMS: StructureDef = {
  id: 'cooling-comms', origin: { x: 34, y: 0, z: 34 }, width: 22, depth: 6,
  walls: [
    { axis: 'z', at: 0, from: 0, to: 6, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 3, to: 5, bottom: 0, top: 2.35 }] },
    { axis: 'z', at: 21.6, from: 0, to: 6, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 3, to: 5, bottom: 0, top: 2.35 }] },
    { axis: 'x', at: 0, from: .4, to: 21.6, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 3, to: 7, bottom: 1.1, top: 2.35 }, { from: 16, to: 20, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 5.6, from: .4, to: 21.6, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 4, to: 8, bottom: 1.1, top: 2.35 }, { from: 11, to: 15, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 0, from: 0, to: 22, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 5.6, from: 0, to: 9, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 5.6, from: 13, to: 22, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 0, from: .4, to: 5.6, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 21.6, from: .4, to: 5.6, thickness: .4, bottom: 3, top: 4.1 },
  ],
  slabs: [
    { minX: 0, maxX: 22, minZ: 0, maxZ: 6, bottom: 2.72, top: 3,
      openings: [{ minX: 8.6, maxX: 15.4, minZ: .4, maxZ: 2.7 }] },
  ],
  stairs: [{ minX: 9, maxX: 15.4, minZ: .5, maxZ: 2.5, axis: 'x', dir: 1, topY: 3 }],
  cover: [
    // Solid consoles, shared by body collision and hit validation.
    { min: { x: 4.5, y: 0, z: 1.5 }, max: { x: 7, y: 1.1, z: 2.3 } },
    { min: { x: 10, y: 0, z: 4.8 }, max: { x: 12, y: 1.1, z: 5.6 } },
  ],
};
