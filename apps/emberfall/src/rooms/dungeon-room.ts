import type { Client } from "@tikron/server";
import { EmberRoomBase } from "./ember-room-base.js";
import { PortalTracker, resolveTransfer } from "./zone-transition.js";
import { EMBER_DEPTHS } from "../zones/ember-depths.js";
import type { PortalMarker } from "../zones/types.js";

/**
 * Ember Depths (잉걸불 심연) — the M2 dungeon room: real zone data (`zones/ember-depths.ts`:
 * wave-marker stand-ins, mid/end boss stand-ins, a portal back to the village) plus the
 * zone-transfer flow (PLAN-EMBERFALL-M2 §6). See `village-room.ts`'s docblock for why
 * portal-touch detection is an `onTick()` override rather than `registerZoneIntents()`.
 *
 * ## Private instance / invite-code addressing
 *
 * A dungeon instance has NO party-level identity of its own beyond its **room id**:
 * `defineRoom` already routes every `DungeonRoom` connection through the single fixed
 * party `dungeon-room` (index.ts's docblock: `wss://<host>/parties/dungeon-room/<room-id>`)
 * — Durable Objects are addressed by `(party, room id)`, so two different room ids under
 * the SAME party are already two independent DO instances with zero code here needed to
 * enforce isolation. The room id itself IS the invite code: `zone-transition.ts`'s
 * `mintDungeonCode()` mints a fresh one on every village/field->dungeon portal touch, and
 * that string becomes this room's `this.id` the moment the client reconnects to
 * `party: "dungeon-room", room: <code>` (see `client/net.ts`'s `GameClient.joinOrCreate`
 * pattern, already used for the field party). B3's client-side job: after receiving a
 * `"transfer"` message with `party: "dungeon-room"`, update the visible URL to encode
 * `payload.room` (e.g. `?dungeon=<code>`) so the player can copy/share it — a friend
 * opening that URL should connect DIRECTLY to `dungeon-room/<code>` (skip walking a
 * portal), landing in the SAME instance. M2 always mints a fresh code on entry (no
 * per-character code persistence across visits) — a returning player gets a brand-new
 * empty instance every time, which is within PLAN-EMBERFALL-M2 §9's "이동 가능한 빈
 * 인스턴스+웨이브 뼈대까지만" scope line.
 *
 * ## Empty-instance cleanup (PLAN §9: "onDispose+30분 TTL")
 *
 * No custom TTL timer is added here: `Room`'s core (`packages/server/src/room.ts`,
 * `finalizeLeave`) already calls `onDispose()` and clears the room's persisted D1/DO
 * snapshot THE MOMENT its last seat's reconnection window (30s, `CasualRealtimeRoom`'s
 * `reconnectWindowSec`) elapses — i.e., an empty dungeon instance is already reclaimed
 * within seconds, well inside the 30-minute ceiling the plan allows. A fresh invite code
 * every entry (above) means an abandoned instance is never rejoined anyway, so there is
 * no separate "still-referenced but idle" state a longer TTL would need to guard.
 */
export const DUNGEON_ZONE = EMBER_DEPTHS;

export class DungeonRoomImpl extends EmberRoomBase {
  protected readonly zone = DUNGEON_ZONE;
  private readonly portals = new PortalTracker();

  protected override onTick(): void {
    super.onTick();
    for (const client of this.clientList()) {
      const unit = this.state.units[client.id];
      if (!unit || unit.kind !== "player" || !unit.alive) continue;
      const portal = this.portals.check(client.id, unit, this.zone.portals);
      if (portal) this.transferOut(client, portal.kind);
    }
  }

  protected override onSeatExpired(client: Client): void | Promise<void> {
    this.portals.forget(client.id);
    return super.onSeatExpired(client);
  }

  private transferOut(client: Client, kind: PortalMarker["kind"]): void {
    const dest = resolveTransfer(kind);
    void this.saveNow(client.id).finally(() => client.send("transfer", dest));
  }
}
