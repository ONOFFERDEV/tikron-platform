import * as THREE from "three";
import type { RampDef } from "../src/map/types.js";

/** Wedge (triangular-prism) mesh geometry for a ramp's true sloped footprint —
 *  three has no built-in primitive for this, so it's built by hand as 5 flat
 *  faces (bottom, back, slope, two triangular ends). `DoubleSide` is used on
 *  the mesh material (see buildArena) rather than fussing over exact winding
 *  per face by hand — three flips the shading normal for back-facing
 *  triangles under DoubleSide, so lighting reads correctly and no face can
 *  end up invisibly culled regardless of the order below. */
export function buildWedgeGeometry(r: RampDef): THREE.BufferGeometry {
  const isX = r.axis === "x";
  const riseMin = isX ? r.minX : r.minZ;
  const riseMax = isX ? r.maxX : r.maxZ;
  const low = r.dir === 1 ? riseMin : riseMax;
  const high = r.dir === 1 ? riseMax : riseMin;
  const perpMin = isX ? r.minZ : r.minX;
  const perpMax = isX ? r.maxZ : r.maxX;
  const at = (rise: number, y: number, perp: number): number[] => (isX ? [rise, y, perp] : [perp, y, rise]);

  const A0 = at(low, 0, perpMin);
  const B0 = at(high, 0, perpMin);
  const C0 = at(high, r.topY, perpMin);
  const A1 = at(low, 0, perpMax);
  const B1 = at(high, 0, perpMax);
  const C1 = at(high, r.topY, perpMax);

  const quad = (p1: number[], p2: number[], p3: number[], p4: number[]): number[] => [
    ...p1, ...p2, ...p3,
    ...p1, ...p3, ...p4,
  ];
  const tri = (p1: number[], p2: number[], p3: number[]): number[] => [...p1, ...p2, ...p3];
  const positions = [
    ...quad(A0, B0, B1, A1), // bottom, flush with the floor
    ...quad(B0, C0, C1, B1), // back, vertical, full height at the high end
    ...quad(A0, C0, C1, A1), // slope — the walkable surface, matches rampSurfaceY's lerp
    ...tri(A0, B0, C0), // low-perp end cap
    ...tri(A1, B1, C1), // high-perp end cap
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}
