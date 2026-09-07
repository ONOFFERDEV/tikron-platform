import { DurableObject } from "cloudflare:workers";
import { accrueUsage, loadCaps, monthRoomHours, type Caps } from "./platform/db.js";
import { isLocationHint } from "./region.js";

/**
 * A single global matchmaking registry (one well-known Durable Object). Tracks
 * rooms and seat reservations so `joinOrCreate`-style matchmaking can place
 * players into an available room of a given type + filter, or spin up a new one.
 *
 * Occupancy is two-part:
 *  - **pending reservations** — a `reserve()` holds a seat for a short TTL until
 *    the client actually connects or the hold expires;
 *  - **live counts** — rooms report their real occupancy (`report()`) on every
 *    join and final leave. A report also consumes any pending reservations for
 *    the sessions it lists, so a connected player is never counted twice.
 *
 * A room's effective occupancy is `reported + pending`; before a room's first
 * report (nobody has connected yet) it is just `pending`.
 *
 * M5: this DO is also the platform's usage authority. Reports carry an optional
 * `projectId` + message delta; the DO accrues per-project room-seconds, peak CCU,
 * and message counts, and flushes them to D1 `usage_daily` on a ~60s alarm. Caps
 * (room-hours/month, concurrent rooms) are checked here too, since it already
 * knows live per-project occupancy. (Chose to fold metering into the Matchmaker
 * rather than a separate Usage DO: reports already flow here, avoiding a second
 * DO hop per report and a duplicate room ledger.)
 */
interface RoomEntry {
  type: string;
  filter: string;
  maxClients: number;
  /** Owning project (M5), or null for unmetered/dev rooms. */
  projectId: string | null;
  /**
   * Cloudflare placement hint recorded at reservation, echoed to the client to
   * forward on connect (applied to the DO on first contact). Null = default
   * placement (near the first client).
   */
  locationHint: string | null;
  /** Live count reported by the room DO; null until the room first reports. */
  reported: number | null;
  /** Highest report seq seen; guards against out-of-order report delivery. */
  reportSeq: number;
  /** Wall-clock time of the last live report; drives staleness pruning. */
  lastReportAt: number;
  /**
   * Self-hosted rooms only (`ext:` keys): the origin the customer's worker serves
   * this room on, echoed to the client as `roomUrl`. Null/absent = gateway-hosted.
   */
  baseUrl?: string | null;
}
interface Reservation {
  roomId: string;
  expiresAt: number;
}
/** A session key this matchmaker issued for a room; outlives its reservation. */
interface IssuedSession {
  roomId: string;
  expiresAt: number;
}

/** Per-room metering ledger entry (independent of the matchmaking `rooms` map). */
interface MeteredRoom {
  projectId: string;
  reported: number;
  reportSeq: number;
  /** Last time this room's occupied-seconds were accrued into its project. */
  accrualAt: number;
}
/** Pending (unflushed) usage for a project, plus a cached month-hours total. */
interface ProjectUsage {
  roomSeconds: number;
  messages: number;
  /** Running max concurrent sessions since the last flush. */
  peakCcu: number;
  /** UTC "YYYY-MM" the cached month total is for. */
  monthKey: string;
  /** Cached D1 month room-hours (excludes the pending `roomSeconds` above). */
  monthHours: number;
}

export interface RoomInfo {
  roomId: string;
  type: string;
  count: number;
  maxClients: number;
  locked: boolean;
}

export type CapError = "cap_room_hours" | "cap_concurrent_rooms";

export interface ProjectLimits {
  caps: Caps;
  monthRoomHours: number;
  liveRooms: number;
}

interface MatchmakerEnv {
  DB?: D1Database;
}

/**
 * Namespaced key for a self-hosted room. Keeps a customer's room id from ever
 * colliding with a gateway room id (a UUID) or another project's, and marks the
 * entry as external everywhere the ledger is walked.
 */
export function externalRoomKey(projectId: string, roomId: string): string {
  return `ext:${projectId}:${roomId}`;
}

