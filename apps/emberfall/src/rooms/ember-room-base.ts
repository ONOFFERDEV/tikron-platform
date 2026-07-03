import { env as workerEnv } from "cloudflare:workers";
import { IoArenaRoom, type Client } from "@tikron/server";
import { stepToward, pushOutOfObstacles, type Obstacle } from "@tikron/sim";
import { RpgEngine, makeRng, type CombatEvent, type Modifier, type TargetRef, type UnitView } from "@tikron/rpg";
import { EMBERFALL_CONTENT } from "../content/emberfall-content.js";
import { CLASS_HOTBAR, CLASS_STATS, CLASS_WEAPON, isSkillUnlocked, type EmberClass } from "../content/hotbar.js";
import { ITEMS } from "../content/items.js";
import { SHOP_ITEM_IDS } from "../content/shop.js";
import { addItem, buyItem, equipItem, moveItem, sellItem, unequipItem, useConsumable } from "../systems/inventory.js";
import { rollLoot } from "../systems/loot.js";
import * as persist from "../persist.js";
import type { EquipSlot, ItemModifier, SavedCharacter, SavedZone } from "../types.js";
import type { ZoneData } from "../zones/types.js";
import {
  EmberSchema,
  MAP,
  MOVE_SPEED,
  PLAYER_RADIUS,
  TICK_MS,
  type EmberState,
  type EmberUnit,
} from "./ember-schema.js";

/**
 * `EmberRoomBase` — the shared engine/tick/intent/AOI/serialize/persistence core for
 * every Emberfall zone room. `field-room.ts` / `village-room.ts` / `dungeon-room.ts`
 * are thin subclasses that supply only `zone` (+ an optional `registerZoneIntents`
 * override). This started as the M1 upgrade of the `mmo-room.ts` reference pattern; M2
 * (PLAN-EMBERFALL-M2 §5) adds character load/save on top without touching the M1
 * engine/tick/AOI contract.
 *
 * ## Extension points for Wave B (READ THIS before editing this file)
 *
 * Two intent-registration hooks are called once from `onReady`, after the base's own
 * move/cast/attack/respawn/selectClass handlers are wired. They exist so Wave B's two
 * agents never need to touch the same lines of the same method:
 *
 * - `protected registerZoneIntents(): void` — **override this in a ZONE SUBCLASS**
 *   (`village-room.ts` / `dungeon-room.ts`), never here. Portal-transfer requests, shop
 *   NPC interact, training-dummy reset, dungeon wave/invite-code handling — anything
 *   that differs per zone. Call `this.saveNow(clientId)` (below) before disconnecting a
 *   player for a zone transfer, so the D1 row is fresh when the destination room's
 *   `onJoin` loads it. Default: no-op (`FieldRoomImpl` doesn't need one for M2 — the
 *   field's only zone-specific behavior, mob camps + the field boss, is already handled
 *   by `spawnZoneMobs()`/`reapDeadNpcs()` below, not an intent).
 * - `protected registerInventoryIntents(): void` — **filled in directly in THIS file**
 *   (not a subclass override — inventory/equip/shop must work identically in every
 *   zone), by Wave B2 (`systems/inventory.ts` + `content/items.ts`/`shop.ts`).
 *   `"equip"`/`"unequip"`/`"useItem"`/`"buy"`/`"sell"`/`"moveItem"` land here; each
 *   resends `"inv"` (owner-only, never synced/broadcast — PLAN §7) to the acting client
 *   on success. Equipment modifiers apply via
 *   `this.engine.setEquipmentModifiers(unitId, "gear:"+slot, mods | null)` (rpg
 *   README's gotcha: this does NOT top up current hp/mp when maxHp/maxMp rises —
 *   `handleUseItem` below routes a consumable's flat heal through `resurrect`'s
 *   percent-of-max instead, the only exposed primitive that sets current pools).
 *   `EmberRoomBase.reapDeadNpcs` also rolls a dead NPC's loot table
 *   (`systems/loot.ts`) into its killer's inventory/gold on kill.
 *
 * `registerZoneIntents` is still an empty virtual method for a zone subclass to
 * override; `registerInventoryIntents` now has a real body here.
 *
 * ## Character persistence (PLAN-EMBERFALL-M2 §5, session binding per
 * PLAN-EMBERFALL-M2-SECFIX FIX-1/FIX-2 "Path F")
 *
 * `db` resolves the D1 binding from `cloudflare:workers`'s ambient `env` export (the
 * `Room` base class has no constructor-injected `env` — see this file's git history /
 * PR description for why: `RoomInit` is `{id, ctx}` only, and `RoomContext`/
 * `RoomServices` are fixed, non-extensible shapes in `@tikron/server` that this repo's
 * ground rules forbid editing). Tests override `db` directly on the room instance
 * (it's a plain field, not a getter) before calling `connect()`.
 *
 * When `db` is unset (every existing room-logic test via `createTestRoom`, which never
 * configures persistence), `onJoin` falls back to the exact M1 behavior: spawn a
 * default warrior at the zone's spawn point, no character required. This is the same
 * "absent → no-op, game runs exactly as before" contract `platformReporter` uses
 * (AGENTS.md) — it's what keeps the pre-M2 tests green through this file's split.
 *
 * When `db` IS set (production, and any M2-specific test that injects a fake D1), a
 * connecting client's session key (Tikron's `client.id`, i.e. `?_session=` — see
 * `net.ts`) is looked up against a session->character CLAIM in D1, never against the
 * save token directly: `persist.loadCharacterBySession(db, client.id)`. The raw save
 * token itself never reaches this Room subclass at all — it travels only as far as
 * `?_auth=`, consumed once by `index.ts`'s `charOnAuth` (which runs in the `defineRoom`
 * DO wrapper, the only place that sees both the real `env` AND the token together) to
 * CAS-claim the connecting session as that character's sole live owner
 * (`persist.claimSession`) BEFORE a seat is ever granted. That claim is what a second
 * concurrent connection presenting the same token fails to acquire (FIX-2: no
 * same-token self-clone) — this Room subclass just trusts that by the time `onJoin`
 * runs, `client.id` already IS an exclusively-owned session, and looks the character up
 * by that id alone. No character claiming `client.id` -> no player unit is spawned and
 * a `"charError"` message is sent instead; every intent handler below already no-ops
 * when `engine.getUnit(client.id)` is undefined, so an unauthenticated connection
 * simply can't act. `createTestRoom` bypasses `onAuth`/`onConnect` entirely (it calls
 * `_connect` directly), so room-logic tests seed the session->character claim into
 * their fake D1 directly (`claimSession`, or inserting the row pre-claimed) instead of
 * going through `charOnAuth`.
 *
 * Because the Tikron session key is now always a random, per-play-session id (never the
 * save token — `net.ts`'s `connect()` sends the token only via `authToken`/`?_auth=`),
 * the pre-SECFIX tradeoff this docblock used to document (save token round-tripping
 * through `PeerJoined.connectionId` to every other client in the room) no longer
 * applies: nothing peer-visible ever carries the token.
 */

