import { describe, expect, it } from "vitest";
import { rotateHitVolume, type SoldierHitVolume } from "../src/hit-calibration.js";
import { resolveHitscan } from "../src/hitscan.js";
import { validateHitClaim } from "../src/hit-claim.js";

const explicitVolume: SoldierHitVolume = { headCenter: { x: 0, y: 1.6, z: .2 }, bodyTopY: 1.4 };

describe("explicit soldier hit volume seam", () => {
  it("rotates a caller-supplied local volume without product defaults", () => {
    expect(rotateHitVolume(explicitVolume, 0)).toEqual(explicitVolume);
    const quarterTurn = rotateHitVolume(explicitVolume, Math.PI / 2).headCenter;
    expect(quarterTurn.x).toBeCloseTo(.2, 12); expect(quarterTurn.y).toBe(1.6);
    expect(quarterTurn.z).toBeCloseTo(0, 12);
  });

  it("keeps ordinary targets on the legacy volume even when yaw is present", () => {
    const origin = { x: 0, y: 1.65, z: 0 }, direction = { x: 0, y: 0, z: 1 };
    const target = { id: "victim", x: 0, z: 10, feetY: 0, headY: 1.8, team: 1 };
    expect(resolveHitscan(origin, direction, 20, 0, [target], [], { radius: .4, headRadius: .22 }))
      .toEqual(resolveHitscan(origin, direction, 20, 0, [{ ...target, yaw: Math.PI }], [],
        { radius: .4, headRadius: .22 }));
  });

  it("shares an explicit volume between analytic and typed claims and still honors cover", () => {
    const target = { id: "victim", x: 0, z: 10, feetY: 0, headY: 1.8, team: 1,
      yaw: 0, hitVolume: explicitVolume };
    const origin = { x: 0, y: 1.65, z: 0 };
    const center = { x: 0, y: 1.6, z: 10.2 };
    const length = Math.hypot(center.y - origin.y, center.z);
    const direction = { x: 0, y: (center.y - origin.y) / length, z: center.z / length };
    expect(resolveHitscan(origin, direction, 20, 0, [target], [],
      { radius: .4, headRadius: .22 })).toMatchObject({ id: target.id, part: "head" });
    const base = { claim: { id: target.id, part: "head" as const }, shooterTeam: 0, targets: [target],
      origin, aimDir: direction, range: 20, accuracySpread: 0, ramps: [], hitRadius: .4,
      headRadius: .22, coneMarginM: .3 };
    expect(validateHitClaim({ ...base, boxes: [] })).toMatchObject({ accepted: true, part: "head" });
    const cover = { min: { x: -.5, y: 1.4, z: 5 }, max: { x: .5, y: 1.9, z: 5.2 } };
    expect(validateHitClaim({ ...base, boxes: [cover] })).toMatchObject({ accepted: false, reason: "occluded" });
  });

  it("uses a target's measured head radius for both analytic and claim part authority", () => {
    const target = { id: "victim", x: 0, z: 10, feetY: 0, headY: 1.8, team: 1,
      yaw: 0, hitVolume: explicitVolume, headRadius: 0.08 };
    const origin = { x: 0, y: 1.65, z: 0 };
    const edge = { x: 0.12, y: 1.6, z: 10.2 };
    const length = Math.hypot(edge.x, edge.y - origin.y, edge.z);
    const aimDir = { x: edge.x / length, y: (edge.y - origin.y) / length, z: edge.z / length };
    expect(resolveHitscan(origin, aimDir, 20, 0, [{ ...target, headRadius: undefined }], [],
      { radius: 0.4, headRadius: 0.22 })).toMatchObject({ id: target.id, part: "head" });
    expect(resolveHitscan(origin, aimDir, 20, 0, [target], [], { radius: 0.4, headRadius: 0.22 }))
      .toBeNull();
    expect(validateHitClaim({
      claim: { id: target.id, part: "head" }, shooterTeam: 0, targets: [target], origin, aimDir,
      range: 20, accuracySpread: 0, boxes: [], ramps: [], hitRadius: 0.4,
      headRadius: 0.22, coneMarginM: 0.3,
    })).toMatchObject({ accepted: false, reason: "part" });
  });
});
