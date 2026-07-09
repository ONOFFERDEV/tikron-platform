import {
  IoArenaRoom,
  LagCompensator,
  type AOIConfig,
  type Client,
  type InputMeta,
} from "@tikron/server";
import { xorshift32, type Vec2 } from "@tikron/sim";
import { ArenaSchema, type ArenaState, type ArenaPlayer } from "../schema.js";
import { ARENA, AR, LAG, MATCH, MOVE, PLAYER, TEAM, TICK_MS } from "../config.js";
import { canStand, moveAndSlide, nearestBox, type Box, type Vec3 } from "../physics.js";
import { resolveHitscan, type HitTarget } from "../hitscan.js";
import { ARENA1_BOUNDS, ARENA1_BOXES, ARENA1_SPAWNS } from "../map/arena1.js";

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

  // --- server-only per-player sim state (never synced) ---
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly vy = new Map<string, number>();
  private readonly grounded = new Map<string, boolean>();
  private readonly ammoMag = new Map<string, number>();
  private readonly ammoReserve = new Map<string, number>();
  private readonly reloadUntil = new Map<string, number>(); // epoch ms; absent = not reloading
  private readonly lastShotAt = new Map<string, number>(); // epoch ms
  private readonly respawnAt = new Map<string, number>(); // sim tick
  private readonly protUntil = new Map<string, number>(); // sim tick

  /** Vertical lag-comp channel: id → {x: feetY, y: headY}. Paired with {@link rewind}. */
  private vertLag = new LagCompensator({ depthMs: LAG.depthMs });
  /** Round-robin spawn cursor per team, so successive spawns don't stack. */
  private readonly spawnRot: Record<number, number> = { [TEAM.red]: 0, [TEAM.blue]: 0 };
  /** Sim tick the post-match intermission ends and the arena resets (phase "ended"). */
  private endedUntil: number | undefined;
  /** Deterministic PRNG for per-shot spread (seeded from state.seed in onReady). */
  private spreadRng: () => number = xorshift32(1);

  private readonly boxes: readonly Box[] = ARENA1_BOXES;

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
      phase: "live",
      matchEndMs: Date.now() + this.matchTimeMs,
    });

    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("look", (client, payload) => this.handleLook(client, payload));
    this.onMessage("fire", (client, payload, _seq, input) => this.handleFire(client, input));
    this.onMessage("reload", (client) => this.handleReload(client));
    this.onMessage("respawn", (client) => this.handleRespawn(client));
  }

  override onJoin(client: Client): void {
    const team = this.assignTeam();
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
    };
    this.state.players[client.id] = p;
    this.inputs.set(client.id, { ...NO_INPUT });
    this.spawnInto(p, client.id);
    this.markStateChanged();
  }

  protected override onSeatExpired(client: Client): void {
    const id = client.id;
    delete this.state.players[id];
    for (const m of [
      this.inputs,
      this.vy,
      this.grounded,
      this.ammoMag,
      this.ammoReserve,
      this.reloadUntil,
      this.lastShotAt,
      this.respawnAt,
      this.protUntil,
    ]) {
      m.delete(id);
    }
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

    // Match clock / win condition.
    if (this.state.phase === "live") {
      if (
        this.state.redScore >= this.killTarget ||
        this.state.blueScore >= this.killTarget ||
        now >= this.state.matchEndMs
      ) {
        this.endMatch();
      }
    } else if (this.endedUntil !== undefined && this.currentTick >= this.endedUntil) {
      this.resetMatch(now);
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
      if (canStand(p.x, p.y, p.z, PLAYER.radius, PLAYER.standHeight, this.boxes, ARENA1_BOUNDS)) {
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
      ARENA1_BOUNDS,
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
    const last = this.lastShotAt.get(id);
    if (last !== undefined && now - last < AR.fireIntervalMs) return; // server fire-rate cap

    // Ammo (server-authoritative). Reloading blocks; an empty mag auto-reloads.
    const done = this.reloadUntil.get(id);
    if (done !== undefined) {
      if (now < done) return; // mid-reload
      this.reloadUntil.delete(id);
      this.finishReload(id);
    }
    const mag = this.ammoMag.get(id) ?? AR.mag;
    if (mag <= 0) {
      this.startReload(id, now);
      return;
    }
    this.ammoMag.set(id, mag - 1);
    this.lastShotAt.set(id, now);
    client.send("ammo", { mag: mag - 1, reserve: this.ammoReserve.get(id) ?? 0 });

    // Firing ends spawn protection early (no shooting from behind the shield).
    if (shooter.prot) {
      shooter.prot = false;
      this.protUntil.delete(id);
    }

    const origin: Vec3 = { x: shooter.x, y: shooter.y + this.eyeHeight(shooter), z: shooter.z };
    const dir = this.aimDir(id, shooter);

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

    const hit = resolveHitscan(origin, dir, AR.range, shooter.team, targets, this.boxes, {
      radius: PLAYER.radius,
      headRadius: PLAYER.headRadius,
    });

    const dist = hit ? hit.t : Math.min(AR.range, nearestBox(origin, dir, this.boxes, AR.range));
    this.sendNear(
      "shot",
      {
        from: id,
        ox: origin.x,
        oy: origin.y,
        oz: origin.z,
        dx: dir.x,
        dy: dir.y,
        dz: dir.z,
        dist,
        hit: hit !== null,
      },
      origin.x,
      origin.z,
      { always: [id, ...(hit ? [hit.id] : [])] },
    );

    if (hit) {
      const dmg = hit.part === "head" ? AR.damageHead : AR.damageBody;
      this.applyDamage(hit.id, dmg, id, hit.part);
      client.send("hit", { victim: hit.id, dmg, head: hit.part === "head" });
    }
    this.markStateChanged();
  }

  /** Aim unit vector from yaw/pitch, widened by spread when moving/airborne. */
  private aimDir(id: string, p: ArenaPlayer): Vec3 {
    let yaw = p.yaw;
    let pitch = p.pitch;
    const inp = this.inputs.get(id);
    const grounded = this.grounded.get(id) ?? true;
    const moving = inp ? inp.mx !== 0 || inp.mz !== 0 : false;
    const spread = !grounded ? AR.spreadAir : moving ? AR.spreadMove : AR.spreadStill;
    if (spread > 0) {
      yaw += (this.spreadRng() / 0xffffffff - 0.5) * 2 * spread;
      pitch += (this.spreadRng() / 0xffffffff - 0.5) * 2 * spread;
    }
    const cp = Math.cos(pitch);
    return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
  }

  private handleReload(client: Client): void {
    const id = client.id;
    const p = this.state.players[id];
    if (!p || !p.alive) return;
    if (this.reloadUntil.has(id)) return; // already reloading
    if ((this.ammoMag.get(id) ?? AR.mag) >= AR.mag) return; // full
    if ((this.ammoReserve.get(id) ?? 0) <= 0) return; // no spare rounds
    this.startReload(id, Date.now());
  }

  private startReload(id: string, now: number): void {
    if ((this.ammoReserve.get(id) ?? 0) <= 0) return;
    if (this.reloadUntil.has(id)) return;
    this.reloadUntil.set(id, now + AR.reloadMs);
    const client = this.clientList().find((c) => c.id === id);
    client?.send("ammo", { mag: this.ammoMag.get(id) ?? 0, reserve: this.ammoReserve.get(id) ?? 0, reloadMs: AR.reloadMs });
  }

  private finishReload(id: string): void {
    const mag = this.ammoMag.get(id) ?? 0;
    const reserve = this.ammoReserve.get(id) ?? 0;
    const need = AR.mag - mag;
    const take = Math.min(need, reserve);
    this.ammoMag.set(id, mag + take);
    this.ammoReserve.set(id, reserve - take);
    const client = this.clientList().find((c) => c.id === id);
    client?.send("ammo", { mag: mag + take, reserve: reserve - take });
  }

  // --- damage / kills ---------------------------------------------------------

  private applyDamage(victimId: string, dmg: number, killerId: string, part: string): void {
    const victim = this.state.players[victimId];
    if (!victim || !victim.alive || victim.prot) return;
    victim.hp = Math.max(0, victim.hp - dmg);
    if (victim.hp > 0) return;

    victim.alive = false;
    victim.d += 1;
    this.vy.set(victimId, 0);
    this.respawnAt.set(victimId, this.currentTick + Math.ceil(this.respawnMs / TICK_MS));

    if (killerId !== victimId) {
      const killer = this.state.players[killerId];
      if (killer) {
        killer.k += 1;
        if (killer.team === TEAM.red) this.state.redScore += 1;
        else this.state.blueScore += 1;
      }
    }
    this.broadcast("kill", {
      killer: killerId,
      victim: victimId,
      part,
      killerTeam: this.state.players[killerId]?.team ?? null,
    });
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
    const points = p.team === TEAM.red ? ARENA1_SPAWNS.red : ARENA1_SPAWNS.blue;
    const i = this.spawnRot[p.team] ?? 0;
    this.spawnRot[p.team] = i + 1;
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
    this.vy.set(id, 0);
    this.grounded.set(id, true);
    this.inputs.set(id, { ...NO_INPUT }); // drop a corpse's held keys
    this.protUntil.set(id, this.currentTick + Math.ceil(this.spawnProtectMs / TICK_MS));
    this.ammoMag.set(id, AR.mag);
    this.ammoReserve.set(id, AR.reserve);
    this.reloadUntil.delete(id);
    this.lastShotAt.delete(id);
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

  // --- match flow -------------------------------------------------------------

  private endMatch(): void {
    const { redScore, blueScore } = this.state;
    const winner = redScore > blueScore ? "red" : blueScore > redScore ? "blue" : "draw";
    this.state.phase = "ended";
    this.endedUntil = this.currentTick + Math.ceil(this.intermissionMs / TICK_MS);
    this.broadcast("matchEnd", { winner, red: redScore, blue: blueScore });
  }

  private resetMatch(now: number): void {
    this.state.redScore = 0;
    this.state.blueScore = 0;
    this.state.phase = "live";
    this.state.matchEndMs = now + this.matchTimeMs;
    this.endedUntil = undefined;
    for (const [id, p] of Object.entries(this.state.players)) {
      p.k = 0;
      p.d = 0;
      this.respawnAt.delete(id);
      this.spawnInto(p, id);
    }
  }
}
