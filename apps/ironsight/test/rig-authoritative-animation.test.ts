import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { cloneCalibratedPlayerRig, clonePlayerRig } from "../client/rig-loader.js";
import { HIT_ANIMATION_CLIPS, hitAnimationLocomotion } from "../src/hit-state-bucket.js";

function quaternion(angle: number): number[] {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle).toArray();
}

function fixture(): GLTF {
  const scene = new THREE.Group();
  const spine = new THREE.Bone();
  spine.name = "spine_03";
  scene.add(spine);
  const idle = new THREE.AnimationClip("rifle_idle", 2, [
    new THREE.QuaternionKeyframeTrack("spine_03.quaternion", [0, 1, 2], [
      ...quaternion(0), ...quaternion(1), ...quaternion(0),
    ]),
  ]);
  const baseIdle = idle.clone();
  baseIdle.name = "idle";
  const hit = new THREE.AnimationClip("hit_chest", 0.4, [
    new THREE.QuaternionKeyframeTrack("spine_03.quaternion", [0, 0.2, 0.4], [
      ...quaternion(0), ...quaternion(0.4), ...quaternion(0),
    ]),
  ]);
  return { scene, scenes: [scene], animations: [baseIdle, idle, hit] } as GLTF;
}

function authorityFixture(): GLTF {
  const source = fixture();
  for (const name of new Set(HIT_ANIMATION_CLIPS.map(hitAnimationLocomotion))) {
    if (source.animations.some(clip => clip.name === name)) continue;
    source.animations.push(new THREE.AnimationClip(name, 2, [
      new THREE.QuaternionKeyframeTrack("spine_03.quaternion", [0, 1, 2], [
        ...quaternion(0), ...quaternion(0.1), ...quaternion(0),
      ]),
    ]));
  }
  for (let index = 0; index < HIT_ANIMATION_CLIPS.length; index++) {
    source.animations.push(new THREE.AnimationClip(HIT_ANIMATION_CLIPS[index]!, 2, [
      new THREE.QuaternionKeyframeTrack("spine_03.quaternion", [0, 1, 2], [
        ...quaternion(0), ...quaternion((index + 1) / 40), ...quaternion(0),
      ]),
    ]));
  }
  const head = source.animations.find(clip => clip.name === "hit_chest")!.clone();
  head.name = "hit_head";
  source.animations.push(head);
  source.animations.push(new THREE.AnimationClip("death", 1, [
    new THREE.QuaternionKeyframeTrack("spine_03.quaternion", [0, 1], [
      ...quaternion(0), ...quaternion(1.2),
    ]),
  ]));
  return source;
}

describe("authoritative rig phase", () => {
  it("applies the certified normalization without measuring the rendered bounds", () => {
    const source = authorityFixture();
    source.scene.add(new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50)));
    const rig = cloneCalibratedPlayerRig(source, { feetOffsetY: 0.125, rootScale: [0.75, 0.75, 0.75], rootQuaternion: [0, 0, 0, 1], rootXZ: [0, 0] });
    expect(rig.object.scale.toArray()).toEqual([0.75, 0.75, 0.75]);
    expect(rig.object.position.toArray()).toEqual([0, 0.125, 0]);
  });
  it("reports the selected authored duration and seeks the same absolute phase repeatedly", () => {
    const rig = clonePlayerRig(fixture());
    rig.setWeaponHold(0);
    rig.setState("idle");
    expect(rig.animationDuration("idle")).toBe(2);
    rig.update(0.3, 0.5);
    const first = rig.object.getObjectByName("spine_03")!.rotation.z;
    rig.update(0.4, 0.5);
    expect(rig.object.getObjectByName("spine_03")!.rotation.z).toBeCloseTo(first, 6);
    rig.update(0, 2.5);
    expect(rig.object.getObjectByName("spine_03")!.rotation.z).toBeCloseTo(first, 6);
  });

  it("continues the additive reaction while locomotion stays on the server phase", () => {
    const rig = clonePlayerRig(fixture());
    rig.setWeaponHold(0);
    rig.setState("idle");
    rig.setState("hit_chest");
    rig.update(0.2, 0);
    expect(Math.abs(rig.object.getObjectByName("spine_03")!.rotation.z)).toBeGreaterThan(0.1);
    rig.update(0.25, 0);
    expect(rig.object.getObjectByName("spine_03")!.rotation.z).toBeCloseTo(0, 5);
  });

  it("reconstructs ordered multi-action weights and reaction age without receipt-local drift", () => {
    const rig = clonePlayerRig(authorityFixture());
    const samples = [
      { clipIndex: 0, phaseMs: 500, weight: 0.5, current: false },
      { clipIndex: 1, phaseMs: 250, weight: 0.5, current: true },
    ] as const;
    expect(rig.applyAuthoritativeAnimation(samples, { kind: 0, ageMs: 0, seq: 1 })).toBe(true);
    const base = rig.object.getObjectByName("spine_03")!.rotation.z;
    rig.update(1);
    expect(rig.applyAuthoritativeAnimation(samples, { kind: 0, ageMs: 0, seq: 1 })).toBe(true);
    expect(rig.object.getObjectByName("spine_03")!.rotation.z).toBeCloseTo(base, 6);
    expect(rig.applyAuthoritativeAnimation(samples, { kind: 1, ageMs: 200, seq: 2 })).toBe(true);
    expect(rig.object.getObjectByName("spine_03")!.rotation.z).not.toBeCloseTo(base, 3);
    expect(rig.applyAuthoritativeAnimation([...samples].reverse(), undefined)).toBe(false);
    rig.setState("death");
    rig.update(0.5);
    expect(Math.abs(rig.object.getObjectByName("spine_03")!.rotation.z)).toBeGreaterThan(0.4);
    rig.forceIdle();
    expect(rig.applyAuthoritativeAnimation(samples, undefined)).toBe(true);
  });
});
