import { describe, expect, it } from 'vitest';
import { ARENA3 as map } from '../src/map/arena3.js';
import { canStand, moveAndSlide, nearestBox } from '../src/physics.js';
import { PLAYER, MOVE } from '../src/config.js';
import { walkSeconds } from '../src/map/nav.js';
import { GroundNavigator } from '../src/map/navigation.js';

describe('Switchyard encounter safety', () => {
  it('screens every spawn from all enemy spawns at standing eye height', () => {
    for (const a of [...map.spawns.red, ...map.spawns.blue]) for (const b of [...map.spawns.red, ...map.spawns.blue]) {
      if (a === b) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      expect(nearestBox({ ...a, y: PLAYER.standEye }, { x: (b.x - a.x) / d, y: 0, z: (b.z - a.z) / d }, map.boxes, d)).toBeLessThan(d);
    }
  });
  it('every spawn has two lateral exits with standing capsule clearance', () => {
    for (const s of [...map.spawns.red, ...map.spawns.blue]) for (const dz of [-2, 2])
      expect(canStand(s.x, 0, s.z + dz, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds)).toBe(true);
  });
  it('keeps twelve-seat density, waist/full cover and 10-15 second sprint rotations', () => {
    expect(map.bounds.width * map.bounds.depth / 12).toBeGreaterThanOrEqual(1250);
    const caps = Object.values(map.caps);
    for (let i = 0; i < caps.length; i++) for (const to of caps.slice(i + 1)) {
      const seconds = walkSeconds(map, caps[i]!, to, MOVE.sprint);
      expect(seconds).toBeGreaterThanOrEqual(10); expect(seconds).toBeLessThanOrEqual(15);
    }
    for (const b of map.boxes) expect(b.max.y === 1.1 || b.max.y === 3 || b.max.y === 6).toBe(true);
    expect(map.spawns.red).toHaveLength(6); expect(map.spawns.blue).toHaveLength(6);
  });
  it('B has two four-metre north entrances visible together from the objective', () => {
    const from = { ...map.caps.b, z: 97, y: PLAYER.standEye };
    for (const x of [69, 70, 80, 81]) {
      const dx = x - from.x, dz = 84 - from.z, d = Math.hypot(dx, dz);
      expect(nearestBox(from, { x: dx / d, y: 0, z: dz / d }, map.boxes, d)).toBe(Infinity);
      expect(Math.abs(Math.atan2(dx, -dz))).toBeLessThan(39 * Math.PI / 180); // both approach centers fit default 78-degree FOV
    }
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      expect(nearestBox(from, { x, y: 0, z }, map.boxes, 20)).toBeLessThan(20);
  });
  it('north bus rifle corridor has a clear 40 metre line with strafe clearance', () => {
    for (const z of [27.8, 29, 30.2])
      expect(nearestBox({ x: 55, y: PLAYER.standEye, z }, { x: 1, y: 0, z: 0 }, map.boxes, 40)).toBe(Infinity);
  });
  it('the four-ramp deck crosses both axes in either direction without jumping', () => {
    for (const axis of ['x', 'z'] as const) for (const direction of [-1, 1]) {
      let p = axis === 'x' ? { x: direction === 1 ? 59 : 91, y: 0, z: 49 }
        : { x: 75, y: 0, z: direction === 1 ? 35 : 65 };
      let vy = 0, peak = 0;
      for (let t = 0; t < 110; t++) {
        vy -= MOVE.gravity * .05;
        const r = moveAndSlide(p, PLAYER.radius, PLAYER.standHeight,
          { x: axis === 'x' ? direction * MOVE.walk * .05 : 0, y: vy * .05,
            z: axis === 'z' ? direction * MOVE.walk * .05 : 0 },
          vy, map.boxes, map.bounds, MOVE.stepUp, map.ramps);
        p = r.pos; vy = r.vy; peak = Math.max(peak, p.y);
        expect(r.grounded, `${axis}/${direction}/${t}: ${JSON.stringify(p)}`).toBe(true);
      }
      expect(peak).toBeCloseTo(3, 5); expect(p.y).toBeCloseTo(0, 5);
      expect(direction === 1 ? p[axis] > (axis === 'x' ? 90 : 64)
        : p[axis] < (axis === 'x' ? 60 : 36)).toBe(true);
    }
  });
  it('production bot navigator reaches every cap from every deployment without clipping', () => {
    const nav = new GroundNavigator(map);
    for (const spawn of [...map.spawns.red, ...map.spawns.blue]) for (const goal of [...Object.values(map.caps), ...map.patrolWaypoints!]) {
      let p = { x: spawn.x, z: spawn.z }, steps = 0;
      while (Math.hypot(goal.x - p.x, goal.z - p.z) > 0.4 && steps++ < 3000) {
        const target = nav.next(p, goal), d = Math.hypot(target.x - p.x, target.z - p.z);
        if (d < 0.001) break;
        const amount = Math.min(0.12, d);
        p = { x: p.x + (target.x - p.x) / d * amount, z: p.z + (target.z - p.z) / d * amount };
        expect(canStand(p.x, 0, p.z, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds)).toBe(true);
      }
      expect(Math.hypot(goal.x - p.x, goal.z - p.z)).toBeLessThan(0.5);
    }
  });
});
