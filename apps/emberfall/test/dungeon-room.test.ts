import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle, type TestConnection } from "@tikron/server/testing";
import type { CombatEvent, RpgEngine } from "@tikron/rpg";
import { DungeonRoomImpl } from "../src/rooms/dungeon-room.js";
import { EmberSchema, type EmberState } from "../src/rooms/ember-schema.js";
import { EMBER_DEPTHS } from "../src/zones/ember-depths.js";

/**
 * DungeonRoomImpl room tests — drive the M3 Ember Depths room through the in-process harness
 * with fake timers. Two things need reaching into the (seeded, deterministic) engine that a
 * player can't do fast enough in a unit test: a boss carries 2000+ hp, so its hp-phase
 * thresholds are exercised by poking `unit.hp` directly (zero side effects — no `resurrect`
 * fsm/event churn), and a boss is killed by poking it to 1 hp then landing one real swing.
 * Geometry/spawn tables come from `zones/ember-depths.ts` directly so the tests stay honest
 * if the zone changes.
 */

type Handle = TestRoomHandle<EmberState>;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function makeRoom(): Promise<Handle> {
  return createTestRoom(DungeonRoomImpl, { codec: EmberSchema }) as unknown as Promise<Handle>;
}

/** The room's live engine (its public API is enough; `unit()` is used only to poke hp). */
function engineOf(h: Handle): RpgEngine {
  return (h.room as unknown as { engine: RpgEngine }).engine;
}

/** Set a unit's absolute hp with no side effects (no event, no fsm change, no aggro reset). */
function setHp(h: Handle, id: string, hp: number): void {
  const u = (engineOf(h) as unknown as { unit(id: string): { hp: number } | undefined }).unit(id);
  if (u) u.hp = hp;
}

function setHpPct(h: Handle, id: string, pct: number): void {
  const u = (engineOf(h) as unknown as { unit(id: string): { hp: number; readonly maxHp: number } | undefined }).unit(id);
  if (u) u.hp = (u.maxHp * pct) / 100;
}

/** Teleport a unit (used to place a test player next to / near a boss). */
function placeAt(h: Handle, id: string, pos: { x: number; y: number }): void {
  engineOf(h).moveUnit(id, pos);
}

interface BossEvt {
  boss: string;
  unitId: string;
  ev: string;
}

/** Every `"bossEvent"` the room globally broadcast, in order. */
function bossEvents(h: Handle): BossEvt[] {
  return h
    .broadcastsOf("s:msg")
    .filter((b) => b.data.type === "bossEvent")
    .map((b) => b.data.payload as BossEvt);
}

/** Every `"telegraph"` the room globally broadcast, in order. */
function telegraphs(h: Handle): { x: number; y: number; r: number; ms: number }[] {
  return h
    .broadcastsOf("s:msg")
    .filter((b) => b.data.type === "telegraph")
    .map((b) => b.data.payload as { x: number; y: number; r: number; ms: number });
}

/** Every `"combat"` event delivered globally or to any of `conns` (AOI-routed). */
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

const campId = (npcDefId: string): string => EMBER_DEPTHS.mobCamps.find((c) => c.npcDefId === npcDefId)!.id;
const MID_BOSS = `${campId("wraith_commander")}#0`; // "mid-boss#0"
const END_BOSS = `${campId("ember_lord")}#0`; // "end-boss#0"
const EMBER_HOME = EMBER_DEPTHS.mobCamps.find((c) => c.id === "end-boss")!.home;
const VALEN_HOME = EMBER_DEPTHS.mobCamps.find((c) => c.id === "mid-boss")!.home;

function countKind(h: Handle, kind: string): number {
  return Object.values(h.snapshot().units).filter((u) => u.kind === kind).length;
}

describe("DungeonRoomImpl — M3 spawn table", () => {
  it("seeds every wave/boss camp with its real M3 species and counts", async () => {
    const h = await makeRoom();
    await h.connect("p1");

    // Sum of every camp's declared count, per species, straight from the zone table.
    const expected: Record<string, number> = {};
    for (const c of EMBER_DEPTHS.mobCamps) expected[c.npcDefId] = (expected[c.npcDefId] ?? 0) + c.count;

    expect(countKind(h, "skeleton_warrior")).toBe(expected.skeleton_warrior); // wave-1 (×2)
    expect(countKind(h, "skeleton_archer")).toBe(expected.skeleton_archer); // wave-1-archer + wave-2-archer (×1 each)
    expect(countKind(h, "wraith")).toBe(expected.wraith); // wave-2 (×2)
    expect(countKind(h, "golem")).toBe(expected.golem); // wave-3 (×2)
    expect(countKind(h, "wraith_commander")).toBe(1); // mid-boss
    expect(countKind(h, "ember_lord")).toBe(1); // end-boss

    // The two bosses spawned at their camp slot ids (the ids the phase script tracks by).
    expect(h.snapshot().units[MID_BOSS]!.kind).toBe("wraith_commander");
    expect(h.snapshot().units[END_BOSS]!.kind).toBe("ember_lord");
  });
});

