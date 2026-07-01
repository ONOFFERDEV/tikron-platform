import {
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeServerMessage,
  type ClientMessage,
  type ServerMessage,
  type WelcomeMessage,
  type RawData,
} from "@playedge/protocol";
import { decodeFull, applyDelta, type Codec } from "@playedge/schema";
import { createPartySocketTransport, type Transport, type TransportFactory } from "./transport.js";

export type { Transport, TransportFactory, TransportOptions } from "./transport.js";
export { createPartySocketTransport } from "./transport.js";
export { InputPredictor, SnapshotBuffer } from "./netcode.js";
export type { Predictable, Snapshot } from "./netcode.js";

export type ServerMessageHandler = (message: ServerMessage) => void;
export type PayloadHandler = (payload: unknown) => void;
export type StateHandler = (state: unknown) => void;
export type Unsubscribe = () => void;

export interface GameClientOptions {
  /** Party (Durable Object binding) name. Defaults to "game-room". */
  party?: string;
  /** API key for multi-tenant routing (wired up in M5). */
  apiKey?: string;
  /** WebSocket implementation for non-browser environments (e.g. the `ws` package). */
  WebSocketPolyfill?: unknown;
  /** Binary state codec (from `@playedge/schema`) matching the room's server codec. */
  stateCodec?: Codec<unknown>;
  /** Override the transport factory. Primarily for tests. */
  createTransport?: TransportFactory;
}

/**
 * A live connection to a single room. Wraps a {@link Transport}, decodes the
 * authoritative message stream, and tracks room state. In M0 this was
 * echo/broadcast; M1 adds `state` sync (`onStateChange`), developer messages
 * (`send`/`onMessage(type)`), and presence. Client-side prediction arrives in M2.
 */
export class Room {
  connectionId: string | null = null;
  readonly name: string;

  /** Latest authoritative state from the server (undefined until first sync). */
  state: unknown = undefined;

  /** Last input seq the server has acknowledged (0 until the first ack). */
  lastAckSeq = 0;

  private readonly transport: Transport;
  private readonly rawHandlers = new Set<ServerMessageHandler>();
  private readonly typeHandlers = new Map<string, Set<PayloadHandler>>();
  private readonly stateHandlers = new Set<StateHandler>();
  private readonly ackHandlers = new Set<(seq: number) => void>();
  private readonly welcome: Promise<WelcomeMessage>;
  private readonly stateCodec?: Codec<unknown>;
  private seq = 0;

  constructor(name: string, transport: Transport, stateCodec?: Codec<unknown>) {
    this.name = name;
    this.transport = transport;
    this.stateCodec = stateCodec;

    this.welcome = new Promise<WelcomeMessage>((resolve) => {
      const off = this.onMessage((msg) => {
        if (msg.t === ServerMessageType.Welcome) {
          this.connectionId = msg.connectionId;
          off();
          resolve(msg);
        }
      });
    });

    transport.onMessage((raw) => this.dispatch(raw));
  }

  private dispatch(raw: RawData): void {
    if (typeof raw !== "string") {
      this.applyBinaryState(raw);
      return;
    }

    let msg: ServerMessage;
    try {
      msg = decodeServerMessage(raw);
    } catch {
      return; // ignore malformed frames
    }

    if (msg.t === ServerMessageType.State) {
      this.state = msg.state;
      for (const handler of this.stateHandlers) handler(msg.state);
    } else if (msg.t === ServerMessageType.Message) {
      const set = this.typeHandlers.get(msg.type);
      if (set) for (const handler of set) handler(msg.payload);
    } else if (msg.t === ServerMessageType.Ack) {
      this.lastAckSeq = msg.seq;
      for (const handler of this.ackHandlers) handler(msg.seq);
    }

    for (const handler of this.rawHandlers) handler(msg);
  }

  private applyBinaryState(raw: ArrayBuffer | Uint8Array): void {
    if (!this.stateCodec) return;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    if (bytes.length === 0) return;
    const tag = bytes[0];
    const body = bytes.subarray(1);
    if (tag === 0x01) this.state = decodeFull(this.stateCodec, body);
    else if (tag === 0x02) this.state = applyDelta(this.stateCodec, this.state, body);
    else return;
    for (const handler of this.stateHandlers) handler(this.state);
  }

  /** Subscribe to every decoded server message (raw). */
  onMessage(handler: ServerMessageHandler): Unsubscribe;
  /** Subscribe to developer-defined server messages of a given `type`. */
  onMessage(type: string, handler: PayloadHandler): Unsubscribe;
  onMessage(a: ServerMessageHandler | string, b?: PayloadHandler): Unsubscribe {
    if (typeof a === "string") {
      const handler = b as PayloadHandler;
      const set = this.typeHandlers.get(a) ?? new Set<PayloadHandler>();
      set.add(handler);
      this.typeHandlers.set(a, set);
      return () => {
        set.delete(handler);
      };
    }
    this.rawHandlers.add(a);
    return () => {
      this.rawHandlers.delete(a);
    };
  }

  /** Subscribe to authoritative state updates. */
  onStateChange(handler: StateHandler): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /** Subscribe to input acknowledgements (the last input seq the server processed). */
  onAck(handler: (seq: number) => void): Unsubscribe {
    this.ackHandlers.add(handler);
    return () => {
      this.ackHandlers.delete(handler);
    };
  }

  /** Resolves once the server has sent its Welcome frame. */
  connected(): Promise<WelcomeMessage> {
    return this.welcome;
  }

  /** Send a developer-defined message (intent) with an auto-incrementing seq. */
  send(type: string, payload?: unknown): void {
    this.transport.send(
      encode({ t: ClientMessageType.Message, type, seq: ++this.seq, payload }),
    );
  }

  private sendRaw(message: ClientMessage): void {
    this.transport.send(encode(message));
  }

  hello(name?: string): void {
    this.sendRaw({ t: ClientMessageType.Hello, name });
  }

  echo(text: string): void {
    this.sendRaw({ t: ClientMessageType.Echo, text });
  }

  broadcastText(text: string): void {
    this.sendRaw({ t: ClientMessageType.Broadcast, text });
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
   * Join a room by name (creating it on first join). In M0/M1 this simply opens a
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

    const roomHandle = new Room(room, transport, this.options.stateCodec);
    await roomHandle.connected();
    return roomHandle;
  }
}
