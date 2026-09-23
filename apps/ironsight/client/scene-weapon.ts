import type * as THREE from 'three';
import { WeaponPresentation, resolveWeaponContractRoot } from './weapon-presentation.js';
import type { WeaponKey } from '../src/weapon-contract.js';

/** Presentation for a loaded first-person weapon, or `undefined` to reject it.
 *  WW1 candidate previews must carry the full contract (quarantined candidates
 *  stay refused); legacy `field-carbine` / `wep_*` nodes predate the contract
 *  and load with `null`, using the source-muzzle/eject fallback. */
export function viewmodelWeaponPresentation(obj: THREE.Object3D, key: WeaponKey, candidatePreview: boolean): WeaponPresentation | null | undefined {
  const root = resolveWeaponContractRoot(obj, key);
  const presentation = root === null ? null : new WeaponPresentation(key, root);
  if (presentation?.sockets) return presentation;
  return candidatePreview ? undefined : null;
}
