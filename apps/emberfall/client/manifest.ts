/**
 * Pure manifest schema + fallback-resolution logic for the AssetRegistry swap
 * system (PLAN-EMBERFALL.md §6.1). Zero DOM/three.js dependency by design —
 * `assets.ts` re-exports everything here and layers the three.js runtime
 * (GLB loading, procedural mesh building) on top. Kept separate so this
 * logic is directly unit-testable in Node (test/client-assets.test.ts).
 */

export type AnimState = "idle" | "walk" | "attack" | "cast" | "hit" | "death";

/** Code-generated fallback shapes. "capsule" drives the animated humanoid rig; the rest are static props. */
export type PrimitiveKind = "capsule" | "box" | "tree" | "rock";

export interface ManifestEntry {
  /** glTF path relative to public/, e.g. "models/warrior.glb". Takes priority over `primitive` when present. */
  model?: string;
  /** Procedural fallback shape, used when `model` is absent or its GLB fails to load at runtime. */
  primitive?: PrimitiveKind;
  /** Hex tint (#rrggbb) applied to the procedural fallback material. */
  tint?: string;
  /** Uniform scale applied to the resolved visual. Defaults to 1. */
  scale?: number;
  /** Animation-state -> glTF clip name. Only meaningful alongside `model`. */
  anims?: Partial<Record<AnimState, string>>;
  /**
   * Extra glTF path(s), relative to public/, whose clips are merged with
   * `model`'s own animations before resolving `anims`. Exists for packs
   * (e.g. KayKit) that ship a character mesh and its animation rig as
   * separate GLBs sharing bone names — the mixer binds clips by node name,
   * so the rig's clips can drive the mesh directly. Only meaningful
   * alongside `model`.
   */
  animSource?: string | string[];
  /**
   * Rotation correction (radians), applied on top of `-facing` in
   * `units.ts`, compensating for a GLB whose authored "forward" axis
   * differs from the procedural capsule's (which faces +X at rotation 0).
   * Defaults to 0 (no correction) when absent.
   */
  faceOffset?: number;
}

export type Manifest = Record<string, ManifestEntry>;

const DEFAULT_TINT = "#8899aa";
const DEFAULT_PRIMITIVE: PrimitiveKind = "capsule";
const PRIMITIVE_KINDS: readonly PrimitiveKind[] = ["capsule", "box", "tree", "rock"];
const ANIM_STATES: readonly AnimState[] = ["idle", "walk", "attack", "cast", "hit", "death"];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export interface ManifestParseResult {
  manifest: Manifest;
  /** Human-readable reasons for every skipped/coerced field, surfaced via console.warn at runtime. */
  errors: string[];
}

/**
 * Validates already-`JSON.parse`d manifest data against the schema above.
 * Malformed entries are dropped (with a reason recorded) rather than thrown —
 * a broken manifest.json should degrade gracefully, never crash the boot.
 * Keys starting with "_" are metadata (e.g. "_readme") and are always skipped silently.
 */
