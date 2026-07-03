import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle, type TestConnection } from "@tikron/server/testing";
import { RpgEngine, type CombatEvent } from "@tikron/rpg";
import { EMBERFALL_CONTENT } from "../src/content/emberfall-content.js";
import { FieldRoomImpl } from "../src/rooms/field-room.js";
import { EmberSchema, type EmberState } from "../src/rooms/ember-schema.js";
import { ASHEN_FIELDS } from "../src/zones/ashen-fields.js";

/**
 * FieldRoomImpl room tests — drive the M1 Ashen Fields room through the in-process
 * harness with fake timers. The engine is seeded, so these are deterministic. Assertions
 * target robust invariants (an event appeared, hp dropped, a unit is alive/dead) rather
 * than exact combat math, and geometry from `zones/ashen-fields.ts` directly (never
 * hardcoded) so the test stays honest if the zone layout changes.
 */

type Handle = TestRoomHandle<EmberState>;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function makeRoom(): Promise<Handle> {
  return createTestRoom(FieldRoomImpl, { codec: EmberSchema }) as unknown as Promise<Handle>;
}

/** Every "combat" message any of `conns` (or the room's own global broadcasts) delivered. */
function combatEvents(h: Handle, conns: readonly TestConnection[]): CombatEvent[] {
  const out: CombatEvent[] = [];
  for (const b of h.broadcastsOf("s:msg")) {
    if (b.data.type === "combat") out.push(...(b.data.payload as CombatEvent[]));
  }
  for (const c of conns) {
    for (const f of c.frames()) {
      if (f.type === "combat") out.push(...(f.payload as CombatEvent[]));
    }
  }
  return out;
}

/** Send a move intent, then advance until the unit is within `eps` of the target (bounded). */
async function moveTo(
  h: Handle,
  conn: TestConnection,
  id: string,
  target: { x: number; y: number },
  maxMs = 30000,
): Promise<void> {
  await conn.send("move", target);
  for (let elapsed = 0; elapsed < maxMs; elapsed += 500) {
    await h.advance(500);
    const u = h.snapshot().units[id];
    if (u && Math.hypot(u.x - target.x, u.y - target.y) < 3) return;
  }
}

const WOLF_CAMP = ASHEN_FIELDS.mobCamps.find((c) => c.id === "wolf-pack-west")!;
const WOLF_SLOT = `${WOLF_CAMP.id}#0`;
const BOSS_SLOT = `boss:${ASHEN_FIELDS.fieldBoss!.npcDefId}`;
const SHAMAN_CAMP = ASHEN_FIELDS.mobCamps.find((c) => c.id === "goblin-shaman-camp")!;
const SHAMAN_SLOT = `${SHAMAN_CAMP.id}#0`;

