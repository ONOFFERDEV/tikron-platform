// ../../packages/protocol/dist/index.js
var PROTOCOL_VERSION = 2;
var ClientMessageType = {
  Hello: "c:hello",
  Echo: "c:echo",
  Broadcast: "c:broadcast",
  /** Developer-defined message (routed to a room's onMessage(type) handler). */
  Message: "c:msg",
  /** A coalesced batch of developer messages in one WS frame (see {@link ClientMessageBatch}). */
  MessageBatch: "c:mbatch",
  /** Clock-sync ping (client-stamped `t0`); the server echoes it with its time. */
  Time: "c:time"
};
var ServerMessageType = {
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
  Error: "s:error"
};
var ProtocolError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolError";
  }
};
function rawToString(raw) {
  if (typeof raw === "string")
    return raw;
  if (raw instanceof Uint8Array)
    return new TextDecoder().decode(raw);
  return new TextDecoder().decode(new Uint8Array(raw));
}
function encode(message) {
  return JSON.stringify(message);
}
function decodeEnvelope(raw) {
  let parsed;
  try {
    parsed = JSON.parse(rawToString(raw));
  } catch {
    throw new ProtocolError("invalid JSON payload");
  }
  if (typeof parsed !== "object" || parsed === null || !("t" in parsed)) {
    throw new ProtocolError("message missing type tag `t`");
  }
  return parsed;
}
var clientTags = new Set(Object.values(ClientMessageType));
var serverTags = new Set(Object.values(ServerMessageType));
function decodeServerMessage(raw) {
  const msg = decodeEnvelope(raw);
  if (typeof msg.t !== "string" || !serverTags.has(msg.t)) {
    throw new ProtocolError(`unknown server message type: ${String(msg.t)}`);
  }
  return msg;
}

