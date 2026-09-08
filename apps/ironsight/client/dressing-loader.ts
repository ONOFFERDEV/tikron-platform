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
import { Mesh, MeshStandardMaterial, Source, type Texture } from "three";

const cache = new Map<string, Promise<GLTF | undefined>>();
const warnedUrls = new Set<string>();

/** Fetches (and caches by URL) a map dressing bundle GLB. */
export async function loadMapDressing(url: string): Promise<GLTF | undefined> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(url).then(gltf => {
      // This distant palette atlas needs no close-up texel density. Resize once,
      // before GPU preparation, leaving the private source GLB untouched.
      if (url === '/assets/maps/relay-skyline.glb') {
        const seen = new Set<Texture>();
        gltf.scene.traverse(node => {
          if (!(node instanceof Mesh)) return;
          for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
            if (!(mat instanceof MeshStandardMaterial) || !mat.map || seen.has(mat.map)) continue;
            const map = mat.map; seen.add(map);
            const image = map.image as CanvasImageSource & { width: number; height: number };
            const ratio = 512 / Math.max(image.width, image.height);
            if (ratio >= 1) continue;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * ratio));
            canvas.height = Math.max(1, Math.round(image.height * ratio));
            const ctx = canvas.getContext('2d');
            if (!ctx) throw Error('Skyline atlas resize needs a 2D context');
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            // Retain color space, UV transform, wrapping and glTF orientation.
            map.source = new Source(canvas); map.needsUpdate = true;
          }
        });
      }
      return gltf;
    }).catch((err: unknown) => {
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