describe("FieldRoomImpl — join, zone geometry, movement", () => {
  it("spawns a level-1 warrior at the zone's player spawn and seeds every mob camp + the field boss", async () => {
    const h = await makeRoom();
    await h.connect("p1");
    const s = h.snapshot();

    const p1 = s.units["p1"]!;
    expect(p1.kind).toBe("player");
    expect(p1.class).toBe("warrior");
    expect(p1.alive).toBe(true);
    expect(p1.level).toBe(1);
    expect(Math.hypot(p1.x - ASHEN_FIELDS.playerSpawn.x, p1.y - ASHEN_FIELDS.playerSpawn.y)).toBeLessThan(1);

    const expectedMobs = ASHEN_FIELDS.mobCamps.reduce((n, c) => n + c.count, 0) + 1; // +1 field boss
    const npcCount = Object.values(s.units).filter((u) => u.kind !== "player").length;
    expect(npcCount).toBe(expectedMobs);

    expect(s.units[WOLF_SLOT]!.kind).toBe("wolf");
    expect(s.units[BOSS_SLOT]!.kind).toBe("boss_chief");
    expect(s.units[BOSS_SLOT]!.level).toBe(8);
  });

  it("clamps click-to-move to the zone's bounds and steps the player toward it", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");

    await p1.send("move", { x: 99999, y: -99999 });
    await h.advance(1000);
    const p = h.snapshot().units["p1"]!;
    expect(p.x).toBeGreaterThan(ASHEN_FIELDS.playerSpawn.x); // moved toward clamped (width, 0)
    expect(p.x).toBeLessThanOrEqual(ASHEN_FIELDS.width);
    expect(p.y).toBeLessThan(ASHEN_FIELDS.playerSpawn.y);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });

  it("selectClass respawns the player as the chosen class with that class's weapon-derived stats", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    const warriorMaxMp = h.snapshot().units["p1"]!.maxMp;

    await p1.send("selectClass", { class: "mage" });
    await h.advance(100);
    const s = h.snapshot().units["p1"]!;
    expect(s.class).toBe("mage");
    expect(s.alive).toBe(true);
    // Mage's int/spi spread outweighs warrior's — maxMp must increase on the respec.
    expect(s.maxMp).toBeGreaterThan(warriorMaxMp);
  });

  it("ignores invalid intents: malformed move, non-string cast/attack ids, unknown selectClass", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await h.advance(100);

    const before = h.snapshot();
    await p1.send("move", { x: "nope", y: null });
    await p1.send("move", "garbage");
    await p1.send("cast", { skillId: 123 });
    await p1.send("attack", { unitId: 42 });
    await p1.send("selectClass", { class: "necromancer" });
    await h.advance(500);

    const after = h.snapshot();
    expect(after.units["p1"]!.alive).toBe(true);
    expect(after.units["p1"]!.class).toBe("warrior"); // unknown class rejected, no respec
    expect(Object.keys(after.units).length).toBe(Object.keys(before.units).length);
    expect(Math.hypot(after.units["p1"]!.x - before.units["p1"]!.x, after.units["p1"]!.y - before.units["p1"]!.y)).toBeLessThan(1);
  });
});

describe("FieldRoomImpl — hotbar gating (cast intent validation)", () => {
  it("rejects a skill belonging to a different class", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1"); // warrior
    await p1.send("cast", { skillId: "mage-fireball", target: { unitId: WOLF_SLOT } });
    await h.advance(500);
    expect(combatEvents(h, [p1]).some((e) => e.t === "skillStarted")).toBe(false);
  });

  it("rejects a same-class skill not yet unlocked at the caster's level", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1"); // level 1 warrior
    await p1.send("cast", { skillId: "warrior-shield-wall" }); // unlocks at level 14
    await h.advance(500);
    expect(combatEvents(h, [p1]).some((e) => e.t === "skillStarted")).toBe(false);
    expect(h.snapshot().units["p1"]!.alive).toBe(true);
  });
});

