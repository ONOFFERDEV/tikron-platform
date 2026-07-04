import { schema, mapOf, listOf, enumOf, quant, str, type Codec } from "@tikron/schema";
import type { RpgSnapshot } from "@tikron/rpg";

/**
 * Shared schema + constants for the MMORPG demo room. Kept free of any server
 * imports (and of the engine's runtime) so the browser client and tests can
 * import the codec and constants without pulling in Durable Object code.
 *
 * The demo integrates {@link @tikron/rpg} — a deterministic combat engine — behind
 * an {@link IoArenaRoom}. The engine owns all combat truth (skills, buffs, aggro,
 * damage, death, XP); the room mirrors each unit's *presentation* fields into this
 * synced state every tick and relays the engine's `CombatEvent[]` as a batched
 * `combat` developer message. Only the lean per-unit view below rides the wire.
 */

/** One combatant as the client sees it — presentation only, not the engine's truth. */
export interface MmoUnit {
  /** World position (quantized on a 0.05-unit grid over the map). */
  x: number;
  y: number;
  /** Facing angle in radians, -pi..pi (for sprite orientation). */
  facing: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  /**
   * Sprite/faction discriminator: `player` (friendly), `wolf` / `boss` (hostile
   * monsters). Derived from the engine unit's kind + npcDef, so it doubles as the
   * relation hint the client needs without a separate faction field.
   */
  kind: "player" | "wolf" | "boss";
  alive: boolean;
  /** Skill id currently being cast/channeled, or `""` when idle. */
  cast: string;
  /** Absolute engine-ms the cast/channel bar ends (0 when idle). */
  castEnd: number;
  /** Active buff ids (for icon rows); coalesced by the engine's buff container. */
  buffs: string[];
}

/**
 * The room's authoritative state. `units` is the only synced field (the codec below
 * encodes just that). `engine` carries the {@link RpgSnapshot} for eviction survival:
 * it rides in `this.state` so the preset's durable snapshot persists it, but it is
 * deliberately absent from the codec so it never touches the wire.
 */
export interface MmoState {
  units: Record<string, MmoUnit>;
  /** Persisted engine snapshot (DO storage only — never encoded). `null` until seeded. */
  engine: RpgSnapshot | null;
}

/** World size in game units (a small RPG-scale map: weapon ranges are 4-25). */
export const MAP = 120;

/**
 * Binary delta codec for the synced state. Only `units` is declared, so `engine`
 * (the persisted {@link RpgSnapshot}) is structurally ignored on the wire — the
 * server never decodes its own state, so the missing field is a server-only concern
 * that the DO-storage persist path (structuredClone, not the codec) round-trips.
 */
export const MmoSchema = schema({
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
      kind: enumOf("player", "wolf", "boss"),
      alive: "bool",
      cast: str(24),
      castEnd: "f64",
      buffs: listOf(str(24)),
    }),
  ),
}) as unknown as Codec<MmoState>;

/** Fixed simulation cadence (20 Hz). Drives the engine's `now = currentTick * TICK_MS`. */
export const TICK_MS = 50;

/** Where a player (re)spawns — a safe corner away from the wolf pack. */
export const PLAYER_SPAWN = { x: 30, y: 60 };

/** Base player move speed in units/second (scaled by the engine's `moveSpeedMul`). */
export const PLAYER_SPEED = 8;

/** One monster spawn point, re-populated by the room's respawn timer on death. */
export interface SpawnSlot {
  id: string;
  npcDef: "wolf" | "boss";
  pos: { x: number; y: number };
  /** Ms before this slot re-spawns after its occupant dies. */
  respawnMs: number;
}

/**
 * The demo's monster layout: a three-wolf pack (spaced so approaching one does not
 * aggro the others) plus a single boss in the far corner. Each entry keeps a stable
 * id so the room can re-spawn exactly that slot when its occupant dies.
 */
export const SPAWN_SLOTS: readonly SpawnSlot[] = [
  { id: "wolf-1", npcDef: "wolf", pos: { x: 62, y: 60 }, respawnMs: 8000 },
  { id: "wolf-2", npcDef: "wolf", pos: { x: 60, y: 90 }, respawnMs: 8000 },
  { id: "wolf-3", npcDef: "wolf", pos: { x: 90, y: 60 }, respawnMs: 8000 },
  { id: "boss-1", npcDef: "boss", pos: { x: 96, y: 96 }, respawnMs: 20000 },
];

/**
 * Player-castable skills, in hotbar order (client binds number keys 1-6 to these).
 * A deliberately class-less mix from the sample content pack so one demo character
 * shows off the whole surface: burst, cone AoE, a stun, a cast-time projectile with
 * a DoT, a self-centered root nova, and a heal. Every id is validated against this
 * set server-side, so a client can never cast an off-hotbar skill (e.g. a boss one).
 */
export const HOTBAR: readonly string[] = [
  "warrior-slash",
  "warrior-cleave",
  "warrior-bash",
  "mage-fireball",
  "mage-frost-nova",
  "healer-heal",
];

/** Fast membership check for hotbar validation. */
export const HOTBAR_SET: ReadonlySet<string> = new Set(HOTBAR);
