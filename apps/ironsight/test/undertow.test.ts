import { describe, expect, it } from 'vitest';
import { ARENA2 as map } from '../src/map/arena2.js';
import { canStand, moveAndSlide, nearestBox } from '../src/physics.js';
import { PLAYER, MOVE } from '../src/config.js';
import { walkSeconds } from '../src/map/nav.js';
import { GroundNavigator } from '../src/map/navigation.js';

describe('Undertow encounter safety', () => {
  it('screens every spawn from all enemy spawns at standing eye height', () => {
    for (const a of map.spawns.red) for (const b of map.spawns.blue) {
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      expect(nearestBox({ ...a, y: PLAYER.standEye }, { x: (b.x - a.x) / d, y: 0, z: (b.z - a.z) / d }, map.boxes, d)).toBeLessThan(d);
    }
  });
  it('every spawn has two lateral exits with standing capsule clearance', () => {
    for (const s of [...map.spawns.red, ...map.spawns.blue]) for (const dz of [-2, 2])
      expect(canStand(s.x, 0, s.z + dz, PLAYER.radius, PLAYER.standHeight, map.boxes, map.bounds)).toBe(true);
  });
  it('home is 1–3 seconds away, contested B 4–6 seconds, equally for both teams', () => {
    for (const side of ['red', 'blue'] as const) {
      const home = side === 'red' ? map.caps.a : map.caps.c;
      const a = Math.min(...map.spawns[side].map(s => walkSeconds(map, s, home)));
      const b = Math.min(...map.spawns[side].map(s => walkSeconds(map, s, map.caps.b)));
      expect(a).toBeGreaterThanOrEqual(1); expect(a).toBeLessThanOrEqual(3);
      expect(b).toBeGreaterThanOrEqual(4); expect(b).toBeLessThanOrEqual(6);
    }
  });
  it('B has four clear entrances after its crossovers and interrupted cardinal sightlines', () => {
    for (const [dx, dz] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
      if (dx === undefined || dz === undefined) throw Error('Invalid entrance');
      const a = { x: 30 + dx, y: PLAYER.standEye, z: 20 + dz }, d = Math.hypot(dx, dz);
      expect(nearestBox(a, { x: -dx / d, y: 0, z: -dz / d }, map.boxes, d)).toBe(Infinity);
    }
    for (const [x, z] of [[1, 0], [0, 1]] as const) {
      const a = { ...map.caps.b, y: PLAYER.standEye };
      const span = nearestBox(a, { x, y: 0, z }, map.boxes, 60) + nearestBox(a, { x: -x, y: 0, z: -z }, map.boxes, 60);
      expect(span).toBeLessThanOrEqual(28);
    }
  });
  it('no sampled standing sightline through B exceeds 28 metres, including diagonals', () => {
    const from = { ...map.caps.b, y: PLAYER.standEye };
    for (let degrees = 0; degrees < 180; degrees += 0.25) {
      const x = Math.cos(degrees * Math.PI / 180), z = Math.sin(degrees * Math.PI / 180);
      const distance = (x: number, z: number) => Math.min(nearestBox(from, { x, y: 0, z }, map.boxes, 100),
        (x > 0 ? 60 - from.x : from.x) / Math.abs(x), (z > 0 ? 40 - from.z : from.z) / Math.abs(z));
      expect(distance(x, z) + distance(-x, -z), `B chord at ${degrees} degrees`).toBeLessThanOrEqual(28);
    }
  });
  it('both control decks can be crossed on foot from either ramp, without jumping', () => {
    for (const x of [17, 43]) for (const direction of [-1, 1]) {
      let p = { x, y: 0, z: direction === 1 ? 1 : 15 }, vy = 0, peak = 0;
      for (let t = 0; t < 47; t++) {
        vy -= MOVE.gravity * 0.05;
        const r = moveAndSlide(p, PLAYER.radius, PLAYER.standHeight, { x: 0, y: vy * 0.05, z: direction * MOVE.walk * 0.05 }, vy, map.boxes, map.bounds, MOVE.stepUp, map.ramps);
        p = r.pos; vy = r.vy; peak = Math.max(peak, p.y);
        expect(r.grounded, `deck x=${x} dir=${direction} tick=${t} position=${JSON.stringify(p)}`).toBe(true);
      }
      expect(peak).toBeCloseTo(1.2, 5); expect(p.y).toBeCloseTo(0, 5);
      expect(direction === 1 ? p.z > 14 : p.z < 2).toBe(true);
    }
  });
  it('production bot navigator reaches every cap from every deployment without clipping', () => {
    const nav = new GroundNavigator(map);
    for (const spawn of [...map.spawns.red, ...map.spawns.blue]) for (const goal of Object.values(map.caps)) {
      let p = { x: spawn.x, z: spawn.z }, steps = 0;
      while (Math.hypot(goal.x - p.x, goal.z - p.z) > 0.4 && steps++ < 1500) {
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
