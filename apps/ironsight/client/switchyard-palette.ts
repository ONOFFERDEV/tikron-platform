import type { MeshStandardMaterialParameters } from 'three';

/** Issued industrial paint under the overcast sky. The same values serve the
 * original AO bake and procedural fallback; signs keep the brighter accents. */
export const SWITCHYARD_FINISH = {
  concrete: { color: 0x939388, roughness: 0.96, metalness: 0 },
  steel: { color: 0x464a45, roughness: 0.78, metalness: 0.26 },
  housing: { color: 0x777a68, roughness: 0.87, metalness: 0.12 },
  ochre: { color: 0xa18a61, roughness: 0.91, metalness: 0.05 },
  olive: { color: 0x777c66, roughness: 0.89, metalness: 0.06 },
  pale: { color: 0xaba997, roughness: 0.93, metalness: 0.02 },
  deck: { color: 0x74766d, roughness: 0.78, metalness: 0.32 },
} as const satisfies Record<string, MeshStandardMaterialParameters>;

// Original baked slots follow first use, not the procedural palette order.
const BAKE_SLOTS = ['concrete', 'steel', 'pale', 'olive', 'ochre', 'housing',
  'deck', 'deck', 'deck', 'deck'] as const;

export function switchyardBakedFinish(name: string): keyof typeof SWITCHYARD_FINISH | undefined {
  const match = /^switchyard-(\d+)$/.exec(name);
  return match ? BAKE_SLOTS[Number(match[1])] : undefined;
}
