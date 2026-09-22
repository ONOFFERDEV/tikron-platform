import { HIT_ANIMATION_CLIPS } from "./hit-state-bucket";

export const HIT_CROSSFADE_MS = 150;
export const HIT_ANIMATION_SOURCE_CAP = HIT_ANIMATION_CLIPS.length - 1;

export interface HitFadeSource {
  readonly clipIndex: number;
  readonly phaseStartedAt: number;
  readonly fadeOutStartedAt: number;
}

export interface HitAnimationTimeline {
  readonly currentIndex: number;
  readonly currentStartedAt: number;
  readonly sources: readonly HitFadeSource[];
}

export interface HitAnimationActionSample {
  readonly clipIndex: number;
  readonly phaseMs: number;
  readonly weight: number;
  readonly current: boolean;
}

export type HitReactionKind = 0 | 1 | 2;

export interface HitReactionStamp {
  readonly kind: number;
  readonly startedAt: number;
  readonly seq: number;
}

export interface HitReactionSample {
  readonly kind: HitReactionKind;
  readonly ageMs: number;
  readonly seq: number;
}

function validClipIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < HIT_ANIMATION_CLIPS.length;
}

function validTimeline(timeline: HitAnimationTimeline): boolean {
  if (!validClipIndex(timeline.currentIndex) || !Number.isFinite(timeline.currentStartedAt)
    || timeline.sources.length > HIT_ANIMATION_SOURCE_CAP) return false;
  const identities = new Set<number>();
  for (const source of timeline.sources) {
    if (!validClipIndex(source.clipIndex) || source.clipIndex === timeline.currentIndex
      || identities.has(source.clipIndex) || !Number.isFinite(source.phaseStartedAt)
      || !Number.isFinite(source.fadeOutStartedAt)
      || source.phaseStartedAt > source.fadeOutStartedAt
      || source.fadeOutStartedAt > timeline.currentStartedAt) return false;
    identities.add(source.clipIndex);
  }
  return true;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function advanceHitAnimationTimeline(
  previous: HitAnimationTimeline | undefined,
  nextIndex: number,
  at: number,
  forceRestart = false,
): HitAnimationTimeline | undefined {
  if (!validClipIndex(nextIndex) || !Number.isFinite(at)) return undefined;
  if (previous === undefined) return { currentIndex: nextIndex, currentStartedAt: at, sources: [] };
  if (!validTimeline(previous) || at < previous.currentStartedAt) return undefined;
  if (previous.currentIndex === nextIndex && !forceRestart) return previous;

  const sources = previous.sources.filter(source =>
    source.fadeOutStartedAt + HIT_CROSSFADE_MS > at && source.clipIndex !== nextIndex);
  if (previous.currentIndex !== nextIndex) {
    sources.push({
      clipIndex: previous.currentIndex,
      phaseStartedAt: previous.currentStartedAt,
      fadeOutStartedAt: at,
    });
  }
  if (sources.length > HIT_ANIMATION_SOURCE_CAP) return undefined;
  sources.sort((left, right) => left.clipIndex - right.clipIndex);
  return { currentIndex: nextIndex, currentStartedAt: at, sources };
}

export function sampleHitAnimationTimeline(
  timeline: HitAnimationTimeline,
  at: number,
): readonly HitAnimationActionSample[] | undefined {
  if (!validTimeline(timeline) || !Number.isFinite(at) || at < timeline.currentStartedAt) return undefined;
  const outgoing = timeline.sources.flatMap(source => {
    const weight = clampUnit(1 - (at - source.fadeOutStartedAt) / HIT_CROSSFADE_MS);
    return weight > 0 ? [{
      clipIndex: source.clipIndex,
      phaseMs: at - source.phaseStartedAt,
      weight,
      current: false,
    }] : [];
  });
  outgoing.sort((left, right) => left.clipIndex - right.clipIndex);
  return [...outgoing, {
    clipIndex: timeline.currentIndex,
    phaseMs: at - timeline.currentStartedAt,
    weight: clampUnit((at - timeline.currentStartedAt) / HIT_CROSSFADE_MS),
    current: true,
  }];
}

export function sampleHitReaction(
  stamp: HitReactionStamp,
  at: number,
): HitReactionSample | undefined {
  if ((stamp.kind !== 0 && stamp.kind !== 1 && stamp.kind !== 2)
    || !Number.isFinite(stamp.startedAt) || !Number.isFinite(at)
    || !Number.isInteger(stamp.seq) || stamp.seq < 0 || stamp.seq > 65_535) return undefined;
  return { kind: stamp.kind, ageMs: Math.max(0, at - stamp.startedAt), seq: stamp.seq };
}
