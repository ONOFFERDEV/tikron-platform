import { Room, type Client } from "@playedge/server";

/**
 * Your first PlayEdge room: a shared canvas where every player is a colored
 * cursor dot, and clicking splats paint everyone can see.
 *
 * The mental model:
 *  - `this.state` lives on the server and is the single source of truth.
 *  - Clients send *intents* (`room.send("move", ...)`) — never state.
 *  - You mutate `this.state` in a message handler, call `markStateChanged()`,
 *    and every connected client receives the update. That's the whole loop.
 *
 * This room uses only the genre-agnostic core (JSON sync, no tick). When you
 * outgrow it, the same Room class scales up with opt-in modules — a fixed
 * timestep (`setSimulationInterval`), binary delta sync (`stateCodec`), and
 * per-player interest management (`enableAOI`). See `apps/gateway` for a
 * full .io game using all three.
 */

interface Player {
  x: number;
  y: number;
  hue: number;
}

interface Splat {
  x: number;
  y: number;
  hue: number;
}

export interface ArenaState {
  players: Record<string, Player>;
  splats: Splat[];
}

const MAX_SPLATS = 256;

/** Positions are normalized to [0, 1] so every screen size shares one world. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function isVec2(v: unknown): v is { x: number; y: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).x === "number" &&
    typeof (v as Record<string, unknown>).y === "number"
  );
}

/** A stable, colorful hue per player id. */
function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export class ArenaRoomImpl extends Room<ArenaState> {
  override onCreate(): void {
    this.setState({ players: {}, splats: [] });

    // Clients report where their cursor wants to be. The server owns the
    // actual position — validate everything a client sends.
    this.onMessage("move", (client, payload) => {
      const me = this.state.players[client.id];
      if (!me || !isVec2(payload)) return;
      me.x = clamp01(payload.x);
      me.y = clamp01(payload.y);
      this.markStateChanged();
    });

    // Splat where the *server* says the player is — a client can't paint
    // somewhere it never moved to.
    this.onMessage("splat", (client) => {
      const me = this.state.players[client.id];
      if (!me) return;
      this.state.splats.push({ x: me.x, y: me.y, hue: me.hue });
      if (this.state.splats.length > MAX_SPLATS) this.state.splats.shift();
      this.markStateChanged();
    });
  }

  override onJoin(client: Client): void {
    this.state.players[client.id] = { x: 0.5, y: 0.5, hue: hueOf(client.id) };
    this.markStateChanged();
  }

  override async onLeave(client: Client): Promise<void> {
    try {
      // Tab switch or network blip? Hold the seat for 30s — if the client
      // comes back with the same session key, their dot never disappears.
      await this.allowReconnection(client, 30);
    } catch {
      delete this.state.players[client.id];
      this.markStateChanged();
    }
  }
}
