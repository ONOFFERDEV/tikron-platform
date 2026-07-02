/**
 * @tikron/protocol — shared wire protocol between the client SDK and the edge room server.
 *
 * M0 uses a JSON envelope with a `t` (type) discriminator. A binary delta codec
 * (`@tikron/schema`) is introduced in M2; the message tags defined here remain the
 * stable outer framing regardless of how room state itself is encoded.
 */

export const PROTOCOL_VERSION = 2;

/** Client -> Server message tags. */
export const ClientMessageType = {
  Hello: "c:hello",
  Echo: "c:echo",
  Broadcast: "c:broadcast",
  /** Developer-defined message (routed to a room's onMessage(type) handler). */
  Message: "c:msg",
  /** Clock-sync ping (client-stamped `t0`); the server echoes it with its time. */
  Time: "c:time",
} as const;
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType];

/** Server -> Client message tags. */
export const ServerMessageType = {
  Welcome: "s:welcome",
  Echo: "s:echo",
  PeerJoined: "s:peer-joined",
  PeerLeft: "s:peer-left",
  Broadcast: "s:broadcast",
  /** Authoritative room state snapshot (JSON in M1; binary delta from M2). */
  State: "s:state",
  /** Developer-defined server -> client message. */
  Message: "s:msg",
  /** Acknowledgement of the last processed client input seq (for reconciliation). */
  Ack: "s:ack",
  /** Clock-sync reply: echoes the ping `t0` plus the server's time at receipt. */
  Time: "s:time",
  Error: "s:error",
} as const;
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType];

// --- Client -> Server ---

export interface HelloMessage {
  t: typeof ClientMessageType.Hello;
  /** Optional display name for presence. */
  name?: string;
}

export interface EchoMessage {
  t: typeof ClientMessageType.Echo;
  text: string;
}

export interface BroadcastMessage {
  t: typeof ClientMessageType.Broadcast;
  text: string;
}

/**
 * A developer-defined message routed by `type` to a room's registered handler.
 * `seq` is a monotonic per-client counter used for input ordering and, later,
 * client-side reconciliation (M2). The payload shape is game-specific.
 */
export interface ClientGameMessage {
  t: typeof ClientMessageType.Message;
  type: string;
  seq?: number;
  payload?: unknown;
}

/** Clock-sync ping. `t0` is the client's send time (echoed back for RTT/offset). */
export interface TimeRequestMessage {
  t: typeof ClientMessageType.Time;
  t0: number;
  /**
   * The client's own latest round-trip estimate (ms), if it has one. Sent so the
   * server can track per-connection RTT for server-side lag compensation
   * (rewinding hit checks to what the shooter saw). Absent on the first ping.
   */
  rtt?: number;
}

export type ClientMessage =
  | HelloMessage
  | EchoMessage
  | BroadcastMessage
  | ClientGameMessage
  | TimeRequestMessage;

// --- Server -> Client ---

export interface WelcomeMessage {
  t: typeof ServerMessageType.Welcome;
  /**
   * The stable id this client is known by in the room. When the client supplied
   * a session key (`?_session=`), this is that key and survives reconnects;
   * otherwise it is the transport connection id.
   */
  connectionId: string;
  room: string;
  protocol: number;
  /** Client ids already present in the room when this client joined. */
  peers: string[];
  /** True when this Welcome reattaches a previous session (state was preserved). */
  reconnected?: boolean;
}

export interface EchoReplyMessage {
  t: typeof ServerMessageType.Echo;
  text: string;
}

export interface PeerJoinedMessage {
  t: typeof ServerMessageType.PeerJoined;
  connectionId: string;
  name?: string;
}

export interface PeerLeftMessage {
  t: typeof ServerMessageType.PeerLeft;
  connectionId: string;
}

export interface BroadcastRelayMessage {
  t: typeof ServerMessageType.Broadcast;
  from: string;
  text: string;
}

export interface ErrorMessage {
  t: typeof ServerMessageType.Error;
  code: string;
  message: string;
}

/**
 * Full authoritative state snapshot. `ackSeq` is the last input seq processed.
 * `tick` is the room's simulation-tick counter and `serverTime` its wall-clock
 * time (epoch ms) at the moment the snapshot was produced — clients interpolate on
 * `serverTime` (via {@link ClockSync}) so network jitter is not interpolation jitter.
 */
export interface StateMessage {
  t: typeof ServerMessageType.State;
  ackSeq?: number;
  tick?: number;
  serverTime?: number;
  state: unknown;
}

/** A developer-defined server -> client message routed by `type` on the client. */
export interface ServerGameMessage {
  t: typeof ServerMessageType.Message;
  type: string;
  payload?: unknown;
}

/** Acknowledges the last client input seq the server processed (client reconciliation). */
export interface AckMessage {
  t: typeof ServerMessageType.Ack;
  seq: number;
}

/** Clock-sync reply: the ping's `t0` plus the server's time (epoch ms) at receipt. */
export interface TimeReplyMessage {
  t: typeof ServerMessageType.Time;
  t0: number;
  serverTime: number;
}

export type ServerMessage =
  | WelcomeMessage
  | EchoReplyMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | BroadcastRelayMessage
  | StateMessage
  | ServerGameMessage
  | AckMessage
  | TimeReplyMessage
  | ErrorMessage;

export type AnyMessage = ClientMessage | ServerMessage;

/** Raw data as it comes off a WebSocket, on either side. */
export type RawData = string | ArrayBuffer | Uint8Array;

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

function rawToString(raw: RawData): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  return new TextDecoder().decode(new Uint8Array(raw));
}

/** Encode any protocol message to a wire string (JSON for M0). */
export function encode(message: AnyMessage): string {
  return JSON.stringify(message);
}

function decodeEnvelope(raw: RawData): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawToString(raw));
  } catch {
    throw new ProtocolError("invalid JSON payload");
  }
  if (typeof parsed !== "object" || parsed === null || !("t" in parsed)) {
    throw new ProtocolError("message missing type tag `t`");
  }
  return parsed as Record<string, unknown>;
}

const clientTags = new Set<string>(Object.values(ClientMessageType));
const serverTags = new Set<string>(Object.values(ServerMessageType));

/** Decode + validate a Client -> Server message (used on the server). */
export function decodeClientMessage(raw: RawData): ClientMessage {
  const msg = decodeEnvelope(raw);
  if (typeof msg.t !== "string" || !clientTags.has(msg.t)) {
    throw new ProtocolError(`unknown client message type: ${String(msg.t)}`);
  }
  return msg as unknown as ClientMessage;
}

/** Decode + validate a Server -> Client message (used on the client). */
export function decodeServerMessage(raw: RawData): ServerMessage {
  const msg = decodeEnvelope(raw);
  if (typeof msg.t !== "string" || !serverTags.has(msg.t)) {
    throw new ProtocolError(`unknown server message type: ${String(msg.t)}`);
  }
  return msg as unknown as ServerMessage;
}
