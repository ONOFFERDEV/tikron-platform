import { expect, it } from 'vitest';
import { BotNavigator } from '../src/rooms/bot-navigation.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import { MOVE, PLAYER } from '../src/config.js';
import { moveAndSlide, type Vec3 } from '../src/physics.js';
import type { MapDef } from '../src/map/types.js';
import { botNavigators } from '../src/rooms/bot-navigation.js';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
/** Follow ordinary 50ms walking intents with the FULL collision list, not the
 * navigator's spatial buckets. A graph edge alone is not an arrival proof. */
function follow(map: MapDef, nav: BotNavigator, start: Vec3, goal: Vec3, ticks = 1800) {
  let p = { ...start }, vy = 0;
  const path: Vec3[] = [p];
  for (let i=0; i<ticks && distance(p, goal)>.35; i++) {
    const next=nav.next(p,goal), dx=next.x-p.x, dz=next.z-p.z, d=Math.hypot(dx,dz);
    const scale=d ? Math.min(MOVE.walk*.05,d)/d : 0;
    vy-=MOVE.gravity*.05;
    const result=moveAndSlide(p,PLAYER.radius,PLAYER.standHeight,
      {x:dx*scale,y:vy*.05,z:dz*scale},vy,map.boxes,map.bounds,MOVE.stepUp,map.ramps);
    p=result.pos;vy=result.vy;path.push(p);
  }
  expect(distance(p,goal),JSON.stringify({start,goal,end:p,steps:path.length})).toBeLessThan(.35);
  return path;
}

it('detours from exact capsule contact rather than walking through the wall',()=>{
  const nav=new BotNavigator(ARENA1), goal={x:75,y:0,z:95};
  for(const z of [87.59,87.6,87.60000000000001]) {
    const from={x:75,y:0,z};
    expect(nav.walkable(from,goal)).toBe(false);
    const path=follow(ARENA1,nav,from,goal);
    expect(path.some(p=>p.x<69.6||p.x>80.4)).toBe(true);
  }
});

it('escapes the Switchyard north deployment wall at the measured post-respawn contact',()=>{
  const nav=new BotNavigator(ARENA3),goal={x:25,y:0,z:13};
  for(const z of [5.59,5.6,5.6000000000000005]) {
    const from={x:25,y:0,z};
    expect(nav.walkable(from,goal)).toBe(false);
    const path=follow(ARENA3,nav,from,goal);
    expect(path.some(p=>p.x<19.6||p.x>36.4)).toBe(true);
  }
});

it.each([
  ['Relay comms',ARENA1,{x:41,y:0,z:46},{x:50.5,y:3,z:35.5}],
  ['Relay control',ARENA1,{x:109,y:0,z:46},{x:99.5,y:3,z:35.5}],
  ['Undertow',ARENA2,{x:45,y:0,z:29},{x:45.5,y:3,z:41.5}],
  ['Switchyard',ARENA3,{x:59,y:0,z:49},{x:77.5,y:3,z:49.5}],
] as const)('%s enters at the low stair/ramp, reaches the roof and walks back down',(_name,map,start,goal)=>{
  const nav=new BotNavigator(map);
  const ascent=follow(map,nav,start,goal);
  expect(ascent.some(p=>p.y>.4&&p.y<2.6)).toBe(true);
  const descent=follow(map,nav,ascent.at(-1)!,start);
  expect(descent.some(p=>p.y>.4&&p.y<2.6)).toBe(true);
  expect(nav.nearestHighGround(start)).toBeDefined();
});

it('keeps room and slab floors distinct and does not shortcut through a stair void',()=>{
  const nav=new BotNavigator(ARENA1);
  expect(nav.walkable({x:45,y:0,z:40},{x:45,y:3,z:40})).toBe(false);
  expect(nav.walkable({x:46,y:3,z:37.5},{x:46,y:3,z:34.8})).toBe(false);
  const path=follow(ARENA1,nav,{x:36,y:0,z:76},{x:75,y:-3,z:76});
  expect(path.some(p=>p.y<-.5&&p.y>-2.5)).toBe(true);
});

it('never opens a sub-capsule doorway or sealed route and bounds its destination cache',()=>{
  const start={x:5,y:0,z:5},goal={x:5,y:0,z:15};
  const map:MapDef={bounds:{width:20,depth:20,ceiling:8},boxes:[
    {min:{x:0,y:0,z:10},max:{x:4.7,y:3,z:10.4}},
    {min:{x:5.3,y:0,z:10},max:{x:20,y:3,z:10.4}},
  ],spawns:{red:[start],blue:[goal]},caps:{a:start,b:start,c:goal}};
  const nav=new BotNavigator(map);
  expect(nav.next(start,goal)).toEqual(start);
  for(let x=1;x<19;x++)for(let z=12;z<18;z++)nav.next(start,{x,y:0,z});
  expect(nav.stats.fields).toBeLessThanOrEqual(24);
  expect(nav.nearestHighGround(start)).toBeUndefined();
});

it('keeps closed and open shutters in separate immutable navigation graphs',()=>{
  const {closed,open}=botNavigators(ARENA1),start={x:67,y:0,z:50},goal={x:75,y:0,z:50};
  expect(closed.walkable(start,goal)).toBe(false);
  expect(open.walkable(start,goal)).toBe(true);
  expect(closed.next(start,goal)).toEqual(start);
  expect(open.next(start,goal)).not.toEqual(start);
  expect(botNavigators(ARENA1)).toEqual({closed,open});
});
