import { WORLD_LIMITS } from "./config.js";
import { decodeHitAnimationClip, HIT_ANIMATION_NONE } from "./hit-state-bucket.js";
import type { HitFadeSource } from "./hit-animation-timeline.js";
import type { ArenaPlayer, ArenaState, MatchPhase } from "./schema.js";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function integer(value: unknown, maximum: number): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum
    ? value
    : undefined;
}

function quantized(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

function float64(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function matchDeadline(value: unknown, mode: number): number | undefined {
  return value === Infinity && mode === 3 ? value : float64(value);
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function phase(value: unknown): MatchPhase | undefined {
  return value === "live" || value === "ended" || value === "warmup" ? value : undefined;
}

function fadeSources(value: unknown): HitFadeSource[] | undefined {
  if (!Array.isArray(value) || value.length > 29) return undefined;
  const out: HitFadeSource[] = [];
  const seen = new Set<number>();
  for (const entry of value) {
    const source = record(entry);
    const clipIndex = integer(source?.["clipIndex"], 29);
    const phaseStartedAt = float64(source?.["phaseStartedAt"]);
    const fadeOutStartedAt = float64(source?.["fadeOutStartedAt"]);
    if (clipIndex === undefined || decodeHitAnimationClip(clipIndex) === undefined
      || phaseStartedAt === undefined || fadeOutStartedAt === undefined
      || seen.has(clipIndex)) return undefined;
    seen.add(clipIndex);
    out.push({ clipIndex, phaseStartedAt, fadeOutStartedAt });
  }
  return out;
}

function player(value: unknown, fromVersion: 15 | 16 | 17): ArenaPlayer | undefined {
  const source = record(value);
  if (source === undefined) return undefined;
  const x = quantized(source["x"], 0, WORLD_LIMITS.width);
  const y = quantized(source["y"], WORLD_LIMITS.floor, WORLD_LIMITS.ceiling);
  const z = quantized(source["z"], 0, WORLD_LIMITS.depth);
  const yaw = quantized(source["yaw"], 0, Math.PI * 2);
  const pitch = quantized(source["pitch"], -Math.PI / 2, Math.PI / 2);
  const hp = integer(source["hp"], 0xff);
  const team = integer(source["team"], 0xff);
  const alive = boolean(source["alive"]);
  const crouch = boolean(source["crouch"]);
  const prot = boolean(source["prot"]);
  const k = integer(source["k"], 0xffff);
  const d = integer(source["d"], 0xffff);
  const weapon = integer(source["weapon"], 0xff);
  const nades = integer(source["nades"], 0xff);
  const reloadEnd = float64(source["reloadEnd"]);
  if (x === undefined || y === undefined || z === undefined || yaw === undefined || pitch === undefined
    || hp === undefined || team === undefined || alive === undefined || crouch === undefined
    || prot === undefined || k === undefined || d === undefined || weapon === undefined
    || nades === undefined || reloadEnd === undefined) return undefined;
  const hitClipIndex = fromVersion >= 16 ? integer(source["hitClipIndex"], 0xff) : HIT_ANIMATION_NONE;
  const hitClipStartedAt = fromVersion >= 16 ? float64(source["hitClipStartedAt"]) : 0;
  if (hitClipIndex === undefined || hitClipStartedAt === undefined) return undefined;
  if (fromVersion >= 16 && hitClipIndex !== HIT_ANIMATION_NONE && decodeHitAnimationClip(hitClipIndex) === undefined)
    return undefined;
  if (hitClipIndex === HIT_ANIMATION_NONE && hitClipStartedAt !== 0) return undefined;
  const hitBlendSources = fromVersion === 17 ? fadeSources(source["hitBlendSources"]) : [];
  const hitReactionKind = fromVersion === 17 ? integer(source["hitReactionKind"], 2) : 0;
  const hitReactionStartedAt = fromVersion === 17 ? float64(source["hitReactionStartedAt"]) : 0;
  const hitReactionSeq = fromVersion === 17 ? integer(source["hitReactionSeq"], 0xffff) : 0;
  if (hitBlendSources === undefined || hitReactionKind === undefined
    || hitReactionStartedAt === undefined || hitReactionSeq === undefined) return undefined;
  return {
    x, y, z, yaw, pitch, hp, team, alive, crouch, prot, k, d, weapon, nades, reloadEnd,
    hitClipIndex,
    hitClipStartedAt,
    hitBlendSources, hitReactionKind, hitReactionStartedAt, hitReactionSeq,
    hitSegmentSeq: 0,
    hitSegmentStartedAt: 0,
  };
}

export function migrateArenaState(fromVersion: number, oldState: unknown): ArenaState | null {
  if (fromVersion !== 15 && fromVersion !== 16 && fromVersion !== 17) return null;
  const source = record(oldState);
  const oldPlayers = record(source?.["players"]);
  if (source === undefined || oldPlayers === undefined) return null;
  const players = Object.create(null) as Record<string, ArenaPlayer>;
  for (const [id, value] of Object.entries(oldPlayers)) {
    const migrated = player(value, fromVersion);
    if (migrated === undefined) return null;
    players[id] = migrated;
  }
  const seed = integer(source["seed"], 0xffff_ffff);
  const redScore = integer(source["redScore"], 0xffff);
  const blueScore = integer(source["blueScore"], 0xffff);
  const matchPhase = phase(source["phase"]);
  const mode = integer(source["mode"], 0xff);
  if (mode === undefined) return null;
  const matchEndMs = matchDeadline(source["matchEndMs"], mode);
  const warmupEndMs = float64(source["warmupEndMs"]);
  const signalAt = float64(source["signalAt"]);
  const coreOpen = boolean(source["coreOpen"]);
  const capA = integer(source["capA"], 0xff);
  const capB = integer(source["capB"], 0xff);
  const capC = integer(source["capC"], 0xff);
  if (seed === undefined || redScore === undefined || blueScore === undefined || matchPhase === undefined
    || matchEndMs === undefined || warmupEndMs === undefined || signalAt === undefined
    || coreOpen === undefined || capA === undefined || capB === undefined
    || capC === undefined) return null;
  return {
    players, seed, redScore, blueScore, phase: matchPhase, matchEndMs, warmupEndMs,
    signalAt, coreOpen, mode, capA, capB, capC,
  };
}
