import { describe, expect, it } from "vitest";
import { chooseSafeSpawn, spawnExposed } from "../src/map/spawn.js";
const points = [{ x: 5, y: 0, z: 5 }, { x: 5, y: 0, z: 15 }];
const enemy = { id: "enemy", x: 15, y: 0, z: 5, team: 1, alive: true };
describe("authoritative spawn selection", () => {
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
  it("does not treat other FFA players sharing team zero as friendly", () => {
    expect(chooseSafeSpawn(points, 0, [{ ...enemy, team: 0 }], "self", 0, [], false)).toEqual(points[1]);
  });
  it("prefers a hidden nearby spawn to a far exposed spawn", () => {
    const pool = [{ x: 5, y: 0, z: 5 }, { x: 45, y: 0, z: 5 }];
    const p = { ...enemy, x: 8 };
    const wall = { min: { x: 6, y: 0, z: 3 }, max: { x: 7, y: 3, z: 7 } };
    expect(chooseSafeSpawn(pool, 1, [p], "self", 0, [wall])).toEqual(pool[0]);
  });
  it("uses nearby teammates only to break equally safe choices", () => {
    expect(chooseSafeSpawn(points, 0, [{ ...enemy, x: 8, z: 15, team: 0 }], "self", 0, [])).toEqual(points[1]);
  });
  it("never trades an unoccupied point for teammate support or cover", () => {
    const screen = { min: { x: 9, y: 0, z: 11 }, max: { x: 11, y: 4, z: 15 } };
    const occupants = [{ ...enemy, z: 10 }, { ...enemy, ...points[1], team: 0, id: "ally" }];
    expect(chooseSafeSpawn(points, 1, occupants, "self", 0, [screen])).toEqual(points[0]);
  });
  it("detects exposed shoulders behind a narrow centre-ray screen", () => {
    const screen = { min: { x: 9, y: 0, z: 4.95 }, max: { x: 11, y: 3, z: 5.05 } };
    expect(spawnExposed(points[0]!, enemy, [screen])).toBe(true);
  });
  it("uses enemy elevation and crouched eye height for cover tests", () => {
    const cover = { min: { x: 9, y: 0, z: 3 }, max: { x: 11, y: 1.5, z: 7 } };
    expect(spawnExposed(points[0]!, { ...enemy, crouch: true }, [cover])).toBe(false);
    expect(spawnExposed(points[0]!, { ...enemy, y: 3, crouch: true }, [cover])).toBe(true);
  });
  it("fails loudly on an invalid empty spawn pool", () => {
    expect(() => chooseSafeSpawn([], 0, [], "self", 0, [])).toThrow("spawn points");
  });
});
