import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPartySocketTransport, type Transport } from "@tikron/client";
import { decodeClientMessage, encode, PROTOCOL_VERSION, type RawData, type ServerMessage } from "@tikron/protocol";
import { CONTENT_REVISION } from "../config/ww1-content.js";
import { ContentRevisionMismatchError, Net } from "../client/net.js";

vi.mock("@tikron/client", async importOriginal => {
  const sdk = await importOriginal<typeof import("@tikron/client")>();
  return { ...sdk, createPartySocketTransport: vi.fn() };
});

class BoundaryTransport implements Transport {
  readonly sent: string[] = [];
  closed = false;
  private readonly messages = new Set<(raw: RawData) => void>();
  private readonly closes = new Set<() => void>();

  send(data: string): void { this.sent.push(data); }
  close(): void { this.closed = true; }
  onMessage(callback: (raw: RawData) => void): void { this.messages.add(callback); }
  onClose(callback: () => void): void { this.closes.add(callback); }
  onOpen(): void {}
  onError(): void {}
  emit(message: ServerMessage): void {
    for (const callback of this.messages) callback(encode(message));
  }
  disconnect(): void { for (const callback of this.closes) callback(); }
  welcome(): void {
    this.emit({ t: "s:welcome", connectionId: "alice", room: "arena-tdm", protocol: PROTOCOL_VERSION, peers: [] });
  }
  event(type: string, payload: unknown): void { this.emit({ t: "s:msg", type, payload }); }
  inputs(type: string): unknown[] {
    return this.sent.map(decodeClientMessage)
      .filter(message => message?.t === "c:msg" && message.type === type);
  }
}

const transports: BoundaryTransport[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { search: "", host: "test.local" });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    party: "arena-room", room: "arena-tdm", session: "session-a", contentRevision: CONTENT_REVISION,
  })));
  vi.mocked(createPartySocketTransport).mockImplementation(() => {
    const transport = new BoundaryTransport();
    transports.push(transport);
    queueMicrotask(() => transport.welcome());
    return transport;
  });
});

afterEach(() => {
  for (const transport of transports) transport.close();
  transports.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function contentRequest(): Promise<BoundaryTransport> {
  await vi.advanceTimersByTimeAsync(0);
  const transport = transports.at(-1);
  expect(transport?.inputs("contentReady")).toHaveLength(1);
  if (transport === undefined) throw new TypeError("expected a created transport");
  return transport;
}

describe("client connection revision failure cleanup", () => {
  it("retries failed matchmaking with backoff before joining the returned room", async () => {
    const fetchRoom = vi.mocked(fetch);
    fetchRoom.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const pending = Net.connect();
    await vi.advanceTimersByTimeAsync(399);
    expect(fetchRoom).toHaveBeenCalledTimes(1);
    expect(transports).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    const transport = await contentRequest();
    transport.event("contentAccepted", { revision: CONTENT_REVISION });
    const net = await pending;

    expect(fetchRoom).toHaveBeenCalledTimes(2);
    expect(net.online).toBe(true);
    expect(net.roomId).toBe("arena-tdm");
    net.room.leave();
  });

  it("gates reconnect input until the new content acceptance arrives", async () => {
    const pending = Net.connect();
    const transport = await contentRequest();
    transport.event("contentAccepted", { revision: CONTENT_REVISION });
    const net = await pending;

    transport.disconnect();
    transport.welcome();
    transport.event("contentAccepted", { revision: CONTENT_REVISION - 1 });
    net.reload();

    expect(net.online).toBe(false);
    expect(transport.inputs("contentReady")).toHaveLength(2);
    expect(transport.inputs("reload")).toHaveLength(0);
    transport.event("contentAccepted", { revision: CONTENT_REVISION });
    net.reload();
    expect(net.online).toBe(true);
    expect(transport.inputs("reload")).toHaveLength(1);
    net.room.leave();
  });

  it("closes the joined room when its content handshake is rejected", async () => {
    // Given a joined SDK room waiting for the application's revision gate.
    const pending = Net.connect();
    const rejected = expect(pending).rejects.toBeInstanceOf(ContentRevisionMismatchError);
    const transport = await contentRequest();
    // When the room requires a different application revision.
    transport.event("contentMismatch", { expected: CONTENT_REVISION + 1, received: CONTENT_REVISION, action: "reload" });
    await rejected;
    // Then no abandoned socket or clock keeps the failed deployment seated.
    expect(transport.closed).toBe(true);
  });

  it("closes the joined room when its application handshake times out", async () => {
    // Given a room that welcomed the SDK but never accepts the content revision.
    const pending = Net.connect();
    const rejected = expect(pending).rejects.toBeInstanceOf(ContentRevisionMismatchError);
    const transport = await contentRequest();
    // When the application handshake deadline elapses.
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    // Then the failed join releases its transport.
    expect(transport.closed).toBe(true);
  });

  it("keeps gameplay disabled when a late acceptance follows a terminal mismatch", async () => {
    // Given a live connection that subsequently rejects this content revision.
    const pending = Net.connect();
    const transport = await contentRequest();
    transport.event("contentAccepted", { revision: CONTENT_REVISION });
    const net = await pending;
    transport.event("contentMismatch", { expected: CONTENT_REVISION + 1, received: CONTENT_REVISION, action: "reload" });
    // When an already queued acceptance arrives after the terminal failure.
    transport.event("contentAccepted", { revision: CONTENT_REVISION });
    net.reload();
    // Then stale readiness cannot send gameplay into the abandoned room.
    expect(net.online).toBe(false);
    expect(transport.inputs("reload")).toHaveLength(0);
  });
});
