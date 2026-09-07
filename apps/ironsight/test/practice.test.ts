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
  p.z = opts.z ?? 11;
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

    await tick(h, 50); // a modest fast-forward, the showcase roster (fillToPlayers=6) included
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

describe("practice room — showcase bots", () => {
  it("fills the fixed 5-bot showcase roster (idle/crouch/sneak/walk/sprint)", async () => {
    const h = await createTestRoom(ArenaRoomImpl, {
      id: "arena-practice-showcase1",
      codec: ArenaSchema,
      sync: "throttled",
    });
    await h.connect(); // 1 human → reconcileBots fills the roster (fillToPlayers 6)
    await tick(h, 2); // let the deficit-fill run

    const ids = Object.keys(liveState(h).players);
    for (const id of ["bot-idle", "bot-crouch", "bot-sneak", "bot-walk", "bot-sprint"]) {
      expect(ids).toContain(id);
    }
  });

  it("idle/crouch bots stand still; crouch/sneak carry crouch=true on the wire, walk/sprint don't", async () => {
    const h = await createTestRoom(ArenaRoomImpl, {
      id: "arena-practice-showcase2",
      codec: ArenaSchema,
      sync: "throttled",
    });
    await h.connect();
    await tick(h, 5); // let the crouch-down transition (integrate()'s inp.crouch edge) settle

    const before = liveState(h).players;
    const idleBefore = { x: before["bot-idle"]!.x, z: before["bot-idle"]!.z };
    const crouchBefore = { x: before["bot-crouch"]!.x, z: before["bot-crouch"]!.z };

    await tick(h, 100); // long fast-forward
    const after = liveState(h).players;

    expect(after["bot-idle"]!.x).toBe(idleBefore.x);
    expect(after["bot-idle"]!.z).toBe(idleBefore.z);
    expect(after["bot-idle"]!.crouch).toBe(false);

    expect(after["bot-crouch"]!.x).toBe(crouchBefore.x);
    expect(after["bot-crouch"]!.z).toBe(crouchBefore.z);
    expect(after["bot-crouch"]!.crouch).toBe(true);

    expect(after["bot-sneak"]!.crouch).toBe(true);
    expect(after["bot-walk"]!.crouch).toBe(false);
    expect(after["bot-sprint"]!.crouch).toBe(false);
  });

  it("every showcase bot holds its pinned position — no role paces anymore (stand-still change)", async () => {
    // Replaces the old "sprint covers more ground than walk" test: since the
    // 2026-07-23 stand-still change, showcaseThink has no pacing branch — every
    // role is a stationary target dummy, so the regression to catch is ANY
    // accumulated drift, for all five bots, over the same window.
    const h = await createTestRoom(ArenaRoomImpl, {
      id: "arena-practice-showcase4",
      codec: ArenaSchema,
      sync: "throttled",
    });
    await h.connect();
    await tick(h, 2);

    const ids = ["bot-idle", "bot-crouch", "bot-sneak", "bot-walk", "bot-sprint"] as const;
    const before = Object.fromEntries(ids.map((id) => [id, { x: liveState(h).players[id]!.x, z: liveState(h).players[id]!.z }]));
    await tick(h, 300);
    for (const id of ids) {
      const p = liveState(h).players[id]!;
      expect(Math.abs(p.x - before[id]!.x)).toBeLessThan(0.01);
      expect(Math.abs(p.z - before[id]!.z)).toBeLessThan(0.01);
    }
  });

  it("no showcase bot ever fires, across many ticks", async () => {
    const h = await createTestRoom(ArenaRoomImpl, {
      id: "arena-practice-showcase5",
      codec: ArenaSchema,
      sync: "throttled",
    });
    await h.connect();
    await tick(h, 150);

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

describe("practice room — map selection", () => {
  it("an arena3-encoded practice room actually plays on ARENA3 (geometry, not reference equality)", async () => {
    // Same shooter/target coordinates as the plain ARENA1 duel test above, where
    // the shot lands — here it must NOT, because ARENA3's north diagonal wall
    // (x16-32 at z6-8) occludes this z=6 line of sight (see arena-room.test.ts's
    // ffa test for the same landmark). A blocked shot is the behavioral proof
    // that mapForRoom actually resolved ARENA3 from this room id, not ARENA1.
    const h = await createTestRoom(PracticeDuelArena, {
      id: "arena-practice-arena3-occl1",
      codec: ArenaSchema,
      sync: "throttled",
    });
    const shooter = await h.connect();
    const target = await h.connect();
    await tick(h, 2);

    place(h, shooter.id, 10, { yaw: Math.PI / 2, pitch: BODY_PITCH, z: 7 });
    place(h, target.id, 20, { z: 7 });
    await tick(h, 3);

    for (let i = 0; i < 4; i++) {
      await shooter.send("fire");
      await tick(h, 3);
    }
    const s = h.snapshot();
    expect(s.players[target.id]!.alive).toBe(true);
    expect(h.broadcastsOf("s:msg").some((f) => (f.data as { type?: string }).type === "kill")).toBe(false);
  });

  it("an arena2/arena3 practice room gets NO bots of any kind — an empty map, not just no showcase", async () => {
    // Checking only for the showcase ids was how the live bug slipped through:
    // with the roster gated off but the raised practice fill target (6) still in
    // place, reconcileBots quietly backfilled the deficit with REGULAR combat
    // bots ("아레나 2/크로스야드 연습에 봇이 활동 중"). The contract is stronger:
    // a non-arena1 practice room is a solo empty map — the human is the only
    // player, across a long window.
    const h = await createTestRoom(ArenaRoomImpl, {
      id: "arena-practice-arena2-noshow1",
      codec: ArenaSchema,
      sync: "throttled",
    });
    const solo = await h.connect();
    await tick(h, 150); // far past any deficit-fill window

    const ids = Object.keys(liveState(h).players);
    expect(ids).toEqual([solo.id]);
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

  it("encodes a valid map param into the room id, and ignores an invalid one", async () => {
    const arena2 = handleMatchmake(new URL("http://test.local/api/matchmake?mode=practice&map=arena2"));
    const arena3 = handleMatchmake(new URL("http://test.local/api/matchmake?mode=practice&map=arena3"));
    const bogus = handleMatchmake(new URL("http://test.local/api/matchmake?mode=practice&map=nope"));
    const body2 = (await arena2.json()) as { room: string };
    const body3 = (await arena3.json()) as { room: string };
    const bodyBogus = (await bogus.json()) as { room: string };
    expect(body2.room).toMatch(/^arena-practice-arena2-[0-9a-f]{8}$/);
    expect(body3.room).toMatch(/^arena-practice-arena3-[0-9a-f]{8}$/);
    expect(bodyBogus.room).toMatch(/^arena-practice-[0-9a-f]{8}$/); // falls back to arena1's plain format
  });
});