/** Re-serialize the engine into persisted state every N ticks (≈0.5s) for eviction survival. */
const SNAPSHOT_EVERY = 10;

/** Fixed engine seed → identical event streams across ticks, tests, and restores. */
const ENGINE_SEED = 0x454d4245; // "EMBE"

/** AOI view radius + priority tiers per PLAN §4 ("tiers [20/1, 40/4]"). */
const AOI_VIEW_RADIUS = 40;
const AOI_TIERS = [
  { radius: 20, interval: 1 },
  { radius: 40, interval: 4 },
] as const;

/** Character dirty-save cadence: every 60s of ticks (PLAN-EMBERFALL-M2 §5). Tick-modulo
 *  (not a wall-clock timer) to match this room's existing `SNAPSHOT_EVERY` idiom. */
const SAVE_EVERY_TICKS = Math.round(60_000 / TICK_MS);

/** A dungeon is always saved-out-of as the village (PLAN-EMBERFALL-M2 §2: "던전이면
 *  마을로 강등") — instanced rooms have no meaningful coordinates to resume into. */
const SAFE_ZONE: SavedZone = "emberhold";
const SAFE_SPAWN = { x: 30, y: 30 };

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

function isEmberClass(v: unknown): v is EmberClass {
  return v === "warrior" || v === "mage" || v === "cleric";
}

function isEquipSlot(v: unknown): v is EquipSlot {
  return v === "weapon" || v === "armor" || v === "trinket";
}

/** `ItemModifier.stat` is `string` in `types.ts` (kept import-free of `@tikron/rpg` — see
 *  that file's docblock); this is the one call site that narrows it back to `StatKey`
 *  right before handing it to `setEquipmentModifiers`. */
function toEngineModifiers(mods: readonly ItemModifier[]): Modifier[] {
  return mods.map((m) => ({ stat: m.stat as Modifier["stat"], kind: m.kind, value: m.value }));
}

/** Deterministic loot RNG (PLAN-EMBERFALL-M2 §3) — never `Math.random`. Reseeded fresh
 *  on every room construction (onReady always runs on a new instance, including after a
 *  DO cold start); not snapshotted, so an eviction can shift the loot sequence — an
 *  accepted tradeoff (no real-money stakes), matching the custom-effect
 *  re-registration note below. */
const LOOT_SEED = 0x4c4f4f54; // "LOOT"

/** One monster respawn slot: where and what to re-spawn when it dies. */
interface SlotHome {
  pos: { x: number; y: number };
  npcDefId: string;
  respawnMs: number;
}

/** In-memory bookkeeping for one seated player's character session, keyed by
 *  `client.id` (the Tikron session key — see this file's top docblock on why that's no
 *  longer the save token). `inventory`/`equipment`/`gold`/`xp` ride through on
 *  `character` outside the engine's own snapshot (the engine only knows combat stats,
 *  not loot) — mirrored into `EmberState.charMirror` every `SNAPSHOT_EVERY` ticks
 *  (FIX-4) so an eviction never loses more than that mirror's own staleness window. */
interface CharSession {
  character: SavedCharacter;
  /** Wall-clock ms this session started (or last saved) — playMs accrual. Wall-clock is
   *  fine here (not simulation time): see AGENTS.md's `updatedAt`/`playMs` exception. */
  sessionStartedAt: number;
}

export abstract class EmberRoomBase extends IoArenaRoom<EmberState> {
  protected readonly codec = EmberSchema;
  protected override tickMs = TICK_MS;

  /** The zone this room instance serves — geometry, mob camps, spawn/portal points. */
  protected abstract readonly zone: ZoneData;

  protected override aoi = {
    viewRadius: AOI_VIEW_RADIUS,
    mapFields: ["units"],
    position: (e: unknown) => e as { x: number; y: number },
    viewer: (s: EmberState, id: string) => s.units[id] ?? null,
    tiers: AOI_TIERS as unknown as { radius: number; interval: number }[],
  };

  /** D1 handle for character persistence — see this file's docblock. `null` (the
   *  default outside a real Worker) disables persistence entirely and preserves exact
   *  M1 join behavior; tests override this field directly before connecting a client. */
  protected db: D1Database | null = (workerEnv as Partial<{ DB: D1Database }>).DB ?? null;

