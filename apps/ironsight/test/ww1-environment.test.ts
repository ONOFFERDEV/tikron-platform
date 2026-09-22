import { describe, expect, it } from "vitest";
import {
  LOCAL_ENVIRONMENT_KEYS,
  REBUILT_ENVIRONMENT_KEYS,
  WW1_ENVIRONMENT_MANIFEST,
  auditEnvironmentManifest,
  type Ww1EnvironmentManifest,
} from "../config/ww1-environment.js";
import { auditGlb } from "../scripts/ww1-glb-core.mjs";
import { fixtureGlb } from "./ww1-model-audit.fixture.mjs";

function changedAsset(
  key: Ww1EnvironmentManifest["assets"][number]["key"],
  change: Readonly<Record<string, unknown>>,
): unknown {
  return {
    ...WW1_ENVIRONMENT_MANIFEST,
    assets: WW1_ENVIRONMENT_MANIFEST.assets.map((asset) => asset.key === key ? { ...asset, ...change } : asset),
  };
}

describe("WW1 environment delivery contract", () => {
  it("accepts the complete dimensioned authored kit", () => {
    expect(auditEnvironmentManifest(WW1_ENVIRONMENT_MANIFEST)).toEqual([]);
    expect(LOCAL_ENVIRONMENT_KEYS).toEqual([
      "trench-wall", "duckboard", "sandbag", "timber-brace", "wire", "rail-platform",
      "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck", "biplane",
    ]);
    expect(REBUILT_ENVIRONMENT_KEYS).toEqual([
      "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck",
    ]);
    for (const asset of WW1_ENVIRONMENT_MANIFEST.assets) {
      expect(asset.provenance).toMatchObject({ status: "authored", sourceKind: "original-authored" });
      expect(asset.provenance.outputSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("exposes placement sockets for modules with mechanical or assembly seams", () => {
    const requiredSockets = {
      "brick-rubble": ["join_left", "join_right"],
      "field-telephone": ["handset", "crank", "cable"],
      "ammo-crate": ["lid", "carry_left", "carry_right"],
      "supply-wagon": ["drawbar", "load_origin", "wheel_front_left", "wheel_front_right", "wheel_rear_left", "wheel_rear_right"],
      "observation-post": ["entry", "view_slit"],
      "freight-wagon-wreck": ["coupler_front", "coupler_rear", "bogie_front", "bogie_rear"],
    } as const;
    for (const [key, sockets] of Object.entries(requiredSockets)) {
      const asset = WW1_ENVIRONMENT_MANIFEST.assets.find((candidate) => candidate.key === key);
      expect(Object.keys(asset?.joints ?? {})).toEqual(expect.arrayContaining([...sockets]));
    }
  });

  it.each([
    ["wrong axis", { ...WW1_ENVIRONMENT_MANIFEST, coordinateSystem: { units: "metres", up: "+Z", forward: "+Y" } }, "coordinate_system"],
    ["centimetre scale", changedAsset("duckboard", { dimensionsM: [200, 10, 100] }), "invalid_scale"],
    ["NaN dimension", changedAsset("sandbag", { dimensionsM: [2, Number.NaN, 0.62] }), "non_finite"],
    ["oversized collision", changedAsset("trench-wall", { collision: { kind: "box", dimensionsM: [4.2, 2.4, 0.45] } }), "collision_outside_visual"],
    ["thick cladding", changedAsset("rail-platform", { maxCladdingOffsetM: 0.021 }), "cladding_offset"],
    ["blocking decorative wire", changedAsset("wire", { collision: { kind: "box", dimensionsM: [3, 1.1, 0.18] } }), "wire_collision"],
    ["wire used as a doorway boundary", changedAsset("wire", { routeBoundary: true }), "wire_route"],
    ["narrow brace doorway", changedAsset("timber-brace", { clearOpeningM: [1.99, 2.35] }), "doorway_clearance"],
    ["missing surface binding", changedAsset("trench-wall", { surfaces: [] }), "surface"],
    ["invalid receipt", changedAsset("field-telephone", { provenance: { status: "planned", sourceKind: "meshy-generated", receiptRole: "environment-prop", receiptPath: "../receipt.json", outputSha256: null } }), "receipt"],
    ["hovering support", changedAsset("biplane", { presentation: ["observation", "hover"] }), "support_behavior"],
  ] as const)("rejects %s", (_name, candidate, issue) => {
    expect(auditEnvironmentManifest(candidate).map((entry) => entry.code)).toContain(issue);
  });

  it("rejects a GLB containing a NaN vertex through the common model auditor", () => {
    const report = auditGlb(fixtureGlb({ nanVertex: true }), { role: "environment", assetKey: "duckboard" });
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("non_finite_accessor");
  });
});
