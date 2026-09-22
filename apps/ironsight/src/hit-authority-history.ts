import {
  sampleHitAnimationTimeline,
  sampleHitReaction,
  type HitAnimationTimeline,
  type HitReactionStamp,
} from "./hit-animation-timeline.js";
import type { SoldierHitVolume } from "./hit-calibration.js";
import type { HitRigPoseSampleInput, HitRigPoseSample } from "./hit-rig-pose.js";
import type { Stage33HitIdentity } from "./stage33-hit-calibration.js";

export interface HitAuthorityFrame {
  readonly identity: Stage33HitIdentity;
  readonly root: { readonly x: number; readonly z: number; readonly feetY: number; readonly yaw: number };
  readonly timeline: HitAnimationTimeline;
  readonly reaction: HitReactionStamp;
  readonly segmentSeq: number;
  readonly segmentStartedAt: number;
}

export interface RewoundHitAuthority {
  readonly x: number;
  readonly z: number;
  readonly feetY: number;
  readonly yaw: number;
  readonly hitVolume: SoldierHitVolume;
  readonly headRadius: number;
  readonly groundOffsetY: number;
  readonly bodyRadiusUpperBound: number;
  readonly segmentSeq: number;
}

export type HitAuthorityEvaluator = (input: HitRigPoseSampleInput) => HitRigPoseSample | undefined;

interface AuthoritySnapshot {
  readonly tick: number;
  readonly serverTimeMs: number;
  readonly frames: ReadonlyMap<string, HitAuthorityFrame>;
}

function finite(values: readonly number[]): boolean {
  return values.every(Number.isFinite);
}

function cloneFrame(frame: HitAuthorityFrame): HitAuthorityFrame | undefined {
  const { identity, root, timeline, reaction } = frame;
  if (!finite([root.x, root.z, root.feetY, root.yaw, frame.segmentStartedAt])
    || !Number.isInteger(frame.segmentSeq) || frame.segmentSeq < 0 || frame.segmentSeq > 65_535
    || typeof identity.glbSha256 !== "string" || typeof identity.hitComponentSha256 !== "string"
    || typeof identity.normalizationTransformSha256 !== "string") return undefined;
  const copy: HitAuthorityFrame = {
    identity: { ...identity }, root: { ...root },
    timeline: { ...timeline, sources: timeline.sources.map(source => ({ ...source })) },
    reaction: { ...reaction }, segmentSeq: frame.segmentSeq, segmentStartedAt: frame.segmentStartedAt,
  };
  return sampleHitAnimationTimeline(copy.timeline, Math.max(copy.timeline.currentStartedAt, frame.segmentStartedAt))
    && sampleHitReaction(copy.reaction, Math.max(copy.reaction.startedAt, frame.segmentStartedAt))
    ? copy
    : undefined;
}

function sameIdentity(a: Stage33HitIdentity, b: Stage33HitIdentity): boolean {
  return a.faction === b.faction && a.glbSha256 === b.glbSha256
    && a.hitComponentSha256 === b.hitComponentSha256
    && a.normalizationTransformSha256 === b.normalizationTransformSha256;
}

function interpolateYaw(a: number, b: number, alpha: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const yaw = a + delta * alpha;
  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}

function selectTimeline(a: HitAnimationTimeline, b: HitAnimationTimeline, at: number): HitAnimationTimeline {
  return b.currentStartedAt <= at && b.currentStartedAt >= a.currentStartedAt ? b : a;
}

function selectReaction(a: HitReactionStamp, b: HitReactionStamp, at: number): HitReactionStamp {
  return b.startedAt <= at && b.startedAt >= a.startedAt ? b : a;
}

export class HitAuthorityHistory {
  private readonly buffer: AuthoritySnapshot[] = [];

  constructor(
    private readonly evaluator: HitAuthorityEvaluator,
    readonly depthMs = 250,
    private readonly maxSnapshots = 128,
  ) {}

  get size(): number { return this.buffer.length; }

