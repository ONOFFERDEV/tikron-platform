import { IoArenaRoom, type AOIConfig, type Client } from "@tikron/server";
import { resolveMovement, type Vec2 } from "@tikron/sim";
import { ShooterSchema, SHOOTER, SHOOTER_PROFILE, type ShooterState } from "./shooter-schema.js";
import { pickSpawn, makeRng, type SpawnConfig } from "./shooter-spawn.js";
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
 * Game code is just movement validation, the hitscan, respawn timing, and the
 * `shot` broadcast; the preset owns the realtime stack. The speed budget itself is
 * {@link SHOOTER_PROFILE} — the ONE constant the client's send clamp shares.
 */

/**
 * Elapsed-time clamp bounds for the per-move speed budget (see {@link ShooterRoomImpl}'s
 * `handleMove`). A fixed `stepMs` budget assumes the client's send timer is perfectly
 * periodic — but browser `setInterval` fires late and the rate limiter can drop a move,
 * so a legal move can arrive carrying more than one tick's worth of distance and get
 * rejected (the rubber-banding bug). Budgeting by the *measured* elapsed time since the
 * client's previous move absorbs that jitter; the clamp keeps it cheat-safe:
 *
 * - Lower bound (½ tick): a burst of moves can't each claim a near-zero delta and stall,
 *   nor can it be gamed downward — the budget only shrinks.
 * - Upper bound (2 ticks): a forged/backdated `ts` buys at most two ticks of distance
 *   per move — and only once, since the reference below is monotonic and the core
 *   clamps `ts` to `[now-250ms, now]` server-side.
 *
 * Note the long-run speed ceiling is NOT set by the `ts` clamp but by the product
 * `rate limit × lower bound`: at 60 moves/s each move is granted at least the ½-tick
 * minimum budget, i.e. 60 × 25 ms = 1.5 s of budget per second, so a spamming client
 * can sustain up to 1.5 × maxSpeed × tolerance (≈ 862 u/s) — the same ceiling the
 * previous 30 moves/s × 1-tick config allowed, and ~1.7× walking speed. Acceptable
 * for this demo; a tighter cap would need a per-window distance budget.
 */
