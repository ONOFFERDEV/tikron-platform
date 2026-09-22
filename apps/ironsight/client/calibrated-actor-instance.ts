import * as THREE from "three";

import type { HitPart } from "../src/hitscan.js";
import type { HitRigPoseSample } from "../src/hit-rig-pose.js";
import { prepareSoldierAtlas } from "./field-equipment.js";
import type { PlayerRigModel } from "./rig-loader.js";
import { cloneCalibratedPlayerRig } from "./rig-loader.js";
import type { CalibratedActorTemplate } from "./calibrated-actor-loader.js";
import type { CalibratedPlayerFallback } from "./calibrated-player-fallback.js";

export function createCalibratedActorModel(template: CalibratedActorTemplate): PlayerRigModel {
  const model = cloneCalibratedPlayerRig(template.gltf, template.normalization);
  model.object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.raycast = node instanceof THREE.SkinnedMesh
      ? THREE.SkinnedMesh.prototype.raycast
      : THREE.Mesh.prototype.raycast;
    delete node.userData.fieldEquipmentRaycast;
  });
  prepareSoldierAtlas(model.object);
  model.object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = false;
    node.receiveShadow = true;
  });
  return model;
}

export function calibratedModelHitPart(
  sample: HitRigPoseSample,
  actorLocalPoint: THREE.Vector3,
): HitPart {
  const head = sample.hitVolume.headCenter;
  const dx = actorLocalPoint.x - head.x;
  const dy = actorLocalPoint.y - head.y;
  const dz = actorLocalPoint.z - head.z;
  return dx * dx + dy * dy + dz * dz <= sample.headRadius * sample.headRadius
    ? "head"
    : "body";
}

export function calibratedActorClaimTargets(
  visible: boolean,
  model: PlayerRigModel | undefined,
  fallback: CalibratedPlayerFallback,
): readonly THREE.Object3D[] {
  if (!visible) return [];
  if (model === undefined) return [fallback.body, fallback.head];
  const targets: THREE.Object3D[] = [];
  model.object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    let ancestor: THREE.Object3D | null = node;
    while (ancestor !== null) {
      if (!ancestor.visible) return;
      if (ancestor === model.object) break;
      ancestor = ancestor.parent;
    }
    targets.push(node);
  });
  return targets;
}
