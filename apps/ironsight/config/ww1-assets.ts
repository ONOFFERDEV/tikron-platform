import { WEAPON_KEYS } from "../src/weapon-contract.js";
import { WEAPONS } from "../src/config.js";
import type { WeaponKey, WeaponReload, WeaponSpec } from "./schema.js";

export const ASSET_RECEIPT_ROLES = [
  "hero-weapon", "hero-character", "first-person-arms", "environment-prop",
  "weapon-support", "support-airframe", "animation-source", "deterministic-fallback",
] as const;
export type AssetReceiptRole = (typeof ASSET_RECEIPT_ROLES)[number];

export const WEAPON_SOCKETS = ["grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front"] as const;
export const WEAPON_LODS = ["fp", "tp_lod0", "tp_lod1", "tp_lod2"] as const;
export const SOLDIER_LODS = ["lod0", "lod1", "lod2"] as const;
export const REMOTE_HOLD_CLIPS = ["idle", "walk", "run", "sprint", "crouch_idle", "crouch_walk", "strafe_left", "strafe_right", "backpedal", "crouch_left", "crouch_right"] as const;
export const FP_ACTIONS = ["equip", "ready", "ads_in", "ads_out", "fire", "sprint_in", "sprint_out", "reload"] as const;
export const ANIMATION_MARKERS = ["hand_contact", "magazine_seat", "shell_insert", "bolt_close", "casing", "foley"] as const;
export const ENVIRONMENT_KEYS = ["trench-wall", "duckboard", "sandbag", "timber-brace", "wire", "brick-rubble", "rail-platform", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck"] as const;
export const MESHY_ENVIRONMENT_KEYS = ["brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck"] as const;
export const SOLDIER_JOINTS = [
  "Pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head", "eyes", "eyebrows",
  "clavicle_l", "UpperArm_L", "lowerarm_l", "Hand_L", "thumb_01_l", "thumb_02_l", "thumb_03_l",
  "indexFinger_01_l", "indexFinger_02_l", "indexFinger_03_l", "indexFinger_04_l",
  "finger_01_l", "finger_02_l", "finger_03_l", "finger_04_l", "clavicle_r", "UpperArm_R",
  "lowerarm_r", "Hand_R", "thumb_01_r", "thumb_02_r", "thumb_03_r", "indexFinger_01_r",
  "indexFinger_02_r", "indexFinger_03_r", "indexFinger_04_r", "finger_01_r", "finger_02_r",
  "finger_03_r", "finger_04_r", "Thigh_R", "calf_r", "Foot_R", "ball_r", "toes_r", "Thigh_L",
  "calf_l", "Foot_L", "ball_l", "toes_l", "ik_foot_root", "ik_foot_l", "ik_foot_r",
  "ik_hand_root", "ik_hand_gun", "ik_hand_l", "ik_hand_r",
] as const;

export type ReviewState =
  | { readonly status: "planned"; readonly outputSha256: null }
  | { readonly status: "accepted"; readonly outputSha256: string }
  | { readonly status: "rejected"; readonly outputSha256: null };
export type Provenance = ReviewState & {
  readonly receiptRole: AssetReceiptRole;
  readonly receiptPath: string;
  readonly sourceKind: "meshy-generated" | "original-authored" | "licensed-derived";
};
export type WeaponAsset = {
  readonly key: WeaponKey;
  readonly wireIndex: number;
  readonly slot: number;
  readonly label: string;
  readonly publicUrl: string;
  readonly rootNode: string;
  readonly sight: "iron" | "scope";
  readonly opticCapable: false;
  readonly reload: WeaponReload;
  readonly lods: readonly string[];
  readonly sockets: readonly string[];
  readonly mechanicalParts: readonly string[];
  readonly mechanismSockets: readonly string[];
  readonly provenance: Provenance;
};
export type SoldierAsset = {
  readonly faction: "khaki" | "fieldgrey";
  readonly publicUrl: string;
  readonly skeleton: "ironsight-humanoid-55";
  readonly lods: readonly string[];
  readonly requiredJoints: readonly string[];
  readonly kitVariants: readonly ["anchor", "flanker", "sniper"];
  readonly equipment: readonly ["ammunition-pouches", "canteen", "pack", "blanket-roll"];
  readonly kitHitTarget: false;
  readonly provenance: Provenance;
};
export type InventoryAsset = {
  readonly key: string;
  readonly publicUrl: string;
  readonly provenance: Provenance;
};
export type Ww1AssetManifest = {
  readonly schemaVersion: 1;
  readonly coordinateSystem: { readonly units: "metres"; readonly up: "+Y"; readonly forward: "+Z"; readonly weaponOrigin: "grip_r" };
  readonly budgets: {
    readonly fpWeaponAndArmsTriangles: 30_000; readonly fpDraws: 8; readonly fpBones: 48;
    readonly remoteLod0Triangles: 18_000; readonly remoteLod1Triangles: 8_000;
    readonly remoteLod2Triangles: 3_000; readonly remoteDraws: 3; readonly fullBodyBones: 64;
    readonly characterMaterialKinds: 6; readonly fpTextureMax: 1024;
    readonly soldierTextureMax: 1024; readonly smallGearTextureMax: 512;
  };
  readonly weapons: readonly WeaponAsset[];
  readonly soldiers: readonly SoldierAsset[];
  readonly fpArms: InventoryAsset & { readonly skeleton: "ironsight-fp-arms"; readonly sleeveVariants: readonly ["khaki", "fieldgrey"] };
  readonly weaponSupport: readonly InventoryAsset[];
  readonly environment: readonly InventoryAsset[];
  readonly supportAirframe: InventoryAsset & { readonly factionVariants: readonly ["khaki", "fieldgrey"]; readonly pilotable: false };
  readonly animationSources: readonly InventoryAsset[];
  readonly animationContract: { readonly remoteHoldClips: readonly string[]; readonly fpActions: readonly string[]; readonly independentCycleWeapons: readonly ["pump_shotgun", "bolt_service_rifle"]; readonly markers: readonly string[] };
  readonly fallback: InventoryAsset;
};

const planned = (receiptRole: AssetReceiptRole, key: string, sourceKind: Provenance["sourceKind"]): Provenance => ({
  status: "planned", outputSha256: null, receiptRole, sourceKind,
  receiptPath: `artifacts/ww1/receipts/${key.replaceAll("_", "-")}.json`,
});
const weapon = (
  spec: WeaponSpec, wireIndex: number, label: string, assetSlug: string,
  mechanicalParts: readonly string[], mechanismSockets: readonly string[],
): WeaponAsset => ({
  key: spec.key, wireIndex, slot: spec.slot, label, publicUrl: `/assets/ww1/weapons/${assetSlug}.glb`,
  rootNode: spec.key, sight: spec.sight, opticCapable: false, reload: reloadFrom(spec), lods: WEAPON_LODS, sockets: WEAPON_SOCKETS,
  mechanicalParts, mechanismSockets, provenance: planned("hero-weapon", spec.key, "meshy-generated"),
});

function weaponFromSpec(spec: WeaponSpec, wireIndex: number): WeaponAsset {
  switch (spec.key) {
    case "automatic_rifle": return weapon(spec, wireIndex, "Automatic Rifle", "automatic-rifle", ["magazine", "bolt"], ["magwell", "chamber"]);
    case "trench_smg": return weapon(spec, wireIndex, "Trench SMG", "trench-smg", ["magazine", "bolt"], ["magwell", "chamber"]);
    case "pump_shotgun": return weapon(spec, wireIndex, "Pump Shotgun", "pump-shotgun", ["pump", "shell"], ["chamber"]);
    case "bolt_service_rifle": return weapon(spec, wireIndex, "Bolt Service Rifle", "bolt-rifle", ["bolt", "clip"], ["chamber", "clip_mount"]);
    case "service_pistol": return weapon(spec, wireIndex, "Service Pistol", "service-pistol", ["slide", "magazine"], ["magwell", "chamber"]);
  }
}

function reloadFrom(spec: WeaponSpec): WeaponReload {
  switch (spec.reloadKind) {
    case "magazine": return { reloadKind: spec.reloadKind, reloadMs: spec.reloadMs };
    case "pump": return { reloadKind: spec.reloadKind, reloadMs: spec.reloadMs, cycleMs: spec.cycleMs, reloadStartMs: spec.reloadStartMs, reloadInsertMs: spec.reloadInsertMs, reloadEndMs: spec.reloadEndMs };
    case "stripper_clip": return { reloadKind: spec.reloadKind, reloadMs: spec.reloadMs, cycleMs: spec.cycleMs };
  }
}

export const WW1_ASSET_MANIFEST = {
  schemaVersion: 1,
  coordinateSystem: { units: "metres", up: "+Y", forward: "+Z", weaponOrigin: "grip_r" },
  budgets: {
    fpWeaponAndArmsTriangles: 30_000, fpDraws: 8, fpBones: 48,
    remoteLod0Triangles: 18_000, remoteLod1Triangles: 8_000, remoteLod2Triangles: 3_000,
    remoteDraws: 3, fullBodyBones: 64, characterMaterialKinds: 6,
    fpTextureMax: 1024, soldierTextureMax: 1024, smallGearTextureMax: 512,
  },
  weapons: WEAPONS.map(weaponFromSpec),
  soldiers: [
    { faction: "khaki", publicUrl: "/assets/ww1/characters/soldier-khaki.glb", skeleton: "ironsight-humanoid-55", lods: SOLDIER_LODS, requiredJoints: SOLDIER_JOINTS, kitVariants: ["anchor", "flanker", "sniper"], equipment: ["ammunition-pouches", "canteen", "pack", "blanket-roll"], kitHitTarget: false, provenance: planned("hero-character", "soldier-khaki", "meshy-generated") },
    { faction: "fieldgrey", publicUrl: "/assets/ww1/characters/soldier-fieldgrey.glb", skeleton: "ironsight-humanoid-55", lods: SOLDIER_LODS, requiredJoints: SOLDIER_JOINTS, kitVariants: ["anchor", "flanker", "sniper"], equipment: ["ammunition-pouches", "canteen", "pack", "blanket-roll"], kitHitTarget: false, provenance: planned("hero-character", "soldier-fieldgrey", "meshy-generated") },
  ],
  fpArms: { key: "fp-arms", publicUrl: "/assets/ww1/characters/fp-arms.glb", skeleton: "ironsight-fp-arms", sleeveVariants: ["khaki", "fieldgrey"], provenance: planned("first-person-arms", "fp-arms", "original-authored") },
  weaponSupport: [
    { key: "grenade", publicUrl: "/assets/ww1/weapons/grenade.glb", provenance: planned("weapon-support", "grenade", "original-authored") },
    { key: "clip-shell-casing", publicUrl: "/assets/ww1/weapons/clip-shell-casing.glb", provenance: planned("weapon-support", "clip-shell-casing", "original-authored") },
  ],
  environment: ENVIRONMENT_KEYS.map((key) => ({ key, publicUrl: `/assets/ww1/environment/${key}.glb`, provenance: planned("environment-prop", key, MESHY_ENVIRONMENT_KEYS.some((candidate) => candidate === key) ? "meshy-generated" : "original-authored") })),
  supportAirframe: { key: "biplane", publicUrl: "/assets/ww1/support/biplane.glb", factionVariants: ["khaki", "fieldgrey"], pilotable: false, provenance: planned("support-airframe", "biplane", "original-authored") },
  animationSources: [
    { key: "humanoid-holds", publicUrl: "/assets/ww1/characters/soldier-khaki.glb", provenance: planned("animation-source", "humanoid-holds", "licensed-derived") },
  ],
  animationContract: { remoteHoldClips: REMOTE_HOLD_CLIPS, fpActions: FP_ACTIONS, independentCycleWeapons: ["pump_shotgun", "bolt_service_rifle"], markers: ANIMATION_MARKERS },
  fallback: { key: "ww1-fallback", publicUrl: "/assets/ww1/fallback/issued-kit.glb", provenance: planned("deterministic-fallback", "ww1-fallback", "original-authored") },
} as const satisfies Ww1AssetManifest;

export const ASSET_CONTRACT_ISSUES = [
  "manifest_shape", "duplicate_weapon_slot", "weapon_key_order", "non_iron_sight", "missing_socket",
  "missing_mechanical_part", "missing_mechanism_socket", "invalid_lod", "invalid_rig_mapping", "inventory_identity",
  "rejected_public_hash", "receipt_role_mismatch", "invalid_provenance", "budget_mismatch", "animation_contract",
] as const;
export type AssetContractIssue = { readonly code: (typeof ASSET_CONTRACT_ISSUES)[number]; readonly path: string };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (Array.isArray(actual) && Array.isArray(expected)) return actual.length === expected.length && actual.every((value, index) => sameValue(value, expected[index]));
  if (!isRecord(actual) || !isRecord(expected)) return false;
  const actualKeys = Object.keys(actual), expectedKeys = Object.keys(expected);
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => sameValue(actual[key], expected[key]));
}

