import { LagCompensator, type LagCompensatorOptions } from "@tikron/server";
import type { SoldierHitVolume } from "./hit-calibration.js";
import type { Vec3 } from "./physics.js";
import {
  HitAuthorityHistory,
  type HitAuthorityEvaluator,
  type HitAuthorityFrame,
  type RewoundHitAuthority,
} from "./hit-authority-history.js";

export type { HitAuthorityEvaluator, HitAuthorityFrame, RewoundHitAuthority } from "./hit-authority-history.js";

type Horizontal = { readonly x: number; readonly z: number };

export interface HitVolumeWorldChannels {
  readonly roots: ReadonlyMap<string, Horizontal>;
  readonly feetYs: ReadonlyMap<string, number>;
  readonly headCenters: ReadonlyMap<string, Vec3>;
  readonly bodyTopYs: ReadonlyMap<string, number>;
}

export interface RewoundHitVolume {
  readonly x: number;
  readonly z: number;
  readonly feetY: number;
  readonly yaw: number;
  readonly hitVolume: SoldierHitVolume;
}

export class HitVolumeHistory {
  private readonly roots: LagCompensator;
  private readonly feet: LagCompensator;
  private readonly heads: LagCompensator;
  private readonly vertical: LagCompensator;
  private readonly authority?: HitAuthorityHistory;

  constructor(options: LagCompensatorOptions = {}, evaluator?: HitAuthorityEvaluator) {
    this.roots = new LagCompensator(options);
    this.feet = new LagCompensator(options);
    this.heads = new LagCompensator(options);
    this.vertical = new LagCompensator(options);
    if (evaluator !== undefined) this.authority = new HitAuthorityHistory(
      evaluator, options.depthMs, options.maxSnapshots);
  }

  get depthMs(): number { return this.roots.depthMs; }
  get size(): number { return this.roots.size; }
  get authoritySize(): number { return this.authority?.size ?? 0; }

  record(tick: number, serverTimeMs: number, channels: HitVolumeWorldChannels): void {
    const roots = new Map<string, { x: number; y: number }>();
    const feet = new Map<string, { x: number; y: number }>();
    const heads = new Map<string, { x: number; y: number }>();
    const vertical = new Map<string, { x: number; y: number }>();
    for (const [id, root] of channels.roots) {
      const feetY = channels.feetYs.get(id);
      const head = channels.headCenters.get(id);
      const bodyTopY = channels.bodyTopYs.get(id);
      if (feetY === undefined || head === undefined || bodyTopY === undefined) continue;
      if (![root.x, root.z, feetY, head.x, head.y, head.z, bodyTopY].every(Number.isFinite)) continue;
      roots.set(id, { x: root.x, y: root.z });
      feet.set(id, { x: feetY, y: 0 });
      heads.set(id, { x: head.x, y: head.z });
      vertical.set(id, { x: head.y, y: bodyTopY });
    }
    this.roots.record(tick, serverTimeMs, roots);
    this.feet.record(tick, serverTimeMs, feet);
    this.heads.record(tick, serverTimeMs, heads);
    this.vertical.record(tick, serverTimeMs, vertical);
  }

  atTime(serverTimeMs: number): Map<string, RewoundHitVolume> {
    return this.reconstruct(history => history.atTime(serverTimeMs));
  }

  at(tick: number): Map<string, RewoundHitVolume> {
    return this.reconstruct(history => history.at(tick));
  }

  recordAuthority(tick: number, serverTimeMs: number, frames: ReadonlyMap<string, HitAuthorityFrame>): void {
    this.authority?.record(tick, serverTimeMs, frames);
  }

  authorityAtTime(serverTimeMs: number): Map<string, RewoundHitAuthority> {
    return this.authority?.atTime(serverTimeMs) ?? new Map();
  }

  clear(): void {
    this.roots.clear();
    this.feet.clear();
    this.heads.clear();
    this.vertical.clear();
    this.authority?.clear();
  }

  private reconstruct(sample: (history: LagCompensator) => Map<string, { x: number; y: number }>): Map<string, RewoundHitVolume> {
    const roots = sample(this.roots);
    const feet = sample(this.feet);
    const heads = sample(this.heads);
    const vertical = sample(this.vertical);
    const out = new Map<string, RewoundHitVolume>();
    for (const [id, root] of roots) {
      const foot = feet.get(id), head = heads.get(id), height = vertical.get(id);
      if (!foot || !head || !height) continue;
      const dx = head.x - root.x, dz = head.y - root.y;
      const value: RewoundHitVolume = {
        x: root.x,
        z: root.y,
        feetY: foot.x,
        yaw: 0,
        hitVolume: {
          headCenter: {
            x: dx,
            y: height.x - foot.x,
            z: dz,
          },
          bodyTopY: height.y - foot.x,
        },
      };
      if ([value.x, value.z, value.feetY, value.yaw, value.hitVolume.headCenter.x,
        value.hitVolume.headCenter.y, value.hitVolume.headCenter.z, value.hitVolume.bodyTopY].every(Number.isFinite)) {
        out.set(id, value);
      }
    }
    return out;
  }
}