describe("DungeonRoomImpl — Ember Lord phase ladder", () => {
  it("broadcasts engage once on first combat, and not again", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await h.advance(100); // let one clean tick init the boss phase (idle, full hp) before combat
    // Land the player on the boss and attack — proximity/aggro drives combatEngaged.
    placeAt(h, "p1", { x: EMBER_HOME.x - 2, y: EMBER_HOME.y });
    await p1.send("attack", { unitId: END_BOSS });
    await h.advance(600);

    const engages = () => bossEvents(h).filter((e) => e.boss === "ember_lord" && e.ev === "engage");
    expect(engages()).toHaveLength(1);
    expect(engages()[0]!.unitId).toBe(END_BOSS);

    await h.advance(1500);
    expect(engages()).toHaveLength(1); // latched — never re-fires
  });

  it("fires phase_summon (with 3 skeleton adds), phase_aoe, then enrage as hp crosses thresholds", async () => {
    const h = await makeRoom();
    await h.connect("p1"); // stays at spawn, far from the boss — keeps the boss idle (no leash reset)
    await h.advance(100); // clean init tick (boss full hp) so thresholds fire as damage, not restore

    // 70% — phase_summon + 3 skeleton warriors ringed around the boss.
    setHpPct(h, END_BOSS, 69);
    await h.advance(200);
    expect(bossEvents(h).some((e) => e.boss === "ember_lord" && e.ev === "phase_summon")).toBe(true);
    const adds = Object.values(h.snapshot().units).filter(
      (u) => u.kind === "skeleton_warrior" && Math.hypot(u.x - EMBER_HOME.x, u.y - EMBER_HOME.y) < 8,
    );
    expect(adds).toHaveLength(3);

    // 40% — phase_aoe.
    setHpPct(h, END_BOSS, 39);
    await h.advance(200);
    expect(bossEvents(h).some((e) => e.boss === "ember_lord" && e.ev === "phase_aoe")).toBe(true);

    // 15% — enrage, and the shared enrage buff actually lands on the boss.
    setHpPct(h, END_BOSS, 14);
    await h.advance(200);
    expect(bossEvents(h).some((e) => e.boss === "ember_lord" && e.ev === "enrage")).toBe(true);
    expect(engineOf(h).getUnit(END_BOSS)!.buffs.some((b) => b.buffId === "boss-chief-enrage-buff")).toBe(true);
  });

  it("fires all crossed thresholds in one tick in descending order when a single hit drops it low", async () => {
    const h = await makeRoom();
    await h.connect("p1");
    await h.advance(100); // clean init tick before the big hit

    setHpPct(h, END_BOSS, 10); // below all three thresholds at once
    await h.advance(100);

    const seq = bossEvents(h)
      .filter((e) => e.boss === "ember_lord")
      .map((e) => e.ev);
    expect(seq).toEqual(["phase_summon", "phase_aoe", "enrage"]);
  });

  it("phase_aoe telegraphs a ground AoE, then the eruption damages a player standing in it ~1.8s later", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await h.advance(100); // clean init tick
    // Just outside the boss's aggro radius (20) but inside eruption range (30): the boss never
    // melees the player, so any damage the player takes is the eruption alone.
    const spot = { x: EMBER_HOME.x - 24, y: EMBER_HOME.y };
    placeAt(h, "p1", spot);

    setHpPct(h, END_BOSS, 39); // enter phase_aoe -> first eruption fires this same tick
    await h.advance(200);

    const tgs = telegraphs(h);
    expect(tgs.length).toBeGreaterThanOrEqual(1);
    const tg = tgs[0]!;
    expect(tg.r).toBe(7);
    expect(tg.ms).toBe(1800);
    expect(Math.hypot(tg.x - spot.x, tg.y - spot.y)).toBeLessThan(1); // centered on the player

    const hpBefore = h.snapshot().units["p1"]!.hp;
    await h.advance(2000); // past the 1.8s cast — the blast lands
    const evs = combatEvents(h, [p1]);
    expect(evs.some((e) => e.t === "damaged" && e.target === "p1")).toBe(true);
    const after = h.snapshot().units["p1"]!;
    expect(after.hp < hpBefore || !after.alive).toBe(true);
  });

  it("broadcasts defeated when the boss dies", async () => {
    const h = await makeRoom();
    const p1 = await h.connect("p1");
    await h.advance(100); // clean init tick
    placeAt(h, "p1", { x: EMBER_HOME.x - 2, y: EMBER_HOME.y });
    setHp(h, END_BOSS, 1); // one real swing finishes it
    await p1.send("attack", { unitId: END_BOSS });

    let defeated = false;
    for (let i = 0; i < 12 && !defeated; i++) {
      await h.advance(500);
      defeated = bossEvents(h).some((e) => e.boss === "ember_lord" && e.ev === "defeated");
    }
    expect(defeated).toBe(true);
    expect(h.snapshot().units[END_BOSS]).toBeUndefined(); // corpse reaped
  });
});

describe("DungeonRoomImpl — Ser Valen (mid-boss)", () => {
  it("fires half exactly once and never repeats", async () => {
    const h = await makeRoom();
    await h.connect("p1");
    await h.advance(100); // clean init tick

    setHpPct(h, MID_BOSS, 49); // cross 50%
    await h.advance(200);
    const halfCount = () => bossEvents(h).filter((e) => e.boss === "wraith_commander" && e.ev === "half").length;
    expect(halfCount()).toBe(1);

    setHpPct(h, MID_BOSS, 30); // still below 50% — must NOT re-fire
    await h.advance(400);
    expect(halfCount()).toBe(1);
    // A boss that never dropped below 50% would not have engage listed either — sanity that
    // this event stream is Valen's and only carries `half`.
    expect(bossEvents(h).filter((e) => e.boss === "wraith_commander").map((e) => e.ev)).toEqual(["half"]);
  });
});
