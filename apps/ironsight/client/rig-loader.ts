/**
 * rig-loader.ts — loads the rigged remote-player GLB and clones per-instance,
 * animated rigs from it. ironsight-local (mirrors the pattern in
 * apps/emberfall/client/assets.ts — cached GLTFLoader, SkeletonUtils.clone so
 * skinned bindings survive multiple instances, AnimationMixer crossfade — but
 * intentionally not shared code: this is a much smaller, single-model surface).
 *
 * An acquired lease resolves `undefined` after one console.warn on any
 * fetch/parse failure, and the caller falls back to the procedural capsule rig.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { loadFieldRadio, prepareSoldierAtlas } from './field-equipment.js';
import { SharedAssetCache, disposeGltfTemplate, type AssetCacheSnapshot, type AssetLease } from './shared-gltf-cache.js';
import {
  HIT_ANIMATION_CLIPS,
  hitAnimationLocomotion,
  hitAnimationWeaponIndex,
} from '../src/hit-state-bucket.js';
import type { HitAnimationActionSample, HitReactionSample } from '../src/hit-animation-timeline.js';

export type LocomotionState =
  | "idle"
  | "walk"
  | "run"
  | "crouch_idle"
  | "crouch_walk"
  | "sprint"
  | "strafe_left" | "strafe_right" | "backpedal" | "crouch_left" | "crouch_right"
  | "hit_chest"
  | "hit_head"
  | "death";

const CROSSFADE_SEC = 0.15;
// Hit clips are sampled as a small additive upper-body layer. Locomotion and
// authored two-hand holds keep running underneath; death remains terminal.
const ONE_SHOT_STATES: readonly LocomotionState[] = ["death"];
const reactionClips = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();
function upperBodyReaction(source: THREE.AnimationClip): THREE.AnimationClip {
  const cached = reactionClips.get(source); if (cached) return cached;
  const clip = source.clone();
  clip.name = `${source.name}_upper_additive`;
  clip.tracks = clip.tracks.filter(track => /^(spine_0[123]|neck_01|head)\.quaternion$/.test(track.name));
  // Reference the source's neutral opening frame, never a weapon-specific hold.
  THREE.AnimationUtils.makeClipAdditive(clip, 0, source);
  reactionClips.set(source, clip);
  return clip;
}

/** Finish the fall, then hold the settled silhouette briefly. Respawn still wins. */
export function deathPresentationMs(durationSeconds: number | undefined): number {
  return durationSeconds === undefined ? 1200 : Math.min(3000, durationSeconds * 1000 + 250);
}

const warnedUrls = new Set<string>();

function loadPlayerTemplate(url: string): Promise<GLTF> {
  return Promise.all([new GLTFLoader().loadAsync(url), loadFieldRadio()])
    .then(([gltf]) => { prepareSoldierAtlas(gltf.scene); return gltf; });
}

const sharedCache = new SharedAssetCache<GLTF>(loadPlayerTemplate, disposeGltfTemplate);

export function acquirePlayerModel(url: string): AssetLease<GLTF> {
  const lease = sharedCache.acquire(url);
  return {
    value: lease.value.catch((error: unknown) => {
      if (!warnedUrls.has(url)) {
        warnedUrls.add(url);
        console.warn(`[rig-loader] failed to load player model (${url}), falling back to capsule rig`, error);
      }
      return undefined;
    }),
    release: lease.release,
  };
}

