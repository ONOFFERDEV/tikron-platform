import { describe, expect, it } from "vitest";
import { MOVE, PLAYER } from "../src/config.js";
import { CoreCollision } from "../src/core-gate.js";
import { surfaceForBox, surfaceForRamp, surfaceForTerrainFace } from "../src/map/materials.js";
import { ARENA1 } from "../src/map/arena1.js";
import { canStand, moveAndSlide, nearestBox, type Box, type Vec3 } from "../src/physics.js";

const LOWER_ROUTE: readonly Vec3[] = [
  { x: 36, y: 0, z: 76 },
  { x: 46, y: -3, z: 76 },
  { x: 52, y: -3, z: 77.6 },
  { x: 55, y: -3, z: 77.6 },
  { x: 63, y: -3, z: 74.4 },
  { x: 67, y: -3, z: 74.4 },
  { x: 79, y: -3, z: 77.6 },
  { x: 83, y: -3, z: 77.6 },
  { x: 91, y: -3, z: 74.4 },
  { x: 95, y: -3, z: 74.4 },
  { x: 104, y: -3, z: 76 },
  { x: 114, y: 0, z: 76 },
];

const ROOF_OBSERVATION_POINTS: readonly Vec3[] = [
  { x: 51, y: 3, z: 41.5 },
  { x: 99, y: 3, z: 41.5 },
];

function walkRoute(points: readonly Vec3[]): readonly Vec3[] {
  const samples: Vec3[] = [];
  let position = points[0];
  if (position === undefined) return samples;
  samples.push(position);
  for (const target of points.slice(1)) {
    let remaining = 1_500;
    while (Math.hypot(target.x - position.x, target.z - position.z) > 0.03 && remaining > 0) {
      remaining -= 1;
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      const distance = Math.hypot(dx, dz);
      const stride = Math.min(0.1, distance);
      const result = moveAndSlide(
        position,
        PLAYER.radius,
        PLAYER.standHeight,
        { x: dx / distance * stride, y: -0.025, z: dz / distance * stride },
        -0.5,
        ARENA1.boxes,
        ARENA1.bounds,
        MOVE.stepUp,
        ARENA1.ramps,
      );
      position = result.pos;
      samples.push(position);
      expect(result.grounded).toBe(true);
    }
    expect(remaining, JSON.stringify(target)).toBeGreaterThan(0);
    expect(position.y).toBeCloseTo(target.y, 2);
  }
  return samples;
}

function directSightline(from: Vec3, to: Vec3, boxes: readonly Box[]): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dy, dz);
  return nearestBox(from, { x: dx / distance, y: dy / distance, z: dz / distance }, boxes, distance) >= distance;
}

describe("WW1 Relay lower supply road", () => {
  it("walks the authored S-turn in both directions with the real capsule", () => {
    for (const route of [LOWER_ROUTE, [...LOWER_ROUTE].reverse()]) {
      const samples = walkRoute(route);
      expect(Math.min(...samples.map((point) => point.y))).toBe(-3);
    }
  });

  it("alternates four standing traverses while retaining two metres of passage", () => {
    const trench = ARENA1.structures?.find((structure) => structure.id === "freight-trench");
    const traverses = trench?.parts
      .filter((part) => part.kind === "cover" && part.box.max.y - part.box.min.y >= 1.8)
      .map((part) => part.box) ?? [];

    expect(traverses).toHaveLength(4);
    traverses.forEach((box, index) => {
      expect(box.min.z - 73).toBeCloseTo([0.4, 2.4, 0.4, 2.4][index]!, 6);
      expect(6 - (box.max.z - box.min.z)).toBeCloseTo(2.8, 6);
    });
  });

  it("rejects trench shortcut through earth", () => {
    const origin = { x: 75, y: -1.35, z: 74 };
    const north = { x: 0, y: 0, z: -1 };
    const collision = new CoreCollision(ARENA1);
    const trench = ARENA1.structures?.find((structure) => structure.id === "freight-trench");
    const removed = new Set([
      ...(ARENA1.terrain?.boxes ?? []),
      ...(trench?.parts.filter((part) => part.kind === "wall").map((part) => part.box) ?? []),
    ]);

    expect(nearestBox(origin, north, collision.closedHits, 8)).toBeLessThan(1);
    expect(nearestBox(origin, north, collision.closedHits.filter((box) => !removed.has(box)), 8)).toBe(Infinity);
  });
});

describe("WW1 Relay communications courtyard", () => {
  it("keeps the southern objective outside the lower capture cylinder and within the rotation contract", () => {
    expect(ARENA1.caps.b).toEqual({ x: 75, y: 0, z: 85 });
    expect(ARENA1.caps.b.z - (ARENA1.terrain?.cut.maxZ ?? 0)).toBeGreaterThan(4);
  });

  it("keeps the event hut compact so north and south circulation never depends on its shutters", () => {
    expect(ARENA1.signalCore?.chamber).toEqual({
      min: { x: 72, y: 0, z: 51 },
      max: { x: 78, y: 2.72, z: 55 },
    });
    for (const point of [{ x: 68, y: 0, z: 53 }, { x: 82, y: 0, z: 53 }]) {
      expect(canStand(point.x, point.y, point.z, PLAYER.radius, PLAYER.standHeight, ARENA1.boxes, ARENA1.bounds)).toBe(true);
    }
  });

  it("keeps paired room doors open and wall shots blocked", () => {
    for (const x of [41, 109]) {
      expect(nearestBox({ x, y: PLAYER.standEye, z: 46 }, { x: 0, y: 0, z: -1 }, ARENA1.boxes, 4)).toBe(Infinity);
    }
    for (const x of [53, 97]) {
      expect(nearestBox({ x, y: PLAYER.standEye, z: 46 }, { x: 0, y: 0, z: -1 }, ARENA1.boxes, 4)).toBeLessThan(4);
    }
  });

  it("rejects roof sightline into spawn", () => {
    const spawnEyes = [...ARENA1.spawns.red, ...ARENA1.spawns.blue]
      .map((point) => ({ ...point, y: PLAYER.standEye }));
    const exposed = ROOF_OBSERVATION_POINTS.flatMap((point) => spawnEyes
      .filter((spawn) => directSightline({ ...point, y: point.y + PLAYER.standEye }, spawn, ARENA1.boxes)));

    expect(exposed).toEqual([]);
    expect(ROOF_OBSERVATION_POINTS.some((point) => spawnEyes
      .some((spawn) => directSightline({ ...point, y: point.y + PLAYER.standEye }, spawn, [])))).toBe(true);
  });
});

describe("WW1 Relay support materials", () => {
  it("binds every collision and support face exactly once", () => {
    const expected = ARENA1.boxes.length + (ARENA1.ramps?.length ?? 0) + (ARENA1.terrain?.faces.length ?? 0);
    expect(ARENA1.surfaceBindings).toHaveLength(expected);
    for (const box of ARENA1.boxes) expect(surfaceForBox(ARENA1, box)).toBeDefined();
    for (const ramp of ARENA1.ramps ?? []) expect(surfaceForRamp(ARENA1, ramp)).toBeDefined();
    for (const face of ARENA1.terrain?.faces ?? []) expect(surfaceForTerrainFace(ARENA1, face)).toBeDefined();
  });

  it("uses the complete approved surface vocabulary", () => {
    expect(new Set(ARENA1.surfaceBindings?.map((binding) => binding.surface))).toEqual(
      new Set(["mud", "gravel", "wood", "metal", "brick"]),
    );
  });
});
