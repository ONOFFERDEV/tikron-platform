import { describe, expect, it } from "vitest";
import {
  decodeHitAnimationClip,
  encodeHitAnimationClip,
  HIT_ANIMATION_CLIPS,
  HIT_ANIMATION_NONE,
  hitAnimationLocomotion,
  hitAnimationWeaponIndex,
  hitStateBucket,
} from "../src/hit-state-bucket.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";
import { stage33HitProvider } from "./helpers/stage33-hit-provider.js";
import { HIT } from "../src/config.js";
import { resolveHitscan } from "../src/hitscan.js";

const state = { alive: true, crouch: false, weapon: 0, yaw: 0, dx: 0, dz: 0, dtSeconds: 0.05 };
const policy = { idleMax: 0.5, walkMax: 7, crouchSpeed: 3, hasCrouchClips: true,
  hasSprintClip: true, weaponFamilies: ["rifle", "smg", "shotgun", "sniper", "pistol"] as const };

describe("Stage33 server-derivable hit state bucket", () => {
  it("round-trips the single 30-clip wire table and reserves sentinel 255", () => {
    expect(HIT_ANIMATION_CLIPS).toHaveLength(30);
    for (const clip of HIT_ANIMATION_CLIPS) {
      expect(decodeHitAnimationClip(encodeHitAnimationClip(clip))).toBe(clip);
    }
    expect(hitAnimationLocomotion("shotgun_crouch_idle")).toBe("crouch_idle");
    expect(hitAnimationLocomotion("rifle_strafe_left")).toBe("strafe_left");
    expect(hitAnimationWeaponIndex("rifle_strafe_left")).toBe(0);
    expect(hitAnimationWeaponIndex("smg_idle")).toBe(1);
    expect(hitAnimationWeaponIndex("shotgun_crouch_walk")).toBe(2);
    expect(hitAnimationWeaponIndex("sniper_sprint")).toBe(3);
    expect(hitAnimationWeaponIndex("pistol_idle")).toBe(4);
    expect(encodeHitAnimationClip("rifle_run")).toBe(HIT_ANIMATION_NONE);
    expect(encodeHitAnimationClip("hit_head")).toBe(HIT_ANIMATION_NONE);
    expect(decodeHitAnimationClip(HIT_ANIMATION_NONE)).toBeUndefined();
  });

  it.each([
    [{ ...state }, "rifle_idle"],
    [{ ...state, dz: 0.2 }, "rifle_walk"],
    [{ ...state, dz: 0.4 }, "rifle_sprint"],
    [{ ...state, crouch: true }, "rifle_crouch_idle"],
    [{ ...state, crouch: true, dz: 0.1 }, "rifle_crouch_walk"],
    [{ ...state, crouch: true, dz: 0.2 }, "rifle_crouch_idle"],
    [{ ...state, dx: 0.2 }, "rifle_strafe_left"],
    [{ ...state, dx: -0.2 }, "rifle_strafe_right"],
    [{ ...state, dz: -0.2 }, "rifle_backpedal"],
    [{ ...state, weapon: 1, dx: 0.2 }, "smg_walk"],
    [{ ...state, weapon: 4 }, "pistol_idle"],
  ] as const)("maps existing authoritative fields to %s", (input, expected) => {
    expect(hitStateBucket(input, policy)?.clip).toBe(expected);
  });

  it("matches threshold, capability and rotated local-basis edges", () => {
    expect(hitStateBucket({ ...state, dtSeconds: 1, dz: 0.5 }, policy)?.locomotion).toBe("walk");
    expect(hitStateBucket({ ...state, dtSeconds: 1, dz: 7 }, policy)?.locomotion).toBe("sprint");
    expect(hitStateBucket({ ...state, dtSeconds: 1, dz: 7 }, { ...policy, hasSprintClip: false })?.locomotion)
      .toBe("run");
    expect(hitStateBucket({ ...state, crouch: true, dz: 0.1 },
      { ...policy, hasCrouchClips: false })?.locomotion).toBe("walk");
    expect(hitStateBucket({ ...state, crouch: true, dtSeconds: 1, dz: 3.75 }, policy)?.locomotion)
      .toBe("crouch_walk");
    expect(hitStateBucket({ ...state, yaw: Math.PI / 2, dz: -0.2 }, policy)?.locomotion)
      .toBe("strafe_left");
  });

  it("returns no calibrated bucket for dead, invalid-time, non-finite or unknown-weapon state", () => {
    expect(hitStateBucket({ ...state, alive: false }, policy)).toBeUndefined();
    expect(hitStateBucket({ ...state, dtSeconds: 0 }, policy)).toBeUndefined();
    expect(hitStateBucket({ ...state, dx: Number.NaN }, policy)).toBeUndefined();
    expect(hitStateBucket({ ...state, weapon: 5 }, policy)).toBeUndefined();
  });

  it("feeds the exact bucket into the inactive provider and real resolver", () => {
    const bucket = hitStateBucket({ ...state, weapon: 3, dz: 0.2 }, policy)!;
    expect(bucket).toEqual({ clip: "sniper_walk", locomotion: "walk", weaponFamily: "sniper" });
    const provider = stage33HitProvider;
    const measured = provider.at(STAGE33_HIT_IDENTITIES.khaki, bucket.clip, 0)!;
    const origin = { x: 0, y: measured.hitVolume.headCenter.y, z: 0 };
    const center = { x: measured.hitVolume.headCenter.x, y: measured.hitVolume.headCenter.y,
      z: 10 + measured.hitVolume.headCenter.z };
    const length = Math.hypot(center.x, center.z);
    const direction = { x: center.x / length, y: 0, z: center.z / length };
    expect(resolveHitscan(origin, direction, 20, 0, [{ id: "victim", x: 0, z: 10,
      feetY: 0, headY: 1.8, yaw: 0, hitVolume: measured.hitVolume, team: 1 }], [],
    { radius: HIT.radius, headRadius: HIT.headRadius }))
      .toMatchObject({ id: "victim", part: "head" });
  });

  it("proves a phase-less walk sphere exceeds the 20 mm head edge", () => {
    const provider = stage33HitProvider;
    const start = provider.at(STAGE33_HIT_IDENTITIES.khaki, "rifle_walk", 0)!;
    const mid = provider.at(STAGE33_HIT_IDENTITIES.khaki, "rifle_walk", 0.6666666865348816)!;
    const a = start.hitVolume.headCenter, b = mid.hitVolume.headCenter;
    const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const envelope = {
      headCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
      bodyTopY: Math.max(start.hitVolume.bodyTopY, mid.hitVolume.bodyTopY),
    };
    const envelopeRadius = Math.max(start.headRadius, mid.headRadius) + distance / 2;
    expect(distance).toBeGreaterThan(0.04);
    expect(envelopeRadius - start.headRadius).toBeGreaterThan(0.02);

    const edgeX = a.x - start.headRadius - 0.0201;
    const origin = { x: edgeX, y: envelope.headCenter.y, z: 0 };
    const target = { id: "victim", x: 0, z: 10, feetY: 0, headY: 1.8, yaw: 0, team: 1 };
    expect(resolveHitscan(origin, { x: 0, y: 0, z: 1 }, 20, 0,
      [{ ...target, hitVolume: start.hitVolume }], [],
      { radius: HIT.radius, headRadius: start.headRadius })).toBeNull();
    expect(resolveHitscan(origin, { x: 0, y: 0, z: 1 }, 20, 0,
      [{ ...target, hitVolume: envelope }], [],
      { radius: HIT.radius, headRadius: envelopeRadius }))
      .toMatchObject({ id: "victim", part: "head" });
  });
});