  private engine!: RpgEngine;
  /** Engine-clock base; bumped to the snapshot's `nowMs` on restore so time never rewinds. */
  private clockBaseMs = 0;
  /** playerId -> click-to-move destination; consumed a step per tick until reached. */
  private readonly moveDest = new Map<string, { x: number; y: number }>();
  /** playerId -> selected class (in-memory only in M1; D1-backed for a loaded character). */
  private readonly classById = new Map<string, EmberClass>();
  /** monster slot id -> where/what to respawn (built once from `this.zone`'s spawn tables). */
  private readonly slotHome = new Map<string, SlotHome>();
  /** monster slot id -> simulation tick at which it re-spawns after death. */
  private readonly respawnAt = new Map<string, number>();
  /** `zone.obstacles` cached as `@tikron/sim` AABBs (built once; obstacles are static). */
  private obstacles: Obstacle[] = [];
  /** clientId -> character session, for every seated player with a loaded character. */
  private readonly charByClient = new Map<string, CharSession>();
  /** Loot roll stream — see the `LOOT_SEED` docblock above. */
  private readonly lootRng = makeRng(LOOT_SEED);

  /** Absolute monotonic engine time for the current tick (drives every engine call). */
  private now(): number {
    return this.clockBaseMs + this.currentTick * TICK_MS;
  }

  protected override onReady(): void {
    // Click-to-move (event-driven) plus casts/attacks stay well under this; the headroom
    // over the default 30 absorbs a burst of hotbar inputs (mirrors mmo-room.ts).
    this.maxInputsPerSecond = 60;
    this.setState({ units: {}, engine: null, charSessions: {}, charMirror: {} });

    this.obstacles = this.zone.obstacles.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    this.engine = new RpgEngine(EMBERFALL_CONTENT, { seed: ENGINE_SEED, pvpEnabled: false });
    this.registerCustomEffects();
    this.spawnZoneMobs();
    this.syncUnits();
    this.state.engine = this.engine.serialize();

    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("cast", (client, payload) => this.handleCast(client, payload));
    this.onMessage("stopCast", (client) => this.handleStopCast(client));
    this.onMessage("attack", (client, payload) => this.handleAttack(client, payload));
    this.onMessage("respawn", (client) => this.handleRespawn(client));
    this.onMessage("selectClass", (client, payload) => this.handleSelectClass(client, payload));

    this.registerZoneIntents();
    this.registerInventoryIntents();
  }

  /** Extension point — override in a zone subclass. See this file's top docblock. */
  protected registerZoneIntents(): void {}

  /** Extension point — see docblock. Every handler no-ops (silently) on a missing
   *  character session (persistence disabled, or unauthenticated) or a malformed
   *  payload, matching the base's other intent handlers (`handleMove`/`handleCast`/…).
   *  Every mutation resends `"inv"` to the acting client only (never broadcast/synced —
   *  PLAN-EMBERFALL-M2 §7's "shooter ammo" pattern). */
  protected registerInventoryIntents(): void {
    this.onMessage("equip", (client, payload) => this.handleEquip(client, payload));
    this.onMessage("unequip", (client, payload) => this.handleUnequip(client, payload));
    this.onMessage("useItem", (client, payload) => this.handleUseItem(client, payload));
    this.onMessage("buy", (client, payload) => this.handleBuy(client, payload));
    this.onMessage("sell", (client, payload) => this.handleSell(client, payload));
    this.onMessage("moveItem", (client, payload) => this.handleMoveItem(client, payload));
  }

  private handleEquip(client: Client, payload: unknown): void {
    const session = this.charByClient.get(client.id);
    if (!session || typeof payload !== "object" || payload === null) return;
    const slotIndex = (payload as { slotIndex?: unknown }).slotIndex;
    if (typeof slotIndex !== "number") return;
    const result = equipItem(session.character.inventory, session.character.equipment, slotIndex, ITEMS, session.character.level);
    if (!result.ok) return;
    session.character = { ...session.character, inventory: result.inventory, equipment: result.equipment };
    this.engine.setEquipmentModifiers(client.id, "gear:" + result.slot, toEngineModifiers(result.modifiers));
    this.sendInventory(client);
  }

  private handleUnequip(client: Client, payload: unknown): void {
    const session = this.charByClient.get(client.id);
    if (!session || typeof payload !== "object" || payload === null) return;
    const slot = (payload as { slot?: unknown }).slot;
    if (!isEquipSlot(slot)) return;
    const result = unequipItem(session.character.inventory, session.character.equipment, slot, ITEMS);
    if (!result.ok) return;
    session.character = { ...session.character, inventory: result.inventory, equipment: result.equipment };
    this.engine.setEquipmentModifiers(client.id, "gear:" + slot, null);
    this.sendInventory(client);
  }

  private handleUseItem(client: Client, payload: unknown): void {
    const session = this.charByClient.get(client.id);
    if (!session || typeof payload !== "object" || payload === null) return;
    const unit = this.engine.getUnit(client.id);
    // FIX-3: no potion self-revive — a dead unit can't use a consumable at all (matches
    // this file's other combat handlers' `!me.alive` gate); only `handleRespawn` revives.
    if (!unit || !unit.alive) return;
    const slotIndex = (payload as { slotIndex?: unknown }).slotIndex;
    if (typeof slotIndex !== "number") return;
    const result = useConsumable(session.character.inventory, slotIndex, ITEMS);
    if (!result.ok) return;
    session.character = { ...session.character, inventory: result.inventory };
    if (result.heal.hp > 0 || result.heal.mp > 0) {
      // No public "add hp/mp" engine API — `resurrect` (percent-of-max, then clamped) is
      // the one exposed primitive that sets current pools directly (see this file's top
      // docblock / rpg README). Converting the post-heal absolute value to a percentage
      // of the CURRENT maxHp/maxMp before calling it reproduces a flat +N heal exactly.
      const hpPct = clamp(((unit.hp + result.heal.hp) / unit.maxHp) * 100, 0, 100);
      const mpPct = clamp(((unit.mp + result.heal.mp) / unit.maxMp) * 100, 0, 100);
      this.engine.resurrect(client.id, { hpPct, mpPct }, this.now());
    }
    this.sendInventory(client);
  }

