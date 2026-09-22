import * as T from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WW1_ENVIRONMENT_MANIFEST } from '../config/ww1-environment.js';
import {
  MAP_ENVIRONMENT_PLACEMENTS,
  placementIssues,
  type EnvironmentPropPlacement,
} from '../src/map/environment-props.js';
import { acquireMapDressing, cloneMapDressing, type MapDressingInstance } from './dressing-loader.js';

export type MapEnvironmentPropSet = {
  readonly loaded: readonly string[];
  readonly fallback: readonly string[];
  dispose(): void;
};

function assetUrl(placement: EnvironmentPropPlacement): string {
  const asset = WW1_ENVIRONMENT_MANIFEST.assets.find(candidate => candidate.key === placement.key);
  if (asset === undefined) throw new TypeError(`Missing environment candidate ${placement.key}`);
  return asset.publicUrl;
}

export function placeEnvironmentPropModel(
  model: T.Object3D,
  placement: EnvironmentPropPlacement,
): T.Group {
  const bounds = new T.Box3().setFromObject(model, true);
  const size = bounds.getSize(new T.Vector3());
  const drift = Math.max(...placement.dimensionsM.map((dimension, axis) =>
    Math.abs(dimension - size.getComponent(axis))));
  const originDrift = Math.max(Math.abs(bounds.min.y), Math.abs((bounds.min.x + bounds.max.x) / 2),
    Math.abs((bounds.min.z + bounds.max.z) / 2));
  if (!Number.isFinite(drift) || drift > .005 || originDrift > .005)
    throw new TypeError(`Environment candidate ${placement.key} does not match its admitted bounds/origin`);
  const group = new T.Group();
  group.name = `map-environment:${placement.id}`;
  group.position.set(...placement.position); group.rotation.y = placement.yaw;
  group.userData.architectureExclude = true;
  model.traverse(node => {
    if (node instanceof T.Mesh) node.castShadow = node.receiveShadow = true;
  });
  group.add(model);
  return group;
}

export function createEnvironmentFallback(placement: EnvironmentPropPlacement): T.Mesh {
  const [width, height, depth] = placement.dimensionsM;
  const geometry = new T.BoxGeometry(width, height, depth);
  const material = new T.MeshStandardMaterial({
    color: placement.key.includes('wagon') ? 0x3d423b : placement.key === 'brick-rubble' ? 0x67574a : 0x4c5140,
    roughness: .9, metalness: placement.key.includes('wagon') ? .18 : .04,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = `map-environment-fallback:${placement.id}`;
  mesh.position.set(placement.position[0], placement.position[1] + height / 2, placement.position[2]);
  mesh.rotation.y = placement.yaw; mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.architectureExclude = true;
  return mesh;
}

export async function loadMapEnvironmentProps(
  scene: T.Scene,
  map: 'relay' | 'undertow' | 'switchyard',
  options: { readonly candidatePreview?: boolean } = {},
): Promise<MapEnvironmentPropSet> {
  const placements = MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.map === map);
  for (const placement of placements) {
    const issues = placementIssues(placement, { width: 150, depth: 100 });
    if (issues.length > 0) throw new TypeError(`Invalid ${placement.id}: ${issues.join(',')}`);
  }
  const fallbacks = new Map(placements.map(placement => {
    const fallback = createEnvironmentFallback(placement); scene.add(fallback); return [placement.id, fallback];
  }));
  if (options.candidatePreview !== true) {
    let disposed = false;
    return {
      loaded: [],
      fallback: placements.map(placement => placement.id),
      dispose: () => {
        if (disposed) return;
        disposed = true;
        for (const fallback of fallbacks.values()) {
          fallback.removeFromParent(); fallback.geometry.dispose();
          for (const material of Array.isArray(fallback.material) ? fallback.material : [fallback.material]) material.dispose();
        }
      },
    };
  }
  const urls = new Map(placements.map(placement => [placement.key, assetUrl(placement)]));
  const leases = new Map([...urls].map(([key, url]) => [key, acquireMapDressing(url)]));
  const templates = new Map<string, GLTF>();
  for (const [key, lease] of leases) {
    try {
      const gltf = await lease.value;
      if (gltf === undefined) {
        lease.release();
        leases.delete(key);
        continue;
      }
      templates.set(key, gltf);
    } catch (error) {
      lease.release();
      leases.delete(key);
      console.warn(`[map-environment] retaining ${key} fallbacks`, error);
    }
  }
  const instances: { readonly instance: MapDressingInstance; readonly group: T.Group }[] = [], loaded: string[] = [];
  for (const placement of placements) {
    const gltf = templates.get(placement.key);
    if (gltf === undefined) continue;
    const instance = cloneMapDressing(gltf);
    try {
      const group = placeEnvironmentPropModel(instance.object, placement);
      scene.add(group); instances.push({ instance, group }); loaded.push(placement.id);
      const fallback = fallbacks.get(placement.id);
      fallback?.removeFromParent();
    } catch (error) {
      instance.dispose();
      console.warn(`[map-environment] retaining ${placement.id} fallback`, error);
    }
  }
  let disposed = false;
  return {
    loaded,
    fallback: placements.filter(placement => !loaded.includes(placement.id)).map(placement => placement.id),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const { instance, group } of instances) { group.removeFromParent(); instance.dispose(); }
      for (const fallback of fallbacks.values()) {
        fallback.removeFromParent(); fallback.geometry.dispose();
        for (const material of Array.isArray(fallback.material) ? fallback.material : [fallback.material]) material.dispose();
      }
      for (const lease of leases.values()) lease.release();
    },
  };
}
