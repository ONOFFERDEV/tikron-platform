import { createTestRoom } from "@tikron/server/testing";
import { describe, expect, it } from "vitest";
import { ARENA1 } from "../src/map/arena1.js";
import type { MapDef } from "../src/map/types.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema } from "../src/schema.js";
import { validateHitClaim } from "../src/hit-claim.js";
import { resolveHitscan } from "../src/hitscan.js";
import { stepGrenade } from "../src/grenade.js";
import { sweepSphereRamp } from "../src/ray-occlusion.js";

const ramp = { minX: -1, maxX: 1, minZ: 2, maxZ: 8, baseY: 0, topY: 2,
  axis: "z", dir: 1 } as const;
const bounds = { width: 20, depth: 20, floor: -10, ceiling: 10 } as const;

describe("exact slope consumers", () => {
  it.each([["inside", 0.98, true], ["outside", 1.02, false]] as const)
  ("keeps the 20 mm %s pair identical for analytic and typed-claim rays", (_name, x, blocked) => {
    const origin = { x, y: 0.7, z: 0 }, direction = { x: 0, y: 0, z: 1 };
    const target = { id: "victim", x, z: 10, feetY: 0, headY: 1.8, team: 1 };
    const analytic = resolveHitscan(origin, direction, 20, 0, [target], [],
      { radius: 0.4, headRadius: 0.22 }, false, [ramp]);
    const claim = validateHitClaim({ claim: { id: target.id, part: "body" }, shooterTeam: 0,
      targets: [target], origin, aimDir: direction, range: 20, accuracySpread: 0,
      boxes: [], ramps: [ramp], hitRadius: 0.4, headRadius: 0.22, coneMarginM: 0.3 });
    expect(analytic === null).toBe(blocked);
    expect(claim).toMatchObject(blocked ? { accepted: false, reason: "occluded" }
      : { accepted: true, part: "body" });
  });

  it("sweeps a grenade sphere against the same wedge and preserves the outside control", () => {
    const inside = { pos: { x: 0, y: 0.7, z: 0 }, vel: { x: 0, y: 0, z: 20 } };
    const edgeInside = { pos: { x: 1.08, y: 0.7, z: 0 }, vel: { x: 0, y: 0, z: 20 } };
    const outside = { pos: { x: 1.12, y: 0.7, z: 0 }, vel: { x: 0, y: 0, z: 20 } };
    expect(stepGrenade(inside, .2, 0, .5, .1, [], bounds, [ramp])).toBe(true);
    expect(inside.pos.z).toBeLessThan(4);
    expect(inside.vel.y).toBeGreaterThan(0); expect(inside.vel.z).toBeLessThan(20);
    expect(stepGrenade(edgeInside, .2, 0, .5, .1, [], bounds, [ramp])).toBe(true);
    expect(stepGrenade(outside, .2, 0, .5, .1, [], bounds, [ramp])).toBe(false);
    expect(outside.pos.z).toBe(4);
  });

  it("uses the rounded sphere boundary at a wedge corner", () => {
    const hit = sweepSphereRamp({ x: -1.2, y: .01, z: 1.8 }, { x: .2, y: 0, z: .2 }, .1, ramp);
    expect(hit?.time).toBeCloseTo(1 - Math.sqrt(.0099 / .08), 6);
    expect(hit!.time).toBeGreaterThan(.5);
  });

  it("solves face and edge contacts on their actual geometric features", () => {
    const face = sweepSphereRamp({ x: -1.2, y: .5, z: 4 }, { x: .3, y: 0, z: 0 }, .1, ramp);
    expect(face?.time).toBeCloseTo(1 / 3, 6);
    expect(face?.normal).toEqual({ x: -1, y: 0, z: 0 });
    const edge = sweepSphereRamp({ x: 0, y: .05, z: 1.8 }, { x: 0, y: 0, z: .2 }, .1, ramp);
    expect(edge?.time).toBeCloseTo(1 - Math.sqrt(.0075) / .2, 6);
    expect(edge!.normal.y).toBeCloseTo(.5, 6);
    const reversed = { minX: 2, maxX: 8, minZ: -1, maxZ: 1, baseY: 0, topY: 2,
      axis: "x", dir: -1 } as const;
    expect(sweepSphereRamp({ x: 4, y: .5, z: -1.2 }, { x: 0, y: 0, z: .3 }, .1, reversed)?.time)
      .toBeCloseTo(1 / 3, 6);
  });

  it("reports immediate inward contact and an embedded center", () => {
    const touching = sweepSphereRamp({ x: -1.1, y: .5, z: 4 }, { x: .2, y: 0, z: 0 }, .1, ramp);
    expect(touching).toMatchObject({ time: 0, normal: { x: -1, y: 0, z: 0 } });
    const inside = sweepSphereRamp({ x: 0, y: .3, z: 4 }, { x: 0, y: .2, z: 0 }, .1, ramp);
    expect(inside?.time).toBe(0);
    expect(sweepSphereRamp({ x: -1.1, y: .5, z: 4 }, { x: -.2, y: 0, z: 0 }, .1, ramp)).toBeNull();
  });

  it("passes exact ramps through the real room grenade tick", async () => {
    class SlopeRoom extends ArenaRoomImpl {
      protected override fillToPlayers = 0;
      protected override startInWarmup = false;
    }
    const harness = await createTestRoom(SlopeRoom, { id: "arena-tdm", codec: ArenaSchema, sync: "throttled" });
    const room = harness.room as unknown as { map: MapDef;
      grenades: { id: string; owner: string; team: number; body: { pos: { x: number; y: number; z: number };
        vel: { x: number; y: number; z: number } }; boomTick: number }[];
      currentTick: number; stepGrenades(dt: number, now: number): void };
    const roomRamp = { ...ramp, minX: 5, maxX: 7 };
    room.map = { ...ARENA1, ramps: [roomRamp] };
    const body = { pos: { x: 6, y: 0.7, z: 0 }, vel: { x: 0, y: 0, z: 20 } };
    room.grenades = [{ id: "nade:room", owner: "owner", team: 0, body, boomTick: room.currentTick + 100 }];
    room.stepGrenades(.2, 1_000);
    expect(body.pos.z).toBeLessThan(4); expect(body.vel.y).toBeGreaterThan(0);
  });
});
