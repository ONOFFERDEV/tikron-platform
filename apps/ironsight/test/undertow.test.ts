import { describe, expect, it } from 'vitest';
import { ARENA2 as map } from '../src/map/arena2.js';
import { canStand, moveAndSlide, nearestBox } from '../src/physics.js';
import { PLAYER, MOVE } from '../src/config.js';
import { walkSeconds } from '../src/map/nav.js';
import { GroundNavigator } from '../src/map/navigation.js';

describe('Undertow encounter safety', () => {
  it('keeps ground cover within 12m of sampled rifle, deck-approach and service lanes', () => {
    for (const [z,from,to] of [[27,20,130],[48,18,65],[48,85,132],[72,18,132],[86,18,132]]) {
      for(let x=from!;x<=to!;x+=2) {
        const distance=Math.min(...map.boxes.filter(b=>b.min.y===0).map(b=>
          Math.hypot(Math.max(b.min.x-x,0,x-b.max.x),Math.max(b.min.z-z!,0,z!-b.max.z))));
        expect(distance,`lane ${x},${z}`).toBeLessThanOrEqual(12);
      }
    }
  });
  it('shows the solid central pressure stack above all three lane approaches',()=>{
    const stack=map.boxes.find(b=>b.min.y===6 && b.max.y===14)!;
    expect(stack).toBeDefined();const target={x:75,y:13,z:49};
    for(const [x,z] of [[75,27],[30,50],[120,50],[75,76]]){
      const eye={x:x!,y:PLAYER.standEye,z:z!};const d=Math.hypot(target.x-eye.x,target.y-eye.y,target.z-eye.z);
      const dir={x:(target.x-eye.x)/d,y:(target.y-eye.y)/d,z:(target.z-eye.z)/d};
      expect(nearestBox(eye,dir,map.boxes.filter(b=>b!==stack),d)).toBe(Infinity);
      expect(nearestBox(eye,dir,[stack],d)).toBeLessThan(d);
    }
  });
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
  it('keeps 6v6 density, waist/full cover and 10-15 second sprint rotations', () => {
    expect(map.bounds.width * map.bounds.depth / 12).toBeGreaterThanOrEqual(1250);
    const caps = Object.values(map.caps);
    for (let i = 0; i < caps.length; i++) for (const to of caps.slice(i + 1)) {
      const seconds = walkSeconds(map, caps[i]!, to, MOVE.sprint);
      expect(seconds).toBeGreaterThanOrEqual(10); expect(seconds).toBeLessThanOrEqual(15);
    }
    for (const b of map.boxes.filter(b => b.min.y === 0)) expect(b.max.y === 1.1 || b.max.y === 3 || b.max.y === 6).toBe(true);
    expect(map.spawns.red).toHaveLength(6); expect(map.spawns.blue).toHaveLength(6);
  });
  it('B has two four-metre north entrances visible together from the objective', () => {
    const from = { ...map.caps.b, z: 97, y: PLAYER.standEye };
    for (const x of [69, 70, 80, 81]) {
      const dx = x - from.x, dz = 88 - from.z, d = Math.hypot(dx, dz);
      expect(nearestBox(from, { x: dx / d, y: 0, z: dz / d }, map.boxes, d)).toBe(Infinity);
      expect(Math.abs(Math.atan2(dx, -dz))).toBeLessThan(39 * Math.PI / 180); // both approach centers fit default 78-degree FOV
    }
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      expect(nearestBox(from, { x, y: 0, z }, map.boxes, 20)).toBeLessThan(20);
  });
  it('clarifier rifle corridor has a clear 40 metre line with strafe clearance', () => {
    for (const z of [25.8, 27, 28.2])
      expect(nearestBox({ x: 55, y: PLAYER.standEye, z }, { x: 1, y: 0, z: 0 }, map.boxes, 40)).toBe(Infinity);
  });
  it('both control decks can be crossed on foot from either ramp, without jumping', () => {
    for (const x of [45, 105]) for (const direction of [-1, 1]) {
      let p = { x, y: 0, z: direction === 1 ? 29 : 51 }, vy = 0, peak = 0;
      for (let t = 0; t < 74; t++) {
        vy -= MOVE.gravity * 0.05;
        const r = moveAndSlide(p, PLAYER.radius, PLAYER.standHeight, { x: 0, y: vy * 0.05, z: direction * MOVE.walk * 0.05 }, vy, map.boxes, map.bounds, MOVE.stepUp, map.ramps);
        p = r.pos; vy = r.vy; peak = Math.max(peak, p.y);
        expect(r.grounded, `deck x=${x} dir=${direction} tick=${t} position=${JSON.stringify(p)}`).toBe(true);
      }
      expect(peak).toBeCloseTo(3, 5); expect(p.y).toBeCloseTo(0, 5);
      expect(direction === 1 ? p.z > 50 : p.z < 30).toBe(true);
    }
  });
  it('production bot navigator reaches every cap from every deployment without clipping', () => {
    const nav = new GroundNavigator(map);
    for (const spawn of [...map.spawns.red, ...map.spawns.blue]) for (const goal of Object.values(map.caps)) {
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