describe("FieldRoomImpl — combat against Ashen Fields monsters", () => {
  it("casts warrior-strike on a wolf: damaged event + hp drop, and the wolf retaliates", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    const wolfStart = h.snapshot().units[WOLF_SLOT]!;

    await moveTo(h, p1, "p1", { x: wolfStart.x, y: wolfStart.y });
    const wolfMaxHp = h.snapshot().units[WOLF_SLOT]?.maxHp ?? wolfStart.maxHp;

    await p1.send("attack", { unitId: WOLF_SLOT });
    for (let i = 0; i < 10; i++) {
      await p1.send("cast", { skillId: "warrior-strike", target: { unitId: WOLF_SLOT } });
      await h.advance(2600); // strike cooldown 2500ms
      const s = h.snapshot();
      if ((s.units[WOLF_SLOT]?.hp ?? wolfMaxHp) < wolfMaxHp) break;
    }

    const evs = combatEvents(h, [p1]);
    expect(evs.some((e) => e.t === "damaged" && e.target === WOLF_SLOT)).toBe(true);
    // The wolf (or its aggro-linked packmates) fights back.
    expect(
      evs.some(
        (e) =>
          (e.t === "damaged" && e.target === "p1") ||
          (e.t === "aiTargetChanged" && (e as Extract<CombatEvent, { t: "aiTargetChanged" }>).target === "p1"),
      ),
    ).toBe(true);
  });

  it("kills a wolf: a globally-broadcast death event + xpGained, then the camp slot respawns", async () => {
    const h = await makeRoom();
    // The pack's aggro-link (helpRadius) is a real threat: all 3 wolves gang up on the
    // first player to approach and can kill a solo level-1 warrior in ~4s of melee
    // contact. Two players cooperating (the intended "같이 사냥" loop, PLAN §0) split the
    // incoming damage and double the output, killing the wolf in ~2 strike rounds.
    const p1 = await h.connect("p1");
    const p2 = await h.connect("p2");
    const wolfStart = h.snapshot().units[WOLF_SLOT]!;
    await moveTo(h, p1, "p1", { x: wolfStart.x, y: wolfStart.y });
    await moveTo(h, p2, "p2", { x: wolfStart.x + 1, y: wolfStart.y });

    await p1.send("attack", { unitId: WOLF_SLOT });
    await p2.send("attack", { unitId: WOLF_SLOT });
    let deadSlot: string | undefined;
    for (let i = 0; i < 10 && !deadSlot; i++) {
      await p1.send("cast", { skillId: "warrior-strike", target: { unitId: WOLF_SLOT } });
      await p2.send("cast", { skillId: "warrior-strike", target: { unitId: WOLF_SLOT } });
      await h.advance(2600);
      const ev = combatEvents(h, [p1, p2]).find((e) => e.t === "death" && e.unit.startsWith(WOLF_CAMP.id));
      if (ev && ev.t === "death") deadSlot = ev.unit;
    }
    expect(deadSlot).toBeDefined();

    // death is a full-room broadcast (not AOI-routed) — must show up in h.broadcastsOf, not
    // just the attackers' own frames.
    const globalDeaths = h.broadcastsOf("s:msg").filter((b) => b.data.type === "combat");
    const sawGlobalDeath = globalDeaths.some((b) =>
      (b.data.payload as CombatEvent[]).some((e) => e.t === "death" && e.unit === deadSlot),
    );
    expect(sawGlobalDeath).toBe(true);
    expect(combatEvents(h, [p1, p2]).some((e) => e.t === "xpGained")).toBe(true);
    expect(h.snapshot().units[deadSlot!]).toBeUndefined();

    // The slot respawns after the camp's respawnMs.
    await h.advance(WOLF_CAMP.respawnMs + 500);
    expect(h.snapshot().units[deadSlot!]).toBeDefined();
    expect(h.snapshot().units[deadSlot!]!.alive).toBe(true);
  });

  it("player death at the field boss, then the respawn intent revives at the zone's player spawn", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    const boss = ASHEN_FIELDS.fieldBoss!;
    await moveTo(h, p1, "p1", boss.pos, 40000);

    await p1.send("attack", { unitId: BOSS_SLOT });
    let dead = false;
    for (let i = 0; i < 30 && !dead; i++) {
      await h.advance(2000);
      dead = h.snapshot().units["p1"]?.alive === false;
    }
    expect(dead).toBe(true);

    await p1.send("respawn");
    await h.advance(200);
    const p = h.snapshot().units["p1"]!;
    expect(p.alive).toBe(true);
    expect(p.hp).toBeGreaterThan(0);
    expect(Math.hypot(p.x - ASHEN_FIELDS.playerSpawn.x, p.y - ASHEN_FIELDS.playerSpawn.y)).toBeLessThan(3);
  });

  it("respawning while alive, or casting while dead, is a no-op", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await h.advance(100);

    await p1.send("respawn"); // alive already — ignored
    await h.advance(100);
    expect(h.snapshot().units["p1"]!.hp).toBe(h.snapshot().units["p1"]!.maxHp);

    const boss = ASHEN_FIELDS.fieldBoss!;
    await moveTo(h, p1, "p1", boss.pos, 40000);
    await p1.send("attack", { unitId: BOSS_SLOT });
    for (let i = 0; i < 30 && h.snapshot().units["p1"]!.alive; i++) await h.advance(2000);
    expect(h.snapshot().units["p1"]!.alive).toBe(false);

    await p1.send("cast", { skillId: "warrior-strike", target: { unitId: BOSS_SLOT } });
    await h.advance(200);
    expect(h.snapshot().units["p1"]!.alive).toBe(false); // still dead — cast ignored
  });
});

