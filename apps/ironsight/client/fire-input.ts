import type { FireMode } from "../src/weapon-contract.js";

export const FIRE_PRESS_WINDOW_MS = 120;

export type FireClearReason =
  | "pointer_unlock"
  | "blur"
  | "death"
  | "offline"
  | "menu"
  | "weapon_switch";

export interface FireRequest {
  readonly kind: "press" | "held";
  readonly pressedAt: number;
}

export class FireInputBuffer {
  private heldSince: number | null = null;
  private pendingAt: number | null = null;

  press(now: number): void {
    if (!Number.isFinite(now) || this.heldSince !== null) return;
    this.heldSince = now;
    this.pendingAt = now;
  }

  release(): void {
    this.heldSince = null;
  }

  clear(_reason: FireClearReason): void {
    this.heldSince = null;
    this.pendingAt = null;
  }

  get held(): boolean {
    return this.heldSince !== null;
  }

  get active(): boolean {
    return this.heldSince !== null || this.pendingAt !== null;
  }

  take(now: number, mode: FireMode, ready: boolean): FireRequest | null {
    if (!Number.isFinite(now)) return null;
    const pendingAt = this.pendingAt;
    if (pendingAt !== null && now >= pendingAt && now - pendingAt > FIRE_PRESS_WINDOW_MS) {
      this.pendingAt = null;
    }
    if (!ready) return null;
    if (this.pendingAt !== null && now >= this.pendingAt) {
      const pressedAt = this.pendingAt;
      this.pendingAt = null;
      return { kind: "press", pressedAt };
    }
    if (mode === "automatic" && this.heldSince !== null) {
      return { kind: "held", pressedAt: this.heldSince };
    }
    return null;
  }
}
