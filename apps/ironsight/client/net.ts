import type { RecoilState } from "../src/recoil.js";
import type { WeaponActionState } from "../src/weapon-action.js";
import {
  readServerShotResult,
  scopedShotId,
  type ServerShotResult,
  type ShotAttempt,
} from "../src/combat-events.js";
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
import {
  CONTENT_REVISION,
  readContentRevision,
  readContentRevisionValue,
  type ContentMismatch,
} from "../config/ww1-content.js";

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
  shotId?: string;
  victim: string;
  dmg: number;
  damage?: number;
  head: boolean;
  part?: "body" | "head";
}
export interface WeaponActionPayload {
  readonly id: string;
  readonly state: WeaponActionState | null;
  readonly weaponIndex?: number;
  readonly serial?: number;
}
export interface KillEvent {
  shotId?: string;
  medal?: 'ambush';
  killer: string;
  victim: string;
  part: string;
  killerTeam: number | null;
  weapon?: number | null;
  assist?: string;
}
export interface ShotEvent {
  shotId?: string;
  acceptedAt?: number;
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
  intermissionEndMs?: number;
  mvp?: import('../src/round-honors.js').RoundMvp;
  /** TDM/DOM: "red" | "blue" | "draw". FFA: the winning player's session id (or
   *  "draw" on the rare scoreless-timeout fallback — see arena-room's endMatch). */
  winner: string;
  red: number;
  blue: number;
}

export interface VoteEvent {
  readonly count: number;
  readonly need: number;
}

interface Matchmake {
  readonly party: string;
  readonly room: string;
  readonly session: string;
  readonly contentRevision: number | null;
}

export class ContentRevisionMismatchError extends Error {
  override readonly name = "ContentRevisionMismatchError";

  constructor(
    readonly expected: number,
    readonly received: number | null,
  ) {
    super(`content revision mismatch: expected ${expected}, received ${received ?? "missing"}`);
  }
}

function readMatchmake(payload: unknown): Matchmake | null {
  if (typeof payload !== "object" || payload === null) return null;
  const party = "party" in payload ? payload.party : undefined;
  const room = "room" in payload ? payload.room : undefined;
  const session = "session" in payload ? payload.session : undefined;
  const contentRevision = readContentRevisionValue("contentRevision" in payload ? payload.contentRevision : undefined);
  if (typeof party !== "string" || typeof room !== "string" || typeof session !== "string") return null;
  return { party, room, session, contentRevision };
}

function readContentMismatch(payload: unknown): ContentMismatch | null {
  if (typeof payload !== "object" || payload === null) return null;
  const expected = "expected" in payload ? payload.expected : undefined;
  const received = "received" in payload ? payload.received : undefined;
  const action = "action" in payload ? payload.action : undefined;
  if (typeof expected !== "number" || !Number.isSafeInteger(expected) || expected < 0) return null;
  if (received !== null && (typeof received !== "number" || !Number.isSafeInteger(received) || received < 0)) return null;
  if (action !== "reload") return null;
  return { expected, received, action };
}

const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const nonNegativeFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function readAmmoEvent(value: unknown): AmmoEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;
  if (!nonNegativeInteger(event["mag"]) || !nonNegativeInteger(event["reserve"]) ||
      !nonNegativeInteger(event["weapon"]) || event["weapon"] < 1 || event["weapon"] > WEAPONS.length ||
      (event["reloadMs"] !== undefined && !nonNegativeFinite(event["reloadMs"]))) return null;
  return {
    mag: event["mag"],
    reserve: event["reserve"],
    weapon: event["weapon"],
    ...(event["reloadMs"] === undefined ? {} : { reloadMs: event["reloadMs"] as number }),
  };
}

