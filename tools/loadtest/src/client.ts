import WebSocket from "ws";
import { decodeFull, applyDelta } from "@tikron/schema";
import type { Config } from "./cli.js";
import type { Recorder } from "./metrics.js";
import { getScenario, type Scenario } from "./scenarios.js";
import { AgarSchema, MovementSchema, type AgarState, type MovementState, type Vec2 } from "./schemas.js";

const STATE_FULL = 0x01;
const STATE_DELTA = 0x02;
const TTT_PLACE_INTERVAL_MS = 1000;

/** A single simulated player: one WebSocket driven by the scenario input model. */
export class SimClient {
  private ws?: WebSocket;
  private readonly scenario: Scenario;
  private inputTimer?: ReturnType<typeof setInterval>;
  private placeTimer?: ReturnType<typeof setInterval>;

  private seq = 0;
  private stopping = false;
  private started = false;

  /** Pending input send times keyed by seq, for input→ack RTT. */
  private readonly inflight = new Map<number, number>();

  // Predicted random-walk position. Seeded from — and reconciled to — the
  // server's authoritative own-player position so every sent move stays within
  // the room's speed budget (an out-of-budget teleport would be rejected and
  // snapped back, freezing the player and starving its AOI state stream).
  private readonly pos: Vec2 = { x: 0, y: 0 };
  private target: Vec2 = { x: 0, y: 0 };
  private hasServerPos = false;

  // Decoded-state tracking (agar/movement binary scenarios).
  private agarState: AgarState = { players: {}, orbs: {} };
  private movementState: MovementState = { players: {} };
  private sawOwn = false;
  private lastFrameAt = 0;

  constructor(
    private readonly config: Config,
    private readonly roomId: string,
    private readonly sessionId: string,
    private readonly rec: Recorder,
    private readonly rng: () => number,
  ) {
    this.scenario = getScenario(config.scenario);
  }

