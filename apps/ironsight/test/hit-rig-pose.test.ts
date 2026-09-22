import { describe, expect, it } from "vitest";
import fixture from "./fixtures/hit-rig-pose.json";
import mixed from "./fixtures/hit-rig-pose-mixed.json";
import { sampleStage33HitRigPose } from "../src/hit-rig-pose.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";

describe("Stage33 hierarchical HIT rig pose", () => {
  it("reconstructs independently sampled steady head and torso placement", () => {
    for (const row of fixture) {
      const faction = row.faction === "khaki" ? "khaki" : "fieldgrey";
      const sample = sampleStage33HitRigPose({
        identity: STAGE33_HIT_IDENTITIES[faction],
        actions: [{ clipIndex: row.clipIndex, phaseMs: row.phaseMs, weight: 1, current: true }],
      });
      expect(sample).toBeDefined();
      expect(
        Math.hypot(
          sample!.hitVolume.headCenter.x - (row.headCenter[0] ?? Number.NaN),
          sample!.hitVolume.headCenter.y - (row.headCenter[1] ?? Number.NaN),
          sample!.hitVolume.headCenter.z - (row.headCenter[2] ?? Number.NaN),
        ),
        `${row.faction}:${row.clip}:head`,
      ).toBeLessThan(0.005);
      expect(
        Math.abs(sample!.headRadius - row.headRadius),
        `${row.faction}:${row.clip}:radius`,
      ).toBeLessThan(0.005);
      expect(
        Math.abs(sample!.hitVolume.bodyTopY - row.bodyTopY),
        `${row.faction}:${row.clip}:bodyTop`,
      ).toBeLessThan(0.005);
      expect(
        Math.abs(sample!.groundOffsetY - row.groundOffsetY),
        `${row.faction}:${row.clip}:ground`,
      ).toBeLessThan(0.005);
    }
  });
  it("matches full-rig crossfade, reversal, grounding, and reaction fixtures", () => {
    for (const row of mixed) {
      const faction = row.faction === "khaki" ? "khaki" : "fieldgrey";
      const reaction =
        row.reaction === null
          ? undefined
          : { ...row.reaction, kind: row.reaction.kind === 1 ? (1 as const) : (2 as const) };
      const sample = sampleStage33HitRigPose({
        identity: STAGE33_HIT_IDENTITIES[faction],
        actions: row.actions,
        reaction,
      });
      expect(sample, row.label).toBeDefined();
      const expected = row.expected;
      expect(
        Math.hypot(
          sample!.hitVolume.headCenter.x - (expected.head.center[0] ?? Number.NaN),
          sample!.hitVolume.headCenter.y - (expected.head.center[1] ?? Number.NaN),
          sample!.hitVolume.headCenter.z - (expected.head.center[2] ?? Number.NaN),
        ),
        `${row.label}:head`,
      ).toBeLessThan(0.005);
      expect(
        Math.abs(sample!.headRadius - expected.head.radius),
        `${row.label}:radius`,
      ).toBeLessThan(0.005);
      expect(
        Math.abs(sample!.hitVolume.bodyTopY - expected.torso.topY),
        `${row.label}:bodyTop`,
      ).toBeLessThan(0.005);
      expect(
        Math.abs(sample!.groundOffsetY - expected.groundOffsetY),
        `${row.label}:ground`,
      ).toBeLessThan(0.005);
    }
  });

  it("fails closed on invalid identity and action samples", () => {
    const identity = { ...STAGE33_HIT_IDENTITIES.khaki, glbSha256: "stale" };
    expect(
      sampleStage33HitRigPose({
        identity,
        actions: [{ clipIndex: 0, phaseMs: 0, weight: 1, current: true }],
      }),
    ).toBeUndefined();
    expect(
      sampleStage33HitRigPose({ identity: STAGE33_HIT_IDENTITIES.khaki, actions: [] }),
    ).toBeUndefined();
    expect(
      sampleStage33HitRigPose({
        identity: STAGE33_HIT_IDENTITIES.khaki,
        actions: [{ clipIndex: 99, phaseMs: 0, weight: 1, current: true }],
      }),
    ).toBeUndefined();
  });

  it("is history-independent across factions, reversals, and additive reactions", () => {
    const target = [
      { clipIndex: 0, phaseMs: 375, weight: 0.35, current: false },
      { clipIndex: 4, phaseMs: 125, weight: 0.65, current: true },
    ] as const;
    const diversion = [
      { clipIndex: 2, phaseMs: 80, weight: 0.4, current: false },
      { clipIndex: 1, phaseMs: 40, weight: 0.6, current: true },
    ] as const;
    for (const faction of ["khaki", "fieldgrey"] as const) {
      const identity = STAGE33_HIT_IDENTITIES[faction];
      const reaction = { kind: 2 as const, ageMs: 50, seq: 7 };
      const fresh = sampleStage33HitRigPose({ identity, actions: target, reaction });
      sampleStage33HitRigPose({ identity, actions: diversion, reaction: { ...reaction, kind: 1 } });
      const repeated = sampleStage33HitRigPose({ identity, actions: target, reaction });
      expect(repeated).toEqual(fresh);
      expect(repeated).toMatchObject({
        hitVolume: { headCenter: { x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) }, bodyTopY: expect.any(Number) },
        headRadius: expect.any(Number),
        bodyRadiusUpperBound: expect.any(Number),
        groundOffsetY: expect.any(Number),
      });
    }
  });
});
