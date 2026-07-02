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
}
interface Reservation {
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

export class Matchmaker extends DurableObject {
  private readonly rooms = new Map<string, RoomEntry>();
  /** Pending (not-yet-connected) seat holds, keyed by session id. */
  private readonly reservations = new Map<string, Reservation>();

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
      });
    }

    const sessionId = crypto.randomUUID();
    this.reservations.set(sessionId, { roomId: target, expiresAt: now + RESERVATION_TTL_MS });
    return { roomId: target, sessionId };
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
