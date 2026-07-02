import { DurableObject } from "cloudflare:workers";
import { accrueUsage, loadCaps, monthRoomHours, type Caps } from "./platform/db.js";

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
  /** Live count reported by the room DO; null until the room first reports. */
  reported: number | null;
  /** Highest report seq seen; guards against out-of-order report delivery. */
  reportSeq: number;
  /** Wall-clock time of the last live report; drives staleness pruning. */
  lastReportAt: number;
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

  // --- M5 metering state ---
  private readonly metered = new Map<string, MeteredRoom>();
  private readonly usage = new Map<string, ProjectUsage>();
  private cachedCaps: Caps | null = null;
  private cachedCapsAt = 0;
  private flushScheduled = false;

  private pendingFor(roomId: string): number {
    let n = 0;
    for (const res of this.reservations.values()) if (res.roomId === roomId) n++;
    return n;
  }

  private occupancy(roomId: string, room: RoomEntry): number {
    return (room.reported ?? 0) + this.pendingFor(roomId);
  }

  private isLocked(roomId: string, room: RoomEntry): boolean {
    return this.occupancy(roomId, room) >= room.maxClients;
  }

  private prune(now: number): void {
    for (const [sid, res] of this.reservations) {
      if (res.expiresAt <= now) {
        this.reservations.delete(sid);
        this.dropIfEmpty(res.roomId);
      }
    }
    // Drop phantom rooms: a room that reported live occupancy but has since gone
    // silent past STALE_MS (its heartbeat stopped — the DO likely died without a
    // clean final leave). Reservation-only rooms (never reported) are governed by
    // their reservations' TTL above, not by staleness.
    for (const [id, room] of this.rooms) {
      if (room.reported !== null && now - room.lastReportAt >= STALE_MS) {
        this.rooms.delete(id);
      }
    }
    for (const [sid, sess] of this.issued) {
      if (sess.expiresAt <= now) this.issued.delete(sid);
    }
  }

  /** Forget a room once it has neither live occupants nor pending holds. */
  private dropIfEmpty(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room && (room.reported ?? 0) === 0 && this.pendingFor(roomId) === 0) {
      this.rooms.delete(roomId);
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
  ): { roomId: string; sessionId: string } {
    const now = Date.now();
    this.prune(now);

    const pid = projectId ?? null;
    let target: string | undefined;
    for (const [id, room] of this.rooms) {
      if (
        room.type === type &&
        room.filter === filter &&
        room.projectId === pid &&
        !this.isLocked(id, room)
      ) {
        target = id;
        break;
      }
    }
    if (target === undefined) {
      target = crypto.randomUUID();
      this.rooms.set(target, {
        type,
        filter,
        maxClients: Math.max(1, maxClients),
        projectId: pid,
        reported: null,
        reportSeq: 0,
        lastReportAt: now,
      });
    }

    const sessionId = crypto.randomUUID();
    this.reservations.set(sessionId, { roomId: target, expiresAt: now + RESERVATION_TTL_MS });
    this.rememberIssued(sessionId, target, now);
    return { roomId: target, sessionId };
  }

  /** Record an issued session, evicting the oldest when at capacity. */
  private rememberIssued(sessionId: string, roomId: string, now: number): void {
    if (this.issued.size >= MAX_ISSUED) {
      const oldest = this.issued.keys().next().value; // Map preserves insertion order
      if (oldest !== undefined) this.issued.delete(oldest);
    }
    this.issued.set(sessionId, { roomId, expiresAt: now + ISSUED_TTL_MS });
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
      this.issued.delete(sessionId);
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
      if (res && res.roomId === roomId) this.reservations.delete(sid);
    }
    room.reported = Math.max(0, count);
    this.dropIfEmpty(roomId);
  }

  /** Release a pending seat hold (reservation abandoned before connecting). */
  release(sessionId: string): void {
    const res = this.reservations.get(sessionId);
    if (!res) return;
    this.reservations.delete(sessionId);
    this.dropIfEmpty(res.roomId);
  }

  /** List rooms (optionally filtered by type) for a lobby browser. */
  list(type?: string): RoomInfo[] {
    this.prune(Date.now());
    const out: RoomInfo[] = [];
    for (const [id, room] of this.rooms) {
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
    for (const m of this.metered.values()) {
      if (m.reported > 0) this.usageFor(m.projectId).roomSeconds += (now - m.accrualAt) / 1000;
      m.accrualAt = now;
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
    }
    // Drop empty metered rooms (already accrued).
    for (const [id, m] of this.metered) if (m.reported === 0) this.metered.delete(id);
  }

  private async getCaps(): Promise<Caps> {
    const now = Date.now();
    if (this.cachedCaps && now - this.cachedCapsAt < CAPS_TTL_MS) return this.cachedCaps;
    const db = this.db();
    this.cachedCaps = db
      ? await loadCaps(db)
      : { roomHoursPerMonth: 5000, concurrentRooms: 50, playersPerRoom: 20 };
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
