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
import { Mesh, MeshStandardMaterial, Source, type Material, type Object3D, type Texture } from "three";
import { SharedAssetCache, disposeGltfTemplate, type AssetCacheSnapshot, type AssetLease } from './shared-gltf-cache.js';

const warnedUrls = new Set<string>();
type ResizeCanvas = {
  width: number;
  height: number;
  getContext(id: '2d'): { drawImage(image: object, x: number, y: number, width: number, height: number): void } | null;
};

function prepareDressing(url: string, gltf: GLTF): GLTF {
  if (url !== '/assets/maps/relay-skyline.glb') return gltf;
  const seen = new Set<Texture>();
  gltf.scene.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(mat instanceof MeshStandardMaterial) || !mat.map || seen.has(mat.map)) continue;
      const map = mat.map; seen.add(map);
      const image = map.image as object & { width: number; height: number };
      const ratio = 512 / Math.max(image.width, image.height);
      if (ratio >= 1) continue;
      const documentApi = (globalThis as { document?: { createElement(tag: 'canvas'): ResizeCanvas } }).document;
      if (documentApi === undefined) throw Error('Skyline atlas resize needs a document');
      const canvas = documentApi.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Skyline atlas resize needs a 2D context');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      map.source = new Source(canvas); map.needsUpdate = true;
    }
  });
  return gltf;
}

const sharedCache = new SharedAssetCache<GLTF>(
  url => new GLTFLoader().loadAsync(url).then(gltf => prepareDressing(url, gltf)),
  disposeGltfTemplate,
);

export function acquireMapDressing(url: string): AssetLease<GLTF> {
  const lease = sharedCache.acquire(url);
  return {
    value: lease.value.catch((error: unknown) => {
      if (!warnedUrls.has(url)) {
        warnedUrls.add(url);
        console.warn(`[dressing-loader] failed to load ${url}, staying on the procedural box/wall render`, error);
      }
      return undefined;
    }),
    release: lease.release,
  };
}

export const acquireEnvironmentModel = acquireMapDressing;

export function dressingCacheSnapshot(): AssetCacheSnapshot {
  return sharedCache.snapshot();
}

export type MapDressingInstance = {
  readonly object: Object3D;
  dispose(): void;
};

export function cloneMapDressing(gltf: GLTF): MapDressingInstance {
  const object = gltf.scene.clone(true);
  const materials = new Set<Material>();
  object.traverse(node => {
    if (!(node instanceof Mesh)) return;
    if (Array.isArray(node.material)) {
      node.material = node.material.map(material => {
        const clone = material.clone(); materials.add(clone); return clone;
      });
    } else {
      node.material = node.material.clone(); materials.add(node.material);
    }
  });
  return {
    object,
    dispose: () => {
      object.removeFromParent();
      for (const material of materials) material.dispose();
    },
  };
}

export const cloneEnvironmentModel = cloneMapDressing;
