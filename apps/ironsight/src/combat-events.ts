import type { RecoilState } from "./recoil.js";

export interface RawAim {
  readonly yaw: number;
  readonly pitch: number;
}

export interface ShotAttempt {
  readonly kind: "attempt";
  readonly shotId: string;
  readonly weaponIndex: number;
  readonly localMonoAt: number;
  readonly rawAim: RawAim;
}

export interface AcceptedServerShotResult {
  readonly kind: "accepted";
  readonly shotId: string;
  readonly acceptedAt: number;
  readonly serverReceiveAt?: number;
  readonly serverResolveAt?: number;
  readonly ammo: { readonly mag: number; readonly reserve: number };
  readonly recoil: RecoilState;
}

export interface BlockedServerShotResult {
  readonly kind: "blocked";
  readonly shotId: string;
  readonly reason: "readiness" | "cadence" | "swap" | "reload" | "empty" | "duplicate";
  readonly retryMs: number;
  readonly serverReceiveAt?: number;
  readonly serverResolveAt?: number;
  readonly ammo: { readonly mag: number; readonly reserve: number };
  readonly recoil: RecoilState;
}

export type ServerShotResult = AcceptedServerShotResult | BlockedServerShotResult;

export interface ServerHit {
  readonly shotId: string;
  readonly victim: string;
  readonly damage: number;
  readonly part: "body" | "head";
}

export interface ServerKill {
  readonly shotId: string;
  readonly killer: string;
  readonly victim: string;
  readonly part: string;
}

export interface ShotScope {
  readonly connectionId: string;
  readonly life: number;
}

const BLOCK_REASONS: readonly BlockedServerShotResult["reason"][] = [
  "readiness",
  "cadence",
  "swap",
  "reload",
  "empty",
  "duplicate",
];

function isBlockReason(value: unknown): value is BlockedServerShotResult["reason"] {
  return typeof value === "string" && BLOCK_REASONS.some(reason => reason === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScopedShotId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^([^:]+):(\d+):(\d+)$/.exec(value);
  if (!match) return false;
  const life = Number(match[2]);
  const fireSeq = Number(match[3]);
  return Number.isSafeInteger(life) && life >= 1 && Number.isSafeInteger(fireSeq) && fireSeq >= 1;
}

function readAmmo(value: unknown): AcceptedServerShotResult["ammo"] | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.mag) || !Number.isSafeInteger(value.reserve) ||
      Number(value.mag) < 0 || Number(value.reserve) < 0) return null;
  return { mag: Number(value.mag), reserve: Number(value.reserve) };
}

function readRecoil(value: unknown): RecoilState | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.slot) || !Number.isSafeInteger(value.count) ||
      Number(value.slot) < 0 || Number(value.count) < 0 || typeof value.at !== "number" ||
      !Number.isFinite(value.at) || value.at < 0) return null;
  return { slot: Number(value.slot), count: Number(value.count), at: value.at };
}

function readServerStages(value: Record<string, unknown>): { readonly serverReceiveAt?: number; readonly serverResolveAt?: number } | null {
  const receive = value.serverReceiveAt, resolve = value.serverResolveAt;
  if (receive === undefined && resolve === undefined) return {};
  if (typeof receive !== 'number' || !Number.isFinite(receive) || receive < 0
    || typeof resolve !== 'number' || !Number.isFinite(resolve) || resolve < receive) return null;
  return { serverReceiveAt: receive, serverResolveAt: resolve };
}

export function readServerShotResult(value: unknown): ServerShotResult | null {
  if (!isRecord(value) || !isScopedShotId(value.shotId)) return null;
  const ammo = readAmmo(value.ammo);
  const recoil = readRecoil(value.recoil);
  const serverStages = readServerStages(value);
  if (!ammo || !recoil || !serverStages) return null;
  if (value.kind === "accepted") {
    if (typeof value.acceptedAt !== "number" || !Number.isFinite(value.acceptedAt) || value.acceptedAt < 0) return null;
    return { kind: "accepted", shotId: value.shotId, acceptedAt: value.acceptedAt, ammo, recoil, ...serverStages };
  }
  if (value.kind !== "blocked" || !isBlockReason(value.reason) ||
      typeof value.retryMs !== "number" || !Number.isFinite(value.retryMs) || value.retryMs < 0) return null;
  return {
    kind: "blocked",
    shotId: value.shotId,
    reason: value.reason,
    retryMs: value.retryMs,
    ammo,
    recoil,
    ...serverStages,
  };
}

export function scopedShotId(scope: ShotScope, fireSeq: number): string {
  if (scope.connectionId.length === 0 || !Number.isSafeInteger(scope.life) || scope.life < 1 ||
      !Number.isSafeInteger(fireSeq) || fireSeq < 1) {
    throw new RangeError("invalid shot scope");
  }
  return `${encodeURIComponent(scope.connectionId)}:${scope.life}:${fireSeq}`;
}

export class BoundedShotDedup {
  private readonly capacity: number;
  private readonly ids = new Set<string>();
  private readonly order: string[] = [];

  constructor(capacity = 256) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError("invalid dedup capacity");
    this.capacity = capacity;
  }

  accept(shotId: string): boolean {
    if (shotId.length === 0 || this.ids.has(shotId)) return false;
    this.ids.add(shotId);
    this.order.push(shotId);
    if (this.order.length > this.capacity) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.ids.delete(evicted);
    }
    return true;
  }

  clear(): void {
    this.ids.clear();
    this.order.length = 0;
  }
}
