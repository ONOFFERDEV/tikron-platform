import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WeaponPresentation, WeaponPresentationFrame } from './weapon-presentation.js';
export { ViewmodelHands } from "./procedural-viewmodel-hands.js";

export type SleeveFaction = 'khaki' | 'fieldgrey';
export const FP_ARMS_URL = '/assets/ww1/characters/fp-arms.glb';
const AUTHORED_TARGETS = ['ik_hand_root', 'ik_hand_gun', 'ik_hand_l', 'ik_hand_r'] as const;
const AUTHORED_BONES = ['root', 'upperarm_l', 'lowerarm_l', 'Hand_L', 'upperarm_r', 'lowerarm_r', 'Hand_R'] as const;
const AUTHORED_CLIPS = ['equip', 'ready', 'ads_in', 'ads_out', 'fire', 'sprint_in', 'sprint_out', 'reload'] as const;
type AuthoredClip = (typeof AUTHORED_CLIPS)[number];
export type AuthoredMotionInput = {
  readonly actionActive: boolean;
  readonly equipProgress: number | null;
  readonly adsProgress: number;
  readonly adsHeld: boolean;
  readonly recoil: number;
  readonly sprintBlend: number;
};
const authoredSources = new Map<string, Promise<GLTF | null>>();

type AuthoredTransform = {
  readonly node: T.Object3D;
  readonly position: T.Vector3;
  readonly quaternion: T.Quaternion;
  readonly scale: T.Vector3;
};

function uniqueNode(root: T.Object3D, name: string): T.Object3D | null {
  const matches: T.Object3D[] = [];
  root.traverse(node => { if (node.name === name) matches.push(node); });
  return matches.length === 1 ? matches.at(0) ?? null : null;
}

function contractNode(root: T.Object3D, name: string): T.Object3D {
  const node = uniqueNode(root, name);
  if (node === null) throw new Error('invalid_fp_arms_contract');
  return node;
}

type ArmChain = {
  readonly side: -1 | 1;
  readonly upper: T.Object3D;
  readonly lower: T.Object3D;
  readonly hand: T.Object3D;
  readonly upperAxis: T.Vector3;
  readonly lowerAxis: T.Vector3;
  readonly fingers: Readonly<Record<"thumb" | "index" | "middle" | "ring" | "little", readonly T.Object3D[]>>;
};

export class AuthoredViewmodelHands {
  readonly group: T.Object3D;
  readonly clips: readonly T.AnimationClip[];
  private readonly mixer: T.AnimationMixer;
  private readonly actions: ReadonlyMap<string, T.AnimationAction>;
  private readonly targets: Readonly<Record<(typeof AUTHORED_TARGETS)[number], T.Object3D>>;
  private readonly armBones: readonly [ArmChain, ArmChain];
  private readonly initialPose: readonly AuthoredTransform[];
  private readonly world = new T.Vector3();
  private readonly shoulder = new T.Vector3();
  private readonly elbow = new T.Vector3();
  private readonly direction = new T.Vector3();
  private readonly pole = new T.Vector3();
  private readonly parentWorld = new T.Quaternion();
  private readonly targetWorld = new T.Quaternion();
  private currentClip: AuthoredClip = "ready";
  private previousSprintBlend = 0;

