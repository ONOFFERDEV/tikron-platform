import { describe, it, expect } from "vitest";
import { GameClient, type Transport, type TransportOptions } from "./index.js";
import {
  encode,
  decodeClientMessage,
  ServerMessageType,
  type RawData,
  type ServerMessage,
} from "@playedge/protocol";

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
    room.broadcast("hey");
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
});
