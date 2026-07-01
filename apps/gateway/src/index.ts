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
import { defineRoom } from "@playedge/server";
import { MovementRoomImpl } from "./rooms/movement-room.js";
import { TicTacToeImpl } from "./rooms/tic-tac-toe.js";

export interface Env {
  GameRoom: DurableObjectNamespace<GameRoom>;
  MovementRoom: DurableObjectNamespace;
  TicTacToe: DurableObjectNamespace;
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

/** Realtime .io example — Simulation + MovementValidation modules. */
export const MovementRoom = defineRoom(MovementRoomImpl);

/** Turn-based guardrail example — genre-agnostic core only, no tick. */
export const TicTacToe = defineRoom(TicTacToeImpl);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ?? new Response("not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
