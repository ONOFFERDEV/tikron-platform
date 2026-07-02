import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RawData } from "@tikron/protocol";
import type { Transport } from "./transport.js";
import { withNetworkConditions } from "./net-conditions.js";

/** A controllable fake transport: `emit` feeds inbound frames; `sent` records outbound. */
function fakeTransport(): {
  transport: Transport;
  emit: (raw: RawData) => void;
  sent: string[];
} {
  let onMsg: ((raw: RawData) => void) | null = null;
  const sent: string[] = [];
  const transport: Transport = {
    send: (d) => {
      sent.push(d);
    },
    close: () => {},
    onMessage: (cb) => {
      onMsg = cb;
    },
    onOpen: () => {},
    onClose: () => {},
    onError: () => {},
  };
  return { transport, emit: (raw) => onMsg?.(raw), sent };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withNetworkConditions", () => {
  it("is deterministic for a given seed", async () => {
    const run = async (): Promise<RawData[]> => {
      const base = fakeTransport();
      const net = withNetworkConditions(base.transport, {
        latencyMs: 20,
        jitterMs: 10,
        lossRate: 0.5,
        seed: 42,
        lossyOnly: false, // let strings be drop-eligible too, to exercise the PRNG fully
      });
      const got: RawData[] = [];
      net.onMessage((raw) => got.push(raw));
      for (let i = 0; i < 10; i++) base.emit(`m${i}`);
      await vi.advanceTimersByTimeAsync(1000);
      return got;
    };

    const a = await run();
    const b = await run();
    expect(a).toEqual(b); // same seed → identical drops, delays, and delivery order
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThan(10); // some were dropped at lossRate 0.5
  });

  it("preserves delivery order (FIFO) when there is no jitter", async () => {
    const base = fakeTransport();
    const net = withNetworkConditions(base.transport, { latencyMs: 50, jitterMs: 0 });
    const got: RawData[] = [];
    net.onMessage((raw) => got.push(raw));

    base.emit("a");
    base.emit("b");
    base.emit("c");
    expect(got).toEqual([]); // nothing delivered before the latency elapses
    await vi.advanceTimersByTimeAsync(50);
    expect(got).toEqual(["a", "b", "c"]);
  });

  it("drops only binary state frames when lossyOnly (default)", () => {
    const base = fakeTransport();
    const net = withNetworkConditions(base.transport, { lossRate: 1, latencyMs: 0 });
    const got: RawData[] = [];
    net.onMessage((raw) => got.push(raw));

    base.emit("s:welcome-as-json"); // string control frame — never dropped
    base.emit(new Uint8Array([0x02, 1, 2, 3])); // binary state frame — dropped at lossRate 1

    expect(got).toEqual(["s:welcome-as-json"]);
  });

  it("drops any inbound frame when lossyOnly is false", () => {
    const base = fakeTransport();
    const net = withNetworkConditions(base.transport, {
      lossRate: 1,
      latencyMs: 0,
      lossyOnly: false,
    });
    const got: RawData[] = [];
    net.onMessage((raw) => got.push(raw));

    base.emit("a-string");
    base.emit(new Uint8Array([0x01]));
    expect(got).toEqual([]); // both dropped
  });

  it("never drops outbound messages, even at lossRate 1", () => {
    const base = fakeTransport();
    const net = withNetworkConditions(base.transport, { lossRate: 1, latencyMs: 0, lossyOnly: false });
    net.send("intent-1");
    net.send("intent-2");
    expect(base.sent).toEqual(["intent-1", "intent-2"]); // outbound is reliable
  });

  it("delays outbound by the configured latency", async () => {
    const base = fakeTransport();
    const net = withNetworkConditions(base.transport, { latencyMs: 30 });
    net.send("x");
    expect(base.sent).toEqual([]); // held for the latency
    await vi.advanceTimersByTimeAsync(30);
    expect(base.sent).toEqual(["x"]);
  });
});
