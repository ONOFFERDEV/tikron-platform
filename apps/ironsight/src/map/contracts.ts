import { MODES } from "../config.js";
import type { Vec3 } from "../physics.js";
import { walkSecondsFrom } from "./nav.js";
import type { MapDef, MapId, MapNavigationDef, MapRouteAnchor } from "./types.js";

export type MapContractIssue =
  | { readonly code: "duplicate_anchor_id"; readonly anchorId: string }
  | { readonly code: "invalid_anchor_layer"; readonly anchorId: string }
  | { readonly code: "invalid_route_link"; readonly linkId: string }
  | { readonly code: "sealed_required_route"; readonly fromId: string; readonly toId: string }
  | { readonly code: "stacked_capture_volume"; readonly anchorId: string; readonly captureId: string };

export interface MapAccessOptions {
  readonly captureRadius?: number;
  readonly navigation: MapNavigationDef;
}

export interface MapAccessValidation {
  readonly ok: boolean;
  readonly issues: readonly MapContractIssue[];
}

export function baselineMapNavigation(id: MapId, map: MapDef): MapNavigationDef {
  const anchors: MapRouteAnchor[] = [
    ...map.spawns.red.map((point, index) => ({ id: `${id}.spawn.red.${index}`, point, layer: 0, role: "spawn" } as const)),
    ...map.spawns.blue.map((point, index) => ({ id: `${id}.spawn.blue.${index}`, point, layer: 0, role: "spawn" } as const)),
    { id: `${id}.cap.a`, point: map.caps.a, layer: 0, role: "capture" },
    { id: `${id}.cap.b`, point: map.caps.b, layer: 0, role: "capture" },
    { id: `${id}.cap.c`, point: map.caps.c, layer: 0, role: "capture" },
  ];
  return { anchors, links: [] };
}

function groundDistance(grid: readonly (readonly number[])[], map: MapDef, point: Vec3): number {
  const x = Math.min(Math.round(map.bounds.width) - 1, Math.max(0, Math.floor(point.x)));
  const z = Math.min(Math.round(map.bounds.depth) - 1, Math.max(0, Math.floor(point.z)));
  return grid[z]?.[x] ?? Infinity;
}

export function validateMapAccess(map: MapDef, options: MapAccessOptions): MapAccessValidation {
  const issues: MapContractIssue[] = [];
  const anchors = new Map<string, MapRouteAnchor>();
  for (const anchor of options.navigation.anchors) {
    if (anchors.has(anchor.id)) issues.push({ code: "duplicate_anchor_id", anchorId: anchor.id });
    else anchors.set(anchor.id, anchor);
    if (anchor.point.y !== anchor.layer) issues.push({ code: "invalid_anchor_layer", anchorId: anchor.id });
  }
  for (const link of options.navigation.links) {
    if (!anchors.has(link.from) || !anchors.has(link.to) || !Number.isFinite(link.minWidth) || link.minWidth < 2) {
      issues.push({ code: "invalid_route_link", linkId: link.id });
    }
  }

  const spawns = options.navigation.anchors.filter((anchor) => anchor.role === "spawn" && anchor.layer === 0);
  const captures = options.navigation.anchors.filter((anchor) => anchor.role === "capture");
  for (const spawn of spawns) {
    const grid = walkSecondsFrom(map, spawn.point);
    for (const capture of captures) {
      if (!Number.isFinite(groundDistance(grid, map, capture.point))) {
        issues.push({ code: "sealed_required_route", fromId: spawn.id, toId: capture.id });
      }
    }
  }

  const captureRadius = options.captureRadius ?? MODES.dom.captureRadius;
  for (const capture of captures) {
    for (const anchor of options.navigation.anchors) {
      if (anchor.id === capture.id || anchor.layer === capture.layer) continue;
      if (Math.hypot(anchor.point.x - capture.point.x, anchor.point.z - capture.point.z) <= captureRadius) {
        issues.push({ code: "stacked_capture_volume", anchorId: anchor.id, captureId: capture.id });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