/** True for a key minted by {@link externalRoomKey} (a self-hosted room). */
export function isExternalRoom(roomId: string): boolean {
  return roomId.startsWith("ext:");
}

/** Inverse of {@link externalRoomKey}: the customer's own room id, for the client. */
export function unprefixExternalRoom(projectId: string, roomKey: string): string {
  const prefix = externalRoomKey(projectId, "");
  return roomKey.startsWith(prefix) ? roomKey.slice(prefix.length) : roomKey;
}

const RESERVATION_TTL_MS = 15_000;
/**
 * How long after its last report a live room is considered a phantom (its DO
 * died without a clean final leave). Three missed 30s heartbeats.
 */
const STALE_MS = 90_000;
/** How long an issued session stays valid for reconnection (bounds map growth). */
const ISSUED_TTL_MS = 24 * 60 * 60 * 1000;
/** Hard cap on remembered issued sessions; oldest is evicted past this. */
const MAX_ISSUED = 50_000;
/** Metering flush interval to D1. */
const USAGE_FLUSH_MS = 60_000;
/** Caps config cache TTL. */
const CAPS_TTL_MS = 60_000;

export class Matchmaker extends DurableObject<MatchmakerEnv> {
  private readonly rooms = new Map<string, RoomEntry>();
  /** Pending (not-yet-connected) seat holds, keyed by session id. */
  private readonly reservations = new Map<string, Reservation>();
  /**
   * Sessions this matchmaker has issued, kept beyond reservation consumption so a
   * reconnecting client still validates. Bounded by {@link ISSUED_TTL_MS} and
   * {@link MAX_ISSUED} to avoid unbounded growth.
   */
  private readonly issued = new Map<string, IssuedSession>();
  /**
   * Where each project's self-hosted rooms live (latest occupancy report wins).
   * Lets the matchmaker mint a BRAND-NEW room id on the customer's own worker —
   * their Durable Object is created by the first client that connects.
   *
   * ponytail: one origin per project, last report wins. Key it by (project, type)
   * if a customer ever needs to serve two room types from separate deployments.
   */
  private readonly projectBaseUrl = new Map<string, string>();

  // --- M5 metering state ---
  private readonly metered = new Map<string, MeteredRoom>();
  private readonly usage = new Map<string, ProjectUsage>();
  private cachedCaps: Caps | null = null;
  private cachedCapsAt = 0;
  private flushScheduled = false;

