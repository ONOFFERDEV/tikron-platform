/**
 * Local-player movement prediction. Runs the SAME fixed-step integration the server
 * runs — importing the server's `moveAndSlide`, `canStand`, arena geometry, and
 * tunables so there is ONE physics contract, never a client copy that can drift.
 * Connected prediction compares the acknowledged command and replays pending
 * intents; an older position-only caller retains the legacy threshold fallback.
 * See `../src/rooms/arena-room.ts` `integrate()`.
 */
import { moveAndSlide, canStand, type Box, type Bounds, type Vec3 } from "../src/physics.js";
import type { MapDef, RampDef } from "../src/map/types.js";
import { MOVE, PLAYER, TICK_MS } from "../src/config.js";
import {
  RECONCILE_SOFT_M,
  RECONCILE_SNAP_M,
  RECONCILE_FRAC,
  RECONCILE_TAU_MS,
} from "./config.js";
import type { SlideInput as MoveIntent } from '../src/slide.js';
import { WaistTraversal } from '../src/traversal.js';
import { SprintSlide } from '../src/slide.js';
import { CoreCollision } from '../src/core-gate.js';
import type { Room } from '@tikron/client';
import { isMovementSnapshot, MOVEMENT_SYNC, restoreControllers, saveControllers,
  type MovementCommand, type MovementSnapshot, type MovementState } from '../src/rooms/movement-sync.js';

const TICK_S = TICK_MS / 1000;
const START_RETRY_MS = 500;

export interface PredictionCorrection {
  epoch: number; tick: number; ack: number; pending: number; reset: boolean;
  /** Delayed position vs current prediction: useful telemetry, NOT a correction error. */
  rawError: number;
  /** Authoritative position vs prediction of that exact acknowledged command. */
  matchedError: number | null;
  correction: number;
}

export class Predictor {
  pos: Vec3 = { x: 0, y: 0, z: 0 };
  crouch = false;
  alive = true;
  private boxes: readonly Box[];
  private readonly collision: CoreCollision;
  private readonly ramps: readonly RampDef[];
  private readonly bounds: Bounds;
  private vy = 0;
  private grounded = true;
  private traversal = new WaistTraversal();
  private traversalStep = false;
  private slide = new SprintSlide();
  private offset: Vec3 = { x: 0, y: 0, z: 0 };
  private pendingJump = false;
  private accMs = 0;
  private seeded = false;
  private respawnSnap = false;
  private connection: Pick<Room, 'send' | 'onMessage'> | undefined;
  private epoch = -1;
  private sequence = 0;
  private acknowledged = 0;
  private snapshotTick = -1;
  private startRetryMs = 0;
  private predictionPaused = false;
  private pending: { command: MovementCommand; state: MovementState }[] = [];
  /** Optional inspection observer; no per-frame log or global in production. */
  onCorrection: ((sample: PredictionCorrection) => void) | undefined;
  // `pos` only advances in fixed TICK_MS (20 Hz) steps — matching the server's
  // own integration exactly is the whole point (see this file's header), but
  // rendering `pos` directly means the camera visibly holds still for several
  // 144 Hz render frames between ticks, then jumps a whole tick's movement in
  // one frame (measured: ~7 static frames then a 0.45 m jump while sprinting —
  // "moves in steps" report). `prevPos` is the position from just before the
  // most recent tick; `eye()` interpolates between the two using how far into
  // the NEXT tick `accMs` has already accumulated, so the camera moves a little
  // every render frame instead of only on tick boundaries. Rotation was never
  // affected — it's driven straight from mouse input every render frame, no
  // fixed-step gate.
  private prevPos: Vec3 = { x: 0, y: 0, z: 0 };
  private primed = false;

  constructor(map: MapDef) {
    this.collision = new CoreCollision(map);
    this.boxes = map.boxes;
    this.ramps = map.ramps ?? [];
    this.bounds = map.bounds;
    this.launchPads = map.launchPads;
  }
  private readonly launchPads: MapDef['launchPads'];
  setCoreOpen(open: boolean): void { this.boxes = this.collision.boxes(open); }

