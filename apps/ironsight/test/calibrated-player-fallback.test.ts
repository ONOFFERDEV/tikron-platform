import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createCalibratedPlayerFallback } from "../client/calibrated-player-fallback";
import type { HitRigPoseSample } from "../src/hit-rig-pose";

function pose(overrides: Partial<HitRigPoseSample> = {}): HitRigPoseSample {
  return {
    hitVolume: { headCenter: { x: 0.1, y: 1.62, z: -0.05 }, bodyTopY: 1.42 },
    headRadius: 0.21,
    bodyRadiusUpperBound: 0.83,
    groundOffsetY: -0.4,
    ...overrides,
  };
}

function expectVector(actual: THREE.Vector3, expected: readonly [number, number, number]): void {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
}

describe("calibrated player fallback", () => {
  it("renders exact analytic hit geometry without inflating from the measured upper bound", () => {
    // Given
    const fallback = createCalibratedPlayerFallback({ id: "victim", faction: "khaki", bodyRadius: 0.4 });
    if (fallback === undefined) throw new Error("valid fallback rejected");
    // When
    const updated = fallback.update(pose());
    fallback.group.updateMatrixWorld(true);
    const bodyBounds = new THREE.Box3().setFromObject(fallback.body);
    const headBounds = new THREE.Box3().setFromObject(fallback.head);
    // Then
    expect(updated).toBe(true);
    expectVector(bodyBounds.min, [-0.4, 0, -0.4]);
    expectVector(bodyBounds.max, [0.4, 1.42, 0.4]);
    expectVector(headBounds.min, [-0.11, 1.41, -0.26]);
    expectVector(headBounds.max, [0.31, 1.83, 0.16]);
    expect(fallback.body.userData).toMatchObject({ victimId: "victim", part: "body" });
    expect(fallback.head.userData).toMatchObject({ victimId: "victim", part: "head" });
    expect(fallback.group.userData.victimId).toBeUndefined();
  });

  it("does not apply provider ground offset or parent yaw a second time", () => {
    // Given
    const fallback = createCalibratedPlayerFallback({ id: "yawed", faction: "fieldgrey", bodyRadius: 0.4 });
    if (fallback === undefined) throw new Error("valid fallback rejected");
    fallback.group.position.set(5, 2, -3);
    fallback.group.rotation.y = 0.7;
    const beforePosition = fallback.group.position.clone();
    const beforeYaw = fallback.group.rotation.y;
    // When
    fallback.update(pose());
    fallback.group.updateMatrixWorld(true);
    // Then
    expect(fallback.group.position).toEqual(beforePosition);
    expect(fallback.group.rotation.y).toBe(beforeYaw);
    expect(fallback.body.position.y).toBeCloseTo(0.71);
    expect(fallback.head.position.y).toBeCloseTo(1.62);
  });

  it("keeps oblique head and torso rays aligned after root translation and yaw", () => {
    // Given
    const fallback = createCalibratedPlayerFallback({ id: "ray", faction: "khaki", bodyRadius: 0.4 });
    if (fallback === undefined) throw new Error("valid fallback rejected");
    fallback.group.position.set(5, 2, -3);
    fallback.group.rotation.y = 0.7;
    fallback.update(pose());
    fallback.group.updateMatrixWorld(true);
    const headCenter = fallback.group.localToWorld(new THREE.Vector3(0.1, 1.62, -0.05));
    const headOrigin = headCenter.clone().add(new THREE.Vector3(2, 1, 3));
    const bodyCenter = fallback.group.localToWorld(new THREE.Vector3(0, 0.71, 0));
    const bodyOrigin = fallback.group.localToWorld(new THREE.Vector3(0, 0.71, -3));
    // When
    const headHits = new THREE.Raycaster(headOrigin, headCenter.clone().sub(headOrigin).normalize())
      .intersectObject(fallback.head, false);
    const bodyHits = new THREE.Raycaster(bodyOrigin, bodyCenter.clone().sub(bodyOrigin).normalize())
      .intersectObject(fallback.body, false);
    // Then
    expect(headHits[0]?.object.userData).toMatchObject({ victimId: "ray", part: "head" });
    expect(bodyHits[0]?.object.userData).toMatchObject({ victimId: "ray", part: "body" });
  });

  it("keeps the visible torso cap cosmetic while body claims remain side-only", () => {
    // Given
    const fallback = createCalibratedPlayerFallback({ id: "side", faction: "khaki", bodyRadius: 0.4 });
    if (fallback === undefined) throw new Error("valid fallback rejected");
    fallback.update(pose());
    fallback.group.updateMatrixWorld(true);
    // When
    const topDown = new THREE.Raycaster(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0))
      .intersectObject(fallback.body, false);
    const side = new THREE.Raycaster(new THREE.Vector3(0, 0.7, -3), new THREE.Vector3(0, 0, 1))
      .intersectObject(fallback.body, false);
    // Then
    expect(topDown).toEqual([]);
    expect(side[0]?.object.userData).toMatchObject({ victimId: "side", part: "body" });
    expect(fallback.group.getObjectByName("calibrated-fallback-body-cap")?.userData.victimId).toBeUndefined();
  });

  it("updates deterministically without scale accumulation and preserves the last valid pose", () => {
    // Given
    const fallback = createCalibratedPlayerFallback({ id: "stable", faction: "khaki", bodyRadius: 0.4 });
    if (fallback === undefined) throw new Error("valid fallback rejected");
    const valid = pose();
    fallback.update(valid);
    const firstScale = fallback.body.scale.clone();
    const firstHead = fallback.head.position.clone();
    // When
    const repeated = fallback.update(valid);
    const rejected = fallback.update(pose({ headRadius: Number.NaN }));
    // Then
    expect(repeated).toBe(true);
    expect(rejected).toBe(false);
    expect(fallback.body.scale).toEqual(firstScale);
    expect(fallback.head.position).toEqual(firstHead);
  });

  it("keeps faction instances independent while matching authority geometry at swap", () => {
    // Given
    const khaki = createCalibratedPlayerFallback({ id: "k", faction: "khaki", bodyRadius: 0.4 });
    const grey = createCalibratedPlayerFallback({ id: "g", faction: "fieldgrey", bodyRadius: 0.4 });
    if (khaki === undefined || grey === undefined) throw new Error("valid fallback rejected");
    // When
    khaki.update(pose());
    grey.update(pose());
    // Then
    expect(khaki.body.position).toEqual(grey.body.position);
    expect(khaki.body.scale).toEqual(grey.body.scale);
    expect(khaki.head.position).toEqual(grey.head.position);
    expect(khaki.head.scale).toEqual(grey.head.scale);
    expect(khaki.body.material.color.getHex()).not.toBe(grey.body.material.color.getHex());
    expect(khaki.body.geometry).not.toBe(grey.body.geometry);
    expect(khaki.body.material).not.toBe(grey.body.material);
  });

  it("keeps cosmetics non-raycast and without inherited ownership tags", () => {
    // Given
    const fallback = createCalibratedPlayerFallback({ id: "owner", faction: "khaki", bodyRadius: 0.4 });
    if (fallback === undefined) throw new Error("valid fallback rejected");
    fallback.update(pose());
    fallback.group.updateMatrixWorld(true);
    const cosmetics = fallback.group.children.filter(child => child !== fallback.body && child !== fallback.head);
    const point = new THREE.Vector3();
    let radialExtent = 0;
    for (const cosmetic of cosmetics) {
      if (!(cosmetic instanceof THREE.Mesh)) continue;
      const positions = cosmetic.geometry.getAttribute("position");
      for (let vertex = 0; vertex < positions.count; vertex += 1) {
        point.fromBufferAttribute(positions, vertex).applyMatrix4(cosmetic.matrixWorld);
        radialExtent = Math.max(radialExtent, Math.hypot(point.x, point.z));
      }
    }
    // When
    const tagged = cosmetics.filter(child => child.userData.victimId !== undefined || child.userData.part !== undefined);
    const hits = new THREE.Raycaster(new THREE.Vector3(0, 0.7, -3), new THREE.Vector3(0, 0, 1))
      .intersectObjects(cosmetics, true);
    // Then
    expect(cosmetics.length).toBeGreaterThan(0);
    expect(tagged).toEqual([]);
    expect(hits).toEqual([]);
    expect(radialExtent).toBeLessThanOrEqual(0.4 + Number.EPSILON * 8);
  });

  it("disposes each owned resource once without affecting another instance", () => {
    // Given
    const first = createCalibratedPlayerFallback({ id: "first", faction: "khaki", bodyRadius: 0.4 });
    const second = createCalibratedPlayerFallback({ id: "second", faction: "khaki", bodyRadius: 0.4 });
    if (first === undefined || second === undefined) throw new Error("valid fallback rejected");
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    first.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) resources.add(material);
    });
    let disposals = 0;
    for (const resource of resources) resource.addEventListener("dispose", () => { disposals += 1; });
    // When
    first.dispose();
    first.dispose();
    // Then
    expect(disposals).toBe(resources.size);
    expect(first.group.children).toHaveLength(0);
    expect(second.group.children.length).toBeGreaterThan(0);
    expect(second.update(pose())).toBe(true);
    expect(first.update(pose())).toBe(false);
  });

  it("rejects invalid construction without introducing a hidden runtime state", () => {
    expect(createCalibratedPlayerFallback({ id: "", faction: "khaki", bodyRadius: 0.4 })).toBeUndefined();
    expect(createCalibratedPlayerFallback({ id: "x", faction: "khaki", bodyRadius: Number.NaN })).toBeUndefined();
    expect(createCalibratedPlayerFallback({ id: "x", faction: "khaki", bodyRadius: 0 })).toBeUndefined();
  });
});
