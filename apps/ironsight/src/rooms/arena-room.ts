import {
  IoArenaRoom,
  LagCompensator,
  type AOIConfig,
  type Client,
  type InputMeta,
} from "@tikron/server";
import { xorshift32, type Vec2 } from "@tikron/sim";
import { ArenaSchema, type ArenaState, type ArenaPlayer } from "../schema.js";
import {
  ARENA,
  GRENADE,
  HIT,
  HYBRID,
  LAG,
  MATCH,
  MOVE,
  PLAYER,
  TEAM,
  TICK_MS,
  WEAPON,
  type WeaponSpec,
} from "../config.js";
import { canStand, moveAndSlide, nearestBox, type Box, type Vec3 } from "../physics.js";
import { chooseSafeSpawn } from "../map/spawn.js";
import { GroundNavigator } from "../map/navigation.js";
import { resolveHitscan, type FireClaim, type HitTarget } from "../hitscan.js";
import { accuracySpread, dirFromAngles, falloffMul, pelletPattern } from "../weapons.js";
import { blastDamage, stepGrenade, type GrenadeBody } from "../grenade.js";
import type { MapDef } from "../map/types.js";
import { rampOccluderBoxes } from "../map/tilemap.js";
import { ARENA1 } from "../map/arena1.js";
import {
  modeFromRoomId,
  modeIndex,
  mapForRoom,
  PRACTICE_SHOWCASE_BOTS,
  PRACTICE_SHOWCASE_FACE_YAW,
  type GameMode,
  type ModeCtx,
  type ShowcaseBotDef,
} from "../modes.js";
import { botThink, createBotBrain, type BotBrain, type BotView } from "../bots.js";
import { GAME } from "../game-config.js";

// The active theme's weapon roster — swapping game-config.ts's loaded config
// changes what these resolve to (GAME.weapons === WEAPONS by reference for the
// ironsight theme, so this is a no-op alias for the shipped game).
const WEAPONS = GAME.weapons;
const DEFAULT_WEAPON = GAME.weaponMeta.defaultIndex;
const PISTOL_INDEX = GAME.weaponMeta.pistolIndex;

/** A live grenade in flight (server-only; never in wire state — see schema.ts). */
interface Grenade {
  id: string;
  owner: string;
  team: number;
  body: GrenadeBody;
  /** Sim tick it detonates on. */
  boomTick: number;
}

/** Latest held-input intent for a player (server integrates it every tick). */
interface PlayerInput {
  /** Strafe axis (−1 left … +1 right). */
  mx: number;
  /** Forward axis (−1 back … +1 forward). */
  mz: number;
  /** Edge-triggered jump request (consumed on the next grounded tick). */
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
}

