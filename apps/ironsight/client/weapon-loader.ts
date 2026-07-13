/**
 * weapon-loader.ts — loads the cyber-trooper viewmodel weapon GLBs (untextured,
 * shape-only, single static mesh each — no skeleton, unlike rig-loader.ts's
 * player model). A plain `Object3D#clone()` is enough here; there's no
 * SkeletonUtils involved since there's nothing to rebind.
 *
 * Never rejects: `loadWeaponModel` resolves `undefined` — after a single
 * `console.warn` per URL — on any fetch/parse failure, and the caller
 * (scene.ts's setWeaponVisual) is expected to stay on the procedural
 * buildWeaponMesh() fallback in that case.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const cache = new Map<string, Promise<GLTF | undefined>>();
const warnedUrls = new Set<string>();

/** Fetches (and caches by URL) a weapon GLB. Resolves `undefined` on any
 *  failure; never rejects. */
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
