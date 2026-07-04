import { describe, it, expect } from "vitest";
import {
  PROTOCOL_VERSION,
  ClientMessageType,
  ServerMessageType,
  encode,
  decodeClientMessage,
  decodeServerMessage,
  ProtocolError,
  type WelcomeMessage,
} from "./index.js";

describe("protocol", () => {
  it("exposes a positive protocol version", () => {
    expect(PROTOCOL_VERSION).toBeGreaterThan(0);
  });

  it("round-trips a client echo message", () => {
    const wire = encode({ t: ClientMessageType.Echo, text: "hi" });
    expect(decodeClientMessage(wire)).toEqual({ t: "c:echo", text: "hi" });
  });

  it("round-trips a server welcome message", () => {
    const welcome: WelcomeMessage = {
      t: ServerMessageType.Welcome,
      connectionId: "abc",
      room: "lobby",
      protocol: PROTOCOL_VERSION,
      peers: [],
    };
    expect(decodeServerMessage(encode(welcome))).toEqual(welcome);
  });

  it("carries an optional schema fingerprint on Welcome (additive, protocol unchanged)", () => {
    const welcome: WelcomeMessage = {
      t: ServerMessageType.Welcome,
      connectionId: "abc",
      room: "lobby",
      protocol: PROTOCOL_VERSION,
      peers: [],
      schema: 0xdeadbeef,
    };
    const decoded = decodeServerMessage(encode(welcome)) as WelcomeMessage;
    expect(decoded.schema).toBe(0xdeadbeef);
    // The new field does not bump the protocol version (interop stays within a minor).
    expect(PROTOCOL_VERSION).toBe(2);
  });

  it("a Welcome without the schema field leaves it undefined (old-server shape)", () => {
    const decoded = decodeServerMessage(
      encode({
        t: ServerMessageType.Welcome,
        connectionId: "abc",
        room: "lobby",
        protocol: PROTOCOL_VERSION,
        peers: [],
      }),
    ) as WelcomeMessage;
    expect(decoded.schema).toBeUndefined();
  });

  it("decodes from an ArrayBuffer", () => {
    const buf = new TextEncoder().encode(
      encode({ t: ClientMessageType.Broadcast, text: "yo" }),
    ).buffer;
    expect(decodeClientMessage(buf).t).toBe("c:broadcast");
  });

  it("rejects invalid JSON", () => {
    expect(() => decodeClientMessage("{not json")).toThrow(ProtocolError);
  });

  it("rejects an unknown message type", () => {
    expect(() => decodeServerMessage(encode({ t: "nope" } as never))).toThrow(ProtocolError);
  });

  it("rejects a server tag passed to the client decoder", () => {
    const wire = encode({ t: ServerMessageType.Welcome } as never);
    expect(() => decodeClientMessage(wire)).toThrow(ProtocolError);
  });

  it("round-trips a developer-defined client message with seq + payload", () => {
    const wire = encode({
      t: ClientMessageType.Message,
      type: "move",
      seq: 7,
      payload: { dx: 1, dy: 0 },
    });
    expect(decodeClientMessage(wire)).toEqual({
      t: "c:msg",
      type: "move",
      seq: 7,
      payload: { dx: 1, dy: 0 },
    });
  });

  it("round-trips a server state snapshot", () => {
    const wire = encode({
      t: ServerMessageType.State,
      ackSeq: 7,
      state: { players: { a: { x: 1 } } },
    });
    expect(decodeServerMessage(wire)).toEqual({
      t: "s:state",
      ackSeq: 7,
      state: { players: { a: { x: 1 } } },
    });
  });

  it("round-trips a developer-defined server message", () => {
    const wire = encode({ t: ServerMessageType.Message, type: "gameOver", payload: { winner: "a" } });
    expect(decodeServerMessage(wire)).toEqual({ t: "s:msg", type: "gameOver", payload: { winner: "a" } });
  });
});