// ../../packages/schema/dist/bytes.js
var TEXT_ENCODER = new TextEncoder();
var TEXT_DECODER = new TextDecoder();
var ByteReader = class {
  buf;
  view;
  pos = 0;
  constructor(buf) {
    this.buf = buf;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  u8() {
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }
  u16() {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i32() {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f32() {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f64() {
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }
  bool() {
    return this.u8() !== 0;
  }
  varint() {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = this.u8();
      result += (b & 127) * Math.pow(2, shift);
      shift += 7;
    } while (b & 128);
    return result;
  }
  str() {
    const len = this.varint();
    const slice = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return TEXT_DECODER.decode(slice);
  }
  get remaining() {
    return this.buf.byteLength - this.pos;
  }
};

// ../../packages/schema/dist/schema.js
function descToken(s) {
  return `${s.length}#${s}`;
}
var PRIM_IO = {
  u8: { write: (w, v) => w.u8(v), read: (r) => r.u8() },
  u16: { write: (w, v) => w.u16(v), read: (r) => r.u16() },
  u32: { write: (w, v) => w.u32(v), read: (r) => r.u32() },
  i32: { write: (w, v) => w.i32(v), read: (r) => r.i32() },
  f32: { write: (w, v) => w.f32(v), read: (r) => r.f32() },
  f64: { write: (w, v) => w.f64(v), read: (r) => r.f64() },
  bool: { write: (w, v) => w.bool(v), read: (r) => r.bool() },
  str: { write: (w, v) => w.str(v), read: (r) => r.str() }
};
function prim(type) {
  const io = PRIM_IO[type];
  const write = io.write;
  const read = io.read;
  return {
    writeFull: write,
    readFull: read,
    writeDelta: (w, _prev, next) => write(w, next),
    readDelta: (r) => read(r),
    equals: (a, b) => a === b,
    clone: (v) => v,
    // primitives are immutable — no copy needed
    describe: () => type
  };
}
function quant(min, max, step) {
  if (!(step > 0)) {
    throw new Error(`quant: step must be > 0, got ${step}.`);
  }
  if (!(max > min)) {
    throw new Error(`quant: max (${max}) must be greater than min (${min}).`);
  }
  if (step > max - min) {
    throw new Error(`quant: step (${step}) is larger than the range max \u2212 min (${max - min}), which collapses every value to ${min}. Pick a step no larger than the range.`);
  }
  const levels = Math.round((max - min) / step);
  const io = levels <= 255 ? PRIM_IO.u8 : levels <= 65535 ? PRIM_IO.u16 : PRIM_IO.u32;
  const quantize = (v) => {
    const clamped = v < min ? min : v > max ? max : v;
    return Math.round((clamped - min) / step);
  };
  const write = (w, v) => io.write(w, quantize(v));
  const read = (r) => min + io.read(r) * step;
  return {
    writeFull: write,
    readFull: read,
    writeDelta: (w, _prev, next) => write(w, next),
    readDelta: (r) => read(r),
    equals: (a, b) => quantize(a) === quantize(b),
    clone: (v) => v,
    // numbers are immutable
    // min/max/step fully determine the wire width and the byte->value mapping.
    describe: () => `q(${min},${max},${step})`
  };
}
function schema(shape) {
  const fields = Object.entries(shape).map(([name, t]) => ({
    name,
    codec: typeof t === "string" ? prim(t) : t
  }));
  const maskBytes = Math.ceil(fields.length / 8) || 1;
  const get = (o, name) => o[name];
  return {
    writeFull(w, value) {
      for (const f of fields)
        f.codec.writeFull(w, get(value, f.name));
    },
    readFull(r) {
      const out = {};
      for (const f of fields)
        out[f.name] = f.codec.readFull(r);
      return out;
    },
    writeDelta(w, prev, next) {
      const changed = [];
      fields.forEach((f, i) => {
        const isChanged = prev === void 0 || !f.codec.equals(get(prev, f.name), get(next, f.name));
        if (isChanged)
          changed.push(i);
      });
      for (let b = 0; b < maskBytes; b++) {
        let byte = 0;
        for (const idx of changed)
          if (idx >> 3 === b)
            byte |= 1 << (idx & 7);
        w.u8(byte);
      }
      for (const idx of changed) {
        const f = fields[idx];
        const prevField = prev === void 0 ? void 0 : get(prev, f.name);
        f.codec.writeDelta(w, prevField, get(next, f.name));
      }
    },
    readDelta(r, prev) {
      const mask = [];
      for (let b = 0; b < maskBytes; b++)
        mask.push(r.u8());
      const out = { ...prev ?? {} };
      fields.forEach((f, i) => {
        if (((mask[i >> 3] ?? 0) & 1 << (i & 7)) !== 0) {
          const prevField = prev === void 0 ? void 0 : get(prev, f.name);
          out[f.name] = f.codec.readDelta(r, prevField);
        }
      });
      return out;
    },
    equals(a, b) {
      for (const f of fields)
        if (!f.codec.equals(get(a, f.name), get(b, f.name)))
          return false;
      return true;
    },
    clone(value) {
      const out = {};
      for (const f of fields)
        out[f.name] = f.codec.clone(get(value, f.name));
      return out;
    },
    describe() {
      const parts = [];
      for (const f of fields) {
        const childDesc = f.codec.describe?.();
        if (childDesc === void 0)
          return void 0;
        parts.push(`${descToken(f.name)}:${childDesc}`);
      }
      return `obj(${parts.join(",")})`;
    }
  };
}
function mapOf(child) {
  const keysOf = (o) => Object.keys(o);
  return {
    writeFull(w, value) {
      const keys2 = keysOf(value);
      w.varint(keys2.length);
      for (const k of keys2) {
        w.str(k);
        child.writeFull(w, value[k]);
      }
    },
    readFull(r) {
      const n = r.varint();
      const out = {};
      for (let i = 0; i < n; i++) {
        const k = r.str();
        out[k] = child.readFull(r);
      }
      return out;
    },
    writeDelta(w, prev, next) {
      const prevObj = prev ?? {};
      const removed = keysOf(prevObj).filter((k) => !(k in next));
      const changed = keysOf(next).filter((k) => !(k in prevObj) || !child.equals(prevObj[k], next[k]));
      w.varint(removed.length);
      for (const k of removed)
        w.str(k);
      w.varint(changed.length);
      for (const k of changed) {
        w.str(k);
        if (k in prevObj)
          child.writeDelta(w, prevObj[k], next[k]);
        else
          child.writeFull(w, next[k]);
      }
    },
    readDelta(r, prev) {
      const prevObj = prev ?? {};
      const out = { ...prevObj };
      const removedN = r.varint();
      for (let i = 0; i < removedN; i++)
        delete out[r.str()];
      const changedN = r.varint();
      for (let i = 0; i < changedN; i++) {
        const k = r.str();
        out[k] = k in prevObj ? child.readDelta(r, prevObj[k]) : child.readFull(r);
      }
      return out;
    },
    equals(a, b) {
      const ak = keysOf(a);
      if (ak.length !== keysOf(b).length)
        return false;
      for (const k of ak)
        if (!(k in b) || !child.equals(a[k], b[k]))
          return false;
      return true;
    },
    clone(value) {
      const out = {};
      for (const k of keysOf(value))
        out[k] = child.clone(value[k]);
      return out;
    },
    describe() {
      const c = child.describe?.();
      return c === void 0 ? void 0 : `map(${c})`;
    }
  };
}
function decodeFull(codec, bytes) {
  return codec.readFull(new ByteReader(bytes));
}
function applyDelta(codec, prev, bytes) {
  return codec.readDelta(new ByteReader(bytes), prev);
}
function schemaFingerprint(codec) {
  const desc = codec.describe?.();
  if (desc === void 0)
    return null;
  let h = 2166136261;
  for (let i = 0; i < desc.length; i++) {
    h ^= desc.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ../../node_modules/.pnpm/partysocket@1.3.0_react@19.2.7/node_modules/partysocket/dist/ws.js
if (!globalThis.EventTarget || !globalThis.Event)
  console.error(`
  PartySocket requires a global 'EventTarget' class to be available!
  You can polyfill this global by adding this to your code before any partysocket imports: 
  
  \`\`\`
  import 'partysocket/event-target-polyfill';
  \`\`\`
  Please file an issue at https://github.com/partykit/partykit if you're still having trouble.
`);
var ErrorEvent = class extends Event {
  message;
  error;
  constructor(error, target) {
    super("error", target);
    this.message = error.message;
    this.error = error;
  }
};
var CloseEvent = class extends Event {
  code;
  reason;
  wasClean = true;
  constructor(code = 1e3, reason = "", target) {
    super("close", target);
    this.code = code;
    this.reason = reason;
  }
};
var Events = {
  Event,
  ErrorEvent,
  CloseEvent
};
function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}
function cloneEventBrowser(e) {
  return new e.constructor(e.type, e);
}
function cloneEventNode(e) {
  if ("data" in e) return new MessageEvent(e.type, e);
  if ("code" in e || "reason" in e)
    return new CloseEvent(e.code || 1999, e.reason || "unknown reason", e);
  if ("error" in e) return new ErrorEvent(e.error, e);
  return new Event(e.type, e);
}
var isNode = typeof process !== "undefined" && typeof process.versions?.node !== "undefined";
var isReactNative = typeof navigator !== "undefined" && navigator.product === "ReactNative";
var cloneEvent = isNode || isReactNative ? cloneEventNode : cloneEventBrowser;
var DEFAULT = {
  maxReconnectionDelay: 1e4,
  minReconnectionDelay: 3e3,
  minUptime: 5e3,
  reconnectionDelayGrowFactor: 1.3,
  connectionTimeout: 4e3,
  maxRetries: Number.POSITIVE_INFINITY,
  maxEnqueuedMessages: Number.POSITIVE_INFINITY,
  startClosed: false,
  debug: false
};
var didWarnAboutMissingWebSocket = false;
function absorbError() {
}
var ReconnectingWebSocket = class ReconnectingWebSocket2 extends EventTarget {
  _ws;
  _retryCount = -1;
  _uptimeTimeout;
  _connectTimeout;
  _shouldReconnect = true;
  _connectLock = false;
  _binaryType = "blob";
  _closeCalled = false;
  _didWarnAboutClosedSend = false;
  _messageQueue = [];
  _debugLogger = console.log.bind(console);
  _url;
  _protocols;
  _options;
  constructor(url, protocols, options = {}) {
    super();
    this._url = url;
    this._protocols = protocols;
    this._options = options;
    if (this._options.startClosed) this._shouldReconnect = false;
    if (this._options.debugLogger)
      this._debugLogger = this._options.debugLogger;
    this._connect();
  }
  static get CONNECTING() {
    return 0;
  }
  static get OPEN() {
    return 1;
  }
  static get CLOSING() {
    return 2;
  }
  static get CLOSED() {
    return 3;
  }
  get CONNECTING() {
    return ReconnectingWebSocket2.CONNECTING;
  }
  get OPEN() {
    return ReconnectingWebSocket2.OPEN;
  }
  get CLOSING() {
    return ReconnectingWebSocket2.CLOSING;
  }
  get CLOSED() {
    return ReconnectingWebSocket2.CLOSED;
  }
  get binaryType() {
    return this._ws ? this._ws.binaryType : this._binaryType;
  }
  set binaryType(value) {
    this._binaryType = value;
    if (this._ws) this._ws.binaryType = value;
  }
  /**
   * Returns the number or connection retries
   */
  get retryCount() {
    return Math.max(this._retryCount, 0);
  }
  /**
   * The number of bytes of data that have been queued using calls to send() but not yet
   * transmitted to the network. This value resets to zero once all queued data has been sent.
   * This value does not reset to zero when the connection is closed; if you keep calling send(),
   * this will continue to climb. Read only
   */
  get bufferedAmount() {
    return this._messageQueue.reduce((acc, message) => {
      if (typeof message === "string") acc += message.length;
      else if (message instanceof Blob) acc += message.size;
      else acc += message.byteLength;
      return acc;
    }, 0) + (this._ws ? this._ws.bufferedAmount : 0);
  }
  /**
   * The extensions selected by the server. This is currently only the empty string or a list of
   * extensions as negotiated by the connection
   */
  get extensions() {
    return this._ws ? this._ws.extensions : "";
  }
  /**
   * A string indicating the name of the sub-protocol the server selected;
   * this will be one of the strings specified in the protocols parameter when creating the
   * WebSocket object
   */
  get protocol() {
    return this._ws ? this._ws.protocol : "";
  }
  /**
   * The current state of the connection; this is one of the Ready state constants
   */
  get readyState() {
    if (this._closeCalled) return ReconnectingWebSocket2.CLOSED;
    if (this._ws) return this._ws.readyState;
    return this._options.startClosed ? ReconnectingWebSocket2.CLOSED : ReconnectingWebSocket2.CONNECTING;
  }
  /**
   * The URL as resolved by the constructor
   */
  get url() {
    return this._ws ? this._ws.url : "";
  }
  /**
   * Whether the websocket object is now in reconnectable state
   */
  get shouldReconnect() {
    return this._shouldReconnect;
  }
  /**
   * An event listener to be called when the WebSocket connection's readyState changes to CLOSED
   */
  onclose = null;
  /**
   * An event listener to be called when an error occurs
   */
  onerror = null;
  /**
   * An event listener to be called when a message is received from the server
   */
  onmessage = null;
  /**
   * An event listener to be called when the WebSocket connection's readyState changes to OPEN;
   * this indicates that the connection is ready to send and receive data
   */
  onopen = null;
  /**
   * Closes the WebSocket connection or connection attempt, if any. If the connection is already
   * CLOSED or CLOSING, this method does nothing.
   *
   * The `close` event is dispatched synchronously (mirroring how
   * `reconnect()` dispatches its synthetic close). This guarantees
   * consumers observe a terminal event for every explicit close, even
   * if their listeners are detached right after this call — previously
   * the real (asynchronous) browser close event could fire after
   * listeners were removed and go unobserved entirely.
   */
  close(code = 1e3, reason) {
    this._closeCalled = true;
    this._shouldReconnect = false;
    this._clearTimeouts();
    if (!this._ws) {
      this._debug("close enqueued: no ws instance");
      return;
    }
    if (this._ws.readyState === this.CLOSED || this._ws.readyState === this.CLOSING) {
      this._debug("close: already closing or closed");
      return;
    }
    this._disconnect(code, reason);
  }
  /**
   * Closes the WebSocket connection or connection attempt and connects again.
   * Resets retry counter;
   */
  reconnect(code, reason) {
    this._shouldReconnect = true;
    this._closeCalled = false;
    this._didWarnAboutClosedSend = false;
    this._retryCount = -1;
    if (!this._ws || this._ws.readyState === this.CLOSED || this._ws.readyState === this.CLOSING)
      this._connect();
    else {
      this._disconnect(code, reason);
      this._connect();
    }
  }
  /**
   * Enqueue specified data to be transmitted to the server over the WebSocket connection.
   *
   * @returns `true` if the message was transmitted immediately over an open
   * connection; `false` if it was buffered (sent when the connection next
   * opens — the buffer is always flushed before the `open` event is
   * dispatched) or dropped because `maxEnqueuedMessages` was reached.
   */
  send(data) {
    if (this._ws && this._ws.readyState === this.OPEN) {
      this._debug("send", data);
      this._ws.send(data);
      return true;
    }
    if (this._closeCalled && !this._didWarnAboutClosedSend) {
      this._didWarnAboutClosedSend = true;
      console.warn(
        "ReconnectingWebSocket: send() was called after close(). The message has been buffered, but it will only be delivered if reconnect() is called on this socket. If this socket has been discarded, the message is lost \u2014 this usually means a stale socket reference is being used."
      );
    }
    const { maxEnqueuedMessages = DEFAULT.maxEnqueuedMessages } = this._options;
    if (this._messageQueue.length < maxEnqueuedMessages) {
      this._debug("enqueue", data);
      this._messageQueue.push(data);
    }
    return false;
  }
  /**
   * Removes and returns all messages that were passed to send() but never
   * transmitted (they were buffered while the connection wasn't open).
   *
   * Useful when a socket is being discarded and replaced (e.g. the React
   * hooks recreate the socket when connection options change): the
   * replacement socket can re-send these messages, instead of them being
   * silently lost with the old instance.
   */
  drainQueuedMessages() {
    const queue = this._messageQueue;
    this._messageQueue = [];
    return queue;
  }
  _debug(...args) {
    if (this._options.debug) this._debugLogger("RWS>", ...args);
  }
  _getNextDelay() {
    const {
      reconnectionDelayGrowFactor = DEFAULT.reconnectionDelayGrowFactor,
      minReconnectionDelay = DEFAULT.minReconnectionDelay,
      maxReconnectionDelay = DEFAULT.maxReconnectionDelay
    } = this._options;
    let delay = 0;
    if (this._retryCount > 0) {
      delay = minReconnectionDelay * reconnectionDelayGrowFactor ** (this._retryCount - 1);
      if (delay > maxReconnectionDelay) delay = maxReconnectionDelay;
    }
    this._debug("next delay", delay);
    return delay;
  }
  _wait() {
    return new Promise((resolve) => {
      setTimeout(resolve, this._getNextDelay());
    });
  }
  _getNextProtocols(protocolsProvider) {
    if (!protocolsProvider) return Promise.resolve(null);
    if (typeof protocolsProvider === "string" || Array.isArray(protocolsProvider))
      return Promise.resolve(protocolsProvider);
    if (typeof protocolsProvider === "function") {
      const protocols = protocolsProvider();
      if (!protocols) return Promise.resolve(null);
      if (typeof protocols === "string" || Array.isArray(protocols))
        return Promise.resolve(protocols);
      if (protocols.then) return protocols;
    }
    throw Error("Invalid protocols");
  }
  _getNextUrl(urlProvider) {
    if (typeof urlProvider === "string") return Promise.resolve(urlProvider);
    if (typeof urlProvider === "function") {
      const url = urlProvider();
      if (typeof url === "string") return Promise.resolve(url);
      if (url.then) return url;
    }
    throw Error("Invalid URL");
  }
  _connect() {
    if (this._connectLock || !this._shouldReconnect) return;
    this._connectLock = true;
    const {
      maxRetries = DEFAULT.maxRetries,
      connectionTimeout = DEFAULT.connectionTimeout
    } = this._options;
    if (this._retryCount >= maxRetries) {
      this._debug("max retries reached", this._retryCount, ">=", maxRetries);
      this._connectLock = false;
      return;
    }
    this._retryCount++;
    this._debug("connect", this._retryCount);
    this._removeListeners();
    this._wait().then(
      () => Promise.all([
        this._getNextUrl(this._url),
        this._getNextProtocols(this._protocols || null)
      ])
    ).then(([url, protocols]) => {
      if (this._closeCalled) {
        this._connectLock = false;
        return;
      }
      if (!this._options.WebSocket && typeof WebSocket === "undefined" && !didWarnAboutMissingWebSocket) {
        console.error(`\u203C\uFE0F No WebSocket implementation available. You should define options.WebSocket. 

For example, if you're using node.js, run \`npm install ws\`, and then in your code:

import PartySocket from 'partysocket';
import WS from 'ws';

const partysocket = new PartySocket({
  host: "127.0.0.1:1999",
  room: "test-room",
  WebSocket: WS
});

`);
        didWarnAboutMissingWebSocket = true;
      }
      const WS = this._options.WebSocket || WebSocket;
      this._debug("connect", {
        url,
        protocols
      });
      this._ws = protocols ? new WS(url, protocols) : new WS(url);
      this._ws.binaryType = this._binaryType;
      this._connectLock = false;
      this._addListeners();
      this._connectTimeout = setTimeout(
        () => this._handleTimeout(),
        connectionTimeout
      );
    }).catch((err) => {
      this._connectLock = false;
      this._handleError(new Events.ErrorEvent(Error(err.message), this));
    });
  }
  _handleTimeout() {
    this._debug("timeout event");
    this._handleError(new Events.ErrorEvent(Error("TIMEOUT"), this));
  }
  _disconnect(code = 1e3, reason) {
    this._clearTimeouts();
    if (!this._ws) return;
    this._removeListeners();
    try {
      if (this._ws.readyState === this.OPEN || this._ws.readyState === this.CONNECTING)
        this._ws.close(code, reason);
      this._handleClose(new Events.CloseEvent(code, reason, this));
    } catch (_error) {
    }
  }
  _acceptOpen() {
    this._debug("accept open");
    this._retryCount = 0;
  }
  _handleOpen = (event) => {
    this._debug("open event");
    const { minUptime = DEFAULT.minUptime } = this._options;
    clearTimeout(this._connectTimeout);
    this._uptimeTimeout = setTimeout(() => this._acceptOpen(), minUptime);
    assert(this._ws, "WebSocket is not defined");
    this._ws.binaryType = this._binaryType;
    this._messageQueue.forEach((message) => {
      this._ws?.send(message);
    });
    this._messageQueue = [];
    if (this.onopen) this.onopen(event);
    this.dispatchEvent(cloneEvent(event));
  };
  _handleMessage = (event) => {
    this._debug("message event");
    if (this.onmessage) this.onmessage(event);
    this.dispatchEvent(cloneEvent(event));
  };
  _handleError = (event) => {
    this._debug("error event", event.message);
    this._disconnect(void 0, event.message === "TIMEOUT" ? "timeout" : void 0);
    if (this.onerror) this.onerror(event);
    this._debug("exec error listeners");
    this.dispatchEvent(cloneEvent(event));
    this._connect();
  };
  _handleClose = (event) => {
    this._debug("close event");
    this._clearTimeouts();
    if (this._options.shouldReconnectOnClose && !this._options.shouldReconnectOnClose(event))
      this._shouldReconnect = false;
    if (this._shouldReconnect) this._connect();
    if (this.onclose) this.onclose(event);
    this.dispatchEvent(cloneEvent(event));
  };
  _removeListeners() {
    if (!this._ws) return;
    this._debug("removeListeners");
    this._ws.removeEventListener("open", this._handleOpen);
    this._ws.removeEventListener("close", this._handleClose);
    this._ws.removeEventListener("message", this._handleMessage);
    this._ws.removeEventListener("error", this._handleError);
    this._ws.addEventListener("error", absorbError);
  }
  _addListeners() {
    if (!this._ws) return;
    this._debug("addListeners");
    this._ws.addEventListener("open", this._handleOpen);
    this._ws.addEventListener("close", this._handleClose);
    this._ws.addEventListener("message", this._handleMessage);
    this._ws.addEventListener("error", this._handleError);
  }
  _clearTimeouts() {
    clearTimeout(this._connectTimeout);
    clearTimeout(this._uptimeTimeout);
  }
};

// ../../node_modules/.pnpm/partysocket@1.3.0_react@19.2.7/node_modules/partysocket/dist/index.js
var valueIsNotNil = (keyValuePair) => keyValuePair[1] !== null && keyValuePair[1] !== void 0;
function generateUUID() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  let d = Date.now();
  let d2 = performance?.now && performance.now() * 1e3 || 0;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function getPartyInfo(partySocketOptions, defaultProtocol, defaultParams = {}) {
  const {
    host: rawHost,
    path: rawPath,
    protocol: rawProtocol,
    room,
    party,
    basePath,
    prefix,
    query
  } = partySocketOptions;
  let host = rawHost.replace(/^(http|https|ws|wss):\/\//, "");
  if (host.endsWith("/")) host = host.slice(0, -1);
  if (rawPath?.startsWith("/"))
    throw new Error("path must not start with a slash");
  const name = party ?? "main";
  const path = rawPath ? `/${rawPath}` : "";
  const protocol = rawProtocol || (host.startsWith("localhost:") || host.startsWith("127.0.0.1:") || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.") && host.split(".")[1] >= "16" && host.split(".")[1] <= "31" || host.startsWith("[::ffff:7f00:1]:") ? defaultProtocol : `${defaultProtocol}s`);
  const baseUrl = `${protocol}://${host}/${basePath || `${prefix || "parties"}/${name}/${room}`}${path}`;
  const makeUrl = (query2 = {}) => `${baseUrl}?${new URLSearchParams([...Object.entries(defaultParams), ...Object.entries(query2).filter(valueIsNotNil)])}`;
  const urlProvider = typeof query === "function" ? async () => makeUrl(await query()) : makeUrl(query);
  return {
    host,
    path,
    room,
    name,
    protocol,
    partyUrl: baseUrl,
    urlProvider
  };
}
var PartySocket = class extends ReconnectingWebSocket {
  _pk;
  _pkurl;
  name;
  room;
  host;
  path;
  basePath;
  constructor(partySocketOptions) {
    const wsOptions = getWSOptions(partySocketOptions);
    super(wsOptions.urlProvider, wsOptions.protocols, wsOptions.socketOptions);
    this.partySocketOptions = partySocketOptions;
    this.setWSProperties(wsOptions);
    if (!partySocketOptions.startClosed && !this.room && !this.basePath) {
      this.close();
      throw new Error(
        "Either room or basePath must be provided to connect. Use startClosed: true to create a socket and set them via updateProperties before calling reconnect()."
      );
    }
    if (!partySocketOptions.disableNameValidation) {
      if (partySocketOptions.party?.includes("/"))
        console.warn(
          `PartySocket: party name "${partySocketOptions.party}" contains forward slash which may cause routing issues. Consider using a name without forward slashes or set disableNameValidation: true to bypass this warning.`
        );
      if (partySocketOptions.room?.includes("/"))
        console.warn(
          `PartySocket: room name "${partySocketOptions.room}" contains forward slash which may cause routing issues. Consider using a name without forward slashes or set disableNameValidation: true to bypass this warning.`
        );
    }
  }
  updateProperties(partySocketOptions) {
    const wsOptions = getWSOptions({
      ...this.partySocketOptions,
      ...partySocketOptions,
      host: partySocketOptions.host ?? this.host,
      room: partySocketOptions.room ?? this.room,
      path: partySocketOptions.path ?? this.path,
      basePath: partySocketOptions.basePath ?? this.basePath
    });
    this._url = wsOptions.urlProvider;
    this._protocols = wsOptions.protocols;
    this._options = wsOptions.socketOptions;
    this.setWSProperties(wsOptions);
  }
  setWSProperties(wsOptions) {
    const { _pk, _pkurl, name, room, host, path, basePath } = wsOptions;
    this._pk = _pk;
    this._pkurl = _pkurl;
    this.name = name;
    this.room = room;
    this.host = host;
    this.path = path;
    this.basePath = basePath;
  }
  reconnect(code, reason) {
    if (!this.host)
      throw new Error(
        "The host must be set before connecting, use `updateProperties` method to set it or pass it to the constructor."
      );
    if (!this.room && !this.basePath)
      throw new Error(
        "The room (or basePath) must be set before connecting, use `updateProperties` method to set it or pass it to the constructor."
      );
    super.reconnect(code, reason);
  }
  get id() {
    return this._pk;
  }
  /**
   * Exposes the static PartyKit room URL without applying query parameters.
   * To access the currently connected WebSocket url, use PartySocket#url.
   */
  get roomUrl() {
    return this._pkurl;
  }
  static async fetch(options, init) {
    const party = getPartyInfo(options, "http");
    const url = typeof party.urlProvider === "string" ? party.urlProvider : await party.urlProvider();
    return (options.fetch ?? fetch)(url, init);
  }
};
function getWSOptions(partySocketOptions) {
  const {
    id,
    host: _host,
    path: _path,
    party: _party,
    room: _room,
    protocol: _protocol,
    query: _query,
    protocols,
    ...socketOptions
  } = partySocketOptions;
  const _pk = id || generateUUID();
  const party = getPartyInfo(partySocketOptions, "ws", { _pk });
  return {
    _pk,
    _pkurl: party.partyUrl,
    name: party.name,
    room: party.room,
    host: party.host,
    path: party.path,
    basePath: partySocketOptions.basePath,
    protocols,
    socketOptions,
    urlProvider: party.urlProvider
  };
}

// ../../packages/client/dist/transport.js
var NO_RETRY_CLOSE_CODES = /* @__PURE__ */ new Set([4001, 4002, 4003, 4004]);
function shouldReconnectAfterClose(code) {
  return code === void 0 || !NO_RETRY_CLOSE_CODES.has(code);
}
function reconnectDelay(attempt, opts = {}) {
  const base = opts.baseDelayMs ?? 500;
  const max = opts.maxDelayMs ?? 8e3;
  const jitter = opts.jitter ?? 0.5;
  const random = opts.random ?? Math.random;
  const exp = Math.min(max, base * 2 ** (Math.max(1, attempt) - 1));
  return exp + exp * jitter * random();
}
function installReconnectJitter(socket, reconnect = {}) {
  const internals = socket;
  if (typeof internals._getNextDelay !== "function")
    return false;
  internals._getNextDelay = () => {
    const attempt = internals._retryCount ?? 0;
    return attempt > 0 ? reconnectDelay(attempt, reconnect) : 0;
  };
  return true;
}
var createPartySocketTransport = (opts) => {
  const reconnect = opts.reconnect ?? {};
  const socket = new PartySocket({
    host: opts.host,
    room: opts.room,
    party: opts.party,
    query: opts.query,
    WebSocket: opts.WebSocketPolyfill,
    // Exponential backoff caps the reconnect rate so failed connects don't hammer
    // an overloaded room (the deployed connection-storm failure). Retries are
    // bounded, and 4001–4004 stop reconnection entirely (below).
    minReconnectionDelay: reconnect.baseDelayMs ?? 500,
    maxReconnectionDelay: reconnect.maxDelayMs ?? 8e3,
    reconnectionDelayGrowFactor: 2,
    maxRetries: reconnect.maxRetries ?? 5,
    shouldReconnectOnClose: (e) => shouldReconnectAfterClose(e.code)
  });
  socket.binaryType = "arraybuffer";
  installReconnectJitter(socket, reconnect);
  return {
    send: (data) => socket.send(data),
    close: () => socket.close(),
    onMessage: (cb) => socket.addEventListener("message", (e) => cb(e.data)),
    onOpen: (cb) => socket.addEventListener("open", () => cb()),
    onClose: (cb) => socket.addEventListener("close", () => cb()),
    onError: (cb) => socket.addEventListener("error", (e) => cb(e))
  };
};

// ../../packages/client/dist/clock.js
function median(values) {
  if (values.length === 0)
    return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
var ClockSync = class {
  /** Estimated (serverClock - clientClock) in ms; 0 until the first reply. */
  offsetMs = 0;
  /** Estimated round-trip time in ms; 0 until the first reply. */
  rttMs = 0;
  send;
  now;
  burst;
  spacingMs;
  intervalMs;
  maxSamples;
  samples = [];
  interval = null;
  burstTimers = [];
  constructor(opts) {
    this.send = opts.send;
    this.now = opts.now ?? (() => Date.now());
    this.burst = opts.burst ?? 5;
    this.spacingMs = opts.spacingMs ?? 100;
    this.intervalMs = opts.intervalMs ?? 15e3;
    this.maxSamples = opts.maxSamples ?? 20;
  }
  /** The server's estimated current time (epoch ms). */
  serverNow() {
    return this.now() + this.offsetMs;
  }
  /** Send one clock-sync ping now. */
  ping() {
    this.send(this.now());
  }
  /** Feed a `s:time` reply: `t0` echoed from the ping, `serverTime` the server clock. */
  accept(t0, serverTime) {
    const t1 = this.now();
    const rtt = Math.max(0, t1 - t0);
    const offset = serverTime + rtt / 2 - t1;
    this.samples.push({ offset, rtt });
    while (this.samples.length > this.maxSamples)
      this.samples.shift();
    this.rttMs = median(this.samples.map((s) => s.rtt));
    const byRtt = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    const best = byRtt.slice(0, Math.min(byRtt.length, Math.max(3, Math.ceil(byRtt.length / 3))));
    this.offsetMs = median(best.map((s) => s.offset));
  }
  /** Begin syncing: a quick burst for a fast initial estimate, then periodic resync. */
  start() {
    this.stop();
    for (let i = 0; i < this.burst; i++) {
      this.burstTimers.push(setTimeout(() => this.ping(), i * this.spacingMs));
    }
    this.interval = setInterval(() => this.ping(), this.intervalMs);
  }
  /** Stop syncing and clear timers. */
  stop() {
    for (const timer of this.burstTimers)
      clearTimeout(timer);
    this.burstTimers.length = 0;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
};

// ../../packages/client/dist/net-conditions.js
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function withNetworkConditions(inner, conditions) {
  const latency = Math.max(0, conditions.latencyMs ?? 0);
  const jitter = Math.max(0, conditions.jitterMs ?? 0);
  const loss = Math.min(1, Math.max(0, conditions.lossRate ?? 0));
  const lossyOnly = conditions.lossyOnly ?? true;
  const rand = mulberry32(conditions.seed ?? 1);
  const delay = () => jitter > 0 ? Math.max(0, latency + (rand() * 2 - 1) * jitter) : latency;
  const inboundCbs = [];
  inner.onMessage((raw) => {
    const isBinary = typeof raw !== "string";
    const eligible = lossyOnly ? isBinary : true;
    if (loss > 0 && eligible && rand() < loss)
      return;
    const d = delay();
    if (d <= 0) {
      for (const cb of inboundCbs)
        cb(raw);
    } else {
      setTimeout(() => {
        for (const cb of inboundCbs)
          cb(raw);
      }, d);
    }
  });
  return {
    send: (data) => {
      const d = delay();
      if (d <= 0)
        inner.send(data);
      else
        setTimeout(() => inner.send(data), d);
    },
    close: () => inner.close(),
    onMessage: (cb) => {
      inboundCbs.push(cb);
    },
    onOpen: (cb) => inner.onOpen(cb),
    onClose: (cb) => inner.onClose(cb),
    onError: (cb) => inner.onError(cb)
  };
}

// ../../packages/client/dist/netcode.js
var InputPredictor = class {
  predicted;
  pending = [];
  applyFn;
  cloneFn;
  constructor(initial, opts) {
    this.predicted = initial;
    this.applyFn = opts.apply;
    this.cloneFn = opts.clone ?? ((s) => structuredClone(s));
  }
  /** Apply an input locally for immediate feedback and buffer it until acked. */
  predict(seq2, input) {
    this.pending.push({ seq: seq2, input });
    this.predicted = this.applyFn(this.predicted, input);
    return this.predicted;
  }
  /** Reconcile against authoritative state: drop acked inputs, replay the rest. */
  reconcile(authoritative, ackSeq) {
    this.pending = this.pending.filter((p) => p.seq > ackSeq);
    let s = this.cloneFn(authoritative);
    for (const p of this.pending)
      s = this.applyFn(s, p.input);
    this.predicted = s;
    return s;
  }
  get pendingCount() {
    return this.pending.length;
  }
};
var SnapshotBuffer = class {
  buf = [];
  delayMs;
  lerp;
  maxSnapshots;
  maxExtrapolationMs;
  adaptive;
  /** EMA of the interval between pushed snapshot times (the send cadence). */
  emaIntervalMs = null;
  lastPushTime = null;
  /** Smallest `newest.time − target` seen this observation window. */
  windowMinMargin = Infinity;
  windowStartedAt = null;
  constructor(opts) {
    this.delayMs = opts.delayMs ?? 100;
    this.lerp = opts.lerp;
    this.maxSnapshots = opts.maxSnapshots ?? 64;
    this.maxExtrapolationMs = opts.maxExtrapolationMs ?? 0;
    this.adaptive = opts.adaptiveDelay ? {
      minMs: opts.adaptiveDelay.minMs,
      maxMs: opts.adaptiveDelay.maxMs,
      headroomMs: opts.adaptiveDelay.headroomMs ?? 10,
      slewDownMsPerSec: opts.adaptiveDelay.slewDownMsPerSec ?? 10,
      windowMs: opts.adaptiveDelay.windowMs ?? 3e3
    } : null;
    if (this.adaptive) {
      this.delayMs = Math.min(this.adaptive.maxMs, Math.max(this.adaptive.minMs, this.delayMs));
    }
  }
  /** The delay currently applied by {@link sample} (changes only when adaptive). */
  get currentDelayMs() {
    return this.delayMs;
  }
  push(time, state) {
    if (this.lastPushTime !== null) {
      const interval = time - this.lastPushTime;
      if (interval > 0 && interval <= 1e3) {
        this.emaIntervalMs = this.emaIntervalMs === null ? interval : this.emaIntervalMs * 0.9 + interval * 0.1;
      }
    }
    this.lastPushTime = Math.max(this.lastPushTime ?? time, time);
    this.buf.push({ time, state });
    this.buf.sort((a, b) => a.time - b.time);
    while (this.buf.length > this.maxSnapshots)
      this.buf.shift();
  }
  /** Sample the interpolated state for render time `now` (accounting for delay). */
  sample(now) {
    if (this.buf.length === 0)
      return void 0;
    const target = now - this.delayMs;
    const first = this.buf[0];
    const last = this.buf[this.buf.length - 1];
    if (this.adaptive)
      this.adapt(now, last.time - target);
    if (target <= first.time)
      return first.state;
    if (target >= last.time) {
      if (this.maxExtrapolationMs > 0 && this.buf.length >= 2) {
        const a = this.buf[this.buf.length - 2];
        const span = last.time - a.time;
        if (span > 0) {
          const over = Math.min(target - last.time, this.maxExtrapolationMs);
          return this.lerp(a.state, last.state, 1 + over / span);
        }
      }
      return last.state;
    }
    for (let i = 0; i < this.buf.length - 1; i++) {
      const a = this.buf[i];
      const b = this.buf[i + 1];
      if (target >= a.time && target <= b.time) {
        const span = b.time - a.time;
        const t = span === 0 ? 0 : (target - a.time) / span;
        return this.lerp(a.state, b.state, t);
      }
    }
    return last.state;
  }
  /**
   * Feedback controller for the adaptive delay. `margin` is how far the newest
   * snapshot leads the render target: negative = starved (raise the delay
   * immediately by the shortfall plus a nudge), comfortably positive across a
   * whole window = shrink one slow step. Uses the same `now` timeline as
   * {@link sample}, so it needs no extra clock.
   */
  adapt(now, margin) {
    const a = this.adaptive;
    if (margin < 0) {
      this.delayMs = Math.min(a.maxMs, this.delayMs + -margin + 10);
      this.windowMinMargin = Infinity;
      this.windowStartedAt = now;
      return;
    }
    this.windowMinMargin = Math.min(this.windowMinMargin, margin);
    if (this.windowStartedAt === null) {
      this.windowStartedAt = now;
      return;
    }
    if (now - this.windowStartedAt < a.windowMs)
      return;
    const safeMargin = (this.emaIntervalMs ?? this.delayMs) + a.headroomMs;
    if (this.windowMinMargin > safeMargin) {
      const step = Math.min(a.slewDownMsPerSec * (a.windowMs / 1e3), this.windowMinMargin - safeMargin);
      this.delayMs = Math.max(a.minMs, this.delayMs - step);
    }
    this.windowMinMargin = Infinity;
    this.windowStartedAt = now;
  }
};

// ../../packages/sim/dist/geometry.js
function xorshift32(seed) {
  let s = seed >>> 0 || 2654435769;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s >>> 0;
  };
}
function obstacleContains(o, x, y) {
  const hw = o.w / 2;
  const hh = o.h / 2;
  return x >= o.x - hw && x <= o.x + hw && y >= o.y - hh && y <= o.y + hh;
}
function rayObstacleHit(obstacles2, ox, oy, dx, dy, maxT, skip) {
  let best = Infinity;
  let bestIndex = -1;
  for (let i = 0; i < obstacles2.length; i++) {
    if (skip?.(i))
      continue;
    const o = obstacles2[i];
    if (obstacleContains(o, ox, oy))
      continue;
    const hw = o.w / 2;
    const hh = o.h / 2;
    let tMin = 0;
    let tMax = maxT;
    let ok = true;
    for (const [p, d, lo, hi] of [
      [ox, dx, o.x - hw, o.x + hw],
      [oy, dy, o.y - hh, o.y + hh]
    ]) {
      if (d === 0) {
        if (p < lo || p > hi) {
          ok = false;
          break;
        }
        continue;
      }
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2)
        [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) {
        ok = false;
        break;
      }
    }
    if (ok && tMin < best && tMin > 0) {
      best = tMin;
      bestIndex = i;
    }
  }
  return bestIndex >= 0 ? { t: best, index: bestIndex } : null;
}
function pushOutOfObstacles(pos, r, obstacles2, skip) {
  let { x, y } = pos;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < obstacles2.length; i++) {
      if (skip?.(i))
        continue;
      const o = obstacles2[i];
      const hw = o.w / 2;
      const hh = o.h / 2;
      const cx = Math.max(o.x - hw, Math.min(o.x + hw, x));
      const cy = Math.max(o.y - hh, Math.min(o.y + hh, y));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r)
        continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + dx / d * r;
        y = cy + dy / d * r;
      } else {
        const left = x - (o.x - hw);
        const right = o.x + hw - x;
        const top = y - (o.y - hh);
        const bottom = o.y + hh - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left)
          x = o.x - hw - r;
        else if (m === right)
          x = o.x + hw + r;
        else if (m === top)
          y = o.y - hh - r;
        else
          y = o.y + hh + r;
      }
    }
  }
  return { x, y };
}

// ../../packages/sim/dist/index.js
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function integrateMove(pos, dirX, dirY, dtMs, maxSpeed, world, maxDtMs) {
  const dt = Math.min(Math.max(dtMs, 0), maxDtMs) / 1e3;
  const len = Math.hypot(dirX, dirY);
  if (len === 0 || dt === 0)
    return { x: pos.x, y: pos.y };
  const step = maxSpeed * dt;
  return {
    x: clamp(pos.x + dirX / len * step, 0, world),
    y: clamp(pos.y + dirY / len * step, 0, world)
  };
}
function clampToBudget(lastSent, next, profile, elapsedMs) {
  if (!lastSent)
    return { x: next.x, y: next.y };
  const dt = clamp(elapsedMs, 0, profile.stepMs * 2);
  const headroom = Math.min(profile.sendHeadroom ?? 1.1, profile.tolerance ?? 1.15);
  return stepToward(lastSent, next, profile.maxSpeed * headroom, dt);
}
function stepToward(pos, target, maxSpeed, dtMs) {
  const maxDist = Math.max(0, maxSpeed * dtMs / 1e3);
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxDist || dist === 0)
    return { x: target.x, y: target.y };
  const scale = maxDist / dist;
  return { x: pos.x + dx * scale, y: pos.y + dy * scale };
}