export function playerCacheSnapshot(): AssetCacheSnapshot {
  return sharedCache.snapshot();
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
  /** Uses private baked rifle clips when present; old assets retain fallback. */
  setRifleHold(enabled: boolean): void;
  setWeaponHold(index: number | undefined): void;
  animationDuration(state: LocomotionState): number | undefined;
  /** Snaps directly back to "idle", bypassing the death lock — used on the respawn edge,
   *  where the rig is about to become visible again and a lingering fade would show. */
  forceIdle(): void;
  update(dt: number, authoritativeTimeSeconds?: number): void;
  applyAuthoritativeAnimation(
    samples: readonly HitAnimationActionSample[],
    reaction: HitReactionSample | undefined,
  ): boolean;
  /** Writes the "head" bone's CURRENT world position (post-mixer-update, so it
   *  reflects whatever pose/state is playing right now) into `out`. A no-op if
   *  the GLB has no bone named "head" (older/backup GLBs) — `out` is left
   *  unchanged, same "stay on the fallback" contract as this file's loader.
   *  Diagnostic-only: for comparing the server's assumed hit-volume placement
   *  against where the rig is actually rendered (hitbox/visual audit). */
  getHeadWorldPos(out: THREE.Vector3): void;
  getFootWorldY(): number | undefined;
  /** Lowest death support joint; constant bone work, never a vertex scan. */
  getBodySupportWorldY(): number | undefined;
  dispose(): void;
}

export interface CalibratedRigNormalization {
  readonly feetOffsetY: number;
  readonly rootScale: readonly [number, number, number];
  readonly rootQuaternion: readonly [number, number, number, number];
  readonly rootXZ: readonly [number, number];
}

export function cloneCalibratedPlayerRig(
  gltf: GLTF,
  normalization: CalibratedRigNormalization,
): PlayerRigModel {
  const rig = clonePlayerRig(gltf);
  rig.object.scale.set(...normalization.rootScale);
  rig.object.quaternion.set(...normalization.rootQuaternion);
  rig.object.position.set(normalization.rootXZ[0], normalization.feetOffsetY, normalization.rootXZ[1]);
  rig.object.updateMatrixWorld(true);
  return rig;
}

/** Clones a fresh, independently-posable instance of `gltf` (SkeletonUtils.clone,
 *  not Object3D#clone, so the skinned-mesh bone bindings survive) with a
 *  per-instance AnimationMixer driving idle/walk/run/crouch_idle/crouch_walk/
 *  sprint/hit_chest/hit_head/death (whichever of those clip names exist on the
 *  GLB — missing ones are silently skipped, which is how older/backup GLBs
 *  without the newer clips keep working). */