function sameFields(actual: unknown, expected: unknown, fields: readonly string[]): boolean {
  return isRecord(actual) && isRecord(expected) && fields.every((field) => sameValue(actual[field], expected[field]));
}

function includesString(values: readonly string[], value: unknown): boolean {
  return typeof value === "string" && values.includes(value);
}

function auditProvenance(value: unknown, expected: Provenance, path: string, issues: AssetContractIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ code: "manifest_shape", path });
    return;
  }
  if (value["receiptRole"] !== expected.receiptRole) issues.push({ code: "receipt_role_mismatch", path: `${path}.receiptRole` });
  if (value["sourceKind"] !== expected.sourceKind || value["receiptPath"] !== expected.receiptPath) issues.push({ code: "invalid_provenance", path });
  if (!includesString(ASSET_RECEIPT_ROLES, value["receiptRole"]) || !includesString(["meshy-generated", "original-authored", "licensed-derived"], value["sourceKind"]) || typeof value["receiptPath"] !== "string" || !/^artifacts\/ww1\/receipts\/[a-z0-9-]+\.json$/.test(value["receiptPath"])) {
    issues.push({ code: "invalid_provenance", path });
  }
  if (!includesString(["planned", "accepted", "rejected"], value["status"])) issues.push({ code: "invalid_provenance", path: `${path}.status` });
  if (value["status"] === "planned" && value["outputSha256"] !== null) issues.push({ code: "invalid_provenance", path: `${path}.outputSha256` });
  if (value["status"] === "rejected" && value["outputSha256"] !== null) {
    issues.push({ code: "rejected_public_hash", path: `${path}.outputSha256` });
  }
  if (value["status"] === "accepted" && (typeof value["outputSha256"] !== "string" || !/^[0-9a-f]{64}$/i.test(value["outputSha256"]))) {
    issues.push({ code: "rejected_public_hash", path: `${path}.outputSha256` });
  }
}