  private constructor(gltf: GLTF) {
    const scene = cloneSkeleton(gltf.scene);
    const authoredRoot = uniqueNode(scene, 'ironsight-fp-arms');
    if (authoredRoot === null) throw new Error('invalid_fp_arms_contract');
    this.group = authoredRoot;
    this.clips = gltf.animations;
    this.mixer = new T.AnimationMixer(this.group);
    this.actions = new Map(this.clips.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    const clips = new Set(this.clips.map(clip => clip.name));
    let skinnedMeshes = 0;
    this.group.traverse(node => { if (node instanceof T.SkinnedMesh) skinnedMeshes += 1; });
    if (AUTHORED_BONES.some(name => uniqueNode(this.group, name) === null)
      || AUTHORED_CLIPS.some(name => !clips.has(name)) || clips.size !== AUTHORED_CLIPS.length || skinnedMeshes === 0) throw new Error('invalid_fp_arms_contract');
    this.targets = {
      ik_hand_root: contractNode(this.group, 'ik_hand_root'),
      ik_hand_gun: contractNode(this.group, 'ik_hand_gun'),
      ik_hand_l: contractNode(this.group, 'ik_hand_l'),
      ik_hand_r: contractNode(this.group, 'ik_hand_r'),
    };
    const fingerNodes = (suffix: "l" | "r"): ArmChain["fingers"] => ({
      thumb: [1, 2, 3].map(segment => contractNode(this.group, `thumb_${segment}_${suffix}`)),
      index: [1, 2, 3].map(segment => contractNode(this.group, `index_${segment}_${suffix}`)),
      middle: [1, 2, 3].map(segment => contractNode(this.group, `middle_${segment}_${suffix}`)),
      ring: [1, 2, 3].map(segment => contractNode(this.group, `ring_${segment}_${suffix}`)),
      little: [1, 2, 3].map(segment => contractNode(this.group, `little_${segment}_${suffix}`)),
    });
    const chain = (suffix: "l" | "r", side: -1 | 1): ArmChain => ({
      side,
      upper: contractNode(this.group, `upperarm_${suffix}`),
      lower: contractNode(this.group, `lowerarm_${suffix}`),
      hand: contractNode(this.group, `Hand_${suffix.toUpperCase()}`),
      upperAxis: contractNode(this.group, `lowerarm_${suffix}`).position.clone().normalize(),
      lowerAxis: contractNode(this.group, `Hand_${suffix.toUpperCase()}`).position.clone().normalize(),
      fingers: fingerNodes(suffix),
    });
    this.armBones = [chain("l", -1), chain("r", 1)];
    const initialPose: AuthoredTransform[] = [];
    this.group.traverse(node => initialPose.push({ node, position: node.position.clone(),
      quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
    this.initialPose = initialPose;
    this.group.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      node.material = Array.isArray(node.material) ? node.material.map(material => material.clone()) : node.material.clone();
    });
    this.reset();
  }

  static fromGltf(gltf: GLTF): AuthoredViewmodelHands | null {
    try { return new AuthoredViewmodelHands(gltf); } catch { return null; }
  }

  setFaction(faction: SleeveFaction): void {
    const color = faction === 'khaki' ? 0x574d30 : 0x3b4a45;
    this.group.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) if (material.name.startsWith('Sleeve_') && material instanceof T.MeshStandardMaterial) material.color.setHex(color);
    });
  }

  apply(frame: WeaponPresentationFrame, weapon: WeaponPresentation): boolean {
    this.reset();
    if (frame.mode !== 'contract') return false;
    const left = weapon.target(frame.leftHandTarget), right = weapon.target(frame.rightHandTarget);
    const sockets = weapon.sockets;
    if (left === null || right === null || sockets === null) return false;
    this.sample(frame.animationClip, frame.animationProgress);
    this.place(this.targets.ik_hand_l, left); this.place(this.targets.ik_hand_r, right);
    this.place(this.targets.ik_hand_gun, sockets.gripRight);
    this.solveArm(this.armBones[0], left); this.solveArm(this.armBones[1], right);
    this.poseFingers(this.armBones[0], frame.leftHandTarget);
    this.poseFingers(this.armBones[1], frame.rightHandTarget);
    return true;
  }

  get activeClip(): AuthoredClip { return this.currentClip; }

  animateMotion(input: AuthoredMotionInput): void {
    if (input.actionActive) return;
    if (input.equipProgress !== null) this.sample("equip", input.equipProgress);
    else if (input.recoil > .02) this.sample("fire", 1 - Math.min(1, input.recoil));
    else if (input.adsHeld && input.adsProgress < 1) this.sample("ads_in", input.adsProgress);
    else if (!input.adsHeld && input.adsProgress > 0) this.sample("ads_out", 1 - input.adsProgress);
    else if (input.sprintBlend > this.previousSprintBlend) this.sample("sprint_in", input.sprintBlend);
    else if (input.sprintBlend > 0 && input.sprintBlend < this.previousSprintBlend) this.sample("sprint_out", 1 - input.sprintBlend);
    else this.sample("ready", .5);
    this.previousSprintBlend = input.sprintBlend;
  }

  reset(): void {
    this.mixer.stopAllAction();
    for (const pose of this.initialPose) {
      pose.node.position.copy(pose.position);
      pose.node.quaternion.copy(pose.quaternion);
      pose.node.scale.copy(pose.scale);
    }
    this.sample("ready", .5);
  }

  private sample(name: AuthoredClip, progress: number): void {
    const action = this.actions.get(name);
    if (action === undefined) return;
    this.mixer.stopAllAction();
    action.reset(); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true;
    action.play(); action.paused = true; action.time = action.getClip().duration * progress;
    this.mixer.update(0); this.currentClip = name;
  }

  private place(target: T.Object3D, source: T.Object3D): void {
    source.updateWorldMatrix(true, false); this.group.updateWorldMatrix(true, false);
    source.getWorldPosition(this.world); target.position.copy(this.group.worldToLocal(this.world));
  }

  private solveArm(arm: (typeof this.armBones)[number], source: T.Object3D): void {
    source.updateWorldMatrix(true, false); this.group.updateWorldMatrix(true, true);
    source.getWorldPosition(this.world);
    arm.upper.getWorldPosition(this.shoulder);
    const upperLength = arm.lower.position.length(), lowerLength = arm.hand.position.length();
    this.direction.subVectors(this.world, this.shoulder);
    const distance = Math.min(upperLength + lowerLength - 1e-5,
      Math.max(Math.abs(upperLength - lowerLength) + 1e-5, this.direction.length()));
    this.direction.normalize();
    const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    source.getWorldQuaternion(this.targetWorld);
    this.pole.set(0, 1, 0).applyQuaternion(this.targetWorld).multiplyScalar(lowerLength)
      .add(this.world).addScaledVector(this.shoulder, -1).addScaledVector(this.direction, -along);
    this.pole.addScaledVector(this.direction, -this.pole.dot(this.direction));
    if (this.pole.lengthSq() < 1e-8) this.pole.set(arm.side, -1, -.15)
      .applyQuaternion(this.group.getWorldQuaternion(this.targetWorld))
      .addScaledVector(this.direction, -this.pole.dot(this.direction));
    this.elbow.copy(this.shoulder).addScaledVector(this.direction, along)
      .addScaledVector(this.pole.normalize(), height);
    arm.upper.parent!.getWorldQuaternion(this.parentWorld);
    this.direction.subVectors(this.elbow, this.shoulder).normalize().applyQuaternion(this.parentWorld.invert());
    arm.upper.quaternion.setFromUnitVectors(arm.upperAxis, this.direction);
    this.group.updateWorldMatrix(true, true);
    arm.lower.getWorldPosition(this.elbow);
    source.getWorldPosition(this.world);
    arm.lower.getWorldQuaternion(this.parentWorld);
    this.direction.subVectors(this.world, this.elbow).normalize().applyQuaternion(this.parentWorld.invert());
    arm.lower.quaternion.setFromUnitVectors(arm.lowerAxis, this.direction);
    this.group.updateWorldMatrix(true, true);
    source.getWorldQuaternion(this.targetWorld);
    arm.hand.parent!.getWorldQuaternion(this.parentWorld);
    arm.hand.quaternion.copy(this.parentWorld.invert().multiply(this.targetWorld));
    this.group.updateWorldMatrix(true, true);
  }

  private poseFingers(arm: (typeof this.armBones)[number], contact: string): void {
    const firingGrip = arm.side === 1 && contact === "grip_r";
    const loose = contact === "chamber" || contact === "magwell";
    const values: Record<keyof ArmChain["fingers"], readonly [number, number, number]> = {
      thumb: loose ? [.45, .35, .25] : [.72, .58, .42],
      index: firingGrip ? [.08, .05, .03] : loose ? [.38, .32, .22] : [.82, .68, .48],
      middle: loose ? [.48, .42, .3] : [1.02, .82, .58],
      ring: loose ? [.52, .46, .34] : [1.08, .88, .62],
      little: loose ? [.56, .5, .38] : [1.12, .92, .66],
    };
    for (const [name, bones] of Object.entries(arm.fingers) as [keyof ArmChain["fingers"], readonly T.Object3D[]][])
      bones.forEach((bone, index) => bone.rotation.z = -values[name][index]!);
    if (["magazine", "shell", "clip", "bolt_hand"].includes(contact)) {
      arm.fingers.thumb.forEach((bone, index) => bone.rotation.z = -[1, .7, .42][index]!);
      for (const name of ["index", "middle", "ring", "little"] as const)
        arm.fingers[name].forEach((bone, index) => bone.rotation.z = -[1.3, .85, .5][index]!);
      if (contact === "shell" || contact === "clip") {
        const spread = contact === "shell" ? .25 : .3;
        for (const name of ["index", "middle", "ring", "little"] as const)
          arm.fingers[name][0]!.position.z *= spread;
      }
      if (contact === "shell") {
        arm.fingers.thumb.forEach((bone, index) => bone.rotation.z = -[.35, .35, .25][index]!);
        for (const name of ["index", "middle"] as const)
          arm.fingers[name].forEach((bone, index) => bone.rotation.z = -[.45, .4, .3][index]!);
      }
    }
    if (firingGrip) {
      arm.hand.scale.setScalar(.78);
      arm.fingers.index[0]!.rotation.x = -Math.PI / 2;
    }
  }
}

export async function loadAuthoredViewmodelHands(url = FP_ARMS_URL): Promise<AuthoredViewmodelHands | null> {
  let source = authoredSources.get(url);
  if (source === undefined) { source = new GLTFLoader().loadAsync(url).catch(() => null); authoredSources.set(url, source); }
  const gltf = await source;
  return gltf === null ? null : AuthoredViewmodelHands.fromGltf(gltf);
}
