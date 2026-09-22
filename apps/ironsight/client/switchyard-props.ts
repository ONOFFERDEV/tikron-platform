import * as T from 'three';

/** Lightweight rail signals outside the playable rectangle. Task 10 supplies
 * the final authored wagons and yard detail without changing collision. */
export async function loadSwitchyardTransformers(scene: T.Scene, width: number): Promise<void> {
  const iron = new T.MeshStandardMaterial({ color: 0x353732, roughness: 0.9, metalness: 0.25 });
  const arm = new T.MeshStandardMaterial({ color: 0xa27a3d, roughness: 0.85, metalness: 0.05 });
  for (const x of [width / 2 - 40, width / 2, width / 2 + 40]) {
    const group = new T.Group(); group.name = 'switchyard-rail-signal';
    const post = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 5.4, 8), iron);
    post.position.y = 2.7;
    const semaphore = new T.Mesh(new T.BoxGeometry(2.4, 0.18, 0.18), arm);
    semaphore.position.set(0.9, 4.7, 0);
    semaphore.rotation.z = Math.PI / 10;
    group.add(post, semaphore);
    group.position.set(x, 0, -4);
    scene.add(group);
  }
}
