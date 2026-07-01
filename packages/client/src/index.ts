import {
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeServerMessage,
  type ClientMessage,
  type ServerMessage,
  type WelcomeMessage,
} from "@playedge/protocol";
import { createPartySocketTransport, type Transport, type TransportFactory } from "./transport.js";

export type { Transport, TransportFactory, TransportOptions } from "./transport.js";
export { createPartySocketTransport } from "./transport.js";

export type ServerMessageHandler = (message: ServerMessage) => void;
export type Unsubscribe = () => void;

export interface GameClientOptions {
  /** Party (Durable Object binding) name. Defaults to "gameroom". */
  party?: string;
  /** API key for multi-tenant routing (wired up in M5). */
  apiKey?: string;
  /** WebSocket implementation for non-browser environments (e.g. the `ws` package). */
  WebSocketPolyfill?: unknown;
  /** Override the transport factory. Primarily for tests. */
  createTransport?: TransportFactory;
}

/**
 * A live connection to a single room. Wraps a {@link Transport} and decodes the
 * server-authoritative message stream. In M0 this is echo/broadcast; state sync
 * (`state.onAdd/onChange`) and prediction hooks arrive in M2.
 */
export class Room {
  connectionId: string | null = null;
  readonly name: string;

  private readonly transport: Transport;
  private readonly handlers = new Set<ServerMessageHandler>();
  private readonly welcome: Promise<WelcomeMessage>;

  constructor(name: string, transport: Transport) {
    this.name = name;
    this.transport = transport;

    this.welcome = new Promise<WelcomeMessage>((resolve) => {
      const off = this.onMessage((msg) => {
        if (msg.t === ServerMessageType.Welcome) {
          this.connectionId = msg.connectionId;
          off();
          resolve(msg);
        }
      });
    });

    transport.onMessage((raw) => {
      let msg: ServerMessage;
      try {
        msg = decodeServerMessage(raw);
      } catch {
        return; // ignore malformed frames
      }
      for (const handler of this.handlers) handler(msg);
    });
  }

  /** Subscribe to every decoded server message. Returns an unsubscribe function. */
  onMessage(handler: ServerMessageHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Resolves once the server has sent its Welcome frame. */
  connected(): Promise<WelcomeMessage> {
    return this.welcome;
  }

  send(message: ClientMessage): void {
    this.transport.send(encode(message));
  }

  hello(name?: string): void {
    this.send({ t: ClientMessageType.Hello, name });
  }

  echo(text: string): void {
    this.send({ t: ClientMessageType.Echo, text });
  }

  broadcast(text: string): void {
    this.send({ t: ClientMessageType.Broadcast, text });
  }

  leave(): void {
    this.transport.close();
  }
}

/** Entry point for the browser SDK. */
export class GameClient {
  private readonly host: string;
  private readonly options: GameClientOptions;
  private readonly party: string;

  constructor(host: string, options: GameClientOptions = {}) {
    this.host = host;
    this.options = options;
    this.party = options.party ?? "game-room";
  }

  /**
   * Join a room by name (creating it on first join). In M0 this simply opens a
   * connection to the room's Durable Object; real matchmaking arrives in M4.
   */
  async joinOrCreate(room: string, params: Record<string, string> = {}): Promise<Room> {
    const query: Record<string, string> = { ...params };
    if (this.options.apiKey) query.apiKey = this.options.apiKey;

    const factory = this.options.createTransport ?? createPartySocketTransport;
    const transport = factory({
      host: this.host,
      room,
      party: this.party,
      query,
      WebSocketPolyfill: this.options.WebSocketPolyfill,
    });

    const roomHandle = new Room(room, transport);
    await roomHandle.connected();
    return roomHandle;
  }
}
