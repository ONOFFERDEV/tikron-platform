/**
 * Local-player movement prediction. Runs the SAME fixed-step integration the server
 * runs — importing the server's `moveAndSlide`, `canStand`, arena geometry, and
 * tunables so there is ONE physics contract, never a client copy that can drift —
 * then reconciles against the authoritative echo with a soft threshold (below it,
 * trust the local prediction for zero input lag; above it, ease toward the server;
 * a teleport-sized gap snaps). See `../src/rooms/arena-room.ts` `integrate()`.
 */
import { moveAndSlide, canStand, type Box, type Vec3 } from "../src/physics.js";
import { ARENA1_BOXES, ARENA1_BOUNDS } from "../src/map/arena1.js";
import { MOVE, PLAYER, TICK_MS } from "../src/config.js";
import {
  RECONCILE_SOFT_M,
  RECONCILE_SNAP_M,
  RECONCILE_FRAC,
  RECONCILE_TAU_MS,
} from "./config.js";
import type { MoveIntent } from "./net.js";

const boxes: readonly Box[] = ARENA1_BOXES;
const TICK_S = TICK_MS / 1000;

export class Predictor {
  pos: Vec3 = { x: 0, y: 0, z: 0 };
  crouch = false;
  alive = true;
  private vy = 0;
  private grounded = true;
  private offset: Vec3 = { x: 0, y: 0, z: 0 };
  private pendingJump = false;
  private accMs = 0;
  private seeded = false;
  private respawnSnap = false;

  /** Advance prediction for a render frame: integrate held intent at the fixed tick
   *  rate, buffering the jump edge across frames, then decay the render offset. */
  frame(dtMs: number, intent: MoveIntent, yaw: number): void {
    if (intent.jump) this.pendingJump = true;
    if (this.alive) {
      this.accMs += Math.min(dtMs, MOVE.maxDtMs);
      while (this.accMs >= TICK_MS) {
        this.accMs -= TICK_MS;
        this.step(intent, yaw);
      }
    }
    const k = RECONCILE_TAU_MS > 0 && dtMs > 0 ? Math.exp(-dtMs / RECONCILE_TAU_MS) : 0;
    this.offset = { x: this.offset.x * k, y: this.offset.y * k, z: this.offset.z * k };
  }

  private step(inp: MoveIntent, yaw: number): void {
    // Crouch (resolved before speed/height, like the server). Standing up is refused
    // when the taller capsule would clip cover/ceiling.
    if (this.crouch && !inp.crouch) {
      if (canStand(this.pos.x, this.pos.y, this.pos.z, PLAYER.radius, PLAYER.standHeight, boxes, ARENA1_BOUNDS)) {
        this.crouch = false;
      }
    } else {
      this.crouch = inp.crouch;
    }

    let speed: number = MOVE.walk;
    if (this.crouch) speed = MOVE.crouch;
    else if (inp.sprint && inp.mz > 0 && this.grounded) speed = MOVE.sprint;

    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    let wx = sy * inp.mz + cy * inp.mx;
    let wz = cy * inp.mz - sy * inp.mx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }

    if (this.grounded && this.pendingJump) {
      this.vy = MOVE.jumpSpeed;
      this.grounded = false;
    }
    this.pendingJump = false;

    this.vy -= MOVE.gravity * TICK_S;

    const height = this.crouch ? PLAYER.crouchHeight : PLAYER.standHeight;
    const delta: Vec3 = { x: wx * speed * TICK_S, y: this.vy * TICK_S, z: wz * speed * TICK_S };
    const res = moveAndSlide(this.pos, PLAYER.radius, height, delta, this.vy, boxes, ARENA1_BOUNDS);
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
      const cx = ex * RECONCILE_FRAC;
      const cy = ey * RECONCILE_FRAC;
      const cz = ez * RECONCILE_FRAC;
      this.pos = { x: this.pos.x + cx, y: this.pos.y + cy, z: this.pos.z + cz };
      this.offset = { x: this.offset.x - cx, y: this.offset.y - cy, z: this.offset.z - cz };
    }
  }

  private snapTo(p: Vec3): void {
    this.pos = { x: p.x, y: p.y, z: p.z };
    this.vy = 0;
    this.grounded = true;
    this.offset = { x: 0, y: 0, z: 0 };
    this.accMs = 0;
  }

  /** Liveness gate: a dead→alive transition arms the next reconcile to snap (a
   *  respawn may land within the soft threshold of the corpse). */
  setAlive(a: boolean): void {
    if (a && !this.alive) this.respawnSnap = true;
    this.alive = a;
  }

  /** Camera eye position (feet + offset + eye height for the current stance). */
  eye(): Vec3 {
    const h = this.crouch ? PLAYER.crouchEye : PLAYER.standEye;
    return {
      x: this.pos.x + this.offset.x,
      y: this.pos.y + this.offset.y + h,
      z: this.pos.z + this.offset.z,
    };
  }

  get isGrounded(): boolean {
    return this.grounded;
  }
}
