import { Box3, Vector3, type Object3D } from "three";

import {
  WW1_ENVIRONMENT_MANIFEST,
  auditEnvironmentManifest,
  type EnvironmentAsset,
} from "../config/ww1-environment.js";

export const ENVIRONMENT_INSPECTION_CASES = [
  "normal", "bad-scale", "invalid-surface", "blocked-doorway",
] as const;

export type EnvironmentInspectionCase = (typeof ENVIRONMENT_INSPECTION_CASES)[number];
export type EnvironmentDistanceSample = {
  readonly distanceM: number;
  readonly visiblePixels: number;
};
export type EnvironmentModelInspection = {
  readonly key: EnvironmentAsset["key"];
  readonly loaded: boolean;
  readonly boundsValid: boolean;
  readonly socketsValid: boolean;
};
export type EnvironmentFailureInspection = {
  readonly attempted: true;
  readonly rejected: boolean;
};

const GEOMETRY_DIMENSION_TOLERANCE_M = 0.005;

export class EnvironmentInspectionError extends Error {
  constructor(
    readonly code: "unsupported_case",
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "EnvironmentInspectionError";
  }
}

function assertNever(value: never): never {
  throw new EnvironmentInspectionError("unsupported_case", String(value));
}

function changedAsset(key: EnvironmentAsset["key"], change: Readonly<Record<string, unknown>>): unknown {
  return {
    ...WW1_ENVIRONMENT_MANIFEST,
    assets: WW1_ENVIRONMENT_MANIFEST.assets.map((asset) => asset.key === key ? { ...asset, ...change } : asset),
  };
}

export function inspectEnvironmentFailure(caseName: Exclude<EnvironmentInspectionCase, "normal">): EnvironmentFailureInspection {
  let candidate: unknown;
  let expectedIssue: string;
  switch (caseName) {
    case "bad-scale":
      candidate = changedAsset("ammo-crate", { dimensionsM: [120, 65, 62] });
      expectedIssue = "invalid_scale";
      break;
    case "invalid-surface":
      candidate = changedAsset("field-telephone", { surfaces: [] });
      expectedIssue = "surface";
      break;
    case "blocked-doorway":
      candidate = changedAsset("timber-brace", { clearOpeningM: [1.99, 2.35] });
      expectedIssue = "doorway_clearance";
      break;
    default:
      return assertNever(caseName);
  }
  return {
    attempted: true,
    rejected: auditEnvironmentManifest(candidate).some((issue) => issue.code === expectedIssue),
  };
}

export function inspectEnvironmentModel(asset: EnvironmentAsset, root: Object3D): EnvironmentModelInspection {
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root, true);
  const size = bounds.getSize(new Vector3());
  const dimensions = [size.x, size.y, size.z];
  const boundsValid = dimensions.every((value, index) => {
    const expected = asset.dimensionsM[index];
    return expected !== undefined
      && Number.isFinite(value)
      && Math.abs(value - expected) <= GEOMETRY_DIMENSION_TOLERANCE_M;
  });
  const socketsValid = Object.keys(asset.joints).every((name) => root.getObjectByName(name) !== undefined);
  return { key: asset.key, loaded: true, boundsValid, socketsValid };
}

export function isEnvironmentReadable(samples: readonly EnvironmentDistanceSample[]): boolean {
  return samples.some((sample) => sample.distanceM <= 5 && sample.visiblePixels >= 4)
    && samples.some((sample) => sample.distanceM >= 40 && sample.visiblePixels >= 4);
}

export function requiresEnvironmentCombatReadability(
  asset: Pick<EnvironmentAsset, "dimensionsM" | "routeBoundary">,
): boolean {
  return Math.max(...asset.dimensionsM) >= 1 && asset.routeBoundary;
}
