import type { Client } from "@tikron/server";
import { EmberRoomBase } from "./ember-room-base.js";
import { PortalTracker, resolveTransfer, VILLAGE_ROOM_ID } from "./zone-transition.js";
import { EMBERHOLD } from "../zones/emberhold.js";
import type { PortalMarker } from "../zones/types.js";

/**
 * Emberhold (마을) — the M2 village room: real zone data (`zones/emberhold.ts`: shop NPC
 * + training dummy markers, building/prop obstacles, a portal to Ashen Fields) plus the
 * zone-transfer flow (PLAN-EMBERFALL-M2 §6).
 *
 * Portal-touch detection is necessarily an `onTick()` override, not the base's
 * `registerZoneIntents()` hook: that hook runs exactly once, during `onReady()`, to
 * register `onMessage` handlers — there is no client message here, since a touch is
 * detected server-side purely from position every simulation tick. `onTick()` is a
 * regular (non-final) protected method on `EmberRoomBase`, so overriding it here (and
 * calling `super.onTick()` first, so `state.units` is already refreshed for this tick)
 * is the correct extension point; it does not require touching `ember-room-base.ts`.
 * `field-room.ts` / `dungeon-room.ts` carry the identical override — the shared bits
 * (debounce tracking, portal->destination resolution, the two fixed non-instanced room
 * ids) live in `zone-transition.ts` so all three stay byte-identical in behavior.
 *
 * `persist.ts`'s `createCharacter` spawn defaults (gold/pos) mirror this exact
 * `playerSpawn` — update both if Emberhold's spawn plaza ever moves.
 */
export const VILLAGE_ZONE = EMBERHOLD;

export class VillageRoomImpl extends EmberRoomBase {
  protected readonly zone = VILLAGE_ZONE;
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

  /** Save then notify the client to reconnect at the resolved destination
   *  (PLAN-EMBERFALL-M2 §6: "룸이 캐릭터 저장 + 클라에 transfer 메시지"). */
  private transferOut(client: Client, kind: PortalMarker["kind"]): void {
    const dest = resolveTransfer(kind);
    void this.saveNow(client.id).finally(() => client.send("transfer", dest));
  }
}

export { VILLAGE_ROOM_ID };