// ../../packages/client/dist/render.js
function decayOffset(offset, dtMs, tauMs) {
  if (tauMs <= 0 || dtMs <= 0)
    return { x: 0, y: 0 };
  const k = Math.exp(-dtMs / tauMs);
  return { x: offset.x * k, y: offset.y * k };
}
function applyCorrection(continuous, offset, authoritative, snap) {
  const ex = authoritative.x - continuous.x;
  const ey = authoritative.y - continuous.y;
  if (Math.hypot(ex, ey) >= snap) {
    return { continuous: { x: authoritative.x, y: authoritative.y }, offset: { x: 0, y: 0 } };
  }
  return {
    continuous: { x: authoritative.x, y: authoritative.y },
    offset: {
      x: continuous.x + offset.x - authoritative.x,
      y: continuous.y + offset.y - authoritative.y
    }
  };
}
function smoothAxis(current, target, dtMs, smoothTimeMs, snap) {
  const gap = target - current;
  if (Math.abs(gap) >= snap)
    return target;
  if (dtMs <= 0 || smoothTimeMs <= 0)
    return target;
  const alpha = 1 - Math.exp(-dtMs / smoothTimeMs);
  return current + gap * alpha;
}
function smoothAngle(current, target, dtMs, smoothTimeMs, snap) {
  const twoPi = Math.PI * 2;
  let delta = (target - current) % twoPi;
  if (delta > Math.PI)
    delta -= twoPi;
  else if (delta < -Math.PI)
    delta += twoPi;
  if (Math.abs(delta) >= snap)
    return target;
  if (dtMs <= 0 || smoothTimeMs <= 0)
    return target;
  const alpha = 1 - Math.exp(-dtMs / smoothTimeMs);
  return current + delta * alpha;
}
var RenderPredictor = class _RenderPredictor {
  continuous;
  offset = { x: 0, y: 0 };
  lastRender;
  /** The last snapshot actually sent; `null` forces the next send to pass through
   *  unclamped (first send, or right after a teleport/respawn snap). */
  lastSent = null;
  /** Clock ms of the last send — the elapsed-time reference for the next send's budget. */
  lastSentAtMs = null;
  /** False until the first {@link reconcile}: the constructor position is only a
   *  placeholder and the first authoritative frame must be adopted unconditionally. */
  seeded = false;
  /** Set by the `alive` setter on a dead→alive transition; the next {@link reconcile}
   *  snaps (respawn may land within `snapDistance` of the corpse). */
  respawnSnapPending = false;
  aliveFlag = true;
  maxSpeed;
  stepMs;
  world;
  maxFrameMs;
  correctionTauMs;
  snapDistance;
  sendProfile;
  constrain;
  constructor(initial, opts) {
    this.continuous = { x: initial.x, y: initial.y };
    this.lastRender = { x: initial.x, y: initial.y };
    this.maxSpeed = opts.maxSpeed;
    this.stepMs = opts.stepMs;
    this.world = opts.world ?? Infinity;
    this.maxFrameMs = opts.maxFrameMs ?? opts.stepMs;
    this.correctionTauMs = opts.correctionTauMs ?? 100;
    this.snapDistance = opts.snapDistance ?? 300;
    this.constrain = opts.constrain ?? null;
    this.sendProfile = {
      maxSpeed: opts.maxSpeed,
      stepMs: opts.stepMs,
      ...opts.world !== void 0 ? { world: opts.world } : {},
      ...opts.sendHeadroom !== void 0 ? { sendHeadroom: opts.sendHeadroom } : {}
    };
  }
  /**
   * Build a predictor from the {@link MotionProfile} the room validates with — the
   * recommended entry point, because it makes "one budget, two sides" structural:
   * pass the SAME shared profile constant to the server's `resolveMovement` and here.
   */
  static fromProfile(initial, profile, opts = {}) {
    return new _RenderPredictor(initial, {
      maxSpeed: profile.maxSpeed,
      stepMs: profile.stepMs,
      ...profile.world !== void 0 ? { world: profile.world } : {},
      ...profile.sendHeadroom !== void 0 ? { sendHeadroom: profile.sendHeadroom } : {},
      ...opts
    });
  }
  /**
   * Authoritative liveness gate. While `false`, {@link frame} skips integration so a
   * dead player holding a key doesn't dead-reckon away from the server's position.
   * Setting it back to `true` (a respawn) arms the next {@link reconcile} to snap to
   * the spawn point unconditionally — a respawn may land within `snapDistance` of the
   * corpse, and without the snap the send loop would keep transmitting the corpse
   * position and drag the fresh spawn back toward the firefight.
   */
  get alive() {
    return this.aliveFlag;
  }
  set alive(v) {
    if (v && !this.aliveFlag)
      this.respawnSnapPending = true;
    this.aliveFlag = v;
  }
  /**
   * Advance one render frame: integrate the held direction (when {@link alive}) and
   * decay the correction offset, then return the render position
   * (`continuous + offset`). Call once per frame with the real frame dt; the dt is
   * clamped to `maxFrameMs` internally. Bind the camera to the returned position 1:1
   * — extra camera easing on top only adds a trail and input lag (the position is
   * already smooth by construction).
   */
  frame(dirX, dirY, dtMs) {
    if (this.aliveFlag) {
      this.continuous = integrateMove(this.continuous, dirX, dirY, dtMs, this.maxSpeed, this.world, this.maxFrameMs);
      if (this.constrain)
        this.continuous = this.constrain(this.continuous);
    }
    this.offset = decayOffset(this.offset, dtMs, this.correctionTauMs);
    this.lastRender = {
      x: this.continuous.x + this.offset.x,
      y: this.continuous.y + this.offset.y
    };
    return { x: this.lastRender.x, y: this.lastRender.y };
  }
  /**
   * Fold an explicit server correction (e.g. a `rejected` reply) into the view: the
   * error is absorbed by the decaying offset so the render eases onto the
   * authoritative path (a gap ≥ `snapDistance` cuts straight instead), AND `lastSent`
   * is rebased onto the authoritative position — the server's truth is now the
   * reference the next send is budgeted from, so one correction can never cascade
   * into a rejection storm.
   */
  correct(authoritative) {
    const applied = applyCorrection(this.continuous, this.offset, authoritative, this.snapDistance);
    this.continuous = applied.continuous;
    this.offset = applied.offset;
    this.lastSent = { x: authoritative.x, y: authoritative.y };
  }
  /**
   * Observe the local player's echo in an authoritative state frame. Movement is
   * client-authoritative here (the server echoes the clamped sent position), so a
   * small gap is just send/RTT lag and is deliberately ignored. It snaps — adopting
   * the position, clearing the offset, and resetting the send reference so the next
   * send passes through — only when `continuous` is known-stale: the first frame ever
   * (the constructor position is a placeholder), a respawn (armed by the
   * {@link alive} setter), or a gap ≥ `snapDistance` (a genuine teleport).
   */
  reconcile(authoritative) {
    const gap = Math.hypot(authoritative.x - this.continuous.x, authoritative.y - this.continuous.y);
    if (!this.seeded || this.respawnSnapPending || gap >= this.snapDistance) {
      this.seeded = true;
      this.respawnSnapPending = false;
      this.continuous = { x: authoritative.x, y: authoritative.y };
      this.offset = { x: 0, y: 0 };
      this.lastSent = null;
      this.lastRender = { x: this.continuous.x, y: this.continuous.y };
    }
  }
  /**
   * Produce the position snapshot for the send loop — the SINGLE point every outgoing
   * position must pass through. Clamps `continuous` to the server's speed budget
   * measured from the last sent position over the real elapsed time since the last
   * send (`nowMs − lastSendNowMs`, capped at two ticks), then records the result as
   * the new reference. Send exactly this value (and feed it to any
   * {@link InputPredictor}) — sending anything else reopens the rubber-band path.
   *
   * `nowMs` must be a consistent clock across calls; use `room.clock.serverNow()`,
   * the same clock the SDK stamps into the input `ts`, so the client's budget and the
   * server's measured inter-move delta agree.
   */
  sendPosition(nowMs) {
    const elapsedMs = this.lastSentAtMs === null ? this.stepMs : nowMs - this.lastSentAtMs;
    const sent = clampToBudget(this.lastSent, { x: this.continuous.x, y: this.continuous.y }, this.sendProfile, elapsedMs);
    this.lastSent = sent;
    this.lastSentAtMs = nowMs;
    return { x: sent.x, y: sent.y };
  }
  /**
   * Force-place the predictor (an explicit, client-initiated teleport/respawn):
   * adopts `pos`, clears the correction offset, and resets the send reference so the
   * next send passes through unclamped.
   */
  reset(pos) {
    this.continuous = { x: pos.x, y: pos.y };
    this.offset = { x: 0, y: 0 };
    this.lastRender = { x: pos.x, y: pos.y };
    this.lastSent = null;
    this.lastSentAtMs = null;
    this.seeded = true;
    this.respawnSnapPending = false;
  }
  /** The render position computed by the most recent {@link frame} (or snap). */
  get renderPosition() {
    return { x: this.lastRender.x, y: this.lastRender.y };
  }
};
var EntitySmoother = class {
  entities = /* @__PURE__ */ new Map();
  smoothTimeMs;
  snapDistance;
  angleSnap;
  constructor(opts = {}) {
    this.smoothTimeMs = opts.smoothTimeMs ?? 100;
    this.snapDistance = opts.snapDistance ?? 300;
    this.angleSnap = opts.angleSnap ?? Math.PI;
  }
  /**
   * Ease entity `id` toward its buffered `target` for this frame and return the
   * smoothed render pose. Call once per entity per frame with the frame dt. A
   * first-seen id adopts the target exactly; a missing `target.angle` holds the last
   * smoothed angle (0 when never seen).
   */
  update(id, target, dtMs) {
    const prev = this.entities.get(id);
    const targetAngle = target.angle ?? prev?.angle ?? 0;
    const next = prev ? {
      x: smoothAxis(prev.x, target.x, dtMs, this.smoothTimeMs, this.snapDistance),
      y: smoothAxis(prev.y, target.y, dtMs, this.smoothTimeMs, this.snapDistance),
      angle: smoothAngle(prev.angle, targetAngle, dtMs, this.smoothTimeMs, this.angleSnap)
    } : { x: target.x, y: target.y, angle: targetAngle };
    this.entities.set(id, next);
    return { x: next.x, y: next.y, angle: next.angle };
  }
  /** Forget every entity NOT in `seen` (the ids updated this frame) — so an AOI
   *  re-entry snaps in fresh instead of gliding from a stale position. */
  prune(seen) {
    for (const id of [...this.entities.keys()]) {
      if (!seen.has(id))
        this.entities.delete(id);
    }
  }
  /** Forget one entity (it will snap on its next update). */
  delete(id) {
    this.entities.delete(id);
  }
  /** Forget everything (e.g. on leaving a room). */
  clear() {
    this.entities.clear();
  }
};

