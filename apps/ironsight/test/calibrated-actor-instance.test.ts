import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";

import { calibratedActorClaimTargets, calibratedModelHitPart, createCalibratedActorModel } from "../client/calibrated-actor-instance.js";
import type { CalibratedActorTemplate } from "../client/calibrated-actor-loader.js";
import { createCalibratedPlayerFallback } from "../client/calibrated-player-fallback.js";

function template(scene: THREE.Group): CalibratedActorTemplate {
  const normalization = {
    standHeightM: 1.8, sourceHeightM: 2.4, baseScale: 0.75, localMinY: -0.2,
    feetOffsetY: 0.15, rootScale: [0.75, 0.75, 0.75],
    rootQuaternion: [0, 0, 0, 1], rootXZ: [0.1, -0.2], modelYawOffsetRadians: 0,
  } as const;
  const rig = { label: "test-1-rig", boneCount: 1, boneNames: ["head"],
    coreBoneNames: ["head"], coreHitJoints: ["head"] } as const;
  return {
    gltf: { scene, scenes: [scene], animations: [] } as unknown as GLTF,
    source: { faction: "khaki", url: "/khaki.glb", metaUrl: "/khaki.meta.json",
      expectedGlbSha256: "a".repeat(64), expectedMetaSha256: "b".repeat(64),
      hitComponentSha256: "c".repeat(64), normalizationTransformSha256: "d".repeat(64),
      normalization, rig },
    normalization, rig, equipmentHitTarget: false,
  };
}

function skinnedBox(
  name: string,
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  materialName: string,
): THREE.SkinnedMesh {
  const geometry = new THREE.BoxGeometry(...size);
  geometry.translate(...center);
  const count = geometry.getAttribute("position").count;
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) skinWeights[index * 4] = 1;
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  const material = new THREE.MeshStandardMaterial();
  material.name = materialName;
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = name;
  const bone = new THREE.Bone();
  bone.name = `${name}-bone`;
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  return mesh;
}

describe("calibrated actor model instance", () => {
  it("uses certified normalization and preserves posed body rays while excluding equipment", () => {
    const source = new THREE.Group();
    source.add(
      skinnedBox("body", [0, 1, 0], [0.3, 0.6, 0.24], "wool"),
      skinnedBox("arm", [0.55, 1, 0], [0.18, 0.7, 0.18], "wool"),
      skinnedBox("equipment", [-0.55, 1, 0], [0.22, 0.5, 0.22], "helmet"),
    );
    source.traverse(node => {
      if (node instanceof THREE.Mesh) node.userData.fieldEquipmentRaycast = true;
    });

    const model = createCalibratedActorModel(template(source));
    model.object.updateMatrixWorld(true);
    const fallback = createCalibratedPlayerFallback({ id: "target", faction: "khaki", bodyRadius: 0.3 });
    if (fallback === undefined) throw new Error("calibrated fallback fixture rejected");
    const targets = calibratedActorClaimTargets(true, model, fallback);

    expect(model.object.scale.toArray()).toEqual([0.75, 0.75, 0.75]);
    expect(model.object.position.toArray()).toEqual([0.1, 0.15, -0.2]);
    const ray = (x: number, y: number) => new THREE.Raycaster(
      new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1), 0, 10,
    ).intersectObjects([...targets], false);
    expect(ray(0.5125, 0.9)[0]?.object.name).toBe("arm");
    expect(ray(-0.3125, 0.9)).toHaveLength(0);
    expect(ray(0.1, 0.3)).toHaveLength(0);

    model.dispose();
    fallback.dispose();
  });

  it("classifies actual model intersections against the evaluator head sphere", () => {
    const sample = { hitVolume: { headCenter: { x: 0.04, y: 1.58, z: -0.02 }, bodyTopY: 1.35 },
      headRadius: 0.13, bodyRadiusUpperBound: 0.4, groundOffsetY: 0.15 };
    expect(calibratedModelHitPart(sample, new THREE.Vector3(0.04, 1.6, -0.02))).toBe("head");
    expect(calibratedModelHitPart(sample, new THREE.Vector3(0.04, 1.4, -0.02))).toBe("body");
  });
  it("removes hidden or invalid actors from claims and swaps proxies for the visible model", () => {
    const fallback = createCalibratedPlayerFallback({ id: "target", faction: "khaki", bodyRadius: 0.3 });
    if (fallback === undefined) throw new Error("calibrated fallback fixture rejected");
    const source = new THREE.Group();
    source.add(skinnedBox("body", [0, 1, 0], [0.3, 0.6, 0.24], "wool"));
    const model = createCalibratedActorModel(template(source));

    expect(calibratedActorClaimTargets(false, undefined, fallback)).toEqual([]);
    expect(calibratedActorClaimTargets(true, undefined, fallback)).toEqual([fallback.body, fallback.head]);
    const hiddenLod = new THREE.Group();
    hiddenLod.visible = false;
    const hiddenMesh = skinnedBox("LOD1-body", [0, 1, 0], [1, 1, 1], "wool");
    hiddenLod.add(hiddenMesh);
    model.object.add(hiddenLod);
    expect(calibratedActorClaimTargets(true, model, fallback)).not.toContain(hiddenMesh);

    model.dispose();
    fallback.dispose();
  });

});