  /** Main's integration hook. The room owns elapsed simulation time and physics;
   * this sends at most one command per locally predicted TICK_MS. Repeated
   * commands repair dropped/rate-limited frames without duplicating movement.
   * Remove Net.setMoveIntent at the call site; retain Net.setLook and frame(). */
  connect(room: Pick<Room, 'send' | 'onMessage'>, online: () => boolean): () => void {
    if (this.connection) throw Error('Predictor already connected');
    // Match Net's online gate. PartySocket queues writes while disconnected;
    // retrying into that queue would turn a bounded window into an unbounded
    // transport backlog. Welcome starts a fresh epoch when the link returns.
    const send: Room['send'] = (type, payload) => { if (online()) room.send(type, payload); };
    this.connection = { send, onMessage:room.onMessage.bind(room) };
    const start = () => {
      this.epoch = -1; this.pending = []; this.accMs = 0; this.pendingJump = false;
      this.startRetryMs = 0;
      this.predictionPaused = false;
      send('movementStart', { version:MOVEMENT_SYNC.version });
    };
    const offMovement = room.onMessage('movement', payload => {
      if (isMovementSnapshot(payload)) this.receiveMovement(payload);
    });
    const offWelcome = room.onMessage(message => { if (message.t === 's:welcome') start(); });
    start();
    return () => { offMovement(); offWelcome(); this.connection = undefined; this.pending = []; };
  }

  private save(): MovementState {
    return { pos:{...this.pos}, vy:this.vy, grounded:this.grounded, crouch:this.crouch,
      ...saveControllers(this.slide,this.traversal) };
  }
  private restore(state: MovementState): void {
    this.pos = {...state.pos}; this.vy=state.vy; this.grounded=state.grounded; this.crouch=state.crouch;
    const controllers=restoreControllers(state);
    this.slide=controllers.slide; this.traversal=controllers.traversal; this.traversalStep=false;
  }

  private receiveMovement(snapshot: MovementSnapshot): void {
    if (snapshot.epoch < this.epoch || snapshot.epoch === this.epoch &&
      (snapshot.tick < this.snapshotTick || snapshot.ack < this.acknowledged || snapshot.ack > this.sequence)) return;
    const reset = snapshot.epoch !== this.epoch || snapshot.alive !== this.alive;
    const before = {...this.pos}, beforePrev = {...this.prevPos}, beforeEye = this.eye();
    const matched = this.pending.find(p=>p.command.seq===snapshot.ack);
    const distance = (a: Vec3,b: Vec3) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    const matchedError = reset || !matched ? null : distance(matched.state.pos,snapshot.pos);
    const jump = this.pendingJump;
    this.setCoreOpen(snapshot.coreOpen);
    this.restore(snapshot);
    this.alive=snapshot.alive; this.seeded=true; this.respawnSnap=false;
    this.epoch=snapshot.epoch; this.snapshotTick=snapshot.tick; this.acknowledged=snapshot.ack;
    if (reset) {
      this.pending=[]; this.sequence=snapshot.ack; this.pendingJump=false; this.accMs=0;
      this.predictionPaused=false;
      this.prevPos={...this.pos}; this.offset={x:0,y:0,z:0}; this.primed=true;
    } else {
      this.pending=this.pending.filter(p=>p.command.seq>snapshot.ack);
      this.prevPos={...this.pos};
      // Reapply only unacknowledged commands to the complete authoritative
      // kinematic state (including slide/traversal progress and cooldowns).
      for (const p of this.pending) {
        this.prevPos=this.pos; this.pendingJump=p.command.jump;
        this.step(p.command,p.command.yaw); p.state=this.save();
      }
      if (this.pending.length === 0) this.prevPos = {
        x:beforePrev.x+this.pos.x-before.x, y:beforePrev.y+this.pos.y-before.y, z:beforePrev.z+this.pos.z-before.z,
      };
      // A capped window has already rendered its final step. Replaying it must
      // not resurrect that step's interpolation segment: its compensating offset
      // would decay backward even though the acknowledged position is exact.
      // Resume interpolation only when frame() actually predicts a new command.
      if (this.predictionPaused) this.prevPos = { ...this.pos };
      this.pendingJump=jump;
      const correction=distance(before,this.pos);
      this.offset={x:0,y:0,z:0};
      if (correction < RECONCILE_SNAP_M) {
        const afterEye=this.eye();
        this.offset={x:beforeEye.x-afterEye.x,y:beforeEye.y-afterEye.y,z:beforeEye.z-afterEye.z};
      }
    }
    this.onCorrection?.({epoch:snapshot.epoch,tick:snapshot.tick,ack:snapshot.ack,
      pending:this.pending.length,reset,rawError:distance(before,snapshot.pos),matchedError,correction:distance(before,this.pos)});
  }

