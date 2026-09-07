import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestRoom, type TestRoomHandle, type TestConnection } from "@tikron/server/testing";
import { DungeonRoomImpl } from "../src/rooms/dungeon-room.js";
import { EmberSchema, type EmberState } from "../src/rooms/ember-schema.js";
import { EMBER_DEPTHS } from "../src/zones/ember-depths.js";
import { createCharacter, saveCharacter, claimSession } from "../src/persist.js";
import { createFakeD1 } from "./fake-d1.js";

/**
 * M3 integration gate (PLAN T3.2 "통플레이 게이트"): a level-15, epic-geared warrior with a
 * potion stash walks the REAL Ember Depths room end to end — wave 1 → Ser Valen → wave 2 →
 * wave 3 → The Ember Lord — and must finish WITHOUT wiping. It's the full-fat counterpart to
 * `balance-sim.test.ts`'s isolated 1v1 measurements: here the actual `DungeonRoomImpl` drives
 * the wave layout (`zones/ember-depths.ts`), both bosses' scripted phase ladders, the summoned
 * adds, the telegraphed eruption, and the kill-loot roll.
 *
 * The character is seeded through the server's OWN load path — a real `SavedCharacter` row
 * (level 15, `armor-emberforged` + `trinket-warding-band` + `warrior-sword-basic`, a dungeon
 * potion stash) claimed into a fake D1 exactly as `char-persist-room.test.ts` does — so the join
 * spawns geared stats and a usable inventory with zero engine pokes. The player is then driven
 * by a small autopilot: attack the nearest hostile, weave Strike/Whirlwind/Shield-Wall, quaff a
 * potion under 45% hp, and side-step out of an eruption telegraph. A melee solo CAN'T kite a
 * boss (it must stand in range), so this is the intended "빡빡하게, 포션 쓰며" facetank clear;
 * potions used is asserted to stay under budget so a regression that makes the run trivial (or
 * a slog needing every last potion) trips the gate.
 */

type Handle = TestRoomHandle<EmberState>;
type RoomWithDb = { db: D1Database | null };
type RoomInternals = { charByClient: Map<string, { character: { gold: number; inventory: { defId: string; qty: number }[] } }> };

const STEP_MS = 250;
const CLEAR_BUDGET_MS = 260_000; // generous ceiling; a healthy run finishes well under this
const POTION_BUDGET = 80; // a dungeon-stocked solo run (≈800 gold); the clear uses ~64 of these —
// "빡빡하게 포션 쓰며" (tight, potion-fed) with margin, NOT a razor edge that a future tweak flips.
const MID_BOSS = "mid-boss#0"; // camp id + slot (see dungeon-room.test.ts)
const END_BOSS = "end-boss#0";

