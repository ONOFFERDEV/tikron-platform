import { IoArenaRoom, type AOIConfig, type Client } from "@tikron/server";
import { validateMovement, type Vec2 } from "@tikron/sim";
import { ShooterSchema, SHOOTER, type ShooterState } from "./shooter-schema.js";

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
 * `shot` broadcast; the preset owns the realtime stack.
 */
const MOVE_CFG = { maxSpeed: SHOOTER.maxSpeed, tolerance: 1.15 };

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
    // 300–600u band drops to 1/4 rate. Cuts far-player sends ~4× at no visible cost.
    tiers: [
      { radius: 300, interval: 1 },
      { radius: 600, interval: 4 },
    ],
  };

  private spawnCount = 0;
  private readonly spawnIndex = new Map<string, number>();
  // playerId -> simulation tick at which a downed player respawns.
  private readonly respawnAt = new Map<string, number>();

  protected override onReady(): void {
    this.maxClients = 20; // room-enforced cap; DEV_MODE ?maxClients= override still applies
    this.setState({ players: {} });
    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("shoot", (client, payload, _seq, input) =>
      this.handleShoot(client, payload, input),
    );
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
      const pos = this.spawnPos(this.spawnIndex.get(id) ?? 0);
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
    const i = this.spawnCount++;
    this.spawnIndex.set(client.id, i);
    const pos = this.spawnPos(i);
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
    this.spawnIndex.delete(client.id);
    this.respawnAt.delete(client.id);
    this.markStateChanged();
  }

  // Deterministic spawns: players 0/1 sit on a north–south line (a clean hitscan
  // geometry for the rewind test); the rest fan out across the map.
  private spawnPos(i: number): Vec2 {
    if (i === 0) return { x: 1000, y: 1000 };
    if (i === 1) return { x: 1000, y: 900 };
    return { x: (i * 337 + 200) % SHOOTER.world, y: (i * 613 + 300) % SHOOTER.world };
  }

  private handleMove(client: Client, payload: unknown): void {
    const p = this.state.players[client.id];
    if (!p || !p.alive || !isVec2(payload)) return;

    const target = { x: clamp(payload.x, 0, SHOOTER.world), y: clamp(payload.y, 0, SHOOTER.world) };
    const res = validateMovement({ x: p.x, y: p.y }, target, MOVE_CFG, SHOOTER.stepMs);
    p.x = res.position.x;
    p.y = res.position.y;
    // Aim rides along with movement so others can render this player's facing.
    const aim = readNum(payload, "aim");
    if (aim !== undefined) p.aim = aim;
    if (res.rejected) client.send("rejected", { x: p.x, y: p.y });
    this.markStateChanged();
  }

  private handleShoot(client: Client, payload: unknown, input?: { ts?: number }): void {
    const shooter = this.state.players[client.id];
    if (!shooter || !shooter.alive) return;

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
          // Dogfood the leaderboard: publish the shooter's frag count to "shooter-top".
          this.services.leaderboard?.submit({
            board: "shooter-top",
            playerId: client.id,
            score: shooter.score,
            displayName: client.id.slice(0, 6),
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
