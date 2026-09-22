import type {
  ServerHit,
  ServerKill,
  ServerShotResult,
  ShotAttempt,
} from "../src/combat-events.js";

export type ShotFeedbackEvent =
  | { readonly kind: "predicted"; readonly shotId: string; readonly weaponIndex: number; readonly recoilScale: number; readonly rawAim: ShotAttempt["rawAim"] }
  | { readonly kind: "remote_shot"; readonly shotId: string; readonly from: string }
  | { readonly kind: "accepted"; readonly shotId: string }
  | { readonly kind: "blocked"; readonly shotId: string; readonly reason: Extract<ServerShotResult, { kind: "blocked" }>["reason"] }
  | { readonly kind: "confirmed_hit"; readonly shotId: string; readonly victim: string; readonly part: ServerHit["part"]; readonly damage: number }
  | { readonly kind: "confirmed_kill"; readonly shotId: string; readonly victim: string; readonly part: string };

interface RetainedShot {
  accepted: boolean;
  resolved: boolean;
  hitEmitted: boolean;
  killEmitted: boolean;
  pendingHit?: ServerHit;
  pendingKill?: ServerKill;
}

export interface ShotFeedbackOptions {
  readonly connectionId: string;
  readonly reducedMotion: boolean;
  readonly capacity?: number;
}

export class ShotFeedback {
  private readonly connectionId: string;
  private readonly ownPrefix: string;
  private reducedMotion: boolean;
  private readonly capacity: number;
  private readonly shots = new Map<string, RetainedShot>();
  private readonly order: string[] = [];
  private readonly remoteEchoes = new Set<string>();
  private readonly remoteOrder: string[] = [];

  constructor(options: ShotFeedbackOptions) {
    if (options.connectionId.length === 0) throw new RangeError("connectionId must not be empty");
    if (options.capacity !== undefined && (!Number.isSafeInteger(options.capacity) || options.capacity < 1)) {
      throw new RangeError("capacity must be a positive safe integer");
    }
    this.connectionId = options.connectionId;
    this.ownPrefix = `${encodeURIComponent(options.connectionId)}:`;
    this.reducedMotion = options.reducedMotion;
    this.capacity = options.capacity ?? 256;
  }

  attempt(value: ShotAttempt): Extract<ShotFeedbackEvent, { kind: "predicted" }> | null {
    if (!value.shotId.startsWith(this.ownPrefix) || this.shots.has(value.shotId)) return null;
    this.retain(value.shotId);
    return {
      kind: "predicted",
      shotId: value.shotId,
      weaponIndex: value.weaponIndex,
      recoilScale: this.reducedMotion ? 0.35 : 1,
      rawAim: value.rawAim,
    };
  }

  shotEcho(value: { readonly shotId?: string; readonly from: string }): Extract<ShotFeedbackEvent, { kind: "remote_shot" }> | null {
    if (value.from === this.connectionId || value.shotId === undefined ||
        this.remoteEchoes.has(value.shotId)) return null;
    this.remoteEchoes.add(value.shotId);
    this.remoteOrder.push(value.shotId);
    if (this.remoteOrder.length > this.capacity) {
      const evicted = this.remoteOrder.shift();
      if (evicted !== undefined) this.remoteEchoes.delete(evicted);
    }
    return { kind: "remote_shot", shotId: value.shotId, from: value.from };
  }

  result(value: ServerShotResult): readonly ShotFeedbackEvent[] {
    const state = this.shots.get(value.shotId);
    if (!state || state.resolved) return [];
    state.resolved = true;
    if (value.kind === "blocked") {
      state.pendingHit = undefined;
      state.pendingKill = undefined;
      return [{ kind: "blocked", shotId: value.shotId, reason: value.reason }];
    }
    state.accepted = true;
    return [{ kind: "accepted", shotId: value.shotId }, ...this.flush(state, value.shotId)];
  }

  hit(value: ServerHit): readonly ShotFeedbackEvent[] {
    const state = this.shots.get(value.shotId);
    if (!state || state.hitEmitted || (state.resolved && !state.accepted)) return [];
    if (!state.accepted) { state.pendingHit = value; return []; }
    state.hitEmitted = true;
    return [this.hitEvent(value)];
  }

  kill(value: ServerKill): readonly ShotFeedbackEvent[] {
    const state = this.shots.get(value.shotId);
    if (!state || state.killEmitted || (state.resolved && !state.accepted)) return [];
    if (!state.accepted) { state.pendingKill = value; return []; }
    state.killEmitted = true;
    return [this.killEvent(value)];
  }

  clear(): void {
    this.shots.clear();
    this.order.length = 0;
    this.remoteEchoes.clear();
    this.remoteOrder.length = 0;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  inspect(): { readonly retained: number; readonly remoteEchoes: number } {
    return { retained: this.shots.size, remoteEchoes: this.remoteEchoes.size };
  }

  private retain(shotId: string): void {
    this.shots.set(shotId, { accepted: false, resolved: false, hitEmitted: false, killEmitted: false });
    this.order.push(shotId);
    if (this.order.length <= this.capacity) return;
    const evicted = this.order.shift();
    if (evicted !== undefined) this.shots.delete(evicted);
  }

  private flush(state: RetainedShot, shotId: string): readonly ShotFeedbackEvent[] {
    const events: ShotFeedbackEvent[] = [];
    if (state.pendingHit !== undefined) {
      state.hitEmitted = true;
      events.push(this.hitEvent(state.pendingHit));
      state.pendingHit = undefined;
    }
    if (state.pendingKill !== undefined) {
      state.killEmitted = true;
      events.push(this.killEvent(state.pendingKill));
      state.pendingKill = undefined;
    }
    return events.filter(event => event.shotId === shotId);
  }

  private hitEvent(value: ServerHit): Extract<ShotFeedbackEvent, { kind: "confirmed_hit" }> {
    return { kind: "confirmed_hit", shotId: value.shotId, victim: value.victim, part: value.part, damage: value.damage };
  }

  private killEvent(value: ServerKill): Extract<ShotFeedbackEvent, { kind: "confirmed_kill" }> {
    return { kind: "confirmed_kill", shotId: value.shotId, victim: value.victim, part: value.part };
  }
}
