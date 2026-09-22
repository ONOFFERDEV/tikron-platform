import { describe, expect, it } from "vitest";

import { classifyEnvironmentKit } from "../scripts/aside-scenarios/environment.mjs";

const definition = {
  cases: ["all module turntables", "combat distance", "bad scale", "invalid surface", "blocked doorway"],
};
const artifact = { path: "evidence/environment.png", bytes: 1024 };
const keys = [
  "trench-wall", "duckboard", "sandbag", "timber-brace", "wire", "rail-platform",
  "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post",
  "freight-wagon-wreck", "biplane",
];

describe("environment-kit Aside scenario", () => {
  it("passes only a complete actual runtime inspection", () => {
    const observations = {
      inputKind: "aside-runtime-inspector",
      normal: {
        ready: true,
        assets: keys.map((key) => ({ key, loaded: true, views: 4, boundsValid: true, socketsValid: true })),
        combatDistance: { nearM: 5, farM: 40, readable: true },
      },
      failures: {
        badScale: { attempted: true, rejected: true },
        invalidSurface: { attempted: true, rejected: true },
        blockedDoorway: { attempted: true, rejected: true },
      },
    };
    expect(classifyEnvironmentKit(definition, observations, [artifact]).map((entry) => entry.verdict)).toEqual([
      "PASS", "PASS", "PASS", "PASS", "PASS",
    ]);
  });

  it("fails the turntable inventory when a loaded model violates its bounds contract", () => {
    const observations = {
      inputKind: "aside-runtime-inspector",
      normal: {
        ready: true,
        assets: keys.map((key) => ({
          key,
          loaded: true,
          views: 4,
          boundsValid: key !== "wire",
          socketsValid: true,
        })),
      },
    };
    expect(classifyEnvironmentKit(definition, observations, [artifact])[0].verdict).toBe("FAIL");
  });

  it("keeps every required case unqualified when the runtime inspector is absent", () => {
    expect(classifyEnvironmentKit(definition, { inputKind: "inspector-unavailable" }, []).map((entry) => entry.verdict)).toEqual([
      "UNQUALIFIED", "UNQUALIFIED", "UNQUALIFIED", "UNQUALIFIED", "UNQUALIFIED",
    ]);
  });

  it("does not promote synthetic failure claims", () => {
    const observations = {
      inputKind: "synthetic-fixture",
      failures: {
        badScale: { attempted: true, rejected: true },
        invalidSurface: { attempted: true, rejected: true },
        blockedDoorway: { attempted: true, rejected: true },
      },
    };
    expect(classifyEnvironmentKit(definition, observations, [artifact]).slice(2).map((entry) => entry.verdict)).toEqual([
      "UNQUALIFIED", "UNQUALIFIED", "UNQUALIFIED",
    ]);
  });
});
