import { describe, expect, it } from "vitest";
import { parseRigInspect } from "../client/rig-inspect-query.js";
describe("main entry inspect query", () => {
  it("leaves missing inspect in normal mode", () => {
    expect(parseRigInspect("")).toBeNull();
    expect(parseRigInspect("?mode=tdm&weapon=3")).toBeNull();
  });
  it("uses documented rig defaults", () => {
    expect(parseRigInspect("?inspect=rig")).toEqual({ weapon: 0, pose: "idle",
      yaw: 30, pitch: 10, dist: 2.2, blend: undefined, arms: true });
  });
  it("bounds overrides and rejects non-finite numbers", () => {
    expect(parseRigInspect("?inspect=rig&weapon=9&blend=2&pitch=NaN&arms=0&pose=crouch"))
      .toMatchObject({ weapon: 4, blend: 1, pitch: 10, arms: false, pose: "crouch" });
  });
});
