import { describe, expect, it } from "vitest";
import {
  advanceHitAnimationStamp,
  sampleLoopingHitAnimation,
  selectHitAnimationSnap,
} from "../src/hit-animation-authority.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";
import { stage33HitProvider } from "./helpers/stage33-hit-provider.js";
import { targetHitVolume } from "../src/hitscan.js";

describe("server-clock hit animation authority", () => {
  it("keeps one epoch for an unchanged clip and resets on a bucket transition", () => {
    const idle = advanceHitAnimationStamp(undefined, "rifle_idle", 1_000, false)!;
    expect(advanceHitAnimationStamp(idle, "rifle_idle", 1_200, false)).toBe(idle);
    expect(advanceHitAnimationStamp(idle, "rifle_walk", 1_200, false))
      .toEqual({ clip: "rifle_walk", startedAtMs: 1_200 });
  });

  it("force-restarts the same clip for respawn or authoritative discontinuity", () => {
    const old = { clip: "rifle_idle", startedAtMs: 1_000 };
    expect(advanceHitAnimationStamp(old, old.clip, 2_000, true))
      .toEqual({ clip: "rifle_idle", startedAtMs: 2_000 });
  });

  it("samples a certified duration by exact server-clock modulo after snapshot restore", () => {
    const provider = stage33HitProvider;
    const identity = STAGE33_HIT_IDENTITIES.khaki;
    const duration = provider.duration(identity, "rifle_walk")!;
    const restored = JSON.parse(JSON.stringify({ clip: "rifle_walk", startedAtMs: 1_000 })) as {
      clip: string; startedAtMs: number };
    const server = sampleLoopingHitAnimation(restored, 1_000 + duration * 1_250, duration)!;
    const client = sampleLoopingHitAnimation(restored, 1_000 + duration * 1_250, duration)!;
    expect(client).toEqual(server);
    expect(server.timeSeconds).toBeCloseTo(duration * 0.25, 12);
    const measured = provider.at(identity, server.clip, server.timeSeconds)!;
    const world = targetHitVolume({ id: "victim", x: 4, z: 8, feetY: 1, headY: 1.8,
      yaw: 0, hitVolume: measured.hitVolume, team: 1 }, measured.headRadius);
    expect(world.headCenter.x).toBeCloseTo(4 + measured.hitVolume.headCenter.x, 12);
  });

  it("returns no calibrated sample for invalid clocks or an uncertified duration", () => {
    const stamp = { clip: "rifle_idle", startedAtMs: 1_000 };
    expect(sampleLoopingHitAnimation(stamp, 999, 2.5)).toBeUndefined();
    expect(sampleLoopingHitAnimation(stamp, 1_100, undefined)).toBeUndefined();
    expect(sampleLoopingHitAnimation(stamp, 1_100, 0)).toBeUndefined();
    expect(advanceHitAnimationStamp(stamp, "", 1_100, false)).toBeUndefined();
  });

  it("selects the same discrete visual and HIT geometry at the server epoch", () => {
    const before = { headCenter: { x: -0.0113, y: 1.594, z: 0.0501 }, bodyTopY: 1.5 };
    const after = { headCenter: { x: 0.0352, y: 0.9186, z: 0.4800 }, bodyTopY: 1.0 };
    expect(Math.abs(before.headCenter.y - after.headCenter.y)).toBeGreaterThan(0.48);
    expect(selectHitAnimationSnap(before, after, 1_499.999, 1_500)).toBe(before);
    expect(selectHitAnimationSnap(before, after, 1_500, 1_500)).toBe(after);
    expect(selectHitAnimationSnap(before, after, Number.NaN, 1_500)).toBeUndefined();
    const selected = selectHitAnimationSnap(before, after, 1_500, 1_500)!;
    const world = targetHitVolume({ id: "victim", x: 3, z: 7, feetY: 2, headY: 1.8,
      yaw: 0, hitVolume: selected, team: 1 }, 0.1253);
    expect(world.headCenter).toEqual({ x: 3.0352, y: 2.9186, z: 7.48 });
  });
});
