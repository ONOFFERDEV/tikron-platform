/**
 * Raw input: pointer lock, the keyboard/mouse state, and accumulated look angles.
 * Produces a per-frame {@link MoveIntent} in the SERVER's basis (so the room and the
 * local predictor read the same numbers) plus one-shot edges (jump/reload/fire).
 *
 * Strafe is inverted on purpose: with a three.js `lookAt` camera built from the
 * server's yaw, screen-right maps to the server's −x strafe, so D → mx = −1 makes
 * "press right, move right" true. Forward (W → mz = +1) already matches.
 */
import { MOUSE_SENSITIVITY, INVERT_Y } from "./config.js";
import type { MoveIntent } from "./net.js";

const PITCH_LIMIT = Math.PI / 2 - 0.01; // matches the server's clamp

export class Input {
  /** Accumulated aim, server convention: yaw 0 → +z, increasing yaw → +x; pitch + = up. */
  yaw = 0;
  pitch = 0;
  locked = false;

  private readonly held = new Set<string>();
  private firing = false;
  private jumpEdge = false;
  private reloadEdge = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    initialYaw: number,
    private readonly onLockChange?: (locked: boolean) => void,
  ) {
    this.yaw = initialYaw;
    this.bind();
  }

  private bind(): void {
    window.addEventListener("keydown", (e) => {
      if (this.isTyping(e)) return;
      if (e.code === "Space") {
        if (!e.repeat) this.jumpEdge = true;
        e.preventDefault();
      } else if (e.code === "KeyR") {
        if (!e.repeat) this.reloadEdge = true;
      }
      this.held.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.code));
    // Losing window focus must not leave keys "stuck" down (tab-out mid-strafe).
    window.addEventListener("blur", () => {
      this.held.clear();
      this.firing = false;
    });

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (this.locked) this.firing = true;
      else void this.canvas.requestPointerLock();
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.firing = false;
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.firing = false;
      this.onLockChange?.(this.locked);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      // Mouse-right must turn the view right: with forward=(sin yaw, cos yaw) and the FPS
      // camera's screen-x axis, that means yaw DECREASES as movementX grows (user report:
      // left/right was inverted).
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      const dp = e.movementY * MOUSE_SENSITIVITY * (INVERT_Y ? 1 : -1);
      this.pitch = clamp(this.pitch + dp, -PITCH_LIMIT, PITCH_LIMIT);
      this.yaw = wrapTau(this.yaw);
    });
  }

  /** Request pointer lock (from a user gesture, e.g. clicking the resume overlay). */
  lock(): void {
    void this.canvas.requestPointerLock();
  }

  /** Whether left-fire is currently held (only true while pointer-locked). */
  get isFiring(): boolean {
    return this.firing && this.locked;
  }

  /**
   * The current movement intent. While unlocked the player is in a menu, so the
   * intent is neutral (no drifting while the mouse is free).
   */
  intent(): MoveIntent {
    if (!this.locked) {
      return { mx: 0, mz: 0, jump: false, crouch: false, sprint: false };
    }
    const mz = (this.held.has("KeyW") ? 1 : 0) - (this.held.has("KeyS") ? 1 : 0);
    const mx = (this.held.has("KeyA") ? 1 : 0) - (this.held.has("KeyD") ? 1 : 0);
    const crouch = this.held.has("ControlLeft") || this.held.has("KeyC");
    const sprint = this.held.has("ShiftLeft") || this.held.has("ShiftRight");
    return { mx, mz, jump: this.jumpEdge, crouch, sprint };
  }

  /** Consume the queued jump edge (true at most once per press). */
  consumeJump(): boolean {
    const j = this.jumpEdge;
    this.jumpEdge = false;
    return j;
  }

  /** Consume the queued reload edge. */
  consumeReload(): boolean {
    const r = this.reloadEdge;
    this.reloadEdge = false;
    return r;
  }

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target;
    return (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLElement && t.isContentEditable)
    );
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrapTau(a: number): number {
  const tau = Math.PI * 2;
  return ((a % tau) + tau) % tau;
}
