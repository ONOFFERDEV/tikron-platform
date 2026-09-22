import type { Object3D, Vector3 } from "three";

export function setObjectWorldPosition(object: Object3D, worldPosition: Vector3): boolean {
  const parent = object.parent;
  if (parent === null) return false;
  parent.updateWorldMatrix(true, false);
  object.position.copy(worldPosition);
  parent.worldToLocal(object.position);
  return true;
}
