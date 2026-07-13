/**
 * keyframes.ts — M2 keyframe editing: locating a bone's quaternion track
 * within a clip, listing its keyframe times for the timeline ticks, and
 * writing an edited pose back into a single key (neighbouring keys and the
 * clip's own interpolation mode are left untouched — only that key's stored
 * value changes).
 *
 * Edits mutate the live `THREE.AnimationClip` returned by the loader in
 * place. That is intentional: `AnimationMixer`'s interpolants hold a
 * reference to the track's `values` array, not a copy, so writing into it
 * here is picked up on the next sampled frame with no extra rebinding.
 * export.ts later bakes global corrections on top of a CLONE of these
 * (already key-edited) tracks, so the live in-editor tracks stay exactly
 * what the user set.
 */
import * as THREE from "three";

/** `${boneName}.quaternion`, matching GLTFLoader's own track-naming
 *  convention (see three's GLTFLoader `_createAnimationTracks`). */
function trackName(boneName: string): string {
  return `${boneName}.quaternion`;
}

export function findQuaternionTrack(
  clip: THREE.AnimationClip,
  boneName: string,
): THREE.QuaternionKeyframeTrack | undefined {
  const name = trackName(boneName);
  const track = clip.tracks.find((t) => t.name === name);
  return track instanceof THREE.QuaternionKeyframeTrack ? track : undefined;
}

export interface KeyTick {
  index: number;
  time: number;
}

/** All keyframe times for `boneName`'s rotation track in `clip` (empty if the
 *  bone has no rotation track in this clip — e.g. a bone nothing ever animates). */
export function listKeyTicks(clip: THREE.AnimationClip, boneName: string): KeyTick[] {
  const track = findQuaternionTrack(clip, boneName);
  if (!track) return [];
  const ticks: KeyTick[] = [];
  for (let i = 0; i < track.times.length; i++) ticks.push({ index: i, time: track.times[i]! });
  return ticks;
}

/** Index of the key at (or within `epsilon` seconds of) `time`, or undefined
 *  if `time` doesn't land on an existing key — used to jump-and-select on a
 *  tick click, which always passes back one of listKeyTicks' own times. */
export function findKeyIndexAtTime(clip: THREE.AnimationClip, boneName: string, time: number, epsilon = 1e-4): number | undefined {
  const track = findQuaternionTrack(clip, boneName);
  if (!track) return undefined;
  for (let i = 0; i < track.times.length; i++) {
    if (Math.abs(track.times[i]! - time) <= epsilon) return i;
  }
  return undefined;
}

export function readKeyQuaternion(track: THREE.QuaternionKeyframeTrack, index: number): THREE.Quaternion {
  const o = index * 4;
  return new THREE.Quaternion(track.values[o]!, track.values[o + 1]!, track.values[o + 2]!, track.values[o + 3]!);
}

/**
 * Writes `value` into key `index` of `track`, then enforces hemisphere
 * continuity against the previous key: a quaternion `q` and `-q` represent
 * the identical rotation, but slerp between keys on opposite hemispheres
 * (dot < 0) takes the "long way round" and visibly whips the bone — so if
 * the new value's dot with the previous key is negative, negate all 4
 * components before storing (flips to the near hemisphere without changing
 * the pose it represents).
 */
export function writeKeyQuaternion(track: THREE.QuaternionKeyframeTrack, index: number, value: THREE.Quaternion): void {
  const q = value.clone();
  if (index > 0) {
    const prev = readKeyQuaternion(track, index - 1);
    if (prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  }
  const o = index * 4;
  track.values[o] = q.x;
  track.values[o + 1] = q.y;
  track.values[o + 2] = q.z;
  track.values[o + 3] = q.w;
  // The NEXT key was normalized relative to the OLD value at `index`; re-check
  // it against the new one so a long-way slerp doesn't reappear just after
  // this key instead of just before it.
  if (index + 1 < track.times.length) {
    const next = readKeyQuaternion(track, index + 1);
    if (q.dot(next) < 0) {
      const o2 = (index + 1) * 4;
      track.values[o2] = -next.x;
      track.values[o2 + 1] = -next.y;
      track.values[o2 + 2] = -next.z;
      track.values[o2 + 3] = -next.w;
    }
  }
}

/** Identifies one edited key for the "modified" tick-color set the UI keeps. */
export function keyEditId(clipName: string, boneName: string, index: number): string {
  return `${clipName}::${boneName}::${index}`;
}
