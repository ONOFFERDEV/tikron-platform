import { IoArenaRoom, type AOIConfig, type Client, type InputMeta } from "@tikron/server";
import { MoveBudget, resolveMovement, type Vec2 } from "@tikron/sim";
import {
  ShooterSchema,
  SHOOTER,
  SHOOTER_PROFILE,
  WEAPONS,
  type ShooterState,
} from "./shooter-schema.js";
import { pickSpawn, makeRng, type SpawnConfig } from "./shooter-spawn.js";
import { makeCrates, rayCoverHit, shotBlocked, type Crate, pushOutOfCrates } from "./shooter-crates.js";
import { makePickups, type PickupSpot } from "./shooter-map.js";
import { sanitizeNick } from "./shooter-nick.js";

/**
 * FPS proof-of-concept — a top-down hitscan shooter on the {@link IoArenaRoom}
 * preset. This demo exists to *dogfood* the F3 FPS layer end-to-end on Cloudflare
 * Durable Objects:
 *
 * - **Subtick input timestamps + server-side lag compensation.** A `shoot` input
 *   carries the client's server-clock time (`input.ts`); the room {@link rewind}s
 *   the world to that exact instant before the hitscan, so a high-latency shooter
 *   still hits the target where it was on their screen (the CS2 model). This is
 *   the whole point of the demo — hit registration that survives real RTT.
 * - **Position/aim quantization** (see the codec) to shrink the state stream.
 * - **AOI** so each client only receives players in view (bandwidth + anti-wallhack).
 *
 * The "fun" pass layers a full game loop on top, all server-authoritative:
 * three weapons, spawn protection, seed-derived pickups (health / damage boost),
 * destructible crate cover with movement collision, a shrinking zone, and
 * 5-minute rounds with a winner announcement. Static geometry (crates, pickup spots) is derived
 * from `state.seed` on BOTH sides, so none of it costs wire bytes.
 */

/**
 * Elapsed-time clamp bounds for the per-move speed budget (see `handleMove`).
 * Budgeting by the *measured* elapsed time since the client's previous move
 * absorbs send-timer jitter; the clamp keeps it cheat-safe (lower bound: a burst
 * can't claim near-zero deltas; upper bound: a forged `ts` buys ≤ 2 ticks once —
 * the reference is monotonic and the core clamps `ts` to [now-250ms, now]). The
 * aggregate {@link MoveBudget} bucket bounds the SUM of grants on top.
 */
const MOVE_DELTA_MIN_MS = SHOOTER.stepMs * 0.5;
const MOVE_DELTA_MAX_MS = SHOOTER.stepMs * 2;

/**
 * Room loop cadence: 60 Hz (LAT-2 C2; was 30). The IoArena preset runs onTick,
 * records lag-comp snapshots AND flushes state once per `tickMs` — so this (not
 * `syncIntervalMs` alone) is what sets the network update rate. Inputs process
 * on arrival (queueInputs=false), so the loop no longer gates input latency —
 * only remote-state freshness. Server processing measured ~0 ms at 100p, so the
 * doubled flush cadence spends bandwidth (gated by loadtest), not CPU.
 */
const LOOP_MS = 16;
/** Downed time in loop ticks (≈1.5 s). */
const RESPAWN_LOOPS = Math.ceil(SHOOTER.respawnMs / LOOP_MS);
/** Spawn protection, zone damage cadence and boost duration in loop ticks. */
const SPAWN_PROT_LOOPS = Math.ceil(SHOOTER.spawnProtectMs / LOOP_MS);
const ZONE_DMG_LOOPS = Math.ceil(SHOOTER.zoneDamageEveryMs / LOOP_MS);
const DMG_BOOST_LOOPS = Math.ceil(SHOOTER.dmgBoostMs / LOOP_MS);
const PICKUP_RESPAWN_LOOPS = Math.ceil(SHOOTER.pickupRespawnMs / LOOP_MS);
/** The zone's opening radius — covers the whole map from any allowed centre. */
const ZONE_START_RADIUS = 3200;

