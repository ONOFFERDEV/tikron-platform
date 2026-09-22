import { describe, expect, it, vi } from "vitest";
import { sampleHitAnimationTimeline, sampleHitReaction, type HitAnimationTimeline } from "../src/hit-animation-timeline.js";
import { sampleStage33HitRigPose, type HitRigPoseSampleInput } from "../src/hit-rig-pose.js";
import {
  HitVolumeHistory,
  type HitAuthorityEvaluator,
  type HitAuthorityFrame,
} from "../src/hit-volume-history.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";
import { targetHitVolume } from "../src/hitscan.js";

const identity = STAGE33_HIT_IDENTITIES.khaki;
const timeline = (currentIndex = 0, currentStartedAt = 0): HitAnimationTimeline => ({
  currentIndex, currentStartedAt, sources: [],
});
const frame = (values: Partial<HitAuthorityFrame> = {}): HitAuthorityFrame => ({
  identity,
  root: { x: 0, z: 10, feetY: 1, yaw: 0 },
  timeline: timeline(),
  reaction: { kind: 0, startedAt: 0, seq: 0 },
  segmentSeq: 1,
  segmentStartedAt: 0,
  ...values,
});
const sample = {
  hitVolume: { headCenter: { x: 1, y: 1.5, z: 0 }, bodyTopY: 1.4 },
  headRadius: 0.13,
  groundOffsetY: 0.07,
  bodyRadiusUpperBound: 0.48,
};

