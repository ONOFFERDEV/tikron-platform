import * as T from 'three';

/** Same selection for the offline bake and runtime replacement. Never includes
 * purchased dressing, signs, floor atlas, emissive strips or fallback skyline. */
export function architectureMeshes(root: T.Object3D): T.Mesh[] {
  const meshes: T.Mesh[] = [];
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || !(node.material instanceof T.MeshStandardMaterial) || node.material.map) return;
    for (let p: T.Object3D | null = node; p; p = p.parent)
      if (p.name === 'relay-skyline-fallback') return;
    meshes.push(node);
  });
  return meshes;
}
