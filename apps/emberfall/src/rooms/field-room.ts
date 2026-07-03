import type { Client } from "@tikron/server";
import { EmberRoomBase } from "./ember-room-base.js";
import { ASHEN_FIELDS } from "../zones/ashen-fields.js";
import { PortalTracker, resolveTransfer } from "./zone-transition.js";
import type { PortalMarker } from "../zones/types.js";

/** Ashen Fields (잿빛들판) — mob camps + the field boss are already handled generically
 *  by `EmberRoomBase` from `this.zone`'s spawn tables. The zone-transfer flow
 *  (PLAN-EMBERFALL-M2 §6) is the one M2 addition here: Ashen Fields sits between the
 *  village and the dungeon, so it has portals to BOTH (`zones/ashen-fields.ts`'s
 *  `to-village`/`to-dungeon` markers) — the same `onTick()`-override pattern as
 *  `village-room.ts`/`dungeon-room.ts` (see that file's docblock for why it can't be
 *  `registerZoneIntents()`), sharing the debounce/resolution logic via
 *  `zone-transition.ts` so all three zone rooms behave identically. */
export class FieldRoomImpl extends EmberRoomBase {
  protected readonly zone = ASHEN_FIELDS;
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
