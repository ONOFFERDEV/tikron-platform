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
 * Weapon data (PLAN §4 "무기 5+1"). Every weapon is one {@link WeaponSpec} row so
 * M4 ("config 추출") can lift the whole {@link WEAPONS} table into a data-driven
 * template — the room resolves a shot purely from the held weapon's spec, with no
 * per-weapon branching in the sim.
 *
 * ## Two independent spread channels
 *
 * - **accuracy cone** (`spreadStill/Move/Air`): a per-ray random jitter that widens
 *   while moving/airborne — the movement-vs-precision tension. Pinpoint (`0`) when
 *   still + grounded, so a stationary single-pellet shot is deterministic.
 * - **pellet pattern** (`pellets` > 1, `pelletSpread`): a FIXED deterministic cone
 *   the pellets fill on every trigger pull (the shotgun's spread). Being fixed, not
 *   random, it makes the shotgun's damage-by-distance reproducible and testable.
 *
 * ## Distance falloff (the shotgun/SMG balance lever)
 *
 * Damage is scaled by {@link WeaponSpec.falloffStart}/`falloffEnd`/`falloffMin`:
 * full within `falloffStart`, linearly down to `falloffMin×` past `falloffEnd`.
 * This is what stops any one weapon dominating every range (PLAN §5 gate): the SMG
 * and shotgun fall off a cliff past close range, the AR holds, the sniper never
 * falls off — so the best weapon differs per range band.
 */
export interface WeaponSpec {
  /** Loadout slot 1–5 (the `switch` intent's slot; wire `weapon` stores slot−1). */
  readonly slot: number;
  readonly name: string;
  readonly damageBody: number;
  readonly damageHead: number;
  /** Server-enforced minimum ms between trigger pulls (fire-rate cap). */
  readonly fireIntervalMs: number;
  readonly mag: number;
  /** Spare rounds available to reload from. */
  readonly reserve: number;
  readonly reloadMs: number;
  /** Hitscan reach (metres). */
  readonly range: number;
  /** Rays per trigger pull (1 for all but the shotgun). */
  readonly pellets: number;
  /** Fixed pellet-pattern cone half-angle (rad); 0 for single-ray weapons. */
  readonly pelletSpread: number;
  /** Accuracy cone half-angle (rad) when still + grounded. */
  readonly spreadStill: number;
  /** Added to the accuracy cone while moving on the ground. */
  readonly spreadMove: number;
  /** Added to the accuracy cone while airborne. */
  readonly spreadAir: number;
  /** Full damage within this range (m). */
  readonly falloffStart: number;
  /** Damage reaches `falloffMin×` at this range and holds (m). */
  readonly falloffEnd: number;
  /** Damage multiplier floor (0–1) past `falloffEnd`. */
  readonly falloffMin: number;
}

/** AR — the all-rounder baseline (PLAN §4: body 25 / head 50, 100 ms, 30-mag, 1.8 s). */
const AR_SPEC: WeaponSpec = {
  slot: 1,
  name: "AR",
  damageBody: 25,
  damageHead: 50,
  fireIntervalMs: 100,
  mag: 30,
  reserve: 90,
  reloadMs: 1800,
  range: 100,
  pellets: 1,
  pelletSpread: 0,
  spreadStill: 0,
  spreadMove: 0.02,
  spreadAir: 0.05,
  falloffStart: 30,
  falloffEnd: 65,
  falloffMin: 0.7,
};

/** SMG — higher close-range DPS, cliffs off past mid (owns the 15 m band). */
const SMG_SPEC: WeaponSpec = {
  slot: 2,
  name: "SMG",
  damageBody: 20,
  damageHead: 30,
  fireIntervalMs: 65,
  mag: 25,
  reserve: 100,
  reloadMs: 1600,
  range: 80,
  pellets: 1,
  pelletSpread: 0,
  spreadStill: 0.004,
  spreadMove: 0.03,
  spreadAir: 0.06,
  falloffStart: 16,
  falloffEnd: 36,
  falloffMin: 0.5,
};

/** Shotgun — 8 pellets: a point-blank one-shot that decays to nothing past ~20 m. */
const SHOTGUN_SPEC: WeaponSpec = {
  slot: 3,
  name: "Shotgun",
  damageBody: 14, // per pellet (× up to 8)
  damageHead: 20, // per pellet
  fireIntervalMs: 850,
  mag: 6,
  reserve: 24,
  reloadMs: 2800,
  range: 40,
  pellets: 8,
  pelletSpread: 0.055,
  spreadStill: 0,
  spreadMove: 0.02,
  spreadAir: 0.05,
  falloffStart: 6,
  falloffEnd: 22,
  falloffMin: 0.25,
};

/** Sniper — bolt-action: body chunk (2-shot), head one-shot, no falloff, huge move penalty. */
const SNIPER_SPEC: WeaponSpec = {
  slot: 4,
  name: "Sniper",
  damageBody: 80,
  damageHead: 150,
  fireIntervalMs: 1300,
  mag: 5,
  reserve: 20,
  reloadMs: 3000,
  range: 100,
  pellets: 1,
  pelletSpread: 0,
  spreadStill: 0.0005,
  spreadMove: 0.12, // punishing while moving — this is a stand-still weapon
  spreadAir: 0.2,
  falloffStart: 100, // ≥ range → full damage everywhere in reach
  falloffEnd: 101,
  falloffMin: 1,
};

/** Pistol — the reliable semi-auto sidearm every loadout carries (slot 5). */
const PISTOL_SPEC: WeaponSpec = {
  slot: 5,
  name: "Pistol",
  damageBody: 34,
  damageHead: 60,
  fireIntervalMs: 160,
  mag: 12,
  reserve: 48,
  reloadMs: 1400,
  range: 90,
  pellets: 1,
  pelletSpread: 0,
  spreadStill: 0.002,
  spreadMove: 0.02,
  spreadAir: 0.05,
  falloffStart: 20,
  falloffEnd: 45,
  falloffMin: 0.7,
};

/**
 * The weapon table, indexed by wire `weapon` value (0–4). The `switch` intent's
 * slot 1–5 maps to `WEAPONS[slot − 1]`. Everyone carries all five; the loadout's
 * `primary` selection only sets which one you SPAWN holding.
 */
export const WEAPONS: readonly WeaponSpec[] = [
  AR_SPEC,
  SMG_SPEC,
  SHOTGUN_SPEC,
  SNIPER_SPEC,
  PISTOL_SPEC,
];

/** Default spawn weapon (index into {@link WEAPONS}) when no primary is chosen. */
export const DEFAULT_WEAPON = 0; // AR
/** The pistol is always slot 5 / index 4; a primary choice can't be the pistol. */
export const PISTOL_INDEX = 4;

/**
 * The AR spec under its historical name. Kept so the client (`net.ts` reads the
 * fire cadence) and the M0 bots/tests (which model the AR loadout) import a stable
 * `AR` — every field they use lives on the spec.
 */
export const AR = AR_SPEC;

/** Weapon-handling tunables shared across all weapons. */
export const WEAPON = {
  /** Delay after a `switch` before the new weapon can fire (swap animation). */
  swapMs: 350,
} as const;

/**
 * Frag grenade (PLAN §4 "+수류탄"): a thrown projectile that arcs under gravity,
 * bounces off cover, and detonates on a fuse for a radial AoE. Deliberately NOT a
 * one-shot even at the blast centre (`maxDamage` < {@link PLAYER.maxHp}) — a direct
 * frag softens a group but still needs a follow-up (PLAN §5 balance: "직격+폭발이
 * 원샷 아님"). Self-damage is on, so a point-blank throw hurts the thrower too.
 */
export const GRENADE = {
  count: 2, // carried on (re)spawn
  fuseMs: 2500, // throw → detonation
  radius: 5, // AoE reach (m)
  maxDamage: 90, // at the blast centre — one short of a kill
  throwSpeed: 18, // initial launch speed along the aim ray (m/s)
  restitution: 0.45, // velocity retained per bounce
  projRadius: 0.15, // collision sphere radius
  throwCooldownMs: 800, // minimum ms between throws
} as const;

/** TDM match flow. */
export const MATCH = {
  maxClients: 12,
  killTarget: 50, // team score that ends the match
  timeLimitMs: 5 * 60_000, // …or 5 minutes, whichever first
  intermissionMs: 5_000, // "ended" banner window before the arena resets to "live"
  respawnMs: 3_000, // downed → respawn delay
  spawnProtectMs: 1_500, // post-spawn invulnerability (cleared early by firing)
  warmupMinPlayers: 2, // seats needed before the warmup→live countdown starts — reconcileBots
  // autofills seats to fillToPlayers before this gate is checked, so with the default
  // fillToPlayers=4 a lone human always has enough seats; solo practice pre-countdown
  // is unreachable in practice
  warmupMs: 10_000, // countdown once minPlayers is met, then a full reset into "live"
  assistWindowMs: 3_000, // prior damage inside this window before a kill counts as an assist
  killstreakThresholds: [3, 5, 8] as readonly number[], // consecutive-kill counts that broadcast "streak"
  fillToPlayers: 4, // bots fill empty seats up to this count while real players are short
} as const;

/** Server-side lag compensation (PLAN §2: hit judgement via server rewind). */
export const LAG = {
  depthMs: 200, // rewind history retention (peeker's-advantage ceiling)
  interpolationMs: 100, // extra rewind on top of RTT when a shot carries no subtick ts
} as const;

/** Teams. Index 0 = red, 1 = blue (u8 in the codec). */
export const TEAM = { red: 0, blue: 1 } as const;
export type TeamId = (typeof TEAM)[keyof typeof TEAM];

/**
 * Game mode tunables (modes.ts). `state.mode`'s wire value is the index into
 * modes.ts's MODE_ORDER (tdm=0, ffa=1, dom=2) — not stored here, this is scores/pacing only.
 */
export const MODES = {
  /** Team deathmatch. */
  tdm: {
    killTarget: 50, // team score (kills) that ends the match — mirrors MATCH.killTarget
  },
  /** Free-for-all. */
  ffa: {
    killTarget: 30, // personal kills (state.players[id].k) that ends the match
  },
  /** Domination — 3 capture points (arena2's ARENA2_CAPS; dom is always played on arena2). */
  dom: {
    captureRadius: 4, // metres — playersAt radius used to judge a point's occupiers
    capturePerSec: 25, // gauge units/sec moved toward the sole occupying team (0..200 range)
    pointsPer2s: 1, // score added per owned point every 2 s
    scoreTarget: 200, // redScore/blueScore that ends the match
  },
} as const;
