import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import {
  CalibratedActorSlots,
  type CalibratedActorAcquire,
} from "../client/calibrated-actor-slots.js";
import type { CalibratedActorTemplate } from "../client/calibrated-actor-loader.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";

function template(faction: "khaki" | "fieldgrey"): CalibratedActorTemplate {
  return {
    gltf: { scene: {}, scenes: [], animations: [] } as unknown as GLTF,
    source: {
      faction,
      url: `/${faction}.glb`,
      metaUrl: `/${faction}.json`,
      expectedGlbSha256: "a".repeat(64),
      expectedMetaSha256: "b".repeat(64),
      hitComponentSha256: "c".repeat(64),
      normalizationTransformSha256: "d".repeat(64),
      normalization: {
        standHeightM: 1.8, sourceHeightM: 2, baseScale: 0.9, localMinY: -0.1,
        feetOffsetY: 0.09, rootScale: [0.9, 0.9, 0.9], rootQuaternion: [0, 0, 0, 1],
        rootXZ: [0, 0], modelYawOffsetRadians: 0,
      },
      rig: { label: "test", boneCount: 1, boneNames: ["head"], coreBoneNames: ["head"],
        coreHitJoints: ["head"] },
    },
    normalization: {
      standHeightM: 1.8, sourceHeightM: 2, baseScale: 0.9, localMinY: -0.1,
      feetOffsetY: 0.09, rootScale: [0.9, 0.9, 0.9], rootQuaternion: [0, 0, 0, 1],
      rootXZ: [0, 0], modelYawOffsetRadians: 0,
    },
    rig: { label: "test", boneCount: 1, boneNames: ["head"], coreBoneNames: ["head"],
      coreHitJoints: ["head"] },
    equipmentHitTarget: false,
  };
}

describe("calibrated actor faction slots", () => {
  it("retains one resolved lease per faction and releases both on dispose", async () => {
    const releases = [vi.fn(), vi.fn()];
    const values = [template("khaki"), template("fieldgrey")];
    const acquire: CalibratedActorAcquire = team => ({
      value: Promise.resolve(values[team]), release: releases[team]!,
    });
    const ready = vi.fn();
    const slots = new CalibratedActorSlots(STAGE33_HIT_IDENTITIES, ready, acquire);
    expect(slots.settled()).toBe(false);
    await Promise.all(slots.start());
    expect(slots.settled()).toBe(true);
    expect(slots.template(0)).toBe(values[0]);
    expect(slots.template(1)).toBe(values[1]);
    expect(ready.mock.calls.map(call => call[0])).toEqual([0, 1]);
    slots.dispose();
    expect(releases[0]).toHaveBeenCalledOnce();
    expect(releases[1]).toHaveBeenCalledOnce();
  });

  it("keeps rejected and late-resolving slots unavailable without duplicate release", async () => {
    let resolveLate: ((value: CalibratedActorTemplate | undefined) => void) | undefined;
    const releases = [vi.fn(), vi.fn()];
    const acquire: CalibratedActorAcquire = team => ({
      value: team === 0 ? Promise.resolve(undefined) : new Promise(resolve => { resolveLate = resolve; }),
      release: releases[team]!,
    });
    const ready = vi.fn();
    const slots = new CalibratedActorSlots(STAGE33_HIT_IDENTITIES, ready, acquire);
    const pending = slots.start();
    await pending[0];
    expect(slots.settled()).toBe(false);
    expect(slots.template(0)).toBeUndefined();
    expect(releases[0]).toHaveBeenCalledOnce();
    slots.dispose();
    if (resolveLate === undefined) throw new Error("late resolver missing");
    resolveLate(template("fieldgrey"));
    await pending[1];
    expect(slots.settled()).toBe(true);
    expect(ready).not.toHaveBeenCalled();
    expect(releases[1]).toHaveBeenCalledOnce();
    expect(slots.start()).toEqual([]);
  });
});
