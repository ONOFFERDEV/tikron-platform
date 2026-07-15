// Hit-resolution matrix (Stage 4 gate — hitbox/visual audit, is-anim): asserts
// resolveHitscan's head/body/miss判定 directly against HIT's dimensions, for
// both a standing and a crouching target — the crouching case is the one
// Stage 1 actually changed (HIT.crouchHeight 1.1 → 1.54, re-derived from the
// live rig's measured head-bone height; see src/config.ts's HIT doc comment).
// resolveHitscan is a pure function (its own header: "unit-tests without a
// room or timers"), so these go straight at it — no createTestRoom needed.
import { describe, it, expect } from "vitest";
import { resolveHitscan, type HitTarget, type HitConfig } from "../src/hitscan.js";
import { HIT } from "../src/config.js";

const CFG: HitConfig = { radius: HIT.radius, headRadius: HIT.headRadius };
const ORIGIN = { x: 0, y: 1.65, z: 0 }; // shooter eye height, standEye
const RANGE = 100;
const DIST = 10; // target distance downrange

function target(feetY: number, headY: number): HitTarget {
  return { id: "victim", x: 0, z: DIST, feetY, headY, team: 1 };
}

/** A ray from ORIGIN toward (0, y, DIST) — same pattern as arena-room.test.ts's
 *  BODY_PITCH/HEAD_PITCH, but expressed as a raw direction vector since this
 *  test calls resolveHitscan directly instead of going through a room. */
function dirAt(y: number): { x: number; y: number; z: number } {
  const dx = 0 - ORIGIN.x;
  const dy = y - ORIGIN.y;
  const dz = DIST - ORIGIN.z;
  const len = Math.hypot(dx, dy, dz);
  return { x: dx / len, y: dy / len, z: dz / len };
}

describe("resolveHitscan — standing target (HIT.standHeight)", () => {
  const feetY = 0;
  const headY = feetY + HIT.standHeight;
  const headCentreY = headY - HIT.headRadius;

  it("a shot at the head-sphere centre is a headshot", () => {
    const hit = resolveHitscan(ORIGIN, dirAt(headCentreY), RANGE, 0, [target(feetY, headY)], [], CFG, true);
    expect(hit?.part).toBe("head");
  });

  it("a shot at chest height is a body hit", () => {
    const hit = resolveHitscan(ORIGIN, dirAt(1.0), RANGE, 0, [target(feetY, headY)], [], CFG, true);
    expect(hit?.part).toBe("body");
  });

  it("a shot well above the crown misses", () => {
    const hit = resolveHitscan(ORIGIN, dirAt(headY + 1.0), RANGE, 0, [target(feetY, headY)], [], CFG, true);
    expect(hit).toBeNull();
  });
});

describe("resolveHitscan — crouching target (HIT.crouchHeight, Stage 1's fix)", () => {
  const feetY = 0;
  const headY = feetY + HIT.crouchHeight;
  const headCentreY = headY - HIT.headRadius;

  it("a shot at the crouching head-sphere centre is a headshot", () => {
    const hit = resolveHitscan(ORIGIN, dirAt(headCentreY), RANGE, 0, [target(feetY, headY)], [], CFG, true);
    expect(hit?.part).toBe("head");
  });

  it("a shot at crouching chest height is a body hit", () => {
    const hit = resolveHitscan(ORIGIN, dirAt(0.7), RANGE, 0, [target(feetY, headY)], [], CFG, true);
    expect(hit?.part).toBe("body");
  });

  it("a shot well above the crouching crown misses", () => {
    const hit = resolveHitscan(ORIGIN, dirAt(headY + 1.0), RANGE, 0, [target(feetY, headY)], [], CFG, true);
    expect(hit).toBeNull();
  });

  it("regression guard: a shot at the OLD crouchHeight (1.1) assumption's head-sphere spot no longer reads as a headshot — it now falls inside the taller body cylinder instead", () => {
    const oldAssumedHeadCentreY = 1.1 - HIT.headRadius; // pre-fix formula's head-sphere centre
    const hit = resolveHitscan(ORIGIN, dirAt(oldAssumedHeadCentreY), RANGE, 0, [target(feetY, headY)], [], CFG, true);
    // Proves HIT.crouchHeight's change is real (not a no-op): under the old
    // formula this point WAS the head-sphere centre; under the fixed
    // dimensions it's just chest height on the now-taller cylinder.
    expect(hit?.part).toBe("body");
  });
});