export function readRespawnId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const id = "id" in value ? value.id : undefined;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function readMatchEndEvent(value: unknown): MatchEndEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;
  if (typeof event["winner"] !== "string" || event["winner"].length === 0 ||
      !nonNegativeInteger(event["red"]) || !nonNegativeInteger(event["blue"]) ||
      (event["intermissionEndMs"] !== undefined && !nonNegativeFinite(event["intermissionEndMs"]))) return null;
  const mvpValue = event["mvp"];
  let mvp: import('../src/round-honors.js').RoundMvp | undefined;
  if (mvpValue !== undefined) {
    if (typeof mvpValue !== "object" || mvpValue === null) return null;
    const candidate = mvpValue as Record<string, unknown>;
    if (typeof candidate["id"] !== "string" || candidate["id"].length === 0 ||
        !Number.isSafeInteger(candidate["team"]) ||
        !nonNegativeInteger(candidate["kills"]) || !nonNegativeInteger(candidate["assists"]) ||
        !nonNegativeInteger(candidate["captureSeconds"]) || !nonNegativeInteger(candidate["score"])) return null;
    mvp = {
      id: candidate["id"],
      team: candidate["team"] as number,
      kills: candidate["kills"],
      assists: candidate["assists"],
      captureSeconds: candidate["captureSeconds"],
      score: candidate["score"],
    };
  }
  return {
    winner: event["winner"],
    red: event["red"],
    blue: event["blue"],
    ...(event["intermissionEndMs"] === undefined ? {} : { intermissionEndMs: event["intermissionEndMs"] as number }),
    ...(mvp === undefined ? {} : { mvp }),
  };
}

export function readVoteEvent(value: unknown): VoteEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;
  if (!nonNegativeInteger(event["count"]) || !nonNegativeInteger(event["need"]) ||
      event["need"] < 1 || event["count"] > event["need"]) return null;
  return { count: event["count"], need: event["need"] };
}

const ACTION_KINDS = ["cycle", "magazine_reload", "pump_reload", "bolt_reload"] as const;
const ACTION_PHASES = ["cycle", "reload_start", "reload_insert", "reload_end", "reload"] as const;

function readWeaponActionState(value: unknown): WeaponActionState | null {
  if (typeof value !== "object" || value === null) return null;
  const state = value as Record<string, unknown>;
  if (!ACTION_KINDS.some(kind => kind === state["kind"]) ||
      !ACTION_PHASES.some(phase => phase === state["phase"]) ||
      !Number.isSafeInteger(state["weaponIndex"]) || Number(state["weaponIndex"]) < 0 ||
      !Number.isSafeInteger(state["serial"]) || Number(state["serial"]) < 1 ||
      !Number.isSafeInteger(state["committed"]) || Number(state["committed"]) < 0 ||
      typeof state["startedAt"] !== "number" || !Number.isFinite(state["startedAt"]) ||
      typeof state["phaseStartedAt"] !== "number" || !Number.isFinite(state["phaseStartedAt"]) ||
      typeof state["endsAt"] !== "number" || !Number.isFinite(state["endsAt"]) ||
      state["phaseStartedAt"] < state["startedAt"] || state["endsAt"] < state["phaseStartedAt"] ||
      typeof state["fireBuffered"] !== "boolean") return null;
  return state as unknown as WeaponActionState;
}

function readWeaponActionPayload(value: unknown): WeaponActionPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload["id"] !== "string" || payload["id"].length === 0 || !("state" in payload)) return null;
  if (payload["state"] === null) {
    const weaponIndex = payload["weaponIndex"];
    const serial = payload["serial"];
    if (weaponIndex !== undefined && (!Number.isSafeInteger(weaponIndex) || Number(weaponIndex) < 0)) return null;
    if (serial !== undefined && (!Number.isSafeInteger(serial) || Number(serial) < 1)) return null;
    return { id: payload["id"], state: null,
      ...(weaponIndex === undefined ? {} : { weaponIndex: Number(weaponIndex) }),
      ...(serial === undefined ? {} : { serial: Number(serial) }) };
  }
  const state = readWeaponActionState(payload["state"]);
  return state ? { id: payload["id"], state } : null;
}

function readShotId(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" && /^[^:]+:\d+:\d+$/.test(value) ? value : null;
}

