import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRoom, type TestRoomHandle } from "@tikron/server/testing";
import type { RoomInit } from "@tikron/server";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { TICK_MS } from "../src/config.js";

class LifecycleArena extends ArenaRoomImpl {
  protected override warmupMs = 200;
  protected override killTarget = 1;
  protected override reconnectWindowSec = 1;
  ticks = 0;
  protected override onTick(dt: number) { this.ticks++; super.onTick(dt); }
  async finishAndPersist() {
    this.state.redScore = 1;
    await vi.advanceTimersByTimeAsync(TICK_MS);
    await this.forcePersist();
  }
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

async function expectPlayable(h: TestRoomHandle<ArenaState>) {
  await h.advance(TICK_MS);
  expect(Object.keys(h.snapshot().players)).toHaveLength(4);
  await h.advance(300);
  expect(h.snapshot().phase).toBe("live");
  const before = structuredClone(h.snapshot().players);
  await h.advance(1000);
  expect(Object.entries(h.snapshot().players).some(([id, p]) =>
    id.startsWith("bot-") && (p.x !== before[id]?.x || p.z !== before[id]?.z))).toBe(true);
}

describe("arena lifetime across persisted rounds and empty seats", () => {
  it.each(["reconnect", "expired", "join-during-disposal"])("cold-restores an ended snapshot: %s", async (scenario) => {
    const expire = scenario !== "reconnect";
    const first = await createTestRoom(LifecycleArena, { id: "arena-tdm", codec: ArenaSchema });
    await first.connect("old-seat");
    await expectPlayable(first);
    await (first.room as LifecycleArena).finishAndPersist();
    expect(first.snapshot().phase).toBe("ended");
    const saved = structuredClone([...first.storage.kv]);
    expect(saved.length).toBeGreaterThan(0);
    // Eviction loses every interval/instance field, while durable bytes survive.
    vi.clearAllTimers();
    class RestoredArena extends LifecycleArena {
      constructor(private readonly init: RoomInit) { super(init); }
      override async onCreate() {
        for (const [key, value] of saved) await this.init.ctx.storage!.put(key, value);
        await super.onCreate();
      }
    }
    const restored = await createTestRoom(RestoredArena, { id: "arena-tdm", codec: ArenaSchema });
    expect(restored.snapshot().phase).toBe("warmup");
    expect(restored.snapshot().redScore).toBe(0);
    expect(Object.keys(restored.snapshot().players)).toEqual(["old-seat"]);
    if (expire) {
      // A persisted alarm may be the first event on a cold DO, before any join.
      vi.setSystemTime(Date.now() + 60_000);
      if (scenario === "join-during-disposal") {
        // The core stops ticking BEFORE awaiting durable deletion and calling
        // onDispose. A join in that gap must not leave an occupied room asleep.
        const remove = restored.storage.delete.bind(restored.storage);
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        let notifyDeleting!: () => void;
        const deleting = new Promise<void>(resolve => { notifyDeleting = resolve; });
        restored.storage.delete = async key => {
          const result = await remove(key);
          notifyDeleting();
          await gate;
          return result;
        };
        const alarm = restored.room._alarm();
        await deleting;
        await restored.connect("new-seat");
        release();
        await alarm;
        restored.storage.delete = remove;
      } else {
        await restored.room._alarm();
      }
      expect(restored.snapshot().players["old-seat"]).toBeUndefined();
    }
    await restored.connect(expire ? "new-seat" : "old-seat");
    await expectPlayable(restored);
    // The resumed preset must still drain queued input and send authoritative ammo.
    const player = await restored.connect(expire ? "new-seat" : "old-seat");
    await player.send("syncView");
    await restored.advance(TICK_MS);
    expect(player.frames().some(f => f.t === "s:msg" && f.type === "ammo")).toBe(true);
    const room = restored.room as LifecycleArena;
    const ticks = room.ticks;
    await restored.advance(10 * TICK_MS);
    expect(room.ticks - ticks).toBe(10);
  });

  it("reuses an empty warm instance twice without duplicate ticks or stale bots", async () => {
    const h = await createTestRoom(LifecycleArena, { id: "arena-tdm", codec: ArenaSchema });
    for (let cycle = 0; cycle < 3; cycle++) {
      const player = await h.connect(`seat-${cycle}`);
      await expectPlayable(h);
      const room = h.room as LifecycleArena;
      const before = room.ticks;
      await h.advance(10 * TICK_MS);
      expect(room.ticks - before).toBe(10);
      const closing = player.close();
      await h.advance(1100);
      await closing;
      const stopped = room.ticks;
      await h.advance(200);
      expect(room.ticks).toBe(stopped);
    }
  });
});
