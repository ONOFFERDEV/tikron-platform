import type { Client } from "@tikron/server";
import type { CombatEvent, UnitView } from "@tikron/rpg";
import { EmberRoomBase } from "./ember-room-base.js";
import { PortalTracker, resolveTransfer } from "./zone-transition.js";
import { EMBER_DEPTHS } from "../zones/ember-depths.js";
import type { PortalMarker } from "../zones/types.js";

/**
 * Ember Depths (잉걸불 심연) — the M2 dungeon room: real zone data (`zones/ember-depths.ts`:
 * wave-marker stand-ins, mid/end boss stand-ins, a portal back to the village) plus the
 * zone-transfer flow (PLAN-EMBERFALL-M2 §6). See `village-room.ts`'s docblock for why
 * portal-touch detection is an `onTick()` override rather than `registerZoneIntents()`.
 *
 * ## Private instance / invite-code addressing
 *
 * A dungeon instance has NO party-level identity of its own beyond its **room id**:
 * `defineRoom` already routes every `DungeonRoom` connection through the single fixed
 * party `dungeon-room` (index.ts's docblock: `wss://<host>/parties/dungeon-room/<room-id>`)
 * — Durable Objects are addressed by `(party, room id)`, so two different room ids under
 * the SAME party are already two independent DO instances with zero code here needed to
 * enforce isolation. The room id itself IS the invite code: `zone-transition.ts`'s
 * `mintDungeonCode()` mints a fresh one on every village/field->dungeon portal touch, and
 * that string becomes this room's `this.id` the moment the client reconnects to
 * `party: "dungeon-room", room: <code>` (see `client/net.ts`'s `GameClient.joinOrCreate`
 * pattern, already used for the field party). B3's client-side job: after receiving a
 * `"transfer"` message with `party: "dungeon-room"`, update the visible URL to encode
 * `payload.room` (e.g. `?dungeon=<code>`) so the player can copy/share it — a friend
 * opening that URL should connect DIRECTLY to `dungeon-room/<code>` (skip walking a
 * portal), landing in the SAME instance. M2 always mints a fresh code on entry (no
 * per-character code persistence across visits) — a returning player gets a brand-new
 * empty instance every time, which is within PLAN-EMBERFALL-M2 §9's "이동 가능한 빈
 * 인스턴스+웨이브 뼈대까지만" scope line.
 *
 * ## Empty-instance cleanup (PLAN §9: "onDispose+30분 TTL")
 *
 * No custom TTL timer is added here: `Room`'s core (`packages/server/src/room.ts`,
 * `finalizeLeave`) already calls `onDispose()` and clears the room's persisted D1/DO
 * snapshot THE MOMENT its last seat's reconnection window (30s, `CasualRealtimeRoom`'s
 * `reconnectWindowSec`) elapses — i.e., an empty dungeon instance is already reclaimed
 * within seconds, well inside the 30-minute ceiling the plan allows. A fresh invite code
 * every entry (above) means an abandoned instance is never rejoined anyway, so there is
 * no separate "still-referenced but idle" state a longer TTL would need to guard.
 */
export const DUNGEON_ZONE = EMBER_DEPTHS;

/**
 * ## Boss phase scripts (M3 T3, §7)
 *
 * The two dungeon bosses drive extra beats the engine's generic NPC AI can't: a one-shot
 * `"bossEvent"` cue stream the client dramatizes (`net.ts`), plus mechanics that fire off
 * hp thresholds (summon adds, a telegraphed eruption cycle, enrage). All of it lives in
 * `onZoneTick` — the base's per-tick hook — reading the drained combat events + the live
 * engine, and using only the engine's PUBLIC driver:
 *
 * - **eruption** is `useSkill(boss, "ember-lord-eruption", {pos})`: the content skill's own
 *   1.8s `castTimeMs` IS the telegraph delay (broadcast `"telegraph"` on cast start, the AoE
 *   lands 1.8s later), and its `cancelOnMove:false` + the AI's own `!unit.cast` guard mean a
 *   forced boss cast can't be stomped mid-channel. No server-side damage recompute needed.
 * - **enrage** is `useSkill(boss, "goblin-chief-enrage")` — that self-cast skill applies the
 *   shared `boss-chief-enrage-buff`, so no `@internal` buff API is reached for.
 * - **summon** is `spawnSummonNpc` (base): one-off adds, no respawn slot, loot on death.
 *
 * Phase state is per-boss, keyed by engine unit id, IN MEMORY ONLY. A DO eviction drops it;
 * `onZoneTick` re-derives it from the restored boss's live hp (`initBossPhase` pre-marks every
 * threshold already below current hp, and `engaged` from `inCombat`), so a reattach never
 * re-broadcasts a beat the party already saw (§7 restore rule). A death drops the entry, so a
 * respawned boss (its slot's long `respawnMs`) starts a clean ladder.
 */
