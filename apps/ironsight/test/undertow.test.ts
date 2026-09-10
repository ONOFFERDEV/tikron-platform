import { describe, expect, it } from 'vitest';
import { ARENA2 as map } from '../src/map/arena2.js';
import { canStand, moveAndSlide, nearestBox } from '../src/physics.js';
import { PLAYER, MOVE } from '../src/config.js';
import { walkSeconds } from '../src/map/nav.js';
import { GroundNavigator } from '../src/map/navigation.js';
import { spawnExposed } from '../src/map/spawn.js';
import { CoreCollision } from '../src/core-gate.js';

describe('Undertow encounter safety', () => {
  it('screens the second northern crossing from the recorded inner-lane threats', () => {
    const collision = new CoreCollision(map);
    // Session70's five <5s respawn contacts, normalized to the west half.
    // Threats are the nearby 1s telemetry samples, not asserted exact shooters.
    const rays = [
      [6.19935,27.50062,26.50895,25.14666],
      [4.99741,27.48733,26.50231,26.34781],
      [17.29935,27.5,30.5,29.25365],
      [16.39935,27.5,30.5,31.05365],
      [7.09995,27.50005,26.64188,23.35388],
    ] as const;
    for (const east of [false,true]) for (const open of [false,true]) {
      const mirror = (x:number) => east ? 150-x : x;
      for (const [x,z,tx,tz] of rays) for (const eye of [PLAYER.standEye,PLAYER.crouchEye]) {
        const origin = {x:mirror(x),y:eye,z}, target = {x:mirror(tx),y:eye,z:tz};
        const d = Math.hypot(target.x-origin.x,target.z-origin.z);
        expect(canStand(origin.x,0,z,PLAYER.radius,PLAYER.standHeight,collision.boxes(open),map.bounds)).toBe(true);
        expect(nearestBox(origin,{x:(target.x-origin.x)/d,y:0,z:(tz-z)/d},collision.hits(open),d)).toBeLessThan(d);
        expect(spawnExposed({x:origin.x,y:0,z},{...target,y:0,id:'inner-threat',team:1,alive:true},collision.hits(open))).toBe(false);
      }
    }
  });
  it('leaves a clear standing bypass and firing peek at both ends of each baffle', () => {
    for (const east of [false,true]) for (const z of [23,33]) {
      for (let x=17;x<=21;x+=.1) {
        const px=east?150-x:x;
        expect(canStand(px,0,z,PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds)).toBe(true);
      }
      const x=east?129:21,dx=east?-1:1;
      expect(nearestBox({x,y:PLAYER.standEye,z},{x:dx,y:0,z:0},map.boxes,5)).toBe(Infinity);
    }
  });
  it('screens all four deployment exits from the opposing home-court firing line', () => {
    const collision = new CoreCollision(map);
    // Mirrored versions of the actual Session64 early-damage position and
    // enemy cluster. Head, torso and both shoulders must clear no firing ray.
    for (const east of [false, true]) for (const south of [false, true]) {
      const mirror = (x: number, z: number) => ({ x: east ? 150-x : x, y: 0, z: south ? 100-z : z });
      const enemy = { ...mirror(28,16), id:'threat', team:1, alive:true };
      for (const open of [false,true]) for (const z of [25.5,26,26.5]) {
        const point = mirror(5,z);
        expect(canStand(point.x,0,point.z,PLAYER.radius,PLAYER.standHeight,collision.boxes(open),map.bounds)).toBe(true);
        expect(spawnExposed(point,enemy,collision.hits(open))).toBe(false);
      }
    }
  });
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
