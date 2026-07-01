import { DurableObject } from "cloudflare:workers";

/**
 * A single global matchmaking registry (one well-known Durable Object). Tracks
 * rooms and seat reservations so `joinOrCreate`-style matchmaking can place
 * players into an available room of a given type + filter, or spin up a new one.
 *
 * State is in-memory (rooms are ephemeral); a reservation holds a seat for a
 * short TTL until the client actually connects (`consume`) or leaves (`release`).
 */
interface RoomEntry {
  type: string;
  filter: string;
  count: number;
  maxClients: number;
}
interface Reservation {
  roomId: string;
  active: boolean;
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
  private readonly reservations = new Map<string, Reservation>();

  private isLocked(r: RoomEntry): boolean {
    return r.count >= r.maxClients;
  }

  private prune(now: number): void {
    for (const [sid, res] of this.reservations) {
      if (!res.active && res.expiresAt <= now) this.removeReservation(sid);
    }
  }

  private removeReservation(sessionId: string): void {
    const res = this.reservations.get(sessionId);
    if (!res) return;
    this.reservations.delete(sessionId);
    const room = this.rooms.get(res.roomId);
    if (room) {
      room.count = Math.max(0, room.count - 1);
      if (room.count === 0) this.rooms.delete(res.roomId);
    }
  }

  /** Find an available room of (type, filter) or create one; reserve a seat. */
  reserve(type: string, filter: string, maxClients: number): { roomId: string; sessionId: string } {
    const now = Date.now();
    this.prune(now);

    let target: string | undefined;
    for (const [id, room] of this.rooms) {
      if (room.type === type && room.filter === filter && !this.isLocked(room)) {
        target = id;
        break;
      }
    }
    if (target === undefined) {
      target = crypto.randomUUID();
      this.rooms.set(target, { type, filter, count: 0, maxClients: Math.max(1, maxClients) });
    }

    const room = this.rooms.get(target)!;
    room.count += 1;
    const sessionId = crypto.randomUUID();
    this.reservations.set(sessionId, {
      roomId: target,
      active: false,
      expiresAt: now + RESERVATION_TTL_MS,
    });
    return { roomId: target, sessionId };
  }

  /** Mark a reservation as consumed (client connected) so it won't expire. */
  consume(sessionId: string): void {
    const res = this.reservations.get(sessionId);
    if (res) res.active = true;
  }

  /** Release a seat (client left or reservation abandoned). */
  release(sessionId: string): void {
    this.removeReservation(sessionId);
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
        count: room.count,
        maxClients: room.maxClients,
        locked: this.isLocked(room),
      });
    }
    return out;
  }
}
