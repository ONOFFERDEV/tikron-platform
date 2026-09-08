import * as T from 'three';

/** Same selection for the offline bake and runtime replacement. Never includes
 * purchased dressing, signs, ground (including untextured aprons), emissive strips
 * or fallback skyline. Ground is not exported in bakeOnly and must survive loading. */
export function architectureMeshes(root: T.Object3D): T.Mesh[] {
  const meshes: T.Mesh[] = [];
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || node.userData.siteGround === true ||
        !(node.material instanceof T.MeshStandardMaterial) || node.material.map) return;
    for (let p: T.Object3D | null = node; p; p = p.parent)
      if (p.name === 'relay-skyline-fallback') return;
    meshes.push(node);
  });
  return meshes;
}