export function clonePlayerRig(gltf: GLTF): PlayerRigModel {
  const object = cloneSkeleton(gltf.scene) as THREE.Object3D;
  const headBone = object.getObjectByName("head"); // Synty/UAL Epic-style skeleton naming
  const feet = ['Foot_L', 'Foot_R', 'ball_l', 'ball_r', 'toes_l', 'toes_r']
    .map(name => object.getObjectByName(name)).filter((bone): bone is THREE.Object3D => !!bone);
  const supports = [...feet, ...['Pelvis', 'spine_03', 'head', 'Hand_L', 'Hand_R']
    .map(name => object.getObjectByName(name)).filter((bone): bone is THREE.Object3D => !!bone)];
  const footPosition = new THREE.Vector3();
  const mixer = new THREE.AnimationMixer(object);
  const actions = new Map<LocomotionState, THREE.AnimationAction>();
  const holds = ['rifle', 'smg', 'shotgun', 'sniper', 'pistol'].map(() => new Map<LocomotionState, THREE.AnimationAction>());
  let holdIndex: number | undefined = 0;
  const holdActions = () => holdIndex === undefined ? undefined : holds[holdIndex];
  for (const s of [
    "idle",
    "walk",
    "run",
    "crouch_idle",
    "crouch_walk",
    "sprint",
    "strafe_left", "strafe_right", "backpedal", "crouch_left", "crouch_right",
    "hit_chest",
    "hit_head",
    "death",
  ] as const) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, s);
    if (!clip && !['strafe_left', 'strafe_right', 'backpedal', 'crouch_left', 'crouch_right'].includes(s)) continue;
    const fallback = s.startsWith('crouch_') ? 'crouch_walk' : 'walk';
    const base = clip ?? THREE.AnimationClip.findByName(gltf.animations, fallback);
    if (!base) continue;
    const action = mixer.clipAction(base);
    if (ONE_SHOT_STATES.includes(s)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(s, action);
    for (const [index, prefix] of ['rifle', 'smg', 'shotgun', 'sniper', 'pistol'].entries()) {
      const hold = THREE.AnimationClip.findByName(gltf.animations, `${prefix}_${s}`);
      if (hold) holds[index]!.set(s, mixer.clipAction(hold));
    }
  }
  const deathDuration = actions.get("death")?.getClip().duration;
  const hasCrouchClips = actions.has("crouch_idle") || actions.has("crouch_walk");
  const hasSprintClip = actions.has("sprint");
  const hasHitChestClip = actions.has("hit_chest");
  const hasHitHeadClip = actions.has("hit_head");
  const hitChestDuration = actions.get("hit_chest")?.getClip().duration;
  const hitHeadDuration = actions.get("hit_head")?.getClip().duration;

  const reactions = new Map<LocomotionState, THREE.AnimationAction>();
  for (const name of ["hit_chest", "hit_head"] as const) {
    const source = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!source) continue;
    const clip = upperBodyReaction(source);
    if (!clip.tracks.length) continue;
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
    reactions.set(name, action);
  }
  let reaction: THREE.AnimationAction | undefined;
  let reactionAge = 0;
  const stopReaction = () => { reaction?.stop(); reaction = undefined; reactionAge = 0; };

  let current: THREE.AnimationAction | undefined;
  let state: LocomotionState = "idle";
  let authoritativeActions: readonly THREE.AnimationAction[] | undefined;

  const play = (next: LocomotionState, restart = false): void => {
    const action = holdActions()?.get(next) ?? actions.get(next);
    if (!action) return;
    if (action === current && !restart) return;
    action.reset().fadeIn(CROSSFADE_SEC).play();
    if (current && current !== action) current.fadeOut(CROSSFADE_SEC);
    current = action;
  };
  play("idle");
  object.userData.rifleHold = !!holdActions()?.size;

  return {
    object,
    deathDuration,
    hasCrouchClips,
    hasSprintClip,
    hasHitChestClip,
    hasHitHeadClip,
    hitChestDuration,
    hitHeadDuration,
    setRifleHold(enabled): void { this.setWeaponHold(enabled ? 0 : undefined); },
    setWeaponHold(index): void {
      if (holdIndex === index) return;
      holdIndex = index;
      object.userData.rifleHold = !!holdActions()?.size;
      play(state);
    },
    animationDuration(next): number | undefined {
      return (holdActions()?.get(next) ?? actions.get(next))?.getClip().duration;
    },
    setState(next: LocomotionState): void {
      if (state === "death") return; // terminal until forceIdle()
      if (next === "hit_chest" || next === "hit_head") {
        const hit = reactions.get(next) ?? reactions.get("hit_chest");
        if (!hit) return;
        stopReaction(); reaction = hit;
        hit.reset().setEffectiveWeight(0).play();
        return;
      }
      if (next === "death") {
        stopReaction();
        if (authoritativeActions !== undefined) {
          mixer.stopAllAction();
          authoritativeActions = undefined;
          current = undefined;
        }
      }
      const restart = ONE_SHOT_STATES.includes(next);
      if (next === state && !restart) return;
      state = next;
      play(next, restart);
    },
    forceIdle(): void {
      stopReaction();
      state = "idle";
      for (const action of [...actions.values(), ...holds.flatMap(actions => [...actions.values()])]) action.stop();
      const idle = holdActions()?.get("idle") ?? actions.get("idle");
      if (idle) {
        idle.reset().play();
        idle.weight = 1;
      }
      current = idle;
      authoritativeActions = undefined;
    },
    update(dt: number, authoritativeTimeSeconds?: number): void {
      if (reaction) {
        reactionAge += Math.max(0, dt);
        const duration = reaction.getClip().duration;
        if (reactionAge >= duration) stopReaction();
        else reaction.setEffectiveWeight(0.7 * Math.min(1, reactionAge / 0.035, (duration - reactionAge) / 0.09));
      }
      mixer.update(dt);
      if (current && authoritativeTimeSeconds !== undefined && Number.isFinite(authoritativeTimeSeconds)) {
        const duration = current.getClip().duration;
        if (duration > 0) {
          current.time = Math.max(0, authoritativeTimeSeconds) % duration;
          mixer.update(0);
        }
      }
    },
    applyAuthoritativeAnimation(samples, reactionSample): boolean {
      if (samples.length === 0 || samples.length > HIT_ANIMATION_CLIPS.length) return false;
      if (authoritativeActions === undefined) {
        const resolved: THREE.AnimationAction[] = [];
        const unique = new Set<THREE.AnimationAction>();
        for (const clip of HIT_ANIMATION_CLIPS) {
          const action = holds[hitAnimationWeaponIndex(clip)]?.get(hitAnimationLocomotion(clip));
          if (!action || unique.has(action)) return false;
          unique.add(action);
          resolved.push(action);
        }
        authoritativeActions = resolved;
      }
      const seen = new Set<number>();
      const scheduled: { action: THREE.AnimationAction; phaseSeconds: number; weight: number }[] = [];
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index]!;
        const action = authoritativeActions[sample.clipIndex];
        if (!action || seen.has(sample.clipIndex) || !Number.isFinite(sample.phaseMs) || sample.phaseMs < 0
          || !Number.isFinite(sample.weight) || sample.weight < 0 || sample.weight > 1
          || sample.current !== (index === samples.length - 1)
          || (!sample.current && index > 0 && samples[index - 1]!.clipIndex >= sample.clipIndex)) return false;
        seen.add(sample.clipIndex);
        const duration = action.getClip().duration;
        if (!(duration > 0)) return false;
        scheduled.push({ action, phaseSeconds: sample.phaseMs / 1000 % duration, weight: sample.weight });
      }
      let scheduledReaction: { action: THREE.AnimationAction; age: number; weight: number } | undefined;
      if (reactionSample && reactionSample.kind !== 0) {
        const next = reactionSample.kind === 2 ? reactions.get("hit_head") ?? reactions.get("hit_chest")
          : reactions.get("hit_chest");
        if (!next || !Number.isFinite(reactionSample.ageMs) || reactionSample.ageMs < 0) return false;
        const duration = next.getClip().duration;
        const age = reactionSample.ageMs / 1000;
        if (age < duration) {
          scheduledReaction = {
            action: next,
            age,
            weight: 0.7 * Math.min(1, age / 0.035, (duration - age) / 0.09),
          };
        }
      }
      mixer.stopAllAction();
      stopReaction();
      for (const item of scheduled) {
        item.action.reset().setEffectiveWeight(item.weight).play();
        item.action.time = item.phaseSeconds;
      }
      if (scheduledReaction) {
        scheduledReaction.action.reset().setEffectiveWeight(scheduledReaction.weight).play();
        scheduledReaction.action.time = scheduledReaction.age;
      }
      mixer.update(0);
      return true;
    },
    getHeadWorldPos(out: THREE.Vector3): void {
      headBone?.getWorldPosition(out);
    },
    getBodySupportWorldY(): number | undefined {
      if (!supports.length) return undefined;
      let y = Infinity;
      for (const bone of supports) { bone.getWorldPosition(footPosition); y = Math.min(y, footPosition.y); }
      return y;
    },
    getFootWorldY(): number | undefined {
      if (!feet.length) return undefined;
      let y = Infinity;
      for (const bone of feet) { bone.getWorldPosition(footPosition); y = Math.min(y, footPosition.y); }
      return y;
    },
    dispose(): void {
      stopReaction();
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
    },
  };
}
