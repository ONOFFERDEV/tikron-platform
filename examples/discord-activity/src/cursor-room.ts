import { CasualRealtimeRoom, type Client } from "@tikron/server";
import { colorFor } from "./palette.js";

/**
 * A Discord-native cursor arena: every player in the voice channel is a colored dot
 * with their Discord name, moving on a shared canvas.
 *
 * It extends the `CasualRealtimeRoom` preset — everyone moves freely and state syncs
 * on change (throttled JSON, ~20 Hz), with NO physics tick. The preset also owns the
 * reconnection window: a dropped player's seat is held for 30 s, so a tab switch or a
 * blip inside Discord doesn't wipe their dot. We implement only the three game hooks
 * the preset leaves to us: `onCreate` (state + handlers), `onJoin`, and `onSeatExpired`
 * (the real leave once the reconnection window lapses).
 *
 * The server owns state; clients send intents (`move`, `setName`) and every payload is
 * validated — a client can't move another player or inject an oversized name.
 */

interface Player {
  /** Normalized position in [0, 1] so every screen size shares one world. */
  x: number;
  y: number;
  /** Index into the shared PALETTE (assigned server-side, stable per id). */
  color: number;
  /** Display name (from Discord; validated + clamped server-side). */
  name: string;
}

export interface CursorState {
  players: Record<string, Player>;
}

const MAX_NAME_LEN = 32;
/** ASCII control characters (C0 range + DEL) stripped from player-supplied names. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

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

/** Accept a display name only if it's a non-empty string; strip control chars, clamp length. */
function sanitizeName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.replace(CONTROL_CHARS, "").trim().slice(0, MAX_NAME_LEN);
  return name.length > 0 ? name : null;
}

export class CursorRoomImpl extends CasualRealtimeRoom<CursorState> {
  override onCreate(): void {
    this.setState({ players: {} });

    // Clients report where their cursor wants to be; the server owns the position.
    this.onMessage("move", (client, payload) => {
      const me = this.state.players[client.id];
      if (!me || !isVec2(payload)) return;
      me.x = clamp01(payload.x);
      me.y = clamp01(payload.y);
      this.markStateChanged();
    });

    // The client sends its Discord display name once on join; we validate it.
    this.onMessage("setName", (client, payload) => {
      const me = this.state.players[client.id];
      if (!me || typeof payload !== "object" || payload === null) return;
      const name = sanitizeName((payload as Record<string, unknown>).name);
      if (!name) return;
      me.name = name;
      this.markStateChanged();
    });
  }

  override onJoin(client: Client): void {
    this.state.players[client.id] = {
      x: 0.5,
      y: 0.5,
      color: colorFor(client.id),
      name: "player",
    };
    this.markStateChanged();
  }

  protected override onSeatExpired(client: Client): void {
    delete this.state.players[client.id];
    this.markStateChanged();
  }
}
