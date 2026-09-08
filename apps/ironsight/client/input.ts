/**
 * Raw input: pointer lock, the keyboard/mouse state, and accumulated look angles.
 * Produces a per-frame {@link MoveIntent} in the SERVER's basis (so the room and the
 * local predictor read the same numbers) plus one-shot edges (jump/reload/fire).
 *
 * Strafe is inverted on purpose: with a three.js `lookAt` camera built from the
 * server's yaw, screen-right maps to the server's −x strafe, so D → mx = −1 makes
 * "press right, move right" true. Forward (W → mz = +1) already matches.
 *
 * Movement/jump/crouch/sprint/reload/grenade are all keybind-driven via the
 * injected {@link SettingsStore} — every check below reads `settings.get()`
 * fresh rather than snapshotting binds once, so a rebind made in the settings
 * panel applies to the very next keydown/frame with no reload needed. Slot
 * select (Digit1-5), mouse buttons, and scroll-wheel cycling are NOT
 * rebindable and stay as literal codes, per spec.
 */
import { MOUSE_SENSITIVITY } from "./config.js";
import type { MoveIntent } from "./net.js";
import type { BindAction, SettingsStore } from "./settings.js";

const PITCH_LIMIT = Math.PI / 2 - 0.01; // matches the server's clamp

/** True if `code` is bound to any of the 9 rebindable actions right now. */
function isBoundKey(code: string, binds: Record<BindAction, string[]>): boolean {
  return Object.values(binds).some((codes) => codes.includes(code));
}

export class Input {
  /** Accumulated aim, server convention: yaw 0 → +z, increasing yaw → +x; pitch + = up. */
  yaw = 0;
  pitch = 0;
  locked = false;
  lockRetry = false;
  /** Look-sensitivity multiplier (main sets it to fov/HIP_FOV so ADS zoom slows the turn). */
  sensScale = 1;

  private readonly held = new Set<string>();
  private firing = false;
  private jumpEdge = false;
  private reloadEdge = false;
  private adsHeldState = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    initialYaw: number,
    private readonly settings: SettingsStore,
    private readonly onLockChange?: (locked: boolean) => void,
    /** Digit1–5 pressed: switch to that loadout slot. */
    private readonly onSwitch?: (slot: number) => void,
    /** Scroll wheel: cycle to the adjacent slot (+1 = next, -1 = previous). */
    private readonly onCycle?: (dir: 1 | -1) => void,
    /** KeyG pressed: throw a grenade. */
    private readonly onNade?: () => void,
    private readonly onPing?: () => void,
  ) {
    this.yaw = initialYaw;
    this.bind();
  }

  private bind(): void {
    window.addEventListener("keydown", (e) => {
      if (this.isTyping(e)) return;
      const binds = this.settings.get().binds;
      if (this.locked && isBoundKey(e.code, binds)) e.preventDefault();

      // Action edges only fire while pointer-locked in an active match — this stops
      // menu/settings-panel keydowns (including the settings panel's own key-capture
      // mode) from leaking into gameplay: capturing a rebind onto grenade's current
      // key must not ALSO throw a live grenade, and Digit1-5 during capture must not
      // ALSO swap loadout slots. Menu keystrokes are not retained across resume;
      // losing pointer lock clears both held keys and pending action edges.
      if (this.locked) {
        if (binds.jump.includes(e.code)) {
          if (!e.repeat) this.jumpEdge = true;
        } else if (binds.reload.includes(e.code)) {
          if (!e.repeat) this.reloadEdge = true;
        } else if (binds.grenade.includes(e.code)) {
          if (!e.repeat) this.onNade?.();
        } else if (binds.ping.includes(e.code)) {
          if (!e.repeat) this.onPing?.();
        } else if (e.code.startsWith("Digit")) {
          const slot = Number(e.code.slice(5));
          if (!e.repeat && slot >= 1 && slot <= 5) this.onSwitch?.(slot);
        }
      }
      if (this.locked) this.held.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.code));
    // Losing window focus must not leave keys "stuck" down (tab-out mid-strafe).
    window.addEventListener("blur", () => {
      this.held.clear();
      this.firing = false;
      this.adsHeldState = false;
    });

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        if (this.locked) this.adsHeldState = true;
        return;
      }
      if (e.button !== 0) return;
      if (this.locked) this.firing = true;
      else this.lock();
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.firing = false;
      else if (e.button === 2) this.adsHeldState = false;
    });
    // Right-click drives ADS, not the browser context menu.
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked) return;
        this.onCycle?.(e.deltaY > 0 ? 1 : -1);
        e.preventDefault();
      },
      { passive: false },
    );

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) this.lockRetry = false;
      if (!this.locked) {
        this.held.clear();
        this.jumpEdge = false;
        this.reloadEdge = false;
        this.firing = false;
        this.adsHeldState = false;
      }
      this.onLockChange?.(this.locked);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const s = this.settings.get();
      const sens = MOUSE_SENSITIVITY * s.sensitivity * this.sensScale;
      // Mouse-right must turn the view right: with forward=(sin yaw, cos yaw) and the FPS
      // camera's screen-x axis, that means yaw DECREASES as movementX grows (user report:
      // left/right was inverted).
      this.yaw -= e.movementX * sens;
      const dp = e.movementY * sens * (s.invertY ? 1 : -1);
      this.pitch = clamp(this.pitch + dp, -PITCH_LIMIT, PITCH_LIMIT);
      this.yaw = wrapTau(this.yaw);
    });
  }

  /** Request pointer lock (from a user gesture, e.g. clicking the resume overlay). */
  lock(): void {
    // Browsers can reject a quick Resume immediately after Escape. Keep the
    // click prompt usable and explain the retry instead of leaking a rejection.
    try {
      const request = this.canvas.requestPointerLock();
      void request?.catch(() => { this.lockRetry = true; });
    } catch {
      this.lockRetry = true;
    }
  }

  /** Whether left-fire is currently held (only true while pointer-locked). */
  get isFiring(): boolean {
    return this.firing && this.locked;
  }

  /** Whether right-click ADS is currently held (only true while pointer-locked). */
  get adsHeld(): boolean {
    return this.adsHeldState && this.locked;
  }

  /**
   * The current movement intent. While unlocked the player is in a menu, so the
   * intent is neutral (no drifting while the mouse is free).
   */
  intent(): MoveIntent {
    if (!this.locked) {
      return { mx: 0, mz: 0, jump: false, crouch: false, sprint: false };
    }
    const binds = this.settings.get().binds;
    const held = (action: BindAction): boolean =>
      binds[action].some((code) => this.held.has(code));
    const mz = (held("forward") ? 1 : 0) - (held("back") ? 1 : 0);
    const mx = (held("left") ? 1 : 0) - (held("right") ? 1 : 0);
    const crouch = held("crouch");
    const sprint = held("sprint");
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