// ../../packages/client/dist/index.js
var networkConditionsWarned = false;
var subtickClockWarned = false;
var RoomJoinError = class extends Error {
  /** See the class doc: a handshake code, a pre-Welcome Error code, or `"connection-closed"`. */
  code;
  constructor(code, message) {
    super(message ?? `room join failed: ${code}`);
    this.name = "RoomJoinError";
    this.code = code;
  }
};
var Room = class {
  connectionId = null;
  name;
  /** Latest authoritative state from the server (undefined until first sync). */
  state = void 0;
  /** Last input seq the server has acknowledged (0 until the first ack). */
  lastAckSeq = 0;
  /** Simulation tick of the most recent authoritative state (0 until first sync). */
  lastStateTick = 0;
  /** Server time (epoch ms) stamped on the most recent state, or null if absent. */
  lastStateServerTime = null;
  /**
   * Clock synchronization against the server. `clock.serverNow()` places snapshots
   * on the server's timeline for jitter-free interpolation; `clock.offsetMs` /
   * `clock.rttMs` expose the estimates. Runs automatically unless disabled.
   */
  clock;
  transport;
  rawHandlers = /* @__PURE__ */ new Set();
  typeHandlers = /* @__PURE__ */ new Map();
  stateHandlers = /* @__PURE__ */ new Set();
  ackHandlers = /* @__PURE__ */ new Set();
  welcome;
  /** True once the welcome promise has settled (resolved on Welcome or rejected). */
  welcomeSettled = false;
  /** A server Error frame seen BEFORE Welcome, surfaced in a join rejection. */
  preWelcomeError = null;
  /** Reject side of {@link welcome}; wired in the constructor. */
  failWelcome = () => {
  };
  stateCodec;
  /** This client's own state-codec fingerprint, computed once (null if none/undescribable). */
  clientFingerprint;
  /** Guards the one-time "binary frame but no stateCodec" warning (per room). */
  noCodecWarned = false;
  /** Guards the one-time "binary state decode failed" error (per room). */
  decodeErrorWarned = false;
  clockEnabled;
  subtickTimestamps;
  inputBatchMs;
  /** Buffered developer messages awaiting the batch window flush (empty when off). */
  inputBatch = [];
  batchTimer = null;
  seq = 0;
  constructor(name, transport, stateCodec, opts = {}) {
    this.name = name;
    this.transport = transport;
    this.stateCodec = stateCodec;
    this.clientFingerprint = stateCodec ? schemaFingerprint(stateCodec) : null;
    this.clockEnabled = !opts.disableClockSync;
    this.subtickTimestamps = opts.subtickTimestamps ?? false;
    this.inputBatchMs = opts.inputBatchMs ?? 0;
    if (this.subtickTimestamps && !this.clockEnabled && !subtickClockWarned) {
      subtickClockWarned = true;
      console.warn("[@tikron/client] subtickTimestamps is on but clock sync is disabled \u2014 inputs will be stamped with the raw local clock and clamped by the server, which hurts lag compensation. Remove disableClockSync to get accurate subtick timing.");
    }
    this.clock = new ClockSync({
      // Include the current RTT estimate so the server can populate
      // `client.rttMs` (used by lag compensation / rewind on the room side).
      send: (t0) => this.transport.send(encode({
        t: ClientMessageType.Time,
        t0,
        ...this.clock && this.clock.rttMs > 0 ? { rtt: Math.round(this.clock.rttMs) } : {}
      }))
    });
    this.welcome = new Promise((resolve, reject) => {
      this.failWelcome = reject;
      const off = this.onMessage((msg) => {
        if (this.welcomeSettled)
          return;
        if (msg.t === ServerMessageType.Error) {
          this.preWelcomeError = msg;
        } else if (msg.t === ServerMessageType.Welcome) {
          this.welcomeSettled = true;
          off();
          const mismatch = this.validateHandshake(msg);
          if (mismatch !== null) {
            this.failWelcome(this.handshakeError(mismatch));
            this.clock.stop();
            this.transport.close();
            return;
          }
          this.connectionId = msg.connectionId;
          if (this.clockEnabled)
            this.clock.start();
          resolve(msg);
        }
      });
    });
    void this.welcome.catch(() => {
    });
    transport.onMessage((raw) => this.dispatch(raw));
    transport.onClose(() => this.failJoinIfPending());
    transport.onError((err) => this.failJoinIfPending(err));
  }
  /**
   * Reject the welcome/connected promise when the socket closes or errors before the
   * server's Welcome frame — otherwise joinOrCreate awaits connected() forever. The
   * rejection carries the code of any Error frame seen pre-Welcome (e.g. "room_full"),
   * else "connection-closed". No-op once the room has connected (a later close is
   * ordinary teardown, not a failed join).
   */
  failJoinIfPending(err) {
    if (this.welcomeSettled)
      return;
    this.welcomeSettled = true;
    const code = this.preWelcomeError?.code ?? "connection-closed";
    const message = this.preWelcomeError?.message ?? (err instanceof Error ? err.message : "connection closed before welcome");
    this.failWelcome(new RoomJoinError(code, message));
    this.clock.stop();
    this.transport.close();
  }
  /**
   * Check a Welcome frame for a protocol or state-schema incompatibility, returning the
   * mismatch (or null if compatible). Protocol is always checked; the schema is checked
   * only when this client has a codec AND the server advertised a fingerprint (a
   * pre-0.6 server omits it, so the check is skipped rather than false-firing) AND this
   * client's own codec is describable (`clientFingerprint !== null`).
   */
  validateHandshake(msg) {
    if (msg.protocol !== PROTOCOL_VERSION) {
      return { kind: "protocol_mismatch", server: msg.protocol, client: PROTOCOL_VERSION };
    }
    if (this.stateCodec && typeof msg.schema === "number" && this.clientFingerprint !== null) {
      if (msg.schema !== this.clientFingerprint) {
        return { kind: "schema_mismatch", server: msg.schema, client: this.clientFingerprint };
      }
    }
    return null;
  }
  /** The human/agent-actionable message for a handshake mismatch (names BOTH values). */
  handshakeMessage(m) {
    return m.kind === "protocol_mismatch" ? `Tikron PROTOCOL_VERSION mismatch: server=${m.server}, client=${m.client}. The wire protocol only guarantees compatibility within a minor \u2014 pin the SAME @tikron/* minor version on both the client and the server, then rebuild both.` : `Tikron state schema fingerprint mismatch: server=${m.server}, client=${m.client}. The server's stateCodec shape differs from the client's \u2014 rebuild and redeploy both sides so they import the IDENTICAL schema({...}) (same fields, same order, same types).`;
  }
  handshakeError(m) {
    return new RoomJoinError(m.kind, this.handshakeMessage(m));
  }
  /**
   * A live reconnect returned a Welcome that no longer matches this client — the server
   * was redeployed with an incompatible protocol/schema mid-session. The join promise is
   * long settled, so surface it loudly on the console (structured, actionable) and close
   * the socket. The close is client-initiated, so it trips PartySocket's `_closeCalled`
   * guard and does NOT reconnect — stopping the room before it decodes state it can no
   * longer read.
   */
  reportReconnectMismatch(m) {
    console.error(`[@tikron/client] room=${this.name} live reconnect rejected \u2014 ${this.handshakeMessage(m)} Closing the socket (no auto-retry) to stop decoding stale state.`);
    this.clock.stop();
    this.transport.close();
  }
  dispatch(raw) {
    if (typeof raw !== "string") {
      this.applyBinaryState(raw);
      return;
    }
    let msg;
    try {
      msg = decodeServerMessage(raw);
    } catch {
      return;
    }
    if (msg.t === ServerMessageType.Welcome) {
      if (this.welcomeSettled) {
        const mismatch = this.validateHandshake(msg);
        if (mismatch !== null) {
          this.reportReconnectMismatch(mismatch);
          return;
        }
      }
      this.connectionId = msg.connectionId;
    } else if (msg.t === ServerMessageType.State) {
      this.state = msg.state;
      if (typeof msg.tick === "number")
        this.lastStateTick = msg.tick;
      this.lastStateServerTime = typeof msg.serverTime === "number" ? msg.serverTime : null;
      for (const handler of this.stateHandlers)
        handler(msg.state);
    } else if (msg.t === ServerMessageType.Message) {
      const set = this.typeHandlers.get(msg.type);
      if (set)
        for (const handler of set)
          handler(msg.payload);
    } else if (msg.t === ServerMessageType.Ack) {
      this.lastAckSeq = msg.seq;
      for (const handler of this.ackHandlers)
        handler(msg.seq);
    } else if (msg.t === ServerMessageType.Time) {
      this.clock.accept(msg.t0, msg.serverTime);
    }
    for (const handler of this.rawHandlers)
      handler(msg);
  }
  applyBinaryState(raw) {
    if (!this.stateCodec) {
      if (!this.noCodecWarned) {
        this.noCodecWarned = true;
        console.warn(`[@tikron/client] room=${this.name} received a binary state frame but no stateCodec is configured, so authoritative state is being ignored. Pass the SAME codec the server uses, e.g. new GameClient(host, { stateCodec: YourState }).`);
      }
      return;
    }
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    if (bytes.length < 13)
      return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = bytes[0];
    const tick = view.getUint32(1, true);
    const serverTime = view.getFloat64(5, true);
    const body = bytes.subarray(13);
    let next;
    try {
      if (tag === 1)
        next = decodeFull(this.stateCodec, body);
      else if (tag === 2)
        next = applyDelta(this.stateCodec, this.state, body);
      else
        return;
    } catch (err) {
      if (!this.decodeErrorWarned) {
        this.decodeErrorWarned = true;
        console.error(`[@tikron/client] room=${this.name} failed to decode a binary state frame (tag=${tag}). This usually means the client's stateCodec shape does not match the server's \u2014 rebuild both sides with the identical schema({...}) \u2014 or the frame was corrupted. Keeping the last good state and dropping this frame.`, err);
      }
      return;
    }
    this.state = next;
    this.lastStateTick = tick;
    this.lastStateServerTime = serverTime;
    for (const handler of this.stateHandlers)
      handler(this.state);
  }
  onMessage(a, b) {
    if (typeof a === "string") {
      const handler = b;
      const set = this.typeHandlers.get(a) ?? /* @__PURE__ */ new Set();
      set.add(handler);
      this.typeHandlers.set(a, set);
      return () => {
        set.delete(handler);
      };
    }
    this.rawHandlers.add(a);
    return () => {
      this.rawHandlers.delete(a);
    };
  }
  /** Subscribe to authoritative state updates. */
  onStateChange(handler) {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }
  /** Subscribe to input acknowledgements (the last input seq the server processed). */
  onAck(handler) {
    this.ackHandlers.add(handler);
    return () => {
      this.ackHandlers.delete(handler);
    };
  }
  /** Resolves once the server has sent its Welcome frame. */
  connected() {
    return this.welcome;
  }
  /** Send a developer-defined message (intent) with an auto-incrementing seq. */
  send(type, payload) {
    const msg = { t: ClientMessageType.Message, type, seq: ++this.seq, payload };
    if (this.subtickTimestamps)
      msg.ts = Math.round(this.clock.serverNow());
    if (this.inputBatchMs <= 0) {
      this.transport.send(encode(msg));
      return;
    }
    this.inputBatch.push(msg);
    if (this.batchTimer === null) {
      this.batchTimer = setTimeout(() => this.flushInput(), this.inputBatchMs);
    }
  }
  /**
   * Flush any buffered batched inputs now. A single buffered input ships as a plain
   * `c:msg` (no batch overhead, and old servers still understand it); two or more
   * ship as one `c:mbatch` frame. Called on the batch timer and on {@link leave}.
   */
  flushInput() {
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.inputBatch.length === 0)
      return;
    if (this.inputBatch.length === 1) {
      this.transport.send(encode(this.inputBatch[0]));
    } else {
      this.transport.send(encode({ t: ClientMessageType.MessageBatch, msgs: [...this.inputBatch] }));
    }
    this.inputBatch.length = 0;
  }
  sendRaw(message) {
    this.transport.send(encode(message));
  }
  hello(name) {
    this.sendRaw({ t: ClientMessageType.Hello, name });
  }
  echo(text) {
    this.sendRaw({ t: ClientMessageType.Echo, text });
  }
  broadcastText(text) {
    this.sendRaw({ t: ClientMessageType.Broadcast, text });
  }
  leave() {
    this.flushInput();
    this.clock.stop();
    this.transport.close();
  }
};
var GameClient = class {
  host;
  options;
  party;
  constructor(host, options = {}) {
    this.host = host;
    this.options = options;
    this.party = options.party ?? "game-room";
  }
  /**
   * Ask the matchmaker for a room of this client's party (type), optionally
   * filtered by `mode` and placed near a `region` (Cloudflare location hint:
   * wnam, enam, weur, eeur, apac, oc, afr, me — applies only when a NEW room is
   * created). Returns the room id, a reserved session id, and the room's region
   * (echoed back). Pass the region into `joinOrCreate` params so first contact
   * carries the placement hint:
   * `client.joinOrCreate(m.roomId, { _session: m.sessionId, ...(m.region ? { region: m.region } : {}) })`
   * (Browser-oriented: uses a same-origin `/api/matchmake` request.)
   */
  async matchmake(opts = {}) {
    const query = new URLSearchParams({
      type: opts.type ?? this.party,
      mode: opts.mode ?? "",
      max: String(opts.maxClients ?? 8)
    });
    if (opts.region)
      query.set("region", opts.region);
    const res = await fetch(`/api/matchmake?${query.toString()}`);
    if (!res.ok)
      throw new Error(`matchmake failed: HTTP ${res.status}`);
    return await res.json();
  }
  /**
   * Join a room by name (creating it on first join) by opening a connection to the
   * room's Durable Object. To let the platform pick and reserve a room, call
   * {@link matchmake} first and pass its `roomId`/`sessionId` here.
   */
  async joinOrCreate(room, params = {}) {
    const query = { ...params };
    if (this.options.apiKey)
      query.apiKey = this.options.apiKey;
    if (this.options.authToken)
      query._auth = this.options.authToken;
    const factory = this.options.createTransport ?? createPartySocketTransport;
    let transport = factory({
      host: this.host,
      room,
      party: this.party,
      query,
      WebSocketPolyfill: this.options.WebSocketPolyfill,
      reconnect: this.options.reconnect
    });
    if (this.options.networkConditions) {
      transport = withNetworkConditions(transport, this.options.networkConditions);
      if (!networkConditionsWarned) {
        networkConditionsWarned = true;
        console.warn("[@tikron/client] networkConditions is active \u2014 simulating a degraded network. Remove it for production.");
      }
    }
    const roomHandle = new Room(room, transport, this.options.stateCodec, {
      disableClockSync: this.options.disableClockSync,
      subtickTimestamps: this.options.subtickTimestamps,
      inputBatchMs: this.options.inputBatchMs
    });
    await roomHandle.connected();
    return roomHandle;
  }
};

