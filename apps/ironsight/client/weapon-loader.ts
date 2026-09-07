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
