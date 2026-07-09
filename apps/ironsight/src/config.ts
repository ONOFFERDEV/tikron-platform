/**
 * ironsight M0 tunables — every gameplay constant in one place.
 *
 * PLAN-IRONSIGHT §4 numbers live here (not sprinkled through the room) so that M4
 * ("config 추출 → gg 블루프린트 #2") can lift this module wholesale into a data-driven
 * template. The room reads these as its defaults; match-flow tunables are also
 * mirrored onto protected room fields so a test can subclass and shrink them
 * (e.g. `killTarget = 2`) without touching production values.
 *
 * ## Coordinate convention (three.js-style, shared with the client + bots)
 *
 * - **x** = arena width  (east),  range `[0, ARENA.width]`
 * - **z** = arena depth  (north), range `[0, ARENA.depth]`
 * - **y** = height (up),  ground plane at `y = 0`, range `[0, ARENA.ceiling]`
 *
 * The horizontal ground plane is therefore `(x, z)`; `y` is purely vertical
 * (jump/crouch/gravity). yaw is measured so that `yaw = 0` faces `+z` and
 * increasing yaw turns toward `+x`; pitch is positive looking up.
 */

/** Simulation rate — 20 Hz fixed timestep (PLAN §2: "서버 20Hz 틱"). */
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ; // 50

/** Arena extents. MUST stay in lock-step with the codec `quant` ranges (schema.ts). */
export const ARENA = {
  width: 60, // x
  depth: 40, // z
  ceiling: 16, // y (headroom cap for jumps / raised platforms)
} as const;

/** Player capsule + head sphere (metres). The hit volume the server raycasts. */
export const PLAYER = {
  radius: 0.4, // capsule radius (also the horizontal collision half-extent)
  standHeight: 1.8, // feet→crown standing
  crouchHeight: 1.1, // feet→crown crouched
  standEye: 1.65, // camera/muzzle height standing (feet-relative)
  crouchEye: 0.95, // camera/muzzle height crouched
  headRadius: 0.22, // head sphere radius (centre just under the crown)
  maxHp: 100,
} as const;

/** Movement model (server-integrated from WASD intents). */
export const MOVE = {
  walk: 6, // m/s ground speed
  sprint: 9, // m/s while sprinting (grounded, moving forward)
  crouch: 3, // m/s while crouched
  gravity: 20, // m/s² downward
  jumpSpeed: 7, // m/s initial upward (jump height ≈ v²/2g ≈ 1.22 m)
  maxDtMs: TICK_MS * 2, // integration dt clamp (a GC/tab-out hitch can't fling a player)
} as const;

/**
 * The AR (M0's only weapon). PLAN §4 damage: body 25 / head 50, 100 ms fire
 * interval, 30-round mag, 1.8 s reload. Spread widens while moving/airborne
 * (pinpoint when still + grounded, so still shots are deterministic).
 */
export const AR = {
  damageBody: 25,
  damageHead: 50,
  fireIntervalMs: 100, // server-enforced minimum between shots
  mag: 30,
  reserve: 90, // spare rounds (3 mags) available to reload from
  reloadMs: 1800,
  range: 100, // hitscan reach (metres) — covers the arena diagonal
  spreadStill: 0, // rad cone half-angle when still + grounded (pinpoint)
  spreadMove: 0.02, // added while moving on the ground
  spreadAir: 0.05, // added while airborne
} as const;

/** TDM match flow. */
export const MATCH = {
  maxClients: 12,
  killTarget: 50, // team score that ends the match
  timeLimitMs: 5 * 60_000, // …or 5 minutes, whichever first
  intermissionMs: 5_000, // "ended" banner window before the arena resets to "live"
  respawnMs: 3_000, // downed → respawn delay
  spawnProtectMs: 1_500, // post-spawn invulnerability (cleared early by firing)
} as const;

/** Server-side lag compensation (PLAN §2: hit judgement via server rewind). */
export const LAG = {
  depthMs: 200, // rewind history retention (peeker's-advantage ceiling)
  interpolationMs: 100, // extra rewind on top of RTT when a shot carries no subtick ts
} as const;

/** Teams. Index 0 = red, 1 = blue (u8 in the codec). */
export const TEAM = { red: 0, blue: 1 } as const;
export type TeamId = (typeof TEAM)[keyof typeof TEAM];
