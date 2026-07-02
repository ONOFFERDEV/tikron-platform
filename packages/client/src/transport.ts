import { PartySocket } from "partysocket";
import type { RawData } from "@tikron/protocol";

/**
 * Transport abstracts the underlying bidirectional connection so the SDK is not
 * bound to a single wire technology. M0 ships a WebSocket transport (PartySocket);
 * a WebTransport implementation is on the roadmap and will satisfy this same shape.
 */
export interface Transport {
  send(data: string): void;
  close(): void;
  onMessage(cb: (raw: RawData) => void): void;
  onOpen(cb: () => void): void;
  onClose(cb: () => void): void;
  onError(cb: (err: unknown) => void): void;
}

/** Reconnection backoff policy for the default transport. */
export interface ReconnectOptions {
  /** Delay before the first retry, ms; doubles each attempt (default 500). */
  baseDelayMs?: number;
  /** Ceiling for any single backoff delay, ms (default 8000). */
  maxDelayMs?: number;
  /** Give up after this many consecutive failed attempts (default 5). */
  maxRetries?: number;
  /** Extra random slack as a fraction of the delay, 0..1 (default 0.5). */
  jitter?: number;
  /** Randomness source (default `Math.random`); injectable for tests. */
  random?: () => number;
}

/**
 * Server close codes 4001–4004 (see @tikron/server) are deliberate rejections —
 * session taken over, room full, invalid session, unauthorized. Reconnecting after
 * one just retries a decision the server already made (and, for a takeover, two
 * sockets fight over the seat forever), so these are never retried.
 */
const NO_RETRY_CLOSE_CODES = new Set([4001, 4002, 4003, 4004]);

/**
 * Whether a socket that closed with `code` should be retried (false for 4001–4004).
 *
 * Every other code — including a normal close (1000) or no-status (1005) — is treated
 * as retryable. That is only safe because this predicate governs *unsolicited* closes:
 * a `room.leave()` routes through PartySocket's `close()`, whose internal
 * `_closeCalled` guard suppresses reconnection before this predicate is ever consulted.
 * So a clean client-initiated 1000 does NOT reconnect; a server-sent 1000/1006 does.
 */
export function shouldReconnectAfterClose(code: number | undefined): boolean {
  return code === undefined || !NO_RETRY_CLOSE_CODES.has(code);
}

/**
 * Backoff delay (ms) for the nth (1-based) reconnect attempt: exponential
 * `min(maxDelayMs, baseDelayMs · 2^(attempt-1))` plus up to `jitter` fractional
 * random slack. The jitter de-synchronizes a fleet all reconnecting after one
 * shared outage (the connection-storm case), spreading admission over time.
 */
export function reconnectDelay(attempt: number, opts: ReconnectOptions = {}): number {
  const base = opts.baseDelayMs ?? 500;
  const max = opts.maxDelayMs ?? 8_000;
  const jitter = opts.jitter ?? 0.5;
  const random = opts.random ?? Math.random;
  const exp = Math.min(max, base * 2 ** (Math.max(1, attempt) - 1));
  return exp + exp * jitter * random();
}

/** The subset of PartySocket internals the jitter shim reads/replaces. @internal */
interface ReconnectingSocketInternals {
  _getNextDelay?: () => number;
  _retryCount?: number;
}

/**
 * Route a PartySocket's reconnect backoff through {@link reconnectDelay} so retries
 * get jitter (PartySocket's native backoff has none). Its `_retryCount` is 0 on the
 * first connect (no delay) and 1-based on each reconnect. Guarded: if the internals
 * ever change shape, the shim is skipped and PartySocket's own exponential backoff
 * (still configured on the socket) takes over. Exported so a test can assert the
 * shim installs and returns a positive first-reconnect delay against the pinned
 * partysocket version — a canary that fails CI if a version bump breaks these
 * assumptions. Returns whether the shim was installed.
 */
export function installReconnectJitter(socket: unknown, reconnect: ReconnectOptions = {}): boolean {
  const internals = socket as ReconnectingSocketInternals;
  if (typeof internals._getNextDelay !== "function") return false;
  internals._getNextDelay = () => {
    const attempt = internals._retryCount ?? 0;
    return attempt > 0 ? reconnectDelay(attempt, reconnect) : 0;
  };
  return true;
}

export interface TransportOptions {
  /** Gateway host, e.g. "localhost:8787" or "api.tikron.dev" (no protocol). */
  host: string;
  room: string;
  party: string;
  query?: Record<string, string>;
  /** WebSocket implementation for non-browser environments (e.g. the `ws` package). */
  WebSocketPolyfill?: unknown;
  /** Override the reconnection backoff policy (defaults: 500ms base, ×2, 5 retries). */
  reconnect?: ReconnectOptions;
}

export type TransportFactory = (opts: TransportOptions) => Transport;

/** Default transport: a reconnecting WebSocket via PartySocket. */
export const createPartySocketTransport: TransportFactory = (opts) => {
  const reconnect = opts.reconnect ?? {};
  const socket = new PartySocket({
    host: opts.host,
    room: opts.room,
    party: opts.party,
    query: opts.query,
    WebSocket: opts.WebSocketPolyfill as never,
    // Exponential backoff caps the reconnect rate so failed connects don't hammer
    // an overloaded room (the deployed connection-storm failure). Retries are
    // bounded, and 4001–4004 stop reconnection entirely (below).
    minReconnectionDelay: reconnect.baseDelayMs ?? 500,
    maxReconnectionDelay: reconnect.maxDelayMs ?? 8_000,
    reconnectionDelayGrowFactor: 2,
    maxRetries: reconnect.maxRetries ?? 5,
    shouldReconnectOnClose: (e: CloseEvent) => shouldReconnectAfterClose(e.code),
  });
  // Binary state frames must arrive as ArrayBuffer, not the WebSocket default Blob.
  socket.binaryType = "arraybuffer";

  installReconnectJitter(socket, reconnect); // add jitter on top of the exponential backoff

  return {
    send: (data) => socket.send(data),
    close: () => socket.close(),
    onMessage: (cb) =>
      socket.addEventListener("message", (e) => cb((e as MessageEvent).data as RawData)),
    onOpen: (cb) => socket.addEventListener("open", () => cb()),
    onClose: (cb) => socket.addEventListener("close", () => cb()),
    onError: (cb) => socket.addEventListener("error", (e) => cb(e)),
  };
};
