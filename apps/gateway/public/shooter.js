// ../../packages/protocol/dist/index.js
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
    clone: (v) => v
    // primitives are immutable — no copy needed
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
    clone: (v) => v
    // numbers are immutable
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
    }
  };
}
function decodeFull(codec, bytes) {
  return codec.readFull(new ByteReader(bytes));
}
function applyDelta(codec, prev, bytes) {
  return codec.readDelta(new ByteReader(bytes), prev);
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
    const offset2 = serverTime + rtt / 2 - t1;
    this.samples.push({ offset: offset2, rtt });
    while (this.samples.length > this.maxSamples)
      this.samples.shift();
    this.rttMs = median(this.samples.map((s) => s.rtt));
    this.offsetMs = median(this.samples.map((s) => s.offset));
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
  constructor(opts) {
    this.delayMs = opts.delayMs ?? 100;
    this.lerp = opts.lerp;
    this.maxSnapshots = opts.maxSnapshots ?? 64;
  }
  push(time, state) {
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
    if (target <= first.time)
      return first.state;
    if (target >= last.time)
      return last.state;
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
};

// ../../packages/client/dist/index.js
var networkConditionsWarned = false;
var subtickClockWarned = false;
var RoomJoinError = class extends Error {
  /** Pre-Welcome server Error code (e.g. `"room_full"`), else `"connection-closed"`. */
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
          this.connectionId = msg.connectionId;
          off();
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
    if (!this.stateCodec)
      return;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    if (bytes.length < 13)
      return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = bytes[0];
    const tick = view.getUint32(1, true);
    const serverTime = view.getFloat64(5, true);
    const body = bytes.subarray(13);
    if (tag === 1)
      this.state = decodeFull(this.stateCodec, body);
    else if (tag === 2)
      this.state = applyDelta(this.stateCodec, this.state, body);
    else
      return;
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
      alive: "bool"
    })
  ),
  seed: "u32"
});
var SHOOTER = {
  // A 3000² map (up from 2000²) so 64 players spread out: at the spawn min-
  // separation (300u) a 2000² map is right at its packing limit for 64 points,
  // while 3000² leaves comfortable headroom. Keep the quant position range above
  // in lock-step with this.
  world: 3e3,
  /** AOI view radius — well under the map so interest management actually bites. */
  viewRadius: 600,
  maxSpeed: 500,
  stepMs: 50,
  // 20 Hz simulation
  maxHp: 100,
  shotDamage: 34,
  // three hits to down a full-hp player
  shotRange: 550,
  // < viewRadius (600) so every hit resolves within the shooter's view
  hitRadius: 40,
  // perpendicular distance to the ray that still counts as a hit
  respawnTicks: 30,
  // 30 × 50 ms = 1.5 s downed before respawn
  // Spread-spawn tuning (see pickSpawn in shooter-spawn.ts).
  spawnMinSep: 300,
  // a spawn keeps ≥ this from every living player
  spawnRingMin: 400,
  // ring band around a random survivor a candidate is drawn from
  spawnRingMax: 700,
  spawnCenterJitter: 300
  // half-extent of the center box used when nobody is alive
};

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

// demo/camera.ts
function smoothAxis(current, target, dtMs, smoothTimeMs, snap) {
  const gap = target - current;
  if (Math.abs(gap) >= snap) return target;
  if (dtMs <= 0 || smoothTimeMs <= 0) return target;
  const alpha = 1 - Math.exp(-dtMs / smoothTimeMs);
  return current + gap * alpha;
}
function smoothAngle(current, target, dtMs, smoothTimeMs, snap) {
  const twoPi = Math.PI * 2;
  let delta = (target - current) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  else if (delta < -Math.PI) delta += twoPi;
  if (Math.abs(delta) >= snap) return target;
  if (dtMs <= 0 || smoothTimeMs <= 0) return target;
  const alpha = 1 - Math.exp(-dtMs / smoothTimeMs);
  return current + delta * alpha;
}

