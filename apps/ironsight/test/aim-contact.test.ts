import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { RemoteWeapon } from '../client/remote-weapon.js';

function fixture() {
  const group = new T.Group(), root = new T.Group(); group.add(root); root.userData.rifleHold = true;
  group.position.set(12, 0, 18); group.rotation.y = 0.7;
  const bones: T.Bone[] = [];
  for (const [suffix, sign] of [['R', -1], ['L', 1]] as const) {
    const upper = new T.Bone(), lower = new T.Bone(), hand = new T.Bone();
    upper.name = `UpperArm_${suffix}`; lower.name = `lowerarm_${suffix.toLowerCase()}`; hand.name = `Hand_${suffix}`;
    upper.position.set(sign * 0.15, 1.4, 0);
    lower.position.set(sign * 0.08, -0.30, 0.10);
    hand.position.set(-sign * 0.10, 0.13, suffix === 'R' ? 0.20 : 0.27);
    root.add(upper); upper.add(lower); lower.add(hand); bones.push(upper, lower, hand);
  }
  const head = new T.Object3D(); head.position.set(0, 1.65, 0); root.add(head);
  group.updateMatrixWorld(true);
  const weapon = new RemoteWeapon(group, root);
  const poses = bones.map(b => ({ p: b.position.clone(), q: b.quaternion.clone() }));
  return { group, root, bones, weapon, head, poses };
}

describe('rifle aim contact and pose ownership', () => {
  it('does not accumulate aim into locomotion or change the head hit silhouette', () => {
    const { group, weapon, bones, poses, head } = fixture();
    const headAt = head.getWorldPosition(new T.Vector3());
    for (let i = 0; i < 120; i++) {
      weapon.update(1.65, Math.sin(i) * Math.PI / 2, true);
      expect(head.getWorldPosition(new T.Vector3()).distanceTo(headAt)).toBeLessThan(1e-8);
      weapon.beforeAnimation(); group.updateMatrixWorld(true);
      bones.forEach((bone, j) => {
        expect(bone.position.distanceTo(poses[j]!.p)).toBeLessThan(1e-8);
        expect(bone.quaternion.angleTo(poses[j]!.q)).toBeLessThan(1e-7);
      });
    }
    weapon.dispose();
  });

  it('keeps the support wrist in the calibrated gun frame across the full pitch range', () => {
    const { weapon, bones } = fixture();
    const support = bones[5]!;
    weapon.update(1.65, 0, true);
    const neutral = weapon.mount.worldToLocal(support.getWorldPosition(new T.Vector3()));
    for (const pitch of [-Math.PI / 2, -1, -0.25, 0.25, 1, Math.PI / 2]) {
      weapon.beforeAnimation(); weapon.update(1.65, pitch, true);
      const contact = weapon.mount.worldToLocal(support.getWorldPosition(new T.Vector3()));
      expect(contact.distanceTo(neutral)).toBeLessThan(0.001);
    }
    weapon.dispose();
  });

  it('restores hands before a reaction, death, or non-rifle fallback takes ownership', () => {
    const { weapon, bones, poses, root } = fixture();
    weapon.update(1.65, -1.4, true); weapon.beforeAnimation();
    root.userData.rifleHold = false; weapon.update(1.65, 0.5, false);
    bones.forEach((bone, j) => expect(bone.quaternion.angleTo(poses[j]!.q)).toBeLessThan(1e-7));
    weapon.dispose();
  });
  it('crosses neutral aim continuously without snapping the authored elbows', () => {
    const { weapon, bones } = fixture();
    weapon.update(1.65, 0, true);
    const neutral = bones.map(b => b.quaternion.clone());
    for (const pitch of [-0.0002, 0.0002]) {
      weapon.beforeAnimation(); weapon.update(1.65, pitch, true);
      bones.forEach((bone, i) => expect(bone.quaternion.angleTo(neutral[i]!)).toBeLessThan(0.002));
    }
    weapon.dispose();
  });
});
