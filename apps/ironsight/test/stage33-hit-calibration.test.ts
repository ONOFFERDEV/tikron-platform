import { describe, expect, it } from "vitest";
import fixture from "../src/data/stage33-hit-calibration.json";
import {
  STAGE33_HIT_IDENTITIES,
} from "../src/stage33-hit-calibration.js";
import { stage33HitProvider } from "./helpers/stage33-hit-provider.js";
import { HitVolumeHistory } from "../src/hit-volume-history.js";
import { validateHitClaim } from "../src/hit-claim.js";
import { resolveHitscan, targetHitVolume, type HitTarget } from "../src/hitscan.js";
import type { HitAnimationClip } from "../src/hit-state-bucket.js";
import type { Vec3 } from "../src/physics.js";

const provider = stage33HitProvider;
const khaki = STAGE33_HIT_IDENTITIES.khaki;

function direction(from: Vec3, to: Vec3): Vec3 {
  const x = to.x - from.x, y = to.y - from.y, z = to.z - from.z;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

describe("inactive Stage33 adaptive steady hit calibration", () => {
  it("binds the approved source identities and exact measured knots", () => {
    expect(provider.activation).toBe(false);
    expect(provider.knotCount).toBe(830);
    expect(provider.certificate).toMatchObject({
      sourceDatasetSha256: "4e32de0849cc8b7012788583e1a414fe6c7911337ba336dff76974165d420e7a",
      independentReviewSha256: "b3257efa71fdbbce0d30bbcfb523077836f7830279c67af452c0177cc65a1f1b",
      interpolationQualified: true,
      interpolationBudgetM: 0.005,
      acceptsExternalData: false,
      bundledGeneratedData: true,
      transitionQualified: false,
      reactionQualified: false,
      activationBlocked: true,
    });
    expect(provider.at(khaki, "rifle_idle", 0)).toEqual({
      hitVolume: {
        headCenter: {
          x: -0.011306431917259704,
          y: 1.662153308854545,
          z: 0.050124867647684423,
        },
        bodyTopY: 1.5677103311555152,
      },
      headRadius: 0.1253003103155765,
      interpolationErrorM: 0,
    });
    expect(provider.at(STAGE33_HIT_IDENTITIES.fieldgrey, "pistol_crouch_walk", 0)).toBeDefined();
  });

  it("uses the exact certified duration and loops by shared phase modulo", () => {
    const duration = provider.duration(khaki, "rifle_walk")!;
    expect(duration).toBe(1.3333333730697632);
    expect(provider.at(khaki, "rifle_walk", duration)).toEqual(provider.at(khaki, "rifle_walk", 0));
    expect(provider.at(khaki, "rifle_walk", duration * 2.25))
      .toEqual(provider.at(khaki, "rifle_walk", duration * 0.25));
  });

  it("stays within the independently held-out five-millimetre surface budget", () => {
    for (const witness of fixture.validationWitnesses) {
      const clip = witness.clip as HitAnimationClip;
      const duration = provider.duration(khaki, clip)!;
      const measured = provider.at(khaki, clip, witness.fraction * duration)!;
      const actual = witness.actual as [readonly [number, number, number], number, number];
      const actualCenter = actual[0];
      const centerError = Math.hypot(
        measured.hitVolume.headCenter.x - actualCenter[0],
        measured.hitVolume.headCenter.y - actualCenter[1],
        measured.hitVolume.headCenter.z - actualCenter[2],
      );
      const rawRadius = measured.headRadius - measured.interpolationErrorM;
      const rawTop = measured.hitVolume.bodyTopY - measured.interpolationErrorM;
      expect(centerError).toBeLessThanOrEqual(0.005);
      expect(Math.abs(rawRadius - actual[1])).toBeLessThanOrEqual(0.005);
      expect(Math.abs(rawTop - actual[2])).toBeLessThanOrEqual(0.005);
      expect(centerError + actual[1]).toBeLessThanOrEqual(measured.headRadius);
      expect(measured.interpolationErrorM).toBeLessThan(0.02);
    }
  });

  it("fails closed on wrong identities, unknown clips and invalid time", () => {
    expect(provider.at({ ...khaki, glbSha256: "current-product" }, "rifle_idle", 0)).toBeUndefined();
    expect(provider.at(khaki, "hit_head" as HitAnimationClip, 0)).toBeUndefined();
    expect(provider.at(khaki, "rifle_idle", -0.001)).toBeUndefined();
  });

  it("drives directional world geometry, head/body/part and cover through real consumers", () => {
    const measured = provider.at(khaki, "rifle_walk", provider.duration(khaki, "rifle_walk")! * 0.25)!;
    const target: HitTarget = { id: "victim", x: 3, z: 10, feetY: 1, headY: 2.8,
      yaw: Math.PI / 2, hitVolume: measured.hitVolume, team: 1 };
    const world = targetHitVolume(target, measured.headRadius);
    expect(world.headCenter.x).toBeCloseTo(3 + measured.hitVolume.headCenter.z, 12);
    expect(world.headCenter.z).toBeCloseTo(10 - measured.hitVolume.headCenter.x, 12);
    const origin = { x: 3, y: 2.1, z: 0 };
    const headDir = direction(origin, world.headCenter);
    const bodyDir = direction(origin, { x: target.x, y: target.feetY + 0.9, z: target.z });
    const config = { radius: 0.4, headRadius: measured.headRadius };
    expect(resolveHitscan(origin, headDir, 30, 0, [target], [], config))
      .toMatchObject({ id: target.id, part: "head" });
    expect(resolveHitscan(origin, bodyDir, 30, 0, [target], [], config))
      .toMatchObject({ id: target.id, part: "body" });
    const claim = { claim: { id: target.id, part: "head" as const }, shooterTeam: 0,
      targets: [target], origin, range: 30, accuracySpread: 0, ramps: [], hitRadius: 0.4,
      headRadius: measured.headRadius, coneMarginM: 0.3 };
    expect(validateHitClaim({ ...claim, aimDir: bodyDir, boxes: [] }))
      .toMatchObject({ accepted: false, reason: "part" });
    const cover = { min: { x: 2.5, y: 1.5, z: 5 }, max: { x: 3.5, y: 3, z: 5.2 } };
    expect(validateHitClaim({ ...claim, aimDir: headDir, boxes: [cover] }))
      .toMatchObject({ accepted: false, reason: "occluded" });
  });

  it("keeps adaptive world channels coherent through same-time rewind", () => {
    const history = new HitVolumeHistory();
    const duration = provider.duration(khaki, "rifle_walk")!;
    const first = provider.at(khaki, "rifle_walk", duration * 0.25)!;
    const second = provider.at(khaki, "rifle_walk", duration * 0.5)!;
    for (const [tick, time, rootX, hit] of [[1, 100, 10, first], [2, 200, 12, second]] as const) {
      history.record(tick, time, {
        roots: new Map([["victim", { x: rootX, z: 20 }]]), feetYs: new Map([["victim", 1]]),
        headCenters: new Map([["victim", { x: rootX + hit.hitVolume.headCenter.x,
          y: 1 + hit.hitVolume.headCenter.y, z: 20 + hit.hitVolume.headCenter.z }]]),
        bodyTopYs: new Map([["victim", 1 + hit.hitVolume.bodyTopY]]),
      });
    }
    const rewound = history.atTime(150).get("victim")!;
    const world = targetHitVolume({ id: "victim", headY: 1.8, team: 1, ...rewound }, first.headRadius);
    expect(world.headCenter.x).toBeCloseTo(11
      + (first.hitVolume.headCenter.x + second.hitVolume.headCenter.x) / 2, 12);
    expect(world.bodyTopY).toBeCloseTo(1
      + (first.hitVolume.bodyTopY + second.hitVolume.bodyTopY) / 2, 12);
  });
});
