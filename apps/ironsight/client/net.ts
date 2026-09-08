import type { RecoilState } from "../src/recoil.js";
/**
 * Network layer: matchmaking, the room connection, event fan-out, and the intent
 * senders — with the 90 inputs/second budget enforced here so no caller can blow
 * it. The wire contract is the server's own `ArenaSchema` codec (imported, not
 * re-declared) so the fingerprint handshake passes; game events arrive as
 * developer messages routed by type.
 */
import { GameClient, createPartySocketTransport, type Room } from "@tikron/client";
import { ArenaSchema, type ArenaState } from "../src/schema.js";
import type { ModeId } from "../src/modes.js";
import type { FireClaim } from "../src/hitscan.js";
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
  ads?: boolean;
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
  weapon?: number | null;
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
  /** Per-victim id + headshot flag, for remote hit-reaction animations (scene.ts's
   *  playHitReaction) — appended after the M0-M3 fields above; `hit` above is
   *  unchanged (still the plain aggregate the tracer color reads). */
  hits: { id: string; head: boolean }[];
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
  // Practice's map sub-selection (mode-select.ts) only ever sets `?map=` to
  // arena2/arena3 — anything else (including a non-practice mode) is ignored
  // here exactly like index.ts's handleMatchmake ignores it server-side.
  const mapParam = new URLSearchParams(location.search).get("map");
  const query =
    mode === "practice" && (mapParam === "arena2" || mapParam === "arena3")
      ? `mode=${mode}&map=${mapParam}`
      : `mode=${mode}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api/matchmake?${query}`);
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
  /** The matchmake response's own room id — for practice, main.ts feeds this
   *  into modes.ts's `mapForRoom` alongside the mode, since that id (not just
   *  the mode) is what picks the map (see modes.ts's `practiceMapKeyFromRoomId`). */
  readonly roomId: string;
  readonly myId: string;

  private last: MoveIntent = { mx: 0, mz: 0, jump: false, crouch: false, sprint: false };
  private lastMoveAt = 0;
  private lastLookAt = 0;
  private lastYaw = NaN;
  private lastPitch = NaN;
  private lastFireAt = 0;

  private constructor(room: Room, roomId: string, private readonly link: { open: boolean; lostAt: number }) {
    this.room = room;
    this.roomId = roomId;
    this.myId = room.connectionId ?? "";
    room.onMessage("fireBlocked", p => {
      if (typeof p !== 'object' || p === null) return;
      const { retryMs } = p as { retryMs?: unknown };
      if (typeof retryMs !== 'number' || !Number.isFinite(retryMs)) return;
      this.lastFireAt = performance.now() - this.fireIntervalMs + Math.min(1000, Math.max(0, retryMs));
    });
    room.onMessage((message) => {
      if (message.t === "s:welcome") {
        this.link.open = true;
        this.link.lostAt = 0;
        this.lastYaw = NaN; this.lastPitch = NaN; this.lastMoveAt = 0;
        this.requestSync();
      }
    });
  }

  /** Connect (matchmake → join), retrying the initial handshake on failure. */
  static async connect(): Promise<Net> {
    for (let attempt = 0; ; attempt++) {
      try {
        const mm = await matchmake();
        const link = { open: false, lostAt: 0 };
        const client = new GameClient(location.host, {
          party: mm.party,
          createTransport: (options) => {
            const transport = createPartySocketTransport(options);
            // An open TCP/WebSocket transport is not yet an accepted room seat.
            // Only Welcome re-enables gameplay after a reconnect.
            transport.onClose(() => {
              link.open = false;
              if (link.lostAt === 0) link.lostAt = performance.now();
            });
            return transport;
          },
          stateCodec: ArenaSchema,
          subtickTimestamps: true, // FPS-grade hit registration (server rewinds to input ts)
        });
        const room = await client.joinOrCreate(mm.room, { _session: mm.session });
        link.open = true; // joinOrCreate has validated the initial Welcome.
        return new Net(room, mm.room, link);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[net] join failed (attempt ${attempt + 1})`, err);
        await sleep(Math.min(4000, 500 * 2 ** attempt));
      }
    }
  }

  get online(): boolean { return this.link.open; }
  get connectionExpired(): boolean { return !this.online && performance.now() - this.link.lostAt >= 30000; }
  requestSync(): void { this.send("syncView"); }
  private send(type: string, payload?: unknown): void {
    if (this.online) this.room.send(type, payload);
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
      i.sprint !== this.last.sprint ||
      !!i.ads !== !!this.last.ads;
    if (!changed && !i.jump && now - this.lastMoveAt < MOVE_KEEPALIVE_MS) return;
    this.send("move", { mx: i.mx, mz: i.mz, jump: i.jump, crouch: i.crouch, sprint: i.sprint, ads: i.ads === true });
    this.last = { ...i, jump: false };
    this.lastMoveAt = now;
  }

  /** Register the current aim. Throttled to ~30/s; only sends when it moved. */
  setLook(yaw: number, pitch: number, now: number): void {
    if (now - this.lastLookAt < LOOK_SEND_MS) return;
    if (yaw === this.lastYaw && pitch === this.lastPitch) return;
    this.send("look", { yaw, pitch });
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

  /**
   * `computeClaim` (hybrid hit registration — see hitscan.ts's `FireClaim`) is
   * only invoked once the fire-rate gate above has actually passed, so a
   * held-trigger frame that gets dropped by the gate never pays for a scene
   * raycast it won't use. Its three possible returns are distinguished on the
   * wire (arena-room.ts's `readClaim`): `undefined` omits the `claim` field
   * entirely (this weapon didn't attempt one — e.g. the shotgun), `null` sends
   * `claim: null` (client raycast the scene and found nothing — an explicit,
   * trusted miss), and a `FireClaim` sends `claim: {id, part}` for the server
   * to plausibility-check.
   */
  fireSeq = 0;
  tryFire(now: number, computeClaim?: () => FireClaim | null | undefined, aim?: { yaw: number; pitch: number }): boolean {
    if (now - this.lastFireAt < this.fireIntervalMs) return false;
    this.lastFireAt = now;
    const claim = computeClaim?.();
    this.fireSeq += 1;
    this.send("fire", { ...aim, fireSeq: this.fireSeq, ...(claim === undefined ? {} : { claim }) });
    return true;
  }

  reload(): void {
    this.send("reload");
  }

  respawn(): void {
    this.send("respawn");
  }

  /** Switch to loadout slot 1–5 (matches {@link WeaponSpec.slot}). */
  sendSwitch(slot: number): void {
    this.send("switch", { slot });
  }

  /** Throw the held grenade. */
  sendNade(): void {
    this.send("nade", {});
  }

  /** Set the primary weapon for the next loadout (M2 lobby concern; not called yet). */
  sendLoadout(primary: number): void {
    this.send("loadout", { primary });
  }

  /** Cast this client's restart vote (only meaningful while phase is "ended"). */
  sendVoteRestart(): void {
    this.send("voteRestart");
  }

  // --- events ----------------------------------------------------------------

  onAmmo(cb: (e: AmmoEvent) => void): void {
    this.room.onMessage("ammo", (p) => cb(p as AmmoEvent));
  }
  onFireBlocked(cb: (mag: number, slot: number) => void): void {
    this.room.onMessage("fireBlocked", p => {
      if (typeof p !== 'object' || p === null) return;
      const { mag, weapon } = p as { mag?: unknown; weapon?: unknown };
      if (typeof mag === 'number' && Number.isInteger(mag) && mag >= 0 &&
          typeof weapon === 'number' && Number.isInteger(weapon) && weapon >= 1 && weapon <= WEAPONS.length) cb(mag, weapon);
    });
  }
  onRecoilSync(cb: (seq: number, state: RecoilState) => void): void {
    this.room.onMessage("recoilSync", p => {
      if (!p || typeof p !== "object") return;
      const { seq, slot, count, at } = p as Record<string, unknown>;
      if (typeof seq === "number" && Number.isSafeInteger(seq) && seq > 0 &&
          typeof slot === "number" && Number.isInteger(slot) && slot >= 0 && slot <= WEAPONS.length &&
          typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= 64 &&
          typeof at === "number" && Number.isFinite(at) && at >= 0) cb(seq, { slot, count, at });
    });
  }
  onHit(cb: (e: HitEvent) => void): void {
    this.room.onMessage("hit", (p) => cb(p as HitEvent));
  }
  onHurt(cb: (bearing: number | null) => void): void {
    this.room.onMessage("hurt", (p) => {
      if (!p || typeof p !== 'object' || !('bearing' in p)) return;
      const bearing = p.bearing;
      if (bearing === null || (typeof bearing === 'number' && Number.isFinite(bearing))) cb(bearing);
    });
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
