import { createTestRoom } from "@tikron/server/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYER, TICK_MS } from "../src/config.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";

class ClaimPartArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override spawnProtectMs = 0;
}

describe("ArenaRoom hybrid claim part authority", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("rejects a forged upper-chest head part and applies analytic body damage", async () => {
    const harness = await createTestRoom(ClaimPartArena, {
      id: "claim-part-tdm", codec: ArenaSchema, sync: "throttled",
    });
    const shooter = await harness.connect();
    const target = await harness.connect();
    const state = (harness.room as unknown as { state: ArenaState }).state;
    const upperChestPitch = Math.atan2(1.3 - PLAYER.standEye, 10);
    Object.assign(state.players[shooter.id]!, {
      x: 10, y: 0, z: 11, yaw: Math.PI / 2, pitch: upperChestPitch,
      hp: PLAYER.maxHp, alive: true, prot: false,
    });
    Object.assign(state.players[target.id]!, {
      x: 20, y: 0, z: 11, hp: PLAYER.maxHp, alive: true, prot: false,
    });
    await harness.advance(TICK_MS * 3);

    const warnings: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(value => {
      if (typeof value === "string" && value.includes('"tag":"hybridHit"')) warnings.push(value);
    });
    try {
      await shooter.send("fire", { claim: { id: target.id, part: "head" } });
      await harness.advance(TICK_MS);
    } finally {
      warn.mockRestore();
    }

    expect(warnings.map(value => JSON.parse(value))).toContainEqual(expect.objectContaining({
      tag: "hybridHit", victim: target.id, part: "head", result: "rejected", reason: "part",
    }));
    expect(harness.snapshot().players[target.id]!.hp).toBe(PLAYER.maxHp - 28);
    const shot = shooter.frames().filter(value => value.t === "s:msg" && value.type === "shot").at(-1);
    expect(shot?.payload).toMatchObject({ hit: true, hits: [{ id: target.id, head: false }] });
  });
});