  /**
   * Persistence: the whole ledger (rooms/reservations/issued) and the metering
   * accumulators (metered/usage) live in DO storage, one key per entry under a
   * short prefix — `r:` rooms, `v:` reservations, `i:` issued, `m:` metered,
   * `u:` usage, `p:` per-project self-host base URLs. Per-key (not one big
   * snapshot) bounds each write to the few
   * entries a hot-path call actually touches; multiple puts within one RPC turn
   * coalesce into a single storage transaction (~1 write per reserve/report).
   * Without this the DO's in-memory maps evaporate on idle eviction, so a room
   * created for one player is gone before the next player arrives — every user
   * lands in a fresh room. Writes are fire-and-forget: the DO output gate holds
   * the RPC response until they are durable (same pattern as the room snapshot).
   */
  constructor(ctx: DurableObjectState, env: MatchmakerEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const issuedEntries: [string, IssuedSession][] = [];
      for (const [key, val] of await ctx.storage.list()) {
        const id = key.slice(2);
        switch (key[0]) {
          case "r": this.rooms.set(id, val as RoomEntry); break;
          case "v": this.reservations.set(id, val as Reservation); break;
          case "i": issuedEntries.push([id, val as IssuedSession]); break;
          case "m": this.metered.set(id, val as MeteredRoom); break;
          case "u": this.usage.set(id, val as ProjectUsage); break;
          case "p": this.projectBaseUrl.set(id, val as string); break;
        }
      }
      // Reinsert issued in expiry order: expiresAt == insertion time + a fixed
      // TTL, so this restores insertion order, keeping the MAX_ISSUED "evict the
      // oldest" bound honest across a cold start (Map iteration is insertion-ordered).
      issuedEntries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      for (const [id, s] of issuedEntries) this.issued.set(id, s);
    });
  }

  private saveRoom(id: string): void {
    const v = this.rooms.get(id);
    if (v) void this.ctx.storage.put(`r:${id}`, v);
  }
  private forgetRoom(id: string): void {
    this.rooms.delete(id);
    void this.ctx.storage.delete(`r:${id}`);
  }
  private saveRes(sid: string): void {
    const v = this.reservations.get(sid);
    if (v) void this.ctx.storage.put(`v:${sid}`, v);
  }
  private forgetRes(sid: string): void {
    this.reservations.delete(sid);
    void this.ctx.storage.delete(`v:${sid}`);
  }
  private saveIssued(sid: string): void {
    const v = this.issued.get(sid);
    if (v) void this.ctx.storage.put(`i:${sid}`, v);
  }
  private forgetIssued(sid: string): void {
    this.issued.delete(sid);
    void this.ctx.storage.delete(`i:${sid}`);
  }
  private saveMetered(id: string): void {
    const v = this.metered.get(id);
    if (v) void this.ctx.storage.put(`m:${id}`, v);
  }
  private forgetMetered(id: string): void {
    this.metered.delete(id);
    void this.ctx.storage.delete(`m:${id}`);
  }
  private saveUsage(pid: string): void {
    const v = this.usage.get(pid);
    if (v) void this.ctx.storage.put(`u:${pid}`, v);
  }

  private pendingFor(roomId: string): number {
    let n = 0;
    for (const res of this.reservations.values()) if (res.roomId === roomId) n++;
    return n;
  }

  private occupancy(roomId: string, room: RoomEntry): number {
    return (room.reported ?? 0) + this.pendingFor(roomId);
  }

  /** Seats neither live nor held. `isLocked` is just `freeSeats <= 0`. */
  private freeSeats(roomId: string, room: RoomEntry): number {
    return room.maxClients - this.occupancy(roomId, room);
  }

  private isLocked(roomId: string, room: RoomEntry): boolean {
    return this.freeSeats(roomId, room) <= 0;
  }

  private prune(now: number): void {
    for (const [sid, res] of this.reservations) {
      if (res.expiresAt <= now) {
        this.forgetRes(sid);
        this.dropIfEmpty(res.roomId);
      }
    }
    // Drop phantom rooms: a room that reported live occupancy but has since gone
    // silent past STALE_MS (its heartbeat stopped — the DO likely died without a
    // clean final leave). Reservation-only rooms (never reported) are governed by
    // their reservations' TTL above, not by staleness.
    let retiredHosts: Set<string> | undefined;
    for (const [id, room] of this.rooms) {
      if (room.reported !== null && now - room.lastReportAt >= STALE_MS) {
        this.forgetRoom(id);
        // A silent self-hosted room may mean the whole deployment is gone; once
        // the last one lapses, drop the origin too, so matchmaking stops minting
        // rooms on a host that no longer answers.
        if (room.projectId && isExternalRoom(id)) {
          (retiredHosts ??= new Set()).add(room.projectId);
        }
      }
    }
    if (retiredHosts) for (const pid of retiredHosts) this.forgetBaseUrlIfUnused(pid);
    for (const [sid, sess] of this.issued) {
      if (sess.expiresAt <= now) this.forgetIssued(sid);
    }
  }

  /** Forget a room once it has neither live occupants nor pending holds. */
  private dropIfEmpty(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room && (room.reported ?? 0) === 0 && this.pendingFor(roomId) === 0) {
      this.forgetRoom(roomId);
    }
  }

  /**
   * Find an available room of (type, filter) or create one; reserve a seat.
   * `projectId` tags the room for metering/caps attribution (M5). Cap checks are
   * a separate {@link checkCaps} call so this method's shape stays stable.
   */
  reserve(
    type: string,
    filter: string,
    maxClients: number,
    projectId?: string,
    region?: string,
  ): { roomId: string; sessionId: string; region?: string } {
    const many = this.reserveMany(type, filter, maxClients, 1, projectId, region);
    const sessionId = many.sessionIds[0]!;
    return many.region
      ? { roomId: many.roomId, sessionId, region: many.region }
      : { roomId: many.roomId, sessionId };
  }

  /**
   * Party variant of {@link reserve}: place `n` players into ONE room and hold all
   * `n` seats in a single call, so a party is never split across rooms by a
   * concurrent reserve landing between two single holds. A room qualifies only if
   * its free seats (`maxClients − reported − pending`) cover the whole party;
   * otherwise a new room is created (the caller has already checked `n <= max`).
   */
  reserveMany(
    type: string,
    filter: string,
    maxClients: number,
    n: number,
    projectId?: string,
    region?: string,
  ): { roomId: string; sessionIds: string[]; region?: string; roomUrl?: string } {
    const now = Date.now();
    this.prune(now);

    const party = Math.max(1, Math.floor(n));
    const pid = projectId ?? null;
    // Defensive: an unknown hint reserves a default-placed room rather than
    // failing (the /api/matchmake boundary already returns a 400 for bad input).
    const hint = region && isLocationHint(region) ? region : null;
    let target: string | undefined;
    for (const [id, room] of this.rooms) {
      if (
        room.type === type &&
        room.filter === filter &&
        room.projectId === pid &&
        this.freeSeats(id, room) >= party
      ) {
        target = id;
        break;
      }
    }
    if (target === undefined) {
      // A project whose rooms are self-hosted gets a room id on ITS OWN worker —
      // the Durable Object is created there by the first client to connect. Only
      // projects that have reported a base URL (see `registerExternal`) qualify.
      const selfHost = pid ? this.projectBaseUrl.get(pid) : undefined;
      target = selfHost ? externalRoomKey(pid!, crypto.randomUUID()) : crypto.randomUUID();
      this.rooms.set(target, {
        type,
        filter,
        maxClients: Math.max(party, maxClients),
        projectId: pid,
        locationHint: hint,
        reported: null,
        reportSeq: 0,
        lastReportAt: now,
        baseUrl: selfHost ?? null,
      });
      this.saveRoom(target);
    }

    const sessionIds: string[] = [];
    for (let i = 0; i < party; i++) {
      const sessionId = crypto.randomUUID();
      this.reservations.set(sessionId, { roomId: target, expiresAt: now + RESERVATION_TTL_MS });
      this.saveRes(sessionId);
      this.rememberIssued(sessionId, target, now);
      sessionIds.push(sessionId);
    }
    // Echo the room's recorded hint (a reused room keeps its original placement)
    // so the client forwards it on connect.
    const room = this.rooms.get(target);
    const out: { roomId: string; sessionIds: string[]; region?: string; roomUrl?: string } = {
      roomId: target,
      sessionIds,
    };
    if (room?.locationHint) out.region = room.locationHint;
    if (room?.baseUrl) out.roomUrl = room.baseUrl;
    return out;
  }

  /** Record an issued session, evicting the oldest when at capacity. */
  private rememberIssued(sessionId: string, roomId: string, now: number): void {
    if (this.issued.size >= MAX_ISSUED) {
      const oldest = this.issued.keys().next().value; // Map preserves insertion order
      if (oldest !== undefined) this.forgetIssued(oldest);
    }
    this.issued.set(sessionId, { roomId, expiresAt: now + ISSUED_TTL_MS });
    this.saveIssued(sessionId);
  }

  /**
   * Whether this matchmaker issued `sessionId` for `roomId`. Stays true after the
   * session's reservation is consumed by a live report, so a reconnecting client
   * still validates (until the issued-session TTL lapses).
   */
  isIssued(roomId: string, sessionId: string): boolean {
    const sess = this.issued.get(sessionId);
    if (!sess) return false;
    if (sess.expiresAt <= Date.now()) {
      this.forgetIssued(sessionId);
      return false;
    }
    return sess.roomId === roomId;
  }

  /**
   * Session guard wired to a room's `validateSession` hook. Only rooms this
   * matchmaker created (via {@link reserve}) are enforced: a room it never saw —
   * the demos and the starter template generate their own session UUIDs and
   * connect directly, without matchmaking — is always allowed. This is the
   * simplest correct policy: enforce issued-session secrecy exactly where the
   * matchmaker is the authority, and stay out of the way for self-hosted rooms.
   */
  validateSession(roomId: string, sessionId: string): boolean {
    if (!this.rooms.has(roomId)) return true;
    return this.isIssued(roomId, sessionId);
  }

  /**
   * Live occupancy report from a room DO (on every join and final leave, plus a
   * ~30s heartbeat). `sessions` are the client ids currently seated; their
   * reservations (if any) are consumed here since the live count now covers them.
   * Reports are fire-and-forget RPCs, so `seq` (monotonic per room) discards any
   * that arrive out of order. `projectId`/`messages` drive M5 metering.
   */
  report(
    roomId: string,
    count: number,
    sessions: string[],
    seq: number,
    projectId?: string,
    messages?: number,
  ): void {
    const pid = projectId ?? this.rooms.get(roomId)?.projectId ?? null;
    this.meter(roomId, count, seq, pid, messages ?? 0);

    const room = this.rooms.get(roomId);
    if (!room) return; // room wasn't created through matchmaking — metering handled above
    if (seq <= room.reportSeq) return; // late delivery of an older report
    room.reportSeq = seq;
    room.lastReportAt = Date.now();

    for (const sid of sessions) {
      const res = this.reservations.get(sid);
      if (res && res.roomId === roomId) this.forgetRes(sid);
    }
    room.reported = Math.max(0, count);
    this.saveRoom(roomId);
    this.dropIfEmpty(roomId);
  }

  /**
   * Promote a self-hosted room (an `ext:` key, already metered by {@link report})
   * into the matchmaking registry, so `/api/matchmake` can seat players in rooms
   * running on the CUSTOMER's Cloudflare account. Called by the occupancy-ingest
   * route once a report carries the room's type + seat cap + public origin —
   * registration is zero-config, a by-product of metering.
   *
   * External entries then match exactly like hosted ones (same type/filter/project
   * equality, same lock check, same staleness prune). They differ only in that
   * their seats are ADVISORY: the customer's worker never validates our sessions.
   */
  registerExternal(
    roomId: string,
    info: {
      type: string;
      filter: string;
      maxClients: number;
      baseUrl: string;
      projectId: string;
    },
  ): void {
    const existing = this.rooms.get(roomId);
    // `report()` ran first and already knows this room's live count (it meters
    // every ext report, registered or not) — seed from there so a freshly
    // registered room isn't briefly advertised as empty.
    const metered = this.metered.get(roomId);
    this.rooms.set(roomId, {
      type: info.type,
      filter: info.filter,
      maxClients: Math.max(1, info.maxClients),
      projectId: info.projectId,
      locationHint: existing?.locationHint ?? null,
      reported: existing?.reported ?? metered?.reported ?? null,
      reportSeq: existing?.reportSeq ?? metered?.reportSeq ?? 0,
      lastReportAt: Date.now(),
      baseUrl: info.baseUrl,
    });
    this.saveRoom(roomId);
    // Every heartbeat re-reports the same origin; only write when it actually
    // changes so a busy project isn't billed a storage write per report.
    if (this.projectBaseUrl.get(info.projectId) !== info.baseUrl) {
      this.projectBaseUrl.set(info.projectId, info.baseUrl);
      void this.ctx.storage.put(`p:${info.projectId}`, info.baseUrl);
    }
  }

  /** Forget a project's self-host origin once none of its ext rooms remain. */
  private forgetBaseUrlIfUnused(projectId: string): void {
    for (const [id, room] of this.rooms) {
      if (room.projectId === projectId && isExternalRoom(id)) return;
    }
    this.projectBaseUrl.delete(projectId);
    void this.ctx.storage.delete(`p:${projectId}`);
  }

  /** Release a pending seat hold (reservation abandoned before connecting). */
  release(sessionId: string): void {
    const res = this.reservations.get(sessionId);
    if (!res) return;
    this.forgetRes(sessionId);
    this.dropIfEmpty(res.roomId);
  }

  /**
   * List rooms (optionally filtered by type) for a lobby browser. Self-hosted
   * (`ext:`) rooms are excluded: the public lobby is a gateway-hosted surface, and
   * their ids are namespaced internals a client must never see.
   */
  list(type?: string): RoomInfo[] {
    this.prune(Date.now());
    const out: RoomInfo[] = [];
    for (const [id, room] of this.rooms) {
      if (isExternalRoom(id)) continue;
      if (type && room.type !== type) continue;
      out.push(this.roomInfo(id, room));
    }
    return out;
  }

  private roomInfo(id: string, room: RoomEntry): RoomInfo {
    return {
      roomId: id,
      type: room.type,
      count: this.occupancy(id, room),
      maxClients: room.maxClients,
      locked: this.isLocked(id, room),
    };
  }

  // --- M5: metering + caps ---

  private db(): D1Database | undefined {
    return this.env.DB;
  }

  private utcDay(now = Date.now()): string {
    return new Date(now).toISOString().slice(0, 10);
  }
  private utcMonth(now = Date.now()): string {
    return new Date(now).toISOString().slice(0, 7);
  }

  private usageFor(pid: string): ProjectUsage {
    let u = this.usage.get(pid);
    const month = this.utcMonth();
    if (!u) {
      u = { roomSeconds: 0, messages: 0, peakCcu: 0, monthKey: month, monthHours: 0 };
      this.usage.set(pid, u);
    } else if (u.monthKey !== month) {
      u.monthKey = month;
      u.monthHours = 0;
      u.peakCcu = 0;
    }
    return u;
  }

  private projectCcu(pid: string): number {
    let total = 0;
    for (const m of this.metered.values()) if (m.projectId === pid) total += m.reported;
    return total;
  }

  private liveRoomsForProject(pid: string): number {
    const ids = new Set<string>();
    for (const [id, m] of this.metered) if (m.projectId === pid && m.reported > 0) ids.add(id);
    for (const [id, r] of this.rooms) if (r.projectId === pid && this.pendingFor(id) > 0) ids.add(id);
    return ids.size;
  }

  private projectMonthHours(pid: string): number {
    const u = this.usage.get(pid);
    return u ? u.monthHours + u.roomSeconds / 3600 : 0;
  }

  /** Accrue occupied room-seconds, peak CCU, and messages for a metered room. */
  private meter(
    roomId: string,
    count: number,
    seq: number,
    projectId: string | null,
    messages: number,
  ): void {
    if (!projectId || !this.db()) return;
    const now = Date.now();
    let m = this.metered.get(roomId);
    if (!m) {
      m = { projectId, reported: 0, reportSeq: 0, accrualAt: now };
      this.metered.set(roomId, m);
    }
    if (seq <= m.reportSeq) return; // out-of-order metering report
    m.reportSeq = seq;
    const u = this.usageFor(projectId);
    if (m.reported > 0) u.roomSeconds += (now - m.accrualAt) / 1000; // just-ended interval was occupied
    m.accrualAt = now;
    m.reported = Math.max(0, count);
    u.messages += Math.max(0, messages);
    u.peakCcu = Math.max(u.peakCcu, this.projectCcu(projectId));
    this.saveMetered(roomId);
    this.saveUsage(projectId);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    void this.ctx.storage.setAlarm(Date.now() + USAGE_FLUSH_MS);
  }

  override async alarm(): Promise<void> {
    this.flushScheduled = false;
    await this.flushUsage();
    if (this.hasPendingUsage()) this.scheduleFlush();
  }

  private hasPendingUsage(): boolean {
    for (const m of this.metered.values()) if (m.reported > 0) return true;
    for (const u of this.usage.values()) if (u.roomSeconds > 0 || u.messages > 0) return true;
    return false;
  }

  /** Flush accumulated per-project usage to D1 `usage_daily` (best-effort). */
  private async flushUsage(): Promise<void> {
    const db = this.db();
    if (!db) return;
    const now = Date.now();
    // Accrue ongoing occupancy up to now for still-live rooms.
    for (const [id, m] of this.metered) {
      if (m.reported > 0) this.usageFor(m.projectId).roomSeconds += (now - m.accrualAt) / 1000;
      m.accrualAt = now;
      this.saveMetered(id);
    }
    const day = this.utcDay(now);
    const month = this.utcMonth(now);
    for (const [pid, u] of this.usage) {
      if (u.roomSeconds <= 0 && u.messages <= 0 && u.peakCcu <= 0) continue;
      try {
        await accrueUsage(db, {
          projectId: pid,
          day,
          roomHours: u.roomSeconds / 3600,
          peakCcu: u.peakCcu,
          messages: u.messages,
        });
        u.monthHours = await monthRoomHours(db, pid, month);
      } catch {
        // best-effort: keep the pending accumulators for the next flush
        continue;
      }
      u.roomSeconds = 0;
      u.messages = 0;
      u.peakCcu = this.projectCcu(pid); // reset peak baseline to current occupancy
      this.saveUsage(pid);
    }
    // Drop empty metered rooms (already accrued).
    for (const [id, m] of this.metered) if (m.reported === 0) this.forgetMetered(id);
  }

  private async getCaps(): Promise<Caps> {
    const now = Date.now();
    if (this.cachedCaps && now - this.cachedCapsAt < CAPS_TTL_MS) return this.cachedCaps;
    const db = this.db();
    this.cachedCaps = db
      ? await loadCaps(db)
      : { roomHoursPerMonth: 1000, concurrentRooms: 20, playersPerRoom: 20 };
    this.cachedCapsAt = now;
    return this.cachedCaps;
  }

  /**
   * Gate for reserve + key-validated connect: returns a cap code, or null if OK.
   * `includeConcurrentRooms` is true at reserve time; connects pass false so a
   * reconnect to an existing room is never blocked by the concurrent-rooms cap.
   */
  async checkCaps(projectId: string, includeConcurrentRooms = true): Promise<CapError | null> {
    const db = this.db();
    if (!db) return null;
    const caps = await this.getCaps();
    if (includeConcurrentRooms && this.liveRoomsForProject(projectId) >= caps.concurrentRooms) {
      return "cap_concurrent_rooms";
    }
    await this.refreshMonthHours(projectId);
    if (this.projectMonthHours(projectId) >= caps.roomHoursPerMonth) return "cap_room_hours";
    return null;
  }

  /** Refresh a project's cached month room-hours from D1 (persisted + flushed usage). */
  private async refreshMonthHours(projectId: string): Promise<void> {
    const db = this.db();
    if (!db) return;
    try {
      this.usageFor(projectId).monthHours = await monthRoomHours(db, projectId, this.utcMonth());
    } catch {
      // keep the current cache on a read failure
    }
  }

  /** Dashboard: current caps + this month's room-hours + live room count. */
  async projectLimits(projectId: string): Promise<ProjectLimits> {
    const caps = await this.getCaps();
    await this.refreshMonthHours(projectId);
    return {
      caps,
      monthRoomHours: this.projectMonthHours(projectId),
      liveRooms: this.liveRoomsForProject(projectId),
    };
  }

  /**
   * Showcase: live room + player counts for many projects in one RPC (no D1).
   * Used by the public gallery to badge "N playing now" per game.
   */
  liveCountsForProjects(
    projectIds: string[],
  ): Record<string, { rooms: number; players: number }> {
    this.prune(Date.now());
    const out: Record<string, { rooms: number; players: number }> = {};
    for (const pid of projectIds) {
      out[pid] = { rooms: this.liveRoomsForProject(pid), players: this.projectCcu(pid) };
    }
    return out;
  }

  /** Dashboard: live matchmaking rooms belonging to a project. */
  roomsForProject(projectId: string): RoomInfo[] {
    this.prune(Date.now());
    const out: RoomInfo[] = [];
    for (const [id, room] of this.rooms) {
      if (room.projectId === projectId) out.push(this.roomInfo(id, room));
    }
    return out;
  }
}
