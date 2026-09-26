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
 * An acquired lease resolves `undefined` after one `console.warn` per URL on
 * any fetch/parse failure, and the caller
 * (scene.ts's setWeaponVisual) is expected to stay on the procedural
 * buildWeaponMesh() fallback in that case. The bundle is fetched once and
 * cached by URL while leased — every slot sharing the same bundle URL hits the
 * same cache entry.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { WeaponVisConfig } from '../config/schema.js';
import { finishLegacyWeapon } from './equipment-finish.js';
import { SharedAssetCache, disposeGltfTemplate, type AssetCacheSnapshot, type AssetLease } from './shared-gltf-cache.js';

export type WeaponSource = { readonly url: string; readonly nodeName?: string };
export type WeaponSourceOptions = { readonly candidatePreview?: boolean };
export const WW1_WEAPON_CANDIDATE_SOURCES: readonly WeaponSource[] = [
  { url: '/assets/ww1/weapons/automatic-rifle.glb', nodeName: 'automatic_rifle' },
  { url: '/assets/ww1/weapons/trench-smg.glb', nodeName: 'trench_smg' },
  { url: '/assets/ww1/weapons/pump-shotgun.glb', nodeName: 'pump_shotgun' },
  { url: '/assets/ww1/weapons/bolt-rifle.glb', nodeName: 'bolt_service_rifle' },
  { url: '/assets/ww1/weapons/service-pistol.glb', nodeName: 'service_pistol' },
];
export type WeaponSupportSource = 'grenade' | 'clip' | 'shell' | 'casing';
export const WW1_WEAPON_SUPPORT_SOURCES: Readonly<Record<WeaponSupportSource, WeaponSource>> = {
  grenade: { url: '/assets/ww1/weapons/grenade.glb', nodeName: 'grenade' },
  clip: { url: '/assets/ww1/weapons/clip-shell-casing.glb', nodeName: 'clip' },
  shell: { url: '/assets/ww1/weapons/clip-shell-casing.glb', nodeName: 'shell' },
  casing: { url: '/assets/ww1/weapons/clip-shell-casing.glb', nodeName: 'casing' },
};

export function weaponSupportSource(kind: WeaponSupportSource, options: WeaponSourceOptions = {}): WeaponSource | undefined {
  return options.candidatePreview === true ? WW1_WEAPON_SUPPORT_SOURCES[kind] : undefined;
}

export function weaponSource(config: WeaponVisConfig, index: number, options: WeaponSourceOptions = {}): WeaponSource | undefined {
  if (options.candidatePreview === true) return WW1_WEAPON_CANDIDATE_SOURCES[index];
  const override = config.overrides?.[index];
  if (override) return { url: override.url, nodeName: override.node };
  const nodeName = config.bundle?.nodes[index];
  if (nodeName) return { url: config.bundle!.url, nodeName };
  const url = config.models?.[index];
  return url ? { url } : undefined;
}

const warnedUrls = new Set<string>();
/** The legacy weapon bundle ships one 2048x2048 atlas (~21 MiB resident with mips). Held weapons
 * read the same at 1024 (Session 12 hip/ADS crops), so resample colour maps once per template. */
export const WEAPON_ATLAS_MAX = 1024;
function limitWeaponMaps(scene: THREE.Object3D): void {
  const dom = globalThis as unknown as { document?: { createElement(tag: 'canvas'): {
    width: number; height: number;
    getContext(type: '2d'): { drawImage(image: unknown, x: number, y: number, w: number, h: number): void } | null;
  } } };
  if (!dom.document) return;
  const resized = new Map<THREE.Texture, THREE.Texture>();
  scene.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || !material.map) continue;
      const source = material.map, image = source.image as { width?: number; height?: number };
      const size = Math.max(image.width ?? 0, image.height ?? 0);
      if (size <= WEAPON_ATLAS_MAX) continue;
      let texture = resized.get(source);
      if (!texture) {
        const canvas = dom.document!.createElement('canvas'), scale = WEAPON_ATLAS_MAX / size;
        canvas.width = Math.round((image.width ?? 0) * scale); canvas.height = Math.round((image.height ?? 0) * scale);
        const context = canvas.getContext('2d');
        if (!context) continue;
        context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
        texture = source.clone(); texture.image = canvas; texture.name = `${source.name || 'weapon-atlas'}-${WEAPON_ATLAS_MAX}`;
        texture.needsUpdate = true;
        resized.set(source, texture);
        source.dispose();
      }
      material.map = texture;
    }
  });
}
const sharedCache = new SharedAssetCache<GLTF>(url => new GLTFLoader().loadAsync(url)
  .then(gltf => { limitWeaponMaps(gltf.scene); return gltf; }), disposeGltfTemplate);

export function acquireWeaponModel(url: string): AssetLease<GLTF> {
  const lease = sharedCache.acquire(url);
  return {
    value: lease.value.catch((error: unknown) => {
      if (!warnedUrls.has(url)) {
        warnedUrls.add(url);
        console.warn(`[weapon-loader] failed to load ${url}, staying on procedural mesh`, error);
      }
      return undefined;
    }),
    release: lease.release,
  };
}

export function weaponCacheSnapshot(): AssetCacheSnapshot {
  return sharedCache.snapshot();
}

/** Fetches (and caches by URL) a weapon GLB — single-file or bundle, same call. */
/** Clones a fresh instance of the cached GLB's scene. Geometry is shared by
 *  reference across every clone (same as the cache itself) — callers must
 *  dispose only per-instance materials they create, never the geometry. */
export function cloneWeaponMesh(gltf: GLTF): THREE.Object3D {
  return gltf.scene.clone();
}

/** Clones a single named node and selects its shared runtime surface finish.
 * Source geometry/textures are shared; source materials remain untouched. Returns
 *  `undefined` if the bundle doesn't have that node (e.g. a config/bundle
 *  mismatch) — caller stays on the procedural mesh, same as a load failure. */
export function cloneWeaponBundleNode(gltf: GLTF, nodeName: string): THREE.Object3D | undefined {
  const object = gltf.scene.getObjectByName(nodeName)?.clone();
  if (object) finishLegacyWeapon(object, nodeName);
  return object;
}

/** Centre of the foremost vertex slice, rather than the receiver's bounding box.
 * Called only on weapon load; bundle assets are authored with bore along +Z. */
export function weaponMuzzle(object: THREE.Object3D): THREE.Vector3 {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return new THREE.Vector3(); // mesh-less node: no bore to measure (avoids a -Infinity tip)
  const tip = new THREE.Box3();
  const point = new THREE.Vector3();
  const threshold = box.max.z - (box.max.z - box.min.z) * 0.015;
  object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const positions = node.geometry.getAttribute("position");
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
      if (point.z >= threshold) tip.expandByPoint(point);
    }
  });
  if (tip.isEmpty()) return new THREE.Vector3(0, 0, box.max.z);
  tip.getCenter(point); point.z = box.max.z;
  return point;
}
