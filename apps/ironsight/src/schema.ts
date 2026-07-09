import { schema, mapOf, quant, enumOf, type Codec } from "@tikron/schema";
import { ARENA } from "./config.js";

/**
 * Binary state codec for the arena room — the wire contract shared by the server
 * and the client (W-B) / bots (W-C). Kept free of any `@tikron/server` import so a
 * browser bundle or a bot harness can `import { ArenaSchema }` without dragging in
 * Durable Object code.
 *
 * Continuous fields are quantized (the FPS bandwidth lever): positions ride on a
 * 2 cm grid (`u16`), angles on a ~0.001 rad grid (`u16`). Sub-step jitter drops
 * out of deltas entirely because `equals` compares the quantized bucket. The
 * position quant ranges MUST equal {@link ARENA} — a value outside the range
 * clamps to the edge, silently pinning a player to a wall.
 *
 * **Not in the wire state (server-authoritative, owner-reconciled instead):**
 * ammo/reserve (owner-only `ammo` events — other players never see your mag),
 * the reload clock, per-player velocity, and respawn timers. Projectiles are
 * never in state either: shots resolve server-side and emit a transient `shot`
 * event (standard hitscan practice), so there is no per-tick projectile sync.
 */
export interface ArenaPlayer {
  /** Horizontal position (ground plane). */
  x: number;
  z: number;
  /** Feet height above the ground plane (0 = on the floor). */
  y: number;
  /** Facing yaw (rad, 0 → +z). */
  yaw: number;
  /** Look pitch (rad, + = up); clamped to just inside ±π/2. */
  pitch: number;
  hp: number;
  /** 0 = red, 1 = blue (see {@link TEAM}). */
  team: number;
  alive: boolean;
  /** Crouched (lowers the capsule + head, slows movement). */
  crouch: boolean;
  /** Spawn-protected (brief invulnerability; cleared early by firing). */
  prot: boolean;
  /** Lifetime kills (scoreboard). */
  k: number;
  /** Lifetime deaths (scoreboard). */
  d: number;
  /** Held weapon — index into {@link WEAPONS} (0 = AR). Others render its viewmodel. */
  weapon: number;
  /** Grenades remaining. */
  nades: number;
}

export type MatchPhase = "live" | "ended" | "warmup";

export interface ArenaState {
  players: Record<string, ArenaPlayer>;
  /** Per-room PRNG seed (u32) — drives deterministic per-shot spread. */
  seed: number;
  /** Team scores (kills); reused as the point-capture score in "dom". */
  redScore: number;
  blueScore: number;
  /** "live" during a round, "ended" during the post-match intermission banner,
   * "warmup" while waiting for enough players before the round starts. */
  phase: MatchPhase;
  /** Server-clock epoch ms when the round's time limit expires (constant per round). */
  matchEndMs: number;
  /** Numeric wire encoding of the active game mode — see modes.ts's MODE_ORDER. */
  mode: number;
  /** Domination capture-point gauges (0..200, 100 = neutral, 0 = blue, 200 = red);
   * unused outside "dom". Appended after the M0/M1 fields for wire compatibility. */
  capA: number;
  capB: number;
  capC: number;
}

const PlayerSchema: Codec<ArenaPlayer> = schema({
  x: quant(0, ARENA.width, 0.02),
  z: quant(0, ARENA.depth, 0.02),
  y: quant(0, ARENA.ceiling, 0.02),
  yaw: quant(0, Math.PI * 2, 0.001),
  pitch: quant(-Math.PI / 2, Math.PI / 2, 0.001),
  hp: "u8",
  team: "u8",
  alive: "bool",
  crouch: "bool",
  prot: "bool",
  k: "u16",
  d: "u16",
  // Appended after the M0 fields so the existing wire layout is unchanged (positional
  // decode) — client and bots import this same codec, so the fingerprint stays in sync.
  weapon: "u8",
  nades: "u8",
});

export const ArenaSchema: Codec<ArenaState> = schema({
  players: mapOf(PlayerSchema),
  seed: "u32",
  redScore: "u16",
  blueScore: "u16",
  // "warmup" appended after the existing values — do not reorder, it would break
  // positional decoding on the wire.
  phase: enumOf("live", "ended", "warmup"),
  matchEndMs: "f64",
  // Appended after the M0/M1 fields so the existing wire layout is unchanged.
  mode: "u8",
  capA: "u8",
  capB: "u8",
  capC: "u8",
});
