import { expect, it, afterEach, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { CoreCollision, CoreGate, CorePush } from '../src/core-gate.js';
import { signalFrame } from '../src/signal-event.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import { GroundNavigator } from '../src/map/navigation.js';
import { canStand, nearestBox } from '../src/physics.js';
import { PLAYER } from '../src/config.js';
import { stepGrenade } from '../src/grenade.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import type { MapDef } from '../src/map/types.js';

const coreRoute = (map: MapDef) => {
  const chamber = map.signalCore!.chamber;
  return {
    chamber,
    west: chamber.min.x - 3,
    east: chamber.max.x + 3,
    midX: (chamber.min.x + chamber.max.x) / 2,
    midZ: (chamber.min.z + chamber.max.z) / 2,
  };
};

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
it('stages at most one nearby living bot per team, uses open exits and ends the push on crossing/death',()=>{
  const route=coreRoute(ARENA1);
  const p=(id:string,team:number,x:number,alive=true)=>({id,team,x,y:0,z:route.midZ,alive});
  const players=[p('red',0,60),p('red-far',0,10),p('red-second',0,50),p('blue',1,90),p('dead',1,78,false)];
  const push=new CorePush(ARENA1.signalCore);push.update(1000,signalFrame(1000,'live',900),false,players);
  expect(push.target('red',false)).toBeUndefined();
  push.update(1000,signalFrame(1000,'live',1000),false,players);
  expect(push.target('red',false)).toEqual({x:route.west,z:route.midZ});expect(push.target('blue',false)).toEqual({x:route.east,z:route.midZ});
  for(const id of ['red-far','red-second','dead'])expect(push.target(id,false)).toBeUndefined();
  push.update(1000,signalFrame(1000,'live',9000),true,players);
  expect(push.target('red',true)).toEqual({x:route.east,z:route.midZ});expect(push.target('blue',true)).toEqual({x:route.west,z:route.midZ});
  push.update(1000,signalFrame(1000,'live',10000),true,[p('red',0,route.east),p('blue',1,90,false)]);
  expect(push.target('red',true)).toBeUndefined();expect(push.target('blue',true)).toBeUndefined();
});
it('opens a standing route through both ends while retaining the walls, roof and spine',()=>{
  const c=new CoreCollision(ARENA1),route=coreRoute(ARENA1),b=route.chamber;
  expect(c.closed.length-c.open.length).toBe(2);
  for(const z of [b.min.z+.5,route.midZ,b.max.z-.5]) for(let x=route.west;x<=route.east;x+=.1)
    if(!canStand(x,0,z,PLAYER.radius,PLAYER.standHeight,c.open,ARENA1.bounds)) expect.fail(`Open route blocked: ${x},${z}`);
  for(const door of ARENA1.signalCore!.doors) expect(canStand((door.min.x+door.max.x)/2,0,route.midZ,
    PLAYER.radius,PLAYER.standHeight,c.closed,ARENA1.bounds)).toBe(false);
  for(const box of ARENA1.boxes.filter(box=>!ARENA1.signalCore!.doors.includes(box)))expect(c.open).toContain(box);
  const eye={x:route.west,y:1.65,z:route.midZ},dir={x:1,y:0,z:0};
  expect(nearestBox(eye,dir,c.closedHits,16)).toBe(3);
  expect(nearestBox(eye,dir,c.openHits,16)).toBe(Infinity);
  const goal={x:route.east,z:route.midZ},from={x:route.west,z:route.midZ};
  expect(new GroundNavigator({...ARENA1,boxes:c.open}).next(from,goal)).toEqual(goal);
  expect(new GroundNavigator(ARENA1).next(from,goal)).not.toEqual(goal);
  const plain={...ARENA3,signalCore:undefined};expect(new CoreCollision(plain).open).toBe(plain.boxes);
  const projectile=()=>({pos:{x:b.min.x-.5,y:1,z:route.midZ},vel:{x:8,y:0,z:0}});
  const closed=projectile(),open=projectile();
  expect(stepGrenade(closed,.1,0,.5,.1,c.closed,ARENA1.bounds)).toBe(true);
  expect(closed.vel.x).toBeLessThan(0);
  expect(stepGrenade(open,.1,0,.5,.1,c.open,ARENA1.bounds)).toBe(false);
  expect(open.pos.x).toBeGreaterThan(b.min.x);
});

it.each([ARENA1,ARENA2])('$presentation holds BOTH exits for chamber/threshold occupancy, closes when clear and rewinds discrete barriers',(map)=>{
  const gate=new CoreGate(map.signalCore),route=coreRoute(map),b=route.chamber;
  expect(gate.update(true,[],1000)).toBe(true);
  for(const p of [{x:route.midX,y:0,z:route.midZ},{x:b.min.x-1,y:0,z:route.midZ},
    {x:b.max.x+1,y:0,z:route.midZ},{x:route.midX,y:b.max.y-.1,z:route.midZ}]) {
    expect(gate.update(false,[p],2000)).toBe(false);expect(gate.open).toBe(true);
  }
  expect(gate.update(false,[{x:route.midX,y:b.max.y+3,z:route.midZ}],2100)).toBe(true);
  expect(gate.at(999)).toBe(false);expect(gate.at(1000)).toBe(true);
  expect(gate.at(2099)).toBe(true);expect(gate.at(2100)).toBe(false);
  expect(gate.update(true,[],91000)).toBe(true);expect(gate.at(91000)).toBe(true);
  expect(gate.at(90999)).toBe(false);
  expect(new CoreGate(undefined).update(true,[],1000)).toBe(false);
});

class CoreRoom extends ArenaRoomImpl {
  protected override fillToPlayers=0;
  protected override startInWarmup=false;
  protected override spawnProtectMs=0;
}
it.each(['arena-tdm','arena-dom'])('restores %s into a fresh round with matching CLOSED collision and wire state',async(id)=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  class RestoredCore extends CoreRoom { restoreForTest(){this.onRestore();} }
  const h=await createTestRoom(RestoredCore,{codec:ArenaSchema,id});
  await h.connect();await h.advance(50);
  const s=(h.room as unknown as {state:ArenaState}).state;
  // Persisted wire state and a newly constructed in-memory gate intentionally differ.
  s.coreOpen=true;(h.room as RestoredCore).restoreForTest();
  expect(s.coreOpen).toBe(false);expect(s.signalAt).toBe(0);
  await h.advance(50);expect(h.snapshot().coreOpen).toBe(false);
});
it.each(['arena-tdm','arena-dom'])('%s replicates opening, rejects forgery, holds occupancy and closes safely',async(id)=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(CoreRoom,{codec:ArenaSchema,id});
  const player=await h.connect();await h.advance(100);
  const state=(h.room as unknown as {state:ArenaState}).state;
  await player.send('move',{mx:0,mz:0,coreOpen:true});await h.advance(100);
  expect(h.snapshot().coreOpen).toBe(false);
  vi.setSystemTime(state.signalAt+8000);await h.advance(50);
  expect(h.snapshot().coreOpen).toBe(true);
  const route=coreRoute(id==='arena-dom'?ARENA2:ARENA1);
  Object.assign(state.players[player.id]!,{x:route.midX,y:0,z:route.midZ});
  vi.setSystemTime(state.signalAt+23000);await h.advance(50);
  expect(h.snapshot().coreOpen).toBe(true);
  const late=await h.connect();await h.advance(50);expect(h.snapshot().coreOpen).toBe(true);
  expect(late.frames().length).toBeGreaterThan(0);
  await player.send('move',{mx:0,mz:1,yaw:Math.PI/2,pitch:0});await h.advance(2100);
  expect(h.snapshot().players[player.id]!.x).toBeGreaterThan(route.chamber.max.x+1.5);
  expect(h.snapshot().coreOpen).toBe(false);
  expect(h.snapshot().players[player.id]!.hp).toBe(100);
});

