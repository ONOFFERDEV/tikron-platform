import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle, type TestConnection } from "@tikron/server/testing";
import { RpgEngine, sampleContent, type CombatEvent } from "@tikron/rpg";
import { MmoRoomImpl } from "../src/rooms/mmo-room.js";
import { MmoSchema, MAP, PLAYER_SPAWN, type MmoState } from "../src/rooms/mmo-schema.js";

/**
 * MMORPG room tests — drive the room's @tikron/rpg integration through the in-process
 * harness with fake timers (the IoArenaRoom sim loop advances via `h.advance`). The
 * engine is seeded, so these are deterministic. Assertions target robust invariants
 * (an event appeared, hp dropped, a unit is alive/dead) rather than exact combat math.
 */

type Handle = TestRoomHandle<MmoState>;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function makeRoom(): Promise<Handle> {
  return createTestRoom(MmoRoomImpl, { codec: MmoSchema }) as unknown as Promise<Handle>;
}

/** Every combat event the room has broadcast so far, flattened across batches. */
function combatEvents(h: Handle): CombatEvent[] {
  return h
    .broadcastsOf("s:msg")
    .filter((b) => b.data.type === "combat")
    .flatMap((b) => b.data.payload as CombatEvent[]);
}

/** Send a move intent, then advance until the unit is within `eps` of the target (bounded). */
async function moveTo(
  h: Handle,
  conn: TestConnection,
  id: string,
  target: { x: number; y: number },
  maxMs = 15000,
): Promise<void> {
  await conn.send("move", target);
  for (let elapsed = 0; elapsed < maxMs; elapsed += 500) {
    await h.advance(500);
    const u = h.snapshot().units[id];
    if (u && Math.hypot(u.x - target.x, u.y - target.y) < 2.5) return;
  }
}

