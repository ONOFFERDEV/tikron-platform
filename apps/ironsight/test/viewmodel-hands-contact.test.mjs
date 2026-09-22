import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { AuthoredViewmodelHands } from "../client/viewmodel-hands.js";
import { resolveWeaponContractRoot, WeaponPresentation } from "../client/weapon-presentation.js";

const armsPath = new URL("../public/assets/ww1/characters/fp-arms.glb", import.meta.url);
const boltPath = new URL("../.inspect/ww1-art/production-candidates-v3/bolt_service_rifle/candidate.glb", import.meta.url);
globalThis.self = globalThis;

async function parse(path) {
  const bytes = await readFile(path);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
}

async function fixture() {
  const [armsGltf, weaponGltf] = await Promise.all([parse(armsPath), parse(boltPath)]);
  const hands = AuthoredViewmodelHands.fromGltf(armsGltf);
  const root = resolveWeaponContractRoot(weaponGltf.scene, "bolt_service_rifle");
  if (hands === null || root === null) throw new Error("fixture contract missing");
  const presentation = new WeaponPresentation("bolt_service_rifle", root);
  return { hands, presentation, root };
}

function state(progress) {
  return {
    weaponIndex: 3, kind: "cycle", phase: "cycle",
    startedAt: 0, phaseStartedAt: 0, endsAt: 1000, serial: 1,
    committed: 0, fireBuffered: false, serverNow: progress * 1000,
  };
}

describe("authored first-person surface contact", () => {
  it("keeps the shoulder anchored while solving the oriented moving bolt grasp", async () => {
    const { hands, presentation } = await fixture();
    const upper = hands.group.getObjectByName("upperarm_r");
    const hand = hands.group.getObjectByName("Hand_R");
    if (upper === undefined || hand === undefined) throw new Error("arm bones missing");
    const shoulder = upper.position.clone();
    for (const progress of [.1, .3, .65, .9]) {
      const action = state(progress);
      const frame = presentation.update(action, action.serverNow);
      expect(hands.apply(frame, presentation)).toBe(true);
      const target = presentation.target(frame.rightHandTarget);
      if (target === null) throw new Error("right contact missing");
      hands.group.updateWorldMatrix(true, true); target.updateWorldMatrix(true, false);
      expect(upper.position.distanceTo(shoulder)).toBeLessThan(1e-8);
      expect(hand.getWorldQuaternion(new T.Quaternion()).angleTo(
        target.getWorldQuaternion(new T.Quaternion()),
      )).toBeLessThan(1e-4);
    }
  });

  it("articulates finger chains around a grasp instead of leaving rigid claws", async () => {
    const { hands, presentation } = await fixture();
    const frame = presentation.update(null, 0);
    expect(hands.apply(frame, presentation)).toBe(true);
    const angles = ["thumb_1_r", "index_1_r", "middle_1_r", "ring_1_r", "little_1_r"]
      .map(name => hands.group.getObjectByName(name)?.quaternion.angleTo(new T.Quaternion()) ?? 0);
    expect(angles.filter(angle => angle > .2).length).toBeGreaterThanOrEqual(4);
  });

  it("keeps bolt rotation controlled through the authoritative lock window", async () => {
    const { presentation, root } = await fixture();
    const action = state(.9);
    presentation.update(action, action.serverNow);
    const bolt = root.getObjectByName("bolt");
    if (bolt === undefined) throw new Error("bolt missing");
    expect(bolt.quaternion.angleTo(new T.Quaternion())).toBeGreaterThan(.1);
  });
});
