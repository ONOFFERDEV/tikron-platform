/**
 * @playedge/protocol — shared wire protocol between the client SDK and the edge room server.
 *
 * M0 uses a JSON envelope with a `t` (type) discriminator. A binary delta codec
 * (`@playedge/schema`) is introduced in M2; the message tags defined here remain the
 * stable outer framing regardless of how room state itself is encoded.
 */

export const PROTOCOL_VERSION = 1;

/** Client -> Server message tags. */
export const ClientMessageType = {
  Hello: "c:hello",
  Echo: "c:echo",
  Broadcast: "c:broadcast",
} as const;
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType];

/** Server -> Client message tags. */
export const ServerMessageType = {
  Welcome: "s:welcome",
  Echo: "s:echo",
  PeerJoined: "s:peer-joined",
  PeerLeft: "s:peer-left",
  Broadcast: "s:broadcast",
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

export type ClientMessage = HelloMessage | EchoMessage | BroadcastMessage;

// --- Server -> Client ---

export interface WelcomeMessage {
  t: typeof ServerMessageType.Welcome;
  connectionId: string;
  room: string;
  protocol: number;
  /** Connection ids already present in the room when this client joined. */
  peers: string[];
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

export type ServerMessage =
  | WelcomeMessage
  | EchoReplyMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | BroadcastRelayMessage
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
