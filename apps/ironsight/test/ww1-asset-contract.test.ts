import { describe, expect, it } from "vitest";
import {
  SOLDIER_JOINTS, WEAPON_SOCKETS, WW1_ASSET_MANIFEST, auditWw1AssetManifest,
  type Ww1AssetManifest,
} from "../config/ww1-assets.js";
import { WEAPONS } from "../src/config.js";

class MissingWeaponFixtureError extends Error {
  constructor(readonly index: number) {
    super(`missing weapon fixture ${index}`);
    this.name = "MissingWeaponFixtureError";
  }
}

function weaponAt(index: number): Ww1AssetManifest["weapons"][number] {
  const weapon = WW1_ASSET_MANIFEST.weapons[index];
  if (weapon === undefined) throw new MissingWeaponFixtureError(index);
  return weapon;
}

function withWeapons(weapons: readonly unknown[]): unknown {
  return { ...WW1_ASSET_MANIFEST, weapons };
}

const adversarialManifests: readonly { readonly name: string; readonly candidate: unknown }[] = [
  { name: "empty weapon LODs", candidate: withWeapons([{ ...weaponAt(0), lods: [] }, ...WW1_ASSET_MANIFEST.weapons.slice(1)]) },
  { name: "wrong mechanism sockets", candidate: withWeapons([{ ...weaponAt(0), mechanismSockets: [] }, ...WW1_ASSET_MANIFEST.weapons.slice(1)]) },
  { name: "duplicate faction", candidate: { ...WW1_ASSET_MANIFEST, soldiers: [WW1_ASSET_MANIFEST.soldiers[0], { ...WW1_ASSET_MANIFEST.soldiers[1], faction: "khaki" }] } },
  { name: "empty soldier LODs", candidate: { ...WW1_ASSET_MANIFEST, soldiers: [{ ...WW1_ASSET_MANIFEST.soldiers[0], lods: [] }, WW1_ASSET_MANIFEST.soldiers[1]] } },
  { name: "wrong FP arms identity", candidate: { ...WW1_ASSET_MANIFEST, fpArms: { ...WW1_ASSET_MANIFEST.fpArms, key: "hands", skeleton: "other-rig" } } },
  { name: "wrong support keys", candidate: { ...WW1_ASSET_MANIFEST, weaponSupport: [{ ...WW1_ASSET_MANIFEST.weaponSupport[0], key: "modern-grenade" }, WW1_ASSET_MANIFEST.weaponSupport[1]] } },
  { name: "pilotable biplane", candidate: { ...WW1_ASSET_MANIFEST, supportAirframe: { ...WW1_ASSET_MANIFEST.supportAirframe, pilotable: true } } },
  { name: "missing animation inventory", candidate: { ...WW1_ASSET_MANIFEST, animationContract: { ...WW1_ASSET_MANIFEST.animationContract, remoteHoldClips: [], fpActions: [], markers: [] } } },
  { name: "wrong fallback identity", candidate: { ...WW1_ASSET_MANIFEST, fallback: { ...WW1_ASSET_MANIFEST.fallback, key: "modern-fallback", publicUrl: "/wrong.glb" } } },
  { name: "unchecked invalid budgets", candidate: { ...WW1_ASSET_MANIFEST, budgets: { ...WW1_ASSET_MANIFEST.budgets, fpDraws: 0, fpBones: 999, soldierTextureMax: 4096 } } },
];