  /** Open the socket. Resolves once the WebSocket is open (connect success). */
  connect(): Promise<void> {
    this.rec.client();
    const url = `${this.config.url}/parties/${this.scenario.party}/${this.roomId}?_session=${this.sessionId}`;
    return new Promise<void>((resolve) => {
      let settled = false;
      const ws = new WebSocket(url);
      ws.binaryType = "nodebuffer";
      this.ws = ws;

      ws.on("open", () => {
        this.rec.connectSuccess();
        settled = true;
        resolve();
      });
      ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => this.onMessage(data, isBinary));
      ws.on("error", () => {
        if (!settled) {
          this.rec.connectFailure();
          settled = true;
          resolve();
        }
      });
      ws.on("close", (code: number) => {
        if (!this.stopping && code !== 1000) this.rec.unexpectedClose();
        this.clearTimers();
      });
    });
  }

  /** Begin the input loop (no-op if the socket never opened). */
  start(): void {
    if (this.started || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.started = true;

    if (this.scenario.moves) {
      const periodMs = 1000 / this.config.hz;
      this.inputTimer = setInterval(() => this.sendMove(), periodMs);
    } else {
      this.placeTimer = setInterval(() => this.sendPlace(), TTT_PLACE_INTERVAL_MS);
    }
  }

  stop(): void {
    this.stopping = true;
    this.clearTimers();
    try {
      this.ws?.close(1000);
    } catch {
      /* already closing */
    }
  }

  private clearTimers(): void {
    if (this.inputTimer) clearInterval(this.inputTimer);
    if (this.placeTimer) clearInterval(this.placeTimer);
    this.inputTimer = undefined;
    this.placeTimer = undefined;
  }

  private pickTarget(): Vec2 {
    return { x: this.rng() * this.scenario.world, y: this.rng() * this.scenario.world };
  }

  private sendMove(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Wait for the server's spawn position before moving, so the first input is
    // a small step from where the server actually placed us (not a teleport).
    if (!this.hasServerPos) return;

    // Step the random walk toward the wander target, capped at the speed budget.
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      this.target = this.pickTarget();
    } else {
      const step = Math.min(dist, this.scenario.maxStep);
      this.pos.x += (dx / dist) * step;
      this.pos.y += (dy / dist) * step;
    }

    this.seq += 1;
    const x = Math.round(this.pos.x * 100) / 100;
    const y = Math.round(this.pos.y * 100) / 100;
    const msg = `{"t":"c:msg","type":"move","seq":${this.seq},"payload":{"x":${x},"y":${y}}}`;
    if (this.scenario.sendsAcks) this.inflight.set(this.seq, now());
    this.rec.uplink(Buffer.byteLength(msg));
    ws.send(msg);
  }

  private sendPlace(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    this.seq += 1;
    const cell = Math.floor(this.rng() * 9);
    const msg = `{"t":"c:msg","type":"place","seq":${this.seq},"payload":{"cell":${cell}}}`;
    this.rec.uplink(Buffer.byteLength(msg));
    ws.send(msg);
  }

  private onMessage(data: WebSocket.RawData, isBinary: boolean): void {
    const buf = toBuffer(data);
    this.rec.downlink(buf.length);
    if (isBinary) this.onBinary(buf);
    else this.onText(buf);
  }

  private onBinary(buf: Buffer): void {
    if (buf.length === 0) return;
    this.recordFrameGap();
    const tag = buf[0];
    const body = buf.subarray(1);
    try {
      if (this.scenario.name === "agar") {
        this.agarState =
          tag === STATE_FULL
            ? decodeFull(AgarSchema, body)
            : tag === STATE_DELTA
              ? applyDelta(AgarSchema, this.agarState, body)
              : this.agarState;
        this.syncOwn(this.agarState.players[this.sessionId]);
      } else if (this.scenario.name === "movement") {
        this.movementState =
          tag === STATE_FULL
            ? decodeFull(MovementSchema, body)
            : tag === STATE_DELTA
              ? applyDelta(MovementSchema, this.movementState, body)
              : this.movementState;
        this.syncOwn(this.movementState.players[this.sessionId]);
      }
    } catch {
      this.rec.decodeError();
    }
  }

  private onText(buf: Buffer): void {
    let msg: { t?: unknown; seq?: unknown };
    try {
      msg = JSON.parse(buf.toString("utf8")) as { t?: unknown; seq?: unknown };
    } catch {
      this.rec.protocolError();
      return;
    }
    switch (msg.t) {
      case "s:ack": {
        if (typeof msg.seq === "number") this.onAck(msg.seq);
        break;
      }
      case "s:state": {
        // JSON-sync rooms (tic-tac-toe): mutation-driven, so no fixed cadence.
        this.recordFrameGap();
        break;
      }
      case "s:error": {
        this.rec.protocolError();
        break;
      }
      // s:welcome / s:msg / s:peer-joined / s:peer-left: no metric.
      default:
        break;
    }
  }

  private onAck(seq: number): void {
    const sent = this.inflight.get(seq);
    if (sent !== undefined) this.rec.rtt(now() - sent);
    // Acks are monotonic per processed input; drop anything at/under this seq
    // (unacked seqs below it were rate-limited drops that will never resolve).
    for (const key of this.inflight.keys()) {
      if (key <= seq) this.inflight.delete(key);
    }
  }

  private recordFrameGap(): void {
    const t = now();
    const gap = this.lastFrameAt === 0 ? null : t - this.lastFrameAt;
    this.lastFrameAt = t;
    this.rec.frame(gap, this.scenario.expectedCadenceMs);
  }

  private syncOwn(me: Vec2 | undefined): void {
    if (me) {
      // Reconcile the predicted position to the server's authoritative one, then
      // (re)aim the wander target if we have just spawned or reached it.
      this.pos.x = me.x;
      this.pos.y = me.y;
      if (!this.hasServerPos) {
        this.hasServerPos = true;
        this.target = this.pickTarget();
      }
      this.sawOwn = true;
      this.rec.ownPresent();
    } else if (this.sawOwn) {
      // Only an absence *after* we have joined counts (the initial full snapshot
      // is sent before onJoin adds our player, so its absence is expected).
      this.rec.ownAbsent();
    }
  }
}

function now(): number {
  return performance.now();
}

function toBuffer(data: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data as ArrayBuffer);
}