it.each(['arena-tdm','arena-dom'].flatMap(id=>[false,true].map(claim=>({id,claim}))))('uses current $id shutters and historical barrier state for hybrid=$claim at BOTH transitions',async({id,claim})=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(CoreRoom,{codec:ArenaSchema,id});
  const a=await h.connect(),b=await h.connect();await h.advance(100);
  const s=(h.room as unknown as {state:ArenaState}).state;
  const route=coreRoute(id==='arena-dom'?ARENA2:ARENA1),from=route.west,to=route.east;
  Object.assign(s.players[a.id]!,{x:from,y:0,z:route.midZ,team:0,prot:false,yaw:Math.PI/2,pitch:Math.atan2(1-PLAYER.standEye,to-from)});
  Object.assign(s.players[b.id]!,{x:to,y:0,z:route.midZ,team:1,prot:false});
  vi.setSystemTime(s.signalAt+7700);await h.advance(300); // first open tick
  expect(s.coreOpen).toBe(true);
  const fire=()=>a.send('fire',claim ? {claim:{id:b.id,part:'body'}} : undefined);
  await fire();await h.advance(50);expect(s.players[b.id]!.hp).toBe(100); // fired before barrier opened
  await h.advance(200);await fire();await h.advance(50);
  const openHp=s.players[b.id]!.hp;expect(openHp).toBeLessThan(100);
  vi.setSystemTime(s.signalAt+22700);await h.advance(300); // closed now; history open
  expect(s.coreOpen).toBe(false);
  await fire();await h.advance(50);
  const rewindHp=s.players[b.id]!.hp;expect(rewindHp).toBeLessThan(openHp);
  await h.advance(200);await fire();await h.advance(50);
  expect(s.players[b.id]!.hp).toBe(rewindHp); // now closed in history too
});