  private handleBuy(client: Client, payload: unknown): void {
    const session = this.charByClient.get(client.id);
    if (!session || typeof payload !== "object" || payload === null) return;
    const { defId, qty } = payload as { defId?: unknown; qty?: unknown };
    if (typeof defId !== "string" || typeof qty !== "number") return;
    const result = buyItem(session.character.inventory, session.character.gold, defId, qty, ITEMS, SHOP_ITEM_IDS, session.character.level);
    if (!result.ok) return;
    session.character = { ...session.character, inventory: result.inventory, gold: result.gold };
    this.sendInventory(client);
  }

  private handleSell(client: Client, payload: unknown): void {
    const session = this.charByClient.get(client.id);
    if (!session || typeof payload !== "object" || payload === null) return;
    const { slotIndex, qty } = payload as { slotIndex?: unknown; qty?: unknown };
    if (typeof slotIndex !== "number" || typeof qty !== "number") return;
    const result = sellItem(session.character.inventory, session.character.gold, slotIndex, qty, ITEMS);
    if (!result.ok) return;
    session.character = { ...session.character, inventory: result.inventory, gold: result.gold };
    this.sendInventory(client);
  }

  private handleMoveItem(client: Client, payload: unknown): void {
    const session = this.charByClient.get(client.id);
    if (!session || typeof payload !== "object" || payload === null) return;
    const { from, to } = payload as { from?: unknown; to?: unknown };
    if (typeof from !== "number" || typeof to !== "number") return;
    const result = moveItem(session.character.inventory, from, to, ITEMS);
    if (!result.ok) return;
    session.character = { ...session.character, inventory: result.inventory };
    this.sendInventory(client);
  }

  /** `{ inventory, equipment, gold }` — PLAN-EMBERFALL-M2 §7's owner-only sync. */
  private inventoryPayload(session: CharSession): { inventory: SavedCharacter["inventory"]; equipment: SavedCharacter["equipment"]; gold: number } {
    return { inventory: session.character.inventory, equipment: session.character.equipment, gold: session.character.gold };
  }

  private sendInventory(client: Client): void {
    const session = this.charByClient.get(client.id);
    if (session) client.send("inv", this.inventoryPayload(session));
  }

  /** Same as {@link sendInventory}, but for a `clientId` with no `Client` handle in
   *  scope (the mob-death loot hook only has the killer's id from a `CombatEvent`). */
  private sendInventoryTo(clientId: string): void {
    const session = this.charByClient.get(clientId);
    if (!session) return;
    this.sendTo(clientId, "inv", this.inventoryPayload(session));
  }

  /** Send a developer message to one `clientId` by id, when a `Client` handle isn't
   *  already in scope (a no-op if that client isn't currently connected). */
  private sendTo(clientId: string, type: string, payload?: unknown): void {
    const client = this.clientList().find((c) => c.id === clientId);
    if (client) client.send(type, payload);
  }

  // A cold start restored `this.state` (units + persisted engine snapshot + char
  // session set/mirror). Rebuild the live engine + char-session bookkeeping from it —
  // onReady already ran against a fresh engine/empty state (and populated `slotHome`, which is
  // deterministic zone data so it needs no rebuilding here).
  protected override onRestore(): void {
    const snap = this.state.engine;
    if (snap) {
      this.engine = RpgEngine.restore(EMBERFALL_CONTENT, snap);
      this.clockBaseMs = snap.nowMs; // resume the engine clock past the eviction gap
      this.registerCustomEffects(); // custom effect handlers are never serialized (README)
    }
    // Slots that died + were reaped before the eviction are gone from the engine;
    // schedule a prompt respawn so the world refills.
    for (const slotId of this.slotHome.keys()) {
      if (!this.engine.getUnit(slotId) && !this.respawnAt.has(slotId)) {
        this.respawnAt.set(slotId, this.currentTick + 1);
      }
    }
    // Re-derive char-session bookkeeping (§5: "재로드 on reattach"). A reattaching
    // client goes through `onReconnect`, never `onJoin` again, so without this a
    // restored room would silently stop saving every previously-seated character.
    if (this.db) void this.rehydrateCharSessions(this.state.charSessions);
    this.syncUnits();
  }

  /** Re-derive `charByClient` after a cold start from `charSessions` (the SET of client
   *  ids that had a loaded character), overlaying each with `charMirror`'s DO-storage-
   *  fresh gold/inventory/equipment/xp when present (FIX-4) — the D1 row itself can be
   *  up to 60s stale (`SAVE_EVERY_TICKS`), or even skipped by `saveCharacterForSession`'s
   *  optimistic concurrency, so the mirror is the more current source whenever both
   *  exist. A clientId with no mirror entry (e.g. a join that landed right before the
   *  first SNAPSHOT_EVERY tick) just restores straight from D1. */
  private async rehydrateCharSessions(charSessions: Record<string, true>): Promise<void> {
    const db = this.db;
    if (!db) return;
    for (const clientId of Object.keys(charSessions)) {
      const character = await persist.loadCharacterBySession(db, clientId);
      if (!character) continue;
      const mirror = this.state.charMirror[clientId];
      const restored = mirror ? { ...character, ...mirror } : character;
      this.charByClient.set(clientId, { character: restored, sessionStartedAt: Date.now() });
    }
  }

