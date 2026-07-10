/**
 * Network layer: matchmaking, the room connection, event fan-out, and the intent
 * senders — with the 90 inputs/second budget enforced here so no caller can blow
 * it. The wire contract is the server's own `ArenaSchema` codec (imported, not
 * re-declared) so the fingerprint handshake passes; game events arrive as
 * developer messages routed by type.
 */
import { GameClient, type Room } from "@tikron/client";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import type { ModeId } from "../src/modes.js";
import { LOOK_SEND_MS, MOVE_KEEPALIVE_MS } from "./config.js";
import { GAME } from "../src/game-config.js";

const WEAPONS = GAME.weapons;
const DEFAULT_WEAPON_SPEC = WEAPONS[GAME.weaponMeta.defaultIndex]!;

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
  weapon: number;
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
  assist?: string;
}
export interface ShotEvent {
  from: string;
  weapon: number;
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
  dist: number;
  hit: boolean;
}
export interface NadeSpawnEvent {
  id: string;
  from: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuseMs: number;
}
export interface NadeBounceEvent {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}
export interface NadeBoomEvent {
  id: string;
  x: number;
  y: number;
  z: number;
  r: number;
}
export interface MatchEndEvent {
  /** TDM/DOM: "red" | "blue" | "draw". FFA: the winning player's session id (or
   *  "draw" on the rare scoreless-timeout fallback — see arena-room's endMatch). */
  winner: string;
  red: number;
  blue: number;
}

interface Matchmake {
  party: string;
  room: string;
  session: string;
}

/** The page's `?mode=` query param (tdm/ffa/dom/practice), else "tdm" — the
 *  server's own handleMatchmake (index.ts) applies this exact same fallback
 *  independently, so this only keeps the forwarded value clean, it isn't the
 *  source of truth. */
function modeFromLocation(): ModeId {
  const m = new URLSearchParams(location.search).get("mode");
  return m === "ffa" || m === "dom" || m === "practice" ? m : "tdm";
}

/** Fetch a room + session, retrying with backoff until the worker answers. */
async function matchmake(): Promise<Matchmake> {
  const mode = modeFromLocation();
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api/matchmake?mode=${mode}`);
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
  private fireIntervalMs = DEFAULT_WEAPON_SPEC.fireIntervalMs;

  /** Track the held weapon's cadence (main calls this on switch) so held-fire matches it. */
  setFireInterval(weaponIndex: number): void {
    this.fireIntervalMs = WEAPONS[weaponIndex]?.fireIntervalMs ?? DEFAULT_WEAPON_SPEC.fireIntervalMs;
  }

  tryFire(now: number): boolean {
    if (now - this.lastFireAt < this.fireIntervalMs) return false;
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

  /** Switch to loadout slot 1–5 (matches {@link WeaponSpec.slot}). */
  sendSwitch(slot: number): void {
    this.room.send("switch", { slot });
  }

  /** Throw the held grenade. */
  sendNade(): void {
    this.room.send("nade", {});
  }

  /** Set the primary weapon for the next loadout (M2 lobby concern; not called yet). */
  sendLoadout(primary: number): void {
    this.room.send("loadout", { primary });
  }

  /** Cast this client's restart vote (only meaningful while phase is "ended"). */
  sendVoteRestart(): void {
    this.room.send("voteRestart");
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
  onStreak(cb: (e: { id: string; count: number }) => void): void {
    this.room.onMessage("streak", (p) => cb(p as { id: string; count: number }));
  }
  onShot(cb: (e: ShotEvent) => void): void {
    this.room.onMessage("shot", (p) => cb(p as ShotEvent));
  }
  onNadeSpawn(cb: (e: NadeSpawnEvent) => void): void {
    this.room.onMessage("nadeSpawn", (p) => cb(p as NadeSpawnEvent));
  }
  onNadeBounce(cb: (e: NadeBounceEvent) => void): void {
    this.room.onMessage("nadeBounce", (p) => cb(p as NadeBounceEvent));
  }
  onNadeBoom(cb: (e: NadeBoomEvent) => void): void {
    this.room.onMessage("nadeBoom", (p) => cb(p as NadeBoomEvent));
  }
  onRespawn(cb: (id: string) => void): void {
    this.room.onMessage("respawn", (p) => cb((p as { id: string }).id));
  }
  onMatchEnd(cb: (e: MatchEndEvent) => void): void {
    this.room.onMessage("matchEnd", (p) => cb(p as MatchEndEvent));
  }
  onVote(cb: (e: { count: number; need: number }) => void): void {
    this.room.onMessage("vote", (p) => cb(p as { count: number; need: number }));
  }
}
