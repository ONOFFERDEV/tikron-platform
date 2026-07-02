import { describe, it, expect } from "vitest";
import { PartySocket } from "partysocket";
import {
  reconnectDelay,
  shouldReconnectAfterClose,
  installReconnectJitter,
} from "./transport.js";

describe("reconnect backoff", () => {
  const noJitter = { random: () => 0 };

  it("doubles the delay each attempt from a 500ms base", () => {
    expect(reconnectDelay(1, noJitter)).toBe(500);
    expect(reconnectDelay(2, noJitter)).toBe(1000);
    expect(reconnectDelay(3, noJitter)).toBe(2000);
    expect(reconnectDelay(4, noJitter)).toBe(4000);
  });

  it("caps a single delay at maxDelayMs", () => {
    expect(reconnectDelay(10, noJitter)).toBe(8000); // default cap
    expect(reconnectDelay(10, { random: () => 0, maxDelayMs: 3000 })).toBe(3000);
  });

  it("adds up to `jitter` fraction of random slack on top", () => {
    expect(reconnectDelay(1, { random: () => 1 })).toBe(750); // 500 + 500 * 0.5 * 1
    expect(reconnectDelay(1, { random: () => 0.5 })).toBe(625);
    // With real randomness the delay stays within [exp, exp * (1 + jitter)).
    const d = reconnectDelay(2);
    expect(d).toBeGreaterThanOrEqual(1000);
    expect(d).toBeLessThan(1500);
  });
});

// Integration canary: pins the assumptions installReconnectJitter makes about the
// real (version-locked) PartySocket internals. If a partysocket bump renames
// `_getNextDelay`/`_retryCount` or changes the retry-count base, these fail in CI so
// the shim's silent no-op (reconnects would lose jitter) is caught, not shipped.
describe("installReconnectJitter (partysocket integration)", () => {
  function idleSocket(): PartySocket {
    // startClosed keeps the socket from opening a real connection during the test.
    return new PartySocket({ host: "localhost:1", room: "r", party: "p", startClosed: true });
  }

  it("installs onto a real PartySocket and drives its reconnect delay", () => {
    const socket = idleSocket();
    const installed = installReconnectJitter(socket, { random: () => 0 });
    expect(installed).toBe(true); // `_getNextDelay` still exists on this version

    const internals = socket as unknown as { _getNextDelay(): number; _retryCount: number };
    // _retryCount is 0 on the first connect (no delay) and 1-based on each reconnect.
    internals._retryCount = 0;
    expect(internals._getNextDelay()).toBe(0);
    internals._retryCount = 1;
    expect(internals._getNextDelay()).toBe(500); // first reconnect > 0 (base, no jitter)

    socket.close();
  });

  it("first-reconnect delay is strictly positive with default jitter", () => {
    const socket = idleSocket();
    installReconnectJitter(socket); // real Math.random jitter
    const internals = socket as unknown as { _getNextDelay(): number; _retryCount: number };
    internals._retryCount = 1;
    expect(internals._getNextDelay()).toBeGreaterThan(0);
    socket.close();
  });
});

describe("shouldReconnectAfterClose", () => {
  it("does not retry intentional server closes 4001–4004", () => {
    for (const code of [4001, 4002, 4003, 4004]) {
      expect(shouldReconnectAfterClose(code)).toBe(false);
    }
  });

  it("retries transient closes and unknown / missing codes", () => {
    expect(shouldReconnectAfterClose(1006)).toBe(true); // abnormal closure
    expect(shouldReconnectAfterClose(1000)).toBe(true); // normal closure
    expect(shouldReconnectAfterClose(4000)).toBe(true); // not in the no-retry set
    expect(shouldReconnectAfterClose(undefined)).toBe(true);
  });
});
