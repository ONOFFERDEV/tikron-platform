import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRoom, type TestConnection } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema } from "../src/schema.js";
import { TICK_MS } from "../src/config.js";

class ReconnectArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override reconnectWindowSec = 0.2;
  protected override respawnMs = 300;
  protected override intermissionMs = 5000;
  get fixtureState() { return this.state; }
}

function messages(connection: TestConnection, type: string): unknown[] {
  return connection.frames().filter(frame => frame["type"] === type).map(frame => frame["payload"]);
}

async function endedRoom() {
  const harness = await createTestRoom(ReconnectArena, { codec: ArenaSchema });
  const alice = await harness.connect("alice");
  const bob = await harness.connect("bob");
  const charlie = await harness.connect("charlie");
  if (!(harness.room instanceof ReconnectArena)) throw new TypeError("expected ReconnectArena");
  harness.room.fixtureState.redScore = 50;
  await harness.advance(TICK_MS);
  expect(harness.snapshot().phase).toBe("ended");
  return { harness, alice, bob, charlie };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("authoritative reconnect at death and round boundaries", () => {
  it("preserves death on reconnect and respawns once at the original server deadline", async () => {
    const harness = await createTestRoom(ReconnectArena, { codec: ArenaSchema });
    const attacker = await harness.connect("attacker");
    const victim = await harness.connect("victim");
    if (!(harness.room instanceof ReconnectArena)) throw new TypeError("expected ReconnectArena");
    const attackerState = harness.room.fixtureState.players[attacker.id];
    const victimState = harness.room.fixtureState.players[victim.id];
    if (!attackerState || !victimState) throw new TypeError("expected seated players");
    Object.assign(attackerState, { x: 5, y: 0, z: 11, prot: false });
    Object.assign(victimState, { x: 20, y: 0, z: 11, prot: false, hp: 1,
      team: attackerState.team === 0 ? 1 : 0 });
    await harness.advance(TICK_MS);
    await attacker.send("fire", { fireSeq: 1, yaw: Math.PI / 2, pitch: Math.atan2(1 - 1.65, 15) });
    await harness.advance(TICK_MS);
    expect(harness.snapshot().players[victim.id]?.alive).toBe(false);

    const closing = victim.close();
    await Promise.resolve();
    const returned = await harness.connect("victim");
    await closing;

    expect(harness.snapshot().players[returned.id]?.alive).toBe(false);
    await harness.advance(300 + TICK_MS);
    expect(harness.snapshot().players[returned.id]?.alive).toBe(true);
    expect(messages(returned, "respawn").filter(event =>
      typeof event === "object" && event !== null && "id" in event && event.id === returned.id)).toHaveLength(1);
    expect(messages(returned, "shotScope").at(-1)).toEqual({ life: 2 });
  });

  it("restores the same result and vote when reconnecting during intermission", async () => {
    const { harness, alice, bob } = await endedRoom();
    const result = messages(alice, "matchEnd").at(-1);
    await alice.send("voteRestart");
    await alice.send("voteRestart");
    await harness.advance(TICK_MS);

    const closing = alice.close();
    await Promise.resolve();
    const returned = await harness.connect("alice");
    await closing;
    await returned.send("syncView");
    await harness.advance(TICK_MS);

    expect(messages(returned, "matchEnd")).toEqual([result]);
    expect(messages(returned, "vote").at(-1)).toEqual({ count: 1, need: 2 });
    await bob.send("voteRestart");
    await harness.advance(TICK_MS);
    expect(harness.snapshot().phase).toBe("warmup");
  });

  it("removes an expired player's vote before the remaining seats restart", async () => {
    const { harness, alice, bob, charlie } = await endedRoom();
    await alice.send("voteRestart");
    await harness.advance(TICK_MS);

    const closing = alice.close();
    await harness.advance(250);
    await closing;
    await bob.send("syncView");
    await bob.send("voteRestart");
    await harness.advance(TICK_MS);

    expect(harness.snapshot().players[alice.id]).toBeUndefined();
    expect(messages(bob, "vote").at(-1)).toEqual({ count: 1, need: 2 });
    expect(harness.snapshot().phase).toBe("ended");
    await charlie.send("voteRestart");
    await harness.advance(TICK_MS);
    expect(harness.snapshot().phase).toBe("warmup");
  });
});