type BossKind = "wraith_commander" | "ember_lord";
type BossEv = "engage" | "half" | "phase_summon" | "phase_aoe" | "enrage" | "defeated";

/** hp% thresholds per boss, DESCENDING so a single big hit that crosses several fires them in
 *  order within one tick (PLAN §7: "한 틱에 여러 임계 통과 시 순차 발송"). */
const BOSS_THRESHOLDS: Record<BossKind, readonly { pct: number; ev: BossEv }[]> = {
  wraith_commander: [{ pct: 50, ev: "half" }],
  ember_lord: [
    { pct: 70, ev: "phase_summon" },
    { pct: 40, ev: "phase_aoe" },
    { pct: 15, ev: "enrage" },
  ],
};

/** The Ember Lord's phase_aoe eruption cadence + geometry. `ERUPTION_CAST_MS` MUST equal
 *  `ember-lord-eruption`'s `castTimeMs` (content pack) — it's both the telegraph lead time
 *  and the actual cast, so the red decal and the blast stay in lockstep. */
const ERUPTION_PERIOD_MS = 7000;
const ERUPTION_RADIUS = 7;
const ERUPTION_CAST_MS = 1800;
/** Adds summoned at phase_summon: 3 skeleton warriors in a ring around the boss. */
const SUMMON_COUNT = 3;
const SUMMON_RADIUS = 3.5;

/** Live phase state for one boss instance (keyed by engine unit id). See the class docblock. */
interface BossPhase {
  kind: BossKind;
  engaged: boolean;
  fired: Set<BossEv>;
  eruptionActive: boolean;
  /** Absolute engine-ms of the next eruption cast (only meaningful while `eruptionActive`). */
  nextEruptionAt: number;
  /** Monotonic counter → deterministic round-robin target pick (no engine RNG is exposed here). */
  eruptionCount: number;
}

