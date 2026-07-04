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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
