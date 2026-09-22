import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fieldEquipmentParts, loadFieldRadio, prepareSoldierAtlas } from '../client/field-equipment.js';

describe('WW1 field equipment', () => {
  it.each(['anchor', 'flanker', 'sniper'] as const)('%s carries the required original kit without hit metadata', kit => {
    const parts = fieldEquipmentParts(kit);
    expect(new Set(parts.map(part => part.kind))).toEqual(new Set([
      'webbing', 'ammunition-pouches', 'canteen', 'pack', 'blanket-roll',
    ]));
    for (const part of parts) {
      expect(part.geometry.index).toBeNull();
      expect(part.geometry.getAttribute('position').count).toBeGreaterThan(20);
      expect(part.geometry.getAttribute('normal').count).toBe(part.geometry.getAttribute('position').count);
      expect(Array.from(part.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      expect(part.geometry.userData.victimId).toBeUndefined();
      part.geometry.dispose();
    }
  });

  it('does not fetch or instantiate the removed personal radio', async () => {
    expect(await loadFieldRadio()).toBeUndefined();
  });

  it('excludes baked equipment primitives from visual-model ray hits', () => {
    const root = new THREE.Group();
    const wool = new THREE.MeshStandardMaterial({ name: 'khaki-wool' });
    const canvas = new THREE.MeshStandardMaterial({ name: 'khaki-canvas' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wool);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), canvas);
    root.add(body, pack);
    prepareSoldierAtlas(root);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, -2), new THREE.Vector3(0, 0, 1));
    expect(ray.intersectObject(body)).toHaveLength(2);
    expect(ray.intersectObject(pack)).toHaveLength(0);
    expect(pack.userData.fieldEquipment).toBe(true);
  });

  it('excludes equipment material groups while preserving body hits in one exported draw', () => {
    const body = new THREE.BoxGeometry(0.8, 1, 0.4); body.translate(-0.7, 0, 0);
    const pack = new THREE.BoxGeometry(0.5, 0.7, 0.3); pack.translate(0.7, 0, 0);
    const geometry = mergeGeometries([body, pack], true)!;
    const mesh = new THREE.Mesh(geometry, [
      new THREE.MeshStandardMaterial({ name: 'fieldgrey-wool' }),
      new THREE.MeshStandardMaterial({ name: 'fieldgrey-canvas' }),
    ]);
    prepareSoldierAtlas(mesh);
    const bodyRay = new THREE.Raycaster(new THREE.Vector3(-0.7, 0, -2), new THREE.Vector3(0, 0, 1));
    const packRay = new THREE.Raycaster(new THREE.Vector3(0.7, 0, -2), new THREE.Vector3(0, 0, 1));
    expect(bodyRay.intersectObject(mesh).length).toBeGreaterThan(0);
    expect(packRay.intersectObject(mesh)).toHaveLength(0);
    expect(mesh.userData.fieldEquipmentRaycast).toBe(true);
    geometry.dispose(); body.dispose(); pack.dispose();
  });
});
