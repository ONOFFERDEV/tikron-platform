export const LOCAL_ENVIRONMENT_KEYS = [
  "trench-wall", "duckboard", "sandbag", "timber-brace", "wire", "rail-platform",
  "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck", "biplane",
] as const;

export const GENERATED_ENVIRONMENT_KEYS = [
  "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck",
] as const;

export const REBUILT_ENVIRONMENT_KEYS = [
  "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck",
] as const;

export const ENVIRONMENT_ASSET_KEYS = [
  "trench-wall", "duckboard", "sandbag", "timber-brace", "wire", "rail-platform",
  "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck", "biplane",
] as const;

export type EnvironmentAssetKey = (typeof ENVIRONMENT_ASSET_KEYS)[number];
export type EnvironmentSurface = "mud" | "gravel" | "wood" | "metal" | "concrete";
export type DimensionsM = readonly [number, number, number];
export type EnvironmentCollision =
  | { readonly kind: "none" }
  | { readonly kind: "box"; readonly dimensionsM: DimensionsM }
  | { readonly kind: "compound"; readonly dimensionsM: DimensionsM; readonly parts: number };
export type EnvironmentProvenance = {
  readonly status: "authored" | "planned" | "accepted" | "rejected";
  readonly sourceKind: "original-authored" | "meshy-generated" | "meshy-derived-authored";
  readonly receiptRole: "environment-prop" | "support-airframe";
  readonly receiptPath: string;
  readonly outputSha256: string | null;
};
export type EnvironmentAsset = {
  readonly key: EnvironmentAssetKey;
  readonly publicUrl: string;
  readonly metadataUrl: string;
  readonly dimensionsM: DimensionsM;
  readonly origin: "bottom-center" | "centre-of-mass";
  readonly forward: "+Z";
  readonly lods: readonly ["LOD0", "LOD1", "LOD2"];
  readonly joints: Readonly<Record<string, DimensionsM>>;
  readonly surfaces: readonly EnvironmentSurface[];
  readonly collision: EnvironmentCollision;
  readonly maxCladdingOffsetM: number;
  readonly clearOpeningM?: readonly [number, number];
  readonly routeBoundary: boolean;
  readonly textureMaxPx: 512;
  readonly triangleBudget: readonly [number, number, number];
  readonly provenance: EnvironmentProvenance;
  readonly factionVariants?: readonly ["khaki", "fieldgrey"];
  readonly pilotable?: false;
  readonly presentation?: readonly ["observation", "fixed-linear-strafing"];
};
export type Ww1EnvironmentManifest = {
  readonly schemaVersion: 1;
  readonly coordinateSystem: { readonly units: "metres"; readonly up: "+Y"; readonly forward: "+Z" };
  readonly assets: readonly EnvironmentAsset[];
  readonly repeatedTextureMaxPx: 512;
  readonly maxCladdingOffsetM: 0.02;
};

const OUTPUT_SHA256: Readonly<Record<EnvironmentAssetKey, string>> = {
  "trench-wall": "8c619a1ff90eadaf0ad4305c596eca4da5b0329a0e2fc61372803b995b0c16fc",
  duckboard: "5312be9e3d81851cc1803d5a3ade9f1a81566227e52244f892013fd77d09ade3",
  sandbag: "c215dc14c506e406b6a1afc4c701c7e9659943e50896073fb409c9b09ba1e483",
  "timber-brace": "4769dbc06552eadd83f0637bddce7501fba43cfd496138325cd4606f3001a754",
  wire: "22d751202758aae7c7047569b2c97221cfd39f8b08cd1900c4ae22dc5609c4fb",
  "rail-platform": "8aefe162b704d11f43db62e4575bb996aa94d80d40df1c306c4f50736edbe50c",
  "brick-rubble": "571c57984219ceb7c5e5bb595287c73078490054820f86ca6de9b03940771ef1",
  "field-telephone": "73832c53ae4995225c928bf361faf295ff3539edf3093d6837cc865e55ff4abf",
  "ammo-crate": "6cc1ae75b8db44be87f65803ce55c67e2df05755d6df6a9a84bf4f6de024fbaa",
  "supply-wagon": "dd7f1526ecd82a9279fb365a784f78f58c8d7ea802adba50e8c4cab5b0114827",
  "observation-post": "2802f13b9f05c0f090744a13e7f2a44328a7f979704dd3e1eedb2f417c1ea637",
  "freight-wagon-wreck": "16611bc62d19fda361e53e8a5d8e05c11b6a7aecd49a81a79d221e73378b7c2a",
  biplane: "72ad5bd897d683c069e66bf8e19544f12a61e204562e6c03b4161357a655e3f1",
};