export function parseManifest(raw: unknown): ManifestParseResult {
  const manifest: Manifest = {};
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { manifest, errors: ["manifest root must be a JSON object"] };
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith("_")) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`"${key}": entry must be an object, skipped`);
      continue;
    }
    const v = value as Record<string, unknown>;
    const entry: ManifestEntry = {};

    if (v.model !== undefined) {
      if (typeof v.model !== "string" || v.model.length === 0) {
        errors.push(`"${key}": model must be a non-empty string, skipped`);
        continue;
      }
      entry.model = v.model;
    }

    if (v.primitive !== undefined) {
      if (typeof v.primitive !== "string" || !PRIMITIVE_KINDS.includes(v.primitive as PrimitiveKind)) {
        errors.push(`"${key}": primitive must be one of ${PRIMITIVE_KINDS.join("|")}, skipped`);
        continue;
      }
      entry.primitive = v.primitive as PrimitiveKind;
    }

    if (!entry.model && !entry.primitive) {
      errors.push(`"${key}": entry needs "model" or "primitive", skipped`);
      continue;
    }

    if (v.tint !== undefined) {
      if (typeof v.tint !== "string" || !HEX_COLOR.test(v.tint)) {
        errors.push(`"${key}": tint must be a #rrggbb hex string, ignored`);
      } else {
        entry.tint = v.tint;
      }
    }

    if (v.scale !== undefined) {
      if (typeof v.scale !== "number" || !(v.scale > 0)) {
        errors.push(`"${key}": scale must be a positive number, ignored`);
      } else {
        entry.scale = v.scale;
      }
    }

    if (v.anims !== undefined) {
      if (typeof v.anims !== "object" || v.anims === null || Array.isArray(v.anims)) {
        errors.push(`"${key}": anims must be an object, ignored`);
      } else {
        const anims: Partial<Record<AnimState, string>> = {};
        for (const [state, clip] of Object.entries(v.anims as Record<string, unknown>)) {
          if (isAnimState(state) && typeof clip === "string" && clip.length > 0) anims[state] = clip;
        }
        entry.anims = anims;
      }
    }

    if (v.animSource !== undefined) {
      const sources = Array.isArray(v.animSource) ? v.animSource : [v.animSource];
      if (sources.length === 0 || sources.some((s) => typeof s !== "string" || s.length === 0)) {
        errors.push(`"${key}": animSource must be a non-empty string or array of non-empty strings, ignored`);
      } else {
        entry.animSource = v.animSource as string | string[];
      }
    }

    if (v.faceOffset !== undefined) {
      if (typeof v.faceOffset !== "number" || !Number.isFinite(v.faceOffset)) {
        errors.push(`"${key}": faceOffset must be a finite number, ignored`);
      } else {
        entry.faceOffset = v.faceOffset;
      }
    }

    manifest[key] = entry;
  }

  return { manifest, errors };
}

function isAnimState(s: string): s is AnimState {
  return (ANIM_STATES as readonly string[]).includes(s);
}

export type ResolvedSource =
  | {
      kind: "model";
      path: string;
      scale: number;
      anims: Partial<Record<AnimState, string>>;
      /** Normalized `animSource` — always an array, empty when the entry has none. */
      animSources: string[];
      /** See {@link ManifestEntry.faceOffset}. Defaults to 0. */
      faceOffset: number;
    }
  | { kind: "primitive"; primitive: PrimitiveKind; tint: string; scale: number; faceOffset: number };

/**
 * Resolves a logical id to a concrete visual source: `manifest[logicalId]` if
 * present, else `manifest["fallback"]`, else a hardcoded capsule. Never
 * throws and never returns undefined. The caller (AssetRegistry) uses this
 * ahead of any async GLB load, and again — via {@link resolveFallbackPrimitive} —
 * if that load fails at runtime.
 */
export function resolveVisualSource(manifest: Manifest, logicalId: string): ResolvedSource {
  const entry = manifest[logicalId] ?? manifest.fallback;
  if (!entry) return { kind: "primitive", primitive: DEFAULT_PRIMITIVE, tint: DEFAULT_TINT, scale: 1, faceOffset: 0 };
  if (entry.model) {
    return {
      kind: "model",
      path: entry.model,
      scale: entry.scale ?? 1,
      anims: entry.anims ?? {},
      animSources:
        entry.animSource === undefined ? [] : Array.isArray(entry.animSource) ? entry.animSource : [entry.animSource],
      faceOffset: entry.faceOffset ?? 0,
    };
  }
  return {
    kind: "primitive",
    primitive: entry.primitive ?? DEFAULT_PRIMITIVE,
    tint: entry.tint ?? DEFAULT_TINT,
    scale: entry.scale ?? 1,
    faceOffset: entry.faceOffset ?? 0,
  };
}

/**
 * The primitive source to fall back to when a `model` entry fails to load at
 * runtime. Resolves `manifest["fallback"]`, coercing to the hardcoded
 * default if that entry is itself missing or (degenerately) a model entry —
 * a failed load must never chain into another async load.
 */
export function resolveFallbackPrimitive(manifest: Manifest): Extract<ResolvedSource, { kind: "primitive" }> {
  const source = resolveVisualSource(manifest, "fallback");
  return source.kind === "primitive"
    ? source
    : { kind: "primitive", primitive: DEFAULT_PRIMITIVE, tint: DEFAULT_TINT, scale: 1, faceOffset: 0 };
}
