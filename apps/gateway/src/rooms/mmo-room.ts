import { IoArenaRoom, type Client } from "@tikron/server";
import { stepToward } from "@tikron/sim";
import {
  RpgEngine,
  sampleContent,
  type CombatEvent,
  type TargetRef,
  type UnitView,
} from "@tikron/rpg";
import {
  MmoSchema,
  MAP,
  TICK_MS,
  PLAYER_SPAWN,
  PLAYER_SPEED,
  SPAWN_SLOTS,
  HOTBAR_SET,
  type MmoState,
  type MmoUnit,
  type SpawnSlot,
} from "./mmo-schema.js";

/**
 * Example MMORPG room — the reference integration of {@link @tikron/rpg} on Tikron.
 *
 * The room owns NO combat logic: it constructs one {@link RpgEngine}, feeds player
 * intents into it (`useSkill` / `moveUnit` / `startAutoAttack` / `resurrect`), calls
 * {@link RpgEngine.tick} exactly once per simulation tick with a monotonic engine
 * clock, mirrors each unit's presentation into the synced {@link MmoState}, and
 * relays the tick's `CombatEvent[]` as one batched `combat` developer message. The
 * engine is deterministic (seeded), so `serialize()`/`restore()` survive a Durable
 * Object eviction.
 *
 * The tick clock is `clockBaseMs + currentTick * TICK_MS`, NEVER `Date.now()`: it is
 * the absolute monotonic time the engine requires, and the base offset lets it resume
 * past the persisted `nowMs` after an eviction (where `currentTick` restarts at 0).
 */

/** Re-serialize the engine into persisted state every N ticks (≈0.5 s) for eviction survival. */
const SNAPSHOT_EVERY = 10;

/** Fixed engine seed → identical event streams across ticks, tests, and restores. */
const ENGINE_SEED = 0x4d4d4f; // "MMO"

function isVec2(v: unknown): v is { x: number; y: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).x === "number" &&
    Number.isFinite((v as Record<string, unknown>).x) &&
    typeof (v as Record<string, unknown>).y === "number" &&
    Number.isFinite((v as Record<string, unknown>).y)
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Round and clamp a pool value into the codec's u16 range. */
function u16(v: number): number {
  return clamp(Math.round(v), 0, 65535);
}

export class MmoRoomImpl extends IoArenaRoom<MmoState> {
  protected readonly codec = MmoSchema;
  protected override tickMs = TICK_MS;

  private engine!: RpgEngine;
  /** playerId -> click-to-move destination; consumed a step per tick until reached. */
  private readonly moveDest = new Map<string, { x: number; y: number }>();
  /** monster slot id -> simulation tick at which it re-spawns after death. */
  private readonly respawnAt = new Map<string, number>();
  private readonly slotById = new Map<string, SpawnSlot>(SPAWN_SLOTS.map((s) => [s.id, s]));
  /** Engine-clock base; bumped to the snapshot's `nowMs` on restore so time never rewinds. */
  private clockBaseMs = 0;

  /** Absolute monotonic engine time for the current tick (drives every engine call). */
  private now(): number {
    return this.clockBaseMs + this.currentTick * TICK_MS;
  }

  protected override onReady(): void {
    // Click-to-move (event-driven, not per-tick) plus casts/attacks stay well under
    // this; the headroom over the 30 default absorbs a burst of hotbar inputs.
    this.maxInputsPerSecond = 60;
    this.setState({ units: {}, engine: null });

    this.engine = new RpgEngine(sampleContent, { seed: ENGINE_SEED, pvpEnabled: false });
    for (const slot of SPAWN_SLOTS) {
      this.engine.spawnNpc(slot.npcDef, slot.pos, { id: slot.id, home: slot.pos });
    }
    this.syncUnits();
    this.state.engine = this.engine.serialize();

    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("cast", (client, payload) => this.handleCast(client, payload));
    this.onMessage("stopCast", (client) => this.handleStopCast(client));
    this.onMessage("attack", (client, payload) => this.handleAttack(client, payload));
    this.onMessage("respawn", (client) => this.handleRespawn(client));
  }