describe("segment-aware authoritative hit history", () => {
  it("interpolates root and shortest yaw once while preserving actor-local geometry", () => {
    const evaluate = vi.fn<HitAuthorityEvaluator>(() => sample);
    const history = new HitVolumeHistory({}, evaluate);
    history.recordAuthority(1, 100, new Map([["target", frame({
      root: { x: 0, z: 10, feetY: 1, yaw: 350 * Math.PI / 180 },
    })]]));
    history.recordAuthority(2, 200, new Map([["target", frame({
      root: { x: 10, z: 20, feetY: 3, yaw: 10 * Math.PI / 180 },
    })]]));

    const result = history.authorityAtTime(150).get("target")!;
    expect(result).toMatchObject({ x: 5, z: 15, feetY: 2, headRadius: 0.13,
      groundOffsetY: 0.07, bodyRadiusUpperBound: 0.48, segmentSeq: 1 });
    expect(Math.abs(result.yaw)).toBeLessThan(1e-12);
    const world = targetHitVolume({ id: "target", headY: 9, team: 1, ...result }, result.headRadius);
    expect(world.headCenter).toEqual({ x: 6, y: 3.5, z: 15 });
    expect(evaluate).toHaveBeenCalledOnce();
  });

  it("selects timeline and reaction independently at their absolute epochs", () => {
    const evaluate: HitAuthorityEvaluator = input => {
      const current = input.actions.at(-1)!;
      return { ...sample, hitVolume: { headCenter: {
        x: current.clipIndex, y: input.reaction?.kind ?? -1, z: current.phaseMs,
      }, bodyTopY: input.reaction?.ageMs ?? -1 } };
    };
    const history = new HitVolumeHistory({}, evaluate);
    history.recordAuthority(1, 100, new Map([["target", frame()]]));
    history.recordAuthority(2, 200, new Map([["target", frame({
      timeline: timeline(1, 160), reaction: { kind: 2, startedAt: 180, seq: 1 },
    })]]));
    expect(history.authorityAtTime(170).get("target")?.hitVolume)
      .toEqual({ headCenter: { x: 1, y: 0, z: 10 }, bodyTopY: 170 });
    expect(history.authorityAtTime(190).get("target")?.hitVolume)
      .toEqual({ headCenter: { x: 1, y: 2, z: 30 }, bodyTopY: 10 });
  });

  it("snaps root and geometry at an explicit segment boundary", () => {
    const evaluate: HitAuthorityEvaluator = input => ({ ...sample,
      hitVolume: { ...sample.hitVolume, headCenter: { ...sample.hitVolume.headCenter,
        x: input.actions.at(-1)!.clipIndex } } });
    const history = new HitVolumeHistory({}, evaluate);
    history.recordAuthority(1, 100, new Map([["target", frame({ timeline: timeline(0) })]]));
    history.recordAuthority(2, 200, new Map([["target", frame({
      root: { x: 100, z: 50, feetY: 4, yaw: 1 }, timeline: timeline(2, 160),
      segmentSeq: 2, segmentStartedAt: 160,
    })]]));
    expect(history.authorityAtTime(159).get("target")).toMatchObject({ x: 0, z: 10,
      feetY: 1, segmentSeq: 1, hitVolume: { headCenter: { x: 0 } } });
    expect(history.authorityAtTime(160).get("target")).toMatchObject({ x: 100, z: 50,
      feetY: 4, segmentSeq: 2, hitVolume: { headCenter: { x: 2 } } });
  });

  it("copies frames and omits missing, inconsistent, invalid or unevaluable authority", () => {
    const mutable = frame();
    const first = new Map([["target", mutable]]);
    const history = new HitVolumeHistory({}, () => sample);
    history.recordAuthority(1, 100, first);
    (mutable.root as { x: number }).x = 99;
    (mutable.timeline.sources as unknown as { clipIndex: number }[]).push({ clipIndex: 2 });
    history.recordAuthority(2, 200, new Map([["target", frame({ identity: {
      ...identity, glbSha256: "different",
    } })]]));
    expect(history.authorityAtTime(100).get("target")?.x).toBe(0);
    expect(history.authorityAtTime(150).has("target")).toBe(false);

    const absent = new HitVolumeHistory({}, () => sample);
    absent.recordAuthority(1, 100, new Map([["target", frame()]]));
    absent.recordAuthority(2, 200, new Map());
    expect(absent.authorityAtTime(150).size).toBe(0);
    const stale = new HitVolumeHistory({}, () => sample);
    stale.recordAuthority(1, 100, new Map([["target", frame({ timeline: timeline(1, 80) })]]));
    stale.recordAuthority(2, 200, new Map([["target", frame({ timeline: timeline(0, 70) })]]));
    expect(stale.authorityAtTime(150).size).toBe(0);
    const invalidBoundary = new HitVolumeHistory({}, () => sample);
    invalidBoundary.recordAuthority(1, 100, new Map([["target", frame()]]));
    invalidBoundary.recordAuthority(2, 200, new Map([["target", frame({
      segmentSeq: 2, segmentStartedAt: 100,
    })]]));
    expect(invalidBoundary.authorityAtTime(150).size).toBe(0);
    const invalid = new HitVolumeHistory({}, () => undefined);
    invalid.recordAuthority(1, 100, new Map([["target", frame({ root: {
      x: Number.NaN, z: 0, feetY: 0, yaw: 0,
    } })]]));
    expect(invalid.authorityAtTime(100).size).toBe(0);
    const invalidRadius = new HitVolumeHistory({}, () => ({ ...sample, headRadius: 0 }));
    invalidRadius.recordAuthority(1, 100, new Map([["target", frame()]]));
    expect(invalidRadius.authorityAtTime(100).size).toBe(0);
    expect(new HitVolumeHistory().authorityAtTime(100).size).toBe(0);
  });

  it("preserves bounded retention, endpoint clamp and clear", () => {
    const history = new HitVolumeHistory({ depthMs: 100, maxSnapshots: 2 }, () => sample);
    history.recordAuthority(1, 100, new Map([["target", frame({ root: { x: 1, z: 0, feetY: 0, yaw: 0 } })]]));
    history.recordAuthority(2, 150, new Map([["target", frame({ root: { x: 2, z: 0, feetY: 0, yaw: 0 } })]]));
    history.recordAuthority(3, 200, new Map([["target", frame({ root: { x: 3, z: 0, feetY: 0, yaw: 0 } })]]));
    expect(history.authoritySize).toBe(2);
    expect(history.authorityAtTime(-1).get("target")?.x).toBe(2);
    expect(history.authorityAtTime(999).get("target")?.x).toBe(3);
    history.clear();
    expect(history.authoritySize).toBe(0);
    expect(history.authorityAtTime(150).size).toBe(0);
  });

  it("uses the latest same-clock reset and rejects non-monotonic records", () => {
    const history = new HitVolumeHistory({}, () => sample);
    history.recordAuthority(1, 100, new Map([["target", frame({
      root: { x: 1, z: 0, feetY: 0, yaw: 0 },
    })]]));
    history.recordAuthority(2, 100, new Map([["target", frame({
      root: { x: 50, z: 0, feetY: 0, yaw: 0 }, segmentSeq: 2, segmentStartedAt: 100,
    })]]));
    history.recordAuthority(3, 200, new Map([["target", frame({
      root: { x: 60, z: 0, feetY: 0, yaw: 0 }, segmentSeq: 2, segmentStartedAt: 100,
    })]]));
    expect(history.authorityAtTime(100).get("target")?.x).toBe(50);
    expect(history.authorityAtTime(150).get("target")?.x).toBe(55);
    history.recordAuthority(4, 90, new Map([["target", frame({
      root: { x: 99, z: 0, feetY: 0, yaw: 0 },
    })]]));
    history.recordAuthority(3, 250, new Map([["target", frame({
      root: { x: 99, z: 0, feetY: 0, yaw: 0 },
    })]]));
    expect(history.authoritySize).toBe(2);
    expect(history.authorityAtTime(999).get("target")?.x).toBe(60);
  });

  it("matches the shared hierarchical evaluator at the exact rewind stamp", () => {
    const history = new HitVolumeHistory({}, sampleStage33HitRigPose);
    const authority = frame({ timeline: timeline(0, 0) });
    history.recordAuthority(1, 200, new Map([["target", authority]]));
    history.recordAuthority(2, 300, new Map([["target", authority]]));
    const at = 250;
    const actions = sampleHitAnimationTimeline(authority.timeline, at)!;
    const reaction = sampleHitReaction(authority.reaction, at)!;
    const direct = sampleStage33HitRigPose({ identity, actions, reaction })!;
    const rewound = history.authorityAtTime(at).get("target")!;
    expect(rewound.hitVolume).toEqual(direct.hitVolume);
    expect(rewound.headRadius).toBe(direct.headRadius);
    expect(rewound.groundOffsetY).toBe(direct.groundOffsetY);
    expect(rewound.bodyRadiusUpperBound).toBe(direct.bodyRadiusUpperBound);
  });
});
