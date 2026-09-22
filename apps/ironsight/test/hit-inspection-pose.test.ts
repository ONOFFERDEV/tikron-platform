import { describe, expect, it } from "vitest";

import { describeInspectionActor, inspectionHitFields } from "../client/hit-inspection-pose.js";
import { decodeHitAnimationClip } from "../src/hit-state-bucket.js";

describe("HIT authority inspector stamps", () => {
  it("encodes one exact weapon clip phase, reaction age and segment boundary", () => {
    const fields = inspectionHitFields(2, "crouch_walk", 0.625, 100_000, { kind: 2, ageMs: 120 });
    expect(decodeHitAnimationClip(fields?.hitClipIndex ?? -1)).toBe("shotgun_crouch_walk");
    expect(fields).toMatchObject({ hitClipStartedAt: 99_375, hitBlendSources: [],
      hitReactionKind: 2, hitReactionStartedAt: 99_880, hitReactionSeq: 1,
      hitSegmentSeq: 1, hitSegmentStartedAt: 99_375 });
  });

  it("rejects unsupported clips and invalid deterministic samples", () => {
    expect(inspectionHitFields(0, "run", 0.5, 100_000)).toBeUndefined();
    expect(inspectionHitFields(5, "idle", 0.5, 100_000)).toBeUndefined();
    expect(inspectionHitFields(0, "idle", Number.NaN, 100_000)).toBeUndefined();
  });
  it("reports calibrated fallback and resolved model identity without legacy ambiguity", () => {
    const identity = { faction: "khaki" as const, glbSha256: "a", hitComponentSha256: "b",
      normalizationTransformSha256: "c" };
    expect(describeInspectionActor({ calibrated: false, rigKind: "model" })).toMatchObject({
      supported: true, authority: "legacy", renderedSource: "legacy-model",
    });
    expect(describeInspectionActor({ calibrated: true, rigKind: "calibratedFallback",
      requestedIdentity: identity })).toMatchObject({ supported: true, authority: "calibrated",
      renderedSource: "calibrated-fallback", requestedIdentity: identity });
    expect(describeInspectionActor({ calibrated: true, rigKind: "calibratedModel",
      requestedIdentity: identity, resolvedSourceIdentity: identity })).toMatchObject({
      renderedSource: "calibrated-model", resolvedSourceIdentity: identity,
    });
    expect(describeInspectionActor({ calibrated: true, issue: "unsupported" })).toMatchObject({
      supported: false, issue: "unsupported", renderedSource: "none",
    });
  });

});
