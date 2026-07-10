// [blueprint] — practice-mode room/matchmaking mechanics (no warmup gate, teamless
// hitscan, passive filler bots, matchmake room-id format); no weapon-name or exact
// balance dependency, only assumes the DEFAULT weapon can kill within a handful
// of shots (true of any reasonably-tuned roster).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle } from "@tikron/server/testing";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { PLAYER, TICK_MS } from "../src/config.js";
import { handleMatchmake } from "../src/index.js";

/**
 * Integration coverage for practice mode: modeFromRoomId's prefix routing and
 * mapForMode are already unit-tested in modes.test.ts — these tests drive the
 * actual room + matchmaking behavior end to end (no warmup gate, no time-limit
 * fallback, a real hitscan kill lands in a teamless room, and matchmaking hands
 * out a unique private room per request).
 */

const BODY_PITCH = Math.atan2(1.0 - PLAYER.standEye, 10);

function liveState(h: TestRoomHandle<ArenaState>): ArenaState {
  return (h.room as unknown as { state: ArenaState }).state;
}

async function tick(h: TestRoomHandle<ArenaState>, n = 1): Promise<void> {
  for (let i = 0; i < n; i++) await h.advance(TICK_MS);
}

function place(
  h: TestRoomHandle<ArenaState>,
  id: string,
  x: number,
  opts: { yaw?: number; pitch?: number; z?: number } = {},
): void {
  const p = liveState(h).players[id]!;
  p.x = x;
  p.y = 0;
  p.z = opts.z ?? 6;
  p.hp = PLAYER.maxHp;
  p.alive = true;
  p.prot = false;
  if (opts.yaw !== undefined) p.yaw = opts.yaw;
  if (opts.pitch !== undefined) p.pitch = opts.pitch;
}

/** No filler bots and no spawn protection, so a scripted 1v1 duel isn't disturbed. */
class PracticeDuelArena extends ArenaRoomImpl {
  protected override spawnProtectMs = 0;
  protected override fillToPlayers = 0;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("practice room — match flow", () => {
  it("starts live immediately (no warmup) and never ends the match", async () => {
    const h = await createTestRoom(ArenaRoomImpl, {
      id: "arena-practice-flow1",
      codec: ArenaSchema,
      sync: "throttled",
    });
    await h.connect();
    expect(h.snapshot().phase).toBe("live"); // no warmup gate, unlike tdm/ffa/dom

    await tick(h, 50); // a modest fast-forward, filler bots (fillToPlayers=4) included
    const s = h.snapshot();
    expect(s.phase).toBe("live");
    expect(h.broadcastsOf("s:msg").some((f) => (f.data as { type?: string }).type === "matchEnd")).toBe(false);
  });
});

describe("practice room — combat", () => {
  it("a hitscan kill registers (teamless — same threading FFA already uses)", async () => {
    const h = await createTestRoom(PracticeDuelArena, {
      id: "arena-practice-duel1",
      codec: ArenaSchema,
      sync: "throttled",
    });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH });
    place(h, target.id, 20);
    await tick(h, 3);

    for (let i = 0; i < 4; i++) {
      await shooter.send("fire");
      await tick(h, 3);
    }
    const s = h.snapshot();
    expect(s.players[target.id]!.alive).toBe(false);
    expect(h.broadcastsOf("s:msg").some((f) => (f.data as { type?: string }).type === "kill")).toBe(true);
  });
});

describe("practice room — passive bots", () => {
  it("filler bots stand still (no movement) and never fire across many ticks", async () => {
    const h = await createTestRoom(ArenaRoomImpl, {
      id: "arena-practice-passive1",
      codec: ArenaSchema,
      sync: "throttled",
    });
    await h.connect(); // 1 human → reconcileBots fills 3 bots (fillToPlayers default 4)
    await tick(h, 2); // let the deficit-fill run

    const before = liveState(h).players;
    const botIds = Object.keys(before).filter((id) => id.startsWith("bot-"));
    expect(botIds.length).toBeGreaterThan(0);
    const beforePositions = botIds.map((id) => ({ id, x: before[id]!.x, z: before[id]!.z }));

    await tick(h, 100); // long fast-forward
    const after = liveState(h).players;
    for (const { id, x, z } of beforePositions) {
      expect(after[id]!.x).toBe(x);
      expect(after[id]!.z).toBe(z);
    }

    const botFired = h
      .broadcastsOf("s:msg")
      .some(
        (f) =>
          (f.data as { type?: string }).type === "shot" &&
          (f.data as { from?: string }).from?.startsWith("bot-"),
      );
    expect(botFired).toBe(false);
  });
});

describe("handleMatchmake — practice", () => {
  it("issues a unique private arena-practice-<random> room id per request", async () => {
    const res1 = handleMatchmake(new URL("http://test.local/api/matchmake?mode=practice"));
    const res2 = handleMatchmake(new URL("http://test.local/api/matchmake?mode=practice"));
    const body1 = (await res1.json()) as { room: string };
    const body2 = (await res2.json()) as { room: string };
    expect(body1.room).toMatch(/^arena-practice-[0-9a-f]{8}$/);
    expect(body2.room).toMatch(/^arena-practice-[0-9a-f]{8}$/);
    expect(body1.room).not.toBe(body2.room);
  });
});
