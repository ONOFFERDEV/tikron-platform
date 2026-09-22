import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUnreadyTestRoom as createTestRoom } from "./create-test-room.js";
import { CONTENT_REVISION, STABLE_CONTENT_IDS, readContentRevisionValue } from "../config/ww1-content.js";
import { handleMatchmake } from "../src/index.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { MODE_ORDER } from "../src/modes.js";
import { WEAPONS } from "../src/config.js";

class RevisionArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override warmupMinPlayers = 2;

  seedLegacyLayout(): void {
    const state = this.state as ArenaState;
    const player = Object.values(state.players)[0];
    if (player) {
      player.x = 75;
      player.z = 50;
      player.k = 9;
      player.d = 4;
    }
    state.redScore = 19;
    state.blueScore = 17;
    state.phase = "ended";
  }

  restoreLegacyLayout(): void {
    this.onRestore();
  }

  verticalHistorySize(): number {
    return this.vertLag.size;
  }
}

function messages(connection: { frames(): Record<string, unknown>[] }, type: string): unknown[] {
  return connection.frames()
    .filter((frame) => frame["type"] === type)
    .map((frame) => frame["payload"]);
}

describe("WW1 content revision contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T00:00:00Z"));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("accepts contentReady after the join advertisement has already been delivered", async () => {
    const response = handleMatchmake(new URL("http://test.local/api/matchmake?mode=tdm"));
    const body = await response.json() as Record<string, unknown>;
    expect(body["contentRevision"]).toBe(CONTENT_REVISION);
    expect(readContentRevisionValue(body["contentRevision"])).toBe(CONTENT_REVISION);

    const room = await createTestRoom(RevisionArena, { codec: ArenaSchema, sync: "throttled" });
    const client = await room.connect("alice");
    expect(messages(client, "contentRevision")).toEqual([{ revision: CONTENT_REVISION }]);
    await client.send("contentReady", { revision: CONTENT_REVISION });
    await room.advance(50);
    expect(messages(client, "contentAccepted").at(-1)).toEqual({ revision: CONTENT_REVISION });
  });

  it("blocks every gameplay input until the exact revision is accepted", async () => {
    const room = await createTestRoom(RevisionArena, { codec: ArenaSchema, sync: "throttled" });
    const client = await room.connect("alice");
    const before = room.snapshot().players[client.id];
    expect(before).toBeDefined();

    await client.send("move", { mx: 0, mz: 1, jump: false, crouch: false, sprint: false });
    await room.advance(50);
    expect(room.snapshot().players[client.id]).toMatchObject({ x: before?.x, z: before?.z });
    expect(messages(client, "contentMismatch").at(-1)).toEqual({
      expected: CONTENT_REVISION,
      received: null,
      action: "reload",
    });

    await client.send("contentReady", { revision: CONTENT_REVISION - 1 });
    await client.send("move", { mx: 0, mz: 1, jump: false, crouch: false, sprint: false });
    await client.send("fire", { fireSeq: 1 });
    await room.advance(50);
    expect(room.snapshot().players[client.id]).toMatchObject({ x: before?.x, z: before?.z });
    expect(messages(client, "shot")).toHaveLength(0);
    expect(messages(client, "contentMismatch").at(-1)).toEqual({
      expected: CONTENT_REVISION,
      received: CONTENT_REVISION - 1,
      action: "reload",
    });

    await client.send("contentReady", { revision: CONTENT_REVISION });
    await room.advance(50);
    expect(messages(client, "contentAccepted").at(-1)).toEqual({ revision: CONTENT_REVISION });
    const accepted = room.snapshot().players[client.id];
    await client.send("move", { mx: 0, mz: 1, jump: false, crouch: false, sprint: false });
    await room.advance(50);
    const moved = room.snapshot().players[client.id];
    expect(Math.hypot((moved?.x ?? 0) - (accepted?.x ?? 0), (moved?.z ?? 0) - (accepted?.z ?? 0))).toBeGreaterThan(0);
  });

  it("re-handshakes after disconnect while internal bots remain outside the client gate", async () => {
    class BotRevisionArena extends ArenaRoomImpl {
      protected override fillToPlayers = 4;
    }
    const room = await createTestRoom(BotRevisionArena, { codec: ArenaSchema, sync: "throttled" });
    const client = await room.connect("alice");
    await room.advance(100);
    expect(Object.keys(room.snapshot().players).some((id) => id.startsWith("bot-"))).toBe(true);

    await client.send("contentReady", { revision: CONTENT_REVISION });
    const closing = client.close();
    await Promise.resolve();
    const reconnected = await room.connect("alice");
    await closing;
    expect(messages(reconnected, "contentRevision").at(-1)).toEqual({ revision: CONTENT_REVISION });
    await reconnected.send("contentReady", { revision: CONTENT_REVISION - 1 });
    await reconnected.send("move", { mx: 0, mz: 1, jump: false, crouch: false, sprint: false });
    await room.advance(50);
    expect(messages(reconnected, "contentMismatch").at(-1)).toMatchObject({ action: "reload" });
  });

  it("restores a legacy layout through warmup at a fresh spawn with stale action and held input cleared", async () => {
    const room = await createTestRoom(RevisionArena, { id: "arena-tdm", codec: ArenaSchema, sync: "throttled" });
    const client = await room.connect("alice");
    await client.send("contentReady", { revision: CONTENT_REVISION });
    await client.send("fire", { fireSeq: 1 });
    await room.advance(50);
    await client.send("reload");
    await client.send("move", { mx: 0, mz: 1, jump: false, crouch: false, sprint: false });
    expect((room.room as RevisionArena).verticalHistorySize()).toBeGreaterThan(0);

    (room.room as RevisionArena).seedLegacyLayout();
    const beforeRestore = room.snapshot();
    (room.room as RevisionArena).restoreLegacyLayout();
    const restored = room.snapshot();
    expect((room.room as RevisionArena).verticalHistorySize()).toBe(0);
    const player = restored.players[client.id];
    expect(restored).toMatchObject({ redScore: 0, blueScore: 0, phase: "warmup", warmupEndMs: 0 });
    expect(player).toMatchObject({ k: 0, d: 0, alive: true, hp: 100, reloadEnd: 0 });
    expect({ x: player?.x, z: player?.z }).not.toEqual({ x: 75, z: 50 });

    const spawn = { x: player?.x, z: player?.z };
    await room.advance(100);
    expect(room.snapshot().players[client.id]).toMatchObject(spawn);
    await client.send("syncView");
    expect(messages(client, "contentMismatch").at(-1)).toMatchObject({ received: null, action: "reload" });
    await client.send("contentReady", { revision: CONTENT_REVISION });
    await room.advance(50);
    await client.send("syncView");
    await room.advance(50);
    expect(messages(client, "contentAccepted")).toHaveLength(2);
    expect(messages(client, "ammo").at(-1)).toMatchObject({ mag: WEAPONS[0]?.mag, reserve: WEAPONS[0]?.reserve, weapon: 1 });
    expect(messages(client, "ammo").at(-1)).not.toHaveProperty("reloadMs");
    console.log(JSON.stringify({
      tag: "ww1ContentRevisionProof",
      revision: CONTENT_REVISION,
      before: beforeRestore,
      after: room.snapshot(),
      events: client.frames()
        .filter((frame) => ["contentRevision", "contentAccepted", "contentMismatch", "ammo", "support", "mortar", "drone"].includes(String(frame["type"])))
        .map((frame) => ({ type: frame["type"], payload: frame["payload"] })),
    }));
  });

  it("keeps existing numeric IDs and codec-bearing field order stable", () => {
    expect(STABLE_CONTENT_IDS).toEqual({
      maps: ["arena1", "arena2", "arena3"],
      modes: ["tdm", "ffa", "dom", "practice"],
      weapons: [0, 1, 2, 3, 4],
    });
    expect(MODE_ORDER).toEqual(STABLE_CONTENT_IDS.modes);
    expect(WEAPONS.map((_weapon, index) => index)).toEqual(STABLE_CONTENT_IDS.weapons);
  });
});
