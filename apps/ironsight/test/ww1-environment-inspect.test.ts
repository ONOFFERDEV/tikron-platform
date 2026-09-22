import * as T from "three";
import { describe, expect, it } from "vitest";

import { WW1_ENVIRONMENT_MANIFEST } from "../config/ww1-environment.js";
import {
  inspectEnvironmentFailure,
  inspectEnvironmentModel,
  isEnvironmentReadable,
  requiresEnvironmentCombatReadability,
} from "../client/environment-inspect-contract.js";

describe("WW1 environment inspector contract", () => {
  it("accepts a production-sized model with every declared socket", () => {
    const asset = WW1_ENVIRONMENT_MANIFEST.assets.find((candidate) => candidate.key === "ammo-crate");
    expect(asset).toBeDefined();
    if (asset === undefined) return;
    const root = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(...asset.dimensionsM));
    mesh.position.y = asset.dimensionsM[1] / 2;
    root.add(mesh, ...Object.entries(asset.joints).map(([name, position]) => {
      const socket = new T.Object3D();
      socket.name = name;
      socket.position.set(...position);
      return socket;
    }));
    expect(inspectEnvironmentModel(asset, root)).toMatchObject({ loaded: true, socketsValid: true, boundsValid: true });
  });

  it("uses the builder's 5 mm geometry tolerance without accepting a larger size error", () => {
    const asset = WW1_ENVIRONMENT_MANIFEST.assets.find((candidate) => candidate.key === "wire");
    expect(asset).toBeDefined();
    if (asset === undefined) return;
    const inspectWidth = (width: number): boolean => {
      const root = new T.Group();
      const mesh = new T.Mesh(new T.BoxGeometry(width, asset.dimensionsM[1], asset.dimensionsM[2]));
      mesh.position.y = asset.dimensionsM[1] / 2;
      root.add(mesh, ...Object.keys(asset.joints).map((name) => {
        const socket = new T.Object3D();
        socket.name = name;
        return socket;
      }));
      return inspectEnvironmentModel(asset, root).boundsValid;
    };
    expect(inspectWidth(asset.dimensionsM[0] - 0.0005)).toBe(true);
    expect(inspectWidth(asset.dimensionsM[0] - 0.006)).toBe(false);
  });

  it.each(["bad-scale", "invalid-surface", "blocked-doorway"] as const)("rejects the %s fixture through the manifest boundary", (caseName) => {
    expect(inspectEnvironmentFailure(caseName)).toEqual({ attempted: true, rejected: true });
  });

  it("requires visible samples at both combat distances", () => {
    expect(isEnvironmentReadable([{ distanceM: 5, visiblePixels: 400 }, { distanceM: 40, visiblePixels: 12 }])).toBe(true);
    expect(isEnvironmentReadable([{ distanceM: 5, visiblePixels: 400 }, { distanceM: 40, visiblePixels: 0 }])).toBe(false);
  });

  it("keeps nonblocking wire out of the route-boundary readability gate", () => {
    const wire = WW1_ENVIRONMENT_MANIFEST.assets.find((candidate) => candidate.key === "wire");
    const crate = WW1_ENVIRONMENT_MANIFEST.assets.find((candidate) => candidate.key === "ammo-crate");
    expect(wire).toBeDefined();
    expect(crate).toBeDefined();
    if (wire === undefined || crate === undefined) return;
    expect(requiresEnvironmentCombatReadability(wire)).toBe(false);
    expect(requiresEnvironmentCombatReadability({ ...wire, routeBoundary: true })).toBe(true);
    expect(requiresEnvironmentCombatReadability(crate)).toBe(true);
  });
});