function auditInventory(value: unknown, expected: readonly InventoryAsset[], fields: readonly string[], path: string, issues: AssetContractIssue[]): void {
  if (!Array.isArray(value) || value.length !== expected.length) {
    issues.push({ code: "inventory_identity", path });
    return;
  }
  for (const [index, item] of value.entries()) {
    const baseline = expected[index], itemPath = `${path}[${index}]`;
    if (baseline === undefined || !sameFields(item, baseline, fields)) issues.push({ code: "inventory_identity", path: itemPath });
    if (isRecord(item) && baseline !== undefined) auditProvenance(item["provenance"], baseline.provenance, `${itemPath}.provenance`, issues);
  }
}

export function auditWw1AssetManifest(candidate: unknown): readonly AssetContractIssue[] {
  const issues: AssetContractIssue[] = [];
  if (!isRecord(candidate)) return [{ code: "manifest_shape", path: "$" }];
  if (candidate["schemaVersion"] !== 1 || !sameValue(candidate["coordinateSystem"], WW1_ASSET_MANIFEST.coordinateSystem)) issues.push({ code: "manifest_shape", path: "coordinateSystem" });
  const weapons = candidate["weapons"];
  if (!Array.isArray(weapons) || weapons.length !== WEAPON_KEYS.length) {
    issues.push({ code: "manifest_shape", path: "weapons" });
  } else {
    const slots = new Set<number>();
    for (const [index, value] of weapons.entries()) {
      const path = `weapons[${index}]`, baseline = WW1_ASSET_MANIFEST.weapons[index];
      if (!isRecord(value) || baseline === undefined) {
        issues.push({ code: "manifest_shape", path });
        continue;
      }
      if (!sameFields(value, baseline, ["key", "wireIndex", "slot", "label", "publicUrl", "rootNode", "reload"])) {
        issues.push({ code: "weapon_key_order", path });
      }
      if (typeof value["slot"] === "number" && slots.has(value["slot"])) issues.push({ code: "duplicate_weapon_slot", path: `${path}.slot` });
      if (typeof value["slot"] === "number") slots.add(value["slot"]);
      if (value["sight"] !== "iron" || value["opticCapable"] !== false) issues.push({ code: "non_iron_sight", path });
      if (!sameValue(value["lods"], baseline.lods)) issues.push({ code: "invalid_lod", path: `${path}.lods` });
      if (!sameValue(value["sockets"], baseline.sockets)) issues.push({ code: "missing_socket", path: `${path}.sockets` });
      if (!sameValue(value["mechanicalParts"], baseline.mechanicalParts)) issues.push({ code: "missing_mechanical_part", path: `${path}.mechanicalParts` });
      if (!sameValue(value["mechanismSockets"], baseline.mechanismSockets)) issues.push({ code: "missing_mechanism_socket", path: `${path}.mechanismSockets` });
      auditProvenance(value["provenance"], baseline.provenance, `${path}.provenance`, issues);
    }
  }
  const soldiers = candidate["soldiers"];
  if (!Array.isArray(soldiers) || soldiers.length !== 2) {
    issues.push({ code: "invalid_rig_mapping", path: "soldiers" });
  } else for (const [index, value] of soldiers.entries()) {
    const path = `soldiers[${index}]`;
    const baseline = WW1_ASSET_MANIFEST.soldiers[index];
    if (baseline === undefined || !sameFields(value, baseline, ["faction", "publicUrl", "skeleton", "lods", "requiredJoints", "kitVariants", "equipment", "kitHitTarget"])) {
      issues.push({ code: "invalid_rig_mapping", path });
    }
    if (isRecord(value) && baseline !== undefined) auditProvenance(value["provenance"], baseline.provenance, `${path}.provenance`, issues);
  }
  if (!sameValue(candidate["budgets"], WW1_ASSET_MANIFEST.budgets)) issues.push({ code: "budget_mismatch", path: "budgets" });
  const fpArms = candidate["fpArms"];
  if (!sameFields(fpArms, WW1_ASSET_MANIFEST.fpArms, ["key", "publicUrl", "skeleton", "sleeveVariants"])) issues.push({ code: "inventory_identity", path: "fpArms" });
  if (isRecord(fpArms)) auditProvenance(fpArms["provenance"], WW1_ASSET_MANIFEST.fpArms.provenance, "fpArms.provenance", issues);
  auditInventory(candidate["environment"], WW1_ASSET_MANIFEST.environment, ["key", "publicUrl"], "environment", issues);
  auditInventory(candidate["weaponSupport"], WW1_ASSET_MANIFEST.weaponSupport, ["key", "publicUrl"], "weaponSupport", issues);
  const supportAirframe = candidate["supportAirframe"];
  if (!sameFields(supportAirframe, WW1_ASSET_MANIFEST.supportAirframe, ["key", "publicUrl", "factionVariants", "pilotable"])) issues.push({ code: "inventory_identity", path: "supportAirframe" });
  if (isRecord(supportAirframe)) auditProvenance(supportAirframe["provenance"], WW1_ASSET_MANIFEST.supportAirframe.provenance, "supportAirframe.provenance", issues);
  auditInventory(candidate["animationSources"], WW1_ASSET_MANIFEST.animationSources, ["key", "publicUrl"], "animationSources", issues);
  if (!sameValue(candidate["animationContract"], WW1_ASSET_MANIFEST.animationContract)) issues.push({ code: "animation_contract", path: "animationContract" });
  const fallback = candidate["fallback"];
  if (!sameFields(fallback, WW1_ASSET_MANIFEST.fallback, ["key", "publicUrl"])) issues.push({ code: "inventory_identity", path: "fallback" });
  if (isRecord(fallback)) auditProvenance(fallback["provenance"], WW1_ASSET_MANIFEST.fallback.provenance, "fallback.provenance", issues);
  return issues;
}
