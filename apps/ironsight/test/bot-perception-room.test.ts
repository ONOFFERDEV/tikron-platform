import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer, type ArenaState } from '../src/schema.js';
import type { BotBrain } from '../src/bots.js';
import { ambushOpening } from '../src/ambush.js';

class PerceptionArena extends ArenaRoomImpl {
  protected override fillToPlayers = 3;
  protected override startInWarmup = false;
}
type Runtime = { state: ArenaState; botBrains: Map<string,BotBrain>; tickBots: (ms:number)=>void;
  applyDamage: (id:string,amount:number,killer:string,part:string,weapon?:number,source?:{x:number;z:number})=>void;
  spawnInto: (p:ArenaPlayer,id:string)=>void };
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(1000000);});
afterEach(()=>{vi.restoreAllMocks();vi.clearAllTimers();vi.useRealTimers();});

async function fixture() {
  const h=await createTestRoom(PerceptionArena,{id:'arena-tdm',codec:ArenaSchema,sync:'throttled'});
  const c=await h.connect();await h.advance(100);
  const r=h.room as unknown as Runtime;
  // Freeze only AI decisions to inspect room-side sound delivery. Other tests
  // and natural-round tools exercise the complete production bot tick.
  vi.spyOn(r,'tickBots').mockImplementation(()=>{});
  const shooter=r.state.players[c.id]!;
  const id=[...r.botBrains.keys()].find(id=>r.state.players[id]!.team!==shooter.team)!;
  const ally=[...r.botBrains.keys()].find(id=>r.state.players[id]!.team===shooter.team)!;
  Object.assign(shooter,{x:8,y:0,z:11,yaw:0,pitch:0,prot:false});
  Object.assign(r.state.players[id]!,{x:20,y:0,z:11,yaw:Math.PI/2,prot:false});
  Object.assign(r.state.players[ally]!,{x:20,y:0,z:12,prot:false});
  for(const brain of r.botBrains.values()){brain.sound=undefined;brain.nextSoundMs=0;}
  return {h,c,r,id,ally,brain:r.botBrains.get(id)!};
}

it('delivers accepted hostile gunfire only; reload-blocked fire, allies and forged noise cannot alert bots',async()=>{
  const {h,c,r,id,ally,brain}=await fixture();
  c.send('noise',{x:20,z:11});await h.advance(50);expect(brain.sound).toBeUndefined();
  c.send('fire',{yaw:0,pitch:0});await h.advance(50);
  expect(brain.sound).toMatchObject({x:8,z:11});expect(r.botBrains.get(ally)!.sound).toBeUndefined();
  const heard=brain.sound;Object.assign(r.state.players[c.id]!,{x:9,z:11});
  expect(heard?.x).toBe(8); // no live tracking after the source moves
  c.send('reload',{});await h.advance(50);brain.sound=undefined;brain.nextSoundMs=0;
  c.send('fire',{yaw:0,pitch:0});await h.advance(50);expect(brain.sound).toBeUndefined();
  expect(r.state.players[id]!.hp).toBe(100); // the test shot was away from the listener
});

it('confirmed victim damage alerts only the victim and normal spawn clears its old lock and memory',async()=>{
  const {c,r,id,ally,brain}=await fixture();
  const victim=r.state.players[id]!;
  victim.prot=true;r.applyDamage(id,5,c.id,'body');expect(brain.sound).toBeUndefined();
  victim.prot=false;r.applyDamage(id,5,c.id,'blast',undefined,{x:22,z:13});
  expect(victim.hp).toBe(95);expect(brain.sound).toMatchObject({x:22,z:13});
  expect(r.botBrains.get(ally)!.sound).toBeUndefined();
  brain.lockId=c.id;brain.lockMs=500;r.spawnInto(victim,id);
  expect(victim.hp).toBe(100);expect(victim.prot).toBe(true);
  expect(brain.sound).toBeUndefined();expect(brain.lockId).toBeNull();expect(brain.lockMs).toBe(0);
});

it('defines an ambush by a full-health rear opening, with a two-metre minimum and wrapped yaw',()=>{
  const victim={x:10,z:10,yaw:0,hp:100};
  expect(ambushOpening(victim,{x:10,z:8})).toBe(true);
  expect(ambushOpening({...victim,yaw:Math.PI*4},{x:10,z:8})).toBe(true);
  expect(ambushOpening(victim,{x:10,z:8.01})).toBe(false);
  expect(ambushOpening(victim,{x:10,z:20})).toBe(false);
  expect(ambushOpening({...victim,hp:99},{x:10,z:0})).toBe(false);
  expect(ambushOpening(victim,undefined)).toBe(false);
  const at=(degrees:number)=>({x:10+10*Math.sin(degrees*Math.PI/180),z:10+10*Math.cos(degrees*Math.PI/180)});
  expect(ambushOpening(victim,at(119))).toBe(false);expect(ambushOpening(victim,at(121))).toBe(true);
});

it.each(['finish','expired','front','support','other-killer','warmup','instant'] as const)(
  'room ambush medal: %s',async kind=>{
    const {h,c,r,id,ally}=await fixture(),victim=r.state.players[id]!;
    if(kind==='front')victim.yaw=Math.PI*1.5;
    if(kind==='warmup')r.state.phase='warmup';
    const start=Date.now();
    if(kind==='instant')r.applyDamage(id,100,c.id,'head',4);
    else {
      r.applyDamage(id,25,c.id,'body',1);
      // The victim is allowed to turn/respond after the opening.
      victim.yaw=Math.PI*1.5;
      vi.setSystemTime(start+(kind==='expired'?2501:2500));
      r.applyDamage(id,75,kind==='other-killer'?ally:c.id,kind==='support'?'mortar':'body',1);
    }
    await h.advance(0);
    const event=c.frames().filter(f=>f.t==='s:msg'&&f.type==='kill').at(-1)?.payload as {medal?:string}|undefined;
    expect(event).toBeDefined();
    expect(event?.medal).toBe(kind==='finish'||kind==='instant'?'ambush':undefined);
    if(kind==='finish'||kind==='instant') {
      expect(r.state.players[c.id]!.k).toBe(1);
      expect(r.state.redScore+r.state.blueScore).toBe(1); // recognition never adds score
    }
  });
