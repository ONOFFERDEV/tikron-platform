import { describe, expect, it } from 'vitest';
import { ARENA3 as map } from '../src/map/arena3.js';
import { canStand, moveAndSlide, nearestBox } from '../src/physics.js';
import { PLAYER, MOVE } from '../src/config.js';
import { walkSeconds } from '../src/map/nav.js';
import { GroundNavigator } from '../src/map/navigation.js';
import { spawnExposed, spawnFacingYaw } from '../src/map/spawn.js';

describe('Switchyard encounter safety', () => {
  it('grounds cover rhythm along bus shoulders, deck approaches and service bays within twelve metres',()=>{
    const cover=map.boxes.filter(b=>b.min.y===0 && b.max.y>=1);
    const distance=(x:number,z:number)=>Math.min(...cover.map(b=>Math.hypot(
      Math.max(b.min.x-x,0,x-b.max.x),Math.max(b.min.z-z,0,z-b.max.z))));
    for(const z of [19,29,35,67,73,85])for(let x=20;x<=130;x+=2)
      expect(distance(x,z),`${x},${z}`).toBeLessThanOrEqual(12);
    for(const x of [25,125])for(let z=12;z<=88;z+=2)
      expect(distance(x,z),`${x},${z}`).toBeLessThanOrEqual(12);
  });
  it('switching spine is solid above the deck and visible from the three lane approaches',()=>{
    const spine=map.boxes.find(b=>b.min.y===3 && b.max.y===14)!;
    expect(spine).toEqual({min:{x:79,y:3,z:51},max:{x:81,y:14,z:53}});
    for(const from of [{x:55,y:PLAYER.standEye,z:29},{x:60,y:PLAYER.standEye,z:55},{x:90,y:PLAYER.standEye,z:43},{x:75,y:PLAYER.standEye,z:83}]) {
      const to={x:80,y:13.5,z:52},d=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
      const ray={x:(to.x-from.x)/d,y:(to.y-from.y)/d,z:(to.z-from.z)/d};
      expect(nearestBox(from,ray,map.boxes.filter(b=>b!==spine),d)).toBe(Infinity);
    }
  });
  it('authored northern views have nine metres of clear eye and capsule travel to an exit', () => {
    expect(map.spawnViews).toHaveLength(2);
    for (const view of map.spawnViews!) {
      const spawn = [...map.spawns.red, ...map.spawns.blue].find(p => p.x === view.from.x && p.z === view.from.z)!;
      expect(spawn).toBeDefined();
      const yaw = spawnFacingYaw(map, spawn, 0);
      const dir = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
      expect(nearestBox({ ...spawn, y: PLAYER.standEye }, dir, map.boxes, 9)).toBe(Infinity);
      let p = { ...spawn };
      for (let i = 0; i < 90; i++) p = moveAndSlide(p, PLAYER.radius, PLAYER.standHeight,
        { x: dir.x * .1, y: -.1, z: dir.z * .1 }, -1, map.boxes, map.bounds, MOVE.stepUp, map.ramps).pos;
      expect(p.x).toBeCloseTo(view.toward.x);
      expect(p.z).toBeCloseTo(view.toward.z);
    }
  });
  it('new northern arrivals hide the whole body and can leave around either screen end', () => {
    for (const x of [57, 93]) {
      const spawn = [...map.spawns.red, ...map.spawns.blue].find(p => p.x === x && p.z === 3)!;
      expect(spawn).toBeDefined();
      for (const other of [...map.spawns.red, ...map.spawns.blue]) {
        if (other === spawn) continue;
        expect(spawnExposed(spawn, { ...other, id: 'threat', team: 0, alive: true }, map.boxes)).toBe(false);
      }
      // Traverse BOTH exits, rather than only proving one BFS path to a cap.
      for (const exitX of x === 57 ? [42, 66] : [84, 108]) {
        let p = { ...spawn };
        for (const target of [{ x: exitX, z: 3 }, { x: exitX, z: 11 }]) {
          for (let step = 0; step < 200 && Math.hypot(target.x - p.x, target.z - p.z) > .01; step++) {
            const distance = Math.hypot(target.x - p.x, target.z - p.z), amount = Math.min(.12, distance);
            p = moveAndSlide(p, PLAYER.radius, PLAYER.standHeight,
              { x: (target.x - p.x) / distance * amount, y: -.1, z: (target.z - p.z) / distance * amount },
              -1, map.boxes, map.bounds, MOVE.stepUp, map.ramps).pos;
          }
          expect(Math.hypot(target.x - p.x, target.z - p.z)).toBeLessThan(.02);
        }
      }
    }
  });
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
    for (const b of map.boxes.filter(b=>b.min.y===0)) expect(b.max.y === 1.1 || b.max.y === 3 || b.max.y === 6).toBe(true);
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