// src/rooms/shooter-schema.ts
var ShooterSchema = schema({
  players: mapOf(
    schema({
      x: quant(0, 3e3, 0.1),
      y: quant(0, 3e3, 0.1),
      aim: quant(0, Math.PI * 2, 1e-3),
      hp: "u8",
      score: "u32",
      alive: "bool",
      w: "u8",
      sp: "bool",
      db: "bool"
    })
  ),
  seed: "u32",
  pickups: mapOf(schema({ on: "bool" })),
  broken: mapOf(schema({ b: "bool" })),
  zx: quant(0, 3e3, 0.5),
  zy: quant(0, 3e3, 0.5),
  zr: quant(0, 4500, 0.5),
  roundEndMs: "f64"
});
var WEAPONS = [
  // RIFLE: 20-round mag, ~1.5 s reload. SHOTGUN: 4× damage (16→64/ray), 5-shell
  // mag, ~2 s reload. SMG: 40-round mag, faster fire (55→40 ms cooldown), ~2 s reload.
  { name: "RIFLE", damage: 34, range: 850, cooldownMs: 100, rays: 1, spread: 0, mag: 20, reloadMs: 1500 },
  { name: "SHOTGUN", damage: 64, range: 300, cooldownMs: 600, rays: 3, spread: 0.24, mag: 5, reloadMs: 2e3 },
  { name: "SMG", damage: 14, range: 650, cooldownMs: 40, rays: 1, spread: 0, mag: 40, reloadMs: 2e3 }
];
var SHOOTER = {
  // A 3000² map (up from 2000²) so 64 players spread out: at the spawn min-
  // separation (300u) a 2000² map is right at its packing limit for 64 points,
  // while 3000² leaves comfortable headroom. Keep the quant position range above
  // in lock-step with this.
  world: 3e3,
  /** AOI view radius — well under the map so interest management actually bites.
   *  Every weapon range MUST stay below it (you can never hit what you can't
   *  see); raised with the range buff, at a bandwidth cost the tiers absorb. */
  viewRadius: 900,
  maxSpeed: 500,
  stepMs: 33,
  // 30 Hz client send cadence + movement-budget unit (LAT-2 C3)
  maxHp: 100,
  shotDamage: 34,
  // legacy alias — the rifle's damage (see WEAPONS[0])
  shotRange: 850,
  // legacy alias — the rifle's range; also the max tracer length
  hitRadius: 40,
  // perpendicular distance to the ray that still counts as a hit
  // Per-weapon cooldowns live in WEAPONS; this remains the floor any client-side
  // mirror can rely on (the rifle's).
  shotCooldownMs: 100,
  respawnMs: 1500,
  // downed time before respawn (was respawnTicks × stepMs — now
  // explicit ms so retuning the send cadence can never silently change it)
  // Spread-spawn tuning (see pickSpawn in shooter-spawn.ts).
  spawnMinSep: 300,
  // a spawn keeps ≥ this from every living player
  spawnRingMin: 400,
  // ring band around a random survivor a candidate is drawn from
  spawnRingMax: 700,
  spawnCenterJitter: 300,
  // half-extent of the center box used when nobody is alive
  // --- round / zone / pickups / grenades / cover (the "fun" pass) ---
  playerRadius: 14,
  // circle used for crate movement collision + pickup grabs
  spawnProtectMs: 2e3,
  // invulnerable after spawning; firing ends it early
  roundMs: 3e5,
  // 5-minute rounds
  intermissionMs: 6e3,
  // winner banner + reset window between rounds
  zoneEndRadius: 500,
  // the zone shrinks to this by round end
  zoneDamage: 8,
  // hp per zone-damage application
  zoneDamageEveryMs: 1e3,
  // application cadence (hp is integer — no fractional ticks)
  pickupCount: 10,
  pickupRadius: 34,
  // grab distance (centre to centre)
  pickupRespawnMs: 15e3,
  hpPackHeal: 50,
  dmgBoostMs: 1e4,
  dmgBoostMult: 2,
  crateHp: 3
  // rifle-equivalent hits to break a crate
};
var SHOOTER_PROFILE = {
  maxSpeed: SHOOTER.maxSpeed,
  tolerance: 1.15,
  stepMs: SHOOTER.stepMs,
  world: SHOOTER.world,
  // Send-clamp scale: > 1 so a clamped-send backlog drains during sustained movement,
  // < tolerance so a clamped send always fits the server budget for the same delta.
  sendHeadroom: 1.1
};

// src/rooms/shooter-crates.ts
var asObstacle = (c) => ({ x: c.x, y: c.y, w: c.size, h: c.size });
var obstacleCache = /* @__PURE__ */ new WeakMap();
function obstacles(crates2) {
  let o = obstacleCache.get(crates2);
  if (!o) {
    o = crates2.map(asObstacle);
    obstacleCache.set(crates2, o);
  }
  return o;
}
function makeCrates(seed, world) {
  const rng = xorshift32(seed);
  const unit = () => rng() / 4294967295;
  const margin = 80;
  const span = world - margin * 2;
  const crates2 = [];
  for (let i = 0; i < 44; i++) {
    crates2.push({ x: margin + unit() * span, y: margin + unit() * span, size: 26 + unit() * 28 });
  }
  return crates2;
}
function crateContains(c, x, y) {
  return obstacleContains(asObstacle(c), x, y);
}
function rayCoverHit(crates2, ox, oy, dx, dy, maxT, skip) {
  return rayObstacleHit(obstacles(crates2), ox, oy, dx, dy, maxT, skip);
}
function rayCoverDistance(crates2, ox, oy, dx, dy, maxT, skip) {
  return rayCoverHit(crates2, ox, oy, dx, dy, maxT, skip)?.t ?? Infinity;
}
function pushOutOfCrates(pos, r, crates2, skip) {
  return pushOutOfObstacles(pos, r, obstacles(crates2), skip);
}

// src/rooms/shooter-map.ts
function makePickups(seed, world, crates2, count) {
  const rng = xorshift32((seed ^ 2654435769) >>> 0);
  const unit = () => rng() / 4294967295;
  const margin = 140;
  const span = world - margin * 2;
  const spots = [];
  while (spots.length < count) {
    const x = margin + unit() * span;
    const y = margin + unit() * span;
    if (crates2.some((c) => crateContains(c, x, y))) continue;
    spots.push({ x, y, kind: spots.length % 2 === 0 ? "hp" : "dmg" });
  }
  return spots;
}

