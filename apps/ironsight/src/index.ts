import { routePartykitRequest } from "partyserver";
import { defineRoom } from "@tikron/server";
import { ArenaRoomImpl } from "./rooms/arena-room.js";
import { GAME } from "./game-config.js";

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
 * M2 matchmaking: hand the client a room id + a fresh session key, routed by
 * `?mode=tdm|ffa|dom|practice` (default tdm) to a per-mode room `arena-<mode>` —
 * the room itself picks its {@link GameMode} from that id (see modes.ts).
 * `maxClients` cap the room enforces server-side; team balancing happens on
 * join. `practice` is the one exception to the shared-room-per-mode rule: every
 * request gets its OWN private room (`arena-practice-<random>`, matched by
 * prefix in modes.ts's `modeFromRoomId`), so practice sessions never share a
 * seat with unrelated players. Practice also accepts `&map=arena2|arena3` to
 * pick which map that private room plays on — encoded straight into the room
 * id (`arena-practice-<map>-<random>`) rather than passed out-of-band, so the
 * room (from its own id) and the client (from this response's `room`) always
 * agree on the map via modes.ts's single-source-of-truth `mapForRoom`. Any
 * other/missing `map` value keeps today's plain `arena-practice-<random>`
 * (arena1). (A real matchmaker DO — multiple rooms per mode, reservations,
 * region hints — is the gateway pattern to graft in later; the client
 * contract here, `{ party, room, session }`, stays the same.)
 */
export function handleMatchmake(url: URL): Response {
  const modeParam = url.searchParams.get("mode");
  if (modeParam === "practice") {
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const mapParam = url.searchParams.get("map");
    const room =
      mapParam === "arena2" || mapParam === "arena3"
        ? `arena-practice-${mapParam}-${rand}`
        : `arena-practice-${rand}`;
    return Response.json({
      party: GAME.meta.party,
      room,
      session: crypto.randomUUID(),
    });
  }
  const mode = modeParam === "ffa" || modeParam === "dom" ? modeParam : "tdm";
  return Response.json({
    party: "arena-room",
    room: `arena-${mode}`,
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
      return handleMatchmake(url);
    }
    // Static assets (./public) are served automatically for matching paths before
    // this handler runs; everything else falls through to room routing.
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
