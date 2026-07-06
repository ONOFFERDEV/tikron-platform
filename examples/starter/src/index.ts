import { routePartykitRequest } from "partyserver";
import { defineRoom } from "@tikron/server";
import { ArenaRoomImpl } from "./arena-room.js";

export interface Env {
  ArenaRoom: DurableObjectNamespace;
}

/**
 * `defineRoom` turns the Room class into a Durable Object; the binding name
 * `ArenaRoom` maps to the URL party `arena-room`:
 *   wss://<host>/parties/arena-room/<room-id>
 * Every distinct <room-id> is its own isolated room, created on first join.
 */
export const ArenaRoom = defineRoom(ArenaRoomImpl);

/**
 * Optional room placement: a Durable Object room is created near whoever
 * connects FIRST and stays there for its life. To pin a new room to a
 * geography instead, have the creating client pass a region param —
 * `client.joinOrCreate(roomId, { region: "apac" })` — and this worker forwards
 * it as a Cloudflare `locationHint`. The hint only matters on the connect that
 * CREATES the room; later joins with a different hint are ignored by the
 * platform, and placement is best-effort (a hint, not a guarantee).
 */
const LOCATION_HINTS = new Set(["wnam", "enam", "weur", "eeur", "apac", "oc", "afr", "me"]);

function locationHintFrom(request: Request): DurableObjectLocationHint | undefined {
  const region = new URL(request.url).searchParams.get("region");
  if (!region) return undefined;
  if (!LOCATION_HINTS.has(region)) {
    // Loud, not fatal: a typo'd region should not fail the join — the room is
    // still created, just with default (near-creator) placement.
    console.warn(
      `[tikron] ignoring invalid ?region=${region} — expected one of ${[...LOCATION_HINTS].join(", ")}; using default placement`,
    );
    return undefined;
  }
  return region as DurableObjectLocationHint;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const hint = locationHintFrom(request);
    return (
      (await routePartykitRequest(request, env, hint ? { locationHint: hint } : undefined)) ??
      new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