describe("MmoRoom — @tikron/rpg integration", () => {
  it("seeds the pack + boss and admits players; clamps click-to-move to the map", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await h.connect("p2");

    let s = h.snapshot();
    expect(s.units["p1"]!.kind).toBe("player");
    expect(s.units["p2"]!.kind).toBe("player");
    expect(s.units["p1"]!.alive).toBe(true);
    // The engine's seeded monsters mirror into synced state.
    expect(s.units["wolf-1"]!.kind).toBe("wolf");
    expect(s.units["boss-1"]!.kind).toBe("boss");

    // An out-of-bounds destination is clamped to [0, MAP]; the player steps toward it.
    await p1.send("move", { x: 9999, y: -500 });
    await h.advance(1000);
    s = h.snapshot();
    const p = s.units["p1"]!;
    expect(p.x).toBeGreaterThan(PLAYER_SPAWN.x); // moved toward clamped (MAP, 0)
    expect(p.x).toBeLessThanOrEqual(MAP);
    expect(p.y).toBeLessThan(PLAYER_SPAWN.y);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });

  it("casts a damage skill at a wolf (damaged event + hp drop) and the wolf retaliates", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");

    // Close to melee range of wolf-1 (at 62,60); approaching also proximity-aggros it.
    await moveTo(h, p1, "p1", { x: 58, y: 60 });

    const wolfMaxHp = h.snapshot().units["wolf-1"]!.maxHp;
    // A hostile auto-attack + a Slash cast; the wolf is adjacent (chasing), so a swing lands.
    await p1.send("attack", { unitId: "wolf-1" });
    await p1.send("cast", { skillId: "warrior-slash", target: { unitId: "wolf-1" } });
    await h.advance(2000);

    const evs = combatEvents(h);
    expect(evs.some((e) => e.t === "damaged" && e.target === "wolf-1")).toBe(true);
    expect(h.snapshot().units["wolf-1"]!.hp).toBeLessThan(wolfMaxHp);

    // The wolf fights back: it either damages the player or acquires it as its AI target.
    expect(
      evs.some(
        (e) =>
          (e.t === "damaged" && e.source === "wolf-1" && e.target === "p1") ||
          (e.t === "aiTargetChanged" && e.unit === "wolf-1"),
      ),
    ).toBe(true);
  });

  it("kills a wolf → death event + XP for the player", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await moveTo(h, p1, "p1", { x: 58, y: 60 });

    await p1.send("attack", { unitId: "wolf-1" });
    let killed = false;
    for (let i = 0; i < 20 && !killed; i++) {
      await p1.send("cast", { skillId: "warrior-slash", target: { unitId: "wolf-1" } });
      await h.advance(3000);
      killed = combatEvents(h).some((e) => e.t === "death" && e.unit === "wolf-1");
    }
    const evs = combatEvents(h);
    expect(evs.some((e) => e.t === "death" && e.unit === "wolf-1")).toBe(true);
    expect(evs.some((e) => e.t === "xpGained" && e.unit === "p1")).toBe(true);
  });

  it("player death → respawn intent revives at the spawn point", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");

    // Walk onto the boss (Dire Alpha) and tank until dead.
    await moveTo(h, p1, "p1", { x: 96, y: 96 });
    let dead = false;
    for (let i = 0; i < 25 && !dead; i++) {
      await h.advance(2000);
      dead = h.snapshot().units["p1"]!.alive === false;
    }
    expect(dead).toBe(true);

    // A respawn intent while dead resurrects at the spawn point with ~50% hp.
    await p1.send("respawn");
    await h.advance(200);
    const p = h.snapshot().units["p1"]!;
    expect(p.alive).toBe(true);
    expect(p.hp).toBeGreaterThan(0);
    expect(Math.hypot(p.x - PLAYER_SPAWN.x, p.y - PLAYER_SPAWN.y)).toBeLessThan(2.5);
  });

  it("ignores invalid payloads (off-hotbar skill, cast-while-dead, malformed move)", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await h.advance(100);

    // Off-hotbar skill (a boss-only ability) is rejected: no wolves get summoned.
    const before = Object.keys(h.snapshot().units).length;
    await p1.send("cast", { skillId: "boss-summon", target: { unitId: "p1" } });
    // Malformed move payloads are ignored (no throw, no movement).
    await p1.send("move", { x: "nope", y: null });
    await p1.send("move", "garbage");
    await p1.send("cast", { skillId: 123 });
    await h.advance(500);

    const s = h.snapshot();
    expect(s.units["p1"]!.alive).toBe(true);
    expect(Object.keys(s.units).length).toBe(before); // no summon, nothing spawned/removed
    expect(Math.hypot(s.units["p1"]!.x - PLAYER_SPAWN.x, s.units["p1"]!.y - PLAYER_SPAWN.y)).toBeLessThan(1);

    // Casting while dead is a no-op — force death via the boss, then try to cast.
    await moveTo(h, p1, "p1", { x: 96, y: 96 });
    for (let i = 0; i < 25 && h.snapshot().units["p1"]!.alive; i++) await h.advance(2000);
    expect(h.snapshot().units["p1"]!.alive).toBe(false);
    await p1.send("cast", { skillId: "warrior-slash", target: { unitId: "boss-1" } });
    await h.advance(200);
    expect(h.snapshot().units["p1"]!.alive).toBe(false); // still dead — cast ignored
  });

  it("persists engine state for eviction survival (snapshot restores the live fight)", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await moveTo(h, p1, "p1", { x: 58, y: 60 });

    // Two Slashes (no auto-attack) leave the wolf damaged but alive across the persist.
    await p1.send("cast", { skillId: "warrior-slash", target: { unitId: "wolf-1" } });
    await h.advance(3200); // Slash cooldown is 3000 ms
    await p1.send("cast", { skillId: "warrior-slash", target: { unitId: "wolf-1" } });
    await h.advance(1000);
    const w = h.snapshot().units["wolf-1"]!;
    expect(w.hp).toBeLessThan(w.maxHp);

    // Let the coalesced durable persist fire (persistIntervalMs = 5 s), then read it.
    await h.advance(6000);
    const persisted = h.storage.kv.get("tk:room") as { state: MmoState } | undefined;
    expect(persisted?.state.engine).toBeTruthy();

    // Rebuild a fresh engine from the persisted snapshot: the fight resumes intact,
    // with the wolf's mid-fight damage preserved (deterministic serialize/restore).
    const engine = RpgEngine.restore(sampleContent, persisted!.state.engine!);
    expect(engine.getUnit("p1")).toBeDefined();
    const wolf = engine.getUnit("wolf-1");
    expect(wolf).toBeDefined();
    expect(wolf!.hp).toBeLessThan(wolf!.maxHp);
  });

  it("keeps state binary-codec-encodable (delta frames decode)", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await p1.send("move", { x: 45, y: 60 });
    await h.advance(500);
    await h.flush();

    const frames = p1.binaryFrames();
    expect(frames.length).toBeGreaterThanOrEqual(1);
    const seen = p1.lastState() as MmoState;
    expect(seen.units["p1"]).toBeDefined();
    expect(seen.units["wolf-1"]!.kind).toBe("wolf");
  });
});
