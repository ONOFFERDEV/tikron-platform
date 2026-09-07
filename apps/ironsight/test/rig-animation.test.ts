import * as T from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { clonePlayerRig } from '../client/rig-loader.js';

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
});
