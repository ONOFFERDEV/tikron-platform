import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Two exterior uplinks share one generated geometry/PBR set. Ground the source
 * from its measured bounds; no generated surface can become playable cover. */
export function placeRelayUplinks(model: T.Object3D, centerX = 31): T.Group[] {
  model.traverse(node => {
    if (node instanceof T.Light) throw Error('Uplink must not contain lights');
  });
  const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
  if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0))
    throw Error('Invalid uplink bounds');
  const scale = Math.min(7 / size.x, 11 / size.y, 4.2 / size.z);
  const center = bounds.getCenter(new T.Vector3());
  const normalized = new T.Group();
  normalized.add(model);
  normalized.scale.setScalar(scale);
  normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.traverse(node => {
    if (node instanceof T.Mesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  return [centerX - 6, centerX + 6].map(x => {
    const group = new T.Group(); group.name = 'relay-uplink';
    group.add(normalized.clone(true)); group.position.set(x, 0, -6);
    const placed = new T.Box3().setFromObject(group);
    if (placed.max.z >= 0 || placed.min.y < -0.001) throw Error('Uplink crosses its exterior envelope');
    return group;
  });
}

export async function loadRelayUplinks(scene: T.Scene, centerX = 31): Promise<void> {
  const { scene: model } = await new GLTFLoader().loadAsync('/assets/props/relay-uplink.glb');
  scene.add(...placeRelayUplinks(model, centerX));
}
