import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ARENA1 } from '../src/map/arena1.js';
import { relayServiceGeometry } from '../client/relay-service-geometry.js';

describe('Relay service cladding', () => {
  const geometry = relayServiceGeometry(ARENA1);
  it('keeps every face on existing solid cover, within the 2 cm cladding limit', () => {
    const positions = geometry.getAttribute('position');
    const colliders = ARENA1.boxes.map(b => new T.Box3(
      new T.Vector3(b.min.x, b.min.y, b.min.z), new T.Vector3(b.max.x, b.max.y, b.max.z)));
    expect(positions.count).toBeGreaterThan(0);
    for (let i = 0; i < positions.count; i += 4) {
      const face = new T.Box3();
      for (let j = 0; j < 4; j++) face.expandByPoint(new T.Vector3().fromBufferAttribute(positions, i + j));
      expect(colliders.some(c => c.clone().expandByScalar(0.02).containsBox(face))).toBe(true);
      // Every decal is vertical, lies outside a north/south face, and cannot
      // appear floating across a route or inside the underlying opaque wall.
      expect(face.max.z - face.min.z).toBeLessThan(0.00001);
      expect(colliders.some(c => Math.min(Math.abs(face.min.z - c.min.z + 0.012),
        Math.abs(face.min.z - c.max.z - 0.012)) < 0.00001 &&
        face.min.x >= c.min.x && face.max.x <= c.max.x &&
        face.min.y >= c.min.y && face.max.y <= c.max.y)).toBe(true);
    }
  });
  it('batches detail with finite atlas coordinates and a small fixed triangle budget', () => {
    expect(geometry.groups).toHaveLength(0);
    expect(geometry.index!.count / 3).toBeLessThanOrEqual(100);
    const uv = geometry.getAttribute('uv');
    for (const value of uv.array) { expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThan(0); expect(value).toBeLessThan(1); }
  });
});
