/**
 * library.ts — M4: loading a second GLB purely for its AnimationClips (an
 * animation library sharing the current model's skeleton naming, e.g. a UAL
 * clip set retargeted onto the shared Synty/Epic bone names) and merging
 * those clips into the current rig's clip list.
 *
 * No re-binding step is needed: three.js's AnimationMixer resolves each
 * track by searching the CURRENT model's node graph for a node whose `.name`
 * matches the track's target (`"boneName.quaternion"` etc.) — a clip that
 * originated from a completely different GLB plays back correctly the
 * moment its track names match nodes in `rig.root`, regardless of source.
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LoadedRig } from "./rig.js";
import * as THREE from "three";

export interface LibraryLoadResult {
  clips: THREE.AnimationClip[];
  /** Fraction (0..1) of the library's distinct referenced bone names that
   *  exist in the current rig — used for the ">30% missing" warning. */
  matchedFraction: number;
}

/** Loads `file` and extracts only its AnimationClips — the library GLB's own
 *  skeleton/mesh (if any) is discarded entirely, matching M4's "clips only". */
export async function loadAnimationLibraryFromFile(file: File, currentBoneNames: ReadonlySet<string>): Promise<LibraryLoadResult> {
  const buffer = await file.arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  const clips = gltf.animations;

  const referencedBones = new Set<string>();
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf(".");
      referencedBones.add(dot >= 0 ? track.name.slice(0, dot) : track.name);
    }
  }
  let matched = 0;
  for (const name of referencedBones) if (currentBoneNames.has(name)) matched++;
  const matchedFraction = referencedBones.size > 0 ? matched / referencedBones.size : 1;

  return { clips, matchedFraction };
}

export interface MergeSummary {
  added: number;
  replaced: number;
  skipped: number;
}

/** Merges `newClips` into `rig.clips` in place. A name collision is either
 *  replaced (if `replaceConflicts`) or skipped entirely — never both kept
 *  under the same name (see README M4 #17: `editedKeys` is keyed by
 *  `clipName::boneName`, so duplicate clip names would corrupt key-edit
 *  bookkeeping). */
export function mergeClips(rig: LoadedRig, newClips: THREE.AnimationClip[], replaceConflicts: boolean): MergeSummary {
  const summary: MergeSummary = { added: 0, replaced: 0, skipped: 0 };
  for (const clip of newClips) {
    const existingIndex = rig.clips.findIndex((c) => c.name === clip.name);
    if (existingIndex >= 0) {
      if (replaceConflicts) {
        rig.clips[existingIndex] = clip;
        summary.replaced++;
      } else {
        summary.skipped++;
      }
    } else {
      rig.clips.push(clip);
      summary.added++;
    }
  }
  return summary;
}
