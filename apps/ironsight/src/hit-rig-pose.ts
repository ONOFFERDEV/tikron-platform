import * as THREE from "three";
import type { HitAnimationActionSample, HitReactionSample } from "./hit-animation-timeline.js";
import type { SoldierHitVolume } from "./hit-calibration.js";
import type { Stage33HitIdentity, Stage33Faction } from "./stage33-hit-calibration.js";
import { HIT_ANIMATION_CLIPS } from "./hit-state-bucket.js";
import {
  HIT_RIG_COMPONENT_SHA256,
  HIT_RIG_NORMALIZATION_SHA256,
  HIT_RIG_POSE_DATA,
  type HitRigClipData,
} from "./hit-rig-pose-data.js";

export interface HitRigPoseSampleInput {
  readonly identity: Stage33HitIdentity;
  readonly actions: readonly HitAnimationActionSample[];
  readonly reaction?: HitReactionSample;
}
export interface HitRigPoseSample {
  readonly hitVolume: SoldierHitVolume;
  readonly headRadius: number;
  readonly bodyRadiusUpperBound: number;
  readonly groundOffsetY: number;
}

const DATA = HIT_RIG_POSE_DATA;
const FOOT_NAMES = ["Foot_L", "Foot_R", "ball_l", "ball_r", "toes_l", "toes_r"] as const;
const REACTION_NAMES = { 1: "hit_chest", 2: "hit_head" } as const;

type Evaluator = ReturnType<typeof createEvaluator>;
const evaluators = new Map<Stage33Faction, Evaluator>();