// demo/movement.ts
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function integrateMove(pos, dirX, dirY, dtMs, maxSpeed, world, maxDtMs) {
  const dt = Math.min(Math.max(dtMs, 0), maxDtMs) / 1e3;
  const len = Math.hypot(dirX, dirY);
  if (len === 0 || dt === 0) return { x: pos.x, y: pos.y };
  const step = maxSpeed * dt;
  return {
    x: clamp(pos.x + dirX / len * step, 0, world),
    y: clamp(pos.y + dirY / len * step, 0, world)
  };
}
function decayOffset(offset2, dtMs, tauMs) {
  if (tauMs <= 0 || dtMs <= 0) return { x: 0, y: 0 };
  const k = Math.exp(-dtMs / tauMs);
  return { x: offset2.x * k, y: offset2.y * k };
}
function applyCorrection(continuous2, offset2, authoritative, snap) {
  const ex = authoritative.x - continuous2.x;
  const ey = authoritative.y - continuous2.y;
  if (Math.hypot(ex, ey) >= snap) {
    return { continuous: { x: authoritative.x, y: authoritative.y }, offset: { x: 0, y: 0 } };
  }
  return {
    continuous: { x: authoritative.x, y: authoritative.y },
    offset: {
      x: continuous2.x + offset2.x - authoritative.x,
      y: continuous2.y + offset2.y - authoritative.y
    }
  };
}

