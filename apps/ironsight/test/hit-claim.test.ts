import { describe, expect, it } from "vitest";
import { readHitClaim, validateHitClaim } from "../src/hit-claim.js";

const target = { id: "victim", x: 0, z: 10, feetY: 0, headY: 1.8, team: 1 };
const base = {
  claim: { id: "victim", part: "body" as const }, shooterTeam: 0,
  targets: [target], origin: { x: 0, y: 1.65, z: 0 }, aimDir: { x: 0, y: -0.065, z: 0.997885 },
  range: 100, accuracySpread: 0, boxes: [], ramps: [], hitRadius: 0.4, headRadius: 0.22, coneMarginM: 0.3,
};

describe("hit claim boundary", () => {
  it("distinguishes missing, malformed, explicit miss and valid hit without changing fallback semantics", () => {
    expect(readHitClaim({}, "claim")).toEqual({ kind: "absent", source: "missing" });
    expect(readHitClaim({ claim: { id: 4, part: "body" } }, "claim")).toEqual({ kind: "absent", source: "malformed" });
    expect(readHitClaim({ claim: null }, "claim")).toEqual({ kind: "miss" });
    expect(readHitClaim({ claim: { id: "victim", part: "head" } }, "claim"))
      .toEqual({ kind: "hit", claim: { id: "victim", part: "head" } });
  });

  it("returns stable rejection reasons and preserves the reported part on acceptance", () => {
    const accepted = validateHitClaim(base);
    expect(accepted).toMatchObject({ accepted: true, part: "body" });
    expect(validateHitClaim({ ...base, claim: { id: "ghost", part: "body" } })).toEqual({ accepted: false, reason: "no-target" });
    expect(validateHitClaim({ ...base, targets: [{ ...target, team: 0 }] })).toEqual({ accepted: false, reason: "friendly" });
    expect(validateHitClaim({ ...base, range: 5 })).toEqual({ accepted: false, reason: "range" });
    expect(validateHitClaim({ ...base, aimDir: { x: 1, y: 0, z: 0 } })).toMatchObject({ accepted: false, reason: "cone" });
    console.log(JSON.stringify({ tag: "hitClaimDecision", accepted }));
  });

  it("rejects exact wedge occlusion rather than the obsolete stair silhouette", () => {
    const ramp = { minX: -1, maxX: 1, minZ: 2, maxZ: 8, baseY: 0, topY: 2, axis: "z", dir: 1 } as const;
    expect(validateHitClaim({ ...base, ramps: [ramp] })).toMatchObject({ accepted: false, reason: "occluded" });
  });
});
