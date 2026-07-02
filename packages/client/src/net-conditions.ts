import type { RawData } from "@tikron/protocol";
import type { Transport } from "./transport.js";

/**
 * Dev-only network condition simulator. Wraps any {@link Transport} to add latency,
 * jitter, and (state-frame) loss, so you can feel how a game plays under a bad network
 * without leaving your machine.
 *
 * The real transport is a WebSocket, which is **reliable and ordered** — messages are
 * never actually lost or reordered on the wire. This simulator therefore models the
 * *effects* a game must tolerate: added delay and queueing, and (optionally) dropped
 * **binary state frames**, which the netcode is designed to recover from (a lost delta
 * is corrected by the next frame). It never drops outbound intents or acks — doing so
 * would violate the reliability the SDK assumes.
 */
export interface NetworkConditions {
  /** One-way base delay (ms) applied to both sent and received messages. Default 0. */
  latencyMs?: number;
  /** Random +/- jitter (ms) added to each message's delay. Default 0. */
  jitterMs?: number;
  /** Probability [0,1] of dropping an eligible inbound message. Default 0. */
  lossRate?: number;
  /** Seed for the PRNG, so jitter/loss are reproducible across runs. Default 1. */
  seed?: number;
  /**
   * When true (default), only **inbound binary state frames** are drop-eligible —
   * matching real netcode resilience. When false, any inbound message may be dropped
   * (an aggressive stress mode that breaks the SDK's normal reliability assumptions).
   */
  lossyOnly?: boolean;
}

/** Small, fast, seedable PRNG (mulberry32) — deterministic for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wrap `inner` with simulated {@link NetworkConditions}. Inbound and outbound messages
 * are delayed by `latencyMs ± jitterMs`; eligible inbound messages are dropped at
 * `lossRate`. With `jitterMs = 0`, delivery order is preserved (FIFO). Uses fake timers
 * transparently under a test runner (it schedules via `setTimeout`).
 */
export function withNetworkConditions(inner: Transport, conditions: NetworkConditions): Transport {
  const latency = Math.max(0, conditions.latencyMs ?? 0);
  const jitter = Math.max(0, conditions.jitterMs ?? 0);
  const loss = Math.min(1, Math.max(0, conditions.lossRate ?? 0));
  const lossyOnly = conditions.lossyOnly ?? true;
  const rand = mulberry32(conditions.seed ?? 1);

  const delay = (): number => (jitter > 0 ? Math.max(0, latency + (rand() * 2 - 1) * jitter) : latency);

  const inboundCbs: ((raw: RawData) => void)[] = [];

  inner.onMessage((raw) => {
    const isBinary = typeof raw !== "string"; // binary inbound == a state frame in this protocol
    const eligible = lossyOnly ? isBinary : true;
    if (loss > 0 && eligible && rand() < loss) return; // dropped
    const d = delay();
    if (d <= 0) {
      for (const cb of inboundCbs) cb(raw);
    } else {
      setTimeout(() => {
        for (const cb of inboundCbs) cb(raw);
      }, d);
    }
  });

  return {
    send: (data) => {
      // Outbound (intents/acks) is delayed but never dropped — WS delivery is reliable.
      const d = delay();
      if (d <= 0) inner.send(data);
      else setTimeout(() => inner.send(data), d);
    },
    close: () => inner.close(),
    onMessage: (cb) => {
      inboundCbs.push(cb);
    },
    onOpen: (cb) => inner.onOpen(cb),
    onClose: (cb) => inner.onClose(cb),
    onError: (cb) => inner.onError(cb),
  };
}
