import { expect, it } from 'vitest';
import { DomOrders, type DomAlly } from '../src/dom-orders.js';
import { botThink, createBotBrain, type BotView } from '../src/bots.js';
import { ARENA2 } from '../src/map/arena2.js';
import { CoreCollision } from '../src/core-gate.js';
import { GroundNavigator } from '../src/map/navigation.js';
import { canStand, nearestBox } from '../src/physics.js';
import { PLAYER } from '../src/config.js';

const routes = [[{x:40,z:20},{x:80,z:20}], [{x:160,z:20},{x:120,z:20}]];
const map = {caps:{a:{x:0,y:0,z:0},b:{x:100,y:0,z:0},c:{x:200,y:0,z:0}},capApproaches:{b:routes}};
const neutral = {a:100,b:100,c:100};
const roster = (x=0):DomAlly[] => Array.from({length:6},(_,i)=>({id:`bot-${i}`,x,z:0,team:0,alive:true,bot:true,available:true}));

it('breaks the long pump-service firing line with full cover in both gallery states',()=>{
  const collision=new CoreCollision(ARENA2);
  for(const open of [false,true])for(const y of [.95,1.65]) {
    const boxes=collision.hits(open);
    expect(nearestBox({x:49,y,z:85},{x:1,y:0,z:0},boxes,52)).toBeCloseTo(13);
    expect(nearestBox({x:101,y,z:85},{x:-1,y:0,z:0},boxes,52)).toBeCloseTo(13);
    // Inside the returns, the two existing B entrances remain open.
    for(const x of [69,81])expect(nearestBox({x,y,z:87},{x:0,y:0,z:1},boxes,6)).toBe(Infinity);
  }
});

it('splits objectives as before, chooses an entry from own position and advances between reviews',()=>{
  for(const x of [0,200]) {
    const people=roster(x),orders=new DomOrders(map);orders.update(0,neutral,people);
    expect([0,100,200].map(x=>people.filter(p=>orders.target(p.id)?.x===x).length)).toEqual([2,2,2]);
    const p=people.find(p=>orders.target(p.id)?.x===100)!,route=routes[x===0?0:1]!;
    expect(orders.approach(p.id)).toEqual(route[0]);
    Object.assign(p,route[0]);orders.update(50,neutral,people);
    expect(orders.approach(p.id)).toEqual(route[1]);
    orders.update(13000,neutral,people); // same objective renewal must not backtrack
    expect(orders.approach(p.id)).toEqual(route[1]);
    Object.assign(p,route[1]);orders.update(13050,neutral,people);
    expect(orders.approach(p.id)).toBeUndefined();expect(orders.target(p.id)).toEqual({x:100,z:0});
    orders.update(26000,neutral,people);expect(orders.approach(p.id)).toBeUndefined();
  }
});

it('releases old-life, gallery, expired and reset routes, and does not send near reinforcements backward',()=>{
  for(const release of ['dead','gallery','timeout','clear'] as const) {
    const people=roster(),orders=new DomOrders(map);orders.update(0,neutral,people);
    const p=people.find(p=>orders.approach(p.id))!;
    if(release==='dead')p.alive=false;
    if(release==='gallery')p.available=false;
    if(release==='clear')orders.clear();else orders.update(release==='timeout'?45000:50,neutral,people);
    expect(orders.approach(p.id)).toBeUndefined();
  }
  for(const x of [85,115]) {
    const people=roster(x),orders=new DomOrders(map);orders.update(0,neutral,people);
    for(const p of people)if(orders.target(p.id)?.x===100)expect(orders.approach(p.id)).toBeUndefined();
  }
});

it('steers through an intermediate corner without guarding it, preserving close duels and sight gates',()=>{
  const brain=createBotBrain({seed:70,waypoints:[{x:0,y:0}],reactionMs:150,aimNoiseRad:0});
  const view:BotView={self:{x:0,y:0,z:0,yaw:0,pitch:0,alive:true,crouch:false,team:0},
    objective:{x:100,z:0},objectiveApproach:{x:0,z:10},objectiveWatch:{x:200,z:0},
    enemies:[],boxes:[],teamless:false};
  expect(botThink(view,brain,50).move).toMatchObject({mx:0,mz:1});
  Object.assign(view.self,{z:9}); // reaching approach doesn't become a flag hold
  expect(botThink(view,brain,50).move).toMatchObject({mx:0,mz:1});
  view.enemies=[{id:'enemy',x:0,y:0,z:14,alive:true,crouch:false,team:1}];
  expect(botThink(view,brain,50).fire).toBe(false);
  expect(brain.objectiveDuel).toMatchObject({objectiveX:100,objectiveZ:0,z:9});
  for(let i=0;i<3;i++)botThink(view,brain,50);
  expect(botThink(view,brain,50).fire).toBe(true);
  view.boxes=[{min:{x:-2,y:0,z:11},max:{x:2,y:3,z:12}}];
  expect(botThink(view,brain,50).fire).toBe(false);expect(brain.lockId).toBeNull();
  view.enemies=[];Object.assign(view.self,{x:100,z:0});
  const hold=botThink(view,brain,50);expect(Math.abs(hold.move.mx)).toBeLessThanOrEqual(1);
  // A stale approach cannot drag an arrived holder away along the x axis.
  expect(hold.move.mx*Math.cos(hold.look.yaw)+hold.move.mz*Math.sin(hold.look.yaw)).toBeCloseTo(0);
});

it('walks the selected Undertow approach from all twelve spawns in both gallery states without clipping',()=>{
  for(const open of [false,true]) {
    const map={...ARENA2,boxes:new CoreCollision(ARENA2).boxes(open)},nav=new GroundNavigator(map);
    const solids=[...map.boxes,...(map.ramps??[]).map(r=>({min:{x:r.minX,y:0,z:r.minZ},max:{x:r.maxX,y:r.topY,z:r.maxZ}}))];
    for(const spawn of [...map.spawns.red,...map.spawns.blue]) {
      const routes=map.capApproaches!.b!,route=routes[spawn.x<75?0:1]!;
      let p={x:spawn.x,z:spawn.z};
      for(const goal of [...route,map.caps.b]) {
        for(let i=0;i<2000&&Math.hypot(goal.x-p.x,goal.z-p.z)>.3;i++) {
          const next=nav.next(p,goal),d=Math.hypot(next.x-p.x,next.z-p.z);if(d<.001)break;
          const step=Math.min(.15,d);p={x:p.x+(next.x-p.x)/d*step,z:p.z+(next.z-p.z)/d*step};
          expect(canStand(p.x,0,p.z,PLAYER.radius,PLAYER.standHeight,solids,map.bounds)).toBe(true);
        }
        expect(Math.hypot(goal.x-p.x,goal.z-p.z),`open=${open}, spawn=${spawn.x}/${spawn.z}, goal=${goal.x}/${goal.z}, stopped=${p.x}/${p.z}`).toBeLessThan(.35);
      }
    }
  }
});
