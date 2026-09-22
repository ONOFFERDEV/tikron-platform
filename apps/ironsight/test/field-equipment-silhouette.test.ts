import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fieldEquipmentParts, type FieldEquipmentPart } from '../client/field-equipment.js';

function bounds(part: FieldEquipmentPart): THREE.Box3 {
  part.geometry.computeBoundingBox();
  const box = part.geometry.boundingBox;
  if (!box) throw new TypeError(`Missing bounds for ${part.kind}`);
  return box.clone().translate(new THREE.Vector3(...part.center));
}

function namedPart(parts: readonly FieldEquipmentPart[], name: string): FieldEquipmentPart {
  const part = parts.find(candidate => candidate.geometry.name === name);
  if (!part) throw new TypeError(`Missing equipment component ${name}`);
  return part;
}

describe.each(['anchor', 'flanker', 'sniper'] as const)('%s field-kit silhouette', kit => {
  let parts: readonly FieldEquipmentPart[];
  // Given a role, when its visible equipment is constructed.
  beforeEach(() => { parts = fieldEquipmentParts(kit); });
  afterEach(() => { for (const part of parts) part.geometry.dispose(); });

  it('keeps every pack and blanket component below the nape when worn', () => {
    const back = parts.filter(part => part.kind === 'pack' || part.kind === 'blanket-roll');
    expect(back.length).toBeGreaterThanOrEqual(2);
    for (const part of back) {
      expect(bounds(part).max.y, `${part.kind}/${part.geometry.name} top`).toBeLessThanOrEqual(0.015);
    }
  });

  it('moves pack closures and blanket bindings as one lower-spine assembly', () => {
    const back = parts.filter(part => part.kind === 'pack' || part.kind === 'blanket-roll');
    expect(back.length).toBeGreaterThanOrEqual(2);
    expect(new Set(back.map(part => part.bone))).toEqual(new Set(['spine_02']));
  });

  it('hangs the blanket axis below the pack body when worn', () => {
    const pack = bounds(namedPart(parts, 'pack-body'));
    const blanket = bounds(namedPart(parts, 'blanket-roll-body'));
    expect(blanket.getCenter(new THREE.Vector3()).y).toBeLessThan(pack.min.y);
    expect(bounds(namedPart(parts, 'pack-flap')).max.y).toBeLessThanOrEqual(0.015);
  });

  it('keeps equipment above the thigh when worn', () => {
    for (const part of parts) {
      expect(bounds(part).min.y, `${part.kind}/${part.geometry.name} bottom`).toBeGreaterThanOrEqual(-0.52);
    }
  });

  it('shows an upright canteen with a separate top cap when worn', () => {
    const body = bounds(namedPart(parts, 'canteen-body'));
    const cap = bounds(namedPart(parts, 'canteen-cap'));
    const size = body.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(size.x);
    expect(cap.min.y).toBeGreaterThanOrEqual(body.max.y - 0.005);
    expect(cap.max.y).toBeGreaterThan(body.max.y);
  });

  it('fits the triangle budget with finite positions and normals when constructed', () => {
    const triangles = parts.reduce((sum, part) => sum
      + (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) / 3, 0);
    expect(triangles).toBeLessThan(1800);
    for (const part of parts) {
      const positions = part.geometry.getAttribute('position');
      const normals = part.geometry.getAttribute('normal');
      expect(normals.count).toBe(positions.count);
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
    }
  });
});