  /** Advance prediction for a render frame: integrate held intent at the fixed tick
   *  rate, buffering the jump edge across frames, then decay the render offset. */
  frame(dtMs: number, intent: MoveIntent, yaw: number): void {
    if (!this.primed) {
      // First call after construction, or after main.ts seeds `pos` directly
      // (pre-game-loop spawn placement) — without this, the very first
      // interpolated eye() would blend from the constructor's {0,0,0} default
      // toward the real spawn position instead of starting there.
      this.prevPos = { ...this.pos };
      this.primed = true;
    }
    if (intent.jump && this.alive) this.pendingJump = true;
    if (this.connection && this.epoch < 0) {
      this.startRetryMs += Math.min(dtMs, MOVE.maxDtMs);
      if (this.startRetryMs >= START_RETRY_MS) {
        this.startRetryMs = 0;
        this.connection.send('movementStart', { version:MOVEMENT_SYNC.version });
      }
    }
    if (this.alive && (!this.connection || this.epoch >= 0)) {
      this.accMs += Math.min(dtMs, MOVE.maxDtMs);
      while (this.accMs >= TICK_MS) {
        this.accMs -= TICK_MS;
        if (this.connection && this.pending.length >= MOVEMENT_SYNC.maxPending) {
          // Stop prediction, not delivery. Otherwise losing the last batch of a
          // full window deadlocks: no acknowledgement, no new step, no retry.
          // Consume elapsed time so retries stay at 20 Hz even at high render FPS.
          this.prevPos = { ...this.pos };
          this.predictionPaused = true;
          this.sendPending();
          continue;
        }
        this.predictionPaused = false;
        this.prevPos = this.pos;
        const command: MovementCommand = { ...intent,ads:intent.ads===true,jump:this.pendingJump,
          seq:this.sequence+1,yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)) };
        this.step(command, command.yaw);
        if (this.connection) {
          this.sequence=command.seq;
          this.pending.push({command,state:this.save()});
          this.sendPending();
        }
      }
    }
    const k = RECONCILE_TAU_MS > 0 && dtMs > 0 ? Math.exp(-dtMs / RECONCILE_TAU_MS) : 0;
    this.offset = { x: this.offset.x * k, y: this.offset.y * k, z: this.offset.z * k };
  }

  private sendPending(): void {
    this.connection?.send('movementSteps', { epoch:this.epoch,
      commands:this.pending.slice(0,MOVEMENT_SYNC.maxBatch).map(p=>p.command) });
  }

  private step(inp: MoveIntent, yaw: number): void {
    const traversed = this.traversal.step(TICK_MS, { ...inp, jump: this.pendingJump }, this.grounded,
      this.pos,yaw,this.boxes,this.bounds,this.ramps,this.launchPads);
    this.traversalStep = traversed !== null;
    if (traversed) {
      this.slide = new SprintSlide(); this.pendingJump = false; this.crouch = false;
      this.pos=traversed.pos; this.vy=0; this.grounded=traversed.grounded; return;
    }
    const momentum = this.slide.step(TICK_MS, { ...inp, jump: this.pendingJump }, this.grounded, yaw);
    // Crouch (resolved before speed/height, like the server). Standing up is refused
    // when the taller capsule would clip cover/ceiling.
    if (this.crouch && !inp.crouch) {
      if (canStand(this.pos.x, this.pos.y, this.pos.z, PLAYER.radius, PLAYER.standHeight, this.boxes, this.bounds)) {
        this.crouch = false;
      }
    } else {
      this.crouch = inp.crouch;
    }

    let speed: number = MOVE.walk;
    if (this.crouch) speed = MOVE.crouch;
    else if (inp.sprint && !inp.ads && inp.mz > 0 && this.grounded) speed = MOVE.sprint;

    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    let wx = sy * inp.mz + cy * inp.mx;
    let wz = cy * inp.mz - sy * inp.mx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    if (momentum) { wx = momentum.x; wz = momentum.z; speed = momentum.speed; }

    if (this.grounded && this.pendingJump) {
      this.vy = MOVE.jumpSpeed;
      this.grounded = false;
    }
    this.pendingJump = false;

    this.vy -= MOVE.gravity * TICK_S;

    const height = this.crouch ? PLAYER.crouchHeight : PLAYER.standHeight;
    const delta: Vec3 = { x: wx * speed * TICK_S, y: this.vy * TICK_S, z: wz * speed * TICK_S };
    const res = moveAndSlide(
      this.pos,
      PLAYER.radius,
      height,
      delta,
      this.vy,
      this.boxes,
      this.bounds,
      MOVE.stepUp,
      this.ramps,
    );
    this.slide.observe(Math.hypot(res.pos.x - this.pos.x, res.pos.z - this.pos.z), res.grounded);
    this.pos = res.pos;
    this.vy = res.vy;
    this.grounded = res.grounded;
  }

  /** Fold in the authoritative echo of the local player. */
  reconcile(server: Vec3): void {
    if (this.connection) return; // owner movement snapshots carry the acknowledgement
    if (!this.seeded || this.respawnSnap) {
      this.snapTo(server);
      this.seeded = true;
      this.respawnSnap = false;
      return;
    }
    const ex = server.x - this.pos.x;
    const ey = server.y - this.pos.y;
    const ez = server.z - this.pos.z;
    const d = Math.hypot(ex, ey, ez);
    if (d >= RECONCILE_SNAP_M) {
      this.snapTo(server);
    } else if (d > RECONCILE_SOFT_M) {
      // Absorb a fraction of the error into position, and push the same amount into
      // the render offset so `pos + offset` doesn't jump — the offset then decays out.
      // `prevPos` moves by the same nudge so the tick-interpolation in eye() keeps
      // spanning "pure movement" between the two — otherwise this correction would
      // leak into the interpolated blend as an extra, un-cancelled partial jump.
      const cx = ex * RECONCILE_FRAC;
      const cy = ey * RECONCILE_FRAC;
      const cz = ez * RECONCILE_FRAC;
      this.pos = { x: this.pos.x + cx, y: this.pos.y + cy, z: this.pos.z + cz };
      this.prevPos = { x: this.prevPos.x + cx, y: this.prevPos.y + cy, z: this.prevPos.z + cz };
      this.offset = { x: this.offset.x - cx, y: this.offset.y - cy, z: this.offset.z - cz };
    }
  }

  private snapTo(p: Vec3): void {
    this.pos = { x: p.x, y: p.y, z: p.z };
    this.prevPos = { x: p.x, y: p.y, z: p.z };
    this.vy = 0;
    this.grounded = true;
    this.offset = { x: 0, y: 0, z: 0 };
    this.accMs = 0;
    this.slide = new SprintSlide();
    this.traversal = new WaistTraversal(); this.traversalStep = false;
    this.pendingJump = false;
    this.crouch = false;
  }

  /** Liveness gate: a dead→alive transition arms the next reconcile to snap (a
   *  respawn may land within the soft threshold of the corpse). */
  setAlive(a: boolean): void {
    if (this.connection) return; // liveness and kinematics come from the same owner snapshot
    if (a && !this.alive) this.respawnSnap = true;
    if (!a) { this.traversal = new WaistTraversal(); this.traversalStep = false; this.slide = new SprintSlide(); this.pendingJump = false; }
    this.alive = a;
  }

  /** Camera eye position (feet + offset + eye height for the current stance).
   *  Feet are `prevPos` blended toward `pos` by how far into the next tick
   *  `accMs` has already accumulated — smooths the fixed-tick-rate `pos`
   *  updates out over every render frame instead of only on tick boundaries
   *  (see this class's header comment on `prevPos`). */
  eye(): Vec3 {
    const alpha = TICK_MS > 0 ? Math.min(1, this.accMs / TICK_MS) : 1;
    const fx = this.prevPos.x + (this.pos.x - this.prevPos.x) * alpha;
    const fy = this.prevPos.y + (this.pos.y - this.prevPos.y) * alpha;
    const fz = this.prevPos.z + (this.pos.z - this.prevPos.z) * alpha;
    const h = this.crouch ? PLAYER.crouchEye : PLAYER.standEye;
    return {
      x: fx + this.offset.x,
      y: fy + this.offset.y + h,
      z: fz + this.offset.z,
    };
  }

  get isGrounded(): boolean {
    return this.grounded;
  }
  get isTraversing(): boolean { return this.traversal.active || this.traversalStep; }
  get isLaunching(): boolean { return this.traversal.kind === 'launch'; }
  get traversalProgress(): number { return this.traversal.progress; }
  get isSliding(): boolean { return this.slide.active; }
  get slideProgress(): number { return this.slide.progress; }
}
