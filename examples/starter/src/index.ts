import { routePartykitRequest } from "partyserver";
import { defineRoom } from "@playedge/server";
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
