import { HIT_ANIMATION_NONE } from "../src/hit-state-bucket.js";
import { selectHitAnimationSnap } from "../src/hit-animation-authority.js";
import type { HitFadeSource } from "../src/hit-animation-timeline.js";

export interface RemotePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  team: number;
  alive: boolean;
  weapon: number;
  reloadEnd: number;
  hitClipIndex: number;
  hitClipStartedAt: number;
  hitBlendSources: readonly HitFadeSource[];
  hitReactionKind: number;
  hitReactionStartedAt: number;
  hitReactionSeq: number;
  hitSegmentSeq: number;
  hitSegmentStartedAt: number;
}

export interface RemoteSnapshot {
  readonly receiptTime: number;
  readonly serverTime: number | null;
  readonly players: Map<string, RemotePose>;
}

export interface RemoteSample {
  readonly poses: Map<string, RemotePose>;
  readonly sampledServerTime: number | null;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function wrapPi(angle: number): number {
  const tau = Math.PI * 2;
  let wrapped = angle % tau;
  if (wrapped > Math.PI) wrapped -= tau;
  else if (wrapped < -Math.PI) wrapped += tau;
  return wrapped;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapPi(b - a) * t;
}

function authoritativeDiscretePose(
  before: RemotePose,
  after: RemotePose,
  sampledServerTime: number | null,
): RemotePose {
  if (sampledServerTime === null) return after;
  if (after.hitClipIndex === HIT_ANIMATION_NONE) {
    const clearAt = before.hitClipIndex !== HIT_ANIMATION_NONE && before.hitReactionSeq !== after.hitReactionSeq
      ? after.hitReactionStartedAt
      : Number.NEGATIVE_INFINITY;
    return sampledServerTime < clearAt ? before : after;
  }
  return selectHitAnimationSnap(before, after, sampledServerTime, after.hitClipStartedAt) ?? after;
}

function authoritativeReactionPose(
  before: RemotePose,
  after: RemotePose,
  sampledServerTime: number | null,
): RemotePose {
  if (sampledServerTime === null || before.hitReactionSeq === after.hitReactionSeq) return after;
  return sampledServerTime < after.hitReactionStartedAt ? before : after;
}

function authoritativeRootPose(
  before: RemotePose,
  after: RemotePose,
  sampledServerTime: number | null,
): RemotePose | undefined {
  if (before.hitSegmentSeq === after.hitSegmentSeq
    && before.hitSegmentStartedAt === after.hitSegmentStartedAt) return undefined;
  if (sampledServerTime === null) return after;
  return sampledServerTime < after.hitSegmentStartedAt ? before : after;
}

export function sampleRemoteSnapshot(
  snapshots: readonly RemoteSnapshot[],
  renderTime: number,
  scratch: Map<string, RemotePose>,
): RemoteSample {
  if (snapshots.length === 0) {
    scratch.clear();
    return { poses: scratch, sampledServerTime: null };
  }
  const first = snapshots[0]!;
  if (snapshots.length === 1 || renderTime <= first.receiptTime) {
    return { poses: first.players, sampledServerTime: first.serverTime };
  }
  const last = snapshots[snapshots.length - 1]!;
  if (renderTime >= last.receiptTime) {
    return { poses: last.players, sampledServerTime: last.serverTime };
  }
  let before = first;
  let after = last;
  for (let i = 0; i < snapshots.length - 1; i++) {
    const candidate = snapshots[i]!;
    const next = snapshots[i + 1]!;
    if (renderTime >= candidate.receiptTime && renderTime <= next.receiptTime) {
      before = candidate;
      after = next;
      break;
    }
  }
  const span = after.receiptTime - before.receiptTime;
  const t = span <= 0 ? 1 : (renderTime - before.receiptTime) / span;
  const sampledServerTime = before.serverTime === null || after.serverTime === null
    ? null
    : lerp(before.serverTime, after.serverTime, t);
  for (const id of scratch.keys()) {
    if (!after.players.has(id)) scratch.delete(id);
  }
  for (const [id, afterPose] of after.players) {
    const beforePose = before.players.get(id) ?? afterPose;
    const discrete = authoritativeDiscretePose(beforePose, afterPose, sampledServerTime);
    const reaction = authoritativeReactionPose(beforePose, afterPose, sampledServerTime);
    const root = authoritativeRootPose(beforePose, afterPose, sampledServerTime);
    let pose = scratch.get(id);
    if (!pose) {
      pose = { ...afterPose };
      scratch.set(id, pose);
    }
    pose.x = root?.x ?? lerp(beforePose.x, afterPose.x, t);
    pose.y = root?.y ?? lerp(beforePose.y, afterPose.y, t);
    pose.z = root?.z ?? lerp(beforePose.z, afterPose.z, t);
    pose.yaw = root?.yaw ?? lerpAngle(beforePose.yaw, afterPose.yaw, t);
    pose.pitch = lerp(beforePose.pitch, afterPose.pitch, t);
    pose.crouch = discrete.crouch;
    pose.team = discrete.team;
    pose.alive = discrete.alive;
    pose.weapon = discrete.weapon;
    pose.reloadEnd = discrete.reloadEnd;
    pose.hitClipIndex = discrete.hitClipIndex;
    pose.hitClipStartedAt = discrete.hitClipStartedAt;
    pose.hitBlendSources = discrete.hitBlendSources;
    pose.hitReactionKind = reaction.hitReactionKind;
    pose.hitReactionStartedAt = reaction.hitReactionStartedAt;
    pose.hitReactionSeq = reaction.hitReactionSeq;
    pose.hitSegmentSeq = root?.hitSegmentSeq ?? afterPose.hitSegmentSeq;
    pose.hitSegmentStartedAt = root?.hitSegmentStartedAt ?? afterPose.hitSegmentStartedAt;
  }
  return { poses: scratch, sampledServerTime };
}
