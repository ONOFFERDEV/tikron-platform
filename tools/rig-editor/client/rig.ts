/**
 * rig.ts — GLB loading, bone-graph parsing (a real graph, not an assumed serial
 * chain — wrist branches into multiple fingers on some rigs), and the runtime
 * composition of the global per-bone correction layer on top of the
 * AnimationMixer's sampled pose.
 *
 * Composition ordering (see {@link composeCorrections}): the mixer is the only
 * writer of each bone's "base" (pre-correction) quaternion. main.ts only calls
 * `mixer.update()` / `mixer.setTime()` while nothing is being dragged, so a
 * live TransformControls drag (which mutates the target bone's quaternion
 * directly) is never stomped by the mixer in the same frame. Right after the
 * mixer runs, every bone's base quaternion is snapshotted into `baseCache` —
 * frozen there across paused frames — and corrections are re-derived from
 * that frozen base every render, so replaying the same composition across
 * many paused frames never drifts or double-applies.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface BoneNode {
  bone: THREE.Bone;
  name: string;
  parent: string | undefined;
  children: string[];
}

export interface LoadedRig {
  gltf: GLTF;
  root: THREE.Object3D; // gltf.scene, added directly to the viewport scene
  fileName: string;
  bones: Map<string, THREE.Bone>;
  boneGraph: Map<string, BoneNode>;
  rootBoneNames: string[];
  clips: THREE.AnimationClip[];
  mixer: THREE.AnimationMixer;
  /** Each bone's local quaternion exactly as loaded, before any clip ever played —
   *  the true bind/rest pose. Exported GLBs reset to this so a paused mid-clip
   *  pose is never accidentally baked in as the skeleton's rest transform. */
  bindQuats: Map<string, THREE.Quaternion>;
}

/** Cumulative global per-bone correction (local-space, see composeCorrections). */
export type CorrectionMap = Map<string, THREE.Quaternion>;

/** Each bone's mixer-sampled (pre-correction) local quaternion as of the last
 *  time the mixer actually advanced or seeked — see composeCorrections. */
export type BaseQuatCache = Map<string, THREE.Quaternion>;

/** Loads `file` (from drag&drop or the file-picker input) as a GLB and parses
 *  its bone graph + clip list. KHR_mesh_quantization is handled natively by
 *  three's GLTFLoader — no special-casing needed here. */
export async function loadRigFromFile(file: File): Promise<LoadedRig> {
  const buffer = await file.arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  return buildLoadedRig(gltf, file.name);
}

function buildLoadedRig(gltf: GLTF, fileName: string): LoadedRig {
  const bones = new Map<string, THREE.Bone>();
  gltf.scene.traverse((node) => {
    if (node instanceof THREE.Bone) bones.set(node.name, node);
  });

  const boneGraph = new Map<string, BoneNode>();
  const rootBoneNames: string[] = [];
  for (const [name, bone] of bones) {
    const parentName = bone.parent instanceof THREE.Bone ? bone.parent.name : undefined;
    boneGraph.set(name, { bone, name, parent: parentName, children: [] });
    if (!parentName) rootBoneNames.push(name);
  }
  // Second pass: wire children after every node exists — this is a graph walk,
  // not a chain assumption (see file header).
  for (const node of boneGraph.values()) {
    if (node.parent) boneGraph.get(node.parent)?.children.push(node.name);
  }

  const bindQuats = new Map<string, THREE.Quaternion>();
  for (const [name, bone] of bones) bindQuats.set(name, bone.quaternion.clone());

  const mixer = new THREE.AnimationMixer(gltf.scene);
  return {
    gltf,
    root: gltf.scene,
    fileName,
    bones,
    boneGraph,
    rootBoneNames,
    clips: gltf.animations,
    mixer,
    bindQuats,
  };
}

/**
 * Re-derives every corrected bone's quaternion as `base * correction`
 * (POST-multiply — the correction rotates around the bone's OWN current joint
 * axes, on top of whatever the clip's local pose already is).
 *
 * `base` is refreshed from the bone's live quaternion only when `refreshBase`
 * is true (the caller just ran `mixer.update()`/`setTime()` this frame);
 * otherwise the previous frame's cached base is reused so a paused frame
 * doesn't re-read its own already-corrected value as if it were the base.
 *
 * `excludeBone`, if set, is skipped entirely — that bone is being live-dragged
 * by TransformControls and owns its own quaternion for the duration.
 *
 * Composition order was checked visually with the armfix player.glb: with the
 * shoulder bone, POST-multiply (base * correction, applied here) rotates the
 * joint around its own current axes and looks identical (same visual knob)
 * whether idle/walk/run/death is playing — exactly the "one constant fix
 * across every clip" the tool exists for. PRE-multiply (correction * base)
 * was also tried and instead swings the whole limb around the PARENT's axes,
 * so the same correction value reads differently per clip depending on how
 * the parent bone happens to be posed — wrong for this tool's purpose.
 */
export function composeCorrections(
  bones: Map<string, THREE.Bone>,
  corrections: CorrectionMap,
  baseCache: BaseQuatCache,
  refreshBase: boolean,
  excludeBone: string | undefined,
): void {
  for (const [name, bone] of bones) {
    if (name === excludeBone) continue;
    let base = baseCache.get(name);
    if (refreshBase || !base) {
      base = bone.quaternion.clone();
      baseCache.set(name, base);
    }
    const corr = corrections.get(name);
    if (corr) bone.quaternion.copy(base).multiply(corr);
  }
}
