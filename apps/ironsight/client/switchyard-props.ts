import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** One lazy generated mesh/texture set, shared by three exterior transformers.
 * Normalize from measured GLB bounds; the entire envelope must remain north of
 * z=0, so model revisions can never become uncollidable playable cover. */
export async function loadSwitchyardTransformers(scene: T.Scene): Promise<void> {
  const { scene: model } = await new GLTFLoader().loadAsync('/assets/props/switchyard-transformer.glb');
  const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
  const scale = Math.min(7 / size.x, 6 / size.y, 6 / size.z);
  if (!Number.isFinite(scale) || scale <= 0) throw Error('Invalid transformer bounds');
  const center = bounds.getCenter(new T.Vector3());
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.scale.setScalar(scale);
  model.traverse(node => {
    if (node instanceof T.Light) throw Error('Generated machinery must not contain lights');
    if (node instanceof T.Mesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  for (const x of [10, 30, 50]) {
    const group = new T.Group(); group.name = 'switchyard-transformer';
    group.add(model.clone(true)); group.position.set(x, 0, -8);
    if (new T.Box3().setFromObject(group).max.z >= 0) throw Error('Transformer crosses playable boundary');
    scene.add(group);
  }
}
