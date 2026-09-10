import type { StructureDef } from './structures.js';

export const UNDERTOW_CHANNEL_CUT = { minX: 34, maxX: 116, minZ: 68, maxZ: 74 } as const;

/** Drained pump-service channel. Two end stairs connect the -3m floor to
 * the yard; three bridges preserve north/south crossings at ground level.
 * All retaining walls, bridge slabs and pump baffles are shared collision.
 * The water treatment plant's live discharge stays in the exterior basin. */
export const UNDERTOW_CHANNEL: StructureDef = {
  id: 'pump-channel', origin: { x: 34, y: -3, z: 68 }, width: 82, depth: 6,
  walls: [
    { axis: 'x', at: 0, from: 0, to: 82, thickness: .4, bottom: 0, top: 3 },
    { axis: 'x', at: 5.6, from: 0, to: 82, thickness: .4, bottom: 0, top: 3 },
  ],
  slabs: [10, 39, 68].map(x => ({
    minX: x, maxX: x + 4, minZ: 0, maxZ: 6, bottom: 2.72, top: 3,
  })),
  stairs: [
    { minX: 0, maxX: 8, minZ: .4, maxZ: 5.6, axis: 'x', dir: -1, topY: 3 },
    { minX: 74, maxX: 82, minZ: .4, maxZ: 5.6, axis: 'x', dir: 1, topY: 3 },
  ],
  cover: [
    // Paired full-height pumps force a clear, two-metre southern bypass.
    ...[22, 58].map(x => ({ min: { x, y: 0, z: .4 }, max: { x: x + 2, y: 1.8, z: 3.2 } })),
    ...[31, 48].map(x => ({ min: { x, y: 0, z: 4.6 }, max: { x: x + 3, y: 1.1, z: 5.6 } })),
  ],
};
