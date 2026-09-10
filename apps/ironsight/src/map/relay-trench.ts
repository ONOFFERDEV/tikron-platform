import type { StructureDef } from './structures.js';

export const RELAY_TRENCH_CUT = { minX: 38, maxX: 112, minZ: 73, maxZ: 79 } as const;

/** Freight cable gallery: opposing ramps, two staggered machine bays and an
 * overhead yard crossing. All large visible geometry is authoritative. */
export const RELAY_TRENCH: StructureDef = {
  id: 'freight-trench', origin: { x: 38, y: -3, z: 73 }, width: 74, depth: 6,
  walls: [
    { axis: 'x', at: 0, from: 0, to: 74, thickness: .4, bottom: 0, top: 3 },
    { axis: 'x', at: 5.6, from: 0, to: 74, thickness: .4, bottom: 0, top: 3 },
  ],
  slabs: [{ minX: 35, maxX: 39, minZ: 0, maxZ: 6, bottom: 2.7, top: 3 }],
  stairs: [
    { minX: 0, maxX: 8, minZ: .4, maxZ: 5.6, axis: 'x', dir: -1, topY: 3 },
    { minX: 66, maxX: 74, minZ: .4, maxZ: 5.6, axis: 'x', dir: 1, topY: 3 },
  ],
  cover: [
    { min: { x: 20, y: 0, z: .4 }, max: { x: 22, y: 1.8, z: 3.6 } },
    { min: { x: 52, y: 0, z: 2.4 }, max: { x: 54, y: 1.8, z: 5.6 } },
    { min: { x: 29, y: 0, z: .4 }, max: { x: 32, y: 1.1, z: 1.4 } },
    { min: { x: 42, y: 0, z: 4.6 }, max: { x: 45, y: 1.1, z: 5.6 } },
  ],
};
