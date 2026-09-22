import type { StructureDef } from './structures.js';

export const RELAY_TRENCH_CUT = { minX: 38, maxX: 112, minZ: 73, maxZ: 79 } as const;

/** Sunken supply road: opposing ramps, four timber/earth traverses and an
 * overhead yard crossing. Every turn retains more than two metres of passage. */
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
    { min: { x: 14, y: 0, z: .4 }, max: { x: 16, y: 1.8, z: 3.6 } },
    { min: { x: 26, y: 0, z: 2.4 }, max: { x: 28, y: 1.8, z: 5.6 } },
    { min: { x: 42, y: 0, z: .4 }, max: { x: 44, y: 1.8, z: 3.6 } },
    { min: { x: 54, y: 0, z: 2.4 }, max: { x: 56, y: 1.8, z: 5.6 } },
    { min: { x: 20, y: 0, z: 4.6 }, max: { x: 23, y: 1.1, z: 5.6 } },
    { min: { x: 47, y: 0, z: .4 }, max: { x: 50, y: 1.1, z: 1.4 } },
  ],
};
