/**
 * Network layer: matchmaking, the room connection, event fan-out, and the intent
 * senders — with the 90 inputs/second budget enforced here so no caller can blow
 * it. The wire contract is the server's own `ArenaSchema` codec (imported, not
 * re-declared) so the fingerprint handshake passes; game events arrive as
 * developer messages routed by type.
 */
import { GameClient, type Room } from "@tikron/client";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import { AR } from "../src/config.js";
import { LOOK_SEND_MS, MOVE_KEEPALIVE_MS } from "./config.js";

/** The held movement intent the server integrates every tick. */
export interface MoveIntent {
  mx: number;
  mz: number;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
}

export interface AmmoEvent {
  mag: number;
  reserve: number;
  reloadMs?: number;
}
export interface HitEvent {
  victim: string;
  dmg: number;
  head: boolean;
}
export interface KillEvent {
  killer: string;
  victim: string;
  part: string;
  killerTeam: number | null;
}
export interface ShotEvent {
  from: string;
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
  dist: number;
  hit: boolean;
}
export interface MatchEndEvent {
  winner: "red" | "blue" | "draw";
  red: number;
  blue: number;
}

interface Matchmake {
  party: string;
  room: string;
  session: string;
}

/** Fetch a room + session, retrying with backoff until the worker answers. */
async function matchmake(): Promise<Matchmake> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch("/api/matchmake");
      if (res.ok) return (await res.json()) as Matchmake;
    } catch {
      // network hiccup — fall through to the backoff
    }
    await sleep(Math.min(4000, 400 * 2 ** attempt));
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * A live arena connection. Owns the {@link Room}, the local player's id, and the
 * outgoing intent scheduler. Callers push their *current* intent every frame
 * (`setMoveIntent` / `setLook`) and this decides when to actually emit, keeping the
 * wire under budget.
 */
export class Net {
  readonly room: Room;
  readonly myId: string;

  private last: MoveIntent = { mx: 0, mz: 0, jump: false, crouch: false, sprint: false };
  private lastMoveAt = 0;
  private lastLookAt = 0;
  private lastYaw = NaN;
  private lastPitch = NaN;
  private lastFireAt = 0;

  private constructor(room: Room) {
    this.room = room;
    this.myId = room.connectionId ?? "";
  }

  /** Connect (matchmake → join), retrying the initial handshake on failure. */
  static async connect(): Promise<Net> {
    for (let attempt = 0; ; attempt++) {
      try {
        const mm = await matchmake();
        const client = new GameClient(location.host, {
          party: mm.party,
          stateCodec: ArenaSchema,
          subtickTimestamps: true, // FPS-grade hit registration (server rewinds to input ts)
        });
        const room = await client.joinOrCreate(mm.room, { _session: mm.session });
        return new Net(room);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[net] join failed (attempt ${attempt + 1})`, err);
        await sleep(Math.min(4000, 500 * 2 ** attempt));
      }
    }
  }

  /** Latest authoritative state (undefined until the first sync). */
  get state(): ArenaState | undefined {
    return this.room.state as ArenaState | undefined;
  }

  /** Server-clock ms of the most recent state (for remote interpolation), or null. */
  get stateServerTime(): number | null {
    return this.room.lastStateServerTime;
  }

  get rttMs(): number {
    return this.room.clock.rttMs;
  }

  serverNow(): number {
    return this.room.clock.serverNow();
  }

  // --- intents (budget-managed) ---------------------------------------------

  /**
   * Register the current held intent. Sends a `move` only when the intent changed,
   * a jump is queued, or a keepalive interval elapsed — a held key costs nothing on
   * the wire because the server integrates the last intent every tick.
   */
  setMoveIntent(i: MoveIntent, now: number): void {
    const changed =
      i.mx !== this.last.mx ||
      i.mz !== this.last.mz ||
      i.crouch !== this.last.crouch ||
      i.sprint !== this.last.sprint;
    if (!changed && !i.jump && now - this.lastMoveAt < MOVE_KEEPALIVE_MS) return;
    this.room.send("move", { mx: i.mx, mz: i.mz, jump: i.jump, crouch: i.crouch, sprint: i.sprint });
    this.last = { ...i, jump: false };
    this.lastMoveAt = now;
  }

  /** Register the current aim. Throttled to ~30/s; only sends when it moved. */
  setLook(yaw: number, pitch: number, now: number): void {
    if (now - this.lastLookAt < LOOK_SEND_MS) return;
    if (yaw === this.lastYaw && pitch === this.lastPitch) return;
    this.room.send("look", { yaw, pitch });
    this.lastLookAt = now;
    this.lastYaw = yaw;
    this.lastPitch = pitch;
  }

  /**
   * Attempt a shot, gated to the server's fire interval so held-fire stays under
   * budget (the server is the real cadence). Returns true when a `fire` was sent,
   * so the caller can kick the predicted viewmodel immediately.
   */
  tryFire(now: number): boolean {
    if (now - this.lastFireAt < AR.fireIntervalMs) return false;
    this.lastFireAt = now;
    this.room.send("fire", {});
    return true;
  }

  reload(): void {
    this.room.send("reload");
  }

  respawn(): void {
    this.room.send("respawn");
  }

  // --- events ----------------------------------------------------------------

  onAmmo(cb: (e: AmmoEvent) => void): void {
    this.room.onMessage("ammo", (p) => cb(p as AmmoEvent));
  }
  onHit(cb: (e: HitEvent) => void): void {
    this.room.onMessage("hit", (p) => cb(p as HitEvent));
  }
  onKill(cb: (e: KillEvent) => void): void {
    this.room.onMessage("kill", (p) => cb(p as KillEvent));
  }
  onShot(cb: (e: ShotEvent) => void): void {
    this.room.onMessage("shot", (p) => cb(p as ShotEvent));
  }
  onRespawn(cb: (id: string) => void): void {
    this.room.onMessage("respawn", (p) => cb((p as { id: string }).id));
  }
  onMatchEnd(cb: (e: MatchEndEvent) => void): void {
    this.room.onMessage("matchEnd", (p) => cb(p as MatchEndEvent));
  }
}