const local = (
  key: EnvironmentAssetKey,
  dimensionsM: DimensionsM,
  joints: Readonly<Record<string, DimensionsM>>,
  surfaces: readonly EnvironmentSurface[],
  collision: EnvironmentCollision,
  triangleBudget: readonly [number, number, number],
  extra: Partial<Pick<EnvironmentAsset, "clearOpeningM" | "factionVariants" | "pilotable" | "presentation" | "origin">> = {},
): EnvironmentAsset => ({
  key,
  publicUrl: `/assets/ww1/${key === "biplane" ? "support" : "environment"}/${key}.glb`,
  metadataUrl: `/assets/ww1/${key === "biplane" ? "support" : "environment"}/${key}.meta.json`,
  dimensionsM,
  origin: extra.origin ?? "bottom-center",
  forward: "+Z",
  lods: ["LOD0", "LOD1", "LOD2"],
  joints,
  surfaces,
  collision,
  maxCladdingOffsetM: key === "wire" ? 0 : 0.018,
  routeBoundary: key !== "wire",
  textureMaxPx: 512,
  triangleBudget,
  provenance: {
    status: "authored", sourceKind: "original-authored",
    receiptRole: key === "biplane" ? "support-airframe" : "environment-prop",
    receiptPath: `artifacts/ww1/receipts/${key}.json`, outputSha256: OUTPUT_SHA256[key],
  },
  ...extra,
});

