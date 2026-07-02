import { describe, it, expect, vi } from "vitest";
import { ClockSync } from "./clock.js";

describe("ClockSync offset/rtt estimation", () => {
  it("derives offset and rtt from one ping/reply pair", () => {
    let clientClock = 1000;
    const sent: number[] = [];
    const cs = new ClockSync({ send: (t0) => sent.push(t0), now: () => clientClock });

    clientClock = 1000;
    cs.ping(); // t0 = 1000
    clientClock = 1040; // reply lands 40ms later
    cs.accept(sent.at(-1)!, 6020); // server clock ≈ 6020 at the request's midpoint

    expect(cs.rttMs).toBe(40);
    expect(cs.offsetMs).toBe(5000); // 6020 + 40/2 - 1040
    expect(cs.serverNow()).toBe(6040); // clientClock 1040 + offset 5000
  });

  it("uses the median offset, ignoring a single jitter spike", () => {
    let clientClock = 0;
    const cs = new ClockSync({ send: () => {}, now: () => clientClock });
    const sample = (serverMid: number) => {
      clientClock = 0;
      cs.ping();
      clientClock = 20; // rtt = 20 for every sample
      cs.accept(0, serverMid);
    };
    sample(110); // offset 110 + 10 - 20 = 100
    sample(110); // 100
    sample(110); // 100
    sample(1010); // 1000 (a spike)
    // median of [100, 100, 100, 1000] is 100 — the spike does not move it.
    expect(cs.offsetMs).toBe(100);
    expect(cs.rttMs).toBe(20);
  });

  it("bursts pings on start and stops cleanly", () => {
    vi.useFakeTimers();
    try {
      let pings = 0;
      const cs = new ClockSync({
        send: () => pings++,
        burst: 3,
        spacingMs: 100,
        intervalMs: 5000,
      });
      cs.start();
      vi.advanceTimersByTime(250); // burst at 0, 100, 200ms
      expect(pings).toBe(3);
      cs.stop();
      vi.advanceTimersByTime(20_000); // no periodic pings after stop
      expect(pings).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
