/** Cached map models retain world-space transforms. Signal Station can rebuild
 * its original skyline on failure; other failures resolve to the caller's fallback. */
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Mesh, type Material, type Object3D } from "three";
import { SharedAssetCache, disposeGltfTemplate, type AssetCacheSnapshot, type AssetLease } from './shared-gltf-cache.js';
import { buildRelaySkyline } from './relay-skyline.js';
import { ARENA1 } from '../src/map/arena1.js';

const warnedUrls = new Set<string>();
async function loadDressing(url: string): Promise<GLTF> {
  const loader = new GLTFLoader();
  try {
    return await loader.loadAsync(url);
  } catch (error) {
    if (url !== '/assets/maps/relay-skyline.glb') throw error;
    if (!warnedUrls.has(url)) {
      warnedUrls.add(url);
      console.warn('[dressing-loader] retaining original signal village after skyline load failure', error);
    }
    // A real GLTF document preserves the existing lease API. The cache owns
    // fallback geometry exactly like a decoded asset, including late cancellation.
    const gltf = await loader.parseAsync(JSON.stringify({ asset: { version: '2.0' },
      scene: 0, scenes: [{ nodes: [] }], nodes: [],
    }), '');
    gltf.scene = buildRelaySkyline(ARENA1.bounds);
    gltf.scene.name = 'relay-signal-village';
    gltf.scenes = [gltf.scene];
    return gltf;
  }
}

const sharedCache = new SharedAssetCache<GLTF>(
  loadDressing,
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
