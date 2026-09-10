import type { StructureDef } from './structures.js';

export const SWITCHYARD_RAIL_CUT = { minX: 34, maxX: 116, minZ: 68, maxZ: 76 } as const;

/** Retired rail-loading bed behind Maintenance/Dispatch. Its two end ramps
 * descend to -3m; three flush freight bridges retain north/south yard routes.
 * Cabinet baffles and loading pallets are authority, including below ground.
 * All added solids end at/below the old yard: existing valid seats can fall
 * onto the new floor but cannot be enclosed by a newly introduced wall. */
export const SWITCHYARD_RAIL: StructureDef = {
  id: 'rail-loading-cut', origin: { x: 34, y: -3, z: 68 }, width: 82, depth: 8,
  walls: [
    { axis: 'x', at: 0, from: 0, to: 82, thickness: .4, bottom: 0, top: 3 },
    { axis: 'x', at: 7.6, from: 0, to: 82, thickness: .4, bottom: 0, top: 3 },
  ],
  slabs: [10, 39, 68].map(x => ({
    minX: x, maxX: x + 4, minZ: 0, maxZ: 8, bottom: 2.72, top: 3,
  })),
  stairs: [
    { minX: 0, maxX: 8, minZ: .4, maxZ: 7.6, axis: 'x', dir: -1, topY: 3 },
    { minX: 74, maxX: 82, minZ: .4, maxZ: 7.6, axis: 'x', dir: 1, topY: 3 },
  ],
  cover: [
    // Paired cabinets mask the northern track and leave the south bypass open.
    ...[16, 63.6].map(x => ({ min: { x, y: 0, z: .4 }, max: { x: x + 2.4, y: 1.8, z: 4.2 } })),
    // Low loading pallets; the track-side edge remains a standing firing line.
    ...[27, 51].map(x => ({ min: { x, y: 0, z: 5.7 }, max: { x: x + 4, y: 1.1, z: 7.6 } })),
    ...[9, 70].map(x => ({ min: { x, y: 0, z: .4 }, max: { x: x + 3, y: 1.1, z: 1.8 } })),
  ],
};
