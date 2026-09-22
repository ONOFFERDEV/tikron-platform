import { afterEach, describe, expect, it, vi } from "vitest";

import { SOLDIER_JOINTS, WW1_ASSET_MANIFEST } from "../config/ww1-assets.js";
import { HIT_RIG_POSE_DATA } from "../src/hit-rig-pose-data.js";
import { sampleHitAnimationTimeline, sampleHitReaction } from "../src/hit-animation-timeline.js";
import { inspectionHitFields } from "../client/hit-inspection-pose.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";

function acceptedAdmission() {
  const bones = [...SOLDIER_JOINTS, "c195_hand_bridge"];
  return {
    schemaVersion: 2, kind: "ww1-licensed-derived-soldier-admission", candidateStatus: "accepted",
    sourceOfflineAccepted: true, runtimeAccepted: true,
    review: { status: "accepted", evidence: "evidence/report.json", sha256: "f".repeat(64) },
    assets: (["khaki", "fieldgrey"] as const).map(faction => {
      const identity = STAGE33_HIT_IDENTITIES[faction];
      const source = HIT_RIG_POSE_DATA.factions[faction];
      return { key: `soldier-${faction}`, glb: `assets/ww1/characters/soldier-${faction}.glb`,
        glbSha256: identity.glbSha256, meta: `assets/ww1/characters/soldier-${faction}.meta.json`,
        metaSha256: "e".repeat(64), hitComponentSha256: identity.hitComponentSha256,
        normalizationTransformSha256: identity.normalizationTransformSha256,
        runtimeNormalization: { normalizationTransformSha256: identity.normalizationTransformSha256,
          baseScale: source.baseScale, localMinY: source.localMinY },
        skeleton: { boneCount: bones.length, boneNames: bones, coreBoneNames: [...SOLDIER_JOINTS] as string[] },
      };
    }),
  };
}

function acceptedManifest() {
  return {
    ...WW1_ASSET_MANIFEST,
    soldiers: (["khaki", "fieldgrey"] as const).map(faction => {
      const identity = STAGE33_HIT_IDENTITIES[faction];
      return { ...WW1_ASSET_MANIFEST.soldiers.find(asset => asset.faction === faction),
        faction, publicUrl: `/assets/ww1/characters/soldier-${faction}.glb`,
        requiredJoints: [...SOLDIER_JOINTS] as string[],
        provenance: { status: "accepted", outputSha256: identity.glbSha256,
          receiptRole: "hero-character", receiptPath: "evidence/receipt.json",
          sourceKind: "licensed-derived" },
      };
    }),
  };
}

async function factory(admission?: unknown, manifest?: unknown) {
  vi.resetModules();
  if (admission !== undefined) vi.doMock("../config/ww1-soldier-candidate-admission.json",
    () => ({ default: admission }));
  if (manifest !== undefined) vi.doMock("../config/ww1-assets.js", async importOriginal => ({
    ...await importOriginal<typeof import("../config/ww1-assets.js")>(),
    WW1_ASSET_MANIFEST: manifest,
  }));
  return (await import("../src/hit-authority-contract.js")).createBundledHitAuthorityContract();
}

afterEach(() => { vi.doUnmock("../config/ww1-soldier-candidate-admission.json"); vi.doUnmock("../config/ww1-assets.js"); });

