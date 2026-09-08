import * as T from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { clonePlayerRig, deathPresentationMs } from '../client/rig-loader.js';

function asset(rifle = true): GLTF {
  const scene = new T.Group(), arm = new T.Bone(); arm.name = 'UpperArm_R'; scene.add(arm);
  const clip = (name: string, angle: number) => {
    const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), angle).toArray();
    return new T.AnimationClip(name, 1, [new T.QuaternionKeyframeTrack('UpperArm_R.quaternion', [0, 1], [...q, ...q])]);
  };
  return { scene, animations: [clip('idle', 0), clip('walk', 0.2), clip('death', -0.8),
    ...(rifle ? [clip('rifle_idle', 0.8), clip('rifle_walk', 1)] : [])] } as GLTF;
}
const rotation = (rig: ReturnType<typeof clonePlayerRig>) => rig.object.getObjectByName('UpperArm_R')!.rotation.z;
describe('authored rifle clip lifecycle', () => {
  it('poses independent instances without modifying the cached original', () => {
    const source = asset(), a = clonePlayerRig(source), b = clonePlayerRig(source);
    a.forceIdle(); a.update(0.3); b.setRifleHold(false); b.forceIdle(); b.update(0.3);
    expect(rotation(a)).toBeCloseTo(0.8); expect(rotation(b)).toBeCloseTo(0);
    expect(source.scene.getObjectByName('UpperArm_R')!.rotation.z).toBe(0);
  });
  it('crossfades to rifle locomotion and restores it after death/respawn', () => {
    const rig = clonePlayerRig(asset()); rig.setState('walk'); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(1);
    rig.setState('death'); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(-0.8);
    rig.setState('walk'); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(-0.8);
    rig.forceIdle(); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(0.8);
  });
  it('a legacy private asset without rifle clips remains usable', () => {
    const rig = clonePlayerRig(asset(false)); rig.forceIdle(); rig.update(0.3);
    expect(rotation(rig)).toBeCloseTo(0); expect(rig.object.userData.rifleHold).toBe(false);
    rig.setState('walk'); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(0.2);
  });
  it('uses legacy walk for a missing directional clip without inventing reactions', () => {
    const rig = clonePlayerRig(asset(false));
    rig.setState('strafe_left'); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(0.2);
    expect(rig.hasHitChestClip).toBe(false); expect(rig.hasHitHeadClip).toBe(false);
    expect(rig.hasSprintClip).toBe(false); expect(rig.hasCrouchClips).toBe(false);
  });
  it('selects each authored weapon hold and restores its idle after death', () => {
    const source = asset();
    for (const [i, prefix] of ['smg', 'shotgun', 'sniper', 'pistol'].entries()) {
      const clip = source.animations.find(c => c.name === 'rifle_idle')!.clone();
      clip.name = `${prefix}_idle`;
      const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), 0.3 + i * 0.1).toArray();
      clip.tracks[0]!.values = Float32Array.from([...q, ...q]); source.animations.push(clip);
    }
    const rig = clonePlayerRig(source);
    for (let index = 1; index <= 4; index++) {
      rig.setWeaponHold(index); rig.forceIdle(); rig.update(0.3);
      expect(rotation(rig)).toBeCloseTo(0.2 + index * 0.1);
      expect(rig.object.userData.rifleHold).toBe(true);
      rig.setState('death'); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(-0.8);
      rig.forceIdle(); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(0.2 + index * 0.1);
    }
  });
  it('never applies a rifle pose to a missing alternate hold in older assets', () => {
    const rig = clonePlayerRig(asset()); rig.setWeaponHold(4); rig.forceIdle(); rig.update(0.3);
    expect(rig.object.userData.rifleHold).toBe(false); expect(rotation(rig)).toBeCloseTo(0);
    rig.setWeaponHold(0); rig.forceIdle(); rig.update(0.3); expect(rotation(rig)).toBeCloseTo(0.8);
  });

});

