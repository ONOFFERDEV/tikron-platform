import { describe, it, expect, vi } from "vitest";
import {
  GameClient,
  RoomJoinError,
  shouldReconnectAfterClose,
  type Transport,
  type TransportOptions,
} from "./index.js";
import {
  encode,
  decodeClientMessage,
  ServerMessageType,
  PROTOCOL_VERSION,
  type RawData,
  type ServerMessage,
} from "@tikron/protocol";
import {
  schema,
  mapOf,
  encodeFull,
  encodeDelta,
  schemaFingerprint,
  type Codec,
} from "@tikron/schema";

class FakeTransport implements Transport {
  readonly sent: string[] = [];
  readonly options: TransportOptions;
  private messageCb: ((raw: RawData) => void) | undefined;
  private closeCb: (() => void) | undefined;
  private errorCb: ((err: unknown) => void) | undefined;
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
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  onError(cb: (err: unknown) => void): void {
    this.errorCb = cb;
  }

  // --- test helpers ---
  emit(message: ServerMessage): void {
    this.messageCb?.(encode(message));
  }
  emitRaw(raw: RawData): void {
    this.messageCb?.(raw);
  }
  /** Simulate the socket closing (an unsolicited server-side close before Welcome). */
  emitClose(): void {
    this.closed = true;
    this.closeCb?.();
  }
  /** Simulate a transport error. */
  emitError(err: unknown = new Error("socket error")): void {
    this.errorCb?.(err);
  }
  get isClosed(): boolean {
    return this.closed;
  }
}

function harness() {
  let transport: FakeTransport | undefined;
  const client = new GameClient("localhost:8787", {
    apiKey: "k_test",
    disableClockSync: true, // keep `sent` assertions free of clock-sync pings
    createTransport: (opts) => (transport = new FakeTransport(opts)),
  });
  const welcome = (): ServerMessage => ({
    t: ServerMessageType.Welcome,
    connectionId: "c1",
    room: "lobby",
    protocol: PROTOCOL_VERSION,
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
      protocol: PROTOCOL_VERSION,
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
    // Frame header: [tag(u8), tick(u32 LE), serverTimeMs(f64 LE)] then the body.
    const frame = (tag: number, body: Uint8Array, tick = 0, serverTime = 0) => {
      const out = new Uint8Array(body.length + 13);
      const view = new DataView(out.buffer);
      out[0] = tag;
      view.setUint32(1, tick, true);
      view.setFloat64(5, serverTime, true);
      out.set(body, 13);
      return out;
    };

    let transport: FakeTransport | undefined;
    const client = new GameClient("localhost:8787", {
      stateCodec: World,
      disableClockSync: true,
      createTransport: (opts) => (transport = new FakeTransport(opts)),
    });
    const pending = client.joinOrCreate("m");
    transport!.emit({
      t: ServerMessageType.Welcome,
      connectionId: "c1",
      room: "m",
      protocol: PROTOCOL_VERSION,
      peers: [],
    });
    const room = await pending;

    const seen: unknown[] = [];
    room.onStateChange((s) => seen.push(s));

    transport!.emitRaw(
      frame(1, encodeFull(World, { players: { c1: { x: 1, y: 2 } } }), 7, 1_700_000_000_000),
    );
    expect(room.state).toEqual({ players: { c1: { x: 1, y: 2 } } });
    // The frame header carries the room's tick + server time.
    expect(room.lastStateTick).toBe(7);
    expect(room.lastStateServerTime).toBe(1_700_000_000_000);

    transport!.emitRaw(
      frame(
        2,
        encodeDelta(
          World,
          { players: { c1: { x: 1, y: 2 } } },
          { players: { c1: { x: 5, y: 2 } } },
        ),
        8,
        1_700_000_000_050,
      ),
    );
    expect(room.state).toEqual({ players: { c1: { x: 5, y: 2 } } });
    expect(room.lastStateTick).toBe(8);
    expect(seen.length).toBe(2);
  });

  it("syncs the clock: pings on connect and updates room.clock from s:time", async () => {
    let transport: FakeTransport | undefined;
    const client = new GameClient("localhost:8787", {
      createTransport: (opts) => (transport = new FakeTransport(opts)),
    });
    const pending = client.joinOrCreate("m");
    transport!.emit({
      t: ServerMessageType.Welcome,
      connectionId: "c1",
      room: "m",
      protocol: PROTOCOL_VERSION,
      peers: [],
    });
    const room = await pending;

    // The clock starts on connect; drive one ping/reply by hand.
    room.clock.stop(); // cancel the auto burst timers so we control the exchange
    const t0 = Date.now();
    room.clock.ping();
    const ping = transport!.sent.map((raw) => decodeClientMessage(raw)).find((m) => m.t === "c:time");
    expect(ping).toBeDefined();

    transport!.emit({ t: ServerMessageType.Time, t0, serverTime: t0 + 5000 });
    // Offset ≈ +5000ms (server ahead); serverNow() reflects it.
    expect(room.clock.offsetMs).toBeGreaterThan(4000);
    expect(room.clock.serverNow()).toBeGreaterThan(Date.now() + 4000);
    room.leave();
  });
});

