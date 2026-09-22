import { describe, expect, it } from "vitest";
import { Predictor } from "../client/predict.js";
import { MOVE, TICK_MS } from "../src/config.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import type { MapDef } from "../src/map/types.js";
import { traversalRoute } from "../src/traversal.js";
import type { SlideInput } from "../src/slide.js";
import { movementSpeed } from "../src/movement-rules.js";

const forward = {
  mx: 0,
  mz: 1,
  jump: false,
  crouch: false,
  sprint: false,
  ads: false,
} as const;

function horizontalDistance(map: MapDef, intent: SlideInput): number {
  const start = map.spawns.red[0];
  if (start === undefined) throw new TypeError("movement fixture requires a red spawn");
  const predictor = new Predictor(map);
  predictor.reconcile(start);
  predictor.frame(TICK_MS, intent, 0);
  return Math.hypot(predictor.pos.x - start.x, predictor.pos.z - start.z);
}

describe("WW1 movement rules", () => {
  it("uses the approved walk, sprint, crouch, gravity, and jump values", () => {
    // Given: the shared movement contract.
    // When: its public constants are read.
    // Then: both simulations receive the approved WW1 values.
    expect(MOVE).toMatchObject({ walk: 5.5, sprint: 8, crouch: 2.6, gravity: 20, jumpSpeed: 7 });
  });

  it.each([
    ["Relay", ARENA1],
    ["Undertow", ARENA2],
    ["Switchyard", ARENA3],
  ] as const)("walks one fixed step on %s", (_name, map) => {
    // Given: a player at an authored spawn on one of the three maps.
    // When: one forward command is predicted.
    const distance = horizontalDistance(map, forward);
    // Then: travel is exactly one shared walk-speed step.
    expect(distance).toBeCloseTo(5.5 * TICK_MS / 1_000, 6);
  });

  it("does not gain distance from diagonal input", () => {
    // Given: axial and diagonal walk commands.
    const axial = horizontalDistance(ARENA1, forward);
    // When: both axes are held for one fixed step.
    const diagonal = horizontalDistance(ARENA1, { ...forward, mx: 1 });
    // Then: normalized diagonal travel equals axial travel.
    expect(diagonal).toBeCloseTo(axial, 6);
  });

  it("slides diagonal input along a wall without crossing it", () => {
    // Given: a full-height wall one metre to the player's right.
    const wall = { min: { x: 56, y: 0, z: 0 }, max: { x: 56.2, y: 3, z: 100 } };
    const map = { ...ARENA1, boxes: [...ARENA1.boxes, wall] };
    const predictor = new Predictor(map);
    predictor.reconcile({ x: 55, y: 0, z: 27 });
    // When: diagonal input is predicted into the wall for one second.
    for (let step = 0; step < 20; step += 1) predictor.frame(TICK_MS, { ...forward, mx: 1 }, 0);
    // Then: the capsule slides forward and its radius never crosses the wall face.
    expect(predictor.pos.x).toBeLessThanOrEqual(wall.min.x - 0.4 + 1e-6);
    expect(predictor.pos.z).toBeGreaterThan(29);
  });

  it.each([
    ["walk", forward, 5.5],
    ["sprint", { ...forward, sprint: true }, 8],
    ["crouch", { ...forward, crouch: true }, 2.6],
    ["ADS walk", { ...forward, ads: true }, 5.5 * 0.75],
  ] as const)("applies the %s ground speed", (_name, intent, expectedSpeed) => {
    // Given: a grounded stance and action intent.
    // When: one fixed movement step is predicted.
    const distance = horizontalDistance(ARENA1, intent);
    // Then: travel uses the shared stance speed once.
    expect(distance).toBeCloseTo(expectedSpeed * TICK_MS / 1_000, 6);
  });

  it("does not add sprint or ADS acceleration in the air", () => {
    // Given: airborne forward input with sprint and ADS requested.
    // When: shared movement speed is selected.
    const speed = movementSpeed({ ...forward, sprint: true, ads: true }, false);
    // Then: air control stays at the base walk speed.
    expect(speed).toBe(MOVE.walk);
  });

  it("caps a 100 ms render hitch to two fixed movement steps", () => {
    // Given: a grounded player before a 100 ms render hitch.
    const start = ARENA1.spawns.red[0];
    if (start === undefined) throw new TypeError("hitch fixture requires a red spawn");
    const predictor = new Predictor(ARENA1);
    predictor.reconcile(start);
    // When: the delayed frame is predicted.
    predictor.frame(100, forward, 0);
    // Then: the hitch spends exactly the server's two-tick clamp.
    expect(Math.hypot(predictor.pos.x - start.x, predictor.pos.z - start.z)).toBeCloseTo(MOVE.walk * 0.1, 6);
  });

  it("finds waist-cover traversal relative to a trench support", () => {
    // Given: waist cover whose bottom shares a -3 m trench support.
    const start = { x: 5, y: -3, z: 5 };
    const cover = { min: { x: 4, y: -3, z: 6 }, max: { x: 6, y: -1.9, z: 6.8 } };
    // When: the player requests a forward traversal.
    const route = traversalRoute(start, 0, [cover], { width: 20, depth: 20, floor: -3, ceiling: 5 }, []);
    // Then: the route lands back on the same support instead of assuming y=0.
    expect(route?.end.y).toBe(-3);
  });

  it("rejects a trench traversal whose standing capsule crosses a ceiling", () => {
    // Given: valid trench cover with a low bridge ceiling above its route.
    const start = { x: 5, y: -3, z: 5 };
    const cover = { min: { x: 4, y: -3, z: 6 }, max: { x: 6, y: -1.9, z: 6.8 } };
    const ceiling = { min: { x: 3, y: -1.7, z: 4 }, max: { x: 7, y: -1.5, z: 9 } };
    // When: traversal clearance is evaluated.
    const route = traversalRoute(start, 0, [cover, ceiling], { width: 20, depth: 20, floor: -3, ceiling: 5 }, []);
    // Then: no route passes through the ceiling.
    expect(route).toBeNull();
  });
});
