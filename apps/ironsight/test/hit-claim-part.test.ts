import { describe, expect, it } from "vitest";
import { validateHitClaim } from "../src/hit-claim.js";
import { resolveHitscan, type HitTarget } from "../src/hitscan.js";
import type { Vec3 } from "../src/physics.js";

function direction(from: Vec3, to: Vec3): Vec3 {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const z = to.z - from.z;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

const target: HitTarget = {
  id: "victim",
  x: 0,
  z: 10,
  feetY: 0,
  headY: 1.8,
  yaw: 0,
  hitVolume: { headCenter: { x: 0, y: 1.62, z: 0 }, bodyTopY: 1.49 },
  team: 1,
};
const origin = { x: 0, y: 1.65, z: 0 };
const config = { radius: 0.4, headRadius: 0.13 };

function claim(aimDir: Vec3, accuracySpread = 0) {
  return validateHitClaim({
    claim: { id: target.id, part: "head" },
    shooterTeam: 0,
    targets: [target],
    origin,
    aimDir,
    range: 100,
    accuracySpread,
    boxes: [],
    ramps: [],
    hitRadius: config.radius,
    headRadius: config.headRadius,
    coneMarginM: 0.3,
  });
}

describe("hybrid claim part authority", () => {
  it("does not upgrade an upper-body ray that misses the head into head damage", () => {
    const upperBody = direction(origin, { x: 0, y: 1.43, z: target.z });
    expect(resolveHitscan(origin, upperBody, 100, 0, [target], [], config))
      .toMatchObject({ id: target.id, part: "body" });
    expect(claim(upperBody)).toMatchObject({ accepted: false, reason: "part" });
  });

  it("does not let controlled weapon spread promote a body ray to a head claim", () => {
    const upperBody = direction(origin, { x: 0, y: 1.43, z: target.z });
    expect(claim(upperBody, 0.08)).toMatchObject({ accepted: false, reason: "part" });
  });

  it("accepts a genuine head ray and preserves edge cover rejection", () => {
    const head = direction(origin, { x: 0, y: 1.62, z: target.z });
    expect(resolveHitscan(origin, head, 100, 0, [target], [], config))
      .toMatchObject({ id: target.id, part: "head" });
    expect(claim(head)).toMatchObject({ accepted: true, part: "head" });

    const covered = validateHitClaim({
      claim: { id: target.id, part: "head" }, shooterTeam: 0, targets: [target], origin,
      aimDir: head, range: 100, accuracySpread: 0, hitRadius: config.radius,
      headRadius: config.headRadius, coneMarginM: 0.3, ramps: [],
      boxes: [{ min: { x: -0.13, y: 1.48, z: 5 }, max: { x: 0.13, y: 1.75, z: 5.02 } }],
    });
    expect(covered).toMatchObject({ accepted: false, reason: "occluded" });
  });
});