describe("bundled hit authority admission", () => {
  it("keeps the current quarantine inactive", async () => {
    expect(await factory()).toBeUndefined();
  });

  it("activates both consumers only for one complete reviewed identity set", async () => {
    const contract = await factory(acceptedAdmission(), acceptedManifest());
    expect(contract?.identityForTeam(0)).toEqual(STAGE33_HIT_IDENTITIES.khaki);
    expect(contract?.identityForTeam(1)).toEqual(STAGE33_HIT_IDENTITIES.fieldgrey);
    expect(contract?.identityForTeam(2)).toBeUndefined();
    expect(contract?.hitAnimationPolicy.weaponFamilies).toEqual(["rifle", "smg", "shotgun", "sniper", "pistol"]);
    const fields = inspectionHitFields(2, "crouch_walk", 0.625, 100_000, { kind: 2, ageMs: 120 });
    const actions = fields === undefined ? undefined : sampleHitAnimationTimeline({
      currentIndex: fields.hitClipIndex, currentStartedAt: fields.hitClipStartedAt,
      sources: fields.hitBlendSources,
    }, 100_000);
    const reaction = fields === undefined ? undefined : sampleHitReaction({ kind: fields.hitReactionKind,
      startedAt: fields.hitReactionStartedAt, seq: fields.hitReactionSeq }, 100_000);
    expect(actions?.at(-1)).toMatchObject({ phaseMs: 625, current: true });
    expect(reaction).toMatchObject({ kind: 2, ageMs: 120 });
    expect(contract?.evaluator({ identity: STAGE33_HIT_IDENTITIES.khaki,
      actions: actions ?? [], reaction })?.headRadius).toBeGreaterThan(0);
  });

  it.each(["glbSha256", "hitComponentSha256", "normalizationTransformSha256"] as const)(
    "rejects a mismatched %s", async field => {
      const admission = acceptedAdmission();
      const first = admission.assets[0];
      if (first === undefined) throw new Error("khaki admission fixture missing");
      admission.assets[0] = { ...first, [field]: "0".repeat(64) };
      expect(await factory(admission, acceptedManifest())).toBeUndefined();
    },
  );

  it("rejects one missing faction and unreviewed admission", async () => {
    const missing = acceptedAdmission();
    missing.assets.pop();
    expect(await factory(missing, acceptedManifest())).toBeUndefined();
    const unreviewed = acceptedAdmission();
    unreviewed.review.status = "pending";
    expect(await factory(unreviewed, acceptedManifest())).toBeUndefined();
  });

  it("rejects an inconsistent full inventory or a missing evaluator dependency", async () => {
    const inconsistent = acceptedAdmission();
    const first = inconsistent.assets[0];
    if (first === undefined) throw new Error("khaki admission fixture missing");
    inconsistent.assets[0] = { ...first, skeleton: { ...first.skeleton, boneCount: first.skeleton.boneCount + 1 } };
    expect(await factory(inconsistent, acceptedManifest())).toBeUndefined();

    const missingDependency = acceptedAdmission();
    const second = missingDependency.assets[1];
    const evaluatorBone = HIT_RIG_POSE_DATA.rig.bones[0]?.name;
    if (second === undefined || evaluatorBone === undefined) throw new Error("evaluator fixture missing");
    const boneNames = second.skeleton.boneNames.filter(name => name !== evaluatorBone);
    missingDependency.assets[1] = { ...second, skeleton: { ...second.skeleton,
      boneCount: boneNames.length, boneNames } };
    expect(await factory(missingDependency, acceptedManifest())).toBeUndefined();

    for (const invalidName of ["", "head"]) {
      const invalidInventory = acceptedAdmission();
      const asset = invalidInventory.assets[0];
      if (asset === undefined) throw new Error("khaki admission fixture missing");
      const invalidNames = [...asset.skeleton.boneNames];
      invalidNames[invalidNames.length - 1] = invalidName;
      invalidInventory.assets[0] = { ...asset, skeleton: { ...asset.skeleton, boneNames: invalidNames } };
      expect(await factory(invalidInventory, acceptedManifest())).toBeUndefined();
    }
  });

  it("does not confuse the evaluator subset with the canonical core inventory", async () => {
    const evaluatorBones = HIT_RIG_POSE_DATA.rig.bones.map(bone => bone.name);
    const wrongCore = acceptedAdmission();
    const first = wrongCore.assets[0];
    if (first === undefined) throw new Error("khaki admission fixture missing");
    wrongCore.assets[0] = { ...first, skeleton: { ...first.skeleton, coreBoneNames: evaluatorBones } };
    expect(await factory(wrongCore, acceptedManifest())).toBeUndefined();

    const wrongManifest = acceptedManifest();
    const manifestFirst = wrongManifest.soldiers[0];
    if (manifestFirst === undefined) throw new Error("khaki manifest fixture missing");
    wrongManifest.soldiers[0] = { ...manifestFirst, requiredJoints: evaluatorBones };
    expect(await factory(acceptedAdmission(), wrongManifest)).toBeUndefined();
  });
});
