import { routePartykitRequest } from "partyserver";
import { defineRoom } from "@tikron/server";
import { ArenaRoomImpl } from "./rooms/arena-room.js";

export interface Env {
  ArenaRoom: DurableObjectNamespace;
}

/**
 * The arena room as a Durable Object. The binding name `ArenaRoom` maps to the
 * kebab-case party `arena-room` (AGENTS.md rule 4):
 *   ArenaRoom -> wss://<host>/parties/arena-room/<room-id>
 */
export const ArenaRoom = defineRoom(ArenaRoomImpl);

/**
 * Minimal M0 matchmaking: hand the client a room id + a fresh session key. All
 * players funnel into one arena room ("arena") whose `maxClients` cap the room
 * enforces server-side; team balancing happens on join. (A real matchmaker DO —
 * multiple rooms, reservations, region hints — is the gateway pattern to graft in
 * post-M0; the client contract here, `{ party, room, session }`, stays the same.)
 */
function handleMatchmake(): Response {
  return Response.json({
    party: "arena-room",
    room: "arena",
    session: crypto.randomUUID(),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true });
    }
    if (url.pathname === "/api/matchmake") {
      return handleMatchmake();
    }
    // Static assets (./public) are served automatically for matching paths before
    // this handler runs; everything else falls through to room routing.
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