  override onJoin(client: Client): void | Promise<void> {
    if (!this.db) {
      // M1 fallback (see this file's docblock) — no persistence configured.
      this.spawnPlayerUnit(client.id, "warrior", { ...this.zone.playerSpawn });
      this.classById.set(client.id, "warrior");
      this.writeUnit(client.id);
      this.markStateChanged();
      return;
    }
    return this.joinWithCharacter(client);
  }

  private async joinWithCharacter(client: Client): Promise<void> {
    const db = this.db;
    if (!db) return; // narrowed for TS; unreachable (caller already checked)
    // `client.id` is the Tikron session key, which `index.ts`'s `charOnAuth` already
    // CAS-claimed onto this exact character before this seat was granted (see this
    // file's top docblock) — the raw save token never reaches this Room subclass.
    const character = await persist.loadCharacterBySession(db, client.id);
    if (!character) {
      // No hard-close is available from a Room subclass (see docblock) — this leaves
      // the client seated but unable to act: every intent handler below requires an
      // engine unit that was never spawned. Production additionally rejects this
      // connection before it ever reaches here via `index.ts`'s `onAuth`.
      client.send("charError", { code: "not_found" });
      return;
    }
    this.charByClient.set(client.id, { character, sessionStartedAt: Date.now() });
    this.state.charSessions[client.id] = true;
    this.mirrorChar(client.id);
    this.classById.set(client.id, character.class);
    this.spawnFromCharacter(client.id, character);
    this.writeUnit(client.id);
    this.markStateChanged();
  }

  /** Spawn `id`'s engine unit from a loaded `SavedCharacter`: class/level/weapon/stats,
   *  then restore position + hp/mp via one `resurrect()` call (the only supported
   *  engine API for setting an already-spawned unit's current pool without re-deriving
   *  stat math here). If the character's saved zone doesn't match THIS room's zone
   *  (stale save, or the M2 client hasn't matched rooms to zones yet), spawn at this
   *  zone's own spawn point instead of the saved (possibly out-of-bounds) coordinates —
   *  hp/mp/level/xp still restore normally. XP-within-level does not carry over
   *  exactly: `RpgEngine.spawnPlayer` takes `level` directly (immediate, no spurious
   *  events) but has no `xp` param, and `grantXp` would replay every intermediate
   *  level-up's events on every reconnect — an engine-contract change (out of scope:
   *  "엔진 계약 불변") would be needed to restore xp-within-level exactly. */
  private spawnFromCharacter(id: string, character: SavedCharacter): void {
    const inThisZone = character.zone === this.zone.id;
    const pos = inThisZone
      ? { x: clamp(character.x, 0, this.zone.width), y: clamp(character.y, 0, this.zone.height) }
      : { ...this.zone.playerSpawn };
    this.engine.spawnPlayer({
      id,
      pos,
      level: clamp(Math.round(character.level), 1, 15),
      faction: "players",
      weapon: CLASS_WEAPON[character.class],
      stats: CLASS_STATS[character.class],
    });
    // Apply equipment modifiers BEFORE reading maxHp/maxMp for the hp%/mp% restore below
    // — that way the % is computed against the character's true (geared) pool sizes, so
    // a heavily-geared reconnect restores the exact saved absolute hp/mp rather than
    // clamping to a lower no-gear ceiling (`setEquipmentModifiers` itself never tops up
    // current pools — rpg README gotcha — so this ordering is the only lever available).
    for (const slot of ["weapon", "armor", "trinket"] as const) {
      const item = character.equipment[slot];
      const def = item ? ITEMS[item.defId] : undefined;
      this.engine.setEquipmentModifiers(id, "gear:" + slot, def ? toEngineModifiers(def.modifiers ?? []) : null);
    }
    const unit = this.engine.getUnit(id);
    if (unit) {
      const hpPct = clamp((character.hp / unit.maxHp) * 100, 0, 100);
      const mpPct = clamp((character.mp / unit.maxMp) * 100, 0, 100);
      this.engine.resurrect(id, { hpPct, mpPct, pos }, this.now());
    }
  }

  // The preset holds a dropped seat for its reconnection window; this runs only once
  // that window truly lapses — the room's actual session-end path (see
  // `persist.releaseSession`'s docblock on why the release belongs here).
  protected override onSeatExpired(client: Client): void | Promise<void> {
    const session = this.charByClient.get(client.id);
    this.engine.removeUnit(client.id);
    delete this.state.units[client.id];
    this.moveDest.delete(client.id);
    this.classById.delete(client.id);
    this.charByClient.delete(client.id);
    delete this.state.charSessions[client.id];
    delete this.state.charMirror[client.id];
    this.markStateChanged();
    if (!session || !this.db) return;
    const db = this.db;
    const clientId = client.id;
    return this.persistSession(session, clientId).then(() => persist.releaseSession(db, clientId));
  }

  /** Force an immediate save for `clientId`'s character — the hook a zone subclass's
   *  `registerZoneIntents()` should call right before disconnecting a player for a
   *  portal/zone transfer, so the destination room's `onJoin` loads fresh data. No-op
   *  if the client has no loaded character (persistence disabled, or never authenticated). */
  protected async saveNow(clientId: string): Promise<void> {
    const session = this.charByClient.get(clientId);
    if (!session || !this.db) return;
    await this.persistSession(session, clientId);
  }

