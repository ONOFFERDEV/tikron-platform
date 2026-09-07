import { IoArenaRoom, validateMovement, type Client } from "@tikron/server";
import { schema, mapOf, type Codec } from "@tikron/schema";

/**
 * Generic realtime room — no game in it, on purpose.
 *
 * The gateway hosts no demo games any more (the playable demo is `apps/ironsight`,
 * deployed separately at fps.tikron.dev). What the gateway still needs is ONE
 * framework-based room to drive the platform surface end to end: matchmaker
 * session validation, occupancy reporting, binary delta sync + the 13-byte
 * tick/serverTime header, movement validation, player-token `onAuth`,
 * server-authoritative leaderboard writes, the reconnection window, and
 * persist/restore across a Durable Object eviction. `GameRoom` (the M0 hello
 * room) is a raw partyserver `Server` and has none of those hooks, so this room
 * is the fixture the platform test-suite connects to.
 *
 * Deliberately minimal: players are points on a plane with a score that counts
 * their accepted moves — just enough mutable per-seat state to be worth
 * persisting and restoring.
 */
export interface FixturePlayer {
  x: number;
  y: number;
  score: number;
}
export interface FixtureState {
  players: Record<string, FixturePlayer>;
}

/** Shared schema — clients import this to decode the binary state stream. */
export const FixtureSchema: Codec<FixtureState> = schema({
  players: mapOf(schema({ x: "f32", y: "f32", score: "u32" })),
});

export const FIXTURE = {
  world: 2000,
  viewRadius: 500,
  maxSpeed: 200,
  stepMs: 50,
} as const;

const CFG = { maxSpeed: FIXTURE.maxSpeed, tolerance: 1.15 };

function isVec2(v: unknown): v is { x: number; y: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).x === "number" &&
    typeof (v as Record<string, unknown>).y === "number"
  );
}

export class FixtureRoomImpl extends IoArenaRoom<FixtureState> {
  protected readonly codec = FixtureSchema;
  protected override tickMs = FIXTURE.stepMs;

  protected override onReady(): void {
    this.setState({ players: {} });
    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    // Give up this seat's reconnection window, so closing the transport finalizes
    // the leave at once instead of holding the seat for 30s. Platform tests that
    // observe a *real* leave (the lobby dropping an emptied room without waiting
    // out the reservation TTL) need that without a 30s wall-clock wait.
    this.onMessage("nowindow", (client) => {
      client.data.noWindow = true;
    });
  }

  // Movement resolves on input; the preset flushes an authoritative frame every
  // tick on its own, so there is nothing to integrate here.
  protected override onTick(): void {}

  override onJoin(client: Client): void {
    this.state.players[client.id] = { x: 0, y: 0, score: 0 };
    this.markStateChanged();
  }

  override async onLeave(client: Client): Promise<void> {
    if (client.data.noWindow) {
      this.onSeatExpired(client);
      return;
    }
    await super.onLeave(client); // preset: hold the seat for the reconnection window
  }

  // Runs only once a held seat's reconnection window really lapses.
  protected override onSeatExpired(client: Client): void {
    delete this.state.players[client.id];
    this.markStateChanged();
  }

  private handleMove(client: Client, payload: unknown): void {
    const p = this.state.players[client.id];
    if (!p || !isVec2(payload)) return;

    const res = validateMovement({ x: p.x, y: p.y }, payload, CFG, FIXTURE.stepMs);
    p.x = res.position.x;
    p.y = res.position.y;

    if (res.rejected) {
      client.send("rejected", { x: p.x, y: p.y });
    } else {
      // One point per accepted move: mutable seat state worth persisting, and it
      // exercises the server-authoritative leaderboard write (mode "max" keeps the
      // best, so every submit is idempotent-safe).
      p.score += 1;
      this.services.leaderboard?.submit({
        board: "fixture-top",
        playerId: client.id,
        score: p.score,
        displayName: client.id.slice(0, 6),
        mode: "max",
      });
    }
    this.markStateChanged();
  }
}
