import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { applySwitchyardPanels } from '../client/switchyard-surfaces.js';
import { buildWedgeGeometry } from '../client/site-wedge.js';

describe('Switchyard panel wear coordinates', () => {
  it('follows actual rotated, scaled panel edges without changing cover or baked UVs', () => {
    const geometry = new T.BoxGeometry(0.2, 2, 3);
    geometry.setAttribute('uv1', geometry.getAttribute('uv').clone());
    const before = geometry.clone();
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial());
    mesh.position.set(17, 3, 61); mesh.rotation.set(0.2, Math.PI / 3, 0.4); mesh.scale.set(1, 1.5, 2);
    applySwitchyardPanels(mesh);
    for (const key of ['position', 'normal', 'uv', 'uv1'])
      expect(geometry.getAttribute(key).array).toEqual(before.getAttribute(key).array);
    expect(geometry.index!.array).toEqual(before.index!.array);
    const panel = geometry.getAttribute('switchyardPanel');
    expect([...panel.array].every(Number.isFinite)).toBe(true);
    const dimensions = new Set<string>();
    for (let face = 0; face < 6; face++) {
      const first = face * 4, w = panel.getZ(first), h = panel.getW(first);
      dimensions.add(`${w.toFixed(1)},${h.toFixed(1)}`);
      const corners = new Set<string>();
      for (let i = first; i < first + 4; i++) {
        expect(panel.getZ(i)).toBe(w); expect(panel.getW(i)).toBe(h);
        expect(Math.min(Math.abs(panel.getX(i)), Math.abs(panel.getX(i) - w))).toBeLessThan(0.001);
        expect(Math.min(Math.abs(panel.getY(i)), Math.abs(panel.getY(i) - h))).toBeLessThan(0.001);
        corners.add(`${Math.round(panel.getX(i) / w)},${Math.round(panel.getY(i) / h)}`);
      }
      expect(corners.size).toBe(4);
    }
    expect([...dimensions].sort()).toEqual(['0.2,3.0', '0.2,6.0', '3.0,6.0']);
    geometry.dispose(); before.dispose(); mesh.material.dispose();
  });

  it('handles duplicated ramp corners while leaving triangular sides and smooth curves unmarked', () => {
    const ramp = buildWedgeGeometry({ minX: 74, maxX: 76, minZ: 36, maxZ: 42, topY: 3, axis: 'z', dir: 1 });
    const rampMesh = new T.Mesh(ramp, new T.MeshStandardMaterial());
    applySwitchyardPanels(rampMesh);
    const panel = ramp.getAttribute('switchyardPanel');
    for (let i = 12; i < 18; i++) {
      expect(panel.getZ(i)).toBeCloseTo(2);
      expect(panel.getW(i)).toBeCloseTo(Math.hypot(6, 3));
    }
    for (let i = 18; i < 24; i++) expect(panel.getZ(i)).toBe(0);
    ramp.dispose(); rampMesh.material.dispose();
    const triangle = new T.BufferGeometry();
    triangle.setAttribute('position', new T.Float32BufferAttribute([0,0,0, 3,0,0, 0,2,0], 3));
    triangle.setIndex([0,1,2]); triangle.computeVertexNormals();
    for (const geometry of [new T.CylinderGeometry(1, 1, 2, 12), triangle]) {
      const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial());
      applySwitchyardPanels(mesh);
      expect([...geometry.getAttribute('switchyardPanel').array].every(v => v === 0)).toBe(true);
      geometry.dispose(); mesh.material.dispose();
    }
  });
});