// demo/loading.ts
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
var LoadingFlow = class {
  stages;
  totalWeight;
  status = "idle";
  error;
  failedStage;
  listeners = /* @__PURE__ */ new Set();
  constructor(defs) {
    if (defs.length === 0) throw new Error("LoadingFlow needs at least one stage");
    this.stages = defs.map((d) => ({ ...d, status: "pending", progress: 0 }));
    this.totalWeight = defs.reduce((sum, d) => sum + Math.max(0, d.weight), 0) || 1;
  }
  /** Subscribe to snapshots (fired on every state change). Returns an unsubscribe. */
  onChange(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  /** Enter the loading state and activate the first stage. */
  start() {
    this.reset();
    this.status = "loading";
    const first = this.stages[0];
    first.status = "active";
    this.emit();
  }
  /** Update the fraction (0..1) of a stage; only meaningful while it is active. */
  setProgress(id, fraction) {
    const stage = this.stages.find((s) => s.id === id);
    if (!stage || stage.status === "done" || stage.status === "error") return;
    stage.status = "active";
    stage.progress = clamp01(fraction);
    this.emit();
  }
  /** Mark a stage done and activate the next pending stage (or finish). */
  complete(id) {
    const idx = this.stages.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const stage = this.stages[idx];
    stage.status = "done";
    stage.progress = 1;
    const next = this.stages.find((s) => s.status === "pending");
    if (next) {
      next.status = "active";
    } else {
      this.status = "done";
    }
    this.emit();
  }
  /** Fail a stage — moves the whole flow into the error state with a message. */
  fail(id, message) {
    const stage = this.stages.find((s) => s.id === id);
    if (stage) stage.status = "error";
    this.status = "error";
    this.error = message;
    this.failedStage = id;
    this.emit();
  }
  /** Reset every stage to pending and clear any error (used before a retry). */
  reset() {
    for (const s of this.stages) {
      s.status = "pending";
      s.progress = 0;
    }
    this.status = "idle";
    this.error = void 0;
    this.failedStage = void 0;
    this.emit();
  }
  /** Current immutable snapshot. */
  view() {
    let acc = 0;
    for (const s of this.stages) {
      const frac = s.status === "done" ? 1 : s.status === "active" ? s.progress : 0;
      acc += frac * Math.max(0, s.weight);
    }
    const progress = clamp01(acc / this.totalWeight);
    let label2;
    if (this.status === "error") label2 = this.error ?? "Something went wrong";
    else if (this.status === "done") label2 = "Ready";
    else label2 = this.stages.find((s) => s.status === "active")?.label ?? this.stages[0].label;
    return {
      status: this.status,
      progress,
      label: label2,
      failedStage: this.failedStage,
      error: this.error,
      stages: this.stages.map((s) => ({ ...s }))
    };
  }
  emit() {
    const v = this.view();
    for (const fn of this.listeners) fn(v);
  }
};

// demo/shooter-client.ts
var MAX_PLAYERS = 64;
var KILL_GLYPHS = { w0: "\u2022", w1: "\u2234", w2: "\u2261", zone: "\u25CD" };
function weaponTracerColor(w) {
  return w === 1 ? "rgba(255,159,67,0.55)" : w === 2 ? "rgba(88,166,255,0.5)" : "rgba(242,204,96,0.5)";
}
var ASSET_BASE = "/assets/shooter/";
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var statusEl = document.getElementById("status");
var lbEl = document.getElementById("lb");
var gateEl = document.getElementById("gate");
var playBtn = document.getElementById("play");
var nickInput = document.getElementById("nick");
var startPanel = document.getElementById("start-panel");
var loadingPanel = document.getElementById("loading-panel");
var barFill = document.getElementById("bar-fill");
var barPct = document.getElementById("bar-pct");
var stageLabelEl = document.getElementById("stage-label");
var stageListEl = document.getElementById("stage-list");
var retryBtn = document.getElementById("retry");
var client = new GameClient(location.host, {
  party: "shooter-room",
  stateCodec: ShooterSchema,
  // FPS-grade netcode: stamp inputs with a subtick server-clock time (rewind pins
  // the hitscan to the exact shot instant) and coalesce inputs into ~one frame/tick.
  subtickTimestamps: true,
  inputBatchMs: 33
});
var sprites = {};
var soundBuffers = {};
var SFX_VOLUME = 0.25;
var assetsReady = false;
var audioUnlocked = false;
var audioCtx = null;
function getAudioCtx() {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}
function resolveAsset(name) {
  if (/^(https?:)?\/\//.test(name) || name.startsWith("/")) return name;
  return ASSET_BASE + name;
}
function loadImage(url, onSettled) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      onSettled();
      resolve(img);
    };
    img.onerror = () => {
      onSettled();
      resolve(null);
    };
    img.src = url;
  });
}
async function loadAudioBuffer(url, onSettled) {
  const ctx2 = getAudioCtx();
  if (!ctx2) {
    onSettled();
    return null;
  }
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const raw = await res.arrayBuffer();
    const buf = await new Promise((resolve, reject) => {
      const maybe = ctx2.decodeAudioData(raw, resolve, reject);
      if (maybe && typeof maybe.then === "function") maybe.then(resolve, reject);
    });
    onSettled();
    return buf;
  } catch {
    onSettled();
    return null;
  }
}
async function preloadAssets(onProgress) {
  if (assetsReady) {
    onProgress(1);
    return;
  }
  let manifest = null;
  try {
    const res = await fetch(`${ASSET_BASE}manifest.json`, { cache: "no-cache" });
    if (res.ok) manifest = await res.json();
  } catch {
    manifest = null;
  }
  const spriteEntries = Object.entries(manifest?.sprites ?? {});
  const audioEntries = Object.entries(manifest?.audio ?? {});
  const total = spriteEntries.length + audioEntries.length;
  if (total === 0) {
    assetsReady = true;
    onProgress(1);
    return;
  }
  let settled = 0;
  const bump = () => {
    settled += 1;
    onProgress(settled / total);
  };
  await Promise.all([
    ...spriteEntries.map(async ([key, file]) => {
      const img = await loadImage(resolveAsset(file), bump);
      if (img) sprites[key] = img;
    }),
    ...audioEntries.map(async ([key, file]) => {
      const buf = await loadAudioBuffer(resolveAsset(file), bump);
      if (buf) soundBuffers[key] = buf;
    })
  ]);
  assetsReady = true;
  onProgress(1);
}
function unlockAudio() {
  if (audioUnlocked) return;
  const ctx2 = getAudioCtx();
  if (!ctx2) return;
  void ctx2.resume().catch(() => {
  });
  audioUnlocked = true;
}
function playSound(key) {
  if (!audioUnlocked) return;
  const ctx2 = audioCtx;
  const buf = soundBuffers[key];
  if (!ctx2 || !buf) return;
  const src = ctx2.createBufferSource();
  src.buffer = buf;
  const gain = ctx2.createGain();
  gain.gain.value = SFX_VOLUME;
  src.connect(gain).connect(ctx2.destination);
  src.start();
}
var crates = [];
var crateSeed = null;
var pickupSpots = [];
var latestBroken = {};
var isBrokenIdx = (i) => latestBroken[String(i)] !== void 0;
var WORLD_CENTER = SHOOTER.world / 2;
var predictor = new InputPredictor(
  { x: WORLD_CENTER, y: WORLD_CENTER },
  { apply: (_s, i) => ({ ...i }) }
);
var buffer = new SnapshotBuffer({
  delayMs: 60,
  // starting point; the adaptive controller owns it from here
  lerp: lerpState,
  // Bridge a late/lost frame by extrapolating ~half an RTT along the last
  // segment's velocity instead of freezing (lerpState with t > 1 extrapolates
  // positions linearly; discrete fields already take the newest value).
  maxExtrapolationMs: 50,
  // 30 Hz flush + measured jitter: settles near the floor on a clean network
  // (≈40 ms less added latency than the old fixed 100 ms), grows under jitter.
  // 60 Hz flush: 2×interval + headroom lands near 40 ms on a clean network —
  // let the controller settle there instead of pinning at the old 20 Hz floor.
  adaptiveDelay: { minMs: 30, maxMs: 200 }
});
var motion = RenderPredictor.fromProfile({ x: WORLD_CENTER, y: WORLD_CENTER }, SHOOTER_PROFILE, {
  // Predict crate collision with the SAME pushout the server applies (shooter-map.ts)
  // so contact never rubber-bands. The closure reads the live module `crates` array
  // (empty until the seed lands) and `latestBroken`, so destroyed cover stops blocking.
  constrain: (pos) => pushOutOfCrates(pos, SHOOTER.playerRadius, crates, isBrokenIdx)
});
var smoother = new EntitySmoother();
var cam = { x: WORLD_CENTER, y: WORLD_CENTER };
var lastRenderMs = 0;
var lastZoneR = -1;
var zoneShrinkUntil = 0;
var myId = "";
var seq = 0;
var aim = 0;
var mouse = { x: 0, y: 0 };
var keys = /* @__PURE__ */ new Set();
var isTouch = matchMedia("(pointer: coarse)").matches;
var stickMove = { x: 0, y: 0 };
var stickAim = { active: false, dir: 0, fire: false };
var STICK_R = 56;
var movePointerId = -1;
var aimPointerId = -1;
var moveOrigin = { x: 0, y: 0 };
var moveKnob = { x: 0, y: 0 };
var aimOrigin = { x: 0, y: 0 };
var aimKnob = { x: 0, y: 0 };
var tryFire = () => {
};
var tracers = [];
var effects = [];
var damageNumbers = [];
var hitMarkerUntil = 0;
var killFeed = [];
var killStreak = 0;
var streakBannerText = "";
var streakBannerUntil = 0;
var roundTop = [];
var roundOverUntil = 0;
var myWeapon = 0;
var ammo = WEAPONS.map((w) => w.mag);
var reloadUntil = 0;
var mouseHeld = false;
var hitFlash = /* @__PURE__ */ new Map();
var lastDrawn = /* @__PURE__ */ new Map();
var prevAlive = /* @__PURE__ */ new Map();
var sampleServerNow = () => performance.now();
var nickname = "";
var running = false;
var myScore = 0;
var lbYouScoreEl = null;
function lerpState(a, b, t) {
  const players = {};
  for (const id of Object.keys(b.players)) {
    const pb = b.players[id];
    const pa = a.players[id];
    players[id] = pa ? { ...pb, x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t } : pb;
  }
  return { ...b, players };
}
var flow = new LoadingFlow([
  { id: "assets", label: "Loading assets", weight: 3 },
  { id: "matchmake", label: "Finding a match", weight: 1 },
  { id: "connect", label: "Joining the arena", weight: 1 },
  { id: "spawn", label: "Spawning in", weight: 1 }
]);
flow.onChange(renderLoading);
function renderLoading(v) {
  const pct = Math.round(v.progress * 100);
  barFill.style.width = `${pct}%`;
  barFill.classList.toggle("is-error", v.status === "error");
  barPct.textContent = `${pct}%`;
  stageLabelEl.textContent = v.label;
  stageLabelEl.classList.toggle("is-error", v.status === "error");
  retryBtn.hidden = v.status !== "error";
  stageListEl.innerHTML = v.stages.map((s) => {
    const mark = s.status === "done" ? "\u2713" : s.status === "error" ? "\u2715" : s.status === "active" ? "\u2026" : "\xB7";
    return `<li class="stage stage-${s.status}"><span class="stage-mark">${mark}</span>${escapeHtml(s.label)}</li>`;
  }).join("");
}
function withTimeout(p, ms, message) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}
function firstFrame(room, ms) {
  return new Promise((resolve, reject) => {
    if (room.state !== void 0) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      off();
      reject(new Error("no state received from the room"));
    }, ms);
    const off = room.onStateChange(() => {
      clearTimeout(t);
      off();
      resolve();
    });
  });
}
var inFlight = false;
async function play() {
  if (inFlight) return;
  inFlight = true;
  unlockAudio();
  nickname = nickInput.value.trim().slice(0, 24);
  startPanel.hidden = true;
  loadingPanel.hidden = false;
  flow.start();
  let stage = "assets";
  let room;
  let aborted = false;
  try {
    stage = "assets";
    await preloadAssets((f) => flow.setProgress("assets", f));
    flow.complete("assets");
    stage = "matchmake";
    const m = await withTimeout(
      client.matchmake({ type: "shooter-room", maxClients: MAX_PLAYERS }),
      8e3,
      "matchmaking timed out"
    );
    flow.complete("matchmake");
    stage = "connect";
    const joinPromise = client.joinOrCreate(m.roomId, {
      _session: m.sessionId,
      ...m.region ? { region: m.region } : {}
    });
    void joinPromise.then(
      (r) => {
        if (aborted) r.leave();
      },
      () => {
      }
    );
    const roomHandle = await withTimeout(joinPromise, 8e3, "could not join the room");
    room = roomHandle;
    flow.complete("connect");
    stage = "spawn";
    await withTimeout(firstFrame(roomHandle, 8e3), 8500, "timed out waiting for the first state");
    flow.complete("spawn");
    startGame(roomHandle);
    gateEl.hidden = true;
  } catch (err) {
    aborted = true;
    room?.leave();
    flow.fail(stage, err instanceof Error ? err.message : String(err));
  } finally {
    inFlight = false;
  }
}
function startGame(room) {
  myId = room.connectionId ?? "";
  sampleServerNow = () => room.clock.serverNow();
  statusEl.textContent = `${nickname || myId.slice(0, 6)} \xB7 WASD move \xB7 mouse aim \xB7 click shoot`;
  if (nickname) room.send("nick", nickname);
  room.onMessage((msg) => {
    if (msg.t === "s:welcome" && msg.reconnected) {
      statusEl.textContent = `reconnected as ${nickname || myId.slice(0, 6)} \xB7 seat preserved`;
    }
  });
  room.onStateChange((s) => ingestState(s, room));
  if (room.state !== void 0) ingestState(room.state, room);
  room.onMessage("rejected", (payload) => motion.correct(payload));
  room.onMessage("shot", (payload) => {
    const p = payload;
    const now = performance.now();
    const wIdx = typeof p.w === "number" ? p.w : 0;
    const range = WEAPONS[wIdx]?.range ?? SHOOTER.shotRange;
    const dist = typeof p.dist === "number" ? p.dist : range;
    if (p.from !== myId) {
      const anchor = p.from && lastDrawn.get(p.from) || { x: p.ox, y: p.oy };
      const tx = anchor.x + Math.cos(p.dir) * dist;
      const ty = anchor.y + Math.sin(p.dir) * dist;
      tracers.push({
        ox: anchor.x,
        oy: anchor.y,
        tx,
        ty,
        hit: p.hitId !== void 0,
        color: weaponTracerColor(wIdx),
        until: now + 120
      });
      effects.push({ kind: "muzzle", x: anchor.x, y: anchor.y, dir: p.dir, until: now + 80 });
      if (p.hitId === void 0 && dist < range - 1) {
        effects.push({ kind: "impact", x: tx, y: ty, until: now + 110 });
      }
      playSound("shot");
    }
    if (p.hitId !== void 0) {
      hitFlash.set(p.hitId, now + 140);
      playSound("hit");
      if (p.from === myId) {
        hitMarkerUntil = now + 120;
        const victim = lastDrawn.get(p.hitId);
        if (victim && typeof p.dmg === "number") {
          damageNumbers.push({ x: victim.x, y: victim.y, dmg: p.dmg, until: now + 600 });
        }
      }
    }
  });
  room.onMessage("kill", (payload) => {
    const p = payload;
    const glyph = KILL_GLYPHS[p.by] ?? "\u2022";
    const killer = p.kn ?? p.k.slice(0, 6);
    const victim = p.vn ?? p.v.slice(0, 6);
    killFeed.unshift({ text: `${glyph} ${killer} \u25B8 ${victim}`, mine: p.k === myId, until: performance.now() + 4e3 });
    while (killFeed.length > 5) killFeed.pop();
    if (p.k === myId) {
      killStreak += 1;
      const label2 = killStreak >= 8 ? "UNSTOPPABLE!" : killStreak >= 5 ? "RAMPAGE!" : killStreak >= 3 ? "KILLING SPREE!" : "";
      if (label2) {
        streakBannerText = label2;
        streakBannerUntil = performance.now() + 1600;
      }
    }
  });
  room.onMessage("grab", (payload) => {
    const p = payload;
    const s = pickupSpots[p.i];
    if (s) effects.push({ kind: "respawn", x: s.x, y: s.y, until: performance.now() + 350 });
    if (p.id === myId) playSound("hit");
  });
  room.onMessage("round", (payload) => {
    const p = payload;
    roundTop = p.top ?? [];
    roundOverUntil = performance.now() + 5e3;
  });
  room.onMessage("ammo", (payload) => {
    const p = payload;
    if (typeof p.w !== "number" || typeof p.n !== "number") return;
    if (p.w >= 0 && p.w < ammo.length) ammo[p.w] = p.n;
    if (p.w === myWeapon && typeof p.rl === "number" && p.rl > 0) {
      reloadUntil = performance.now() + p.rl;
    }
  });
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  let lastLocalShotAt = -Infinity;
  tryFire = () => {
    const nowW = performance.now();
    const spec = WEAPONS[myWeapon] ?? WEAPONS[0];
    if (nowW - lastLocalShotAt < spec.cooldownMs) return;
    if (spec.mag > 0) {
      if (reloadUntil > 0) {
        if (nowW < reloadUntil) return;
        ammo[myWeapon] = spec.mag;
        reloadUntil = 0;
      }
      if (ammo[myWeapon] <= 0) {
        reloadUntil = nowW + spec.reloadMs;
        return;
      }
      ammo[myWeapon] -= 1;
      if (ammo[myWeapon] <= 0) reloadUntil = nowW + spec.reloadMs;
    }
    lastLocalShotAt = nowW;
    room.send("shoot", { dir: aim });
    const me = lastDrawn.get(myId) ?? motion.renderPosition;
    const color = weaponTracerColor(myWeapon);
    for (let i = 0; i < spec.rays; i++) {
      const rayDir = spec.rays > 1 ? aim + (i / (spec.rays - 1) - 0.5) * spec.spread : aim;
      const cd = Math.cos(rayDir);
      const sd = Math.sin(rayDir);
      const dist = Math.min(
        spec.range,
        rayCoverDistance(crates, me.x, me.y, cd, sd, spec.range, isBrokenIdx)
      );
      const tx = me.x + cd * dist;
      const ty = me.y + sd * dist;
      tracers.push({ ox: me.x, oy: me.y, tx, ty, hit: false, color, until: nowW + 120 });
      if (dist < spec.range - 1) effects.push({ kind: "impact", x: tx, y: ty, until: nowW + 110 });
    }
    effects.push({ kind: "muzzle", x: me.x, y: me.y, dir: aim, until: nowW + 80 });
    playSound("shot");
  };
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseHeld = true;
    tryFire();
  });
  addEventListener("mouseup", (e) => {
    if (e.button === 0) mouseHeld = false;
  });
  addEventListener("blur", () => mouseHeld = false);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  if (isTouch) {
    const localPoint = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const p = localPoint(e);
      const hit = weaponButtonRects().find((b) => p.x >= b.x && p.x <= b.x + b.s && p.y >= b.y && p.y <= b.y + b.s);
      if (hit) {
        if (hit.w !== myWeapon) {
          myWeapon = hit.w;
          reloadUntil = 0;
          room.send("weapon", { w: hit.w });
        }
        return;
      }
      if (p.x < canvas.width / 2) {
        if (movePointerId !== -1) return;
        movePointerId = e.pointerId;
        moveOrigin.x = p.x;
        moveOrigin.y = p.y;
        moveKnob.x = p.x;
        moveKnob.y = p.y;
        stickMove = { x: 0, y: 0 };
      } else {
        if (aimPointerId !== -1) return;
        aimPointerId = e.pointerId;
        aimOrigin.x = p.x;
        aimOrigin.y = p.y;
        aimKnob.x = p.x;
        aimKnob.y = p.y;
        stickAim.active = true;
        stickAim.fire = false;
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = localPoint(e);
      if (e.pointerId === movePointerId) {
        let dx = p.x - moveOrigin.x;
        let dy = p.y - moveOrigin.y;
        const mag = Math.hypot(dx, dy);
        if (mag > STICK_R) {
          dx = dx / mag * STICK_R;
          dy = dy / mag * STICK_R;
        }
        moveKnob.x = moveOrigin.x + dx;
        moveKnob.y = moveOrigin.y + dy;
        stickMove = { x: dx / STICK_R, y: dy / STICK_R };
      } else if (e.pointerId === aimPointerId) {
        const dx = p.x - aimOrigin.x;
        const dy = p.y - aimOrigin.y;
        const mag = Math.hypot(dx, dy);
        const clamped = Math.min(mag, STICK_R);
        if (mag > 0) {
          aimKnob.x = aimOrigin.x + dx / mag * clamped;
          aimKnob.y = aimOrigin.y + dy / mag * clamped;
        }
        if (mag > 12) stickAim.dir = Math.atan2(dy, dx);
        stickAim.fire = mag >= STICK_R * 0.6;
      }
    });
    const endPointer = (e) => {
      if (e.pointerId === movePointerId) {
        movePointerId = -1;
        stickMove = { x: 0, y: 0 };
      } else if (e.pointerId === aimPointerId) {
        aimPointerId = -1;
        stickAim.active = false;
        stickAim.fire = false;
      }
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
  }
  addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    const w = e.code === "Digit1" || e.key === "1" ? 0 : e.code === "Digit2" || e.key === "2" ? 1 : e.code === "Digit3" || e.key === "3" ? 2 : -1;
    if (w >= 0 && w !== myWeapon) {
      myWeapon = w;
      reloadUntil = 0;
      room.send("weapon", { w });
    }
    if (e.code === "KeyR" || e.key.toLowerCase() === "r") {
      const spec = WEAPONS[myWeapon] ?? WEAPONS[0];
      if (spec.mag > 0 && reloadUntil === 0 && ammo[myWeapon] < spec.mag) {
        reloadUntil = performance.now() + spec.reloadMs;
        room.send("reload", {});
      }
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  setInterval(() => {
    if (isTouch) {
      if (stickAim.active) aim = stickAim.dir;
    } else {
      aim = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
    }
    seq += 1;
    const sent = motion.sendPosition(room.clock.serverNow());
    room.send("move", { x: sent.x, y: sent.y, aim });
    predictor.predict(seq, sent);
  }, SHOOTER.stepMs);
  running = true;
  resizeCanvas();
  addEventListener("resize", resizeCanvas);
  requestAnimationFrame(render);
  renderLeaderboard([]);
  void refreshLeaderboard();
  setInterval(() => void refreshLeaderboard(), 5e3);
}
function ingestState(st, room) {
  buffer.push(room.lastStateServerTime ?? performance.now(), st);
  latestBroken = st.broken;
  if (typeof st.zr === "number") {
    if (lastZoneR >= 0 && st.zr < lastZoneR - 0.1) zoneShrinkUntil = performance.now() + 1400;
    lastZoneR = st.zr;
  }
  const me = st.players[myId];
  if (me) {
    if (me.score !== myScore) {
      myScore = me.score;
      if (lbYouScoreEl) lbYouScoreEl.textContent = String(myScore);
    }
    predictor.reconcile({ x: me.x, y: me.y }, room.lastAckSeq);
    motion.alive = me.alive;
    motion.reconcile({ x: me.x, y: me.y });
  }
  if (crateSeed === null && typeof st.seed === "number") {
    crateSeed = st.seed;
    crates = makeCrates(st.seed, SHOOTER.world);
    pickupSpots = makePickups(st.seed, SHOOTER.world, crates, SHOOTER.pickupCount);
  }
  const now = performance.now();
  const seenNow = /* @__PURE__ */ new Set();
  for (const id of Object.keys(st.players)) {
    const p = st.players[id];
    seenNow.add(id);
    const was = prevAlive.get(id);
    if (was === true && !p.alive) {
      effects.push({ kind: "death", x: p.x, y: p.y, until: now + 500 });
      playSound("death");
      if (id === myId) killStreak = 0;
    } else if (was === false && p.alive) {
      effects.push({ kind: "respawn", x: p.x, y: p.y, until: now + 450 });
      if (id === myId) {
        for (let i = 0; i < ammo.length; i++) ammo[i] = WEAPONS[i].mag;
        reloadUntil = 0;
      }
    }
    prevAlive.set(id, p.alive);
  }
  for (const id of [...prevAlive.keys()]) {
    if (!seenNow.has(id)) prevAlive.delete(id);
  }
}
function renderLeaderboard(rows) {
  if (!lbEl) return;
  const items = rows.map((r, i) => {
    const name = escapeHtml(r.displayName ?? r.playerId.slice(0, 6));
    return `<li class="lb-row${i === 0 ? " lb-top" : ""}"><span class="lb-nm">${i + 1}. ${name}</span><span class="lb-sc">${r.score}</span></li>`;
  }).join("");
  const youName = escapeHtml(nickname || "YOU");
  lbEl.innerHTML = `<div class="lb-title">SHOOTER-TOP</div><ol class="lb-list">${items}</ol><div class="lb-div"></div><div class="lb-row lb-you"><span class="lb-nm">${youName}</span><span class="lb-sc" id="lb-you-score">${myScore}</span></div>`;
  lbYouScoreEl = document.getElementById("lb-you-score");
}
async function refreshLeaderboard() {
  if (!lbEl) return;
  try {
    const res = await fetch("/api/leaderboard?board=shooter-top&limit=5");
    if (!res.ok) return;
    const rows = await res.json();
    renderLeaderboard(rows);
  } catch {
  }
}
function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
function resizeCanvas() {
  const top = 72;
  canvas.width = Math.max(320, Math.floor(window.innerWidth));
  canvas.height = Math.max(240, Math.floor(window.innerHeight - top));
}
var PLAYER_SIZE = 30;
function moveDir() {
  let x = 0;
  let y = 0;
  if (keys.has("w")) y -= 1;
  if (keys.has("s")) y += 1;
  if (keys.has("a")) x -= 1;
  if (keys.has("d")) x += 1;
  return { x, y };
}
function render() {
  if (!running) return;
  const now = performance.now();
  const dtMs = lastRenderMs === 0 ? 16 : now - lastRenderMs;
  lastRenderMs = now;
  const dir = isTouch ? stickMove : moveDir();
  const { x: renderX, y: renderY } = motion.frame(dir.x, dir.y, dtMs);
  lastDrawn.set(myId, { x: renderX, y: renderY });
  if (isTouch ? stickAim.fire : mouseHeld) tryFire();
  if (reloadUntil > 0 && now >= reloadUntil) {
    ammo[myWeapon] = (WEAPONS[myWeapon] ?? WEAPONS[0]).mag;
    reloadUntil = 0;
  }
  cam.x = renderX;
  cam.y = renderY;
  const camX = Math.round(cam.x - canvas.width / 2);
  const camY = Math.round(cam.y - canvas.height / 2);
  drawGround(camX, camY);
  drawWorldBounds(camX, camY);
  drawCrates(camX, camY);
  const view = buffer.sample(sampleServerNow());
  drawZone(view, camX, camY);
  drawPickups(view, camX, camY, now);
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    if (tr.until <= now) {
      tracers.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = tr.hit ? "#00e5a0" : tr.color ?? "rgba(230,237,243,0.35)";
    ctx.lineWidth = tr.hit ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(tr.ox - camX, tr.oy - camY);
    ctx.lineTo(tr.tx - camX, tr.ty - camY);
    ctx.stroke();
  }
  drawEffects(camX, camY, now);
  const seen = /* @__PURE__ */ new Set();
  if (view) {
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id];
      seen.add(id);
      const sm = smoother.update(id, { x: pl.x, y: pl.y, angle: pl.aim }, dtMs);
      lastDrawn.set(id, { x: sm.x, y: sm.y });
      drawPlayer(
        { aim: sm.angle, hp: pl.hp, score: pl.score, alive: pl.alive },
        sm.x - camX,
        sm.y - camY,
        false,
        hitFlash.get(id),
        now
      );
      if (pl.alive && pl.sp) drawSpawnRing(sm.x - camX, sm.y - camY, now);
    }
  }
  smoother.prune(seen);
  for (const id of [...lastDrawn.keys()]) {
    if (id !== myId && !seen.has(id)) lastDrawn.delete(id);
  }
  const meState = view?.players[myId];
  const meAlive = meState?.alive ?? true;
  drawPlayer(
    { aim, hp: meState?.hp ?? SHOOTER.maxHp, score: meState?.score ?? 0, alive: meAlive },
    renderX - camX,
    renderY - camY,
    true,
    hitFlash.get(myId),
    now
  );
  if (meAlive && meState?.sp) drawSpawnRing(renderX - camX, renderY - camY, now);
  if (meAlive && meState?.db) {
    ctx.fillStyle = "#ff9f43";
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("\xD72", renderX - camX, renderY - camY - 34);
    ctx.textAlign = "start";
  }
  drawDamageNumbers(camX, camY, now);
  const outsideZone = !!view && meAlive && Math.hypot(renderX - view.zx, renderY - view.zy) > view.zr;
  drawHud(meState?.hp ?? SHOOTER.maxHp, meState?.score ?? 0, myWeapon, meState?.db ?? false, !outsideZone, killStreak);
  drawRadar(view, renderX, renderY);
  drawHitMarker(now);
  drawKillFeed(now);
  drawRoundUI(view, now);
  drawStreakBanner(now);
  drawZoneShrinkBanner(now);
  if (outsideZone) drawZoneWarning(now);
  drawTouchControls();
  requestAnimationFrame(render);
}
function weaponButtonRects() {
  const s = 44;
  const gap = 8;
  const pad = 14;
  const radarTop = canvas.height - 168 - pad;
  const x = canvas.width - pad - s;
  return [0, 1, 2].map((w) => ({ x, y: radarTop - gap - s - (2 - w) * (s + gap), s, w }));
}
function drawTouchControls() {
  if (!isTouch) return;
  for (const b of weaponButtonRects()) {
    const active = b.w === myWeapon;
    ctx.fillStyle = "rgba(16,21,29,0.85)";
    ctx.strokeStyle = active ? "#00e5a0" : "#232b36";
    ctx.lineWidth = active ? 2 : 1;
    roundRect(b.x, b.y, b.s, b.s, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? "#00e5a0" : "#8b98a8";
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(b.w + 1), b.x + b.s / 2, b.y + b.s / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }
  ctx.textAlign = "start";
  if (movePointerId !== -1) drawStick(moveOrigin, moveKnob, "#00e5a0");
  if (aimPointerId !== -1) drawStick(aimOrigin, aimKnob, stickAim.fire ? "#ff6b6b" : "#58a6ff");
}
function drawStick(origin, knob, knobColor) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, STICK_R, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(16,21,29,0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(35,43,54,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(knob.x, knob.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = knobColor;
  ctx.fill();
  ctx.restore();
}
function drawRadar(view, selfX, selfY) {
  const size = 168;
  const pad = 14;
  const x0 = canvas.width - size - pad;
  const y0 = canvas.height - size - pad;
  const cx = x0 + size / 2;
  const cy = y0 + size / 2;
  const rad = size / 2;
  const s = size / SHOOTER.world;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(10,15,20,0.82)";
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = "rgba(0,229,160,0.10)";
  ctx.lineWidth = 1;
  for (const rr of [rad * 0.5, rad * 0.82]) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - rad, cy);
  ctx.lineTo(cx + rad, cy);
  ctx.moveTo(cx, cy - rad);
  ctx.lineTo(cx, cy + rad);
  ctx.stroke();
  ctx.fillStyle = "rgba(139,152,168,0.45)";
  for (let i = 0; i < crates.length; i++) {
    if (isBrokenIdx(i)) continue;
    const cr = crates[i];
    const cs = Math.max(2, cr.size * s);
    ctx.fillRect(x0 + cr.x * s - cs / 2, y0 + cr.y * s - cs / 2, cs, cs);
  }
  if (view) {
    ctx.strokeStyle = "rgba(0,229,160,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x0 + view.zx * s, y0 + view.zy * s, view.zr * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,229,160,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + selfX * s, y0 + selfY * s, SHOOTER.viewRadius * s, 0, Math.PI * 2);
  ctx.stroke();
  if (view) {
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id];
      ctx.fillStyle = pl.alive ? "#ff5a5a" : "rgba(139,152,168,0.4)";
      ctx.beginPath();
      ctx.arc(x0 + pl.x * s, y0 + pl.y * s, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const sx = x0 + selfX * s;
  const sy = y0 + selfY * s;
  ctx.fillStyle = "rgba(0,229,160,0.14)";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.arc(sx, sy, 30, aim - 0.42, aim + 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(aim);
  ctx.fillStyle = "#00e5a0";
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-4, -4.5);
  ctx.lineTo(-4, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = "rgba(0,229,160,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
  drawCornerBrackets(x0 - 3, y0 - 3, size + 6, size + 6, 14, "#00e5a0", 2);
}
function drawGround(camX, camY) {
  ctx.fillStyle = "#3b4049";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const grid = 56;
  const startX = -((camX % grid + grid) % grid);
  const startY = -((camY % grid + grid) % grid);
  ctx.fillStyle = "rgba(90,98,110,0.5)";
  for (let x = startX; x < canvas.width; x += grid) {
    for (let y = startY; y < canvas.height; y += grid) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
}
function drawWorldBounds(camX, camY) {
  ctx.strokeStyle = "rgba(0,229,160,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-camX, -camY, SHOOTER.world, SHOOTER.world);
}
function drawCrates(camX, camY) {
  if (crates.length === 0) return;
  const sprite = sprites.crate;
  for (let i = 0; i < crates.length; i++) {
    const cr = crates[i];
    const x = cr.x - camX;
    const y = cr.y - camY;
    if (x < -cr.size || y < -cr.size || x > canvas.width + cr.size || y > canvas.height + cr.size) continue;
    if (isBrokenIdx(i)) {
      const h = cr.size / 2;
      ctx.fillStyle = "#0d1219";
      ctx.fillRect(x - h, y - cr.size / 6, cr.size, cr.size / 3);
      ctx.strokeStyle = "#2a333f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * h * 0.6;
        ctx.moveTo(x + ox, y - 3);
        ctx.lineTo(x + ox + 4, y + 4);
      }
      ctx.stroke();
      continue;
    }
    if (sprite) {
      ctx.drawImage(sprite, x - cr.size / 2, y - cr.size / 2, cr.size, cr.size);
    } else {
      ctx.fillStyle = "#161d27";
      ctx.strokeStyle = "#33404f";
      ctx.lineWidth = 2;
      ctx.fillRect(x - cr.size / 2, y - cr.size / 2, cr.size, cr.size);
      ctx.strokeRect(x - cr.size / 2, y - cr.size / 2, cr.size, cr.size);
    }
  }
}
function drawEffects(camX, camY, now) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    if (fx.until <= now) {
      effects.splice(i, 1);
      continue;
    }
    const x = fx.x - camX;
    const y = fx.y - camY;
    if (fx.kind === "muzzle") {
      const life = (fx.until - now) / 80;
      const flash = sprites.muzzleFlash;
      if (flash) {
        const s = 26 * (0.7 + life * 0.6);
        ctx.save();
        ctx.globalAlpha = life;
        ctx.translate(x + Math.cos(fx.dir) * 16, y + Math.sin(fx.dir) * 16);
        ctx.rotate(fx.dir + Math.PI / 2);
        ctx.drawImage(flash, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = life;
        ctx.fillStyle = "#f2cc60";
        const mx = x + Math.cos(fx.dir) * 18;
        const my = y + Math.sin(fx.dir) * 18;
        ctx.beginPath();
        ctx.arc(mx, my, 5 * (0.6 + life), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (fx.kind === "impact") {
      const life = (fx.until - now) / 110;
      ctx.save();
      ctx.globalAlpha = life;
      ctx.strokeStyle = "#f2cc60";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + 0.4;
        const r0 = 3 + (1 - life) * 3;
        const r1 = r0 + 5 + (1 - life) * 6;
        ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
        ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      const total = fx.kind === "death" ? 500 : 450;
      const life = (fx.until - now) / total;
      const r = (1 - life) * (fx.kind === "death" ? 34 : 26) + 8;
      ctx.save();
      ctx.globalAlpha = life;
      ctx.strokeStyle = fx.kind === "death" ? "#ff6b6b" : "#00e5a0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
function drawPlayer(p, x, y, isSelf, flashUntil, now) {
  if (!p.alive) {
    ctx.strokeStyle = "rgba(230,237,243,0.25)";
    circle(x, y, 12, false);
    return;
  }
  const sprite = isSelf ? sprites.playerBody : sprites.enemyBody;
  const flashing = flashUntil !== void 0 && flashUntil > now;
  if (sprite) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.aim);
    ctx.drawImage(sprite, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    if (flashing) {
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#ff6b6b";
      ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = flashing ? "#ff6b6b" : isSelf ? "#00e5a0" : "#ff5a5a";
    circle(x, y, 12, true);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(p.aim) * 20, y + Math.sin(p.aim) * 20);
    ctx.stroke();
  }
  const w = 30;
  ctx.fillStyle = "rgba(16,21,29,0.9)";
  ctx.fillRect(x - w / 2, y - 26, w, 4);
  ctx.fillStyle = isSelf ? "#00e5a0" : "#ff5a5a";
  ctx.fillRect(x - w / 2, y - 26, w * Math.max(0, p.hp) / SHOOTER.maxHp, 4);
  label(`${p.score}`, x, y + 30);
}
function drawHud(hp, score, weapon, db, inZone, streak) {
  const pad = 14;
  const w = 216;
  const h = 92;
  const x = pad;
  const y = canvas.height - h - pad;
  ctx.fillStyle = "rgba(12,17,23,0.82)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(0,229,160,0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  drawCornerBrackets(x, y, w, h, 13, "#00e5a0", 2);
  const lx = x + 14;
  const rx = x + w - 14;
  const by = y + 14;
  const bw = w - 28;
  const bh = 7;
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(lx, by, bw, bh);
  const frac = clamp2(hp / SHOOTER.maxHp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? "#00e5a0" : frac > 0.25 ? "#f2cc60" : "#ff6b6b";
  ctx.fillRect(lx, by, bw * frac, bh);
  ctx.font = "12px ui-monospace, monospace";
  const r1 = y + 40;
  hudPair(lx, r1, "HP", String(Math.max(0, Math.round(hp))), "left");
  hudPair(rx, r1, "SCORE", String(score), "right");
  const r2 = y + 58;
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  const streakTxt = `STREAK ${streak}   \xB7   `;
  ctx.fillStyle = "#8b98a8";
  ctx.fillText(streakTxt, lx, r2);
  const zoneTxt = inZone ? "IN ZONE" : "OUT OF ZONE";
  const zoneX = lx + ctx.measureText(streakTxt).width;
  ctx.fillStyle = inZone ? "#8b98a8" : "#ff6b6b";
  ctx.fillText(zoneTxt, zoneX, r2);
  if (db) {
    ctx.fillStyle = "#ff9f43";
    ctx.fillText("   \xB7   DMG\xD72", zoneX + ctx.measureText(zoneTxt).width, r2);
  }
  const r3 = y + 78;
  ctx.font = "12px ui-monospace, monospace";
  const spec = WEAPONS[weapon] ?? WEAPONS[0];
  hudPair(lx, r3, "WEAPON", spec.name, "left");
  ctx.textAlign = "right";
  if (spec.mag <= 0) {
    ctx.fillStyle = "#8b98a8";
    ctx.fillText("\u221E", rx, r3);
  } else if (reloadUntil > 0 && performance.now() < reloadUntil) {
    ctx.fillStyle = "#f2cc60";
    ctx.fillText("RELOAD\u2026", rx, r3);
  } else {
    const n = ammo[weapon] ?? 0;
    ctx.fillStyle = n <= spec.mag * 0.25 ? "#ff6b6b" : "#e6edf3";
    ctx.fillText(`${n}/${spec.mag}`, rx, r3);
  }
  ctx.textAlign = "start";
}
function hudPair(x, y, label2, value, align) {
  if (align === "left") {
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b98a8";
    ctx.fillText(label2, x, y);
    ctx.fillStyle = "#e6edf3";
    ctx.fillText(value, x + ctx.measureText(label2 + " ").width, y);
  } else {
    ctx.textAlign = "right";
    ctx.fillStyle = "#e6edf3";
    ctx.fillText(value, x, y);
    ctx.fillStyle = "#8b98a8";
    ctx.fillText(label2, x - ctx.measureText(value + " ").width, y);
  }
}
function drawSpawnRing(x, y, now) {
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(now / 150);
  ctx.strokeStyle = "#00e5a0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function drawDamageNumbers(camX, camY, now) {
  ctx.save();
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    if (d.until <= now) {
      damageNumbers.splice(i, 1);
      continue;
    }
    const life = (d.until - now) / 600;
    ctx.globalAlpha = life;
    ctx.fillStyle = "#ffd166";
    ctx.fillText(`-${d.dmg}`, d.x - camX, d.y - camY - (1 - life) * 24);
  }
  ctx.restore();
  ctx.textAlign = "start";
}
function drawHitMarker(now) {
  if (hitMarkerUntil <= now) return;
  const life = (hitMarkerUntil - now) / 120;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.save();
  ctx.globalAlpha = life;
  ctx.strokeStyle = "#00e5a0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ]) {
    ctx.moveTo(cx + sx * 6, cy + sy * 6);
    ctx.lineTo(cx + sx * 12, cy + sy * 12);
  }
  ctx.stroke();
  ctx.restore();
}
function drawKillFeed(now) {
  for (let i = killFeed.length - 1; i >= 0; i--) {
    if (killFeed[i].until <= now) killFeed.splice(i, 1);
  }
  if (killFeed.length === 0) return;
  ctx.save();
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "right";
  const rx = canvas.width - 16;
  let y = 236;
  for (const k of killFeed.slice(0, 5)) {
    ctx.globalAlpha = Math.min(1, (k.until - now) / 400);
    ctx.fillStyle = k.mine ? "#00e5a0" : "#e6edf3";
    ctx.fillText(k.text, rx, y);
    y += 18;
  }
  ctx.restore();
  ctx.textAlign = "start";
}
function drawStreakBanner(now) {
  if (streakBannerUntil <= now) return;
  const life = (streakBannerUntil - now) / 1600;
  ctx.save();
  ctx.globalAlpha = Math.min(1, life * 2);
  ctx.font = "bold 34px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#00e5a0";
  ctx.shadowColor = "#00e5a0";
  ctx.shadowBlur = 16;
  ctx.fillText(streakBannerText, canvas.width / 2, canvas.height * 0.32);
  ctx.restore();
  ctx.textAlign = "start";
}
function drawRoundUI(view, now) {
  if (view) {
    const remain = Math.max(0, view.roundEndMs - sampleServerNow());
    const mm = Math.floor(remain / 6e4);
    const ss = Math.floor(remain % 6e4 / 1e3);
    const text = `${mm}:${String(ss).padStart(2, "0")}`;
    const w = 72;
    const hgt = 30;
    const x = canvas.width / 2 - w / 2;
    const y = 14;
    ctx.fillStyle = "rgba(16,21,29,0.85)";
    ctx.strokeStyle = "#232b36";
    ctx.lineWidth = 1;
    roundRect(x, y, w, hgt, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = remain <= 3e4 ? "#ff6b6b" : "#e6edf3";
    ctx.font = "16px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, y + 21);
    ctx.textAlign = "start";
  }
  if (roundOverUntil <= now) return;
  const life = (roundOverUntil - now) / 5e3;
  ctx.save();
  ctx.globalAlpha = Math.min(1, life * 4);
  ctx.textAlign = "center";
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.42;
  const win = roundTop[0];
  const winName = win ? win.nick ?? win.id.slice(0, 6) : "\u2014";
  ctx.fillStyle = "#00e5a0";
  ctx.shadowColor = "#00e5a0";
  ctx.shadowBlur = 14;
  ctx.font = "bold 26px ui-monospace, monospace";
  ctx.fillText(`ROUND OVER \u2014 WINNER: ${winName}${win ? ` (${win.score})` : ""}`, cx, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#8b98a8";
  ctx.font = "14px ui-monospace, monospace";
  for (let i = 1; i < Math.min(3, roundTop.length); i++) {
    const r = roundTop[i];
    ctx.fillText(`${i + 1}. ${r.nick ?? r.id.slice(0, 6)} \u2014 ${r.score}`, cx, cy + 18 + i * 20);
  }
  ctx.restore();
  ctx.textAlign = "start";
}
function drawZone(view, camX, camY) {
  if (!view) return;
  const zx = view.zx - camX;
  const zy = view.zy - camY;
  const zr = view.zr;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(zx, zy, zr, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,60,60,0.06)";
  ctx.fill("evenodd");
  ctx.beginPath();
  ctx.arc(zx, zy, zr, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,229,160,0.55)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0,229,160,0.5)";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,229,160,0.5)";
  const ticks = 24;
  for (let i = 0; i < ticks; i++) {
    const a = i / ticks * Math.PI * 2;
    const px = zx + Math.cos(a) * zr;
    const py = zy + Math.sin(a) * zr;
    if (px < -16 || py < -16 || px > canvas.width + 16 || py > canvas.height + 16) continue;
    drawChevron(px, py, a + Math.PI, 6);
  }
  ctx.restore();
}
function drawZoneWarning(now) {
  const pulse = 0.25 + 0.2 * Math.sin(now / 200);
  const g = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.7
  );
  g.addColorStop(0, "rgba(255,60,60,0)");
  g.addColorStop(1, `rgba(255,60,60,${pulse.toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}
function drawZoneShrinkBanner(now) {
  if (now >= zoneShrinkUntil) return;
  const compact = canvas.width < 560;
  const text = compact ? "\u26A0 ZONE SHRINKING" : "\u26A0 SURVIVAL ZONE SHRINKING";
  const pulse = 0.72 + 0.28 * Math.sin(now / 180);
  ctx.save();
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const bw = ctx.measureText(text).width + (compact ? 44 : 120);
  const bh = 32;
  const bx = Math.round(canvas.width / 2 - bw / 2);
  const by = canvas.height - 62;
  const mid = by + bh / 2 + 1;
  ctx.fillStyle = "rgba(12,17,23,0.82)";
  roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.strokeStyle = `rgba(0,229,160,${(0.25 + 0.35 * pulse).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#00e5a0";
  ctx.fillText(text, canvas.width / 2, mid);
  if (!compact) {
    ctx.fillText("<<<", bx + 24, mid);
    ctx.fillText(">>>", bx + bw - 24, mid);
  }
  ctx.restore();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "start";
}
function drawPickups(view, camX, camY, now) {
  if (pickupSpots.length === 0) return;
  for (let i = 0; i < pickupSpots.length; i++) {
    if (view?.pickups[String(i)]?.on === false) continue;
    const spot = pickupSpots[i];
    const x = spot.x - camX;
    const y = spot.y - camY - Math.sin(now / 300 + i) * 3;
    if (x < -20 || y < -20 || x > canvas.width + 20 || y > canvas.height + 20) continue;
    if (spot.kind === "hp") {
      ctx.fillStyle = "rgba(0,229,160,0.18)";
      ctx.strokeStyle = "#00e5a0";
      ctx.lineWidth = 1.5;
      roundRect(x - 9, y - 9, 18, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 5);
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.strokeStyle = "#ff9f43";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
        ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
      }
      ctx.stroke();
      ctx.fillStyle = "#ff9f43";
      ctx.font = "bold 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("\xD72", x, y + 3);
      ctx.restore();
      ctx.textAlign = "start";
    }
  }
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawCornerBrackets(x, y, w, h, len, color, lw = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - len);
  ctx.stroke();
  ctx.restore();
}
function drawChevron(x, y, dir, size) {
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  ctx.beginPath();
  ctx.moveTo(x + c * size, y + s * size);
  ctx.lineTo(x - s * size * 0.7, y + c * size * 0.7);
  ctx.lineTo(x + s * size * 0.7, y - c * size * 0.7);
  ctx.closePath();
  ctx.fill();
}
function circle(x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
}
function label(text, x, y) {
  ctx.fillStyle = "#e6edf3";
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "start";
}
function clamp2(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
playBtn.addEventListener("click", () => void play());
nickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void play();
});
retryBtn.addEventListener("click", () => {
  loadingPanel.hidden = true;
  startPanel.hidden = false;
});
//# sourceMappingURL=shooter.js.map
