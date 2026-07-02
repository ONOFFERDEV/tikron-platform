import { Room, validateMovement, type Client } from "@tikron/server";
import { schema, mapOf, type Codec } from "@tikron/schema";

/**
 * Realtime .io-style room — exercises the opt-in Simulation and
 * MovementValidation modules plus binary delta state sync (`stateCodec`).
 *
 * Clients send their predicted position ("move"); the server validates the step
 * against a per-tick budget and snaps back teleports/speed hacks. State is
 * broadcast as binary deltas on a fixed 20 Hz simulation tick.
 */
interface MovementState {
  players: Record<string, { x: number; y: number }>;
}

/** Shared schema — import this on the client to decode the binary state stream. */
export const MovementSchema: Codec<MovementState> = schema({
  players: mapOf(schema({ x: "f32", y: "f32" })),
});

const MAX_SPEED = 200; // units per second
const STEP_MS = 50; // simulation tick + per-move validation step (20 Hz)
const CFG = { maxSpeed: MAX_SPEED, tolerance: 1.15 };

function isVec2(v: unknown): v is { x: number; y: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).x === "number" &&
    typeof (v as Record<string, unknown>).y === "number"
  );
}

export class MovementRoomImpl extends Room<MovementState> {
  private readonly positions = new Map<string, { x: number; y: number }>();

  override onCreate(): void {
    this.stateCodec = MovementSchema; // binary delta sync
    this.sendAcks = true; // let clients reconcile predicted movement
    this.setState({ players: {} });
    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    // Simulation module: keep broadcasting authoritative frames at 20 Hz.
    this.setSimulationInterval(() => this.markStateChanged(), STEP_MS);
  }

  override onJoin(client: Client): void {
    this.positions.set(client.id, { x: 0, y: 0 });
    this.syncPlayers();
    this.markStateChanged();
  }

  override onLeave(client: Client): void {
    this.positions.delete(client.id);
    this.syncPlayers();
    this.markStateChanged();
  }

  private handleMove(client: Client, payload: unknown): void {
    const pos = this.positions.get(client.id);
    if (!pos || !isVec2(payload)) return;

    const result = validateMovement(pos, payload, CFG, STEP_MS);
    pos.x = result.position.x;
    pos.y = result.position.y;

    if (result.rejected) client.send("rejected", { x: pos.x, y: pos.y });
    this.syncPlayers();
    this.markStateChanged();
  }

  private syncPlayers(): void {
    const players: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of this.positions) players[id] = { x: p.x, y: p.y };
    this.state.players = players;
  }
}
