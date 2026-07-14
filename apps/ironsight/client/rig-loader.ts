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

export type LocomotionState =
  | "idle"
  | "walk"
  | "run"
  | "crouch_idle"
  | "crouch_walk"
  | "sprint"
  | "hit_chest"
  | "hit_head"
  | "death";

const CROSSFADE_SEC = 0.15;
// "hit_chest"/"hit_head" are one-shot like "death" (loop once, restart on a
// repeat request — a rapid follow-up hit replays from the top) but, unlike
// death, are NOT terminal: setState's `state === "death"` check is a literal
// string match, so a hit reaction never locks out later states. clampWhenFinished
// below holds the last frame briefly; scene.ts is the one that explicitly calls
// setState(locomotion) again once the clip's own duration elapses, crossfading
// back to whatever's current (see hitChestDuration/hitHeadDuration + syncModelRig).
const ONE_SHOT_STATES: readonly LocomotionState[] = ["death", "hit_chest", "hit_head"];

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
  /** Whether this GLB has a "crouch_idle" or "crouch_walk" clip. False for
   *  older/backup GLBs (idle/walk/run/death only) — scene.ts uses this to decide
   *  whether to play a real crouch clip or fall back to its vertical-squash
   *  crouch approximation. */
  readonly hasCrouchClips: boolean;
  /** Whether this GLB has a "sprint" clip — if false, the top speed band keeps
   *  playing "run" (unchanged legacy behavior). */
  readonly hasSprintClip: boolean;
  /** Whether this GLB has a "hit_chest" clip. */
  readonly hasHitChestClip: boolean;
  /** Whether this GLB has a "hit_head" clip (falls back to hit_chest on a
   *  headshot if only that one exists). */
  readonly hasHitHeadClip: boolean;
  /** Duration (seconds) of the "hit_chest" clip, or undefined if the GLB has none. */
  readonly hitChestDuration: number | undefined;
  /** Duration (seconds) of the "hit_head" clip, or undefined if the GLB has none. */
  readonly hitHeadDuration: number | undefined;
  /** Crossfades to `state`. A no-op once "death" has played (terminal) — see {@link forceIdle}. */
  setState(state: LocomotionState): void;
  /** Snaps directly back to "idle", bypassing the death lock — used on the respawn edge,
   *  where the rig is about to become visible again and a lingering fade would show. */
  forceIdle(): void;
  update(dt: number): void;
}

/** Clones a fresh, independently-posable instance of `gltf` (SkeletonUtils.clone,
 *  not Object3D#clone, so the skinned-mesh bone bindings survive) with a
 *  per-instance AnimationMixer driving idle/walk/run/crouch_idle/crouch_walk/
 *  sprint/hit_chest/hit_head/death (whichever of those clip names exist on the
 *  GLB — missing ones are silently skipped, which is how older/backup GLBs
 *  without the newer clips keep working). */
export function clonePlayerRig(gltf: GLTF): PlayerRigModel {
  const object = cloneSkeleton(gltf.scene) as THREE.Object3D;
  const mixer = new THREE.AnimationMixer(object);
  const actions = new Map<LocomotionState, THREE.AnimationAction>();
  for (const s of [
    "idle",
    "walk",
    "run",
    "crouch_idle",
    "crouch_walk",
    "sprint",
    "hit_chest",
    "hit_head",
    "death",
  ] as const) {
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
  const hasCrouchClips = actions.has("crouch_idle") || actions.has("crouch_walk");
  const hasSprintClip = actions.has("sprint");
  const hasHitChestClip = actions.has("hit_chest");
  const hasHitHeadClip = actions.has("hit_head");
  const hitChestDuration = actions.get("hit_chest")?.getClip().duration;
  const hitHeadDuration = actions.get("hit_head")?.getClip().duration;

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
    hasCrouchClips,
    hasSprintClip,
    hasHitChestClip,
    hasHitHeadClip,
    hitChestDuration,
    hitHeadDuration,
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