export const WW1_ENVIRONMENT_MANIFEST = {
  schemaVersion: 1,
  coordinateSystem: { units: "metres", up: "+Y", forward: "+Z" },
  repeatedTextureMaxPx: 512,
  maxCladdingOffsetM: 0.02,
  assets: [
    local("trench-wall", [4, 2.4, 0.45], { join_left: [-2, 0, 0], join_right: [2, 0, 0] }, ["mud", "wood"], { kind: "box", dimensionsM: [4, 2.4, 0.45] }, [1_800, 950, 420]),
    local("duckboard", [2, 0.1, 1], { join_left: [-1, 0, 0], join_right: [1, 0, 0] }, ["wood"], { kind: "box", dimensionsM: [2, 0.1, 1] }, [720, 360, 144]),
    local("sandbag", [2, 0.72, 0.62], { join_left: [-1, 0, 0], join_right: [1, 0, 0] }, ["mud"], { kind: "box", dimensionsM: [2, 0.72, 0.62] }, [2_700, 1_000, 520]),
    local("timber-brace", [2.4, 2.5, 0.22], { join_left: [-1.2, 0, 0], join_right: [1.2, 0, 0] }, ["wood"], { kind: "compound", dimensionsM: [2.4, 2.5, 0.22], parts: 5 }, [1_100, 560, 240], { clearOpeningM: [2, 2.35] }),
    local("wire", [3, 1.1, 0.18], { join_left: [-1.5, 0, 0], join_right: [1.5, 0, 0] }, ["metal"], { kind: "none" }, [2_800, 1_200, 420]),
    local("rail-platform", [4, 0.32, 2.4], { join_front: [0, 0, 1.2], join_back: [0, 0, -1.2] }, ["wood", "metal", "gravel"], { kind: "box", dimensionsM: [4, 0.32, 2.4] }, [2_100, 1_050, 430]),
    local("brick-rubble", [2.4, 0.8, 0.65], { join_left: [-1.2, 0, 0], join_right: [1.2, 0, 0] }, ["concrete", "gravel"], { kind: "box", dimensionsM: [2.4, 0.78, 0.65] }, [5_000, 2_200, 800]),
    local("field-telephone", [0.28, 0.22, 0.22], { handset: [0, 0.204, -0.055], crank: [0.143, 0.105, 0.092], cable: [0, 0.025, 0.112] }, ["wood", "metal"], { kind: "none" }, [3_000, 1_300, 500]),
    local("ammo-crate", [1.2, 0.65, 0.62], { lid: [0, 0.65, 0], carry_left: [-0.6, 0.4, 0], carry_right: [0.6, 0.4, 0] }, ["wood", "metal"], { kind: "box", dimensionsM: [1.2, 0.65, 0.62] }, [4_000, 1_800, 650]),
    local("supply-wagon", [3.6, 2.1, 1.9], { drawbar: [0, 0.62, 0.95], load_origin: [0, 1.25, -0.15], wheel_front_left: [-1.25, 0.55, 0.92], wheel_front_right: [1.25, 0.55, 0.92], wheel_rear_left: [-1.25, 0.55, -0.72], wheel_rear_right: [1.25, 0.55, -0.72] }, ["wood", "metal"], { kind: "compound", dimensionsM: [3.6, 2.1, 1.9], parts: 6 }, [9_000, 4_000, 1_400]),
    local("observation-post", [2.4, 3.4, 2.4], { entry: [0, 0, -1.2], view_slit: [0, 2.18, 1.2] }, ["wood", "mud"], { kind: "compound", dimensionsM: [2.4, 3.4, 2.4], parts: 6 }, [10_000, 4_500, 1_600]),
    local("freight-wagon-wreck", [7.4, 2.8, 2.7], { coupler_front: [0, 0.58, 1.35], coupler_rear: [0, 0.58, -1.35], bogie_front: [2.35, 0.45, 0], bogie_rear: [-2.35, 0.45, 0] }, ["metal", "wood"], { kind: "compound", dimensionsM: [7.4, 2.8, 2.7], parts: 7 }, [12_000, 5_000, 1_800]),
    local("biplane", [9.2, 2.75, 6.4], { path_origin: [0, 0, 0], propeller: [0, -0.225, 3.2], camera_observation: [0, 0.325, 0.25] }, ["wood", "metal"], { kind: "none" }, [11_000, 5_000, 1_800], {
      origin: "centre-of-mass", factionVariants: ["khaki", "fieldgrey"], pilotable: false,
      presentation: ["observation", "fixed-linear-strafing"],
    }),
  ],
} as const satisfies Ww1EnvironmentManifest;

