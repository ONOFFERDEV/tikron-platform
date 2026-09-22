import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  WW1_ENVIRONMENT_MANIFEST,
  type EnvironmentAsset,
  type EnvironmentAssetKey,
} from '../config/ww1-environment.js';

type RelayKitKey = Extract<EnvironmentAssetKey, 'duckboard' | 'sandbag' | 'wire'>;

export type RelayEnvironmentPlacement = {
  readonly key: RelayKitKey;
  readonly dimensionsM: EnvironmentAsset['dimensionsM'];
  readonly origin: EnvironmentAsset['origin'];
  readonly joints: EnvironmentAsset['joints'];
  readonly surface: EnvironmentAsset['surfaces'][number];
  readonly collision: EnvironmentAsset['collision'];
  readonly maxCladdingOffsetM: number;
  readonly routeBoundary: boolean;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
};

function environmentAsset(key: RelayKitKey): EnvironmentAsset {
  const asset = WW1_ENVIRONMENT_MANIFEST.assets.find(candidate => candidate.key === key);
  if (asset === undefined) throw Error(`Missing environment asset: ${key}`);
  return asset;
}

function placement(key: RelayKitKey, position: readonly [number, number, number], yaw = 0): RelayEnvironmentPlacement {
  const asset = environmentAsset(key);
  const surface = asset.surfaces[0];
  if (surface === undefined) throw Error(`Missing environment surface: ${key}`);
  return {
    key, dimensionsM: asset.dimensionsM, origin: asset.origin, joints: asset.joints,
    surface, collision: asset.collision, maxCladdingOffsetM: asset.maxCladdingOffsetM,
    routeBoundary: asset.routeBoundary, position, yaw,
  };
}

export const RELAY_ENVIRONMENT_PLACEMENTS: readonly RelayEnvironmentPlacement[] = [
  ...[[47, 76], [49, 76], [53, 77.9], [57, 77.2], [61, 75.2], [69, 74.1], [77, 77.9], [89, 74.1], [97, 75], [101, 76]]
    .map(([x, z]) => placement('duckboard', [x!, -3.1, z!])),
  ...[[53, 75], [65, 77], [81, 75], [93, 77]]
    .map(([x, z]) => placement('sandbag', [x!, -3, z!])),
  ...[56, 65, 85, 94].map(x => placement('wire', [x, 0, 72.9])),
];

export function placeRelayEnvironmentModel(model: T.Object3D, placementDef: RelayEnvironmentPlacement): T.Group {
  const asset = environmentAsset(placementDef.key);
  const bounds = new T.Box3().setFromObject(model, true);
  const size = bounds.getSize(new T.Vector3());
  const drift = Math.max(...asset.dimensionsM.map((dimension, index) => Math.abs(dimension - size.getComponent(index))));
  if (!Number.isFinite(drift) || drift > asset.maxCladdingOffsetM) throw Error(`Invalid ${asset.key} bounds`);
  const group = new T.Group();
  group.name = `relay-environment:${asset.key}`;
  group.position.set(...placementDef.position);
  group.rotation.y = placementDef.yaw;
  group.add(model);
  model.traverse(node => {
    if (node instanceof T.Mesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  return group;
}

export async function loadRelayEnvironmentKit(scene: T.Scene): Promise<void> {
  const loader = new GLTFLoader();
  const templates = new Map<RelayKitKey, Promise<T.Object3D>>();
  const template = (key: RelayKitKey) => {
    let pending = templates.get(key);
    if (pending === undefined) {
      pending = loader.loadAsync(environmentAsset(key).publicUrl).then(gltf => gltf.scene);
      templates.set(key, pending);
    }
    return pending;
  };
  const groups = await Promise.all(RELAY_ENVIRONMENT_PLACEMENTS.map(async placementDef =>
    placeRelayEnvironmentModel((await template(placementDef.key)).clone(true), placementDef)));
  scene.add(...groups);
}

export function placeRelayUplinks(model: T.Object3D, centerX = 31): T.Group[] {
  model.traverse(node => {
    if (node instanceof T.Light) throw Error('Field aerial must not contain lights');
  });
  const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
  if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0))
    throw Error('Invalid field aerial bounds');
  const scale = Math.min(4 / size.x, 9 / size.y, 2.5 / size.z);
  const center = bounds.getCenter(new T.Vector3());
  const normalized = new T.Group();
  normalized.add(model);
  normalized.scale.setScalar(scale);
  normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.traverse(node => {
    if (node instanceof T.Mesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  return [centerX - 6, centerX + 6].map(x => {
    const group = new T.Group(); group.name = 'relay-field-aerial';
    group.add(normalized.clone(true)); group.position.set(x, 0, -6);
    const placed = new T.Box3().setFromObject(group);
    if (placed.max.z >= 0 || placed.min.y < -0.001) throw Error('Field aerial crosses its exterior envelope');
    return group;
  });
}

export async function loadRelayUplinks(scene: T.Scene, centerX = 31): Promise<void> {
  const model = new T.Group();
  const timber = new T.MeshStandardMaterial({ color: 0x4a3828, roughness: .92 });
  const iron = new T.MeshStandardMaterial({ color: 0x343833, roughness: .8, metalness: .35 });
  const pole = new T.Mesh(new T.CylinderGeometry(.16, .22, 7.5, 8), timber);
  pole.position.y = 3.75;
  const crossarm = new T.Mesh(new T.BoxGeometry(3.2, .18, .18), timber);
  crossarm.position.y = 6.8;
  model.add(pole, crossarm);
  for (const x of [-1.25, -.42, .42, 1.25]) {
    const insulator = new T.Mesh(new T.CylinderGeometry(.08, .11, .28, 8), iron);
    insulator.position.set(x, 7.02, 0);
    model.add(insulator);
  }
  scene.add(...placeRelayUplinks(model, centerX));
  await loadRelayEnvironmentKit(scene);
}
