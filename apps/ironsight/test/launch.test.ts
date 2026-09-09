import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { WaistTraversal, launchRoute } from '../src/traversal.js';
import { ARENA3 as map } from '../src/map/arena3.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { PLAYER, TICK_MS } from '../src/config.js';
import { canStand } from '../src/physics.js';
const jump={mx:0,mz:1,crouch:false,sprint:false,jump:true};
const pad=map.launchPads![0]!,yaw=Math.PI/2;
describe('Switchyard induction launches',()=>{
  it('both pads land on the deck in 24 ticks, with full standing clearance and no steerable endpoint',()=>{
    for(const pad of map.launchPads!) {
      const t=new WaistTraversal();let p={...pad.from},peak=0;
      const yaw=Math.atan2(pad.to.x-p.x,pad.to.z-p.z);
      for(let i=0;i<24;i++) {
        const r=t.step(TICK_MS,i===0?jump:{...jump,mz:0,mx:1,jump:false},i===0,p,i===0?yaw:0,
          map.boxes,map.bounds,map.ramps!,map.launchPads)!;
        expect(r).not.toBeNull();p=r.pos;peak=Math.max(peak,p.y);
        expect(canStand(p.x,p.y,p.z,PLAYER.radius,PLAYER.standHeight,map.boxes,map.bounds)).toBe(true);
        expect(r.grounded).toBe(i===23);
      }
      expect(p).toEqual(pad.to);expect(peak).toBeGreaterThan(6);expect(peak).toBeLessThan(7);
      expect(t.active).toBe(false);
      expect(t.step(TICK_MS,jump,true,p,yaw,map.boxes,map.bounds,map.ramps!,map.launchPads)).toBeNull();
    }
  });
  it('every edge of each pad offers a clear route; look-away, distance, air and intent gate activation',()=>{
    for(const pad of map.launchPads!)for(const [dx,dz] of [[1.49,0],[-1.49,0],[0,1.49],[0,-1.49]]) {
      const p={...pad.from,x:pad.from.x+dx!,z:pad.from.z+dz!};
      expect(launchRoute(p,Math.atan2(pad.to.x-pad.from.x,0),map.launchPads!,map.boxes,map.bounds,map.ramps!)).not.toBeNull();
    }
    for(const p of [{...pad.from,x:pad.from.x-1.51},{...pad.from,y:.1}])
      expect(launchRoute(p,yaw,map.launchPads!,map.boxes,map.bounds,map.ramps!)).toBeNull();
    expect(launchRoute(pad.from,-yaw,map.launchPads!,map.boxes,map.bounds,map.ramps!)).toBeNull();
    for(const extra of [{jump:false},{mz:0},{ads:true},{crouch:true}])
      expect(new WaistTraversal().step(TICK_MS,{...jump,...extra},true,pad.from,yaw,map.boxes,map.bounds,map.ramps!,map.launchPads)).toBeNull();
    expect(new WaistTraversal().step(TICK_MS,jump,false,pad.from,yaw,map.boxes,map.bounds,map.ramps!,map.launchPads)).toBeNull();
  });
  it('rejects thin obstructions, low ceilings, unsupported endpoints and out-of-bounds routes',()=>{
    const thin={min:{x:64,y:2,z:53},max:{x:64.001,y:10,z:57}};
    expect(launchRoute(pad.from,yaw,[pad],[...map.boxes,thin],map.bounds,map.ramps!)).toBeNull();
    expect(launchRoute(pad.from,yaw,[pad],map.boxes,{...map.bounds,ceiling:7},map.ramps!)).toBeNull();
    expect(launchRoute(pad.from,yaw,[{...pad,to:{x:61,y:3,z:55}}],map.boxes,map.bounds,map.ramps!)).toBeNull();
    expect(launchRoute(pad.from,yaw,[{...pad,to:{x:151,y:0,z:55}}],map.boxes,map.bounds,map.ramps!)).toBeNull();
  });
});
class TestArena extends ArenaRoomImpl { protected override fillToPlayers=0; protected override startInWarmup=false; }
afterEach(()=>vi.useRealTimers());
it('room owns launch time and endpoint, ignores forged fields, and gates fire/grenades until normal recovery',async()=>{
  vi.useFakeTimers();vi.setSystemTime(1_000_000);
  const h=await createTestRoom(TestArena,{id:'arena-ffa',codec:ArenaSchema,sync:'throttled'});
  const c=await h.connect(),p=(h.room as unknown as {state:ArenaState}).state.players[c.id]!;
  // Test fixture only: the browser evidence walks here with normal W inputs.
  Object.assign(p,pad.from,{yaw});const nades=p.nades;
  await c.send('move',{...jump,launch:true,target:{x:149,y:14,z:99},durationMs:1});
  for(let i=0;i<24;i++){
    await h.advance(TICK_MS);
    if(i===5){await c.send('fire',{});await c.send('nade',{});}
  }
  expect({x:p.x,y:p.y,z:p.z}).toEqual(pad.to);expect(p.nades).toBe(nades);
  expect(c.frames().filter(f=>f.type==='traversal')).toHaveLength(1);
  expect(c.frames().filter(f=>f.type==='shot')).toHaveLength(0);
  await c.send('move',{...jump,mz:0,jump:false});await h.advance(TICK_MS);
  await c.send('fire',{});await h.advance(TICK_MS);
  expect(c.frames().filter(f=>f.type==='shot')).toHaveLength(0);
  await h.advance(150);await c.send('fire',{});await h.advance(TICK_MS);
  expect(c.frames().filter(f=>f.type==='shot')).toHaveLength(1);
});