  // A cold start restored `this.state` (units + persisted engine snapshot). Rebuild the
  // live engine from it — onReady already ran against a fresh engine, which we discard.
  protected override onRestore(): void {
    const snap = this.state.engine;
    if (snap) {
      this.engine = RpgEngine.restore(sampleContent, snap);
      this.clockBaseMs = snap.nowMs; // resume the engine clock past the eviction gap
    }
    // Slots that died + were reaped before the eviction are gone from the engine;
    // schedule a prompt respawn so the world refills.
    for (const slot of SPAWN_SLOTS) {
      if (!this.engine.getUnit(slot.id) && !this.respawnAt.has(slot.id)) {
        this.respawnAt.set(slot.id, this.currentTick + 1);
      }
    }
    this.syncUnits();
  }

  override onJoin(client: Client): void {
    this.engine.spawnPlayer({
      id: client.id,
      pos: { ...PLAYER_SPAWN },
      faction: "players",
      weapon: "sword",
      // A sturdy starter hero: enough stamina to survive one wolf, class-less so the
      // whole hotbar (melee + spells + heal) is usable from one character.
      stats: { sta: 20, str: 16, dex: 12 },
    });
    // Gear path demo: a trinket adding +10% melee damage. A percent modifier avoids the
    // pool clamp a maxHp bump would cause on an already-full unit; swap it at runtime
    // with setEquipmentModifiers(id, "starter-trinket", null | [...]).
    this.engine.setEquipmentModifiers(client.id, "starter-trinket", [
      { stat: "meleeDamageMul", kind: "percent", value: 10 },
    ]);
    this.writeUnit(client.id);
    this.markStateChanged();
  }

  // The preset holds a dropped seat for its reconnection window; this runs only once
  // that window truly lapses.
  protected override onSeatExpired(client: Client): void {
    this.engine.removeUnit(client.id);
    delete this.state.units[client.id];
    this.moveDest.delete(client.id);
    this.markStateChanged();
  }

  protected override onTick(): void {
    const now = this.now();
    this.stepMovement();
    const events = this.engine.tick(now);
    // reap/respawn run AFTER this tick's flush, so their unitRemoved/unitSpawned events
    // land in the engine's next-tick buffer — lost if the DO evicts before that tick.
    // Accepted trade-off: they are cosmetic (VFX cues); the authoritative removal/spawn
    // is already mirrored into this.state below and recovers via the codec delta.
    this.reapDeadNpcs(events);
    this.processRespawns();
    this.syncUnits();
    if (this.currentTick % SNAPSHOT_EVERY === 0) this.state.engine = this.engine.serialize();
    if (events.length > 0) {
      // AOI hardening (follow-up): this whole-room broadcast ships positions carried by
      // movement/spawn events. The demo map is a single screen so every client sees all
      // of it anyway; a larger world should route positioned events through `sendNear`
      // (needs an `aoi` config) so the event channel can't become a wallhack.
      this.broadcast("combat", events);
    }
    // The IoArenaRoom preset flushes state (markStateChanged) after onTick returns.
  }

  // --- intents (validate every payload; act on the engine's view) --------------------

  private handleMove(client: Client, payload: unknown): void {
    const me = this.engine.getUnit(client.id);
    if (!me || !me.alive || !isVec2(payload)) return;
    const dest = { x: clamp(payload.x, 0, MAP), y: clamp(payload.y, 0, MAP) };
    if (me.casting) this.engine.stopCast(client.id, this.now()); // a move cancels a cast
    this.moveDest.set(client.id, dest);
  }

  private handleCast(client: Client, payload: unknown): void {
    const me = this.engine.getUnit(client.id);
    if (!me || !me.alive || typeof payload !== "object" || payload === null) return;
    const skillId = (payload as { skillId?: unknown }).skillId;
    if (typeof skillId !== "string" || !HOTBAR_SET.has(skillId)) return; // off-hotbar → ignore
    const target = this.readTarget((payload as { target?: unknown }).target);
    if (target === "invalid") return;
    this.moveDest.delete(client.id); // stand still to cast
    this.engine.useSkill(client.id, skillId, target, this.now());
  }

  private handleStopCast(client: Client): void {
    if (!this.engine.getUnit(client.id)) return;
    this.engine.stopCast(client.id, this.now());
  }

  private handleAttack(client: Client, payload: unknown): void {
    const me = this.engine.getUnit(client.id);
    if (!me || !me.alive || typeof payload !== "object" || payload === null) return;
    const unitId = (payload as { unitId?: unknown }).unitId;
    if (typeof unitId !== "string") return;
    const target = this.engine.getUnit(unitId);
    if (!target || !target.alive) return;
    this.engine.startAutoAttack(client.id, unitId, this.now());
  }

