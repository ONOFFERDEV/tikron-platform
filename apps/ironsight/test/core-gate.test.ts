import { expect, it, afterEach, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { CoreCollision, CoreGate, CorePush } from '../src/core-gate.js';
import { signalFrame } from '../src/signal-event.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { GroundNavigator } from '../src/map/navigation.js';
import { canStand, nearestBox } from '../src/physics.js';
import { PLAYER } from '../src/config.js';
import { stepGrenade } from '../src/grenade.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
it('stages at most one nearby living bot per team, uses open exits and ends the push on crossing/death',()=>{
  const p=(id:string,team:number,x:number,alive=true)=>({id,team,x,y:0,z:50,alive});
  const players=[p('red',0,60),p('red-far',0,10),p('red-second',0,50),p('blue',1,90),p('dead',1,78,false)];
  const push=new CorePush();push.update(1000,signalFrame(1000,'live',900),false,players);
  expect(push.target('red',false)).toBeUndefined();
  push.update(1000,signalFrame(1000,'live',1000),false,players);
  expect(push.target('red',false)).toEqual({x:67,z:50});expect(push.target('blue',false)).toEqual({x:83,z:50});
  for(const id of ['red-far','red-second','dead'])expect(push.target(id,false)).toBeUndefined();
  push.update(1000,signalFrame(1000,'live',9000),true,players);
  expect(push.target('red',true)).toEqual({x:83,z:50});expect(push.target('blue',true)).toEqual({x:67,z:50});
  push.update(1000,signalFrame(1000,'live',10000),true,[p('red',0,83),p('blue',1,90,false)]);
  expect(push.target('red',true)).toBeUndefined();expect(push.target('blue',true)).toBeUndefined();
});
it('opens a standing route through both ends while retaining the walls, roof and spine',()=>{
  const c=new CoreCollision(ARENA1);
  expect(c.closed.length-c.open.length).toBe(2);
  for(const z of [48.5,50,51.5]) for(let x=68;x<=82;x+=.1)
    if(!canStand(x,0,z,PLAYER.radius,PLAYER.standHeight,c.open,ARENA1.bounds)) expect.fail(`Open route blocked: ${x},${z}`);
  for(const x of [70.25,79.75]) expect(canStand(x,0,50,PLAYER.radius,PLAYER.standHeight,c.closed,ARENA1.bounds)).toBe(false);
  for(const [y,z] of [[0,47],[0,53],[4,50],[8,50]])
    expect(canStand(75,y!,z!,PLAYER.radius,PLAYER.standHeight,c.open,ARENA1.bounds)).toBe(false);
  const eye={x:67,y:1.65,z:50},dir={x:1,y:0,z:0};
  expect(nearestBox(eye,dir,c.closedHits,16)).toBe(3);
  expect(nearestBox(eye,dir,c.openHits,16)).toBe(Infinity);
  const goal={x:83,z:50},from={x:67,z:50};
  expect(new GroundNavigator({...ARENA1,boxes:c.open}).next(from,goal)).toEqual(goal);
  expect(new GroundNavigator(ARENA1).next(from,goal)).not.toEqual(goal);
  expect(new CoreCollision(ARENA2).open).toBe(ARENA2.boxes);
  const projectile=()=>({pos:{x:69.5,y:1,z:50},vel:{x:8,y:0,z:0}});
  const closed=projectile(),open=projectile();
  expect(stepGrenade(closed,.1,0,.5,.1,c.closed,ARENA1.bounds)).toBe(true);
  expect(closed.vel.x).toBeLessThan(0);
  expect(stepGrenade(open,.1,0,.5,.1,c.open,ARENA1.bounds)).toBe(false);
  expect(open.pos.x).toBeGreaterThan(70);
});

it('holds BOTH exits for chamber/threshold occupancy, closes when clear and rewinds discrete barriers',()=>{
  const gate=new CoreGate(ARENA1.signalCore);
  expect(gate.update(true,[],1000)).toBe(true);
  for(const p of [{x:75,y:0,z:50},{x:69,y:0,z:50},{x:81,y:0,z:50},{x:75,y:2.9,z:50}]) {
    expect(gate.update(false,[p],2000)).toBe(false);expect(gate.open).toBe(true);
  }
  expect(gate.update(false,[{x:75,y:6,z:50}],2100)).toBe(true);
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
it('restores an open-core snapshot into the fresh round with matching CLOSED collision and wire state',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  class RestoredCore extends CoreRoom { restoreForTest(){this.onRestore();} }
  const h=await createTestRoom(RestoredCore,{codec:ArenaSchema,id:'arena-tdm'});
  await h.connect();await h.advance(50);
  const s=(h.room as unknown as {state:ArenaState}).state;
  // Persisted wire state and a newly constructed in-memory gate intentionally differ.
  s.coreOpen=true;(h.room as RestoredCore).restoreForTest();
  expect(s.coreOpen).toBe(false);expect(s.signalAt).toBe(0);
  await h.advance(50);expect(h.snapshot().coreOpen).toBe(false);
});
it('replicates scheduled opening, rejects forged opening, holds an occupied passage and closes safely',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(CoreRoom,{codec:ArenaSchema,id:'arena-tdm'});
  const player=await h.connect();await h.advance(100);
  const state=(h.room as unknown as {state:ArenaState}).state;
  await player.send('move',{mx:0,mz:0,coreOpen:true});await h.advance(100);
  expect(h.snapshot().coreOpen).toBe(false);
  vi.setSystemTime(state.signalAt+8000);await h.advance(50);
  expect(h.snapshot().coreOpen).toBe(true);
  Object.assign(state.players[player.id]!,{x:75,y:0,z:50});
  vi.setSystemTime(state.signalAt+23000);await h.advance(50);
  expect(h.snapshot().coreOpen).toBe(true);
  const late=await h.connect();await h.advance(50);expect(h.snapshot().coreOpen).toBe(true);
  expect(late.frames().length).toBeGreaterThan(0);
  await player.send('move',{mx:0,mz:1,yaw:Math.PI/2,pitch:0});await h.advance(1600);
  expect(h.snapshot().players[player.id]!.x).toBeGreaterThan(81.5);
  expect(h.snapshot().coreOpen).toBe(false);
  expect(h.snapshot().players[player.id]!.hp).toBe(100);
});

it.each([false,true])('uses historical shutters for %s hybrid claims and analytic hits at BOTH transitions',async(claim)=>{
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const h=await createTestRoom(CoreRoom,{codec:ArenaSchema,id:'arena-tdm'});
  const a=await h.connect(),b=await h.connect();await h.advance(100);
  const s=(h.room as unknown as {state:ArenaState}).state;
  Object.assign(s.players[a.id]!,{x:67,y:0,z:50,team:0,prot:false,yaw:Math.PI/2,pitch:Math.atan2(1-PLAYER.standEye,16)});
  Object.assign(s.players[b.id]!,{x:83,y:0,z:50,team:1,prot:false});
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