describe("WW1 asset delivery contract", () => {
  it("accepts the complete five-slot, two-faction delivery plan", () => {
    // Given the authored contract, when it crosses the audit boundary, then it has no machine issues.
    expect(auditWw1AssetManifest(WW1_ASSET_MANIFEST)).toEqual([]);
  });

  it("rejects a non-object manifest boundary", () => {
    expect(auditWw1AssetManifest(null)).toEqual([{ code: "manifest_shape", path: "$" }]);
  });

  it("derives reload timing from the authoritative weapon table", () => {
    for (const [index, asset] of WW1_ASSET_MANIFEST.weapons.entries()) {
      const spec = WEAPONS[index];
      expect(spec).toBeDefined();
      expect(asset.reload).toMatchObject({ reloadKind: spec?.reloadKind, reloadMs: spec?.reloadMs });
      if (asset.reload.reloadKind !== "magazine") expect(asset.reload.cycleMs).toBe(spec && "cycleMs" in spec ? spec.cycleMs : undefined);
    }
  });

  it("includes non-paid weapon support and the non-pilot support airframe", () => {
    expect(WW1_ASSET_MANIFEST.weaponSupport.map((asset) => asset.key)).toEqual(["grenade", "clip-shell-casing"]);
    expect(WW1_ASSET_MANIFEST.supportAirframe).toMatchObject({ key: "biplane", provenance: { receiptRole: "support-airframe", sourceKind: "original-authored" } });
    expect(WW1_ASSET_MANIFEST.supportAirframe.pilotable).toBe(false);
  });

  it("fixes delivery filenames, role kits, and animation inventories", () => {
    expect(WW1_ASSET_MANIFEST.weapons.map((asset) => asset.publicUrl)).toEqual([
      "/assets/ww1/weapons/automatic-rifle.glb", "/assets/ww1/weapons/trench-smg.glb", "/assets/ww1/weapons/pump-shotgun.glb", "/assets/ww1/weapons/bolt-rifle.glb", "/assets/ww1/weapons/service-pistol.glb",
    ]);
    expect(WW1_ASSET_MANIFEST.soldiers[0].kitVariants).toEqual(["anchor", "flanker", "sniper"]);
    expect(WW1_ASSET_MANIFEST.animationContract).toMatchObject({ remoteHoldClips: { length: 11 }, fpActions: { length: 8 }, independentCycleWeapons: ["pump_shotgun", "bolt_service_rifle"] });
  });

  it("marks exactly the six paid environment candidates", () => {
    const paid = WW1_ASSET_MANIFEST.environment.filter((asset) => asset.provenance.sourceKind === "meshy-generated").map((asset) => asset.key);
    expect(paid).toEqual(["brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post", "freight-wagon-wreck"]);
  });

  it("rejects duplicate weapon slots", () => {
    const duplicate = { ...weaponAt(1), slot: 1 };
    const candidate = withWeapons([weaponAt(0), duplicate, ...WW1_ASSET_MANIFEST.weapons.slice(2)]);
    expect(auditWw1AssetManifest(candidate).map((issue) => issue.code)).toContain("duplicate_weapon_slot");
  });

  it("rejects a missing required weapon socket", () => {
    const broken = { ...weaponAt(2), sockets: WEAPON_SOCKETS.filter((socket) => socket !== "muzzle") };
    const candidate = withWeapons([...WW1_ASSET_MANIFEST.weapons.slice(0, 2), broken, ...WW1_ASSET_MANIFEST.weapons.slice(3)]);
    expect(auditWw1AssetManifest(candidate).map((issue) => issue.code)).toContain("missing_socket");
  });

  it("rejects an incomplete common rig mapping", () => {
    const broken = { ...WW1_ASSET_MANIFEST.soldiers[0], requiredJoints: SOLDIER_JOINTS.filter((joint) => joint !== "head") };
    const candidate = { ...WW1_ASSET_MANIFEST, soldiers: [broken, WW1_ASSET_MANIFEST.soldiers[1]] };
    expect(auditWw1AssetManifest(candidate).map((issue) => issue.code)).toContain("invalid_rig_mapping");
  });

  it("rejects a published hash on rejected provenance", () => {
    const broken = { ...weaponAt(0), provenance: { ...weaponAt(0).provenance, status: "rejected", outputSha256: "a".repeat(64) } };
    const candidate = withWeapons([broken, ...WW1_ASSET_MANIFEST.weapons.slice(1)]);
    expect(auditWw1AssetManifest(candidate).map((issue) => issue.code)).toContain("rejected_public_hash");
  });

  it("rejects a prop receipt role attached to a hero weapon", () => {
    const broken = { ...weaponAt(4), provenance: { ...weaponAt(4).provenance, receiptRole: "environment-prop" } };
    const candidate = withWeapons([...WW1_ASSET_MANIFEST.weapons.slice(0, 4), broken]);
    expect(auditWw1AssetManifest(candidate).map((issue) => issue.code)).toContain("receipt_role_mismatch");
  });

  it("rejects an unknown review state and malformed receipt path", () => {
    const broken = { ...weaponAt(0), provenance: { ...weaponAt(0).provenance, status: "staged", receiptPath: "../outside.json" } };
    const candidate = withWeapons([broken, ...WW1_ASSET_MANIFEST.weapons.slice(1)]);
    expect(auditWw1AssetManifest(candidate).map((issue) => issue.code)).toContain("invalid_provenance");
  });

  it.each(adversarialManifests)("rejects $name", ({ candidate }) => {
    expect(auditWw1AssetManifest(candidate)).not.toEqual([]);
  });
});