function reactionAsset(): GLTF {
  const scene = new T.Group();
  for (const name of ['spine_03', 'head', 'Thigh_R', 'Hand_R', 'Pelvis']) {
    const bone = new T.Bone(); bone.name = name; scene.add(bone);
  }
  const track = (name: string, angles: number[]) => new T.QuaternionKeyframeTrack(`${name}.quaternion`,
    [0, 0.12, 0.4], angles.flatMap(a => new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), a).toArray()));
  const base = (name: string, leg: number) => new T.AnimationClip(name, 0.4, [
    track('spine_03', [0, 0, 0]), track('head', [0, 0, 0]), track('Thigh_R', [leg, leg, leg]),
    track('Hand_R', [0.6, 0.6, 0.6])]);
  const hit = new T.AnimationClip('hit_chest', 0.4, [track('spine_03', [0, 0.3, 0]),
    track('Thigh_R', [0, 1.5, 0]), track('Hand_R', [0, 1.5, 0]),
    new T.VectorKeyframeTrack('Pelvis.position', [0, 0.4], [0, 0, 0, 0, 2, 0])]);
  const head = hit.clone(); head.name = 'hit_head'; head.tracks.push(track('head', [0, 0.4, 0]));
  return { scene, animations: [base('idle', 0), base('crouch_idle', 0.8), base('walk', 0.4),
    base('death', -0.8), hit, head] } as GLTF;
}
const boneAngle = (rig: ReturnType<typeof clonePlayerRig>, name: string) => rig.object.getObjectByName(name)!.rotation.z;
describe('upper-body impact layer', () => {
  it('keeps crouch, weapon-hand rotations and root translation while reacting', () => {
    const rig = clonePlayerRig(reactionAsset()); rig.setState('crouch_idle'); rig.update(0.2);
    rig.setState('hit_chest'); rig.update(0.12);
    expect(boneAngle(rig, 'spine_03')).toBeGreaterThan(0.15);
    expect(boneAngle(rig, 'Thigh_R')).toBeCloseTo(0.8);
    expect(boneAngle(rig, 'Hand_R')).toBeCloseTo(0.6);
    expect(rig.object.getObjectByName('Pelvis')!.position.y).toBe(0);
  });
  it('allows locomotion changes during a hit and returns to that current pose', () => {
    const rig = clonePlayerRig(reactionAsset()); rig.forceIdle();
    rig.setState('hit_chest'); rig.setState('walk'); rig.update(0.2);
    expect(boneAngle(rig, 'Thigh_R')).toBeCloseTo(0.4);
    expect(boneAngle(rig, 'spine_03')).toBeGreaterThan(0);
    rig.update(0.25); expect(boneAngle(rig, 'spine_03')).toBeCloseTo(0);
    expect(boneAngle(rig, 'Thigh_R')).toBeCloseTo(0.4);
  });
  it('does not stack rapid hits, distinguishes headshots, and cancels on death/respawn', () => {
    const rig = clonePlayerRig(reactionAsset()); rig.forceIdle();
    for (let i = 0; i < 10; i++) { rig.setState('hit_head'); rig.update(0.12); }
    expect(boneAngle(rig, 'spine_03')).toBeCloseTo(0.21);
    expect(boneAngle(rig, 'head')).toBeCloseTo(0.28);
    rig.setState('death'); rig.update(0.2); rig.setState('hit_head'); rig.update(0.12);
    expect(boneAngle(rig, 'spine_03')).toBeCloseTo(0);
    expect(boneAngle(rig, 'Thigh_R')).toBeCloseTo(-0.8);
    rig.forceIdle(); rig.update(0.12); expect(boneAngle(rig, 'head')).toBeCloseTo(0);
  });
  it('keeps shared source clips immutable and per-player reactions independent', () => {
    const source = reactionAsset(), before = JSON.stringify(source.animations);
    const a = clonePlayerRig(source), b = clonePlayerRig(source);
    a.forceIdle(); b.forceIdle(); a.setState('hit_chest'); a.update(0.12); b.update(0.12);
    expect(boneAngle(b, 'spine_03')).toBeCloseTo(0);
    expect(JSON.stringify(source.animations)).toBe(before);
  });
  it('shows the full 2.4-second death clip plus its settle, bounded to three seconds', () => {
    expect(deathPresentationMs(2.4)).toBe(2650);
    expect(deathPresentationMs(8)).toBe(3000);
    expect(deathPresentationMs(undefined)).toBe(1200);
  });
});

it('samples the lowest transformed death support joint without changing the pose', () => {
  const source = reactionAsset();
  source.scene.getObjectByName('Pelvis')!.position.y = 0.7;
  source.scene.getObjectByName('spine_03')!.position.y = 1;
  source.scene.getObjectByName('head')!.position.y = 1.5;
  source.scene.getObjectByName('Hand_R')!.position.y = 0.4;
  const rig = clonePlayerRig(source); rig.object.position.y = 3;
  expect(rig.getBodySupportWorldY()).toBeCloseTo(3.4);
  expect(rig.object.position.y).toBe(3);
  expect(rig.object.getObjectByName('Hand_R')!.position.y).toBe(0.4);
});
