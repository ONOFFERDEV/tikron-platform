/**
 * weapon-loader.ts — loads viewmodel weapon GLBs in either of two shapes:
 *  - **single-file** (the original cyber-trooper GLBs): untextured, shape-only,
 *    one static mesh per file, no skeleton — `cloneWeaponMesh` clones the whole
 *    scene.
 *  - **bundle** (is-armfix's Synty manifest→bundle tool): all 5 weapons merged
 *    into ONE GLB, each its own named node (wep_ar/wep_smg/wep_shotgun/
 *    wep_sniper/wep_pistol), sharing one dedup'd textured material —
 *    `cloneWeaponBundleNode` extracts and clones just one slot's node.
 * Either way it's a plain `Object3D#clone()` — there's no skeleton involved
 * (unlike rig-loader.ts's player model), so no SkeletonUtils needed.
 *
 * Never rejects: `loadWeaponModel` resolves `undefined` — after a single
 * `console.warn` per URL — on any fetch/parse failure, and the caller
 * (scene.ts's setWeaponVisual) is expected to stay on the procedural
 * buildWeaponMesh() fallback in that case. The bundle is fetched once and
 * cached by URL same as any single-file model — every slot sharing the same
 * bundle URL hits the same cache entry, so switching weapons never re-fetches it.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const cache = new Map<string, Promise<GLTF | undefined>>();
const warnedUrls = new Set<string>();

/** Fetches (and caches by URL) a weapon GLB — single-file or bundle, same call. */
export async function loadWeaponModel(url: string): Promise<GLTF | undefined> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(url).catch((err: unknown) => {
      if (!warnedUrls.has(url)) {
        warnedUrls.add(url);
        console.warn(`[weapon-loader] failed to load ${url}, staying on procedural mesh`, err);
      }
      return undefined;
    });
    cache.set(url, pending);
  }
  return pending;
}

/** Clones a fresh instance of the cached GLB's scene. Geometry is shared by
 *  reference across every clone (same as the cache itself) — callers must
 *  dispose only per-instance materials they create, never the geometry. */
export function cloneWeaponMesh(gltf: GLTF): THREE.Object3D {
  return gltf.scene.clone();
}

/** Clones a single named node out of a multi-weapon bundle GLB. Returns
 *  `undefined` if the bundle doesn't have that node (e.g. a config/bundle
 *  mismatch) — caller stays on the procedural mesh, same as a load failure. */
export function cloneWeaponBundleNode(gltf: GLTF, nodeName: string): THREE.Object3D | undefined {
  return gltf.scene.getObjectByName(nodeName)?.clone();
}