const NO_INPUT: PlayerInput = { mx: 0, mz: 0, jump: false, crouch: false, sprint: false };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readNum(o: unknown, key: string): number | undefined {
  if (!isObj(o)) return undefined;
  const v = o[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function readBool(o: unknown, key: string): boolean {
  return isObj(o) && o[key] === true;
}

/**
 * Reads a hybrid hit-registration claim off a `fire` payload's `claim` field.
 * Three states, distinguished on purpose (see `handleFire`):
 * - field absent → `{ present: false }` (old client, or the client didn't
 *   attempt a claim for this shot — e.g. a multi-pellet weapon) → the existing
 *   analytic hitscan is the fallback, unchanged.
 * - `claim: null` → `{ present: true, value: null }` — the client raycast its
 *   own rendered scene and found nothing (occluded or a genuine miss); trusted
 *   outright, no plausibility check needed (a forged "miss" only disadvantages
 *   the claimer, never a cheat vector) and — critically — NOT treated the same
 *   as "absent," or the analytic capsule could still register a hit through a
 *   gap the real mesh doesn't cover, defeating the point of the feature.
 * - `claim: {id, part}` → `{ present: true, value: {id, part} }`, validated by
 *   `validateClaim` before being trusted for damage.
 * Anything malformed (wrong field types) reads as absent — fails open to
 * today's behavior rather than throwing on a bad client payload.
 */
function readClaim(o: unknown, key: string): { present: false } | { present: true; value: FireClaim | null } {
  if (!isObj(o) || !(key in o)) return { present: false };
  const c = o[key];
  if (c === null) return { present: true, value: null };
  if (!isObj(c)) return { present: false };
  const claimId = c["id"];
  const part = c["part"];
  if (typeof claimId !== "string" || (part !== "head" && part !== "body")) return { present: false };
  return { present: true, value: { id: claimId, part } };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

const PITCH_LIMIT = Math.PI / 2 - 0.01;
const TAU = Math.PI * 2;

/**
 * ironsight arena room — a server-authoritative 3D TDM FPS on the {@link IoArenaRoom}
 * preset (PLAN-IRONSIGHT M0). The server integrates movement from WASD *intents*
 * (not client-sent positions), resolves collisions against arena1's boxes, and
 * registers hits by **rewinding** targets to the instant the shooter fired.
 *
 * ## Lag compensation across the vertical axis
 *
 * Tikron's built-in lag compensation ({@link lagCompensation} + {@link rewind}) is
 * 2D (`Vec2`), which fits the horizontal ground plane exactly. A 3D FPS also needs
 * the target's **height** at the rewind instant (crouch/jump change what counts as
 * a headshot), so the room runs a SECOND {@link LagCompensator} ({@link vertLag})
 * carrying `{x: feetY, y: headY}` per player, recorded on the same tick cadence.
 * A `fire` reconstructs each target's capsule + head sphere from both channels at
 * one `at` instant, so head/body discrimination survives real RTT.
 */
export class ArenaRoomImpl extends IoArenaRoom<ArenaState> {
  // v4 adds the remote reload deadline. Older snapshots intentionally start a
  // fresh match via the default null migration; client/server codecs ship together.
  protected override stateVersion = 4;
  protected readonly codec = ArenaSchema;
  protected override tickMs = TICK_MS;
  // Must be ≤ tickMs, or the default 50 ms coalesce window would throttle the
  // per-tick flushes back down below the sim rate.
  protected override syncIntervalMs = TICK_MS;
  // The point of the FPS stack: rewind hit checks to the shooter's subtick instant.
  protected override lagCompensation = true;
  // Explicit `: number` — the `as const` config narrows these to literal types, which blocks
  // test subclasses from overriding with other latencies (W-C finding).
  protected override lagCompensationDepthMs: number = LAG.depthMs;
  protected override lagInterpolationMs: number = LAG.interpolationMs;
  // AOI is wired (event routing + anti-wallhack boundary), but the view radius
  // spans the whole small arena so a 12-player TDM never culls a teammate you
  // need on the map — interest-tier tuning is an M2 concern at higher CCU.
  protected override aoi: AOIConfig<ArenaState> = {
    viewRadius: GAME.match.aoiViewRadius,
    mapFields: ["players"],
    position: (e) => ({ x: (e as ArenaPlayer).x, y: (e as ArenaPlayer).z }),
    viewer: (s, id) => s.players[id] ?? null,
  };

  // --- match-flow tunables (mirrored from config; a test subclass can shrink
  //     these — e.g. killTarget = 2 — without touching production values) ---
  protected killTarget: number = MATCH.killTarget;
  protected matchTimeMs: number = MATCH.timeLimitMs;
  protected intermissionMs: number = MATCH.intermissionMs;
  protected respawnMs: number = MATCH.respawnMs;
  protected spawnProtectMs: number = MATCH.spawnProtectMs;
  protected warmupMinPlayers: number = MATCH.warmupMinPlayers;
  protected warmupMs: number = MATCH.warmupMs;
  protected assistWindowMs: number = MATCH.assistWindowMs;
  /** Real+bot seat target; a test subclass sets 0 to keep bots out of a scripted room. */
  protected fillToPlayers: number = MATCH.fillToPlayers;
  /** Boot straight into "live" (skips warmup) — for scripted tests that stage combat directly. */
  protected startInWarmup = true;

  // --- server-only per-player sim state (never synced) ---
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly vy = new Map<string, number>();
  private readonly grounded = new Map<string, boolean>();
  // Per-weapon ammo: arrays indexed by weapon (0..WEAPONS.length−1), so each weapon
  // keeps its own magazine + reserve (PLAN §4: "탄약/재장전 무기별 분리").
  private readonly magByW = new Map<string, number[]>();
  private readonly reserveByW = new Map<string, number[]>();
  private readonly reloadUntil = new Map<string, number>(); // epoch ms; absent = not reloading (current weapon only)
  private readonly lastShotAt = new Map<string, number>(); // epoch ms
  private readonly swapUntil = new Map<string, number>(); // epoch ms; can't fire until a weapon swap settles
  private readonly nadeReadyAt = new Map<string, number>(); // epoch ms; earliest next grenade throw
  private readonly primaryWeapon = new Map<string, number>(); // chosen spawn weapon index (loadout)
  private readonly respawnAt = new Map<string, number>(); // sim tick
  private readonly protUntil = new Map<string, number>(); // sim tick
  /** Bot AI state per bot id (created on addBot, discarded on removeBot). */
  private readonly botBrains = new Map<string, BotBrain>();

  /** Grenades currently in flight (stepped every tick). */
  private grenades: Grenade[] = [];
  private nadeSeq = 0;

  /** Vertical lag-comp channel: id → {x: feetY, y: headY}. Paired with {@link rewind}. */
  private vertLag = new LagCompensator({ depthMs: LAG.depthMs });
  /** Round-robin spawn cursor per team, so successive spawns don't stack. */
  private readonly spawnRot: Record<number, number> = { [TEAM.red]: 0, [TEAM.blue]: 0 };
  /** Sim tick the post-match intermission ends and the arena resets (phase "ended"). */
  private endedUntil: number | undefined;
  /** Sim tick the warmup countdown elapses (unset while below {@link warmupMinPlayers}). */
  private warmupUntil: number | undefined;
  /** One vote per player id; only meaningful while phase is "ended". */
  private roundResult: { winner: string; red: number; blue: number } | null = null;
  private readonly restartVotes = new Set<string>();
  /** Recent non-lethal damage per victim, for assist attribution: victim → [{attacker, dmg, at}]. */
  private readonly hits = new Map<string, { attacker: string; dmg: number; at: number }[]>();
  /** Current consecutive-kill count per killer id (reset when that player dies). */
  private readonly streaks = new Map<string, number>();
  /** Deterministic PRNG for per-shot spread (seeded from state.seed in onReady). */
  private spreadRng: () => number = xorshift32(1);

  /** This room's game mode, chosen from the room id (e.g. "arena-ffa" → FFA). */
  private readonly gameMode: GameMode = modeFromRoomId(this.id);

  /** This room's map, resolved once from its mode + room id (tdm → arena1, ffa → arena3, dom
   *  → arena2, practice → arena1/2/3 per the room id's `map` suffix — see
   *  modes.ts's `mapForRoom`, the single source of truth both this room and the
   *  client resolve the practice map through). */
  private readonly map: MapDef = mapForRoom(this.gameMode.id, this.id);
  private readonly navigator = this.map.presentation ? new GroundNavigator(this.map) : undefined;
  private readonly boxes: readonly Box[] = this.map.boxes;
  /** `boxes` plus each ramp's old step-box approximation (see
   *  {@link rampOccluderBoxes}) — used ONLY for hit-scan/LoS occlusion, never
   *  for movement. Movement (moveAndSlide/canStand) collides against a ramp's
   *  true sloped surface instead (moveAndSlide's `ramps` param); occlusion
   *  keeps the coarser step approximation since a wedge-accurate raycast
   *  isn't worth the added cost for "is this shot/blast blocked." */
  private readonly hitBoxes: readonly Box[] = [
    ...this.map.boxes,
    ...(this.map.ramps ?? []).flatMap(rampOccluderBoxes),
  ];

  /** True only for practice-on-arena1 — the single gate every showcase-roster
   *  code path (spawn pin, bot fill, view exposure) must check, so map
   *  selection can never leave arena2/arena3 practice half-showing the arena1-
   *  specific demo roster (its coordinates, PRACTICE_SHOWCASE_BOTS in
   *  modes.ts, are placement baked for arena1 only — per-map showcase
   *  placement is out of scope here). `this.map === ARENA1` is a safe
   *  reference-equality check since mapForRoom always returns the same
   *  module-singleton MapDef object for a given map. */
  private get showcaseActive(): boolean {
    return this.gameMode.id === "practice" && this.map === ARENA1;
  }

  protected override onReady(): void {
    this.maxClients = MATCH.maxClients;
    // The move+look stream runs ~ per-tick (20–30 Hz) plus fire — keep headroom
    // over the 30/s default so inputs are never silently rate-dropped.
    this.maxInputsPerSecond = GAME.match.maxInputsPerSecond;

    // Practice is a solo/bot sandbox with no match flow to wait on or end: skip
    // warmup (straight into "live") and disable the mode-agnostic time-limit
    // fallback in onTick (PRACTICE_MODE.winCheck already never ends the match on
    // its own — matchEndMs would otherwise still do it via that shared fallback).
    if (this.gameMode.id === "practice") {
      this.startInWarmup = false;
      this.matchTimeMs = Infinity;
      // 1 solo player + the full showcase roster (see reconcileBots/addShowcaseBot) —
      // unless a subclass already overrode fillToPlayers itself (e.g. a scripted-duel
      // test room that wants zero filler bots), which this must not stomp.
      // Only when the showcase is actually active (practice on ARENA1): on an
      // arena2/arena3 practice room the roster is gated off, and leaving the
      // raised fill target in place would quietly backfill the deficit with
      // REGULAR combat bots instead — exactly the live bug report ("아레나 2,
      // 크로스야드 연습에 봇이 활동 중"): map-exploration practice must be an
      // empty map, so the fill target drops to 0 there.
      if (this.fillToPlayers === MATCH.fillToPlayers) {
        this.fillToPlayers = this.showcaseActive ? PRACTICE_SHOWCASE_BOTS.length + 1 : 0;
      }
    }

    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.spreadRng = xorshift32(seed || 1);
    this.vertLag = new LagCompensator({ depthMs: this.lagCompensationDepthMs });

    this.setState({
      players: {},
      seed,
      redScore: 0,
      blueScore: 0,
      phase: this.startInWarmup ? "warmup" : "live",
      matchEndMs: Date.now() + this.matchTimeMs,
      mode: modeIndex(this.gameMode.id),
      capA: GAME.match.capNeutral,
      capB: GAME.match.capNeutral,
      capC: GAME.match.capNeutral,
    });

    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("look", (client, payload) => this.handleLook(client, payload));
    this.onMessage("fire", (client, payload, _seq, input) => this.handleFire(client, payload, input));
    this.onMessage("reload", (client) => this.handleReload(client));
    this.onMessage("switch", (client, payload) => this.handleSwitch(client, payload));
    this.onMessage("nade", (client) => this.handleNade(client));
    this.onMessage("loadout", (client, payload) => this.handleLoadout(client, payload));
    this.onMessage("respawn", (client) => this.handleRespawn(client));
    this.onMessage("syncView", (client) => this.syncView(client));
    this.onMessage("voteRestart", (client) => this.handleVoteRestart(client));
  }

  override onJoin(client: Client): void {
    const team = this.gameMode.teams ? this.assignTeam() : 0;
    const p = this.initPlayer(client.id, team);
    this.spawnInto(p, client.id);
    this.markStateChanged();
  }

  /** Runtime combat maps are deliberately not durable. A cold restore starts a
   * fresh round at safe spawns; it must never resume dead seats without timers,
   * stale protected flags, or an ended round without an intermission deadline. */
  protected override onRestore(): void {
    for (const id of Object.keys(this.state.players)) {
      if (id.startsWith("bot-") || PRACTICE_SHOWCASE_BOTS.some((bot) => bot.id === id)) {
        delete this.state.players[id];
      } else {
        this.inputs.set(id, { ...NO_INPUT });
      }
    }
    this.spreadRng = xorshift32(this.state.seed || 1);
    this.resetMatch(Date.now());
    if (this.gameMode.id !== "practice") this.enterWarmup();
    this.markStateChanged();
  }

  /** Clear held intent immediately while preserving the preset's 30-second seat. */
  override async onLeave(client: Client): Promise<void> {
    this.inputs.set(client.id, { ...NO_INPUT });
    await super.onLeave(client);
  }

  private syncView(client: Client): void {
    const p = this.state.players[client.id];
    if (!p) return;
    const remaining = Math.max(0, (this.reloadUntil.get(client.id) ?? 0) - Date.now());
    client.send("ammo", {
      mag: this.magArr(client.id)[p.weapon] ?? 0,
      reserve: this.reserveArr(client.id)[p.weapon] ?? 0,
      weapon: this.weaponOf(p).slot,
      ...(remaining > 0 ? { reloadMs: remaining } : {}),
    });
    if (this.state.phase === "ended" && this.roundResult) client.send("matchEnd", this.roundResult);
    if (this.state.phase === "ended") {
      const humans = Object.keys(this.state.players).length - this.botBrains.size;
      client.send("vote", { count: this.restartVotes.size, need: Math.floor(humans / 2) + 1 });
    }
  }

  /** Shared player-record init for real joins and bot fills (team assignment stays
   *  in the caller so both paths go through the same balance logic). */
  private initPlayer(id: string, team: number): ArenaPlayer {
    const p: ArenaPlayer = {
      x: 0,
      z: 0,
      y: 0,
      yaw: team === TEAM.red ? GAME.teams.spawnFacingYaw[0] : GAME.teams.spawnFacingYaw[1],
      pitch: 0,
      hp: PLAYER.maxHp,
      team,
      alive: true,
      crouch: false,
      prot: true,
      k: 0,
      d: 0,
      weapon: DEFAULT_WEAPON,
      nades: GRENADE.count, reloadEnd: 0,
    };
    this.state.players[id] = p;
    this.inputs.set(id, { ...NO_INPUT });
    return p;
  }

  protected override onSeatExpired(client: Client): void {
    const id = client.id;
    delete this.state.players[id];
    for (const m of [
      this.inputs,
      this.vy,
      this.grounded,
      this.magByW,
      this.reserveByW,
      this.reloadUntil,
      this.lastShotAt,
      this.swapUntil,
      this.nadeReadyAt,
      this.primaryWeapon,
      this.respawnAt,
      this.protUntil,
      this.hits,
      this.streaks,
    ]) {
      m.delete(id);
    }
    this.restartVotes.delete(id);
    this.grenades = this.grenades.filter((g) => g.owner !== id);
    this.markStateChanged();
  }

  /** Horizontal lag-comp channel (the preset records this every tick): id → {x, z}. */
  protected override lagSnapshot(): Map<string, Vec2> {
    const out = new Map<string, Vec2>();
    for (const [id, p] of Object.entries(this.state.players)) {
      if (p.alive && !p.prot) out.set(id, { x: p.x, y: p.z });
    }
    return out;
  }

  protected override onTick(dtMs: number): void {
    const now = Date.now();
    const dt = clamp(dtMs, 0, MOVE.maxDtMs) / 1000;

    this.reconcileBots();

    // Match clock / win condition. Mode-specific scoring (dom's capture gauges,
    // ffa's per-player target) runs first; the killTarget/time-limit check below
    // stays as the TDM/default fallback so existing test overrides of killTarget
    // keep working unchanged.
    if (this.state.phase === "live") {
      const ctx = this.modeCtx();
      this.gameMode.tick(ctx, dtMs);
      const result = this.gameMode.winCheck(ctx);
      if (result) {
        this.endMatch(result.winner);
      } else if (
        // The killTarget fallback mirrors TDM's own winCheck (a symmetric red/blue
        // score threshold) — gated to TDM only so it can't fire early for a mode
        // whose winCheck uses a different score shape (dom's much-higher
        // scoreTarget, ffa's per-player kills). The time limit is mode-agnostic and
        // always applies.
        (this.gameMode.id === "tdm" &&
          (this.state.redScore >= this.killTarget || this.state.blueScore >= this.killTarget)) ||
        now >= this.state.matchEndMs
      ) {
        this.endMatch();
      }
    } else if (this.state.phase === "warmup") {
      this.tickWarmup(now);
    } else if (this.endedUntil !== undefined && this.currentTick >= this.endedUntil) {
      this.enterWarmup();
    }

    if (this.state.phase === "live" || this.state.phase === "warmup") {
      this.tickBots(dtMs);
    }

    // Movement integration for the living.
    for (const [id, p] of Object.entries(this.state.players)) {
      if (p.alive) this.integrate(id, p, dt);
    }

    // Respawns due this tick.
    for (const [id, tick] of this.respawnAt) {
      if (this.currentTick < tick) continue;
      this.respawnAt.delete(id);
      const p = this.state.players[id];
      if (!p) continue;
      this.spawnInto(p, id);
      this.broadcast("respawn", { id });
    }

    // Spawn-protection expiry.
    for (const [id, until] of this.protUntil) {
      if (this.currentTick < until) continue;
      this.protUntil.delete(id);
      const p = this.state.players[id];
      if (p?.prot) p.prot = false;
    }

    // Complete due reloads (owner HUD reconcile).
    for (const [id, done] of this.reloadUntil) {
      if (now < done) continue;
      this.reloadUntil.delete(id);
      this.finishReload(id);
    }

    // Grenades in flight: integrate + bounce, detonate on the fuse.
    if (this.grenades.length > 0) this.stepGrenades(dt, now);

    // Record the vertical lag channel for this tick (horizontal is recorded by the
    // preset right after this returns — same cadence, same Date.now()). Uses
    // hitHeight(), NOT height() — this feeds resolveHitscan's target headY
    // (via rewind below), the one consumer HIT's crouchHeight split applies to.
    const vsnap = new Map<string, Vec2>();
    for (const [id, p] of Object.entries(this.state.players)) {
      if (p.alive && !p.prot) vsnap.set(id, { x: p.y, y: p.y + this.hitHeight(p) });
    }
    this.vertLag.record(this.currentTick, now, vsnap);
  }

  // --- movement ---------------------------------------------------------------

  private integrate(id: string, p: ArenaPlayer, dt: number): void {
    const inp = this.inputs.get(id) ?? NO_INPUT;

    // Crouch (updated before speed/height so this tick uses it). Standing up is
    // rejected if the taller capsule would clip cover/ceiling.
    if (p.crouch && !inp.crouch) {
      if (canStand(p.x, p.y, p.z, PLAYER.radius, PLAYER.standHeight, this.boxes, this.map.bounds)) {
        p.crouch = false;
      }
    } else {
      p.crouch = inp.crouch;
    }

    let grounded = this.grounded.get(id) ?? true;
    let vy = this.vy.get(id) ?? 0;

    // Speed: crouch < walk < sprint (sprint only while moving forward, grounded).
    let speed: number = MOVE.walk;
    if (p.crouch) speed = MOVE.crouch;
    else if (inp.sprint && inp.mz > 0 && grounded) speed = MOVE.sprint;

    // Wish direction in world xz: forward = (sin yaw, cos yaw), right = (cos yaw, −sin yaw).
    const sy = Math.sin(p.yaw);
    const cy = Math.cos(p.yaw);
    let wx = sy * inp.mz + cy * inp.mx;
    let wz = cy * inp.mz - sy * inp.mx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }

    // Jump (edge-triggered): fire only when grounded; consume the request either way.
    if (grounded && inp.jump) {
      vy = MOVE.jumpSpeed;
      grounded = false;
    }
    inp.jump = false;

    vy -= MOVE.gravity * dt;

    const height = this.height(p);
    const delta: Vec3 = { x: wx * speed * dt, y: vy * dt, z: wz * speed * dt };
    const res = moveAndSlide(
      { x: p.x, y: p.y, z: p.z },
      PLAYER.radius,
      height,
      delta,
      vy,
      this.boxes,
      this.map.bounds,
      MOVE.stepUp,
      this.map.ramps ?? [],
    );
    p.x = res.pos.x;
    p.y = res.pos.y;
    p.z = res.pos.z;
    this.vy.set(id, res.vy);
    this.grounded.set(id, res.grounded);
  }

  private height(p: ArenaPlayer): number {
    return p.crouch ? PLAYER.crouchHeight : PLAYER.standHeight;
  }

  /** Crown height per {@link HIT}'s dimensions, NOT {@link height}'s — feeds the
   *  vertical lag-comp channel resolveHitscan's target headY ultimately reads.
   *  Movement collision (moveAndSlide via `height()`) and eye/muzzle height
   *  (`eyeHeight()`) are unaffected by HIT's crouchHeight override on purpose. */
  private hitHeight(p: ArenaPlayer): number {
    return p.crouch ? HIT.crouchHeight : HIT.standHeight;
  }

  private eyeHeight(p: ArenaPlayer): number {
    return p.crouch ? PLAYER.crouchEye : PLAYER.standEye;
  }

  private handleMove(client: Client, payload: unknown): void {
    const prev = this.inputs.get(client.id);
    const mx = clamp(readNum(payload, "mx") ?? 0, -1, 1);
    const mz = clamp(readNum(payload, "mz") ?? 0, -1, 1);
    // OR the jump edge across every move drained this tick so a jump seen earlier
    // in the batch isn't lost when a later (jump:false) move arrives same tick.
    const jump = readBool(payload, "jump") || (prev?.jump ?? false);
    this.inputs.set(client.id, {
      mx,
      mz,
      jump,
      crouch: readBool(payload, "crouch"),
      sprint: readBool(payload, "sprint"),
    });
  }

  private handleLook(client: Client, payload: unknown): void {
    const p = this.state.players[client.id];
    if (!p) return;
    const yaw = readNum(payload, "yaw");
    const pitch = readNum(payload, "pitch");
    if (yaw !== undefined) p.yaw = ((yaw % TAU) + TAU) % TAU;
    if (pitch !== undefined) p.pitch = clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  }

  // --- shooting ---------------------------------------------------------------

  private handleFire(client: Client, payload: unknown, input?: InputMeta): void {
    const id = client.id;
    const shooter = this.state.players[id];
    if (!shooter || !shooter.alive) return;

    const now = Date.now();
    const spec = this.weaponOf(shooter);
    const w = shooter.weapon;

    // A weapon swap must settle before the new weapon can fire.
    const swap = this.swapUntil.get(id);
    if (swap !== undefined && now < swap) return;

    const last = this.lastShotAt.get(id);
    if (last !== undefined && now - last < spec.fireIntervalMs) return; // server fire-rate cap

    // Ammo (server-authoritative, per weapon). Reloading blocks; an empty mag auto-reloads.
    const done = this.reloadUntil.get(id);
    if (done !== undefined) {
      if (now < done) return; // mid-reload
      this.reloadUntil.delete(id);
      this.finishReload(id);
    }
    const mags = this.magArr(id);
    if ((mags[w] ?? 0) <= 0) {
      this.startReload(id, now);
      return;
    }
    mags[w] = (mags[w] ?? 0) - 1;
    this.lastShotAt.set(id, now);
    client.send("ammo", { mag: mags[w], reserve: this.reserveArr(id)[w] ?? 0, weapon: spec.slot });

    // Firing ends spawn protection early (no shooting from behind the shield).
    if (shooter.prot) {
      shooter.prot = false;
      this.protUntil.delete(id);
    }

    const origin: Vec3 = { x: shooter.x, y: shooter.y + this.eyeHeight(shooter), z: shooter.z };

    // Rewind both channels to the same instant: the subtick ts when the client
    // supplied one (Tikron's `rewind()` treats this as "the exact moment the
    // shooter aimed" — see packages/server/src/presets.ts's doc comment), else
    // the RTT estimate. Either way, `lagInterpolationMs` is subtracted
    // UNCONDITIONALLY on top — Tikron's timing only accounts for network RTT/
    // subtick precision, not ironsight's own choice to render remote players
    // INTERP_DELAY_MS behind real time for smoothing (client/config.ts), so
    // without this term a shot resolves against the target's position at
    // roughly "now," not what the shooter's screen actually showed at the
    // moment they fired (hitbox/visual audit, is-anim: moving targets missed
    // consistently despite an accurate spatial hit-volume — see LAG.interpolationMs's
    // doc comment in src/config.ts for the measured before/after).
    const at = (input?.ts ?? now - client.rttMs) - this.lagInterpolationMs;
    const horizontal = this.rewind(client, at);
    const vertical = this.vertLag.atTime(at);

    const targets: HitTarget[] = [];
    for (const [tid, h] of horizontal) {
      if (tid === id) continue;
      const v = vertical.get(tid);
      const tp = this.state.players[tid];
      if (!v || !tp || !tp.alive || tp.prot) continue;
      targets.push({ id: tid, x: h.x, z: h.y, feetY: v.x, headY: v.y, team: tp.team });
    }

    // One shot event per trigger pull (base aim ray → muzzle flash + tracer); the
    // tracer reaches the nearest pellet impact, else the map-occlusion distance.
    // Also the reference direction hybrid claims are validated against below —
    // a claim reflects where the client's crosshair pointed, not the analytic
    // path's per-pellet jittered ray (the client can't predict the server's
    // secret spread RNG), so it's checked against this raw aim, not `dir`.
    const baseDir = dirFromAngles(shooter.yaw, shooter.pitch);

    // Fire the weapon's pellets: a fixed pattern (the shotgun's spread) plus a
    // per-ray accuracy-cone jitter (movement penalty). Per-pellet damage scales
    // with range (falloff), and pellets on the same victim stack into one hit.
    const inp = this.inputs.get(id);
    const grounded = this.grounded.get(id) ?? true;
    const moving = inp ? inp.mx !== 0 || inp.mz !== 0 : false;
    const acc = accuracySpread(spec, moving, grounded);
    const cfg = { radius: HIT.radius, headRadius: HIT.headRadius };

    const dmgByVictim = new Map<string, { dmg: number; head: boolean }>();
    let nearestHitT = Infinity;

    // Hybrid hit registration (HYBRID, hitscan.ts's FireClaim) — single-pellet
    // weapons only; a shotgun's 8 simultaneous pellets can't collapse into one
    // claim, so it always falls through to the analytic loop below untouched.
    let usedClaim = false;
    const claimRead = HYBRID.enabled && spec.pellets === 1 ? readClaim(payload, "claim") : ({ present: false } as const);
    if (claimRead.present) {
      if (claimRead.value === null) {
        // The client raycast its own rendered scene and found nothing — trusted
        // outright, no plausibility check needed (a forged "miss" only ever
        // disadvantages the claimer, never a cheat vector). Deliberately NOT
        // routed into the analytic fallback below: that capsule can still cover
        // a gap (e.g. between the legs) the real mesh doesn't, which would
        // silently re-introduce the exact false-hit this feature exists to fix.
        usedClaim = true;
        console.log(JSON.stringify({ tag: "hybridHit", shooter: id, result: "trusted-miss" }));
      } else {
        const claimed = claimRead.value;
        const result = this.validateClaim(claimed, shooter, targets, origin, baseDir, spec.range, acc);
        if (result.accepted) {
          usedClaim = true;
          const base = claimed.part === "head" ? spec.damageHead : spec.damageBody;
          dmgByVictim.set(claimed.id, { dmg: base * falloffMul(spec, result.t), head: claimed.part === "head" });
          nearestHitT = result.t;
          console.log(
            JSON.stringify({
              tag: "hybridHit",
              shooter: id,
              victim: claimed.id,
              part: claimed.part,
              angleErrDeg: result.angleErrDeg,
              result: "accepted",
            }),
          );
        } else {
          console.warn(
            JSON.stringify({
              tag: "hybridHit",
              shooter: id,
              victim: claimed.id,
              part: claimed.part,
              angleErrDeg: result.angleErrDeg,
              reason: result.reason,
              result: "rejected",
            }),
          );
        }
      }
    }

    if (!usedClaim) {
      // Third branch of the 3-way split (team-lead's wire-spec correction): no
      // claim was attempted at all — a genuinely old client, a multi-pellet
      // weapon, or HYBRID.enabled=false. Logged too, at the same tag, so a
      // Workers log review can tell "no claim offered" apart from "trusted
      // miss" and "rejected claim" without gaps in the audit trail. Bots are
      // excluded on purpose (team-lead): the logging exists for post-hoc CHEAT
      // review, and a bot (botFire always sends no payload/claim) can never be
      // a cheat suspect — every bot shot would otherwise log this line at the
      // bot's full fire cadence (down to 65ms for a filler-bot SMG), drowning
      // the real per-human audit trail in zero-forensic-value noise.
      if (HYBRID.enabled && !this.botBrains.has(id)) {
        console.log(JSON.stringify({ tag: "hybridHit", shooter: id, result: "no-claim" }));
      }
      for (const off of pelletPattern(spec)) {
        const dir = dirFromAngles(shooter.yaw + off.dyaw + this.jitter(acc), shooter.pitch + off.dpitch + this.jitter(acc));
        const hit = resolveHitscan(
          origin,
          dir,
          spec.range,
          shooter.team,
          targets,
          this.hitBoxes,
          cfg,
          !this.gameMode.teams,
        );
        if (!hit) continue;
        if (hit.t < nearestHitT) nearestHitT = hit.t;
        const base = hit.part === "head" ? spec.damageHead : spec.damageBody;
        const agg = dmgByVictim.get(hit.id) ?? { dmg: 0, head: false };
        agg.dmg += base * falloffMul(spec, hit.t);
        agg.head = agg.head || hit.part === "head";
        dmgByVictim.set(hit.id, agg);
      }
    }

    const dist =
      nearestHitT < Infinity
        ? nearestHitT
        : Math.min(spec.range, nearestBox(origin, baseDir, this.hitBoxes, spec.range));
    const victims = [...dmgByVictim.keys()];
    this.sendNear(
      "shot",
      {
        from: id,
        weapon: spec.slot,
        ox: origin.x,
        oy: origin.y,
        oz: origin.z,
        dx: baseDir.x,
        dy: baseDir.y,
        dz: baseDir.z,
        dist,
        hit: victims.length > 0,
        // Per-victim id + headshot flag, appended for the client's remote
        // hit-reaction animation (rig-loader.ts/scene.ts) — `hit` above is
        // unchanged (the tracer color still reads that plain aggregate).
        hits: victims.map((vid) => ({ id: vid, head: dmgByVictim.get(vid)!.head })),
      },
      origin.x,
      origin.z,
      { always: [id, ...victims] },
    );

    for (const [vid, agg] of dmgByVictim) {
      const dmg = Math.round(agg.dmg);
      if (dmg <= 0) continue;
      this.applyDamage(vid, dmg, id, agg.head ? "head" : "body", spec.slot);
      client.send("hit", { victim: vid, dmg, head: agg.head });
    }
    this.markStateChanged();
  }

  /**
   * Hybrid hit registration's server-side plausibility gate (PLAN "모양 100%",
   * user-confirmed casual-tolerant premise). The client's raycast-against-its-
   * actual-rendered-scene claim is trusted for DAMAGE — skipping the analytic
   * capsule/sphere approximation entirely — only if this coarse check passes;
   * any failure falls back to the existing `resolveHitscan` pellet loop
   * unchanged, so a forged or stale claim can never register a hit the
   * analytic path wouldn't already have allowed — only fail to improve on it.
   *
   * Deliberately coarse: this does NOT re-derive whether the claimed point is
   * really "head" vs "body" (the client's own mesh raycast already decided
   * that, more precisely than this file's capsule/sphere ever could) — it only
   * asks "could this shot plausibly have been aimed at this target," the same
   * question a human reviewing a replay log would ask.
   */
  private validateClaim(
    claim: FireClaim,
    shooter: ArenaPlayer,
    targets: readonly HitTarget[],
    origin: Vec3,
    aimDir: Vec3,
    range: number,
    acc: number,
  ): { accepted: true; t: number; angleErrDeg: number } | { accepted: false; reason: string; angleErrDeg?: number } {
    // Not found in `targets` covers dead/protected/self/nonexistent in one
    // check — that array was already filtered down to the valid victim set
    // (see handleFire's rewind loop right above).
    const tgt = targets.find((t) => t.id === claim.id);
    if (!tgt) return { accepted: false, reason: "no-target" };
    if (this.gameMode.teams && tgt.team === shooter.team) return { accepted: false, reason: "friendly" };

    // Same headCentre/neck convention hitscan.ts's resolveHitscan uses, so the
    // reference point a "head" or "body" claim is checked against matches what
    // the analytic path would have aimed at for the same target.
    const neckY = tgt.headY - 2 * HIT.headRadius;
    const refPoint: Vec3 =
      claim.part === "head"
        ? { x: tgt.x, y: tgt.headY - HIT.headRadius, z: tgt.z }
        : { x: tgt.x, y: (tgt.feetY + neckY) / 2, z: tgt.z };

    const toRef: Vec3 = { x: refPoint.x - origin.x, y: refPoint.y - origin.y, z: refPoint.z - origin.z };
    const dist = Math.hypot(toRef.x, toRef.y, toRef.z);
    if (dist < 1e-6 || dist > range) return { accepted: false, reason: "range" };

    const toRefDir: Vec3 = { x: toRef.x / dist, y: toRef.y / dist, z: toRef.z / dist };
    const cos = clamp(aimDir.x * toRefDir.x + aimDir.y * toRefDir.y + aimDir.z * toRefDir.z, -1, 1);
    const angleErr = Math.acos(cos);
    const angleErrDeg = (angleErr * 180) / Math.PI;
    // See HYBRID.coneMarginM's doc comment (src/config.ts) for why the base
    // term scales with distance instead of a flat degree figure. `acc` (the
    // shooter's CURRENT accuracySpread, moving/airborne included) is added on
    // top as its worst-case combined angle: yaw and pitch jitter are each drawn
    // independently and uniformly in [-acc, +acc] (weapons.ts's `jitter`, one
    // roll client-side for the claim ray, a separate roll server-side for the
    // analytic pellet), so the two axes' worst-case combined magnitude is
    // acc·√2 — without this term, a moving shooter's client-rolled jitter
    // (correctly reproducing the accuracy-cone movement penalty) would get
    // its own honest claims rejected as "forged."
    const tolerance = Math.atan2(HIT.radius + HYBRID.coneMarginM, dist) + acc * Math.SQRT2;
    if (angleErr > tolerance) return { accepted: false, reason: "cone", angleErrDeg };

    const occludeT = nearestBox(origin, toRefDir, this.hitBoxes, dist);
    if (occludeT < dist) return { accepted: false, reason: "occluded", angleErrDeg };

    return { accepted: true, t: dist, angleErrDeg };
  }

  private weaponOf(p: ArenaPlayer): WeaponSpec {
    return WEAPONS[p.weapon] ?? WEAPONS[DEFAULT_WEAPON]!;
  }

  /** Per-weapon magazine array (lazily filled to every weapon's full mag). */
  private magArr(id: string): number[] {
    let a = this.magByW.get(id);
    if (!a) {
      a = WEAPONS.map((wpn) => wpn.mag);
      this.magByW.set(id, a);
    }
    return a;
  }

  /** Per-weapon reserve array (lazily filled to every weapon's full reserve). */
  private reserveArr(id: string): number[] {
    let a = this.reserveByW.get(id);
    if (!a) {
      a = WEAPONS.map((wpn) => wpn.reserve);
      this.reserveByW.set(id, a);
    }
    return a;
  }

  /** Symmetric spread offset (rad) for a cone half-angle; 0 → pinpoint (deterministic).
   *  Same formula as weapons.ts's exported `jitter()` (which main.ts's hybrid-hit
   *  claim roll uses with its own `Math.random()`) — kept as a separate method
   *  here rather than switched to call the shared one, so this room's seeded
   *  `spreadRng` (secret, reproducible-per-room) stays untouched. */
  private jitter(spread: number): number {
    return spread > 0 ? (this.spreadRng() / 0xffffffff - 0.5) * 2 * spread : 0;
  }

  private ownerClient(id: string): Client | undefined {
    return this.clientList().find((c) => c.id === id);
  }

  private handleReload(client: Client): void {
    const id = client.id;
    const p = this.state.players[id];
    if (!p || !p.alive) return;
    if (this.reloadUntil.has(id)) return; // already reloading
    const spec = this.weaponOf(p);
    if ((this.magArr(id)[p.weapon] ?? 0) >= spec.mag) return; // full
    if ((this.reserveArr(id)[p.weapon] ?? 0) <= 0) return; // no spare rounds
    this.startReload(id, Date.now());
  }

  private startReload(id: string, now: number): void {
    const p = this.state.players[id];
    if (!p) return;
    if (this.reloadUntil.has(id)) return;
    const spec = this.weaponOf(p);
    const w = p.weapon;
    if ((this.reserveArr(id)[w] ?? 0) <= 0) return;
    this.reloadUntil.set(id, now + spec.reloadMs);
    p.reloadEnd = now + spec.reloadMs;
    this.markStateChanged();
    this.ownerClient(id)?.send("ammo", {
      mag: this.magArr(id)[w] ?? 0,
      reserve: this.reserveArr(id)[w] ?? 0,
      weapon: spec.slot,
      reloadMs: spec.reloadMs,
    });
  }

  private finishReload(id: string): void {
    const p = this.state.players[id];
    if (!p) return;
    p.reloadEnd = 0;
    this.markStateChanged();
    const spec = this.weaponOf(p);
    const w = p.weapon;
    const mags = this.magArr(id);
    const reserves = this.reserveArr(id);
    const mag = mags[w] ?? 0;
    const reserve = reserves[w] ?? 0;
    const take = Math.min(spec.mag - mag, reserve);
    mags[w] = mag + take;
    reserves[w] = reserve - take;
    this.ownerClient(id)?.send("ammo", { mag: mags[w], reserve: reserves[w], weapon: spec.slot });
  }

  // --- weapon switch / loadout / grenades -------------------------------------

  /** Switch to loadout slot 1–5; the swap delay gates the next shot. */
  private handleSwitch(client: Client, payload: unknown): void {
    const id = client.id;
    const p = this.state.players[id];
    if (!p || !p.alive) return;
    const slot = readNum(payload, "slot");
    if (slot === undefined) return;
    const idx = Math.round(slot) - 1;
    if (idx < 0 || idx >= WEAPONS.length || idx === p.weapon) return;
    p.weapon = idx;
    this.swapUntil.set(id, Date.now() + WEAPON.swapMs);
    p.reloadEnd = 0;
    this.reloadUntil.delete(id); // a swap cancels an in-progress reload
    this.lastShotAt.delete(id); // the new weapon's cadence starts after the swap
    this.ownerClient(id)?.send("ammo", {
      mag: this.magArr(id)[idx] ?? 0,
      reserve: this.reserveArr(id)[idx] ?? 0,
      weapon: WEAPONS[idx]!.slot,
    });
    this.markStateChanged();
  }

  /** Choose the weapon you SPAWN holding (primary = slots 1–4; applied next spawn). */
  private handleLoadout(client: Client, payload: unknown): void {
    const slot = readNum(payload, "primary");
    if (slot === undefined) return;
    const idx = Math.round(slot) - 1;
    if (idx < 0 || idx >= PISTOL_INDEX) return; // a primary is slots 1–4, never the pistol
    this.primaryWeapon.set(client.id, idx);
  }

  /** Throw a grenade along the aim ray (server owns the trajectory + fuse). */
  private handleNade(client: Client): void {
    const id = client.id;
    const p = this.state.players[id];
    if (!p || !p.alive || p.nades <= 0) return;
    const now = Date.now();
    const ready = this.nadeReadyAt.get(id);
    if (ready !== undefined && now < ready) return;
    this.nadeReadyAt.set(id, now + GRENADE.throwCooldownMs);
    p.nades -= 1;

    const dir = dirFromAngles(p.yaw, p.pitch);
    const eye = p.y + this.eyeHeight(p);
    // Spawn just ahead of the muzzle so it clears the thrower's own body/cover.
    const off = GAME.grenade.muzzleOffset;
    const pos: Vec3 = { x: p.x + dir.x * off, y: eye + dir.y * off, z: p.z + dir.z * off };
    const vel: Vec3 = {
      x: dir.x * GRENADE.throwSpeed,
      y: dir.y * GRENADE.throwSpeed,
      z: dir.z * GRENADE.throwSpeed,
    };
    const gid = `${id}#${this.nadeSeq++}`;
    this.grenades.push({
      id: gid,
      owner: id,
      team: p.team,
      body: { pos, vel },
      boomTick: this.currentTick + Math.ceil(GRENADE.fuseMs / TICK_MS),
    });
    this.sendNear(
      "nadeSpawn",
      { id: gid, from: id, x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, fuseMs: GRENADE.fuseMs },
      pos.x,
      pos.z,
      { always: [id] },
    );
    this.markStateChanged();
  }

  /** Advance every grenade one tick; detonate the ones whose fuse elapsed. */
  private stepGrenades(dt: number, _now: number): void {
    const live: Grenade[] = [];
    for (const g of this.grenades) {
      if (this.currentTick >= g.boomTick) {
        this.explodeGrenade(g);
        continue;
      }
      const bounced = stepGrenade(
        g.body,
        dt,
        MOVE.gravity,
        GRENADE.restitution,
        GRENADE.projRadius,
        this.boxes,
        this.map.bounds,
      );
      if (bounced) {
        const { pos, vel } = g.body;
        this.sendNear(
          "nadeBounce",
          { id: g.id, x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z },
          pos.x,
          pos.z,
        );
      }
      live.push(g);
    }
    this.grenades = live;
  }

  /** Detonate: emit the boom, then apply radial AoE (enemies + self, LoS-checked). */
  private explodeGrenade(g: Grenade): void {
    const c = g.body.pos;
    this.sendNear("nadeBoom", { id: g.id, x: c.x, y: c.y, z: c.z, r: GRENADE.radius }, c.x, c.z);
    const teamless = !this.gameMode.teams;
    for (const [pid, p] of Object.entries(this.state.players)) {
      if (!p.alive || p.prot) continue;
      // Friendly fire off for teammates (matches bullets), but self-damage is on;
      // teamless modes (FFA) have no "teammates" to shield, so damage everyone.
      if (!teamless && p.team === g.team && pid !== g.owner) continue;
      const dx = p.x - c.x;
      const dy = p.y + this.height(p) / 2 - c.y; // measure to the victim's torso centre
      const dz = p.z - c.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist >= GRENADE.radius) continue;
      // Cover between the blast and the victim shields them.
      if (dist > 1e-3) {
        const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
        if (nearestBox(c, dir, this.hitBoxes, dist) < dist) continue;
      }
      const dmg = Math.round(blastDamage(GRENADE.maxDamage, GRENADE.radius, dist));
      if (dmg > 0) this.applyDamage(pid, dmg, g.owner, "blast");
    }
  }

  // --- damage / kills ---------------------------------------------------------

  private applyDamage(
    victimId: string,
    dmg: number,
    killerId: string,
    part: string,
    weaponSlot?: number,
  ): void {
    const victim = this.state.players[victimId];
    if (!victim || !victim.alive || victim.prot) return;
    victim.hp = Math.max(0, victim.hp - dmg);
    const now = Date.now();
    if (victim.hp > 0) {
      if (killerId !== victimId) this.recordHit(victimId, killerId, dmg, now);
      return;
    }

    const warmup = this.state.phase === "warmup";
    victim.alive = false;
    victim.reloadEnd = 0;
    this.reloadUntil.delete(victimId);
    this.vy.set(victimId, 0);
    const delayMs = warmup ? 0 : this.respawnMs;
    this.respawnAt.set(victimId, this.currentTick + Math.ceil(delayMs / TICK_MS));

    let assist: string | undefined;
    if (!warmup) {
      victim.d += 1;
      if (killerId !== victimId) {
        assist = this.assistFor(victimId, killerId, now);
        const killer = this.state.players[killerId];
        if (killer) {
          killer.k += 1;
          this.gameMode.onKill(this.modeCtx(), killerId, victimId);
        }
        this.bumpStreak(killerId);
      }
    }
    this.hits.delete(victimId);
    this.streaks.delete(victimId);

    // Structured log for offline map-timing/heatmap analysis (map-metrics tool test) —
    // collectible live via `wrangler tail` the same way hybridHit already is. Coordinates
    // rounded to 1 decimal to keep this cheap even if tail volume ever grows; kills are
    // low-frequency, so this is never spam.
    const killerP = this.state.players[killerId];
    console.log(
      JSON.stringify({
        tag: "killPos",
        mode: this.gameMode.id,
        weapon: weaponSlot ?? null,
        head: part === "head",
        vx: Math.round(victim.x * 10) / 10,
        vz: Math.round(victim.z * 10) / 10,
        kx: killerP ? Math.round(killerP.x * 10) / 10 : null,
        kz: killerP ? Math.round(killerP.z * 10) / 10 : null,
        vBot: this.botBrains.has(victimId),
        kBot: this.botBrains.has(killerId),
      }),
    );

    this.broadcast("kill", {
      killer: killerId,
      victim: victimId,
      part,
      killerTeam: this.state.players[killerId]?.team ?? null,
      assist,
    });
  }

  private recordHit(victimId: string, attackerId: string, dmg: number, at: number): void {
    const list = this.hits.get(victimId) ?? [];
    list.push({ attacker: attackerId, dmg, at });
    this.hits.set(victimId, list);
  }

  /** The non-killer attacker with the most damage on `victimId` inside {@link assistWindowMs}. */
  private assistFor(victimId: string, killerId: string, at: number): string | undefined {
    const list = this.hits.get(victimId);
    if (!list) return undefined;
    const cutoff = at - this.assistWindowMs;
    const totals = new Map<string, number>();
    for (const h of list) {
      if (h.at < cutoff || h.attacker === killerId) continue;
      totals.set(h.attacker, (totals.get(h.attacker) ?? 0) + h.dmg);
    }
    let best: string | undefined;
    let bestDmg = 0;
    for (const [attacker, dealt] of totals) {
      if (dealt > bestDmg) {
        best = attacker;
        bestDmg = dealt;
      }
    }
    return best;
  }

  /** killer's current kill streak; broadcasts `streak` on 3/5/8 (MATCH.killstreakThresholds). */
  private bumpStreak(killerId: string): void {
    const count = (this.streaks.get(killerId) ?? 0) + 1;
    this.streaks.set(killerId, count);
    if (MATCH.killstreakThresholds.includes(count)) {
      this.broadcast("streak", { id: killerId, count });
    }
  }

  // --- spawning / teams -------------------------------------------------------

  /** Assign the smaller team (ties → red) for balance. */
  private assignTeam(): number {
    let red = 0;
    let blue = 0;
    for (const p of Object.values(this.state.players)) {
      if (p.team === TEAM.red) red += 1;
      else blue += 1;
    }
    return red <= blue ? TEAM.red : TEAM.blue;
  }

  private spawnInto(p: ArenaPlayer, id: string): void {
    // Teamless modes (ffa) round-robin across both spawn pools combined, keyed
    // off a dedicated rotation slot rather than the (always-0) player team.
    const teamed = this.gameMode.teams;
    const points = teamed
      ? p.team === TEAM.red
        ? this.map.spawns.red
        : this.map.spawns.blue
      : [...this.map.spawns.red, ...this.map.spawns.blue];
    const rotKey = teamed ? p.team : -1;
    const i = this.spawnRot[rotKey] ?? 0;
    this.spawnRot[rotKey] = i + 1;
    const pt = this.map.presentation === "relay" && teamed
      ? chooseSafeSpawn(points, i, Object.entries(this.state.players).map(([id, player]) => ({ ...player, id })), id, p.team, this.boxes)
      : points[i % points.length]!;
    p.x = pt.x;
    p.y = 0;
    p.z = pt.z;
    p.hp = PLAYER.maxHp;
    p.alive = true;
    p.prot = true;
    p.crouch = false;
    p.yaw = p.team === TEAM.red ? GAME.teams.spawnFacingYaw[0] : GAME.teams.spawnFacingYaw[1];
    p.pitch = 0;
    // Loadout: spawn holding the chosen primary (default AR), full ammo on every
    // weapon, and a fresh set of grenades.
    p.weapon = this.primaryWeapon.get(id) ?? DEFAULT_WEAPON;
    p.nades = GRENADE.count;
    p.reloadEnd = 0;
    this.vy.set(id, 0);
    this.grounded.set(id, true);
    this.inputs.set(id, { ...NO_INPUT }); // drop a corpse's held keys
    this.protUntil.set(id, this.currentTick + Math.ceil(this.spawnProtectMs / TICK_MS));
    this.magByW.set(id, WEAPONS.map((wpn) => wpn.mag));
    this.reserveByW.set(id, WEAPONS.map((wpn) => wpn.reserve));
    this.reloadUntil.delete(id);
    this.lastShotAt.delete(id);
    this.swapUntil.delete(id);
    this.nadeReadyAt.delete(id);
    this.hits.delete(id);

    // Practice showcase bots ignore the round-robin pool above — pinned to their
    // demo spot every spawn (including auto-respawn after a stray kill, since this
    // is the one spawn path both addShowcaseBot and the tick's respawn loop share)
    // so the layout never drifts. Facing/crouch settle themselves: showcaseThink
    // drives both continuously via the normal input path (see bots.ts).
    const showcase = this.showcaseActive ? PRACTICE_SHOWCASE_BOTS.find((b) => b.id === id) : undefined;
    if (showcase) {
      p.x = showcase.x;
      p.z = showcase.z;
      p.yaw = PRACTICE_SHOWCASE_FACE_YAW;
    }
  }

  private handleRespawn(client: Client): void {
    const id = client.id;
    const p = this.state.players[id];
    if (!p || p.alive) return;
    const at = this.respawnAt.get(id);
    if (at !== undefined && this.currentTick < at) return; // still in the downed window
    this.respawnAt.delete(id);
    this.spawnInto(p, id);
    this.broadcast("respawn", { id });
    this.markStateChanged();
  }

  /** 1 vote per player; a majority of current seats during "ended" skips the
   *  intermission and heads straight into warmup (M2 µ2b contract). */
  private handleVoteRestart(client: Client): void {
    if (this.state.phase !== "ended") return;
    const id = client.id;
    if (!this.state.players[id]) return;
    this.restartVotes.add(id);
    // Filler bots never vote, so they must not inflate the quorum — count only
    // human seats (total seats minus the bot registry, the source of truth for
    // which ids are bots).
    const humanSeats = Object.keys(this.state.players).length - this.botBrains.size;
    const need = Math.floor(humanSeats / 2) + 1;
    this.broadcast("vote", { count: this.restartVotes.size, need });
    if (this.restartVotes.size >= need) this.enterWarmup();
  }

  // --- bots ---------------------------------------------------------------

  /** Patrol points bots path between: both spawn pools + the map's capture points
   *  (or that cap's `capWaypoints` override, for a cap whose own (x,z) sits inside
   *  solid geometry — see MapDef's doc comment), giving lane coverage without a
   *  dedicated waypoint table in arena1.ts/arena2.ts. */
  private botWaypoints(): { x: number; y: number }[] {
    const { spawns, caps, capWaypoints } = this.map;
    const capPts = [
      ...(capWaypoints?.a ?? [caps.a]),
      ...(capWaypoints?.b ?? [caps.b]),
      ...(capWaypoints?.c ?? [caps.c]),
    ];
    return [...spawns.red, ...spawns.blue, ...capPts].map((p) => ({ x: p.x, y: p.z }));
  }

  /** Lowest free `bot-N` id so a removed bot's number gets reused. */
  private nextBotId(): string {
    let n = 1;
    while (this.state.players[`bot-${n}`]) n += 1;
    return `bot-${n}`;
  }

  /** Fill to {@link MATCH.fillToPlayers} (real + bots). Real players are never
   *  removed; only bot seats are added/trimmed to hit the target. Practice fills
   *  from the fixed {@link PRACTICE_SHOWCASE_BOTS} roster instead of generic
   *  numbered combat bots (see addShowcaseBot). */
  private reconcileBots(): void {
    const ids = Object.keys(this.state.players);
    const botIds = ids.filter((id) => id.startsWith("bot-"));
    const target = this.fillToPlayers;
    const showcase = this.showcaseActive;

    let deficit = target - ids.length;
    while (deficit > 0) {
      if (showcase) {
        const def = PRACTICE_SHOWCASE_BOTS.find((b) => !this.state.players[b.id]);
        if (!def) break; // roster exhausted — shouldn't happen given fillToPlayers's derivation
        this.addShowcaseBot(def);
      } else {
        this.addBot();
      }
      deficit -= 1;
    }

    let surplus = ids.length - target;
    for (const id of botIds) {
      if (surplus <= 0) break;
      this.removeBot(id);
      surplus -= 1;
    }
  }

  private addBot(): void {
    const id = this.nextBotId();
    const team = this.gameMode.teams ? this.assignTeam() : 0;
    const p = this.initPlayer(id, team);
    const n = Number(id.slice(4));
    this.botBrains.set(id, createBotBrain({ seed: (this.state.seed + n) || 1, waypoints: this.botWaypoints() }));
    this.spawnInto(p, id);
    this.markStateChanged();
  }

  /** Practice-only: adds one fixed-role showcase bot (see modes.ts's
   *  {@link PRACTICE_SHOWCASE_BOTS}) — a stationary role gets a single-point
   *  "waypoint" (already at it, so advanceWaypoint never has anywhere to send
   *  it), a pacing role gets its home ∓ amplitude along Z as a 2-point patrol. */
  private addShowcaseBot(def: ShowcaseBotDef): void {
    const p = this.initPlayer(def.id, 0);
    const waypoints =
      def.amp > 0
        ? [
            { x: def.x, y: def.z - def.amp },
            { x: def.x, y: def.z + def.amp },
          ]
        : [{ x: def.x, y: def.z }];
    const seed = this.state.seed + PRACTICE_SHOWCASE_BOTS.indexOf(def) + 1;
    this.botBrains.set(def.id, createBotBrain({ seed: seed || 1, waypoints }));
    this.spawnInto(p, def.id);
    this.markStateChanged();
  }

  private removeBot(id: string): void {
    delete this.state.players[id];
    this.botBrains.delete(id);
    this.grenades = this.grenades.filter((g) => g.owner !== id);
    for (const m of [
      this.inputs,
      this.vy,
      this.grounded,
      this.magByW,
      this.reserveByW,
      this.reloadUntil,
      this.lastShotAt,
      this.swapUntil,
      this.nadeReadyAt,
      this.primaryWeapon,
      this.respawnAt,
      this.protUntil,
      this.hits,
      this.streaks,
    ]) {
      m.delete(id);
    }
    this.markStateChanged();
  }

  /** Drive every living bot's AI this tick: sets its held move input (consumed by
   *  {@link integrate} right after this runs) and look, and fires/switches through
   *  the same paths a real client's messages would hit. */
  private tickBots(dtMs: number): void {
    if (this.botBrains.size === 0) return;
    for (const [id, brain] of this.botBrains) {
      const self = this.state.players[id];
      if (!self || !self.alive) continue;
      const decision = botThink(this.botView(id, self), brain, dtMs);
      this.inputs.set(id, {
        mx: decision.move.mx,
        mz: decision.move.mz,
        jump: decision.move.jump,
        crouch: decision.move.crouch,
        sprint: decision.move.sprint,
      });
      self.yaw = ((decision.look.yaw % TAU) + TAU) % TAU;
      self.pitch = clamp(decision.look.pitch, -PITCH_LIMIT, PITCH_LIMIT);
      if (decision.switchSlot !== undefined) this.botSwitch(id, decision.switchSlot);
      if (decision.fire) this.botFire(id);
    }
  }

  private botView(id: string, self: ArenaPlayer): BotView {
    const ffa = !this.gameMode.teams;
    const enemies: BotView["enemies"][number][] = [];
    for (const [pid, p] of Object.entries(this.state.players)) {
      if (pid === id || !p.alive) continue;
      if (!ffa && p.team === self.team) continue;
      enemies.push({ id: pid, x: p.x, y: p.y, z: p.z, crouch: p.crouch, alive: p.alive, team: p.team });
    }
    return {
      self: {
        x: self.x,
        y: self.y,
        z: self.z,
        crouch: self.crouch,
        alive: self.alive,
        team: self.team,
        yaw: self.yaw,
        pitch: self.pitch,
      },
      enemies,
      teamless: ffa,
      boxes: this.hitBoxes,
      navigate: this.navigator ? target => this.navigator!.next(self, target) : undefined,
      objective: this.gameMode.id === "dom" ? this.domObjectiveFor(self) : undefined,
      showcase: this.showcaseActive ? this.showcaseViewFor(id) : undefined,
    };
  }

  /** Practice-only: this bot id's {@link ShowcaseView}, or undefined if `id` isn't
   *  in the showcase roster (shouldn't happen — every practice bot comes from
   *  addShowcaseBot — but this stays a lookup rather than an assumption). */
  private showcaseViewFor(id: string): { role: ShowcaseBotDef["role"]; faceYaw: number } | undefined {
    const def = PRACTICE_SHOWCASE_BOTS.find((b) => b.id === id);
    return def ? { role: def.role, faceYaw: PRACTICE_SHOWCASE_FACE_YAW } : undefined;
  }

  /** DOM-only: the nearest reachable point (a `capWaypoints` anchor, else the
   *  cap's own centre) among capture points this bot's team hasn't fully secured
   *  yet (red targets gauge<200, blue targets gauge>0). undefined once every
   *  point is already owned in this bot's favour — botThink then falls back to
   *  plain waypoint patrol. "Nearest" ranks by distance from the bot to each
   *  candidate anchor, not the cap's raw centre, so it picks whichever approach
   *  side is actually closest for a multi-anchor cap (e.g. cap B's two sides). */
  private domObjectiveFor(self: ArenaPlayer): { x: number; z: number } | undefined {
    const caps: { key: "a" | "b" | "c"; point: Vec3; gauge: number }[] = [
      { key: "a", point: this.map.caps.a, gauge: this.state.capA },
      { key: "b", point: this.map.caps.b, gauge: this.state.capB },
      { key: "c", point: this.map.caps.c, gauge: this.state.capC },
    ];
    let best: { x: number; z: number } | undefined;
    let bestDist = Infinity;
    for (const { key, point, gauge } of caps) {
      const incomplete = self.team === TEAM.red ? gauge < 200 : gauge > 0;
      if (!incomplete) continue;
      const anchors = this.map.capWaypoints?.[key] ?? [point];
      for (const a of anchors) {
        const d = Math.hypot(a.x - self.x, a.z - self.z);
        if (d < bestDist) {
          bestDist = d;
          best = { x: a.x, z: a.z };
        }
      }
    }
    return best;
  }

  /** Reuses {@link handleFire} with a stand-in client — bots have no real socket,
   *  and a fixed `ts: now` gives them zero simulated latency (rewind reads it as
   *  the subtick instant instead of estimating from RTT). */
  private botFire(id: string): void {
    const client = { id, rttMs: 0, send: () => {} } as unknown as Client;
    // Bots have no rendered scene to raycast — no `payload`/claim, so this
    // always takes the analytic `resolveHitscan` path, unchanged from before.
    this.handleFire(client, undefined, { ts: Date.now() } as unknown as InputMeta);
  }

  private botSwitch(id: string, slot: number): void {
    const client = { id, rttMs: 0, send: () => {} } as unknown as Client;
    this.handleSwitch(client, { slot });
  }

  // --- match flow -------------------------------------------------------------

  private endMatch(winner?: string): void {
    const { redScore, blueScore } = this.state;
    const w = winner ?? (redScore > blueScore ? "red" : blueScore > redScore ? "blue" : "draw");
    this.state.phase = "ended";
    this.endedUntil = this.currentTick + Math.ceil(this.intermissionMs / TICK_MS);
    this.restartVotes.clear();
    this.roundResult = { winner: w, red: redScore, blue: blueScore };
    this.broadcast("matchEnd", this.roundResult);
  }

  /** Warmup: waits for {@link warmupMinPlayers}, then counts down {@link warmupMs} before a full
   *  reset into "live" (a lone player stays in warmup indefinitely — practice mode). */
  private tickWarmup(now: number): void {
    const seats = Object.keys(this.state.players).length;
    if (seats < this.warmupMinPlayers) {
      this.warmupUntil = undefined;
      return;
    }
    if (this.warmupUntil === undefined) {
      this.warmupUntil = this.currentTick + Math.ceil(this.warmupMs / TICK_MS);
      return;
    }
    if (this.currentTick >= this.warmupUntil) {
      this.warmupUntil = undefined;
      this.resetMatch(now);
    }
  }

  /** Post-match → warmup (not straight to "live"): routes through the same
   *  min-players/countdown gate as room creation (M2 µ2b). */
  private enterWarmup(): void {
    this.endedUntil = undefined;
    this.warmupUntil = undefined;
    this.restartVotes.clear();
    this.state.phase = "warmup";
  }

  /** Build the read/write surface a {@link GameMode} needs for this tick. */
  private modeCtx(): ModeCtx {
    return {
      state: this.state,
      now: Date.now(),
      broadcast: (type, payload) => this.broadcast(type, payload),
      playersAt: (x, z, r) => {
        const out: { id: string; team: number; alive: boolean }[] = [];
        for (const [id, p] of Object.entries(this.state.players)) {
          if (Math.hypot(p.x - x, p.z - z) <= r) out.push({ id, team: p.team, alive: p.alive });
        }
        return out;
      },
    };
  }

  private resetMatch(now: number): void {
    this.roundResult = null;
    this.state.redScore = 0;
    this.state.blueScore = 0;
    this.state.capA = GAME.match.capNeutral;
    this.state.capB = GAME.match.capNeutral;
    this.state.capC = GAME.match.capNeutral;
    this.state.phase = "live";
    this.state.matchEndMs = now + this.matchTimeMs;
    this.endedUntil = undefined;
    this.streaks.clear();
    this.hits.clear();
    for (const [id, p] of Object.entries(this.state.players)) {
      p.k = 0;
      p.d = 0;
      this.respawnAt.delete(id);
      this.spawnInto(p, id);
    }
  }
}