function readHitEvent(value: unknown): HitEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;
  const shotId = readShotId(event["shotId"]);
  if (shotId === null || typeof event["victim"] !== "string" || event["victim"].length === 0 ||
      typeof event["dmg"] !== "number" || !Number.isFinite(event["dmg"]) || event["dmg"] <= 0 ||
      typeof event["head"] !== "boolean" ||
      (event["damage"] !== undefined && (typeof event["damage"] !== "number" || !Number.isFinite(event["damage"]))) ||
      (event["part"] !== undefined && event["part"] !== "body" && event["part"] !== "head")) return null;
  return {
    ...(shotId === undefined ? {} : { shotId }),
    victim: event["victim"],
    dmg: event["dmg"],
    ...(event["damage"] === undefined ? {} : { damage: event["damage"] as number }),
    head: event["head"],
    ...(event["part"] === undefined ? {} : { part: event["part"] as "body" | "head" }),
  };
}

function readKillEvent(value: unknown): KillEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;
  const shotId = readShotId(event["shotId"]);
  const killerTeam = event["killerTeam"];
  if (shotId === null || typeof event["killer"] !== "string" || event["killer"].length === 0 ||
      typeof event["victim"] !== "string" || event["victim"].length === 0 ||
      typeof event["part"] !== "string" || event["part"].length === 0 ||
      (killerTeam !== null && (!Number.isInteger(killerTeam) || Number(killerTeam) < 0 || Number(killerTeam) > 1)) ||
      (event["weapon"] !== undefined && event["weapon"] !== null &&
        (!Number.isInteger(event["weapon"]) || Number(event["weapon"]) < 1 || Number(event["weapon"]) > WEAPONS.length)) ||
      (event["medal"] !== undefined && event["medal"] !== "ambush") ||
      (event["assist"] !== undefined && (typeof event["assist"] !== "string" || event["assist"].length === 0))) return null;
  return {
    ...(shotId === undefined ? {} : { shotId }),
    killer: event["killer"], victim: event["victim"], part: event["part"],
    killerTeam: killerTeam === null ? null : Number(killerTeam),
    ...(event["weapon"] === undefined ? {} : { weapon: event["weapon"] as number | null }),
    ...(event["assist"] === undefined ? {} : { assist: event["assist"] as string }),
    ...(event["medal"] === "ambush" ? { medal: "ambush" as const } : {}),
  };
}

