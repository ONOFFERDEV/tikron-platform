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

export interface TransportOptions {
  /** Gateway host, e.g. "localhost:8787" or "api.tikron.dev" (no protocol). */
  host: string;
  room: string;
  party: string;
  query?: Record<string, string>;
  /** WebSocket implementation for non-browser environments (e.g. the `ws` package). */
  WebSocketPolyfill?: unknown;
}

export type TransportFactory = (opts: TransportOptions) => Transport;

/** Default transport: a reconnecting WebSocket via PartySocket. */
export const createPartySocketTransport: TransportFactory = (opts) => {
  const socket = new PartySocket({
    host: opts.host,
    room: opts.room,
    party: opts.party,
    query: opts.query,
    WebSocket: opts.WebSocketPolyfill as never,
  });
  // Binary state frames must arrive as ArrayBuffer, not the WebSocket default Blob.
  socket.binaryType = "arraybuffer";

  // 4001 = session taken over by a newer connection (see @tikron/server).
  // Stop auto-reconnecting, or the two transports would steal the seat from
  // each other in an endless loop (e.g. a duplicated tab sharing sessionStorage).
  socket.addEventListener("close", (e) => {
    if ((e as CloseEvent).code === 4001) socket.close();
  });

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
