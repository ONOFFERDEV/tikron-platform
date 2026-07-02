import { describe, it, expect } from "vitest";
import { GameClient, type Transport, type TransportOptions } from "./index.js";
import {
  encode,
  decodeClientMessage,
  ServerMessageType,
  type RawData,
  type ServerMessage,
} from "@tikron/protocol";
import { schema, mapOf, encodeFull, encodeDelta } from "@tikron/schema";

class FakeTransport implements Transport {
  readonly sent: string[] = [];
  readonly options: TransportOptions;
  private messageCb: ((raw: RawData) => void) | undefined;
  private closed = false;

  constructor(options: TransportOptions) {
    this.options = options;
  }

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  onMessage(cb: (raw: RawData) => void): void {
    this.messageCb = cb;
  }
  onOpen(): void {}
  onClose(): void {}
  onError(): void {}

  // --- test helpers ---
  emit(message: ServerMessage): void {
    this.messageCb?.(encode(message));
  }
  emitRaw(raw: RawData): void {
    this.messageCb?.(raw);
  }
  get isClosed(): boolean {
    return this.closed;
  }
}

function harness() {
  let transport: FakeTransport | undefined;
  const client = new GameClient("localhost:8787", {
    apiKey: "k_test",
    createTransport: (opts) => (transport = new FakeTransport(opts)),
  });
  const welcome = (): ServerMessage => ({
    t: ServerMessageType.Welcome,
    connectionId: "c1",
    room: "lobby",
    protocol: 1,
    peers: [],
  });
  return {
    client,
    transport: () => {
      if (!transport) throw new Error("transport not created yet");
      return transport;
    },
    welcome,
  };
}

describe("GameClient / Room", () => {
  it("resolves joinOrCreate on Welcome and records connectionId", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby", { mode: "duo" });
    h.transport().emit({
      t: ServerMessageType.Welcome,
      connectionId: "c1",
      room: "lobby",
      protocol: 1,
      peers: ["c0"],
    });
    const room = await pending;
    expect(room.connectionId).toBe("c1");
    expect(room.name).toBe("lobby");
  });

  it("passes room params + apiKey + party through to the transport", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby", { mode: "duo" });
    h.transport().emit(h.welcome());
    await pending;
    expect(h.transport().options.query).toEqual({ mode: "duo", apiKey: "k_test" });
    expect(h.transport().options.party).toBe("game-room");
    expect(h.transport().options.room).toBe("lobby");
  });

  it("encodes convenience messages onto the wire", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby");
    h.transport().emit(h.welcome());
    const room = await pending;

    room.echo("ping");
    room.broadcastText("hey");
    room.hello("nova");

    expect(h.transport().sent.map((raw) => decodeClientMessage(raw))).toEqual([
      { t: "c:echo", text: "ping" },
      { t: "c:broadcast", text: "hey" },
      { t: "c:hello", name: "nova" },
    ]);
  });

  it("routes incoming server messages to subscribers", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby");
    h.transport().emit(h.welcome());
    const room = await pending;

    const received: ServerMessage[] = [];
    const off = room.onMessage((m) => received.push(m));
    h.transport().emit({ t: ServerMessageType.Broadcast, from: "c2", text: "hello all" });
    off();
    h.transport().emit({ t: ServerMessageType.Broadcast, from: "c2", text: "ignored" });

    expect(received).toEqual([{ t: "s:broadcast", from: "c2", text: "hello all" }]);
  });

  it("leave() closes the transport", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby");
    h.transport().emit(h.welcome());
    const room = await pending;
    room.leave();
    expect(h.transport().isClosed).toBe(true);
  });

  it("send() emits a developer message with an auto-incrementing seq", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby");
    h.transport().emit(h.welcome());
    const room = await pending;

    room.send("move", { x: 1 });
    room.send("move", { x: 2 });

    expect(h.transport().sent.map((raw) => decodeClientMessage(raw))).toEqual([
      { t: "c:msg", type: "move", seq: 1, payload: { x: 1 } },
      { t: "c:msg", type: "move", seq: 2, payload: { x: 2 } },
    ]);
  });

  it("tracks state and fires onStateChange on s:state", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby");
    h.transport().emit(h.welcome());
    const room = await pending;

    const seen: unknown[] = [];
    room.onStateChange((s) => seen.push(s));
    h.transport().emit({ t: ServerMessageType.State, state: { turn: "X" } });

    expect(room.state).toEqual({ turn: "X" });
    expect(seen).toEqual([{ turn: "X" }]);
  });

  it("routes developer server messages by type via onMessage(type, cb)", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby");
    h.transport().emit(h.welcome());
    const room = await pending;

    const overs: unknown[] = [];
    room.onMessage("gameOver", (payload) => overs.push(payload));
    h.transport().emit({ t: ServerMessageType.Message, type: "gameOver", payload: { winner: "O" } });
    h.transport().emit({ t: ServerMessageType.Message, type: "other", payload: { n: 1 } });

    expect(overs).toEqual([{ winner: "O" }]);
  });

  it("decodes binary state frames when a stateCodec is provided", async () => {
    const World = schema({ players: mapOf(schema({ x: "f32", y: "f32" })) });
    const frame = (tag: number, body: Uint8Array) => {
      const out = new Uint8Array(body.length + 1);
      out[0] = tag;
      out.set(body, 1);
      return out;
    };

    let transport: FakeTransport | undefined;
    const client = new GameClient("localhost:8787", {
      stateCodec: World,
      createTransport: (opts) => (transport = new FakeTransport(opts)),
    });
    const pending = client.joinOrCreate("m");
    transport!.emit({
      t: ServerMessageType.Welcome,
      connectionId: "c1",
      room: "m",
      protocol: 1,
      peers: [],
    });
    const room = await pending;

    const seen: unknown[] = [];
    room.onStateChange((s) => seen.push(s));

    transport!.emitRaw(frame(1, encodeFull(World, { players: { c1: { x: 1, y: 2 } } })));
    expect(room.state).toEqual({ players: { c1: { x: 1, y: 2 } } });

    transport!.emitRaw(
      frame(
        2,
        encodeDelta(
          World,
          { players: { c1: { x: 1, y: 2 } } },
          { players: { c1: { x: 5, y: 2 } } },
        ),
      ),
    );
    expect(room.state).toEqual({ players: { c1: { x: 5, y: 2 } } });
    expect(seen.length).toBe(2);
  });
});