function isVec2(v: unknown): v is { x: number; y: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).x === "number" &&
    typeof (v as Record<string, unknown>).y === "number"
  );
}

function readNum(o: unknown, key: string): number | undefined {
  if (typeof o !== "object" || o === null) return undefined;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class ShooterRoomImpl extends IoArenaRoom<ShooterState> {
  protected readonly codec = ShooterSchema;
  protected override tickMs = LOOP_MS;
  // Must be ≤ tickMs: the default 50 ms coalesce window would throttle the
  // 30 Hz per-tick flushes right back down to 20 Hz.
  protected override syncIntervalMs = LOOP_MS;
  // The reason this demo exists: rewind hit checks to the shooter's subtick instant.
  protected override lagCompensation = true;
  // Conditional lag compensation: rewind history is capped at ~4 ticks, so a
  // shooter with RTT beyond ~200 ms gets compensation clamped to the oldest
  // snapshot instead of full favor-the-shooter. Bounds how far back a low-ping
  // victim can be killed from (the peeker's-advantage ceiling).
  protected override lagCompensationDepthMs = 200;
  protected override aoi: AOIConfig<ShooterState> = {
    viewRadius: SHOOTER.viewRadius,
    mapFields: ["players"],
    position: (e) => e as Vec2,
    viewer: (s, id) => s.players[id] ?? null,
    // Priority tiers (Tribes/Halo): players inside 450u refresh every flush; the
    // 450–900u band drops to 1/2 rate — this is what pays for the wider view
    // radius. Non-player fields (pickups, broken, zone, round) are NOT
    // AOI-filtered — they are global, low-churn game state.
    tiers: [
      { radius: 450, interval: 1 },
      { radius: 900, interval: 2 },
    ],
  };

  // playerId -> simulation tick at which a downed player respawns.
  private readonly respawnAt = new Map<string, number>();
  // playerId -> server-timeline ms of the last processed move (the input's clamped
  // subtick `ts` when supplied, else receipt time). Drives the elapsed-time budget.
  private readonly lastMoveAt = new Map<string, number>();
  // playerId -> aggregate movement-time bucket (bounds the SUM of per-move grants).
  private readonly moveBudget = new Map<string, MoveBudget>();
  // playerId -> receipt ms (server clock, unforgeable) of the last accepted shot.
  private readonly lastShotAt = new Map<string, number>();
  // playerId -> loop tick when spawn protection / damage boost expires.
  private readonly protUntil = new Map<string, number>();
  private readonly boostUntil = new Map<string, number>();
  // crate index -> remaining hits before it breaks (absent = full crateHp).
  private readonly crateHpLeft = new Map<number, number>();
  // pickup spot index -> loop tick when it re-arms.
  private readonly pickupRespawnAt = new Map<number, number>();
  // Deterministic PRNG for spread-spawn placement, seeded per room from `seed`.
  private rng: () => number = makeRng(0);
  // Seed-derived geometry, memoized against the seed (NOT built in onReady) so a
  // DO cold-start that RESTORED a persisted state rebuilds the exact layout the
  // room's clients are already rendering.
  private crateCache: { seed: number; crates: Crate[] } | null = null;
  private pickupCache: { seed: number; spots: PickupSpot[] } | null = null;
  private readonly spawnCfg: SpawnConfig = {
    world: SHOOTER.world,
    minSeparation: SHOOTER.spawnMinSep,
    ringMin: SHOOTER.spawnRingMin,
    ringMax: SHOOTER.spawnRingMax,
    centerJitter: SHOOTER.spawnCenterJitter,
  };

  protected override onReady(): void {
    this.maxClients = 64; // room-enforced cap; matches the demo's matchmake max=64
    // LAT-2 C1 (revised by measurement): keep the tick-aligned input queue. At a
    // 60 Hz loop the drain costs a mean of only 8 ms — while `queueInputs = false`
    // (tried first) sent every input's ack as its own write on top of the 60 Hz
    // flush fan-out (~8k sends/s at 100p) and REGRESSED ack p50 70.6→90.7 ms with
    // 152 >1s stalls (results/lat2-100p-fps.json). Drain-batched acks coalesce
    // those writes; the queue is the cheaper ack path at this loop rate.
    // The core default (30 msg/s) leaves only 10 msg/s beyond the 30 Hz move stream —
    // keep enough headroom that SMG fire never drops moves.
    this.maxInputsPerSecond = 90;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.rng = makeRng(seed);
    const zone = this.newZoneCenter();
    const pickups: ShooterState["pickups"] = {};
    for (let i = 0; i < SHOOTER.pickupCount; i++) pickups[String(i)] = { on: true };
    this.setState({
      players: {},
      seed,
      pickups,
      broken: {},
      zx: zone.x,
      zy: zone.y,
      zr: ZONE_START_RADIUS,
      roundEndMs: Date.now() + SHOOTER.roundMs,
    });
    this.onMessage("move", (client, payload, _seq, input) =>
      this.handleMove(client, payload, input),
    );
    this.onMessage("shoot", (client, payload, _seq, input) =>
      this.handleShoot(client, payload, input),
    );
    // Weapon swap: an index into the shared WEAPONS table (client keys 1/2/3).
    this.onMessage("weapon", (client, payload) => {
      const w = readNum(payload, "w");
      const p = this.state.players[client.id];
      if (!p || w === undefined || !Number.isInteger(w) || w < 0 || w >= WEAPONS.length) return;
      if (p.w === w) return;
      p.w = w;
      this.markStateChanged();
    });
    // Nickname: sanitized and stored on the seat (client.data survives a
    // reconnect), then used as the leaderboard display name + kill feed.
    this.onMessage("nick", (client, payload) => {
      const nick = sanitizeNick(payload);
      if (nick) client.data.nick = nick;
    });
  }

  /**
   * The per-loop game step. Movement is resolved on input, so this owns only the
   * timed systems: respawns, spawn-protection/boost expiry, pickups, the
   * shrinking zone, and the round clock. The preset flushes state after it.
   */
  protected override onTick(): void {
    const now = Date.now();
    let dirty = false;

    // Round over → announce the winner and reset the arena for the next round.
    if (now >= this.state.roundEndMs) {
      this.endRound(now);
      dirty = true;
    }

    // Respawns (downed → fresh spread spawn, protected).
    for (const [id, tick] of this.respawnAt) {
      if (this.currentTick < tick) continue;
      this.respawnAt.delete(id);
      const p = this.state.players[id];
      if (!p) continue;
      // Drop the move-budget reference: stale corpse-position moves still in
      // flight would otherwise drag the fresh spawn back toward the firefight.
      this.lastMoveAt.delete(id);
      this.moveBudget.get(id)?.reset();
      this.spawnInto(p, id);
      dirty = true;
    }

    // Spawn-protection / damage-boost expiry.
    for (const [id, until] of this.protUntil) {
      if (this.currentTick < until) continue;
      this.protUntil.delete(id);
      const p = this.state.players[id];
      if (p?.sp) {
        p.sp = false;
        dirty = true;
      }
    }
    for (const [id, until] of this.boostUntil) {
      if (this.currentTick < until) continue;
      this.boostUntil.delete(id);
      const p = this.state.players[id];
      if (p?.db) {
        p.db = false;
        dirty = true;
      }
    }

    // Pickups: re-arm due spots, then grab checks (server-authoritative).
    for (const [i, tick] of this.pickupRespawnAt) {
      if (this.currentTick < tick) continue;
      this.pickupRespawnAt.delete(i);
      const slot = this.state.pickups[String(i)];
      if (slot && !slot.on) {
        slot.on = true;
        dirty = true;
      }
    }
    if (this.grabPickups()) dirty = true;

    // Zone: shrink toward the end-of-round radius; tick damage outside.
    if (this.stepZone(now)) dirty = true;

    if (dirty) this.markStateChanged();
  }

  // Positions recorded every tick for rewind — only living, unprotected players
  // are shootable (protected players are pass-through for hitscan anyway).
  protected override lagSnapshot(): Map<string, Vec2> {
    const out = new Map<string, Vec2>();
    for (const [id, p] of Object.entries(this.state.players)) {
      if (p.alive) out.set(id, { x: p.x, y: p.y });
    }
    return out;
  }

  override onJoin(client: Client): void {
    const p = {
      x: 0,
      y: 0,
      aim: 0,
      hp: SHOOTER.maxHp,
      score: 0,
      alive: true,
      w: 0,
      sp: false,
      db: false,
    };
    this.state.players[client.id] = p;
    this.spawnInto(p, client.id);
    this.markStateChanged();
  }

  protected override onSeatExpired(client: Client): void {
    delete this.state.players[client.id];
    this.respawnAt.delete(client.id);
    this.lastMoveAt.delete(client.id);
    this.moveBudget.delete(client.id);
    this.lastShotAt.delete(client.id);
    this.protUntil.delete(client.id);
    this.boostUntil.delete(client.id);
    this.markStateChanged();
  }

  // --- spawning -------------------------------------------------------------

  /** Living players' positions — the set a spawn keeps its distance from. */
  private survivors(): Vec2[] {
    const out: Vec2[] = [];
    for (const p of Object.values(this.state.players)) {
      if (p.alive) out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  /**
   * A spread spawn nudged out of crates and (best-effort) inside the zone — a
   * spawn in the red would bleed before the player can even orient.
   */
  private spawnPoint(): Vec2 {
    const survivors = this.survivors();
    let pos = pickSpawn(survivors, this.rng, this.spawnCfg);
    for (let i = 0; i < 8 && !this.insideZone(pos); i++) {
      pos = pickSpawn(survivors, this.rng, this.spawnCfg);
    }
    return pushOutOfCrates(pos, SHOOTER.playerRadius, this.crates(), this.isBroken);
  }

  /** Place (or re-place) a player: fresh spawn, full hp, spawn protection. */
  private spawnInto(p: ShooterState["players"][string], id: string): void {
    const pos = this.spawnPoint();
    p.x = pos.x;
    p.y = pos.y;
    p.hp = SHOOTER.maxHp;
    p.alive = true;
    p.sp = true;
    p.db = false;
    this.boostUntil.delete(id);
    this.protUntil.set(id, this.currentTick + SPAWN_PROT_LOOPS);
  }

  // --- movement ---------------------------------------------------------------

  private handleMove(client: Client, payload: unknown, input?: InputMeta): void {
    const p = this.state.players[client.id];
    if (!p || !p.alive || !isVec2(payload)) return;

    // Elapsed-time-aware speed budget measured on `ts ?? receivedAt` — NEVER a
    // drain-time Date.now(): tick-aligned queues dispatch at the drain, so
    // wall-clock deltas quantize onto the tick grid (±tickMs) and legal moves get
    // mis-measured (a real ~93 ms spacing once read as 46 ms and was rejected).
    const now = input?.ts ?? input?.receivedAt ?? Date.now();
    const last = this.lastMoveAt.get(client.id);
    const perMoveMs =
      last === undefined ? SHOOTER.stepMs : clamp(now - last, MOVE_DELTA_MIN_MS, MOVE_DELTA_MAX_MS);
    this.lastMoveAt.set(client.id, last === undefined ? now : Math.max(last, now));

    // Aggregate bucket on top of the per-move clamp: bounds the SUM of grants
    // (total movement time ≤ real elapsed time + one 2-tick burst).
    let budget = this.moveBudget.get(client.id);
    if (!budget) {
      budget = new MoveBudget({ stepMs: SHOOTER.stepMs, burstMs: MOVE_DELTA_MAX_MS });
      this.moveBudget.set(client.id, budget);
    }
    const deltaMs = budget.grant(now, perMoveMs);

    const target = { x: clamp(payload.x, 0, SHOOTER.world), y: clamp(payload.y, 0, SHOOTER.world) };
    // resolveMovement clamps instead of freezing on an over-budget request (a
    // frozen position turns one rejection into an RTT-long rubber-band cascade);
    // then the shared crate pushout applies — the client predicts with the SAME
    // rule (RenderPredictor `constrain`), so walls never build up correction error.
    const res = resolveMovement({ x: p.x, y: p.y }, target, SHOOTER_PROFILE, deltaMs);
    const settled = pushOutOfCrates(res.position, SHOOTER.playerRadius, this.crates(), this.isBroken);
    p.x = settled.x;
    p.y = settled.y;
    if (res.rejected) client.send("rejected", { x: p.x, y: p.y });
    // Aim rides along with movement so others can render this player's facing.
    const aim = readNum(payload, "aim");
    if (aim !== undefined) p.aim = aim;
    this.markStateChanged();
  }

  // --- shooting ---------------------------------------------------------------

  private handleShoot(client: Client, payload: unknown, input?: InputMeta): void {
    const shooter = this.state.players[client.id];
    if (!shooter || !shooter.alive) return;
    const spec = WEAPONS[shooter.w] ?? WEAPONS[0]!;

    // Per-weapon fire-rate cap on the server *receipt* clock — a forged subtick
    // `ts` can't bypass it. Shots inside the window are ignored.
    const nowMs = Date.now();
    const lastShot = this.lastShotAt.get(client.id);
    if (lastShot !== undefined && nowMs - lastShot < spec.cooldownMs) return;
    this.lastShotAt.set(client.id, nowMs);

    // Firing ends spawn protection early (you can't shoot from behind the shield).
    if (shooter.sp) {
      shooter.sp = false;
      this.protUntil.delete(client.id);
    }

    const dir = readNum(payload, "dir") ?? shooter.aim;
    shooter.aim = dir;
    const ox = shooter.x;
    const oy = shooter.y;
    const dmg = spec.damage * (shooter.db ? SHOOTER.dmgBoostMult : 1);

    // Rewind the world to the exact instant the shooter fired (clamped subtick
    // `ts`), so the hitscan resolves against what they aimed at — not the newer
    // world the packet landed in. This is the demo's raison d'être.
    const world = this.rewind(client, input?.ts);

    // One hitscan per ray (the shotgun fans `rays` across `spread`).
    for (let i = 0; i < spec.rays; i++) {
      const rayDir =
        spec.rays > 1 ? dir + (i / (spec.rays - 1) - 0.5) * spec.spread : dir;
      const hit = this.hitscan(client.id, ox, oy, rayDir, world, spec.range);
      let dist: number;
      if (hit) {
        dist = hit.t;
        this.applyDamage(hit.id, dmg, client.id, `w${shooter.w}`);
      } else {
        // No victim: does the ray end on a crate? Damage it (destructible cover).
        const cover = rayCoverHit(
          this.crates(),
          ox,
          oy,
          Math.cos(rayDir),
          Math.sin(rayDir),
          spec.range,
          this.isBroken,
        );
        dist = Math.min(spec.range, cover?.t ?? Infinity);
        if (cover) this.damageCrate(cover.index);
      }
      this.sendNear(
        "shot",
        {
          from: client.id,
          ox,
          oy,
          dir: rayDir,
          dist,
          w: shooter.w,
          ...(hit ? { hitId: hit.id, dmg } : {}),
        },
        ox,
        oy,
        { always: hit ? [hit.id] : [] },
      );
    }
    this.markStateChanged();
  }

  // --- damage / kills ---------------------------------------------------------

  /**
   * Apply damage from `killerId` (null = self/zone — no score) to a living,
   * unprotected player; handles death, respawn scheduling, scoring, the
   * leaderboard write, and the global kill-feed event.
   */
  private applyDamage(victimId: string, dmg: number, killerId: string | null, by: string): void {
    const victim = this.state.players[victimId];
    if (!victim || !victim.alive || victim.sp) return;
    victim.hp = Math.max(0, victim.hp - dmg);
    if (victim.hp > 0) return;

    victim.alive = false;
    victim.db = false;
    this.boostUntil.delete(victimId);
    this.respawnAt.set(victimId, this.currentTick + RESPAWN_LOOPS);

    let killerNick: string | undefined;
    if (killerId && killerId !== victimId) {
      const killer = this.state.players[killerId];
      if (killer) {
        killer.score += 1;
        killerNick = this.nickOf(killerId);
        this.services.leaderboard?.submit({
          board: "shooter-top",
          playerId: killerId,
          score: killer.score,
          displayName: killerNick ?? killerId.slice(0, 6),
          mode: "max",
        });
      }
    }
    // Kill feed: a global, name-only event (no positions — AOI hiding intact).
    this.broadcast("kill", {
      k: killerId ?? by,
      v: victimId,
      ...(killerNick ? { kn: killerNick } : {}),
      ...(this.nickOf(victimId) ? { vn: this.nickOf(victimId) } : {}),
      by,
    });
  }

  private nickOf(id: string): string | undefined {
    for (const c of this.clientList()) {
      if (c.id === id) {
        return typeof c.data.nick === "string" ? c.data.nick : undefined;
      }
    }
    return undefined;
  }

  // --- pickups ------------------------------------------------------------------

  /** Grab checks: living players over an armed spot collect it. */
  private grabPickups(): boolean {
    const spots = this.pickupSpots();
    let changed = false;
    for (const [id, p] of Object.entries(this.state.players)) {
      if (!p.alive) continue;
      for (let i = 0; i < spots.length; i++) {
        const slot = this.state.pickups[String(i)];
        if (!slot?.on) continue;
        const s = spots[i]!;
        if (Math.hypot(p.x - s.x, p.y - s.y) > SHOOTER.pickupRadius) continue;
        if (s.kind === "hp") {
          if (p.hp >= SHOOTER.maxHp) continue; // leave it for someone who needs it
          p.hp = Math.min(SHOOTER.maxHp, p.hp + SHOOTER.hpPackHeal);
        } else {
          p.db = true;
          this.boostUntil.set(id, this.currentTick + DMG_BOOST_LOOPS);
        }
        slot.on = false;
        this.pickupRespawnAt.set(i, this.currentTick + PICKUP_RESPAWN_LOOPS);
        this.sendNear("grab", { id, i, kind: s.kind }, s.x, s.y, { always: [id] });
        changed = true;
      }
    }
    return changed;
  }

  // --- zone ---------------------------------------------------------------------

  private newZoneCenter(): Vec2 {
    // Anywhere in the middle half of the map, so the end-circle never hugs a wall.
    const span = SHOOTER.world / 2;
    return {
      x: SHOOTER.world / 4 + this.rng() * span,
      y: SHOOTER.world / 4 + this.rng() * span,
    };
  }

  private insideZone(pos: Vec2): boolean {
    return Math.hypot(pos.x - this.state.zx, pos.y - this.state.zy) <= this.state.zr;
  }

  /** Shrink the zone with the round clock; apply damage outside on a 1 s cadence. */
  private stepZone(now: number): boolean {
    const remain = Math.max(0, this.state.roundEndMs - now);
    const t = 1 - remain / SHOOTER.roundMs; // 0 at round start -> 1 at round end
    const zr = ZONE_START_RADIUS + (SHOOTER.zoneEndRadius - ZONE_START_RADIUS) * t;
    const changed = Math.abs(zr - this.state.zr) >= 0.5; // quant step — skip no-op writes
    this.state.zr = zr;

    if (this.currentTick % ZONE_DMG_LOOPS === 0) {
      for (const [id, p] of Object.entries(this.state.players)) {
        if (!p.alive || p.sp) continue;
        if (this.insideZone(p)) continue;
        this.applyDamage(id, SHOOTER.zoneDamage, null, "zone");
      }
    }
    return changed;
  }

  // --- rounds ---------------------------------------------------------------------

  /** Announce the winner, then reset scores, cover, pickups and the zone. */
  private endRound(now: number): void {
    const ranked = Object.entries(this.state.players)
      .map(([id, p]) => ({ id, nick: this.nickOf(id), score: p.score }))
      .sort((a, b) => b.score - a.score);
    this.broadcast("round", { top: ranked.slice(0, 3) });

    // Reset the arena. Every player respawns fresh (spawn AFTER the cover reset
    // so pushout runs against the intact layout).
    this.state.broken = {};
    this.crateHpLeft.clear();
    for (let i = 0; i < SHOOTER.pickupCount; i++) this.state.pickups[String(i)] = { on: true };
    this.pickupRespawnAt.clear();
    const zone = this.newZoneCenter();
    this.state.zx = zone.x;
    this.state.zy = zone.y;
    this.state.zr = ZONE_START_RADIUS;
    this.state.roundEndMs = now + SHOOTER.roundMs;
    for (const [id, p] of Object.entries(this.state.players)) {
      p.score = 0;
      this.respawnAt.delete(id);
      this.spawnInto(p, id);
    }
  }

  // --- geometry -----------------------------------------------------------------

  /** Crate layout for this room's seed (restore-safe memo — see crateCache). */
  private crates(): Crate[] {
    const seed = this.state.seed;
    if (!this.crateCache || this.crateCache.seed !== seed) {
      this.crateCache = { seed, crates: makeCrates(seed, SHOOTER.world) };
    }
    return this.crateCache.crates;
  }

  private pickupSpots(): PickupSpot[] {
    const seed = this.state.seed;
    if (!this.pickupCache || this.pickupCache.seed !== seed) {
      this.pickupCache = {
        seed,
        spots: makePickups(seed, SHOOTER.world, this.crates(), SHOOTER.pickupCount),
      };
    }
    return this.pickupCache.spots;
  }

  /** Bound method so it can be passed straight as a skip callback. */
  private readonly isBroken = (index: number): boolean =>
    this.state.broken[String(index)] !== undefined;

  /** Chip a crate; the last hit breaks it (stops blocking shots AND movement). */
  private damageCrate(index: number): void {
    const left = (this.crateHpLeft.get(index) ?? SHOOTER.crateHp) - 1;
    if (left <= 0) {
      this.crateHpLeft.delete(index);
      this.state.broken[String(index)] = { b: true };
    } else {
      this.crateHpLeft.set(index, left);
    }
  }

  // --- hitscan ----------------------------------------------------------------------


  // Ray/point hitscan against the rewound world: the nearest living, unprotected
  // player whose perpendicular distance to the aim ray is within `hitRadius`, in
  // front of the shooter within `range`, AND not behind intact crate cover
  // (crates holding the shooter or the victim never block; broken crates never
  // block — see shooter-crates.ts).
  private hitscan(
    shooterId: string,
    ox: number,
    oy: number,
    dir: number,
    world: Map<string, Vec2>,
    range: number,
  ): { id: string; t: number } | null {
    const dx = Math.cos(dir);
    const dy = Math.sin(dir);
    const crates = this.crates();
    let best: string | null = null;
    let bestT = Infinity;
    for (const [id, pos] of world) {
      if (id === shooterId) continue;
      const victim = this.state.players[id];
      if (!victim || !victim.alive || victim.sp) continue;
      const rx = pos.x - ox;
      const ry = pos.y - oy;
      const t = rx * dx + ry * dy; // projection along the ray
      if (t < 0 || t > range) continue;
      const perp = Math.abs(rx * dy - ry * dx); // perpendicular distance to the ray
      if (perp > SHOOTER.hitRadius) continue;
      if (t >= bestT) continue;
      if (shotBlocked(crates, ox, oy, dx, dy, t, pos.x, pos.y, this.isBroken)) continue;
      bestT = t;
      best = id;
    }
    return best ? { id: best, t: bestT } : null;
  }
}