// demo/shooter-client.ts
var MAX_PLAYERS = 64;
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
var sounds = {};
var assetsReady = false;
var audioUnlocked = false;
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
function loadAudio(url, onSettled) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      onSettled();
      resolve(ok ? audio : null);
    };
    audio.addEventListener("canplaythrough", () => finish(true), { once: true });
    audio.addEventListener("error", () => finish(false), { once: true });
    setTimeout(() => finish(true), 4e3);
    audio.preload = "auto";
    audio.volume = 0.25;
    audio.src = url;
    audio.load();
  });
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
      const audio = await loadAudio(resolveAsset(file), bump);
      if (audio) sounds[key] = audio;
    })
  ]);
  assetsReady = true;
  onProgress(1);
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  for (const audio of Object.values(sounds)) {
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(() => {
    });
  }
}
function playSound(key) {
  const base = sounds[key];
  if (!base || !audioUnlocked) return;
  const clip = base.cloneNode(true);
  clip.volume = base.volume;
  void clip.play().catch(() => {
  });
}
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
function makeCrates(seed) {
  const rng = xorshift32(seed);
  const unit = () => rng() / 4294967295;
  const margin = 80;
  const span = SHOOTER.world - margin * 2;
  const crates2 = [];
  for (let i = 0; i < 44; i++) {
    crates2.push({ x: margin + unit() * span, y: margin + unit() * span, size: 26 + unit() * 28 });
  }
  return crates2;
}
var crates = [];
var crateSeed = null;
var predictor = new InputPredictor({ x: 1e3, y: 1e3 }, { apply: (_s, i) => ({ ...i }) });
var buffer = new SnapshotBuffer({ delayMs: 100, lerp: lerpState });
var continuous = { x: 1e3, y: 1e3 };
var offset = { x: 0, y: 0 };
var selfAlive = true;
var cam = { x: 1e3, y: 1e3 };
var lastRenderMs = 0;
var MAX_FRAME_MS = SHOOTER.stepMs;
var OFFSET_TAU_MS = 100;
var CORRECTION_SNAP = 300;
var entityRender = /* @__PURE__ */ new Map();
var ENTITY_SMOOTH_MS = 100;
var ENTITY_SNAP_DIST = 300;
var myId = "";
var seq = 0;
var aim = 0;
var mouse = { x: 0, y: 0 };
var keys = /* @__PURE__ */ new Set();
var tracers = [];
var effects = [];
var hitFlash = /* @__PURE__ */ new Map();
var prevAlive = /* @__PURE__ */ new Map();
var sampleServerNow = () => performance.now();
var nickname = "";
var running = false;
function lerpState(a, b, t) {
  const players = {};
  for (const id of Object.keys(b.players)) {
    const pb = b.players[id];
    const pa = a.players[id];
    players[id] = pa ? { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, aim: pb.aim, hp: pb.hp, score: pb.score, alive: pb.alive } : pb;
  }
  return { players, seed: b.seed };
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
  room.onMessage("rejected", (payload) => {
    const p = payload;
    const applied = applyCorrection(continuous, offset, { x: p.x, y: p.y }, CORRECTION_SNAP);
    continuous = applied.continuous;
    offset = applied.offset;
  });
  room.onMessage("shot", (payload) => {
    const p = payload;
    const now = performance.now();
    tracers.push({
      ox: p.ox,
      oy: p.oy,
      tx: p.ox + Math.cos(p.dir) * SHOOTER.shotRange,
      ty: p.oy + Math.sin(p.dir) * SHOOTER.shotRange,
      hit: p.hitId !== void 0,
      until: now + 120
    });
    effects.push({ kind: "muzzle", x: p.ox, y: p.oy, dir: p.dir, until: now + 80 });
    playSound("shot");
    if (p.hitId !== void 0) {
      hitFlash.set(p.hitId, now + 140);
      playSound("hit");
    }
  });
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener("mousedown", () => {
    room.send("shoot", { dir: aim });
  });
  addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  setInterval(() => {
    aim = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
    seq += 1;
    const snapshot = { x: continuous.x, y: continuous.y };
    room.send("move", { x: snapshot.x, y: snapshot.y, aim });
    predictor.predict(seq, snapshot);
  }, SHOOTER.stepMs);
  running = true;
  resizeCanvas();
  addEventListener("resize", resizeCanvas);
  requestAnimationFrame(render);
  void refreshLeaderboard();
  setInterval(() => void refreshLeaderboard(), 5e3);
}
function ingestState(st, room) {
  buffer.push(room.lastStateServerTime ?? performance.now(), st);
  const me = st.players[myId];
  if (me) {
    predictor.reconcile({ x: me.x, y: me.y }, room.lastAckSeq);
    selfAlive = me.alive;
    if (Math.hypot(me.x - continuous.x, me.y - continuous.y) >= CORRECTION_SNAP) {
      continuous = { x: me.x, y: me.y };
      offset = { x: 0, y: 0 };
    }
  }
  if (crateSeed === null && typeof st.seed === "number") {
    crateSeed = st.seed;
    crates = makeCrates(st.seed);
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
    } else if (was === false && p.alive) {
      effects.push({ kind: "respawn", x: p.x, y: p.y, until: now + 450 });
    }
    prevAlive.set(id, p.alive);
  }
  for (const id of [...prevAlive.keys()]) {
    if (!seenNow.has(id)) prevAlive.delete(id);
  }
}
async function refreshLeaderboard() {
  if (!lbEl) return;
  try {
    const res = await fetch("/api/leaderboard?board=shooter-top&limit=5");
    if (!res.ok) return;
    const rows = await res.json();
    const items = rows.map((r) => `<li>${escapeHtml(r.displayName ?? r.playerId.slice(0, 6))} \u2014 ${r.score}</li>`).join("");
    lbEl.innerHTML = `<b>shooter-top</b><ol>${items}</ol>`;
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
  if (selfAlive) {
    const dir = moveDir();
    continuous = integrateMove(continuous, dir.x, dir.y, dtMs, SHOOTER.maxSpeed, SHOOTER.world, MAX_FRAME_MS);
  }
  offset = decayOffset(offset, dtMs, OFFSET_TAU_MS);
  const renderX = continuous.x + offset.x;
  const renderY = continuous.y + offset.y;
  cam.x = renderX;
  cam.y = renderY;
  const camX = Math.round(cam.x - canvas.width / 2);
  const camY = Math.round(cam.y - canvas.height / 2);
  drawGround(camX, camY);
  drawWorldBounds(camX, camY);
  drawCrates(camX, camY);
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    if (tr.until <= now) {
      tracers.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = tr.hit ? "#00e5a0" : "rgba(230,237,243,0.35)";
    ctx.lineWidth = tr.hit ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(tr.ox - camX, tr.oy - camY);
    ctx.lineTo(tr.tx - camX, tr.ty - camY);
    ctx.stroke();
  }
  drawEffects(camX, camY, now);
  const view = buffer.sample(sampleServerNow());
  const seen = /* @__PURE__ */ new Set();
  if (view) {
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id];
      seen.add(id);
      const prev = entityRender.get(id);
      const sm = prev ? {
        x: smoothAxis(prev.x, pl.x, dtMs, ENTITY_SMOOTH_MS, ENTITY_SNAP_DIST),
        y: smoothAxis(prev.y, pl.y, dtMs, ENTITY_SMOOTH_MS, ENTITY_SNAP_DIST),
        aim: smoothAngle(prev.aim, pl.aim, dtMs, ENTITY_SMOOTH_MS, Math.PI)
      } : { x: pl.x, y: pl.y, aim: pl.aim };
      entityRender.set(id, sm);
      drawPlayer(
        { aim: sm.aim, hp: pl.hp, score: pl.score, alive: pl.alive },
        sm.x - camX,
        sm.y - camY,
        false,
        hitFlash.get(id),
        now
      );
    }
  }
  for (const id of [...entityRender.keys()]) {
    if (!seen.has(id)) entityRender.delete(id);
  }
  const meState = view?.players[myId];
  const visible = Math.max(view ? Object.keys(view.players).length : 0, 1);
  drawPlayer(
    { aim, hp: meState?.hp ?? SHOOTER.maxHp, score: meState?.score ?? 0, alive: meState?.alive ?? true },
    renderX - camX,
    renderY - camY,
    true,
    hitFlash.get(myId),
    now
  );
  drawHud(meState?.hp ?? SHOOTER.maxHp, meState?.score ?? 0, visible);
  requestAnimationFrame(render);
}
function drawGround(camX, camY) {
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tile = 64;
  const startX = -((camX % tile + tile) % tile);
  const startY = -((camY % tile + tile) % tile);
  const ground = sprites.groundTile;
  if (ground) {
    for (let x = startX; x < canvas.width; x += tile) {
      for (let y = startY; y < canvas.height; y += tile) {
        ctx.drawImage(ground, x, y, tile, tile);
      }
    }
    return;
  }
  ctx.strokeStyle = "rgba(35,43,54,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x < canvas.width; x += tile) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = startY; y < canvas.height; y += tile) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}
function drawWorldBounds(camX, camY) {
  ctx.strokeStyle = "rgba(0,229,160,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-camX, -camY, SHOOTER.world, SHOOTER.world);
}
function drawCrates(camX, camY) {
  if (crates.length === 0) return;
  const sprite = sprites.crate;
  for (const cr of crates) {
    const x = cr.x - camX;
    const y = cr.y - camY;
    if (x < -cr.size || y < -cr.size || x > canvas.width + cr.size || y > canvas.height + cr.size) continue;
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
    ctx.fillStyle = flashing ? "#ff6b6b" : isSelf ? "#00e5a0" : "#58a6ff";
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
  ctx.fillStyle = isSelf ? "#00e5a0" : "#58a6ff";
  ctx.fillRect(x - w / 2, y - 26, w * Math.max(0, p.hp) / SHOOTER.maxHp, 4);
  label(`${p.score}`, x, y + 30);
}
function drawHud(hp, score, count) {
  const pad = 14;
  const w = 190;
  const h = 76;
  const x = pad;
  const y = canvas.height - h - pad;
  ctx.fillStyle = "rgba(16,21,29,0.85)";
  ctx.strokeStyle = "#232b36";
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  const bx = x + 14;
  const by = y + 16;
  const bw = w - 28;
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(bx, by, bw, 10);
  const frac = clamp2(hp / SHOOTER.maxHp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? "#00e5a0" : frac > 0.25 ? "#f2cc60" : "#ff6b6b";
  ctx.fillRect(bx, by, bw * frac, 10);
  ctx.fillStyle = "#e6edf3";
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`HP ${Math.max(0, Math.round(hp))}`, bx, by + 26);
  ctx.textAlign = "right";
  ctx.fillText(`SCORE ${score}`, bx + bw, by + 26);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8b98a8";
  ctx.fillText(`${count}/${MAX_PLAYERS} in view`, bx, by + 42);
  ctx.textAlign = "start";
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
