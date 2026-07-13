/**
 * rig-loader.ts — loads the rigged remote-player GLB and clones per-instance,
 * animated rigs from it. ironsight-local (mirrors the pattern in
 * apps/emberfall/client/assets.ts — cached GLTFLoader, SkeletonUtils.clone so
 * skinned bindings survive multiple instances, AnimationMixer crossfade — but
 * intentionally not shared code: this is a much smaller, single-model surface).
 *
 * Never rejects: `loadPlayerModel` resolves `undefined` (after one console.warn)
 * on any fetch/parse failure, and the caller (scene.ts) is expected to fall back
 * to the procedural capsule rig permanently in that case.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export type LocomotionState = "idle" | "walk" | "run" | "death";

const CROSSFADE_SEC = 0.15;
const ONE_SHOT_STATES: readonly LocomotionState[] = ["death"];

let cachedGltf: Promise<GLTF> | undefined;
let warnedOnce = false;

/** Fetches (and caches) the player GLB. Resolves `undefined` — after a single
 *  `console.warn` — on any failure; never rejects. */
export async function loadPlayerModel(url: string): Promise<GLTF | undefined> {
  if (!cachedGltf) cachedGltf = new GLTFLoader().loadAsync(url);
  try {
    return await cachedGltf;
  } catch (err) {
    if (!warnedOnce) {
      warnedOnce = true;
      console.warn(`[rig-loader] failed to load player model (${url}), falling back to capsule rig`, err);
    }
    return undefined;
  }
}

/** One animated instance of the player model, driving its own AnimationMixer. */
export interface PlayerRigModel {
  readonly object: THREE.Object3D;
  /** Duration (seconds) of the "death" clip, or undefined if the GLB has none. */
  readonly deathDuration: number | undefined;
  /** Crossfades to `state`. A no-op once "death" has played (terminal) — see {@link forceIdle}. */
  setState(state: LocomotionState): void;
  /** Snaps directly back to "idle", bypassing the death lock — used on the respawn edge,
   *  where the rig is about to become visible again and a lingering fade would show. */
  forceIdle(): void;
  update(dt: number): void;
}

/** Clones a fresh, independently-posable instance of `gltf` (SkeletonUtils.clone,
 *  not Object3D#clone, so the skinned-mesh bone bindings survive) with a
 *  per-instance AnimationMixer driving idle/walk/run/death (whichever of those
 *  clip names exist on the GLB — missing ones are silently skipped). */
export function clonePlayerRig(gltf: GLTF): PlayerRigModel {
  const object = cloneSkeleton(gltf.scene) as THREE.Object3D;
  const mixer = new THREE.AnimationMixer(object);
  const actions = new Map<LocomotionState, THREE.AnimationAction>();
  for (const s of ["idle", "walk", "run", "death"] as const) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, s);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    if (ONE_SHOT_STATES.includes(s)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(s, action);
  }
  const deathDuration = actions.get("death")?.getClip().duration;

  let current: THREE.AnimationAction | undefined;
  let state: LocomotionState = "idle";

  const play = (next: LocomotionState, restart = false): void => {
    const action = actions.get(next);
    if (!action) return;
    if (action === current && !restart) return;
    action.reset().fadeIn(CROSSFADE_SEC).play();
    if (current && current !== action) current.fadeOut(CROSSFADE_SEC);
    current = action;
  };
  play("idle");

  return {
    object,
    deathDuration,
    setState(next: LocomotionState): void {
      if (state === "death") return; // terminal until forceIdle()
      const restart = ONE_SHOT_STATES.includes(next);
      if (next === state && !restart) return;
      state = next;
      play(next, restart);
    },
    forceIdle(): void {
      state = "idle";
      for (const action of actions.values()) action.stop();
      const idle = actions.get("idle");
      if (idle) {
        idle.reset().play();
        idle.weight = 1;
      }
      current = idle;
    },
    update(dt: number): void {
      mixer.update(dt);
    },
  };
}
