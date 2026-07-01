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
});
