import { schema, mapOf, quant, str, enumOf, type Codec } from "@tikron/schema";
import type { RpgSnapshot } from "@tikron/rpg";
import type { EquipSlot, ItemInstance } from "../types.js";

/**
 * Shared schema + constants for Emberfall's zone rooms. No server imports — the
 * browser client and tests import the codec/constants without pulling in Durable
 * Object code (mirrors `apps/gateway/src/rooms/mmo-schema.ts`, the proven pattern this
 * app upgrades: real per-zone geometry, AOI with priority tiers, `sendNear`-routed
 * combat events instead of a full-room broadcast).
 */

/** One combatant as the client sees it — presentation only, mirrored from `UnitView` each tick. */
export interface EmberUnit {
  /** World position, quantized on a 0.05-unit grid over `[0, MAP]`. */
  x: number;
  y: number;
  /** Facing angle in radians, -pi..pi. */
  facing: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  /** Meaningful for players only; monsters carry `"none"`. */
  class: "warrior" | "mage" | "cleric" | "none";
  /** Sprite/model discriminator — `player`, or the monster species id from the content pack. */
  kind: "player" | "wolf" | "goblin_scout" | "goblin_thrower" | "boar" | "goblin_shaman" | "boss_chief";
  alive: boolean;
  /** Skill id currently being cast/channeled, or `""` when idle. */
  cast: string;
  /** Absolute engine-ms the cast/channel bar ends (0 when idle). */
  castEnd: number;
  /** Equipped weapon's `ItemDef.visual` logical id (client prop attachment), or `""` for
   *  the class default. Meaningful for players only — monsters carry `""`. */
  weapon: string;
  /** Equipped armor's `ItemDef.visual` logical id, or `""` for the class default. */
  armor: string;
}

/**
 * A zone room's authoritative state. `units` is the only synced field; `engine`,
 * `charSessions`, and `charMirror` carry DO-storage-only bookkeeping for eviction
 * survival — deliberately absent from the codec below so none of them ever touch the
 * wire (same trick as mmo-schema.ts).
 */
export interface EmberState {
  units: Record<string, EmberUnit>;
  engine: RpgSnapshot | null;
  /**
   * The set of clientIds (session keys — see `persist.ts`'s "Path F" docblock) with a
   * currently-seated, loaded character session. `onRestore` re-derives
   * `EmberRoomBase`'s in-memory char-session bookkeeping from this after a Durable
   * Object cold start (via `persist.loadCharacterBySession(db, clientId)`), since a
   * reattaching client goes through `onReconnect` (never `onJoin` again) and would
   * otherwise stop being periodically saved. Unlike its pre-SECFIX predecessor
   * (`charTokens`), this does NOT carry the raw save token — the room never has it
   * (only `index.ts`'s `charOnAuth` sees `?_auth=`) — so the value is just a presence
   * marker; the character itself is looked up by session id, not by token.
   */
  charSessions: Record<string, true>;
  /**
   * clientId -> the session-only fields the engine snapshot above doesn't capture
   * (gold/inventory/equipment/xp — see `CharSession`'s docblock in
   * `ember-room-base.ts`), refreshed every `SNAPSHOT_EVERY` ticks alongside `engine`
   * (PLAN-EMBERFALL-M2-SECFIX FIX-4). Without this, a DO eviction between D1's 60s
   * periodic-save checkpoints loses whatever gold/items/xp changed since the last one;
   * `onRestore`'s rehydrate prefers this (DO-storage-fresh) over the D1 row for any
   * clientId it already has an entry for.
   */
  charMirror: Record<string, { gold: number; xp: number; inventory: ItemInstance[]; equipment: Partial<Record<EquipSlot, ItemInstance>> }>;
}

/**
 * Wire coordinate ceiling shared by every zone room's codec. The largest zone (Ashen
 * Fields, 200×200) sets the bound; smaller zones (Village 60×60, Dungeon 120×120) just
 * use a fraction of the range. Gameplay bounds are each zone's own `width`/`height`
 * (see `zones/types.ts`) — rooms clamp movement against `this.zone`, not this constant.
 */
export const MAP = 200;

export const EmberSchema = schema({
  units: mapOf(
    schema({
      x: quant(0, MAP, 0.05),
      y: quant(0, MAP, 0.05),
      facing: quant(-Math.PI, Math.PI, 0.05),
      hp: "u16",
      maxHp: "u16",
      mp: "u16",
      maxMp: "u16",
      level: "u8",
      class: enumOf("warrior", "mage", "cleric", "none"),
      kind: enumOf("player", "wolf", "goblin_scout", "goblin_thrower", "boar", "goblin_shaman", "boss_chief"),
      alive: "bool",
      cast: str(24),
      castEnd: "f64",
      weapon: str(16),
      armor: str(16),
    }),
  ),
}) as unknown as Codec<EmberState>;

/** Fixed simulation cadence (20 Hz) — drives `now = clockBase + currentTick * TICK_MS`. */
export const TICK_MS = 50;

/** Base player click-to-move speed in units/second (scaled by the engine's `moveSpeedMul`). */
export const MOVE_SPEED = 8;

/** Push-out radius used for player-vs-obstacle collision (`@tikron/sim`'s `pushOutOfObstacles`). */
export const PLAYER_RADIUS = 0.5;

// --- intent payloads (client -> room developer messages) ---------------------------

/** `"move"` — click-to-move destination; clamped to the zone's bounds server-side. */
export interface MoveIntent {
  x: number;
  y: number;
}

/** A skill's cast target: a unit id, a ground point, or omitted (self/none). */
export type CastTargetIntent = { unitId: string } | { pos: { x: number; y: number } } | undefined;

/** `"cast"` — a hotbar skill id (validated against the caster's class + level) plus target. */
export interface CastIntent {
  skillId: string;
  target?: CastTargetIntent;
}

/** `"attack"` — start auto-attacking a hostile unit. */
export interface AttackIntent {
  unitId: string;
}

/** `"selectClass"` — (re)spawn the caller's player unit as the given class. */
export interface SelectClassIntent {
  class: "warrior" | "mage" | "cleric";
}
