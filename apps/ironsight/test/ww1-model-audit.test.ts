import { describe, expect, it } from "vitest";
import { auditGlb } from "../scripts/ww1-glb-core.mjs";
import { fixtureGlb, type FixtureOptions } from "./ww1-model-audit.fixture.mjs";

function audit(options: FixtureOptions): { readonly valid: boolean; readonly codes: readonly string[] } {
  const assetKey = options.joinedBolt ? "bolt_service_rifle" : "pump_shotgun";
  const result = auditGlb(fixtureGlb(options), { role: "weapon", assetKey });
  return { valid: result.valid, codes: result.issues.map((entry) => entry.code) };
}

describe("WW1 GLB model audit", () => {
  it("accepts a finite +Z intermediate pump assembly", () => expect(audit({})).toEqual({ valid: true, codes: [] }));
  it.each([
    ["wrong axis", { axis: "bad" }, "bore_axis"],
    ["NaN vertex", { nanVertex: true }, "non_finite_accessor"],
    ["NaN skin", { nanSkin: true }, "non_finite_accessor"],
    ["missing pump", { omitPump: true }, "missing_mechanical_part"],
    ["non-separate bolt", { joinedBolt: true }, "non_mesh_mechanical_part"],
    ["missing UV and normal", { omitUvNormal: true }, "missing_vertex_attribute"],
  ] as const)("rejects %s", (_name, options, code) => {
    const result = audit(options);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain(code);
  });
  it("rejects a soldier without the manifest rig or skin", () => {
    const result = auditGlb(fixtureGlb(), { role: "soldier", assetKey: "khaki", requiredJoints: ["head", "Pelvis"] });
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining(["missing_rig_joint", "missing_skin"]));
  });
  it.each([
    ["mechanical part mesh reference outside the mesh table", { invalidPartMesh: true }, "invalid_mesh_reference"],
    ["vertex index outside the POSITION accessor", { outOfRangeIndex: true }, "vertex_index_out_of_range"],
    ["accessor data extending beyond its bufferView", { shortBufferView: true }, "accessor_out_of_range"],
    ["skin joint outside the node table", { invalidSkinJoint: true }, "invalid_node_reference"],
    ["inverse-bind count different from the skin joint count", { mismatchedInverseBind: true }, "inverse_bind_count_mismatch"],
    ["empty active scene", { emptyScene: true }, "empty_active_scene"],
    ["weapon-support asset with no reachable mesh", { zeroMesh: true }, "missing_scene_mesh"],
    ["parent rotation changing the weapon bore from +Z to +X", { parentRotated: true }, "bore_axis"],
    ["singular inverse-bind matrix", { singularInverse: true }, "singular_inverse_bind"],
    ["negative skin weights whose sum is one", { negativeWeights: true }, "invalid_skin_weights"],
    ["JOINTS_0 value outside its skin joint array", { badJointsAttribute: true }, "joint_index_out_of_range"],
  ] as const)("rejects %s", (_name, options, code) => {
    const bytes = fixtureGlb(options);
    const role = "zeroMesh" in options ? "weapon-support" : "weapon";
    const result = auditGlb(bytes, { role, assetKey: "pump_shotgun" });
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain(code);
  });
  it.each([
    ["NORMAL accessor with VEC2 shape", { normalVec2: true }, "invalid_attribute_accessor"],
    ["TEXCOORD_0 accessor with SCALAR shape", { uvScalar: true }, "invalid_attribute_accessor"],
    ["mechanical pump backed by an empty mesh", { emptyPumpPrimitive: true }, "empty_mechanical_part"],
    ["active scene containing only empty meshes", { onlyEmptyMeshes: true }, "missing_scene_geometry"],
    ["zero-count weights for three vertices", { zeroWeightCount: true }, "skin_attribute_count_mismatch"],
    ["one weight tuple for three vertices", { shortWeightCount: true }, "skin_attribute_count_mismatch"],
    ["SCALAR weights instead of VEC4", { wrongWeightWidth: true }, "invalid_weights_accessor"],
    ["zero-length node quaternion", { zeroQuaternion: true }, "invalid_node_transform"],
    ["active node cycle", { nodeCycle: true }, "node_cycle"],
    ["active node referencing a missing skin", { invalidNodeSkin: true }, "invalid_skin_reference"],
    ["one JOINTS_0 tuple for three vertices", { shortJointsCount: true }, "skin_attribute_count_mismatch"],
  ] as const)("rejects %s", (_name, options, code) => {
    const result = audit(options);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain(code);
  });
  it.each([
    ["float skin weights", { validFloatSkin: true }],
    ["normalized unsigned-byte skin weights", { normalizedU8Skin: true }],
  ] as const)("accepts %s", (_name, options) => expect(audit(options)).toEqual({ valid: true, codes: [] }));
  it.each([
    ["normalized triangle indices", { normalizedIndex: true }, "invalid_index_accessor"],
    ["signed triangle indices", { signedIndex: true }, "invalid_index_accessor"],
    ["MAT2 weights whose numeric width happens to be four", { matrixWeights: true }, "invalid_weights_accessor"],
    ["MAT2 joints whose numeric width happens to be four", { matrixJoints: true }, "invalid_joints_accessor"],
    ["mechanical pump with a zero-index primitive", { zeroIndexPump: true }, "empty_mechanical_part"],
    ["raw unsigned-byte weights", { rawU8Weights: true }, "invalid_weights_accessor"],
    ["raw unsigned-short weights", { rawU16Weights: true }, "invalid_weights_accessor"],
    ["normalized signed-byte weights", { normalizedI8Weights: true }, "invalid_weights_accessor"],
    ["normalized float weights", { normalizedFloatWeights: true }, "invalid_weights_accessor"],
    ["normalized joint indices", { normalizedJoints: true }, "invalid_joints_accessor"],
    ["grip_r offset from the declared weapon origin", { offsetGripOrigin: true }, "weapon_origin"],
    ["translated common parent moving grip_r away from the origin", { validTranslation: true }, "weapon_origin"],
  ] as const)("rejects %s", (_name, options, code) => {
    const result = audit(options);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain(code);
  });
  it.each([
    ["normalized unsigned-short skin weights", { normalizedU16Skin: true }],
    ["unsigned-short joint indices", { u16Joints: true }],
  ] as const)("accepts %s", (_name, options) => expect(audit(options)).toEqual({ valid: true, codes: [] }));
  it("rejects a bolt whose declared rotation pivot is not at the chamber socket", () => {
    const result = auditGlb(fixtureGlb({ boltAsset: true, badBoltPivot: true }), { role: "weapon", assetKey: "bolt_service_rifle" });
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain("mechanism_pivot");
  });
  it("rejects a missing secondary-part motion contract", () => {
    const result = audit({ missingSecondaryMotion: true });
    expect(result.valid).toBe(false);
    expect(result.codes).toContain("missing_mechanism_motion");
  });
});
