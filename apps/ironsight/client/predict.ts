/**
 * Local-player movement prediction. Runs the SAME fixed-step integration the server
 * runs — importing the server's `moveAndSlide`, `canStand`, arena geometry, and
 * tunables so there is ONE physics contract, never a client copy that can drift —
 * then reconciles against the authoritative echo with a soft threshold (below it,
 * trust the local prediction for zero input lag; above it, ease toward the server;
 * a teleport-sized gap snaps). See `../src/rooms/arena-room.ts` `integrate()`.
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
import type { MoveIntent } from "./net.js";
import { WaistTraversal } from '../src/traversal.js';
import { SprintSlide } from '../src/slide.js';
import { CoreCollision } from '../src/core-gate.js';

const TICK_S = TICK_MS / 1000;

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
    if (intent.jump) this.pendingJump = true;
    if (this.alive) {
      this.accMs += Math.min(dtMs, MOVE.maxDtMs);
      while (this.accMs >= TICK_MS) {
        this.accMs -= TICK_MS;
        this.prevPos = this.pos;
        this.step(intent, yaw);
      }
    }
    const k = RECONCILE_TAU_MS > 0 && dtMs > 0 ? Math.exp(-dtMs / RECONCILE_TAU_MS) : 0;
    this.offset = { x: this.offset.x * k, y: this.offset.y * k, z: this.offset.z * k };
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