  /** Build a `SavedCharacter` from the session's cached data + the live engine unit
   *  (falling back to the cached snapshot's own fields when the unit is already gone,
   *  e.g. a save racing a seat-expiry cleanup), normalize dungeon zones to the village
   *  safe spawn, and write it to D1 — skipping the write (FIX-2's optimistic
   *  concurrency) if `clientId`'s session claim has since been superseded. */
  private async persistSession(session: CharSession, clientId: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    const unit = this.engine.getUnit(clientId);
    const now = Date.now();
    const elapsedMs = Math.max(0, now - session.sessionStartedAt);

    const inDungeon = this.zone.id === "ember-depths";
    const zone: SavedZone = inDungeon ? SAFE_ZONE : (this.zone.id as SavedZone);
    const pos = inDungeon ? { ...SAFE_SPAWN } : unit ? { x: unit.pos.x, y: unit.pos.y } : { x: session.character.x, y: session.character.y };

    const updated: SavedCharacter = {
      ...session.character,
      level: unit ? clamp(Math.round(unit.level), 1, 15) : session.character.level,
      // xp is accumulated from `xpGained` events (trackXpEvents), not read off `unit`
      // — `UnitView` doesn't expose cumulative xp. `session.character.xp` is already
      // current.
      zone,
      x: pos.x,
      y: pos.y,
      hp: unit ? Math.round(unit.hp) : session.character.hp,
      mp: unit ? Math.round(unit.mp) : session.character.mp,
      playMs: session.character.playMs + elapsedMs,
      updatedAt: now,
    };

    const ok = await persist.saveCharacterForSession(db, clientId, updated);
    if (!ok) return; // stale claim (FIX-2) — a newer session owns this row now; skip, don't clobber it
    session.character = updated;
    session.sessionStartedAt = now;
  }

  /** Save every seated player's character (PLAN §5's 60s dirty interval — Wave A
   *  always-saves rather than tracking a true dirty flag; see docblock). Fire-and-forget
   *  from `onTick` (a D1 write must never block the simulation tick). */
  private saveAllDue(): void {
    if (!this.db) return;
    for (const [clientId, session] of this.charByClient) {
      void this.persistSession(session, clientId).catch(() => {
        // Best-effort, matching platform-reporter.ts's occupancy-report pattern: a
        // failed save just means the NEXT 60s tick (or onLeave/saveNow) retries it.
      });
    }
  }

  /** Refresh `clientId`'s non-codec DO-storage mirror (FIX-4 — see `EmberState.charMirror`'s
   *  docblock). No-op for a clientId with no loaded character. */
  private mirrorChar(clientId: string): void {
    const session = this.charByClient.get(clientId);
    if (!session) return;
    this.state.charMirror[clientId] = {
      gold: session.character.gold,
      xp: session.character.xp,
      inventory: session.character.inventory,
      equipment: session.character.equipment,
    };
  }

  /** {@link mirrorChar} for every currently-seated character — called every
   *  `SNAPSHOT_EVERY` ticks alongside the engine snapshot (`onTick`). */
  private mirrorAllChars(): void {
    for (const clientId of this.charByClient.keys()) this.mirrorChar(clientId);
  }

  protected override onTick(): void {
    const now = this.now();
    this.stepMovement();
    const events = this.engine.tick(now);
    // reap/respawn run AFTER this tick's flush, so their unitRemoved/unitSpawned events
    // land in the engine's next-tick buffer (same accepted trade-off as mmo-room.ts: the
    // authoritative removal/spawn is already mirrored into this.state below).
    this.reapDeadNpcs(events);
    this.processRespawns();
    this.trackXpEvents(events);
    this.syncUnits();
    if (this.currentTick % SNAPSHOT_EVERY === 0) {
      this.state.engine = this.engine.serialize();
      this.mirrorAllChars(); // FIX-4: keep charMirror within ~SNAPSHOT_EVERY of live, not 60s
    }
    if (this.currentTick % SAVE_EVERY_TICKS === 0) this.saveAllDue();
    if (events.length > 0) this.broadcastCombatEvents(events);
    // The IoArenaRoom preset flushes state (markStateChanged) after onTick returns.
  }

  // --- intents (validate every payload; act on the engine's view) --------------------

  private handleMove(client: Client, payload: unknown): void {
    const me = this.engine.getUnit(client.id);
    if (!me || !me.alive || !isVec2(payload)) return;
    const dest = { x: clamp(payload.x, 0, this.zone.width), y: clamp(payload.y, 0, this.zone.height) };
    if (me.casting) this.engine.stopCast(client.id, this.now()); // a move cancels a cast
    this.moveDest.set(client.id, dest);
  }

  private handleCast(client: Client, payload: unknown): void {
    const me = this.engine.getUnit(client.id);
    if (!me || !me.alive || typeof payload !== "object" || payload === null) return;
    const skillId = (payload as { skillId?: unknown }).skillId;
    if (typeof skillId !== "string") return;
    if (me.kind === "player") {
      const cls = this.classById.get(client.id);
      if (!cls || !isSkillUnlocked(cls, me.level, skillId)) return; // off-hotbar or not yet unlocked
    }
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
    this.engine.resurrect(client.id, { hpPct: 50, mpPct: 50, pos: { ...this.zone.playerSpawn } }, this.now());
  }

