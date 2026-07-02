import { DurableObject } from "cloudflare:workers";

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
 */
interface RoomEntry {
  type: string;
  filter: string;
  maxClients: number;
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

export interface RoomInfo {
  roomId: string;
  type: string;
  count: number;
  maxClients: number;
  locked: boolean;
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

export class Matchmaker extends DurableObject {
  private readonly rooms = new Map<string, RoomEntry>();
  /** Pending (not-yet-connected) seat holds, keyed by session id. */
  private readonly reservations = new Map<string, Reservation>();
  /**
   * Sessions this matchmaker has issued, kept beyond reservation consumption so a
   * reconnecting client still validates. Bounded by {@link ISSUED_TTL_MS} and
   * {@link MAX_ISSUED} to avoid unbounded growth.
   */
  private readonly issued = new Map<string, IssuedSession>();

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

  /** Find an available room of (type, filter) or create one; reserve a seat. */
  reserve(type: string, filter: string, maxClients: number): { roomId: string; sessionId: string } {
    const now = Date.now();
    this.prune(now);

    let target: string | undefined;
    for (const [id, room] of this.rooms) {
      if (room.type === type && room.filter === filter && !this.isLocked(id, room)) {
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
   * Live occupancy report from a room DO (on every join and final leave).
   * `sessions` are the client ids currently seated; their reservations (if any)
   * are consumed here since the live count now covers them. Reports are
   * fire-and-forget RPCs, so `seq` (monotonic per room) discards any that
   * arrive out of order — a stale count must never overwrite a newer one.
   */
  report(roomId: string, count: number, sessions: string[], seq: number): void {
    const room = this.rooms.get(roomId);
    if (!room) return; // room wasn't created through matchmaking — nothing to track
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
      out.push({
        roomId: id,
        type: room.type,
        count: this.occupancy(id, room),
        maxClients: room.maxClients,
        locked: this.isLocked(id, room),
      });
    }
    return out;
  }
}
