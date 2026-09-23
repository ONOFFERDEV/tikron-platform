import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { RemoteWeapon } from "../client/remote-weapon.js";
import { acquireWeaponModel, weaponSource } from "../client/weapon-loader.js";
import { GAME } from "../src/game-config.js";
import { addWeaponPalm } from "./helpers/weapon-palm.js";

vi.mock("../client/weapon-loader.js", async importOriginal => ({
  ...await importOriginal(),
  acquireWeaponModel: vi.fn(),
}));

async function fixture(candidatePreview = false, index = 0) {
  const group = new THREE.Group(), root = new THREE.Group();
  group.add(root);
  root.userData.rifleHold = true;
  const fingers = [];
  for (const [suffix, sign] of [["R", -1], ["L", 1]]) {
    const upper = new THREE.Bone(), lower = new THREE.Bone(), hand = new THREE.Bone();
    upper.name = `UpperArm_${suffix}`;
    lower.name = `lowerarm_${suffix.toLowerCase()}`;
    hand.name = `Hand_${suffix}`;
    upper.position.set(sign * .15, 1.4, 0);
    lower.position.set(sign * .08, -.3, .1);
    hand.position.set(-sign * .1, .13, suffix === "R" ? .2 : .27);
    root.add(upper); upper.add(lower); lower.add(hand);
    addWeaponPalm(hand, suffix);
    for (const [family, count] of [["thumb", 3], ["indexFinger", 4], ["finger", 4]]) {
      let joint = hand.getObjectByName(`${family}_01_${suffix.toLowerCase()}`);
      if (!joint) throw new Error("Missing fixture palm joint");
      for (let segment = 1; segment <= count; segment += 1) {
        joint.rotation.set(.08 * segment, -.06 * sign, .12 * segment * sign);
        fingers.push({ bone: joint, side: suffix, baked: joint.quaternion.clone() });
        if (segment === count) break;
        const next = new THREE.Bone();
        next.name = `${family}_${String(segment + 1).padStart(2, "0")}_${suffix.toLowerCase()}`;
        next.position.set(0, -.025, 0);
        joint.add(next); joint = next;
      }
    }
  }

  const source = weaponSource(GAME.weaponVis, index, { candidatePreview });
  if (!source?.nodeName) throw new Error("Missing fixture weapon source");
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(.1, .12, 2);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = source.nodeName;
  scene.add(mesh);
  vi.mocked(acquireWeaponModel).mockReturnValue({
    value: Promise.resolve({ scene }), release: vi.fn(),
  });
  const weapon = new RemoteWeapon(group, root, candidatePreview);
  weapon.setWeapon(index);
  await Promise.resolve(); await Promise.resolve();
  expect(weapon.loaded).toBe(true);
  for (const finger of fingers) {
    finger.bone.rotation.y += finger.side === "L" ? .23 : -.17;
    finger.baked.copy(finger.bone.quaternion);
  }
  return {
    group, root, weapon, fingers,
    dispose() { weapon.dispose(); geometry.dispose(); material.dispose(); },
  };
}

describe("baked remote support-hand ownership", () => {
  it.each([0, Math.PI / 3, -Math.PI / 3])(
    "preserves baked support fingers when the loaded legacy weapon has no grip frame at pitch %s",
    async pitch => {
      const f = await fixture();
      try {
        expect(f.weapon.mount.getObjectByName("grip_l")).toBeUndefined();
        expect(f.weapon.mount.getObjectByName("remote-grip-l")).toBeUndefined();

        f.weapon.update(1.65, pitch, true);

        for (const { bone, side, baked } of f.fingers) {
          if (side === "L") expect(bone.quaternion.angleTo(baked), bone.name).toBeLessThan(1e-6);
        }
      } finally { f.dispose(); }
    },
  );

  it("solves candidate support contact and fingers when an oriented grip frame is loaded", async () => {
    const f = await fixture(true);
    try {
      const grip = f.weapon.mount.getObjectByName("remote-grip-l");
      const hand = f.root.getObjectByName("Hand_L");
      if (!grip || !hand) throw new Error("Missing candidate contact fixture");

      f.weapon.update(1.65, 0, true);
      f.group.updateMatrixWorld(true);

      const contact = hand.localToWorld(new THREE.Vector3(-.014, -.045, 0));
      expect(contact.distanceTo(grip.getWorldPosition(new THREE.Vector3()))).toBeLessThan(.002);
      const supportMotion = f.fingers.filter(finger => finger.side === "L")
        .map(finger => finger.bone.quaternion.angleTo(finger.baked));
      expect(Math.max(...supportMotion)).toBeGreaterThan(.1);
    } finally { f.dispose(); }
  });

  it.each([false, true])(
    "restores baked fingers and repeats without accumulated curl when candidate preview is %s",
    async candidatePreview => {
      const f = await fixture(candidatePreview);
      try {
        f.weapon.update(1.65, .4, true);
        const first = new Map(f.fingers.map(({ bone }) => [bone, bone.quaternion.clone()]));

        for (let frame = 0; frame < 4; frame += 1) {
          f.weapon.beforeAnimation();
          for (const { bone, baked } of f.fingers)
            expect(bone.quaternion.angleTo(baked), bone.name).toBeLessThan(1e-6);
          f.weapon.update(1.65, .4, true);
          for (const { bone } of f.fingers) {
            const expected = first.get(bone);
            if (!expected) throw new Error("Missing first-frame finger pose");
            expect(bone.quaternion.angleTo(expected), bone.name).toBeLessThan(1e-6);
          }
        }
      } finally { f.dispose(); }
    },
  );

  it("moves only the legacy pistol support wrist to cup the firing hand, then restores the baked pose", async () => {
    const f = await fixture(false, 4);
    try {
      const support = f.root.getObjectByName("Hand_L"), firing = f.root.getObjectByName("Hand_R");
      if (!support || !firing) throw new Error("Missing hands");
      f.group.updateMatrixWorld(true);
      const baked = support.getWorldPosition(new THREE.Vector3()), grip = firing.getWorldPosition(new THREE.Vector3());
      f.weapon.update(1.65, 0, true);
      f.group.updateMatrixWorld(true);
      const moved = support.getWorldPosition(new THREE.Vector3()).sub(baked);
      expect(moved.distanceTo(new THREE.Vector3(-.007, .005, .004))).toBeLessThan(1e-4);
      expect(firing.getWorldPosition(new THREE.Vector3()).distanceTo(grip)).toBeLessThan(1e-9);
      f.weapon.beforeAnimation(); f.group.updateMatrixWorld(true);
      expect(support.getWorldPosition(new THREE.Vector3()).distanceTo(baked)).toBeLessThan(1e-9);
    } finally { f.dispose(); }
  });
});