  record(tick: number, serverTimeMs: number, input: ReadonlyMap<string, HitAuthorityFrame>): void {
    if (!finite([tick, serverTimeMs])) return;
    const previous = this.buffer.at(-1);
    if (previous !== undefined && (serverTimeMs < previous.serverTimeMs
      || tick < previous.tick || (serverTimeMs > previous.serverTimeMs && tick === previous.tick))) return;
    const frames = new Map<string, HitAuthorityFrame>();
    for (const [id, frame] of input) {
      const copy = cloneFrame(frame);
      if (id.length > 0 && copy !== undefined && copy.segmentStartedAt <= serverTimeMs
        && copy.timeline.currentStartedAt <= serverTimeMs && copy.reaction.startedAt <= serverTimeMs) {
        frames.set(id, copy);
      }
    }
    const snapshot = { tick, serverTimeMs, frames };
    if (previous?.serverTimeMs === serverTimeMs) this.buffer[this.buffer.length - 1] = snapshot;
    else this.buffer.push(snapshot);
    const cutoff = serverTimeMs - this.depthMs;
    while (this.buffer.length > 1) {
      const oldest = this.buffer.at(0);
      if (oldest === undefined || oldest.serverTimeMs >= cutoff) break;
      this.buffer.shift();
    }
    while (this.buffer.length > this.maxSnapshots) this.buffer.shift();
  }

  atTime(serverTimeMs: number): Map<string, RewoundHitAuthority> {
    const out = new Map<string, RewoundHitAuthority>();
    if (!Number.isFinite(serverTimeMs) || this.buffer.length === 0) return out;
    const first = this.buffer.at(0), last = this.buffer.at(-1);
    if (first === undefined || last === undefined) return out;
    const at = Math.max(first.serverTimeMs, Math.min(last.serverTimeMs, serverTimeMs));
    let before = first, after = first;
    if (at <= first.serverTimeMs) before = after = first;
    else if (at >= last.serverTimeMs) before = after = last;
    else {
      let prior = first;
      for (const candidate of this.buffer.slice(1)) {
        if (candidate.serverTimeMs >= at) {
          before = prior;
          after = candidate;
          break;
        }
        prior = candidate;
      }
    }
    for (const [id, a] of before.frames) {
      const b = after.frames.get(id);
      if (b === undefined) continue;
      const sampled = this.sample(a, b, before.serverTimeMs, after.serverTimeMs, at);
      if (sampled !== undefined) out.set(id, sampled);
    }
    return out;
  }

  clear(): void { this.buffer.length = 0; }

  private sample(a: HitAuthorityFrame, b: HitAuthorityFrame, aTime: number, bTime: number,
    at: number): RewoundHitAuthority | undefined {
    let selected = a;
    let root = a.root;
    if (a.segmentSeq !== b.segmentSeq) {
      if (b.segmentStartedAt <= aTime || b.segmentStartedAt > bTime) return undefined;
      selected = at < b.segmentStartedAt ? a : b;
      root = selected.root;
    } else {
      if (a.segmentStartedAt !== b.segmentStartedAt || !sameIdentity(a.identity, b.identity)
        || b.timeline.currentStartedAt < a.timeline.currentStartedAt
        || b.reaction.startedAt < a.reaction.startedAt) return undefined;
      const alpha = bTime > aTime ? (at - aTime) / (bTime - aTime) : 0;
      root = {
        x: a.root.x + (b.root.x - a.root.x) * alpha,
        z: a.root.z + (b.root.z - a.root.z) * alpha,
        feetY: a.root.feetY + (b.root.feetY - a.root.feetY) * alpha,
        yaw: interpolateYaw(a.root.yaw, b.root.yaw, alpha),
      };
      selected = { ...a, root, timeline: selectTimeline(a.timeline, b.timeline, at),
        reaction: selectReaction(a.reaction, b.reaction, at) };
    }
    const actions = sampleHitAnimationTimeline(selected.timeline, at);
    const reaction = sampleHitReaction(selected.reaction, at);
    if (actions === undefined || reaction === undefined) return undefined;
    const pose = this.evaluator({ identity: selected.identity, actions, reaction });
    if (pose === undefined || !finite([root.x, root.z, root.feetY, root.yaw, pose.headRadius,
      pose.groundOffsetY, pose.bodyRadiusUpperBound, pose.hitVolume.headCenter.x,
      pose.hitVolume.headCenter.y, pose.hitVolume.headCenter.z, pose.hitVolume.bodyTopY])
      || pose.headRadius <= 0 || pose.bodyRadiusUpperBound < 0) return undefined;
    return { ...root, hitVolume: { headCenter: { ...pose.hitVolume.headCenter },
      bodyTopY: pose.hitVolume.bodyTopY }, headRadius: pose.headRadius,
      groundOffsetY: pose.groundOffsetY, bodyRadiusUpperBound: pose.bodyRadiusUpperBound,
      segmentSeq: selected.segmentSeq };
  }
}