  private handleRespawn(client: Client): void {
    const me = this.engine.getUnit(client.id);
    if (!me || me.alive) return; // only the dead respawn
    this.moveDest.delete(client.id);
    this.engine.resurrect(client.id, { hpPct: 50, mpPct: 50, pos: { ...PLAYER_SPAWN } }, this.now());
  }

  /** Parse a cast target: a unit ref, a ground point, undefined (self/none), or "invalid". */
  private readTarget(raw: unknown): TargetRef | undefined | "invalid" {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== "object") return "invalid";
    const o = raw as Record<string, unknown>;
    if (typeof o.unitId === "string") return { unitId: o.unitId };
    const pos = o.pos;
    if (isVec2(pos)) return { pos: { x: pos.x, y: pos.y } };
    return "invalid";
  }

  // --- simulation helpers ------------------------------------------------------------

  /** Advance each click-to-move player one step toward its destination (server-authoritative). */
  private stepMovement(): void {
    for (const [id, dest] of this.moveDest) {
      const u = this.engine.getUnit(id);
      if (!u || !u.alive) {
        this.moveDest.delete(id);
        continue;
      }
      // Stand still to cast; hold the destination through CC (rooted/stunned/sleeping).
      // `canMove` is a live scan on the engine's current buffs — read fresh each tick
      // (via getUnit above), never cached across ticks.
      if (u.casting || !u.canMove) continue;
      const speed = PLAYER_SPEED * (u.moveSpeedMul / 100);
      const next = stepToward(u.pos, dest, speed, TICK_MS);
      if (next.x === u.pos.x && next.y === u.pos.y) {
        this.moveDest.delete(id); // already there (or blocked to a standstill)
        continue;
      }
      const facing = Math.atan2(next.y - u.pos.y, next.x - u.pos.x);
      this.engine.moveUnit(id, next, facing);
      if (Math.hypot(dest.x - next.x, dest.y - next.y) <= 0.1) this.moveDest.delete(id);
    }
  }

  /** Reap dead NPCs (players stay dead for the respawn intent); slot NPCs schedule a respawn. */
  private reapDeadNpcs(events: readonly CombatEvent[]): void {
    for (const ev of events) {
      if (ev.t !== "death") continue;
      const u = this.engine.getUnit(ev.unit);
      if (!u || u.kind !== "npc") continue;
      const slot = this.slotById.get(ev.unit);
      if (slot) this.respawnAt.set(slot.id, this.currentTick + Math.ceil(slot.respawnMs / TICK_MS));
      this.engine.removeUnit(ev.unit); // clear the corpse; a slot refills on its timer
    }
  }

  /** Re-spawn any monster slot whose respawn tick has arrived. */
  private processRespawns(): void {
    for (const [slotId, dueTick] of this.respawnAt) {
      if (this.currentTick < dueTick) continue;
      this.respawnAt.delete(slotId);
      const slot = this.slotById.get(slotId);
      if (!slot || this.engine.getUnit(slotId)) continue;
      this.engine.spawnNpc(slot.npcDef, slot.pos, { id: slot.id, home: slot.pos });
    }
  }

  // --- state mirror ------------------------------------------------------------------

  /** Rebuild `this.state.units` from the engine's authoritative unit views. */
  private syncUnits(): void {
    const seen = new Set<string>();
    for (const u of this.engine.units()) {
      seen.add(u.id);
      this.state.units[u.id] = this.viewToUnit(u);
    }
    for (const id of Object.keys(this.state.units)) {
      if (!seen.has(id)) delete this.state.units[id];
    }
  }

  private writeUnit(id: string): void {
    const u = this.engine.getUnit(id);
    if (u) this.state.units[id] = this.viewToUnit(u);
  }

  private viewToUnit(u: UnitView): MmoUnit {
    const cast = u.casting;
    const kind: MmoUnit["kind"] =
      u.kind === "player" ? "player" : u.npcDefId === "boss" ? "boss" : "wolf";
    return {
      x: clamp(u.pos.x, 0, MAP),
      y: clamp(u.pos.y, 0, MAP),
      facing: clamp(u.facing, -Math.PI, Math.PI),
      hp: u16(u.hp),
      maxHp: u16(u.maxHp),
      mp: u16(u.mp),
      maxMp: u16(u.maxMp),
      level: clamp(Math.round(u.level), 0, 255),
      kind,
      alive: u.alive,
      cast: cast ? cast.skillId : "",
      castEnd: cast ? cast.endsAt : 0,
      buffs: u.buffs.map((b) => b.buffId),
    };
  }
}