  private handleSelectClass(client: Client, payload: unknown): void {
    if (typeof payload !== "object" || payload === null) return;
    const cls = (payload as { class?: unknown }).class;
    if (!isEmberClass(cls)) return;
    const existing = this.engine.getUnit(client.id);
    const pos = existing ? { x: existing.pos.x, y: existing.pos.y } : { ...this.zone.playerSpawn };
    this.engine.removeUnit(client.id); // no-op if not yet spawned
    this.spawnPlayerUnit(client.id, cls, pos);
    this.classById.set(client.id, cls);
    this.moveDest.delete(client.id);
    this.writeUnit(client.id);
    this.markStateChanged();
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

  // --- custom effects (registered fresh after every construction/restore) ------------

  private registerCustomEffects(): void {
    // "부활" (cleric-resurrection): the engine has no built-in revive effect kind, so this
    // is the `custom` extension point. `resolveInitialTarget`'s "friendly" branch never
    // checks `alive`, so a dead ally is a legal cast target here.
    this.engine.registerCustomEffect("resurrect-ally", (engine, ctx, _caster, target) => {
      const unit = target.unit;
      if (!unit || unit.alive) return;
      engine.resurrect(unit.id, { hpPct: 50, mpPct: 50 }, ctx.now);
    });
  }

  // --- player spawn/class -------------------------------------------------------------

  private spawnPlayerUnit(id: string, cls: EmberClass, pos: { x: number; y: number }): void {
    this.engine.spawnPlayer({ id, pos, faction: "players", weapon: CLASS_WEAPON[cls], stats: CLASS_STATS[cls] });
  }

  // --- simulation helpers ------------------------------------------------------------

  /** Advance each click-to-move player one step toward its destination, clamped to obstacles. */
  private stepMovement(): void {
    for (const [id, dest] of this.moveDest) {
      const u = this.engine.getUnit(id);
      if (!u || !u.alive) {
        this.moveDest.delete(id);
        continue;
      }
      // Stand still to cast; hold the destination through CC (rooted/stunned/sleeping).
      // `canMove` is a live scan on the engine's current buffs — read fresh each tick.
      if (u.casting || !u.canMove) continue;
      const speed = MOVE_SPEED * (u.moveSpeedMul / 100);
      const stepped = stepToward(u.pos, dest, speed, TICK_MS);
      const next = pushOutOfObstacles(stepped, PLAYER_RADIUS, this.obstacles);
      if (next.x === u.pos.x && next.y === u.pos.y) {
        this.moveDest.delete(id); // already there (or blocked to a standstill)
        continue;
      }
      const facing = Math.atan2(next.y - u.pos.y, next.x - u.pos.x);
      this.engine.moveUnit(id, next, facing);
      if (Math.hypot(dest.x - next.x, dest.y - next.y) <= 0.1) this.moveDest.delete(id);
    }
  }

  /** Zone-defined mob camps + the field boss, spawned once at room startup. */
  private spawnZoneMobs(): void {
    for (const camp of this.zone.mobCamps) {
      for (let i = 0; i < camp.count; i++) {
        const slotId = `${camp.id}#${i}`;
        const pos = this.scatterPos(camp.home, i, camp.count);
        this.slotHome.set(slotId, { pos, npcDefId: camp.npcDefId, respawnMs: camp.respawnMs });
        this.engine.spawnNpc(camp.npcDefId, pos, { id: slotId, home: pos });
      }
    }
    const boss = this.zone.fieldBoss;
    if (boss) {
      const slotId = `boss:${boss.npcDefId}`;
      this.slotHome.set(slotId, { pos: boss.pos, npcDefId: boss.npcDefId, respawnMs: boss.respawnMs });
      this.engine.spawnNpc(boss.npcDefId, boss.pos, { id: slotId, home: boss.pos });
    }
  }

  /** Scatter camp members in a small ring around `home` so they don't stack exactly. */
  private scatterPos(home: { x: number; y: number }, index: number, count: number): { x: number; y: number } {
    if (count <= 1) return { x: home.x, y: home.y };
    const angle = (index / count) * Math.PI * 2;
    const r = 3;
    return { x: home.x + Math.cos(angle) * r, y: home.y + Math.sin(angle) * r };
  }

  /** Reap dead NPCs (players stay dead for the respawn intent); slot NPCs schedule a
   *  respawn and roll loot for their killer. */
  private reapDeadNpcs(events: readonly CombatEvent[]): void {
    for (const ev of events) {
      if (ev.t !== "death") continue;
      const u = this.engine.getUnit(ev.unit);
      if (!u || u.kind !== "npc") continue;
      const home = this.slotHome.get(ev.unit);
      if (home) {
        this.respawnAt.set(ev.unit, this.currentTick + Math.ceil(home.respawnMs / TICK_MS));
        if (ev.killer) this.grantLoot(ev.killer, home.npcDefId);
      }
      this.engine.removeUnit(ev.unit); // clear the corpse; a slot refills on its timer
    }
  }

  /** Roll `npcDefId`'s loot table into `killerId`'s inventory/gold (PLAN §3: "킬 시
   *  서버가 굴려 킬러 인벤에 지급... M2: 킬러 개인 드랍"). No-op for a killer with no
   *  loaded character (M1 fallback / unauthenticated) — same "absent -> no-op" contract
   *  every other character hook here follows. Items that don't fit are dropped (still
   *  silently — no floor-drop, PLAN §3), but FIX-5 lets the killer know: a `"lootOverflow"`
   *  message reports how many units didn't fit, instead of a completely silent loss. */
  private grantLoot(killerId: string, npcDefId: string): void {
    const session = this.charByClient.get(killerId);
    if (!session) return;
    const loot = rollLoot(npcDefId, this.lootRng.next);
    if (loot.gold === 0 && loot.items.length === 0) return;
    let inventory = session.character.inventory;
    let overflow = 0;
    for (const drop of loot.items) {
      const result = addItem(inventory, drop.defId, drop.qty, ITEMS);
      inventory = result.inventory;
      overflow += result.overflow;
    }
    session.character = { ...session.character, inventory, gold: session.character.gold + loot.gold };
    this.sendInventoryTo(killerId);
    if (overflow > 0) this.sendTo(killerId, "lootOverflow", { overflow });
  }

  /** Accumulate `xpGained` events into each loaded character's running total.
   *  `UnitView` doesn't expose cumulative `xp` (it's an internal engine field), so this
   *  event stream is the only way to keep `SavedCharacter.xp` current without reaching
   *  into engine internals — same "derive persisted state from CombatEvent" approach
   *  `net.ts`'s `+N xp` floating text already uses client-side. */
  private trackXpEvents(events: readonly CombatEvent[]): void {
    for (const ev of events) {
      if (ev.t !== "xpGained") continue;
      const session = this.charByClient.get(ev.unit);
      if (session) session.character.xp += ev.amount;
    }
  }

  /** Re-spawn any monster slot whose respawn tick has arrived. */
  private processRespawns(): void {
    for (const [slotId, dueTick] of this.respawnAt) {
      if (this.currentTick < dueTick) continue;
      this.respawnAt.delete(slotId);
      const home = this.slotHome.get(slotId);
      if (!home || this.engine.getUnit(slotId)) continue;
      this.engine.spawnNpc(home.npcDefId, home.pos, { id: slotId, home: home.pos });
    }
  }

  // --- combat event routing (AOI-filtered via sendNear; death/levelUp are global) ----

  private posOf(id: string): { x: number; y: number } | undefined {
    const u = this.engine.getUnit(id);
    return u ? { x: u.pos.x, y: u.pos.y } : undefined;
  }

  /** Resolve an anchor position + the ids that should always receive an event regardless of AOI. */
  private routeFor(ev: CombatEvent): { pos?: { x: number; y: number }; always?: string[] } {
    switch (ev.t) {
      case "skillStarted":
      case "skillFired":
      case "skillEnded":
      case "castStopped":
        return { pos: this.posOf(ev.caster) };
      case "damaged":
      case "healed":
      case "manaBurned":
        return { pos: this.posOf(ev.target) ?? this.posOf(ev.source), always: [ev.source, ev.target] };
      case "buffAdded":
      case "buffRefreshed":
      case "buffRemoved":
        return { pos: this.posOf(ev.target) };
      case "unitPoints":
      case "combatEngaged":
      case "combatCleared":
      case "resurrected":
      case "xpGained":
        return { pos: this.posOf(ev.unit), always: [ev.unit] };
      case "knockback":
        return { pos: ev.to };
      case "unitMoved":
        return { pos: ev.pos };
      case "unitSpawned":
        return { pos: ev.pos };
      case "unitRemoved":
      case "aiTargetChanged":
        return { pos: this.posOf(ev.unit) };
      case "custom":
        return { pos: this.posOf(ev.source), always: ev.target ? [ev.source, ev.target] : [ev.source] };
      default:
        return {};
    }
  }

  /**
   * Relay one tick's combat events. `death`/`levelUp` are always full-room broadcasts
   * (PLAN §3: "sendNear ... always for global ones"); everything else routes through
   * `sendNear`, AOI-filtered around the acting unit, falling back to a full broadcast
   * when no position can be resolved (e.g. a unit reaped in an earlier tick).
   */
  private broadcastCombatEvents(events: readonly CombatEvent[]): void {
    for (const ev of events) {
      if (ev.t === "death" || ev.t === "levelUp") {
        this.broadcast("combat", [ev]);
        continue;
      }
      const { pos, always } = this.routeFor(ev);
      if (!pos) {
        this.broadcast("combat", [ev]);
        continue;
      }
      this.sendNear("combat", [ev], pos.x, pos.y, { always });
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

  private viewToUnit(u: UnitView): EmberUnit {
    const cast = u.casting;
    const kind: EmberUnit["kind"] = u.kind === "player" ? "player" : (u.npcDefId as EmberUnit["kind"]);
    const gear = u.kind === "player" ? this.gearVisual(u.id) : { weapon: "", armor: "" };
    return {
      x: clamp(u.pos.x, 0, MAP),
      y: clamp(u.pos.y, 0, MAP),
      facing: clamp(u.facing, -Math.PI, Math.PI),
      hp: u16(u.hp),
      maxHp: u16(u.maxHp),
      mp: u16(u.mp),
      maxMp: u16(u.maxMp),
      level: clamp(Math.round(u.level), 0, 255),
      class: u.kind === "player" ? (this.classById.get(u.id) ?? "warrior") : "none",
      kind,
      alive: u.alive,
      cast: cast ? cast.skillId : "",
      castEnd: cast ? cast.endsAt : 0,
      weapon: gear.weapon,
      armor: gear.armor,
    };
  }

  /** The loaded character's equipped weapon/armor `ItemDef.visual` id, or `""` when
   *  unequipped/unauthenticated (M1 fallback). Read from `CharSession.character`
   *  directly (not a separate map) — it's already the single source of truth for
   *  equipment, kept current by every inventory intent handler above. */
  private gearVisual(id: string): { weapon: string; armor: string } {
    const equipment = this.charByClient.get(id)?.character.equipment;
    if (!equipment) return { weapon: "", armor: "" };
    const weaponVisual = equipment.weapon ? (ITEMS[equipment.weapon.defId]?.visual ?? "") : "";
    const armorVisual = equipment.armor ? (ITEMS[equipment.armor.defId]?.visual ?? "") : "";
    return { weapon: weaponVisual, armor: armorVisual };
  }
}
