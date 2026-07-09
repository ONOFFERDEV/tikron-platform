import { describe, it, expect } from "vitest";
import {
  canStand,
  moveAndSlide,
  nearestBox,
  rayAabb,
  raySphere,
  rayVerticalCylinder,
  type Box,
  type Bounds,
} from "../src/physics.js";
import { resolveHitscan, type HitTarget } from "../src/hitscan.js";
import { PLAYER } from "../src/config.js";

const BOUNDS: Bounds = { width: 60, depth: 40, ceiling: 16 };
const CFG = { radius: PLAYER.radius, headRadius: PLAYER.headRadius };

/** A standing (feet=0, crown=1.8) enemy target at (x, z). */
function standing(id: string, x: number, z: number, team = 1): HitTarget {
  return { id, x, z, feetY: 0, headY: PLAYER.standHeight, team };
}

describe("physics — ray primitives", () => {
  it("rayAabb enters the near face; misses when off-axis; ignores an origin inside", () => {
    const box: Box = { min: { x: 10, y: 0, z: -1 }, max: { x: 12, y: 2, z: 1 } };
    expect(rayAabb({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeCloseTo(10, 5);
    expect(rayAabb({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeNull(); // above it
    expect(rayAabb({ x: 11, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeNull(); // inside
    expect(rayAabb({ x: 20, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, box, 100)).toBeNull(); // behind
  });

  it("raySphere returns the near intersection and null past maxT", () => {
    expect(raySphere({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 1, z: 0 }, 1, 100)).toBeCloseTo(9, 5);
    expect(raySphere({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 5, z: 0 }, 1, 100)).toBeNull();
    expect(raySphere({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 10, y: 1, z: 0 }, 1, 5)).toBeNull();
  });

  it("rayVerticalCylinder hits inside the y-band, misses above it", () => {
    // Shaft radius 0.5 at (10,0), band y ∈ [0,2].
    expect(rayVerticalCylinder({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10, 0, 0, 2, 0.5, 100)).toBeCloseTo(9.5, 5);
    expect(rayVerticalCylinder({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, 10, 0, 0, 2, 0.5, 100)).toBeNull();
  });

  it("nearestBox returns the closest occluder or Infinity", () => {
    const boxes: Box[] = [
      { min: { x: 20, y: 0, z: -1 }, max: { x: 21, y: 3, z: 1 } },
      { min: { x: 10, y: 0, z: -1 }, max: { x: 11, y: 3, z: 1 } },
    ];
    expect(nearestBox({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, boxes, 100)).toBeCloseTo(10, 5);
    expect(nearestBox({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, boxes, 100)).toBe(Infinity); // upward, no box
  });
});

describe("physics — movement", () => {
  it("a fall clamps to the floor and grounds", () => {
    const r = moveAndSlide({ x: 30, y: 0.3, z: 20 }, PLAYER.radius, PLAYER.standHeight, { x: 0, y: -0.5, z: 0 }, -10, [], BOUNDS);
    expect(r.pos.y).toBe(0);
    expect(r.vy).toBe(0);
    expect(r.grounded).toBe(true);
  });

  it("walking into a wall stops that axis but slides along the other", () => {
    const wall: Box = { min: { x: 5, y: 0, z: 0 }, max: { x: 6, y: 3, z: 20 } };
    const r = moveAndSlide({ x: 4.5, y: 0, z: 10 }, PLAYER.radius, PLAYER.standHeight, { x: 0.3, y: 0, z: 0.3 }, 0, [wall], BOUNDS);
    expect(r.pos.x).toBeCloseTo(5 - PLAYER.radius, 5); // pushed flush against the wall
    expect(r.pos.z).toBeCloseTo(10.3, 5); // slid freely along z
  });

  it("a descending player lands on a box top and grounds", () => {
    const platform: Box = { min: { x: 27, y: 0, z: 4 }, max: { x: 33, y: 1.2, z: 9 } };
    const r = moveAndSlide({ x: 30, y: 1.5, z: 6.5 }, PLAYER.radius, PLAYER.standHeight, { x: 0, y: -0.5, z: 0 }, -10, [platform], BOUNDS);
    expect(r.pos.y).toBeCloseTo(1.2, 5);
    expect(r.grounded).toBe(true);
    expect(r.vy).toBe(0);
  });

  it("horizontal position clamps to the arena bounds", () => {
    const r = moveAndSlide({ x: 0.5, y: 0, z: 20 }, PLAYER.radius, PLAYER.standHeight, { x: -5, y: 0, z: 0 }, 0, [], BOUNDS);
    expect(r.pos.x).toBeCloseTo(PLAYER.radius, 5); // clamped to left edge, not negative
  });

  it("canStand rejects standing under low cover but allows it in the open", () => {
    const lowCover: Box = { min: { x: 28.5, y: 0, z: 18.5 }, max: { x: 31.5, y: 2.2, z: 21.5 } };
    expect(canStand(30, 0, 20, PLAYER.radius, PLAYER.standHeight, [lowCover], BOUNDS)).toBe(false);
    expect(canStand(10, 0, 10, PLAYER.radius, PLAYER.standHeight, [lowCover], BOUNDS)).toBe(true);
  });
});

describe("hitscan — head/body/occlusion", () => {
  it("a chest-height shot is a body hit", () => {
    const hit = resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [standing("t", 10, 0)], [], CFG);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe("t");
    expect(hit!.part).toBe("body");
    expect(hit!.t).toBeCloseTo(10 - PLAYER.radius, 2);
  });

  it("a head-height shot is a headshot (the body cylinder does not steal it)", () => {
    const headCentreY = PLAYER.standHeight - PLAYER.headRadius; // 1.58
    const hit = resolveHitscan({ x: 0, y: headCentreY, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [standing("t", 10, 0)], [], CFG);
    expect(hit).not.toBeNull();
    expect(hit!.part).toBe("head");
  });

  it("a map box in front shields the target", () => {
    const wall: Box = { min: { x: 10, y: 0, z: -2 }, max: { x: 11, y: 3, z: 2 } };
    const hit = resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [standing("t", 20, 0)], [wall], CFG);
    expect(hit).toBeNull();
  });

  it("the nearest enemy wins; a same-team target is ignored; out of range misses", () => {
    const near = standing("near", 10, 0);
    const far = standing("far", 15, 0);
    const nearest = resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [far, near], [], CFG);
    expect(nearest!.id).toBe("near");

    const friendly = { ...standing("mate", 10, 0), team: 0 };
    expect(resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 100, 0, [friendly], [], CFG)).toBeNull();

    expect(resolveHitscan({ x: 0, y: 1.0, z: 0 }, { x: 1, y: 0, z: 0 }, 40, 0, [standing("t", 50, 0)], [], CFG)).toBeNull();
  });
});
