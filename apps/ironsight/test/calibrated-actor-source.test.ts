import { describe, expect, it } from "vitest";
import {
  calibratedActorSource,
} from "../client/calibrated-actor-source.js";
import {
  STAGE33_HIT_IDENTITIES,
  type Stage33HitIdentity,
} from "../src/stage33-hit-calibration.js";

describe("calibrated actor source admission", () => {
  it("keeps both current Stage33 source identities on the calibrated fallback", () => {
    expect(calibratedActorSource(0, STAGE33_HIT_IDENTITIES.khaki)).toBeUndefined();
    expect(calibratedActorSource(1, STAGE33_HIT_IDENTITIES.fieldgrey)).toBeUndefined();
  });

  it("does not promote quarantined public Stage16 hashes into Stage33 identities", () => {
    const quarantined = [
      [0, STAGE33_HIT_IDENTITIES.khaki, "61255ca272403f54a4d81153c1ac5a4d0675c6df9f2e76aebfbd3dd58c71acd8"],
      [1, STAGE33_HIT_IDENTITIES.fieldgrey, "96c123b8d81da64dc2c43e41c28b86105d0f49494ba84146485d1ee8aaf11182"],
    ] as const;
    for (const [team, identity, glbSha256] of quarantined) {
      expect(calibratedActorSource(team, { ...identity, glbSha256 })).toBeUndefined();
    }
  });

  it("rejects wrong teams, factions, and forged identity fields", () => {
    expect(calibratedActorSource(1, STAGE33_HIT_IDENTITIES.khaki)).toBeUndefined();
    expect(calibratedActorSource(0, STAGE33_HIT_IDENTITIES.fieldgrey)).toBeUndefined();
    expect(calibratedActorSource(2, STAGE33_HIT_IDENTITIES.fieldgrey)).toBeUndefined();
    const identity = STAGE33_HIT_IDENTITIES.khaki;
    const wrongComponent: Stage33HitIdentity = { ...identity, hitComponentSha256: "0".repeat(64) };
    const wrongNormalization: Stage33HitIdentity = {
      ...identity,
      normalizationTransformSha256: "f".repeat(64),
    };
    expect(calibratedActorSource(0, wrongComponent)).toBeUndefined();
    expect(calibratedActorSource(0, wrongNormalization)).toBeUndefined();
  });
});