describe("GameClient input pipeline (F3: subtick + batching)", () => {
  function connect(options: Parameters<typeof GameClient>[1] = {}): {
    room: Promise<import("./index.js").Room>;
    transport: () => FakeTransport;
  } {
    let transport: FakeTransport | undefined;
    const client = new GameClient("localhost:8787", {
      disableClockSync: true,
      createTransport: (opts) => (transport = new FakeTransport(opts)),
      ...options,
    });
    const pending = client.joinOrCreate("m");
    transport!.emit({
      t: ServerMessageType.Welcome,
      connectionId: "c1",
      room: "m",
      protocol: PROTOCOL_VERSION,
      peers: [],
    });
    return {
      room: pending,
      transport: () => {
        if (!transport) throw new Error("transport not created yet");
        return transport;
      },
    };
  }

  // Runs first so the module-level warn-once flag is unset here (later subtick tests
  // then construct silently). Guards the subtick+disableClockSync dev footgun.
  it("warns once when subtick timestamps run without clock sync", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = connect({ subtickTimestamps: true }); // helper leaves disableClockSync on
    await h.room;
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/subtickTimestamps is on but clock sync is disabled/),
    );
    warn.mockRestore();
  });

  it("stamps send() with a subtick ts when subtickTimestamps is on", async () => {
    const h = connect({ subtickTimestamps: true });
    const room = await h.room;
    room.send("move", { x: 1 });

    const sent = decodeClientMessage(h.transport().sent.at(-1)!);
    expect(sent.t).toBe("c:msg");
    expect(typeof (sent as { ts?: unknown }).ts).toBe("number");
  });

  it("omits ts by default (backward compatible wire shape)", async () => {
    const h = connect();
    const room = await h.room;
    room.send("move", { x: 1 });

    expect(decodeClientMessage(h.transport().sent.at(-1)!)).toEqual({
      t: "c:msg",
      type: "move",
      seq: 1,
      payload: { x: 1 },
    });
  });

  it("coalesces a burst within the window into one c:mbatch frame", async () => {
    vi.useFakeTimers();
    try {
      const h = connect({ inputBatchMs: 20 });
      const room = await h.room;
      room.send("move", { n: 1 });
      room.send("move", { n: 2 });
      expect(h.transport().sent).toHaveLength(0); // buffered until the window closes

      vi.advanceTimersByTime(20);
      const frames = h.transport().sent.map((raw) => decodeClientMessage(raw));
      expect(frames).toHaveLength(1);
      expect(frames[0]!.t).toBe("c:mbatch");
      expect((frames[0] as { msgs: unknown[] }).msgs).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends a lone windowed input as a plain c:msg (not a batch)", async () => {
    vi.useFakeTimers();
    try {
      const h = connect({ inputBatchMs: 20 });
      const room = await h.room;
      room.send("move", { n: 1 });
      vi.advanceTimersByTime(20);

      const frames = h.transport().sent.map((raw) => decodeClientMessage(raw));
      expect(frames).toHaveLength(1);
      expect(frames[0]!.t).toBe("c:msg");
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes buffered inputs immediately on leave()", async () => {
    vi.useFakeTimers();
    try {
      const h = connect({ inputBatchMs: 50 });
      const room = await h.room;
      room.send("move", { n: 1 });
      room.send("move", { n: 2 });
      room.leave(); // must not drop inputs still in the open window

      const frames = h.transport().sent.map((raw) => decodeClientMessage(raw));
      expect(frames).toHaveLength(1);
      expect(frames[0]!.t).toBe("c:mbatch");
      expect(h.transport().isClosed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("joinOrCreate rejection (pre-Welcome close/error)", () => {
  it("rejects with the Error-frame code (room_full) when the socket closes pre-Welcome, and tears down without reconnecting", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("full-room");
    // The room is at maxClients: the server sends an Error frame then closes the
    // socket with 4002 — no Welcome ever arrives.
    h.transport().emit({ t: ServerMessageType.Error, code: "room_full", message: "room is full" });
    h.transport().emitClose();

    await expect(pending).rejects.toBeInstanceOf(RoomJoinError);
    await expect(pending).rejects.toHaveProperty("code", "room_full");
    // (C) the underlying transport was torn down on rejection …
    expect(h.transport().isClosed).toBe(true);
    // … and 4002 is a terminal close code, so the transport layer never reconnects.
    expect(shouldReconnectAfterClose(4002)).toBe(false);
  });

  it("rejects with connection-closed when no Error frame preceded the close", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("gone");
    h.transport().emitClose(); // socket dropped before Welcome, no Error frame

    await expect(pending).rejects.toBeInstanceOf(RoomJoinError);
    await expect(pending).rejects.toHaveProperty("code", "connection-closed");
    expect(h.transport().isClosed).toBe(true);
  });

  it("rejects on a pre-Welcome transport error as well", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("boom");
    h.transport().emitError(new Error("ECONNREFUSED"));

    await expect(pending).rejects.toBeInstanceOf(RoomJoinError);
    await expect(pending).rejects.toHaveProperty("code", "connection-closed");
  });

  it("still resolves the normal Welcome path and ignores a later close (regression)", async () => {
    const h = harness();
    const pending = h.client.joinOrCreate("lobby");
    h.transport().emit(h.welcome());
    const room = await pending;
    expect(room.connectionId).toBe("c1");
    // A close AFTER connecting is ordinary teardown — it must not throw or reject.
    expect(() => h.transport().emitClose()).not.toThrow();
  });
});

describe("Welcome handshake validation (F003/F099/F128)", () => {
  const State = schema({ players: mapOf(schema({ x: "f32", y: "f32" })), tick: "u32" });
  const matchingFp = schemaFingerprint(State)!;
  const differentFp = (matchingFp ^ 0xabcd) >>> 0;

  /** Build a client + capture its FakeTransport, without emitting a Welcome yet. */
  function setup(options: Parameters<typeof GameClient>[1] = {}): {
    join: (room?: string) => Promise<import("./index.js").Room>;
    transport: () => FakeTransport;
  } {
    let transport: FakeTransport | undefined;
    const client = new GameClient("localhost:8787", {
      disableClockSync: true,
      createTransport: (opts) => (transport = new FakeTransport(opts)),
      ...options,
    });
    return {
      join: (room = "lobby") => client.joinOrCreate(room),
      transport: () => {
        if (!transport) throw new Error("transport not created yet");
        return transport;
      },
    };
  }

  /** A Welcome frame with overridable protocol/schema. */
  function welcomeFrame(over: { protocol?: number; schema?: number } = {}): ServerMessage {
    const base: ServerMessage = {
      t: ServerMessageType.Welcome,
      connectionId: "c1",
      room: "lobby",
      protocol: over.protocol ?? PROTOCOL_VERSION,
      peers: [],
    };
    return over.schema !== undefined ? { ...base, schema: over.schema } : base;
  }

  /** Pack a binary state frame: [tag(u8), tick(u32 LE), serverTime(f64 LE)] + body. */
  function frameOf(tag: number, body: Uint8Array): Uint8Array {
    const out = new Uint8Array(body.length + 13);
    const view = new DataView(out.buffer);
    out[0] = tag;
    view.setUint32(1, 0, true);
    view.setFloat64(5, 0, true);
    out.set(body, 13);
    return out;
  }

  it("rejects the initial join with schema_mismatch naming BOTH fingerprints", async () => {
    const h = setup({ stateCodec: State });
    const pending = h.join();
    h.transport().emit(welcomeFrame({ schema: differentFp }));

    await expect(pending).rejects.toBeInstanceOf(RoomJoinError);
    await expect(pending).rejects.toHaveProperty("code", "schema_mismatch");
    // The message must name the server AND client fingerprints so an agent can act.
    await expect(pending).rejects.toThrow(new RegExp(`${differentFp}[\\s\\S]*${matchingFp}`));
    expect(h.transport().isClosed).toBe(true);
  });

  it("rejects the initial join with protocol_mismatch naming BOTH versions", async () => {
    const h = setup();
    const pending = h.join();
    h.transport().emit(welcomeFrame({ protocol: 99 }));

    await expect(pending).rejects.toHaveProperty("code", "protocol_mismatch");
    await expect(pending).rejects.toThrow(
      new RegExp(`server=99[\\s\\S]*client=${PROTOCOL_VERSION}`),
    );
    expect(h.transport().isClosed).toBe(true);
  });

  it("resolves when the server fingerprint matches the client's", async () => {
    const h = setup({ stateCodec: State });
    const pending = h.join();
    h.transport().emit(welcomeFrame({ schema: matchingFp }));
    const room = await pending;
    expect(room.connectionId).toBe("c1");
  });

  it("resolves against an old server that sends no schema fingerprint (0.5 interop)", async () => {
    // A pre-0.6 server omits `schema` entirely → the check is skipped, join resolves.
    const h = setup({ stateCodec: State });
    const pending = h.join();
    h.transport().emit(welcomeFrame()); // no schema field
    await expect(pending).resolves.toBeDefined();
  });

  it("skips the schema check when the client configured no stateCodec", async () => {
    const h = setup(); // no stateCodec
    const pending = h.join();
    h.transport().emit(welcomeFrame({ schema: 0xabcdef }));
    await expect(pending).resolves.toBeDefined();
  });

  it("skips the schema check when the client's own codec is undescribable (null fingerprint)", async () => {
    // A hand-written codec with no describe → clientFingerprint is null → the handshake
    // skips schema comparison rather than false-rejecting (end-to-end of the null path).
    const custom: Codec<unknown> = {
      writeFull: () => {},
      readFull: () => 0,
      writeDelta: () => {},
      readDelta: () => 0,
      equals: () => true,
      clone: (v) => v,
    };
    expect(schemaFingerprint(custom)).toBeNull();
    const h = setup({ stateCodec: custom });
    const pending = h.join();
    h.transport().emit(welcomeFrame({ schema: 0x1234 }));
    await expect(pending).resolves.toBeDefined();
  });

  it("MUST-FIX#1: an initial mismatched Welcome rejects via the join path ONLY (no double-fire)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = setup({ stateCodec: State });
      const pending = h.join();
      h.transport().emit(welcomeFrame({ schema: differentFp }));

      await expect(pending).rejects.toHaveProperty("code", "schema_mismatch");
      // The reconnect/live path (reportReconnectMismatch) logs a console.error; it must
      // NOT fire for the initial Welcome — only the join resolver handled it.
      expect(errSpy).not.toHaveBeenCalled();
      expect(h.transport().isClosed).toBe(true);
    } finally {
      errSpy.mockRestore();
    }
  });

  it("MUST-FIX#1: a genuine reconnect Welcome that mismatches emits a loud error and closes without retry", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = setup({ stateCodec: State });
      const pending = h.join();
      // First Welcome matches → join resolves live.
      h.transport().emit(welcomeFrame({ schema: matchingFp }));
      await pending;
      expect(errSpy).not.toHaveBeenCalled();

      // The socket reconnects and the server (redeployed) now advertises a different
      // schema: the live path surfaces it loudly and closes the socket.
      h.transport().emit(welcomeFrame({ schema: differentFp }));
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(String(errSpy.mock.calls[0]![0])).toMatch(/schema fingerprint mismatch/);
      expect(h.transport().isClosed).toBe(true);
    } finally {
      errSpy.mockRestore();
    }
  });

  it("MUST-FIX#2: a corrupted binary state frame logs a loud error and keeps the last good state", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = setup({ stateCodec: State });
      const pending = h.join();
      h.transport().emit(welcomeFrame({ schema: matchingFp }));
      const room = await pending;

      // Seed a known-good state.
      const good = { players: { c1: { x: 1, y: 2 } }, tick: 5 };
      h.transport().emitRaw(frameOf(0x01, encodeFull(State, good)));
      expect(room.state).toEqual(good);

      const changes: unknown[] = [];
      room.onStateChange((s) => changes.push(s));

      // A corrupted full frame: the body claims a 5-entry player map but carries no key
      // bytes, so decodeFull overruns the buffer and throws.
      h.transport().emitRaw(frameOf(0x01, new Uint8Array([5])));

      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(String(errSpy.mock.calls[0]![0])).toMatch(/failed to decode a binary state frame/);
      expect(room.state).toEqual(good); // last good state preserved, not clobbered
      expect(changes).toHaveLength(0); // the dropped frame fires no state-change
    } finally {
      errSpy.mockRestore();
    }
  });

  it("MUST-FIX#2: repeated decode failures warn only once (no 60Hz console flood)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = setup({ stateCodec: State });
      const pending = h.join();
      h.transport().emit(welcomeFrame({ schema: matchingFp }));
      await pending;

      h.transport().emitRaw(frameOf(0x01, new Uint8Array([5])));
      h.transport().emitRaw(frameOf(0x01, new Uint8Array([5])));
      h.transport().emitRaw(frameOf(0x01, new Uint8Array([5])));
      expect(errSpy).toHaveBeenCalledTimes(1);
    } finally {
      errSpy.mockRestore();
    }
  });

  it("F119: warns ONCE when a binary state frame arrives with no stateCodec, with the fix", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const h = setup(); // no stateCodec
      const pending = h.join();
      h.transport().emit(welcomeFrame());
      await pending;

      h.transport().emitRaw(frameOf(0x01, new Uint8Array([0])));
      h.transport().emitRaw(frameOf(0x01, new Uint8Array([0])));
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]![0])).toMatch(/no stateCodec is configured/);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
