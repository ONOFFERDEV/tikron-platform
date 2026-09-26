import type { Box } from "../physics.js";
import type { FloorFace } from "./terrain.js";
import type { MapDef, RampDef } from "./types.js";

/** Client-only presentation (impact/footstep); never on the wire or in server hit logic. */
export const MAP_SURFACES = ["mud", "gravel", "wood", "metal", "concrete", "brick", "sandbag"] as const;
export type MapSurface = (typeof MAP_SURFACES)[number];
const MAP_SURFACE_SET: ReadonlySet<string> = new Set(MAP_SURFACES);

export type SurfaceBinding =
  | { readonly id: string; readonly surface: MapSurface; readonly kind: "box"; readonly box: Box }
  | { readonly id: string; readonly surface: MapSurface; readonly kind: "ramp"; readonly ramp: RampDef }
  | { readonly id: string; readonly surface: MapSurface; readonly kind: "terrain"; readonly face: FloorFace };

export type SurfaceBindingErrorCode = "duplicate_id" | "duplicate_support" | "foreign_support" | "unsupported_surface";

export class SurfaceBindingError extends Error {
  override readonly name = "SurfaceBindingError";

  constructor(
    readonly code: SurfaceBindingErrorCode,
    readonly bindingId: string,
  ) {
    super(`${code}: ${bindingId}`);
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unexpected surface support: ${String(value)}`);
}

function supportBelongsToMap(map: MapDef, binding: SurfaceBinding): boolean {
  switch (binding.kind) {
    case "box":
      return map.boxes.includes(binding.box);
    case "ramp":
      return map.ramps?.includes(binding.ramp) ?? false;
    case "terrain":
      return map.terrain?.faces.includes(binding.face) ?? false;
    default:
      return assertNever(binding);
  }
}

function supportObject(binding: SurfaceBinding): object {
  switch (binding.kind) {
    case "box":
      return binding.box;
    case "ramp":
      return binding.ramp;
    case "terrain":
      return binding.face;
    default:
      return assertNever(binding);
  }
}

export function withSurfaceBindings(map: MapDef, bindings: readonly SurfaceBinding[]): MapDef {
  const ids = new Set<string>();
  const supports = new Set<object>();
  for (const binding of bindings) {
    if (!MAP_SURFACE_SET.has(binding.surface)) throw new SurfaceBindingError("unsupported_surface", binding.id);
    if (ids.has(binding.id)) throw new SurfaceBindingError("duplicate_id", binding.id);
    ids.add(binding.id);
    const support = supportObject(binding);
    if (supports.has(support)) throw new SurfaceBindingError("duplicate_support", binding.id);
    supports.add(support);
    if (!supportBelongsToMap(map, binding)) throw new SurfaceBindingError("foreign_support", binding.id);
  }
  return { ...map, surfaceBindings: [...bindings] };
}

export function surfaceForBox(map: MapDef, box: Box): MapSurface | undefined {
  return map.surfaceBindings?.find((binding) => binding.kind === "box" && binding.box === box)?.surface;
}

export function surfaceForRamp(map: MapDef, ramp: RampDef): MapSurface | undefined {
  return map.surfaceBindings?.find((binding) => binding.kind === "ramp" && binding.ramp === ramp)?.surface;
}

export function surfaceForTerrainFace(map: MapDef, face: FloorFace): MapSurface | undefined {
  return map.surfaceBindings?.find((binding) => binding.kind === "terrain" && binding.face === face)?.surface;
}
