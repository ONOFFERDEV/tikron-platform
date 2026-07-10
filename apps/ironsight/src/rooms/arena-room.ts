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
  DEFAULT_WEAPON,
  GRENADE,
  LAG,
  MATCH,
  MOVE,
  PISTOL_INDEX,
  PLAYER,
  TEAM,
  TICK_MS,
  WEAPON,
  WEAPONS,
  type WeaponSpec,
} from "../config.js";
import { canStand, moveAndSlide, nearestBox, type Box, type Vec3 } from "../physics.js";
import { resolveHitscan, type HitTarget } from "../hitscan.js";
import { accuracySpread, dirFromAngles, falloffMul, pelletPattern } from "../weapons.js";
import { blastDamage, stepGrenade, type GrenadeBody } from "../grenade.js";
import type { MapDef } from "../map/types.js";
import { modeFromRoomId, modeIndex, mapForMode, type GameMode, type ModeCtx } from "../modes.js";
import { botThink, createBotBrain, type BotBrain, type BotView } from "../bots.js";

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
    viewRadius: 100,
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
  private readonly restartVotes = new Set<string>();
  /** Recent non-lethal damage per victim, for assist attribution: victim → [{attacker, dmg, at}]. */
  private readonly hits = new Map<string, { attacker: string; dmg: number; at: number }[]>();
  /** Current consecutive-kill count per killer id (reset when that player dies). */
  private readonly streaks = new Map<string, number>();
  /** Deterministic PRNG for per-shot spread (seeded from state.seed in onReady). */
  private spreadRng: () => number = xorshift32(1);

  /** This room's game mode, chosen from the room id (e.g. "arena-ffa" → FFA). */
  private readonly gameMode: GameMode = modeFromRoomId(this.id);

  /** This room's map, resolved once from its mode (tdm/ffa → arena1, dom → arena2). */
  private readonly map: MapDef = mapForMode(this.gameMode.id);
  private readonly boxes: readonly Box[] = this.map.boxes;

  protected override onReady(): void {
    this.maxClients = MATCH.maxClients;
    // The move+look stream runs ~ per-tick (20–30 Hz) plus fire — keep headroom
    // over the 30/s default so inputs are never silently rate-dropped.
    this.maxInputsPerSecond = 90;

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
      capA: 100,
      capB: 100,
      capC: 100,
    });

    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("look", (client, payload) => this.handleLook(client, payload));
    this.onMessage("fire", (client, payload, _seq, input) => this.handleFire(client, input));
    this.onMessage("reload", (client) => this.handleReload(client));
    this.onMessage("switch", (client, payload) => this.handleSwitch(client, payload));
    this.onMessage("nade", (client) => this.handleNade(client));
    this.onMessage("loadout", (client, payload) => this.handleLoadout(client, payload));
    this.onMessage("respawn", (client) => this.handleRespawn(client));
    this.onMessage("voteRestart", (client) => this.handleVoteRestart(client));
  }

  override onJoin(client: Client): void {
    const team = this.gameMode.teams ? this.assignTeam() : 0;
    const p = this.initPlayer(client.id, team);
    this.spawnInto(p, client.id);
    this.markStateChanged();
  }

  /** Shared player-record init for real joins and bot fills (team assignment stays
   *  in the caller so both paths go through the same balance logic). */
  private initPlayer(id: string, team: number): ArenaPlayer {
    const p: ArenaPlayer = {
      x: 0,
      z: 0,
      y: 0,
      yaw: team === TEAM.red ? Math.PI / 2 : (3 * Math.PI) / 2,
      pitch: 0,
      hp: PLAYER.maxHp,
      team,
      alive: true,
      crouch: false,
      prot: true,
      k: 0,
      d: 0,
      weapon: DEFAULT_WEAPON,
      nades: GRENADE.count,
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
    // preset right after this returns — same cadence, same Date.now()).
    const vsnap = new Map<string, Vec2>();
    for (const [id, p] of Object.entries(this.state.players)) {
      if (p.alive && !p.prot) vsnap.set(id, { x: p.y, y: p.y + this.height(p) });
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

  private handleFire(client: Client, input?: InputMeta): void {
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
    // supplied one, else the RTT + interpolation estimate.
    const at = input?.ts ?? now - client.rttMs - this.lagInterpolationMs;
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

    // Fire the weapon's pellets: a fixed pattern (the shotgun's spread) plus a
    // per-ray accuracy-cone jitter (movement penalty). Per-pellet damage scales
    // with range (falloff), and pellets on the same victim stack into one hit.
    const inp = this.inputs.get(id);
    const grounded = this.grounded.get(id) ?? true;
    const moving = inp ? inp.mx !== 0 || inp.mz !== 0 : false;
    const acc = accuracySpread(spec, moving, grounded);
    const cfg = { radius: PLAYER.radius, headRadius: PLAYER.headRadius };

    const dmgByVictim = new Map<string, { dmg: number; head: boolean }>();
    let nearestHitT = Infinity;
    for (const off of pelletPattern(spec)) {
      const dir = dirFromAngles(shooter.yaw + off.dyaw + this.jitter(acc), shooter.pitch + off.dpitch + this.jitter(acc));
      const hit = resolveHitscan(
        origin,
        dir,
        spec.range,
        shooter.team,
        targets,
        this.boxes,
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

    // One shot event per trigger pull (base aim ray → muzzle flash + tracer); the
    // tracer reaches the nearest pellet impact, else the map-occlusion distance.
    const baseDir = dirFromAngles(shooter.yaw, shooter.pitch);
    const dist =
      nearestHitT < Infinity
        ? nearestHitT
        : Math.min(spec.range, nearestBox(origin, baseDir, this.boxes, spec.range));
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
      },
      origin.x,
      origin.z,
      { always: [id, ...victims] },
    );

    for (const [vid, agg] of dmgByVictim) {
      const dmg = Math.round(agg.dmg);
      if (dmg <= 0) continue;
      this.applyDamage(vid, dmg, id, agg.head ? "head" : "body");
      client.send("hit", { victim: vid, dmg, head: agg.head });
    }
    this.markStateChanged();
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

  /** Symmetric spread offset (rad) for a cone half-angle; 0 → pinpoint (deterministic). */
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
    const pos: Vec3 = { x: p.x + dir.x * 0.6, y: eye + dir.y * 0.6, z: p.z + dir.z * 0.6 };
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
        if (nearestBox(c, dir, this.boxes, dist) < dist) continue;
      }
      const dmg = Math.round(blastDamage(GRENADE.maxDamage, GRENADE.radius, dist));
      if (dmg > 0) this.applyDamage(pid, dmg, g.owner, "blast");
    }
  }

  // --- damage / kills ---------------------------------------------------------

  private applyDamage(victimId: string, dmg: number, killerId: string, part: string): void {
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
    const pt = points[i % points.length]!;
    p.x = pt.x;
    p.y = 0;
    p.z = pt.z;
    p.hp = PLAYER.maxHp;
    p.alive = true;
    p.prot = true;
    p.crouch = false;
    p.yaw = p.team === TEAM.red ? Math.PI / 2 : (3 * Math.PI) / 2;
    p.pitch = 0;
    // Loadout: spawn holding the chosen primary (default AR), full ammo on every
    // weapon, and a fresh set of grenades.
    p.weapon = this.primaryWeapon.get(id) ?? DEFAULT_WEAPON;
    p.nades = GRENADE.count;
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
   *  removed; only bot seats are added/trimmed to hit the target. */
  private reconcileBots(): void {
    const ids = Object.keys(this.state.players);
    const botIds = ids.filter((id) => id.startsWith("bot-"));
    const target = this.fillToPlayers;

    let deficit = target - ids.length;
    while (deficit > 0) {
      this.addBot();
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
      self: { x: self.x, y: self.y, z: self.z, crouch: self.crouch, alive: self.alive, team: self.team },
      enemies,
      teamless: ffa,
      boxes: this.boxes,
      objective: this.gameMode.id === "dom" ? this.domObjectiveFor(self) : undefined,
    };
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
    this.handleFire(client, { ts: Date.now() } as unknown as InputMeta);
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
    this.broadcast("matchEnd", { winner: w, red: redScore, blue: blueScore });
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
    this.state.redScore = 0;
    this.state.blueScore = 0;
    this.state.capA = 100;
    this.state.capB = 100;
    this.state.capC = 100;
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