interface BossEvt { boss: string; ev: string }
function bossEvents(h: Handle): BossEvt[] {
  return h
    .broadcastsOf("s:msg")
    .filter((b) => b.data.type === "bossEvent")
    .map((b) => b.data.payload as BossEvt);
}
interface Telegraph { x: number; y: number; r: number; ms: number }
function telegraphs(h: Handle): Telegraph[] {
  return h
    .broadcastsOf("s:msg")
    .filter((b) => b.data.type === "telegraph")
    .map((b) => b.data.payload as Telegraph);
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Seed a level-15 geared warrior with a potion stash into a fake D1, then connect under a claimed
 *  session so the dungeon room loads it through `spawnFromCharacter` (the real server path). */
async function connectGearedWarrior(h: Handle, db: D1Database): Promise<TestConnection> {
  const created = await createCharacter(db, { nickname: "SoloRunner", class: "warrior" });
  if (!created.ok) throw new Error("character seed failed");
  const geared = {
    ...created.character,
    level: 15,
    xp: 0,
    gold: 500,
    zone: "ember-depths" as const,
    x: EMBER_DEPTHS.playerSpawn.x,
    y: EMBER_DEPTHS.playerSpawn.y,
    hp: 99999, // restore path clamps to 100% of the geared maxHp
    mp: 99999,
    inventory: [{ defId: "potion-hp", qty: POTION_BUDGET }],
    equipment: {
      weapon: { defId: "warrior-sword-basic", qty: 1 },
      armor: { defId: "armor-emberforged", qty: 1 },
      trinket: { defId: "trinket-warding-band", qty: 1 },
    },
  };
  await saveCharacter(db, created.token, geared);
  const sessionId = crypto.randomUUID();
  const claim = await claimSession(db, created.token, sessionId, Date.now());
  expect(claim.ok).toBe(true);
  return h.connect(sessionId);
}

describe("DungeonRoomImpl — M3 integration gate (solo geared warrior full clear)", () => {
  it("clears wave 1 → Valen → wave 2 → wave 3 → Ember Lord without wiping, firing every boss phase + dropping loot", async () => {
    const { db } = createFakeD1();
    const h = (await createTestRoom(DungeonRoomImpl, { codec: EmberSchema })) as unknown as Handle;
    (h.room as unknown as RoomWithDb).db = db;
    const conn = await connectGearedWarrior(h, db);
    await h.flush();

    const me0 = h.snapshot().units[conn.id]!;
    expect(me0).toBeDefined();
    expect(me0.class).toBe("warrior");
    expect(me0.level).toBe(15);
    const maxHp = me0.maxHp;
    const goldBefore = (h.room as unknown as RoomInternals).charByClient.get(conn.id)!.character.gold;

    let potionsUsed = 0;
    let dodges = 0;
    let dodgeUntil = -1;
    let seenTelegraphs = 0;
    let elapsed = 0;
    let died = false;
    let attackTarget = ""; // re-send "attack" only on target change (re-arming resets the swing timer)
    let focusId = ""; // commit to one target until it dies (no flip-flop between equidistant clusters)
    let frontierX = me0.x; // furthest east reached — engagement anchors here, not current x (knockback-proof)

    for (; elapsed < CLEAR_BUDGET_MS; elapsed += STEP_MS) {
      const snap = h.snapshot();
      const me = snap.units[conn.id];
      if (!me || !me.alive) { died = true; break; }

      const bossDone = bossEvents(h).some((e) => e.boss === "ember_lord" && e.ev === "defeated");
      if (bossDone) break;

      // 1) Emergency potion (slot 0 is the potion stack; trash drops stack onto it, never past it).
      if (me.hp / maxHp < 0.45 && potionsUsed < POTION_BUDGET) {
        await conn.send("useItem", { slotIndex: 0 });
        potionsUsed++;
      }

      // 2) Side-step a fresh eruption telegraph centered on us (dodge = correct play; a hit is ~25% hp).
      const tgs = telegraphs(h);
      if (tgs.length > seenTelegraphs) {
        const tg = tgs[tgs.length - 1]!;
        seenTelegraphs = tgs.length;
        if (dist(me, tg) < tg.r + 3) {
          const dodgeY = me.y < 60 ? me.y + 14 : me.y - 14; // perpendicular to the x-corridor, inside walls
          await conn.send("move", { x: me.x, y: dodgeY });
          dodgeUntil = elapsed + 1500; // step clear of the blast, then straight back to melee (DPS uptime)
          dodges++;
        }
      }
      if (elapsed < dodgeUntil) { await h.advance(STEP_MS); continue; }

      // 3) Frontier + focus-fire driver — the crux of a competent solo run. Two rules a real
      //    player follows that a naive "attack nearest" bot doesn't:
      //    (a) FRONTIER: only engage mobs at/ahead of the furthest point reached (`frontierX`),
      //        never backtrack west to respawns behind you. The zone's 15s respawn is shorter
      //        than a cluster clear, so chasing the global-nearest ping-pongs forever between two
      //        camps (golem knockback shoves you west into the previous camp's respawns). Anchor
      //        on frontierX (max x reached), which knockback can't lower.
      //    (b) FOCUS-FIRE: commit to one target id until it dies; don't flip between equidistant
      //        mobs (that stalls both). NOTE: the state unit VALUE has no id — id is the Record key.
      frontierX = Math.max(frontierX, me.x);
      const entries = Object.entries(snap.units).filter(([, u]) => u.kind !== "player" && u.alive);
      // Tight window: the current cluster only (~one camp). Clusters sit ~20 units apart, so a
      // wider reach would drag the PREVIOUS camp's respawns into this fight (the run's biggest
      // potion waster). `frontierX - 6` refuses to backtrack; `dist <= 15` refuses to reach the
      // next camp early.
      const engageable = entries
        .filter(([, u]) => u.x >= frontierX - 6 && dist(me, u) <= 15)
        .map(([id, u]) => ({ id, u }));
      if (engageable.length === 0) {
        // Frontier clear — push east toward the next cluster / the boss room.
        focusId = "";
        await conn.send("move", { x: Math.min(me.x + 10, EMBER_DEPTHS.playerSpawn.x + 104), y: 60 });
        await h.advance(STEP_MS);
        continue;
      }
      let target = engageable.find((c) => c.id === focusId);
      if (!target) {
        target = engageable[0]!;
        for (const c of engageable) if (dist(me, c.u) < dist(me, target.u)) target = c;
        focusId = target.id;
      }

      if (dist(me, target.u) > 4.5) {
        await conn.send("move", { x: target.u.x - 2, y: target.u.y });
      } else {
        if (target.id !== attackTarget) { await conn.send("attack", { unitId: target.id }); attackTarget = target.id; }
        await conn.send("cast", { skillId: "warrior-whirlwind", target: { unitId: target.id } });
        await conn.send("cast", { skillId: "warrior-strike", target: { unitId: target.id } });
        await conn.send("cast", { skillId: "warrior-shield-wall" });
      }
      await h.advance(STEP_MS);
    }

    const evs = bossEvents(h);
    const evsOf = (boss: string): string[] => evs.filter((e) => e.boss === boss).map((e) => e.ev);
    // eslint-disable-next-line no-console
    console.log(
      `\n### M3 playthrough result\n` +
        `- cleared: ${!died && evsOf("ember_lord").includes("defeated")}\n` +
        `- time (game): ${(elapsed / 1000).toFixed(0)}s of ${CLEAR_BUDGET_MS / 1000}s budget\n` +
        `- potions used: ${potionsUsed} / ${POTION_BUDGET}\n` +
        `- eruption dodges: ${dodges}\n` +
        `- Ser Valen events: [${evsOf("wraith_commander").join(", ")}]\n` +
        `- Ember Lord events: [${evsOf("ember_lord").join(", ")}]\n`,
    );

    // Gate: survived, both bosses ran their full scripted ladder, boss is dead, loot landed.
    expect(died, "the geared solo warrior must not wipe").toBe(false);
    expect(evsOf("wraith_commander")).toEqual(expect.arrayContaining(["engage", "half"]));
    expect(evsOf("ember_lord")).toEqual(expect.arrayContaining(["engage", "phase_summon", "phase_aoe", "enrage", "defeated"]));
    expect(h.snapshot().units[END_BOSS], "the Ember Lord corpse must be reaped").toBeUndefined();
    expect(h.snapshot().units[MID_BOSS], "Ser Valen must be dead").toBeUndefined();
    expect(seenTelegraphs, "the eruption phase must have fired at least once").toBeGreaterThan(0);

    // Loot: the Ember Lord's table is guaranteed 220-340 gold, so the killer's gold must have grown.
    const goldAfter = (h.room as unknown as RoomInternals).charByClient.get(conn.id)!.character.gold;
    expect(goldAfter, "boss kill must grant loot gold").toBeGreaterThan(goldBefore);

    // Tightness band: a healthy solo clear leans HARD on potions (facetank, no kiting) but keeps
    // a margin. Below the floor ⇒ the dungeon went trivial; above the ceiling ⇒ damage crept back
    // up toward un-clearable. This is the regression fence around the M3 tuning in content/*.
    expect(potionsUsed, "solo clear must be genuinely tight (uses lots of potions), not trivial").toBeGreaterThan(20);
    expect(potionsUsed, "solo clear must keep a potion margin (damage not creeping back up)").toBeLessThan(76);
  });
});
