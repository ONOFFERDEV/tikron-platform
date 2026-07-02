import { IoArenaRoom, validateMovement, type AOIConfig, type Client } from "@tikron/server";
import { AgarSchema, AGAR, type AgarState, type AgarPlayer } from "./agar-schema.js";

/**
 * Flagship .io demo — agar-style orb collection. Built on the {@link IoArenaRoom}
 * preset, which wires the whole realtime stack for us: binary delta sync (the
 * `codec`), a fixed simulation tick, input acks, and **AOI** (each client only
 * receives players/orbs within its view). Game code is just `onReady` (spawn +
 * move handler), the AOI config, and `onSeatExpired`.
 */
const CFG = { maxSpeed: AGAR.maxSpeed, tolerance: 1.15 };

function isVec2(v: unknown): v is { x: number; y: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).x === "number" &&
    typeof (v as Record<string, unknown>).y === "number"
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class AgarRoomImpl extends IoArenaRoom<AgarState> {
  protected readonly codec = AgarSchema;
  protected override tickMs = AGAR.stepMs;
  protected override aoi: AOIConfig<AgarState> = {
    viewRadius: AGAR.viewRadius,
    mapFields: ["players", "orbs"],
    position: (e) => e as { x: number; y: number },
    viewer: (s, id) => s.players[id] ?? null,
  };

  private seed = 0x2545f491;
  private spawnCount = 0;
  private orbSeq = 0;

  // Deterministic xorshift32 PRNG (no Math.random -> reproducible in tests).
  private rnd(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 0xffffffff;
  }
  private randomOrb() {
    return { x: this.rnd() * AGAR.world, y: this.rnd() * AGAR.world };
  }

  protected override onReady(): void {
    this.maxClients = 20; // room-enforced cap; matches the demo's matchmake max

    const orbs: Record<string, { x: number; y: number }> = {};
    orbs.orb0 = { x: 130, y: 100 }; // deterministic anchor near player 0's spawn
    for (let i = 1; i < AGAR.orbCount; i++) orbs[`orb${i}`] = this.randomOrb();
    this.orbSeq = AGAR.orbCount;

    this.setState({ players: {}, orbs });
    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
  }

  // Movement is resolved on input (below); the preset flushes an authoritative
  // frame every tick on its own, so there is no per-tick simulation to run here.
  protected override onTick(): void {}

  override onJoin(client: Client): void {
    const i = this.spawnCount++;
    const pos =
      i === 0
        ? { x: 100, y: 100 }
        : { x: (i * 900 + 100) % AGAR.world, y: (i * 617 + 400) % AGAR.world };
    this.state.players[client.id] = { x: pos.x, y: pos.y, score: 0 };
    this.markStateChanged();
  }

  // The preset holds a dropped player's blob (and score) for its reconnection
  // window; this runs only once the window really lapses.
  protected override onSeatExpired(client: Client): void {
    delete this.state.players[client.id];
    this.markStateChanged();
  }

  private handleMove(client: Client, payload: unknown): void {
    const p = this.state.players[client.id];
    if (!p || !isVec2(payload)) return;

    const target = { x: clamp(payload.x, 0, AGAR.world), y: clamp(payload.y, 0, AGAR.world) };
    const res = validateMovement({ x: p.x, y: p.y }, target, CFG, AGAR.stepMs);
    p.x = res.position.x;
    p.y = res.position.y;
    if (res.rejected) client.send("rejected", { x: p.x, y: p.y });

    const before = p.score;
    this.collectOrbs(p);
    if (p.score !== before) {
      // Dogfood the leaderboard: publish the running best to board "agar-top".
      // mode "max" keeps the high score, so each submit is idempotent-safe.
      this.services.leaderboard?.submit({
        board: "agar-top",
        playerId: client.id,
        score: p.score,
        displayName: client.id.slice(0, 6),
        mode: "max",
      });
    }
    this.markStateChanged();
  }

  private collectOrbs(p: AgarPlayer): void {
    const r2 = AGAR.collectRadius * AGAR.collectRadius;
    for (const [orbId, orb] of Object.entries(this.state.orbs)) {
      const dx = orb.x - p.x;
      const dy = orb.y - p.y;
      if (dx * dx + dy * dy <= r2) {
        delete this.state.orbs[orbId];
        p.score += 1;
        this.state.orbs[`orb${this.orbSeq++}`] = this.randomOrb();
      }
    }
  }
}