function vec3(values: readonly number[]): THREE.Vector3 {
  return new THREE.Vector3(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
}
function quaternion(values: readonly number[]): THREE.Quaternion {
  return new THREE.Quaternion(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1);
}
function matrix(values: readonly number[]): THREE.Matrix4 {
  return new THREE.Matrix4().fromArray(Array.from(values));
}
function clip(name: string, value: HitRigClipData): THREE.AnimationClip {
  const tracks = value.tracks.map((track) => {
    const times = Array.from(track.times), values = Array.from(track.values);
    if (track.type === "quaternion")
      return new THREE.QuaternionKeyframeTrack(track.name, times, values);
    if (track.type === "vector") return new THREE.VectorKeyframeTrack(track.name, times, values);
    return new THREE.NumberKeyframeTrack(track.name, times, values);
  });
  return new THREE.AnimationClip(name, value.duration, tracks);
}
function requiredBone(bones: ReadonlyMap<string, THREE.Bone>, name: string): THREE.Bone | undefined {
  return bones.get(name);
}

function createEvaluator(faction: Stage33Faction) {
  const source = DATA.factions[faction],
    root = new THREE.Group(),
    bones = new Map<string, THREE.Bone>();
  for (const item of DATA.rig.bones) {
    const bone = new THREE.Bone();
    bone.name = item.name;
    bone.position.copy(vec3(item.position));
    bone.quaternion.copy(quaternion(item.quaternion));
    bone.scale.copy(vec3(item.scale));
    bones.set(item.name, bone);
  }
  for (const item of DATA.rig.bones) {
    const bone = requiredBone(bones, item.name);
    if (!bone) return undefined;
    const parent = item.parent === null ? undefined : bones.get(item.parent);
    if (item.parent !== null && !parent) return undefined;
    (parent ?? root).add(bone);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(source.torso.positions, 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(source.torso.joints, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(source.torso.weights, 4));
  const orderedBones: THREE.Bone[] = [];
  for (const item of DATA.rig.bones) {
    const bone = requiredBone(bones, item.name);
    if (!bone) return undefined;
    orderedBones.push(bone);
  }
  const skeleton = new THREE.Skeleton(orderedBones, DATA.rig.boneInverses.map(matrix));
  const torso = new THREE.SkinnedMesh(geometry);
  torso.matrixAutoUpdate = false;
  torso.matrix.copy(matrix(DATA.rig.meshMatrix));
  torso.bind(skeleton, matrix(DATA.rig.bindMatrix));
  root.add(torso);
  root.scale.setScalar(source.baseScale);
  root.position.y = -source.localMinY * source.baseScale;
  root.updateMatrixWorld(true);
  const clips = new Map<string, THREE.AnimationClip>(),
    mixer = new THREE.AnimationMixer(root);
  for (const [name, value] of Object.entries(DATA.rig.clips)) clips.set(name, clip(name, value));
  const reactionClips = new Map<string, THREE.AnimationClip>();
  for (const name of ["hit_chest", "hit_head"]) {
    const sourceClip = clips.get(name);
    if (!sourceClip) return undefined;
    const additive = sourceClip.clone();
    additive.tracks = additive.tracks.filter((track) =>
      /^(spine_0[123]|neck_01|head)\.quaternion$/.test(track.name),
    );
    THREE.AnimationUtils.makeClipAdditive(additive, 0, sourceClip);
    reactionClips.set(name, additive);
  }
  const rest = DATA.rig.bones.map((item) => ({
    bone: requiredBone(bones, item.name),
    position: vec3(item.position),
    quaternion: quaternion(item.quaternion),
    scale: vec3(item.scale),
  }));
  if (rest.some(item => item.bone === undefined)) return undefined;
  return {
    source,
    root,
    bones,
    torso,
    mixer,
    clips,
    reactionClips,
    rest: rest.flatMap(item => item.bone ? [{ ...item, bone: item.bone }] : []),
    point: new THREE.Vector3(),
  };
}

function identityFaction(identity: Stage33HitIdentity): Stage33Faction | undefined {
  const faction = identity.faction,
    source = DATA.factions[faction];
  return source !== undefined &&
    identity.glbSha256 === source.glbSha256 &&
    identity.hitComponentSha256 === HIT_RIG_COMPONENT_SHA256[faction] &&
    identity.normalizationTransformSha256 === HIT_RIG_NORMALIZATION_SHA256
    ? faction
    : undefined;
}

function validActions(actions: readonly HitAnimationActionSample[]): boolean {
  if (actions.length === 0 || actions.length > HIT_ANIMATION_CLIPS.length) return false;
  const seen = new Set<number>();
  let current = 0;
  for (let index = 0; index < actions.length; index++) {
    const action = actions[index];
    if (!action) return false;
    if (
      !Number.isInteger(action.clipIndex) ||
      action.clipIndex < 0 ||
      action.clipIndex >= HIT_ANIMATION_CLIPS.length ||
      seen.has(action.clipIndex) ||
      !Number.isFinite(action.phaseMs) ||
      action.phaseMs < 0 ||
      !Number.isFinite(action.weight) ||
      action.weight < 0 ||
      action.weight > 1 ||
      (action.current && index !== actions.length - 1)
    )
      return false;
    seen.add(action.clipIndex);
    if (action.current) current++;
  }
  return current === 1;
}

export function sampleStage33HitRigPose(
  input: HitRigPoseSampleInput,
): HitRigPoseSample | undefined {
  const faction = identityFaction(input.identity);
  if (faction === undefined || !validActions(input.actions)) return undefined;
  const evaluator = evaluators.get(faction) ?? createEvaluator(faction);
  if (!evaluator) return undefined;
  evaluators.set(faction, evaluator);
  evaluator.mixer.stopAllAction();
  for (const item of evaluator.rest) {
    item.bone.position.copy(item.position);
    item.bone.quaternion.copy(item.quaternion);
    item.bone.scale.copy(item.scale);
  }
  evaluator.root.position.y = -evaluator.source.localMinY * evaluator.source.baseScale;
  for (const sample of input.actions) {
    const name = HIT_ANIMATION_CLIPS[sample.clipIndex];
    if (!name) return undefined;
    const source = evaluator.clips.get(name);
    if (!source) return undefined;
    const action = evaluator.mixer.clipAction(source);
    action.reset().setEffectiveWeight(sample.weight).play();
    action.time = (sample.phaseMs / 1000) % source.duration;
  }
  if (input.reaction && input.reaction.kind !== 0) {
    const name = REACTION_NAMES[input.reaction.kind];
    if (!name || !Number.isFinite(input.reaction.ageMs) || input.reaction.ageMs < 0)
      return undefined;
    const source = evaluator.reactionClips.get(name);
    if (!source) return undefined;
    const age = input.reaction.ageMs / 1000;
    if (age < source.duration) {
      const action = evaluator.mixer.clipAction(source);
      action
        .reset()
        .setEffectiveWeight(0.7 * Math.min(1, age / 0.035, (source.duration - age) / 0.09))
        .play();
      action.time = age;
    }
  }
  evaluator.mixer.update(0);
  evaluator.root.updateMatrixWorld(true);
  let footY = Infinity;
  for (const name of FOOT_NAMES) {
    const foot = requiredBone(evaluator.bones, name);
    if (!foot) return undefined;
    footY = Math.min(footY, foot.getWorldPosition(evaluator.point).y);
  }
  const baseY = -evaluator.source.localMinY * evaluator.source.baseScale,
    hasCrouchWeight = input.actions.some(sample => sample.weight > 0
      && HIT_ANIMATION_CLIPS[sample.clipIndex]?.includes("_crouch_") === true),
    groundOffsetY = hasCrouchWeight ? baseY - Math.max(0, footY - 0.035) : baseY;
  evaluator.root.position.y = groundOffsetY;
  evaluator.root.updateMatrixWorld(true);
  const head = requiredBone(evaluator.bones, "head");
  if (!head) return undefined;
  const
    headCenter = head.localToWorld(vec3(evaluator.source.headLocalCenter)),
    headScale = head.getWorldScale(evaluator.point),
    headRadius = evaluator.source.headLocalRadius * Math.max(headScale.x, headScale.y, headScale.z);
  const positions = evaluator.torso.geometry.getAttribute("position");
  let bodyTopY = -Infinity,
    bodyRadiusUpperBound = 0;
  evaluator.torso.skeleton.update();
  for (let vertex = 0; vertex < positions.count; vertex++) {
    evaluator.point.fromBufferAttribute(positions, vertex);
    evaluator.torso.applyBoneTransform(vertex, evaluator.point);
    evaluator.torso.localToWorld(evaluator.point);
    bodyTopY = Math.max(bodyTopY, evaluator.point.y);
    bodyRadiusUpperBound = Math.max(
      bodyRadiusUpperBound,
      Math.hypot(evaluator.point.x, evaluator.point.z),
    );
  }
  return {
    hitVolume: { headCenter: { x: headCenter.x, y: headCenter.y, z: headCenter.z }, bodyTopY },
    headRadius,
    bodyRadiusUpperBound,
    groundOffsetY,
  };
}