function isBossKind(k: string | undefined): k is BossKind {
  return k === "wraith_commander" || k === "ember_lord";
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class DungeonRoomImpl extends EmberRoomBase {
  protected readonly zone = DUNGEON_ZONE;
  private readonly portals = new PortalTracker();
  /** boss engine unit id -> its live phase state. In-memory only (see the phase docblock). */
  private readonly bossPhases = new Map<string, BossPhase>();

  protected override onTick(): void {
    super.onTick();
    for (const client of this.clientList()) {
      const unit = this.state.units[client.id];
      if (!unit || unit.kind !== "player" || !unit.alive) continue;
      const portal = this.portals.check(client.id, unit, this.zone.portals);
      if (portal) this.transferOut(client, portal.kind);
    }
  }

  /** Drive both bosses' phase ladders (see the phase docblock). Runs every tick from the base. */
  protected override onZoneTick(events: readonly CombatEvent[], now: number): void {
    // 1) Advance every LIVING boss: create-or-restore its phase, then engage + thresholds + eruption.
    for (const u of this.engine.units()) {
      if (u.kind !== "npc" || !u.alive || !isBossKind(u.npcDefId)) continue;
      const phase = this.bossPhases.get(u.id) ?? this.initBossPhase(u, now);
      this.stepBoss(phase, u, now);
    }
    // 2) Boss deaths — the unit is already reaped from the engine, so read the event feed. Fire
    //    `defeated` once, then drop the phase so a later respawn re-derives a fresh ladder.
    for (const ev of events) {
      if (ev.t !== "death") continue;
      const phase = this.bossPhases.get(ev.unit);
      if (!phase) continue;
      this.emitBoss(phase.kind, ev.unit, "defeated");
      this.bossPhases.delete(ev.unit);
    }
  }

  /** Build fresh phase state, pre-marking whatever the boss's current hp/combat state already
   *  passed. Fresh spawn (full hp, out of combat) marks nothing; a mid-fight restore marks every
   *  crossed threshold + `engaged` so none re-broadcast on reattach. */
  private initBossPhase(u: UnitView, now: number): BossPhase {
    const kind = u.npcDefId as BossKind;
    const hpPct = u.maxHp > 0 ? (u.hp / u.maxHp) * 100 : 100;
    const fired = new Set<BossEv>();
    for (const t of BOSS_THRESHOLDS[kind]) if (hpPct <= t.pct) fired.add(t.ev);
    const eruptionActive = kind === "ember_lord" && fired.has("phase_aoe");
    const phase: BossPhase = {
      kind,
      engaged: u.inCombat,
      fired,
      eruptionActive,
      // Restore mid-eruption-phase resumes after a full period (never a reattach barrage).
      nextEruptionAt: eruptionActive ? now + ERUPTION_PERIOD_MS : 0,
      eruptionCount: 0,
    };
    this.bossPhases.set(u.id, phase);
    return phase;
  }

  private stepBoss(phase: BossPhase, u: UnitView, now: number): void {
    // engage — first combat entry, once per life.
    if (u.inCombat && !phase.engaged) {
      phase.engaged = true;
      this.emitBoss(phase.kind, u.id, "engage");
    }
    // hp thresholds — descending, so one big hit fires all crossed beats in order this tick.
    const hpPct = u.maxHp > 0 ? (u.hp / u.maxHp) * 100 : 100;
    for (const t of BOSS_THRESHOLDS[phase.kind]) {
      if (phase.fired.has(t.ev) || hpPct > t.pct) continue;
      phase.fired.add(t.ev);
      this.emitBoss(phase.kind, u.id, t.ev);
      this.applyPhaseEffect(phase, u, t.ev, now);
    }
    // eruption cadence (only after phase_aoe). Fires the first blast on the same tick it starts.
    if (phase.eruptionActive && now >= phase.nextEruptionAt) {
      this.castEruption(phase, u.id, now);
      phase.nextEruptionAt = now + ERUPTION_PERIOD_MS;
    }
  }

  /** The mechanical half of a threshold beat (the `bossEvent` cue is already sent by the caller). */
  private applyPhaseEffect(phase: BossPhase, u: UnitView, ev: BossEv, now: number): void {
    if (ev === "phase_summon") {
      this.summonAdds(u);
    } else if (ev === "phase_aoe") {
      phase.eruptionActive = true;
      phase.nextEruptionAt = now; // erupt immediately on entering the phase, then every period
    } else if (ev === "enrage") {
      // Reuse the shared enrage buff via its self-cast skill — the public path (no @internal
      // buff API). Clear any in-progress cast first so the instant self-buff lands.
      if (u.casting) this.engine.stopCast(u.id, now);
      this.engine.useSkill(u.id, "goblin-chief-enrage", undefined, now);
    }
    // "half" is a pure client cue — no mechanic.
  }

  /** Summon `SUMMON_COUNT` skeleton warriors in a ring around the boss (obstacle handling matches
   *  the base's own camp scatter — first move pushes them out). One-off: no respawn slot. */
  private summonAdds(u: UnitView): void {
    for (let i = 0; i < SUMMON_COUNT; i++) {
      const angle = (i / SUMMON_COUNT) * Math.PI * 2;
      const pos = {
        x: clamp(u.pos.x + Math.cos(angle) * SUMMON_RADIUS, 0, this.zone.width),
        y: clamp(u.pos.y + Math.sin(angle) * SUMMON_RADIUS, 0, this.zone.height),
      };
      this.spawnSummonNpc("skeleton_warrior", pos);
    }
  }

  /** One eruption beat: pick a living player (round-robin), telegraph the ground, and force the
   *  boss's point-cast. The cast's own 1.8s time delivers the blast; `stopCast` first so the
   *  boss's own attack can't block it. Skips silently when the party is wiped (retry next period). */
  private castEruption(phase: BossPhase, bossId: string, now: number): void {
    const players = this.livingPlayers();
    if (players.length === 0) return;
    const target = players[phase.eruptionCount % players.length]!;
    phase.eruptionCount++;
    const boss = this.engine.getUnit(bossId);
    if (boss?.casting) this.engine.stopCast(bossId, now);
    const res = this.engine.useSkill(bossId, "ember-lord-eruption", { pos: { x: target.x, y: target.y } }, now);
    if (res === "ok") {
      this.broadcast("telegraph", { x: target.x, y: target.y, r: ERUPTION_RADIUS, ms: ERUPTION_CAST_MS });
    }
  }

  /** Living player units, sorted by id — a stable order for the deterministic eruption rotation. */
  private livingPlayers(): { id: string; x: number; y: number }[] {
    const out: { id: string; x: number; y: number }[] = [];
    for (const u of this.engine.units()) {
      if (u.kind === "player" && u.alive) out.push({ id: u.id, x: u.pos.x, y: u.pos.y });
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  /** Broadcast one `"bossEvent"` — `boss` is the npcDefId (the §7 wire value), `unitId` the
   *  engine unit id. Global (a party-private instance is small); the client raises/updates the
   *  boss bar and plays the phase dramatization from it. */
  private emitBoss(boss: BossKind, unitId: string, ev: BossEv): void {
    this.broadcast("bossEvent", { boss, unitId, ev });
  }

  protected override onSeatExpired(client: Client): void | Promise<void> {
    this.portals.forget(client.id);
    return super.onSeatExpired(client);
  }

  private transferOut(client: Client, kind: PortalMarker["kind"]): void {
    const dest = resolveTransfer(kind);
    void this.saveNow(client.id).finally(() => client.send("transfer", dest));
  }
}
