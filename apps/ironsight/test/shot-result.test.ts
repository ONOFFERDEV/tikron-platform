import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRoom, type TestConnection } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { MATCH, TICK_MS, WEAPONS } from "../src/config.js";

class ShotResultArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}

function payloads(connection: TestConnection, type: string): Record<string, unknown>[] {
  return connection.frames()
    .filter(frame => frame.t === "s:msg" && frame.type === type)
    .map(frame => frame.payload as Record<string, unknown>);
}

describe("authoritative shot results", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("applies a duplicate in-life shot id exactly once beyond the cadence window", async () => {
    const harness = await createTestRoom(ShotResultArena, { codec: ArenaSchema, sync: "throttled" });
    const attacker = await harness.connect();
    const victim = await harness.connect();
    const state = (harness.room as unknown as { state: ArenaState }).state;
    const spec = WEAPONS[0]!;
    Object.assign(state.players[attacker.id]!, { x: 5, y: 0, z: 11, prot: false });
    Object.assign(state.players[victim.id]!, { x: 20, y: 0, z: 11, prot: false,
      team: state.players[attacker.id]!.team === 0 ? 1 : 0 });
    await harness.advance(TICK_MS);
    const fire = { fireSeq: 1, shotId: "forged:99:99", receivedAt: 9e15,
      yaw: Math.PI / 2, pitch: Math.atan2(1 - 1.65, 15) };

    await attacker.send("fire", fire);
    await harness.advance(spec.fireIntervalMs);
    await attacker.send("fire", fire);
    await harness.advance(TICK_MS);

    console.log(JSON.stringify({ shots: payloads(attacker, "shot"), hits: payloads(attacker, "hit"),
      results: payloads(attacker, "shotResult"), hp: state.players[victim.id]!.hp }));
    expect(state.players[victim.id]!.hp).toBe(100 - spec.damageBody);
    expect(payloads(attacker, "shot")).toHaveLength(1);
    expect(payloads(attacker, "ammo").at(-1)).toMatchObject({ mag: spec.mag - 1 });
    expect(payloads(attacker, "recoilSync").at(-1)).toMatchObject({ count: 1 });
    expect(payloads(attacker, "shotResult").map(result => result.kind)).toEqual(["accepted", "blocked"]);
    expect(payloads(attacker, "shotResult").at(-1)).toMatchObject({ reason: "duplicate" });
    const shotId = payloads(attacker, "shotResult")[0]?.shotId;
    expect(shotId).toBe(`${attacker.id}:1:1`);
    expect(payloads(attacker, "hit").at(-1)).toMatchObject({ shotId, damage: spec.damageBody, part: "body" });
  });

  it("uses only server hit and kill events to confirm damage and elimination", async () => {
    const harness = await createTestRoom(ShotResultArena, { codec: ArenaSchema, sync: "throttled" });
    const attacker = await harness.connect();
    const victim = await harness.connect();
    const state = (harness.room as unknown as { state: ArenaState }).state;
    const spec = WEAPONS[0]!;
    Object.assign(state.players[attacker.id]!, { x: 5, y: 0, z: 11, prot: false });
    Object.assign(state.players[victim.id]!, { x: 20, y: 0, z: 11, prot: false,
      team: state.players[attacker.id]!.team === 0 ? 1 : 0 });
    await harness.advance(TICK_MS);

    for (let fireSeq = 1; fireSeq <= 4; fireSeq += 1) {
      await attacker.send("fire", { fireSeq, yaw: Math.PI / 2, pitch: Math.atan2(1 - 1.65, 15) });
      await harness.advance(spec.fireIntervalMs);
    }

    expect(payloads(attacker, "shotResult")).toHaveLength(4);
    expect(payloads(attacker, "hit")).toHaveLength(4);
    expect(payloads(attacker, "kill").at(-1)).toMatchObject({
      shotId: `${attacker.id}:1:4`,
      killer: attacker.id,
      victim: victim.id,
    });
    expect(state.players[victim.id]!.alive).toBe(false);
    await harness.advance(MATCH.respawnMs + TICK_MS);
    expect(state.players[victim.id]!.alive).toBe(true);
    expect(payloads(victim, "shotScope").at(-1)).toEqual({ life: 2 });
    await victim.send("fire", { fireSeq: 1, yaw: 0, pitch: 0 });
    await harness.advance(TICK_MS);
    expect(payloads(victim, "shotResult").at(-1)).toMatchObject({ shotId: `${victim.id}:2:1` });
  });
});