describe("FieldRoomImpl — AOI routing (sendNear vs. global)", () => {
  it("a far player does not receive a near-camp damage event, but does receive its death (global)", async () => {
    const h = await makeRoom();
    // The goblin shaman never fights back (its only skill is a self-anchored friendly
    // heal — see rpg-behavior.test.ts), so p1 can solo it safely; p2 stays home so this
    // test isolates AOI routing rather than combat survivability.
    const p1 = await h.connect("p1");
    const p2 = await h.connect("p2"); // stays put at the player spawn, far outside AOI viewRadius

    const shamanStart = h.snapshot().units[SHAMAN_SLOT]!;
    expect(
      Math.hypot(shamanStart.x - ASHEN_FIELDS.playerSpawn.x, shamanStart.y - ASHEN_FIELDS.playerSpawn.y),
    ).toBeGreaterThan(40); // outside the 40-unit AOI view radius, by construction of the zone

    await moveTo(h, p1, "p1", { x: shamanStart.x, y: shamanStart.y });
    await p1.send("attack", { unitId: SHAMAN_SLOT });

    let deadSlot: string | undefined;
    for (let i = 0; i < 30 && !deadSlot; i++) {
      await p1.send("cast", { skillId: "warrior-strike", target: { unitId: SHAMAN_SLOT } });
      await h.advance(2600);
      const ev = combatEvents(h, [p1]).find((e) => e.t === "death" && e.unit.startsWith(SHAMAN_CAMP.id));
      if (ev && ev.t === "death") deadSlot = ev.unit;
    }
    expect(deadSlot).toBeDefined();

    // p1 (in the fight) saw the damage; p2 (far away, not in `always`) never did.
    expect(combatEvents(h, [p1]).some((e) => e.t === "damaged" && e.target === SHAMAN_SLOT)).toBe(true);
    expect(combatEvents(h, [p2]).some((e) => e.t === "damaged" && e.target === SHAMAN_SLOT)).toBe(false);

    // death is global — p2 gets it despite never approaching the fight.
    expect(combatEvents(h, [p2]).some((e) => e.t === "death" && e.unit === deadSlot)).toBe(true);
  });
});

describe("FieldRoomImpl — engine persistence + binary codec", () => {
  it("persists engine state for eviction survival (snapshot restores the live fight)", async () => {
    const h = await makeRoom();
    // The goblin shaman never retaliates (see the AOI test above), so a solo player can
    // safely rack up a couple of hits without a death race against the persist timing.
    const p1 = await h.connect("p1");
    const shamanStart = h.snapshot().units[SHAMAN_SLOT]!;
    await moveTo(h, p1, "p1", { x: shamanStart.x, y: shamanStart.y });

    await p1.send("cast", { skillId: "warrior-strike", target: { unitId: SHAMAN_SLOT } });
    await h.advance(3200); // strike cooldown 2500ms
    await p1.send("cast", { skillId: "warrior-strike", target: { unitId: SHAMAN_SLOT } });
    await h.advance(1000);
    const w = h.snapshot().units[SHAMAN_SLOT];
    expect(w).toBeDefined();
    expect(w!.hp).toBeLessThan(w!.maxHp);

    // Let the coalesced durable persist fire (persistIntervalMs default 5s), then read it.
    await h.advance(6000);
    const persisted = h.storage.kv.get("tk:room") as { state: EmberState } | undefined;
    expect(persisted?.state.engine).toBeTruthy();

    const engine = RpgEngine.restore(EMBERFALL_CONTENT, persisted!.state.engine!);
    expect(engine.getUnit("p1")).toBeDefined();
    const shaman = engine.getUnit(SHAMAN_SLOT);
    expect(shaman).toBeDefined();
    expect(shaman!.hp).toBeLessThan(shaman!.maxHp);
  });

  it("keeps state binary-codec-encodable (delta frames decode); AOI still exposes the full room in h.snapshot()", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await p1.send("move", { x: ASHEN_FIELDS.playerSpawn.x + 5, y: ASHEN_FIELDS.playerSpawn.y });
    await h.advance(500);
    await h.flush();

    const frames = p1.binaryFrames();
    expect(frames.length).toBeGreaterThanOrEqual(1);
    const seen = p1.lastState() as EmberState;
    expect(seen.units["p1"]).toBeDefined(); // a viewer always sees itself

    // The wolf camp is far outside p1's AOI view radius, so it's correctly absent from
    // the AOI-filtered frame the client decoded — but present in the room's full
    // authoritative state, which is what the codec itself encoded from.
    expect(seen.units[WOLF_SLOT]).toBeUndefined();
    expect(h.snapshot().units[WOLF_SLOT]!.kind).toBe("wolf");
  });
});
