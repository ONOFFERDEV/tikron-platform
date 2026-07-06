import { routePartykitRequest } from "partyserver";
import { defineRoom, platformReporter, platformLeaderboard } from "@tikron/server";
import { ArenaRoomImpl } from "./arena-room.js";

export interface Env {
  ArenaRoom: DurableObjectNamespace;
  /**
   * Optional hosted-platform key (a `tk_live_…` secret from the dashboard). Set it
   * to (a) meter this self-hosted game on the tikron.dev usage dashboard and
   * (b) let room code write to hosted leaderboards. Unset → both hooks below are
   * silent no-ops and the game runs entirely on your own account:
   *   wrangler secret put TIKRON_API_KEY
   */
  TIKRON_API_KEY?: string;
}

/**
 * `defineRoom` turns the Room class into a Durable Object; the binding name
 * `ArenaRoom` maps to the URL party `arena-room`:
 *   wss://<host>/parties/arena-room/<room-id>
 * Every distinct <room-id> is its own isolated room, created on first join.
 *
 * The two platform hooks are pre-wired but dormant: with no TIKRON_API_KEY they
 * do nothing (`apiKey` returns undefined → no-op), so nothing is coupled to the
 * hosted platform until you set the key. `reportOccupancy` meters room usage;
 * `services.submitScore` backs `this.services.leaderboard?.submit(...)` in the room.
 */
export const ArenaRoom = defineRoom(ArenaRoomImpl, {
  reportOccupancy: platformReporter({ apiKey: (e) => (e as Env).TIKRON_API_KEY }),
  services: {
    submitScore: platformLeaderboard({ apiKey: (e) => (e as Env).TIKRON_API_KEY }),
  },
});

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
