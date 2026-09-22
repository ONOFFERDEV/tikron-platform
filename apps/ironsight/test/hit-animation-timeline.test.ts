import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  HIT_CROSSFADE_MS,
  advanceHitAnimationTimeline,
  sampleHitAnimationTimeline,
  sampleHitReaction,
  type HitAnimationTimeline,
} from "../src/hit-animation-timeline";

function start(clipIndex = 0, at = 0): HitAnimationTimeline {
  const timeline = advanceHitAnimationTimeline(undefined, clipIndex, at);
  if (timeline === undefined) throw new Error("valid initial timeline was rejected");
  return timeline;
}

function advance(timeline: HitAnimationTimeline, clipIndex: number, at: number): HitAnimationTimeline {
  const next = advanceHitAnimationTimeline(timeline, clipIndex, at);
  if (next === undefined) throw new Error("valid transition was rejected");
  return next;
}

describe("authoritative hit animation timeline", () => {
  it("samples a rapid transition with independent unnormalized weights", () => {
    // Given
    const timeline = advance(start(), 1, 50);
    // When
    const sample = sampleHitAnimationTimeline(timeline, 100);
    // Then
    expect(sample).toMatchObject([
      { clipIndex: 0, phaseMs: 100, current: false },
      { clipIndex: 1, phaseMs: 50, current: true },
    ]);
    expect(sample?.[0]?.weight).toBeCloseTo(2 / 3);
    expect(sample?.[1]?.weight).toBeCloseTo(1 / 3);
    expect(sample?.reduce((sum, action) => sum + action.weight, 0)).toBe(1);
  });

  it("preserves each source absolute fade deadline across later transitions", () => {
    // Given
    const first = advance(start(), 1, 50);
    const second = advance(first, 2, 100);
    // When
    const beforeDeadline = sampleHitAnimationTimeline(second, 199);
    const atDeadline = sampleHitAnimationTimeline(second, 200);
    // Then
    expect(beforeDeadline?.find(action => action.clipIndex === 0)?.weight).toBeCloseTo(1 / 150);
    expect(atDeadline?.some(action => action.clipIndex === 0)).toBe(false);
    expect(second.sources.find(source => source.clipIndex === 0)?.fadeOutStartedAt).toBe(50);
  });

  it("does not renormalize overlapping positive source weights", () => {
    // Given
    const timeline = advance(advance(start(), 1, 50), 2, 100);
    // When
    const sample = sampleHitAnimationTimeline(timeline, 125);
    // Then
    expect(sample?.map(action => action.weight)).toEqual([0.5, 5 / 6, 1 / 6]);
    expect(sample?.reduce((sum, action) => sum + action.weight, 0)).toBeCloseTo(1.5);
  });

  it("retains at most three outgoing clips over more than ten nominal 50ms transitions", () => {
    // Given
    let timeline = start();
    // When
    for (let index = 1; index <= 11; index += 1) timeline = advance(timeline, index, index * 50);
    // Then
    expect(timeline.sources).toHaveLength(3);
    expect(timeline.sources.map(source => source.fadeOutStartedAt)).toEqual([450, 500, 550]);
  });

  it("retains the fourth positive source under 49ms scheduler jitter", () => {
    // Given
    let timeline = start();
    // When
    for (let index = 1; index <= 11; index += 1) timeline = advance(timeline, index, index * 49);
    // Then
    expect(timeline.sources).toHaveLength(4);
    expect(sampleHitAnimationTimeline(timeline, 539)?.filter(action => !action.current)).toHaveLength(4);
  });

  it("supports all thirty clips at one server timestamp without duplicate identities", () => {
    // Given
    let timeline = start(0, 100);
    // When
    for (let index = 1; index < 30; index += 1) timeline = advance(timeline, index, 100);
    // Then
    expect(timeline.currentIndex).toBe(29);
    expect(timeline.sources).toHaveLength(29);
    expect(new Set(timeline.sources.map(source => source.clipIndex)).size).toBe(29);
    expect(sampleHitAnimationTimeline(timeline, 100)?.at(-1)).toEqual(
      { clipIndex: 29, phaseMs: 0, weight: 0, current: true },
    );
  });

  it("reversal removes the target source before fading the old current", () => {
    // Given
    const outward = advance(advance(start(), 1, 50), 2, 100);
    // When
    const reversed = advance(outward, 0, 125);
    // Then
    expect(reversed).toEqual({
      currentIndex: 0,
      currentStartedAt: 125,
      sources: [
        { clipIndex: 1, phaseStartedAt: 50, fadeOutStartedAt: 100 },
        { clipIndex: 2, phaseStartedAt: 100, fadeOutStartedAt: 125 },
      ],
    });
  });

  it("orders sources by clip index and applies the current clip last", () => {
    // Given
    const timeline = advance(advance(advance(start(9), 2, 10), 7, 20), 4, 30);
    // When
    const sample = sampleHitAnimationTimeline(timeline, 40);
    // Then
    expect(sample?.map(action => action.clipIndex)).toEqual([2, 7, 9, 4]);
    expect(sample?.map(action => action.current)).toEqual([false, false, false, true]);
  });

  it("force-restarts the current clip like Three without creating an outgoing duplicate", () => {
    // Given
    const timeline = advance(start(), 1, 50);
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const actions = ["a", "b"].map(name => mixer.clipAction(new THREE.AnimationClip(name, 2, [])));
    const first = actions[0];
    const second = actions[1];
    if (first === undefined || second === undefined) throw new Error("Three actions missing");
    first.reset().fadeIn(0.15).play();
    mixer.update(0.05);
    second.reset().fadeIn(0.15).play();
    first.fadeOut(0.15);
    mixer.update(0.025);
    // When
    const restarted = advanceHitAnimationTimeline(timeline, 1, 75, true);
    second.reset().fadeIn(0.15).play();
    mixer.update(0.05);
    // Then
    expect(restarted).toEqual({
      currentIndex: 1,
      currentStartedAt: 75,
      sources: [{ clipIndex: 0, phaseStartedAt: 0, fadeOutStartedAt: 50 }],
    });
    const sample = restarted === undefined ? undefined : sampleHitAnimationTimeline(restarted, 125);
    expect(sample?.find(action => action.clipIndex === 0)?.weight).toBeCloseTo(first.getEffectiveWeight(), 6);
    expect(sample?.find(action => action.clipIndex === 1)?.weight).toBeCloseTo(second.getEffectiveWeight(), 6);
    expect((sample?.find(action => action.clipIndex === 0)?.phaseMs ?? -1) / 1_000).toBeCloseTo(first.time, 6);
    expect((sample?.find(action => action.clipIndex === 1)?.phaseMs ?? -1) / 1_000).toBeCloseTo(second.time, 6);
  });

  it("matches real Three fade scheduling through a partial transition and reversal", () => {
    // Given
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const actions = ["a", "b"].map(name => mixer.clipAction(new THREE.AnimationClip(name, 2, [])));
    const first = actions[0];
    const second = actions[1];
    if (first === undefined || second === undefined) throw new Error("Three actions missing");
    first.reset().fadeIn(0.15).play();
    mixer.update(0.05);
    second.reset().fadeIn(0.15).play();
    first.fadeOut(0.15);
    mixer.update(0.05);
    first.reset().fadeIn(0.15).play();
    second.fadeOut(0.15);
    mixer.update(0.05);
    // When
    const timeline = advance(advance(advance(start(), 1, 50), 0, 100), 0, 100);
    const sample = sampleHitAnimationTimeline(timeline, 150);
    // Then
    expect(sample?.find(action => action.clipIndex === 0)?.weight).toBeCloseTo(first.getEffectiveWeight(), 6);
    expect(sample?.find(action => action.clipIndex === 1)?.weight).toBeCloseTo(second.getEffectiveWeight(), 6);
  });

  it("rejects malformed, duplicate, over-capacity, and clock-regressed state", () => {
    // Given
    const duplicate: HitAnimationTimeline = { currentIndex: 2, currentStartedAt: 100, sources: [
      { clipIndex: 1, phaseStartedAt: 0, fadeOutStartedAt: 50 },
      { clipIndex: 1, phaseStartedAt: 10, fadeOutStartedAt: 60 },
    ] };
    const oversized: HitAnimationTimeline = { currentIndex: 0, currentStartedAt: 100,
      sources: Array.from({ length: 30 }, (_, clipIndex) => ({ clipIndex, phaseStartedAt: 0, fadeOutStartedAt: 50 })) };
    // When / Then
    expect(sampleHitAnimationTimeline(duplicate, 100)).toBeUndefined();
    expect(sampleHitAnimationTimeline(oversized, 100)).toBeUndefined();
    expect(advanceHitAnimationTimeline(start(2, 100), 3, 99)).toBeUndefined();
    expect(advanceHitAnimationTimeline(start(), 30, 100)).toBeUndefined();
    expect(sampleHitAnimationTimeline({ currentIndex: 2, currentStartedAt: 100, sources: [
      { clipIndex: 2, phaseStartedAt: 0, fadeOutStartedAt: 50 },
    ] }, 100)).toBeUndefined();
    expect(sampleHitAnimationTimeline({ currentIndex: 2, currentStartedAt: 100, sources: [
      { clipIndex: 1, phaseStartedAt: 70, fadeOutStartedAt: 60 },
    ] }, 100)).toBeUndefined();
  });

  it("restores a mid-fade sample from epochs without receipt-local state", () => {
    // Given
    const restored: HitAnimationTimeline = { currentIndex: 4, currentStartedAt: 1_000, sources: [
      { clipIndex: 3, phaseStartedAt: 400, fadeOutStartedAt: 1_000 },
    ] };
    // When
    const sample = sampleHitAnimationTimeline(restored, 1_075);
    // Then
    expect(sample).toEqual([
      { clipIndex: 3, phaseMs: 675, weight: 0.5, current: false },
      { clipIndex: 4, phaseMs: 75, weight: 0.5, current: true },
    ]);
  });

  it("samples reaction epoch and sequence while rejecting malformed wire values", () => {
    // Given / When / Then
    expect(sampleHitReaction({ kind: 2, startedAt: 1_000, seq: 65_535 }, 1_120)).toEqual(
      { kind: 2, ageMs: 120, seq: 65_535 },
    );
    expect(sampleHitReaction({ kind: 1, startedAt: 1_000, seq: 7 }, 900)).toEqual(
      { kind: 1, ageMs: 0, seq: 7 },
    );
    expect(sampleHitReaction({ kind: 3, startedAt: 1_000, seq: 0 }, 1_000)).toBeUndefined();
    expect(sampleHitReaction({ kind: 0, startedAt: Number.NaN, seq: 0 }, 1_000)).toBeUndefined();
    expect(sampleHitReaction({ kind: 0, startedAt: 0, seq: 65_536 }, 1_000)).toBeUndefined();
  });

  it("exports the exact 150ms contract constant", () => {
    expect(HIT_CROSSFADE_MS).toBe(150);
  });
});