const MOVE_DELTA_MIN_MS = SHOOTER.stepMs * 0.5;
const MOVE_DELTA_MAX_MS = SHOOTER.stepMs * 2;

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
  protected override tickMs = SHOOTER.stepMs;
  // The reason this demo exists: rewind hit checks to the shooter's subtick instant.
  protected override lagCompensation = true;
  protected override aoi: AOIConfig<ShooterState> = {
    viewRadius: SHOOTER.viewRadius,
    mapFields: ["players"],
    position: (e) => e as Vec2,
    viewer: (s, id) => s.players[id] ?? null,
    // Priority tiers (Tribes/Halo): players inside 300u refresh every flush; the
    // 300–600u band drops to 1/2 rate (10 Hz). Halves far-player sends while keeping
    // the update rate high enough that client-side entity smoothing hides the steps.
    tiers: [
      { radius: 300, interval: 1 },
      { radius: 600, interval: 2 },
    ],
  };

  // playerId -> simulation tick at which a downed player respawns.
  private readonly respawnAt = new Map<string, number>();
  // playerId -> server-timeline ms of the last processed move (the input's clamped
  // subtick `ts` when supplied, else receipt time). Drives the elapsed-time budget.
  private readonly lastMoveAt = new Map<string, number>();
  // playerId -> receipt ms (server clock, unforgeable) of the last accepted shot.
  private readonly lastShotAt = new Map<string, number>();
  // Deterministic PRNG for spread-spawn placement, seeded per room from `seed`.
  private rng: () => number = makeRng(0);
  private readonly spawnCfg: SpawnConfig = {
    world: SHOOTER.world,
    minSeparation: SHOOTER.spawnMinSep,
    ringMin: SHOOTER.spawnRingMin,
    ringMax: SHOOTER.spawnRingMax,
    centerJitter: SHOOTER.spawnCenterJitter,
  };

  protected override onReady(): void {
    this.maxClients = 64; // room-enforced cap; matches the demo's matchmake max=64
    // The core default (30 msg/s) leaves only 10 msg/s beyond the 20 Hz move stream, so
    // rapid `shoot` clicks silently drop moves — and a dropped move used to double the
    // next move's distance and trip the speed check. The elapsed-time budget below now
    // absorbs that, but keep enough headroom that moves aren't dropped in the first place.
    this.maxInputsPerSecond = 60;
    // A per-room seed clients mirror for deterministic, visual-only obstacle
    // rendering; it also drives spread-spawn so placement is reproducible per room.
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.rng = makeRng(seed);
    this.setState({ players: {}, seed });
    this.onMessage("move", (client, payload, _seq, input) =>
      this.handleMove(client, payload, input),
    );
    this.onMessage("shoot", (client, payload, _seq, input) =>
      this.handleShoot(client, payload, input),
    );
    // Nickname: sanitized and stored on the seat (client.data survives a
    // reconnect), then used as the leaderboard display name. Invalid or empty
    // payloads are ignored so a bad message never clears a good nick.
    this.onMessage("nick", (client, payload) => {
      const nick = sanitizeNick(payload);
      if (nick) client.data.nick = nick;
    });
  }

  // Respawn downed players whose timer has elapsed. Movement is resolved on input,
  // so there is no per-tick integration; the preset flushes the frame after this.
  protected override onTick(): void {
    if (this.respawnAt.size === 0) return;
    for (const [id, tick] of this.respawnAt) {
      if (this.currentTick < tick) continue;
      this.respawnAt.delete(id);
      const p = this.state.players[id];
      if (!p) continue;
      // Respawn away from the firefight: the downed player is alive === false, so
      // spawnPoint() naturally excludes it from the survivor set it separates from.
      // Also drop the move-budget reference: stale corpse-position moves still in
      // flight would otherwise be measured with a (possibly 2-tick) accumulated
      // budget and drag the fresh spawn further toward the firefight per move; a
      // reset caps each such move at the default one-tick budget until the client
      // snaps onto the spawn and rebases.
      this.lastMoveAt.delete(id);
      const pos = this.spawnPoint();
      p.x = pos.x;
      p.y = pos.y;
      p.hp = SHOOTER.maxHp;
      p.alive = true;
    }
  }

  // Positions recorded every tick for rewind — only living players are shootable.
  protected override lagSnapshot(): Map<string, Vec2> {
    const out = new Map<string, Vec2>();
    for (const [id, p] of Object.entries(this.state.players)) {
      if (p.alive) out.set(id, { x: p.x, y: p.y });
    }
    return out;
  }

  override onJoin(client: Client): void {
    // The joining player is not in state yet, so it is not among the survivors
    // spawnPoint() separates the new position from.
    const pos = this.spawnPoint();
    this.state.players[client.id] = {
      x: pos.x,
      y: pos.y,
      aim: 0,
      hp: SHOOTER.maxHp,
      score: 0,
      alive: true,
    };
    this.markStateChanged();
  }

  protected override onSeatExpired(client: Client): void {
    delete this.state.players[client.id];
    this.respawnAt.delete(client.id);
    this.lastMoveAt.delete(client.id);
    this.lastShotAt.delete(client.id);
    this.markStateChanged();
  }

  /** Living players' positions — the set a spawn keeps its distance from. */
  private survivors(): Vec2[] {
    const out: Vec2[] = [];
    for (const p of Object.values(this.state.players)) {
      if (p.alive) out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  /** A spread spawn: random near center when nobody is alive, otherwise placed
   *  away from every survivor (see {@link pickSpawn}). */
  private spawnPoint(): Vec2 {
    return pickSpawn(this.survivors(), this.rng, this.spawnCfg);
  }

  private handleMove(client: Client, payload: unknown, input?: { ts?: number }): void {
    const p = this.state.players[client.id];
    if (!p || !p.alive || !isVec2(payload)) return;

    // Elapsed-time-aware speed budget: measure the real time since this client's
    // previous move — the core-clamped subtick `ts` when the client stamps one (the
    // client's own send-timer spacing, jitter included), else server receipt time —
    // clamped to [½ tick, 2 ticks] (see MOVE_DELTA_MIN/MAX_MS). A late setInterval
    // fire or a rate-limit drop then yields a proportionally larger budget instead of
    // a rejection. The reference is kept monotonic so a backdated `ts` can't rewind it.
    const now = input?.ts ?? Date.now();
    const last = this.lastMoveAt.get(client.id);
    const deltaMs =
      last === undefined
        ? SHOOTER.stepMs
        : clamp(now - last, MOVE_DELTA_MIN_MS, MOVE_DELTA_MAX_MS);
    this.lastMoveAt.set(client.id, last === undefined ? now : Math.max(last, now));

    const target = { x: clamp(payload.x, 0, SHOOTER.world), y: clamp(payload.y, 0, SHOOTER.world) };
    // resolveMovement clamps instead of freezing on an over-budget request: it
    // advances the full (un-toleranced) budget toward the target rather than snapping
    // back to `prev`. A frozen authoritative position turns one rejection into an
    // RTT-long cascade — every in-flight move is measured against the stale position
    // and rejected too, and each `rejected` yanks the client's render back again (the
    // rubber-band burst). A speed hack still cannot exceed `maxSpeed`; it is merely
    // capped. The `rejected` reply carries the clamped (partially advanced)
    // authoritative position, which the client folds in via RenderPredictor.correct.
    const res = resolveMovement({ x: p.x, y: p.y }, target, SHOOTER_PROFILE, deltaMs);
    p.x = res.position.x;
    p.y = res.position.y;
    if (res.rejected) client.send("rejected", { x: p.x, y: p.y });
    // Aim rides along with movement so others can render this player's facing.
    const aim = readNum(payload, "aim");
    if (aim !== undefined) p.aim = aim;
    this.markStateChanged();
  }

  private handleShoot(client: Client, payload: unknown, input?: { ts?: number }): void {
    const shooter = this.state.players[client.id];
    if (!shooter || !shooter.alive) return;

    // Fire-rate cap. The shared 60 msg/s input limit exists to keep the 20 Hz move
    // stream flowing, so on its own it would let a scripted client fire ~40 shots/s
    // (2000+ dmg/s). Enforce a per-type cooldown on the server *receipt* clock — a
    // forged subtick `ts` can't bypass it. Shots inside the window are ignored.
    const nowMs = Date.now();
    const lastShot = this.lastShotAt.get(client.id);
    if (lastShot !== undefined && nowMs - lastShot < SHOOTER.shotCooldownMs) return;
    this.lastShotAt.set(client.id, nowMs);

    const dir = readNum(payload, "dir") ?? shooter.aim;
    shooter.aim = dir;
    const ox = shooter.x;
    const oy = shooter.y;

    // Rewind the world to the exact instant the shooter fired (clamped subtick
    // `ts`), so the hitscan resolves against what they aimed at — not the newer
    // world the packet landed in. This is the demo's raison d'être.
    const world = this.rewind(client, input?.ts);
    const hitId = this.hitscan(client.id, ox, oy, dir, world);

    if (hitId) {
      const victim = this.state.players[hitId];
      if (victim && victim.alive) {
        victim.hp = Math.max(0, victim.hp - SHOOTER.shotDamage);
        if (victim.hp <= 0) {
          victim.alive = false;
          this.respawnAt.set(hitId, this.currentTick + SHOOTER.respawnTicks);
          shooter.score += 1;
          // Dogfood the leaderboard: publish the shooter's frag count to "shooter-top",
          // under their chosen nickname when set (else a short player-id stub).
          const nick = typeof client.data.nick === "string" ? client.data.nick : undefined;
          this.services.leaderboard?.submit({
            board: "shooter-top",
            playerId: client.id,
            score: shooter.score,
            displayName: nick ?? client.id.slice(0, 6),
            mode: "max",
          });
        }
      }
    }

    // Emit the shot so clients can draw a tracer (`hitId` present on a connect). A
    // transient visual event: send it only to clients whose player is within the
    // shooter's view radius (plus the shooter and the victim), never a full fan-out
    // — a wallhack boundary and, at 100 players, ~viewers instead of N sends.
    this.sendShotToViewers(client.id, ox, oy, dir, hitId);
    this.markStateChanged();
  }

  private sendShotToViewers(
    shooterId: string,
    ox: number,
    oy: number,
    dir: number,
    hitId: string | null,
  ): void {
    const payload = { from: shooterId, ox, oy, dir, ...(hitId ? { hitId } : {}) };
    const r2 = SHOOTER.viewRadius * SHOOTER.viewRadius;
    for (const c of this.clientList()) {
      if (c.id === shooterId || c.id === hitId) {
        c.send("shot", payload); // shooter + victim always see the shot
        continue;
      }
      const p = this.state.players[c.id];
      if (!p) continue;
      const dx = p.x - ox;
      const dy = p.y - oy;
      if (dx * dx + dy * dy <= r2) c.send("shot", payload);
    }
  }

  // Ray/point hitscan against the rewound world: the nearest living player whose
  // perpendicular distance to the aim ray is within `hitRadius` and in front of
  // the shooter within `shotRange`.
  private hitscan(
    shooterId: string,
    ox: number,
    oy: number,
    dir: number,
    world: Map<string, Vec2>,
  ): string | null {
    const dx = Math.cos(dir);
    const dy = Math.sin(dir);
    let best: string | null = null;
    let bestT = Infinity;
    for (const [id, pos] of world) {
      if (id === shooterId) continue;
      const victim = this.state.players[id];
      if (!victim || !victim.alive) continue;
      const rx = pos.x - ox;
      const ry = pos.y - oy;
      const t = rx * dx + ry * dy; // projection along the ray
      if (t < 0 || t > SHOOTER.shotRange) continue;
      const perp = Math.abs(rx * dy - ry * dx); // perpendicular distance to the ray
      if (perp > SHOOTER.hitRadius) continue;
      if (t < bestT) {
        bestT = t;
        best = id;
      }
    }
    return best;
  }
}