export const ENVIRONMENT_ISSUE_CODES = [
  "manifest_shape", "coordinate_system", "inventory", "invalid_scale", "non_finite", "collision_outside_visual",
  "cladding_offset", "wire_collision", "wire_route", "doorway_clearance", "surface", "receipt", "lod_budget", "support_behavior",
] as const;
export type EnvironmentIssue = { readonly code: (typeof ENVIRONMENT_ISSUE_CODES)[number]; readonly path: string };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tuple3(value: unknown): value is DimensionsM {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function sameTuple(actual: unknown, expected: DimensionsM): boolean {
  return tuple3(actual) && actual.every((entry, index) => entry === expected[index]);
}

export function auditEnvironmentManifest(candidate: unknown): readonly EnvironmentIssue[] {
  if (!isRecord(candidate)) return [{ code: "manifest_shape", path: "$" }];
  const issues: EnvironmentIssue[] = [];
  const coordinates = candidate["coordinateSystem"];
  if (!isRecord(coordinates) || coordinates["units"] !== "metres" || coordinates["up"] !== "+Y" || coordinates["forward"] !== "+Z") {
    issues.push({ code: "coordinate_system", path: "coordinateSystem" });
  }
  const assets = candidate["assets"];
  if (!Array.isArray(assets) || assets.length !== ENVIRONMENT_ASSET_KEYS.length) return [...issues, { code: "inventory", path: "assets" }];
  for (const [index, expected] of WW1_ENVIRONMENT_MANIFEST.assets.entries()) {
    const asset = assets[index];
    const path = `assets[${index}]`;
    if (!isRecord(asset) || asset["key"] !== expected.key) { issues.push({ code: "inventory", path }); continue; }
    const dimensions = asset["dimensionsM"];
    if (!tuple3(dimensions)) issues.push({ code: "non_finite", path: `${path}.dimensionsM` });
    else if (!sameTuple(dimensions, expected.dimensionsM)) issues.push({ code: "invalid_scale", path: `${path}.dimensionsM` });
    if (typeof asset["maxCladdingOffsetM"] !== "number" || !Number.isFinite(asset["maxCladdingOffsetM"])) issues.push({ code: "non_finite", path: `${path}.maxCladdingOffsetM` });
    else if (asset["maxCladdingOffsetM"] > 0.02) issues.push({ code: "cladding_offset", path: `${path}.maxCladdingOffsetM` });
    const surfaces = asset["surfaces"];
    if (!Array.isArray(surfaces) || surfaces.length === 0 || surfaces.some((surface) => !["mud", "gravel", "wood", "metal", "concrete"].includes(surface))) issues.push({ code: "surface", path: `${path}.surfaces` });
    const collision = asset["collision"];
    if (!isRecord(collision)) issues.push({ code: "manifest_shape", path: `${path}.collision` });
    else if (expected.key === "wire" && collision["kind"] !== "none") issues.push({ code: "wire_collision", path: `${path}.collision` });
    else if (collision["kind"] !== "none") {
      const collisionDimensions = collision["dimensionsM"];
      if (!tuple3(collisionDimensions)) issues.push({ code: "non_finite", path: `${path}.collision.dimensionsM` });
      else if (tuple3(dimensions) && (collisionDimensions[0] > dimensions[0] + 0.02 || collisionDimensions[1] > dimensions[1] + 0.02 || collisionDimensions[2] > dimensions[2] + 0.02)) issues.push({ code: "collision_outside_visual", path: `${path}.collision.dimensionsM` });
    }
    if (expected.key === "wire" && asset["routeBoundary"] !== false) issues.push({ code: "wire_route", path: `${path}.routeBoundary` });
    if (expected.clearOpeningM !== undefined) {
      const opening = asset["clearOpeningM"];
      if (!Array.isArray(opening) || opening.length !== 2 || opening[0] !== 2 || opening[1] < 2.35) issues.push({ code: "doorway_clearance", path: `${path}.clearOpeningM` });
    }
    const provenance = asset["provenance"];
    if (!isRecord(provenance) || typeof provenance["receiptPath"] !== "string" || !/^artifacts\/ww1\/receipts\/[a-z0-9-]+\.json$/.test(provenance["receiptPath"])) issues.push({ code: "receipt", path: `${path}.provenance` });
    const budget = asset["triangleBudget"];
    if (!tuple3(budget) || !(budget[0] > budget[1] && budget[1] > budget[2] && budget[2] > 0)) issues.push({ code: "lod_budget", path: `${path}.triangleBudget` });
  }
  const plane = assets.at(-1);
  if (!isRecord(plane) || plane["pilotable"] !== false || plane["origin"] !== "centre-of-mass" || JSON.stringify(plane["factionVariants"]) !== JSON.stringify(["khaki", "fieldgrey"]) || JSON.stringify(plane["presentation"]) !== JSON.stringify(["observation", "fixed-linear-strafing"]) || !isRecord(plane["collision"]) || plane["collision"]["kind"] !== "none") {
    issues.push({ code: "support_behavior", path: "assets.biplane" });
  }
  return issues;
}