function readShotEvent(value: unknown): ShotEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const event = value as Record<string, unknown>;
  const shotId = readShotId(event["shotId"]);
  const finiteKeys = ["ox", "oy", "oz", "dx", "dy", "dz", "dist"] as const;
  const weapon = Number(event["weapon"]);
  const directionLength = Math.hypot(Number(event["dx"]), Number(event["dy"]), Number(event["dz"]));
  if (shotId === null || typeof event["from"] !== "string" || event["from"].length === 0 ||
      !Number.isInteger(event["weapon"]) || weapon < 1 || weapon > WEAPONS.length ||
      !finiteKeys.every(key => typeof event[key] === "number" && Number.isFinite(event[key])) ||
      directionLength < 0.001 || Number(event["dist"]) < 0 || Number(event["dist"]) > WEAPONS[weapon - 1]!.range ||
      typeof event["hit"] !== "boolean" ||
      (event["acceptedAt"] !== undefined && (typeof event["acceptedAt"] !== "number" ||
        !Number.isFinite(event["acceptedAt"]) || event["acceptedAt"] < 0))) return null;
  const rawHits = event["hits"];
  if (rawHits !== undefined && !Array.isArray(rawHits)) return null;
  const hits: { id: string; head: boolean }[] = [];
  for (const raw of rawHits ?? []) {
    if (typeof raw !== "object" || raw === null) return null;
    const hit = raw as Record<string, unknown>;
    if (typeof hit["id"] !== "string" || hit["id"].length === 0 || typeof hit["head"] !== "boolean") return null;
    hits.push({ id: hit["id"], head: hit["head"] });
  }
  return {
    ...(shotId === undefined ? {} : { shotId }),
    ...(event["acceptedAt"] === undefined ? {} : { acceptedAt: event["acceptedAt"] as number }),
    from: event["from"], weapon,
    ox: event["ox"] as number, oy: event["oy"] as number, oz: event["oz"] as number,
    dx: event["dx"] as number, dy: event["dy"] as number, dz: event["dz"] as number,
    dist: event["dist"] as number, hit: event["hit"], hits,
  };
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
      if (res.ok) {
        const parsed = readMatchmake(await res.json());
        if (parsed) return parsed;
      }
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
  private weaponIndex = GAME.weaponMeta.defaultIndex;
  private shotLife = 1;
  private contentWaiter: {
    readonly resolve: () => void;
    readonly reject: (error: ContentRevisionMismatchError) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  } | undefined;
  private mismatch: ContentRevisionMismatchError | undefined;
  private readonly mismatchHandlers = new Set<(error: ContentRevisionMismatchError) => void>();

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
    room.onMessage("shotScope", payload => {
      if (typeof payload !== "object" || payload === null || !("life" in payload) ||
          typeof payload.life !== "number" || !Number.isSafeInteger(payload.life) || payload.life < 1) return;
      this.shotLife = payload.life;
    });
    room.onMessage("contentRevision", payload => {
      const revision = readContentRevision(payload);
      if (revision !== CONTENT_REVISION) this.failContent(revision);
    });
    room.onMessage("contentAccepted", payload => {
      if (this.mismatch || readContentRevision(payload) !== CONTENT_REVISION) return;
      this.link.open = true;
      this.link.lostAt = 0;
      const waiter = this.contentWaiter;
      this.contentWaiter = undefined;
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve();
      }
      this.requestSync();
    });
    room.onMessage("contentMismatch", payload => {
      const mismatch = readContentMismatch(payload);
      if (mismatch) this.failContent(mismatch.received);
    });
    room.onMessage((message) => {
      if (message.t === "s:welcome") {
        this.link.open = false;
        this.lastYaw = NaN; this.lastPitch = NaN; this.lastMoveAt = 0;
        this.sendContentReady();
      }
    });
  }

  private sendContentReady(): void {
    this.link.open = false;
    this.room.send("contentReady", { revision: CONTENT_REVISION });
  }

  private waitForContent(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.failContent(null), 5000);
      this.contentWaiter = { resolve, reject, timer };
      this.sendContentReady();
    });
  }

  private failContent(received: number | null): void {
    const error = new ContentRevisionMismatchError(CONTENT_REVISION, received);
    this.mismatch = error;
    this.link.open = false;
    if (this.link.lostAt === 0) this.link.lostAt = performance.now();
    this.room.leave();
    const waiter = this.contentWaiter;
    this.contentWaiter = undefined;
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    for (const handler of this.mismatchHandlers) handler(error);
  }

  /** Connect (matchmake → join), retrying the initial handshake on failure. */
  static async connect(): Promise<Net> {
    for (let attempt = 0; ; attempt++) {
      try {
        const mm = await matchmake();
        if (mm.contentRevision !== CONTENT_REVISION) {
          throw new ContentRevisionMismatchError(CONTENT_REVISION, mm.contentRevision);
        }
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
        const net = new Net(room, mm.room, link);
        await net.waitForContent();
        return net;
      } catch (err) {
        if (err instanceof ContentRevisionMismatchError) throw err;
        // eslint-disable-next-line no-console
        console.warn(`[net] join failed (attempt ${attempt + 1})`, err);
        await sleep(Math.min(4000, 500 * 2 ** attempt));
      }
    }
  }

  get online(): boolean { return this.link.open; }
  get contentMismatch(): ContentRevisionMismatchError | undefined { return this.mismatch; }
  get connectionExpired(): boolean { return !this.online && performance.now() - this.link.lostAt >= 30000; }
  onContentMismatch(handler: (error: ContentRevisionMismatchError) => void): void {
    this.mismatchHandlers.add(handler);
    if (this.mismatch) handler(this.mismatch);
  }
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
   * budget (the server is the real cadence). Returns the local attempt when a
   * `fire` was sent, so the caller can kick the predicted viewmodel immediately.
   */
  private fireIntervalMs = DEFAULT_WEAPON_SPEC.fireIntervalMs;

  /** Track the held weapon's cadence (main calls this on switch) so held-fire matches it. */
  setFireInterval(weaponIndex: number): void {
    this.weaponIndex = WEAPONS[weaponIndex] ? weaponIndex : GAME.weaponMeta.defaultIndex;
    this.fireIntervalMs = WEAPONS[weaponIndex]?.fireIntervalMs ?? DEFAULT_WEAPON_SPEC.fireIntervalMs;
  }

  canTryFire(now: number): boolean {
    return now - this.lastFireAt >= this.fireIntervalMs;
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
  tryFire(now: number, computeClaim?: () => FireClaim | null | undefined, aim?: { yaw: number; pitch: number },
    onSend?: (attempt: ShotAttempt, sendAt: number) => void): ShotAttempt | null {
    if (!this.canTryFire(now)) return null;
    this.lastFireAt = now;
    const claim = computeClaim?.();
    this.fireSeq += 1;
    const rawAim = {
      yaw: aim?.yaw ?? (Number.isFinite(this.lastYaw) ? this.lastYaw : 0),
      pitch: aim?.pitch ?? (Number.isFinite(this.lastPitch) ? this.lastPitch : 0),
    };
    const attempt: ShotAttempt = {
      kind: "attempt",
      shotId: scopedShotId({ connectionId: this.myId, life: this.shotLife }, this.fireSeq),
      weaponIndex: this.weaponIndex,
      localMonoAt: now,
      rawAim,
    };
    onSend?.(attempt, performance.now());
    this.send("fire", { ...rawAim, fireSeq: this.fireSeq, shotId: attempt.shotId,
      ...(claim === undefined ? {} : { claim }) });
    return attempt;
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
    this.room.onMessage("ammo", payload => {
      const event = readAmmoEvent(payload);
      if (event) cb(event);
    });
  }
  onWeaponAction(cb: (event: WeaponActionPayload) => void): void {
    this.room.onMessage("weaponAction", payload => {
      const event = readWeaponActionPayload(payload);
      if (event) cb(event);
    });
  }
  onFireBlocked(cb: (mag: number, slot: number) => void): void {
    this.room.onMessage("fireBlocked", p => {
      if (typeof p !== 'object' || p === null) return;
      const { mag, weapon } = p as { mag?: unknown; weapon?: unknown };
      if (typeof mag === 'number' && Number.isInteger(mag) && mag >= 0 &&
          typeof weapon === 'number' && Number.isInteger(weapon) && weapon >= 1 && weapon <= WEAPONS.length) cb(mag, weapon);
    });
  }
  onShotResult(cb: (result: ServerShotResult) => void): void {
    this.room.onMessage("shotResult", payload => {
      const result = readServerShotResult(payload);
      if (result) cb(result);
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
    this.room.onMessage("hit", payload => {
      const event = readHitEvent(payload);
      if (event) cb(event);
    });
  }
  onHurt(cb: (bearing: number | null) => void): void {
    this.room.onMessage("hurt", (p) => {
      if (!p || typeof p !== 'object' || !('bearing' in p)) return;
      const bearing = p.bearing;
      if (bearing === null || (typeof bearing === 'number' && Number.isFinite(bearing))) cb(bearing);
    });
  }
  onKill(cb: (e: KillEvent) => void): void {
    this.room.onMessage("kill", payload => {
      const event = readKillEvent(payload);
      if (event) cb(event);
    });
  }
  onStreak(cb: (e: { id: string; count: number }) => void): void {
    this.room.onMessage("streak", (p) => cb(p as { id: string; count: number }));
  }
  onShot(cb: (e: ShotEvent) => void): void {
    this.room.onMessage("shot", payload => {
      const event = readShotEvent(payload);
      if (event) cb(event);
    });
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
    this.room.onMessage("respawn", payload => {
      const id = readRespawnId(payload);
      if (id) cb(id);
    });
  }
  onMatchEnd(cb: (e: MatchEndEvent) => void): void {
    this.room.onMessage("matchEnd", payload => {
      const event = readMatchEndEvent(payload);
      if (event) cb(event);
    });
  }
  onVote(cb: (e: VoteEvent) => void): void {
    this.room.onMessage("vote", payload => {
      const event = readVoteEvent(payload);
      if (event) cb(event);
    });
  }
}
