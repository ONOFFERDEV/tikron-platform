import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ARENA1 } from '../src/map/arena1.js';
import { relayServiceGeometry, relayStructureDetail } from '../client/relay-service-geometry.js';
import { rampSurfaceY } from '../src/physics.js';

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
      // Every plate hugs a north/south face or the top of existing solid cover;
      // roof vents must face upward and cannot extend over an open route.
      const rooftop = face.max.y - face.min.y < 0.00001;
      if (rooftop) {
        expect(geometry.getAttribute('normal').getY(i)).toBeCloseTo(1);
        expect(colliders.some(c => Math.abs(face.min.y - c.max.y - 0.012) < 0.00001 &&
          face.min.x >= c.min.x && face.max.x <= c.max.x &&
          face.min.z >= c.min.z && face.max.z <= c.max.z)).toBe(true);
        continue;
      }
      expect(face.max.z - face.min.z).toBeLessThan(0.00001);
      expect(colliders.some(c => Math.min(Math.abs(face.min.z - c.min.z + 0.012),
        Math.abs(face.min.z - c.max.z - 0.012)) < 0.00001 &&
        face.min.x >= c.min.x && face.max.x <= c.max.x &&
        face.min.y >= c.min.y && face.max.y <= c.max.y)).toBe(true);
    }
  });
  it('batches detail with finite atlas coordinates and a small fixed triangle budget', () => {
    expect(geometry.groups).toHaveLength(0);
    expect(geometry.index!.count / 3).toBeLessThanOrEqual(132); // prior 100 + sixteen roof plates
    const uv = geometry.getAttribute('uv');
    for (const value of uv.array) { expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThan(0); expect(value).toBeLessThan(1); }
  });
});

it('backs building hardware with exact solids and keeps every stair stripe on the true slope', () => {
  const g = relayStructureDetail(ARENA1), positions = g.getAttribute('position');
  expect(g.index!.count / 3).toBe(104); expect(g.groups).toHaveLength(0);
  const colliders = ARENA1.structures!.flatMap(s => s.parts).map(p => new T.Box3(
    new T.Vector3(p.box.min.x, p.box.min.y, p.box.min.z), new T.Vector3(p.box.max.x, p.box.max.y, p.box.max.z)));
  for (let i = 0; i < positions.count; i += 4) {
    const bounds = new T.Box3();
    for (let j = 0; j < 4; j++) bounds.expandByPoint(new T.Vector3().fromBufferAttribute(positions, i + j));
    const onRamp = ARENA1.structures!.flatMap(s => s.ramps).some(ramp => {
      for (let j = i; j < i + 4; j++) {
        const x = positions.getX(j), z = positions.getZ(j), y = positions.getY(j);
        if (x <= ramp.minX || x >= ramp.maxX || z <= ramp.minZ || z >= ramp.maxZ
          || Math.abs(y - rampSurfaceY(ramp, x, z) - .008) > .0001) return false;
      }
      return true;
    });
    expect(onRamp || colliders.some(b => b.clone().expandByScalar(.02).containsBox(bounds)), `face ${i / 4}`).toBe(true);
  }
  for (const v of g.getAttribute('uv').array) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1); }
  g.dispose();
});
