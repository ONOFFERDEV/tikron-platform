import type { PortalMarker } from "../zones/types.js";
import type { SavedZone } from "../types.js";

/**
 * Zone-transfer flow shared by every zone room (PLAN-EMBERFALL-M2 §6): portal-touch
 * detection, the destination lookup, and the two fixed non-instanced room ids. Kept in
 * one module (rather than duplicated ad hoc) because `village-room.ts`, `field-room.ts`,
 * and `dungeon-room.ts` all need byte-identical behavior here — the whole point of the
 * Wave-B contract is that a portal's destination doesn't depend on which zone it's
 * placed in. No server/DO imports — pure data + a small stateful tracker class, safe
 * for every zone room to import without pulling anything into `ember-room-base.ts`
 * (which stays untouched per this wave's file-boundary rule).
 */

/** World-unit radius within which a player is considered "on" a portal marker. */
export const PORTAL_TOUCH_RADIUS = 2;

/** Fixed room id for the (singleton, non-instanced) village zone room. */
export const VILLAGE_ROOM_ID = "emberhold-1";

/** Fixed room id for the (singleton, non-instanced) field zone room — matches
 *  `client/main.ts`'s existing M1 `DEFAULT_ROOM_ID`; unchanged by M2. */
export const FIELD_ROOM_ID = "ashen-1";

/** One `"transfer"` message payload — the Wave-B shared wire contract. B3's client
 *  listens for `client.send("transfer", payload)` and reconnects to `party`/`room`. */
export interface TransferPayload {
  zone: SavedZone;
  party: "village-room" | "field-room" | "dungeon-room";
  room: string;
}

/**
 * Mint a fresh dungeon-instance invite code (PLAN-EMBERFALL-M2 §6: the dungeon room id
 * doubles as its private instance's invite code — sharing the resulting URL brings a
 * friend into the SAME instance). M2 always mints a fresh code on portal entry (no
 * per-character code reuse across visits — see `dungeon-room.ts`'s docblock for the
 * scope note); a returning player gets a brand-new empty instance every time.
 */
export function mintDungeonCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

/**
 * Resolves a touched portal's `kind` to the transfer payload for that destination.
 * Generic across every zone room: a portal's `kind` alone determines where it leads,
 * regardless of which zone it's physically placed in (a `"village"` portal in the
 * field room and a `"village"` portal in the dungeon room both resolve identically).
 */
export function resolveTransfer(kind: PortalMarker["kind"]): TransferPayload {
  switch (kind) {
    case "village":
      return { zone: "emberhold", party: "village-room", room: VILLAGE_ROOM_ID };
    case "field":
      return { zone: "ashen-fields", party: "field-room", room: FIELD_ROOM_ID };
    case "dungeon":
      return { zone: "ember-depths", party: "dungeon-room", room: mintDungeonCode() };
  }
}

/**
 * Debounced per-player portal-entry detector (PLAN-EMBERFALL-M2 §6: a portal touch
 * fires once per continuous stay on a marker, not every tick a player lingers on it).
 * One instance per room; call {@link check} once per seated player per tick, after the
 * room's own `onTick()` has refreshed `state.units` for this tick.
 */
export class PortalTracker {
  private readonly inside = new Map<string, string>();

  /** Returns the portal newly entered this tick, or undefined if `clientId` is off
   *  every portal or already inside the one they're standing on. */
  check(
    clientId: string,
    pos: { x: number; y: number },
    portals: readonly PortalMarker[],
  ): PortalMarker | undefined {
    const portal = portals.find(
      (p) => Math.hypot(pos.x - p.pos.x, pos.y - p.pos.y) <= PORTAL_TOUCH_RADIUS,
    );
    if (!portal) {
      this.inside.delete(clientId);
      return undefined;
    }
    if (this.inside.get(clientId) === portal.id) return undefined; // already inside — debounced
    this.inside.set(clientId, portal.id);
    return portal;
  }

  /** Drop bookkeeping for a client that left the room (avoids unbounded growth on a
   *  long-lived village/field room across many sessions). */
  forget(clientId: string): void {
    this.inside.delete(clientId);
  }
}
