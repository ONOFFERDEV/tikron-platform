import type { MeshStandardMaterialParameters } from 'three';

/** Late-war supply depot under an overcast sky: sooty railway brick, dark
 * iron, burlap sandbags, raw and painted timber, and stacked ammunition boxes.
 * The same values serve the original AO bake and procedural fallback. */
export const SWITCHYARD_FINISH = {
  concrete: { color: 0x8a7566, roughness: 0.96, metalness: 0 }, // brick walls, paved setts
  steel: { color: 0x3f403b, roughness: 0.8, metalness: 0.22 },
  housing: { color: 0x7d6f53, roughness: 0.88, metalness: 0 }, // ammunition box stacks
  ochre: { color: 0x8b7657, roughness: 0.9, metalness: 0 }, // raw timber
  olive: { color: 0x6e6852, roughness: 0.9, metalness: 0 }, // weathered timber
  pale: { color: 0x8d8269, roughness: 0.95, metalness: 0 }, // burlap sandbags
  deck: { color: 0x74766d, roughness: 0.78, metalness: 0.32 },
} as const satisfies Record<string, MeshStandardMaterialParameters>;

// Original baked slots follow first use, not the procedural palette order.
// Re-derived from the depot-conversion dump (2026-09-23) by baked linear colour.
const BAKE_SLOTS = ['concrete', 'housing', 'ochre', 'pale', 'steel', 'olive',
  'deck', 'deck', 'deck', 'deck'] as const;

export function switchyardBakedFinish(name: string): keyof typeof SWITCHYARD_FINISH | undefined {
  const match = /^switchyard-(\d+)$/.exec(name);
  return match ? BAKE_SLOTS[Number(match[1])] : undefined;
}
