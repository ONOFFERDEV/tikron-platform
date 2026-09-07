import { describe, expect, it } from "vitest";
import { chooseSafeSpawn } from "../src/map/spawn.js";
const points = [{ x: 5, y: 0, z: 5 }, { x: 5, y: 0, z: 15 }];
const enemy = { id: "enemy", x: 15, y: 0, z: 5, team: 1, alive: true };
describe("authoritative Relay spawn selection", () => {
  it("rotates equally safe spawns", () => {
    expect(chooseSafeSpawn(points, 0, [], "self", 0, [])).toEqual(points[0]);
    expect(chooseSafeSpawn(points, 1, [], "self", 0, [])).toEqual(points[1]);
    expect(chooseSafeSpawn(points, 2, [], "self", 0, [])).toEqual(points[0]);
  });
  it("prefers a screened spawn over an exposed one at the same enemy distance", () => {
    const p = { ...enemy, z: 10 };
    const screen = { min: { x: 9, y: 0, z: 11 }, max: { x: 11, y: 4, z: 15 } };
    expect(chooseSafeSpawn(points, 0, [p], "self", 0, [screen])).toEqual(points[1]);
  });
  it("avoids a teammate already occupying the next rotated spawn", () => {
    expect(chooseSafeSpawn(points, 0, [{ ...enemy, ...points[0], team: 0 }], "self", 0, [])).toEqual(points[1]);
  });
  it("ignores corpses and the respawning player's old position", () => {
    expect(chooseSafeSpawn(points, 0, [{ ...enemy, alive: false }, { ...enemy, id: "self" }], "self", 0, [])).toEqual(points[0]);
  });
  it("still chooses the least dangerous point when every spawn is exposed", () => {
    expect(chooseSafeSpawn(points, 0, [enemy], "self", 0, [])).toEqual(points[1]);
  });
});
