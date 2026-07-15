/**
 * dressing-loader.ts — loads a map's baked visual-dressing bundle GLB (Synty
 * SciFi City meshes; is-armfix's manifest→bundle CLI has already baked every
 * placement's world-space transform into the GLB's own node hierarchy, so the
 * caller just adds `gltf.scene` directly at the scene origin — no per-instance
 * transform, unlike weapon-loader.ts's per-shot clones).
 *
 * Never rejects: resolves `undefined` (after one console.warn per URL) on any
 * fetch/parse failure, and the caller (scene.ts) is expected to stay on the
 * existing procedural box/wall render permanently in that case.
 */
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const cache = new Map<string, Promise<GLTF | undefined>>();
const warnedUrls = new Set<string>();

/** Fetches (and caches by URL) a map dressing bundle GLB. */
export async function loadMapDressing(url: string): Promise<GLTF | undefined> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(url).catch((err: unknown) => {
      if (!warnedUrls.has(url)) {
        warnedUrls.add(url);
        console.warn(`[dressing-loader] failed to load ${url}, staying on the procedural box/wall render`, err);
      }
      return undefined;
    });
    cache.set(url, pending);
  }
  return pending;
}
