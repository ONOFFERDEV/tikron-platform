import { describe, expect, it } from "vitest";
import { resolveHitscan } from "../src/hitscan.js";
import { nearestOccluder, rayRamp } from "../src/ray-occlusion.js";
import { rampOccluderBoxes } from "../src/map/tilemap.js";
import { ARENA2 } from "../src/map/arena2.js";

const ramp = { minX: 0, maxX: 9, minZ: -1, maxZ: 1, baseY: 0, topY: 3, axis: "x", dir: 1 } as const;

describe("exact ramp ray occlusion", () => {
  it.each([
    ["x", 1, { x: 2.25, y: 4, z: 0 }, 3.25],
    ["x", -1, { x: 2.25, y: 4, z: 0 }, 1.75],
    ["z", 1, { x: 0, y: 4, z: 2.25 }, 3.25],
    ["z", -1, { x: 0, y: 4, z: 2.25 }, 1.75],
  ] as const)("matches rampSurfaceY for axis %s direction %s", (axis, direction, origin, expected) => {
    const candidate = axis === "x"
      ? { ...ramp, axis, dir: direction }
      : { minX: -1, maxX: 1, minZ: 0, maxZ: 9, baseY: 0, topY: 3, axis, dir: direction };
    expect(rayRamp(origin, { x: 0, y: -1, z: 0 }, candidate, 10)).toBeCloseTo(expected, 8);
  });

  it("supports below-grade bases and treats an origin inside the solid as firing out", () => {
    const below = { ...ramp, baseY: -3, topY: 0 };
    expect(rayRamp({ x: 4.5, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }, below, 10)).toBeCloseTo(3.5, 8);
    expect(rayRamp({ x: 4.5, y: -2, z: 0 }, { x: 1, y: 0, z: 0 }, below, 10)).toBeNull();
  });

  it("intersects the true wedge surface instead of the three-step approximation", () => {
    const origin = { x: -1, y: 0.5, z: 0 }, dir = { x: 1, y: 0, z: 0 };
    const exact = rayRamp(origin, dir, ramp, 20);
    const shared = nearestOccluder(origin, dir, [], [ramp], 20);
    const obsoleteStairs = nearestOccluder(origin, dir, rampOccluderBoxes(ramp), [], 20);
    expect(exact).toBeCloseTo(2.5, 8);
    expect(shared).toBeCloseTo(2.5, 8);
    expect(obsoleteStairs).toBeCloseTo(1, 8);
    console.log(JSON.stringify({ tag: "exactWedgeRay", origin, dir, exact, shared, obsoleteStairs,
      mismatchM: exact === null ? null : exact - obsoleteStairs }));
  });

  it("preserves inclusive footprint boundaries and rejects points 20mm outside", () => {
    const dir = { x: 1, y: 0, z: 0 };
    expect(rayRamp({ x: -1, y: 0.5, z: ramp.maxZ - 0.02 }, dir, ramp, 20)).not.toBeNull();
    expect(rayRamp({ x: -1, y: 0.5, z: ramp.maxZ }, dir, ramp, 20)).not.toBeNull();
    expect(rayRamp({ x: -1, y: 0.5, z: ramp.maxZ + 0.02 }, dir, ramp, 20)).toBeNull();
  });

  it("keeps box and terrain-support boundary pairs exact at 20mm", () => {
    const box = { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 1, z: 2 } };
    const dir = { x: 0, y: 0, z: 1 };
    expect(nearestOccluder({ x: box.max.x - 0.02, y: box.max.y - 0.02, z: -1 }, dir, [box], [], 10)).toBe(1);
    expect(nearestOccluder({ x: box.max.x + 0.02, y: box.max.y - 0.02, z: -1 }, dir, [box], [], 10)).toBe(Infinity);
    expect(nearestOccluder({ x: 1, y: box.max.y + 0.02, z: -1 }, dir, [box], [], 10)).toBe(Infinity);
    const terrain = ARENA2.terrain?.boxes[0];
    expect(terrain).toBeDefined();
    if (terrain === undefined) return;
    const x = (terrain.min.x + terrain.max.x) / 2;
    expect(nearestOccluder({ x, y: terrain.max.y + 1, z: terrain.min.z + 0.02 }, { x: 0, y: -1, z: 0 }, [terrain], [], 10)).toBe(1);
    expect(nearestOccluder({ x, y: terrain.max.y + 1, z: terrain.min.z - 0.02 }, { x: 0, y: -1, z: 0 }, [terrain], [], 10)).toBe(Infinity);
  });

  it("uses the same exact ramp for static and rewound hitscan targets", () => {
    const origin = { x: -1, y: 0.5, z: 0 }, dir = { x: 1, y: 0, z: 0 };
    const target = { id: "victim", x: 8, z: 0, feetY: 0, headY: 1.8, team: 1 };
    for (const targets of [[target], [{ ...target }]]) {
      expect(resolveHitscan(origin, dir, 20, 0, targets, [], { radius: 0.4, headRadius: 0.22 }, true, [ramp])).toBeNull();
    }
    expect(resolveHitscan(origin, dir, 20, 0, [target], [], { radius: 0.4, headRadius: 0.22 }, true)).toMatchObject({ id: "victim" });
  });
});
