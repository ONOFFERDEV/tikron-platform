import { describe, expect, it } from "vitest";
import cosmetic from "../config/ww1-soldier-cosmetic-admission.json";
import { cosmeticActorUrl } from "../client/calibrated-actor-source.js";
import { HIT } from "../src/config.js";
import { createBundledHitAuthorityContract } from "../src/hit-authority-contract.js";
import { resolveHitscan, targetHitVolume, type HitTarget } from "../src/hitscan.js";
import { STAGE33_HIT_IDENTITIES } from "../src/stage33-hit-calibration.js";

describe("cosmetic WW1 soldier (render only)", () => {
  it("renders each faction's admitted cosmetic model", () => {
    expect(cosmeticActorUrl(0)).toBe("/assets/ww1/characters/soldier-khaki-cosmetic.glb");
    expect(cosmeticActorUrl(1)).toBe("/assets/ww1/characters/soldier-fieldgrey-cosmetic.glb");
    expect(cosmeticActorUrl(2)).toBeUndefined();
  });

  it("is never a hit identity and leaves hit authority inactive", () => {
    expect(cosmetic.hitAuthority).toBe("static-capsule");
    expect("runtimeAccepted" in cosmetic).toBe(false);
    const hashes = cosmetic.assets.map(asset => asset.glbSha256);
    for (const identity of Object.values(STAGE33_HIT_IDENTITIES)) expect(hashes).not.toContain(identity.glbSha256);
    expect(createBundledHitAuthorityContract()).toBeUndefined();
  });

  it("resolves shots against the HIT capsule whichever soldier renders", () => {
    const target: HitTarget = { id: "victim", x: 0, z: 10, feetY: 0, headY: HIT.standHeight, team: 1 };
    const volume = targetHitVolume(target, HIT.headRadius);
    expect(volume.headCenter).toEqual({ x: 0, y: HIT.standHeight - HIT.headRadius, z: 10 });
    expect(volume.bodyTopY).toBeCloseTo(HIT.standHeight - 2 * HIT.headRadius, 12);
    const config = { radius: HIT.radius, headRadius: HIT.headRadius };
    const origin = { x: 0, y: 1.6, z: 0 };
    const toward = (y: number) => {
      const dx = 0, dy = y - origin.y, dz = 10, length = Math.hypot(dx, dy, dz);
      return { x: dx / length, y: dy / length, z: dz / length };
    };
    // Capsule head top (1.78 m) sits above the WW1 soldier's measured head sphere: still a headshot.
    expect(resolveHitscan(origin, toward(1.78), 30, 0, [target], [], config)).toMatchObject({ part: "head" });
    expect(resolveHitscan(origin, toward(1.0), 30, 0, [target], [], config)).toMatchObject({ part: "body" });
  });
});