it('Undertow gallery opens a 14m standing route, retains the shell and handles grenades and bot paths',()=>{
  const c=new CoreCollision(ARENA2),route=coreRoute(ARENA2),b=route.chamber;
  expect(c.closed.length-c.open.length).toBe(2);
  for(const z of [b.min.z+.5,route.midZ,b.max.z-.5])for(let x=route.west;x<=route.east;x+=.1)
    if(!canStand(x,0,z,PLAYER.radius,PLAYER.standHeight,c.open,ARENA2.bounds))expect.fail(`Gallery blocked ${x},${z}`);
  for(const door of ARENA2.signalCore!.doors) expect(canStand((door.min.x+door.max.x)/2,0,route.midZ,
    PLAYER.radius,PLAYER.standHeight,c.closed,ARENA2.bounds)).toBe(false);
  for(const box of ARENA2.boxes.filter(box=>!ARENA2.signalCore!.doors.includes(box)))expect(c.open).toContain(box);
  const eye={x:route.west,y:1.65,z:route.midZ},dir={x:1,y:0,z:0};
  expect(nearestBox(eye,dir,c.closedHits,20)).toBe(3);
  expect(nearestBox(eye,dir,c.openHits,20)).toBe(Infinity);
  const openNav=new GroundNavigator({...ARENA2,boxes:c.open}),closedNav=new GroundNavigator(ARENA2);
  for(const [from,goal] of [[{x:route.west,z:route.midZ},{x:route.east,z:route.midZ}],
    [{x:route.east,z:route.midZ},{x:route.west,z:route.midZ}]]) {
    expect(openNav.next(from!,goal!)).toEqual(goal);
    expect(closedNav.next(from!,goal!)).not.toEqual(goal);
  }
  const projectile=()=>({pos:{x:b.min.x-.5,y:1,z:route.midZ},vel:{x:8,y:0,z:0}});
  const closed=projectile(),open=projectile();
  expect(stepGrenade(closed,.1,0,.5,.1,c.closed,ARENA2.bounds)).toBe(true);expect(closed.vel.x).toBeLessThan(0);
  expect(stepGrenade(open,.1,0,.5,.1,c.open,ARENA2.bounds)).toBe(false);expect(open.pos.x).toBeGreaterThan(b.min.x);
});

it('Undertow warning volunteers use its wider portals and return to normal objectives after crossing',()=>{
  const route=coreRoute(ARENA2);
  const push=new CorePush(ARENA2.signalCore),players=[{id:'red',team:0,x:60,y:0,z:route.midZ,alive:true},{id:'blue',team:1,x:90,y:0,z:route.midZ,alive:true}];
  push.update(1000,signalFrame(1000,'live',1000),false,players);
  expect(push.target('red',false)).toEqual({x:route.west,z:route.midZ});expect(push.target('blue',false)).toEqual({x:route.east,z:route.midZ});
  expect(push.target('red',true)).toEqual({x:route.east,z:route.midZ});expect(push.target('blue',true)).toEqual({x:route.west,z:route.midZ});
  players[0]!.x=route.east;players[1]!.x=route.west;push.update(1000,signalFrame(1000,'live',10000),true,players);
  expect(push.target('red',true)).toBeUndefined();expect(push.target('blue',true)).toBeUndefined();
});
