import {
  Server,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
} from "partyserver";
import {
  PROTOCOL_VERSION,
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeClientMessage,
  ProtocolError,
  type ServerMessage,
} from "@playedge/protocol";
import { defineRoom, type DefineRoomOptions } from "@playedge/server";
import { MovementRoomImpl } from "./rooms/movement-room.js";
import { TicTacToeImpl } from "./rooms/tic-tac-toe.js";
import { AgarRoomImpl } from "./rooms/agar-room.js";
import { Matchmaker } from "./matchmaker.js";

export { Matchmaker };

export interface Env {
  GameRoom: DurableObjectNamespace<GameRoom>;
  MovementRoom: DurableObjectNamespace;
  TicTacToe: DurableObjectNamespace;
  AgarRoom: DurableObjectNamespace;
  Matchmaker: DurableObjectNamespace<Matchmaker>;
}

/**
 * M0 hello-room: a raw partyserver Durable Object (echo/broadcast/presence).
 * Kept as a minimal reference; framework-based rooms use `@playedge/server`.
 */
export class GameRoom extends Server<Env> {
  static override options = { hibernate: true };

  override onConnect(conn: Connection, _ctx: ConnectionContext): void {
    const peers = [...this.getConnections()].map((c) => c.id).filter((id) => id !== conn.id);

    this.sendTo(conn, {
      t: ServerMessageType.Welcome,
      connectionId: conn.id,
      room: this.name,
      protocol: PROTOCOL_VERSION,
      peers,
    });

    this.relay({ t: ServerMessageType.PeerJoined, connectionId: conn.id }, conn.id);
  }

  override onMessage(conn: Connection, raw: string | ArrayBuffer): void {
    let msg;
    try {
      msg = decodeClientMessage(raw);
    } catch (err) {
      this.sendTo(conn, {
        t: ServerMessageType.Error,
        code: "bad_message",
        message: err instanceof ProtocolError ? err.message : "invalid message",
      });
      return;
    }

    switch (msg.t) {
      case ClientMessageType.Hello:
        this.relay(
          { t: ServerMessageType.PeerJoined, connectionId: conn.id, name: msg.name },
          conn.id,
        );
        break;
      case ClientMessageType.Echo:
        this.sendTo(conn, { t: ServerMessageType.Echo, text: msg.text });
        break;
      case ClientMessageType.Broadcast:
        this.relay({ t: ServerMessageType.Broadcast, from: conn.id, text: msg.text }, conn.id);
        break;
    }
  }

  override onClose(conn: Connection): void {
    this.relay({ t: ServerMessageType.PeerLeft, connectionId: conn.id }, conn.id);
  }

  private sendTo(conn: Connection, message: ServerMessage): void {
    conn.send(encode(message));
  }

  private relay(message: ServerMessage, exceptId: string): void {
    this.broadcast(encode(message), [exceptId]);
  }
}

function matchmaker(env: Env) {
  return env.Matchmaker.get(env.Matchmaker.idFromName("global"));
}

/** Rooms report live occupancy to the matchmaker on every join / final leave. */
const roomOptions: DefineRoomOptions = {
  reportOccupancy: (env, { roomId, count, sessions, seq }) =>
    matchmaker(env as Env).report(roomId, count, sessions, seq),
};

/** Realtime .io example — Simulation + MovementValidation modules. */
export const MovementRoom = defineRoom(MovementRoomImpl, roomOptions);

/** Turn-based guardrail example — genre-agnostic core only, no tick. */
export const TicTacToe = defineRoom(TicTacToeImpl, roomOptions);

/** Flagship .io demo — Simulation + MovementValidation + binary delta + AOI. */
export const AgarRoom = defineRoom(AgarRoomImpl, roomOptions);

/** REST matchmaking API: place players into rooms and browse the lobby. */
async function handleApi(url: URL, env: Env): Promise<Response> {
  const mm = matchmaker(env);

  if (url.pathname === "/api/matchmake") {
    const type = url.searchParams.get("type") ?? "agar-room";
    const mode = url.searchParams.get("mode") ?? "";
    const max = Number(url.searchParams.get("max") ?? "8");
    const result = await mm.reserve(type, mode, Number.isFinite(max) ? max : 8);
    return Response.json(result);
  }
  if (url.pathname === "/api/rooms") {
    const type = url.searchParams.get("type") ?? undefined;
    return Response.json(await mm.list(type));
  }
  if (url.pathname === "/api/release") {
    const session = url.searchParams.get("session");
    if (session) await mm.release(session);
    return Response.json({ ok: true });
  }
  return new Response("not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(url, env);
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
