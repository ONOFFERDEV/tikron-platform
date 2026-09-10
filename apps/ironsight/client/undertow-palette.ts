import type { MeshStandardMaterialParameters } from 'three';

/** Wet industrial finishes, shared by the original AO bake and its fallback.
 * Lane accents live on signs; broad surfaces stay below soldier colour/value. */
export const UNDERTOW_FINISH = {
  concrete: { color: 0x91938a, roughness: 0.96, metalness: 0 },
  housing: { color: 0x676d68, roughness: 0.89, metalness: 0.08 },
  steel: { color: 0x414745, roughness: 0.78, metalness: 0.24 },
  pale: { color: 0xa39f8c, roughness: 0.92, metalness: 0 },
  olive: { color: 0x687060, roughness: 0.9, metalness: 0.05 },
  ochre: { color: 0x94805c, roughness: 0.9, metalness: 0.05 },
  ramp: { color: 0x6c7069, roughness: 0.93, metalness: 0 },
} as const satisfies Record<string, MeshStandardMaterialParameters>;

// Slot order is first use in the original dump, not the procedural colour list.
const BAKE_SLOTS = ['concrete', 'steel', 'pale', 'olive', 'ochre', 'housing',
  'ramp', 'ramp', 'ramp', 'ramp'] as const;

export function undertowBakedFinish(name: string): keyof typeof UNDERTOW_FINISH | undefined {
  const match = /^undertow-(\d+)$/.exec(name);
  return match ? BAKE_SLOTS[Number(match[1])] : undefined;
}
