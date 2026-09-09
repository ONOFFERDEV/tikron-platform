import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { WaistTraversal, traversalRoute } from '../src/traversal.js';
import { PLAYER, TICK_MS } from '../src/config.js';
import { canStand, type Box } from '../src/physics.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';

const bounds = { width:30, depth:30, ceiling:16 };
const barrier: Box = { min:{x:10,y:0,z:8},max:{x:12,y:1.1,z:14} };
const pos = { x:9.2,y:0,z:11 }, yaw=Math.PI/2;
const jump = { mx:0,mz:1,crouch:false,sprint:false,jump:true };
describe('capsule-verified waist traversal', () => {
  it('vaults a thin barrier in 13 ticks; every position has full standing clearance', () => {
    const t=new WaistTraversal(); let p=pos;
    for(let i=0;i<13;i++) {
      const r=t.step(TICK_MS,{...jump,jump:i===0},i===0,p,yaw,[barrier],bounds,[])!;
      expect(r).not.toBeNull();p=r.pos;
      expect(canStand(p.x,p.y,p.z,PLAYER.radius,PLAYER.standHeight,[barrier],bounds)).toBe(true);
      expect(r.grounded).toBe(i===12);
    }
    expect(t.active).toBe(false);expect(p.x).toBeCloseTo(12.48);expect(p.y).toBe(0);
    expect(t.step(TICK_MS,jump,true,p,Math.PI*1.5,[barrier],bounds,[])).toBeNull();
  });
  it('mantles a broad waist platform; cannot use its top to climb tall cover', () => {
    const boxes=[{...barrier,max:{...barrier.max,x:16}}];
    const route=traversalRoute(pos,yaw,boxes,bounds,[])!;
    expect(route.kind).toBe('mantle'); expect(route.end.y).toBe(1.1);
    expect(traversalRoute(route.end,yaw,boxes,bounds,[])).toBeNull();
  });
  it('rejects tall cover, narrow ceilings, blocked landing, excessive reach and airborne starts', () => {
    expect(traversalRoute(pos,yaw,[{...barrier,max:{...barrier.max,y:3}}],bounds,[])).toBeNull();
    const ceiling={min:{x:8,y:2.1,z:8},max:{x:14,y:2.12,z:14}};
    expect(traversalRoute(pos,yaw,[barrier,ceiling],bounds,[])).toBeNull();
    const wall={min:{x:12.2,y:0,z:8},max:{x:14,y:3,z:14}};
    expect(traversalRoute(pos,yaw,[barrier,wall],bounds,[])).toBeNull();
    expect(traversalRoute({...pos,x:7},yaw,[barrier],bounds,[])).toBeNull();
    expect(traversalRoute({...pos,y:.5},yaw,[barrier],bounds,[])).toBeNull();
  });
  it('rejects unsupported corner mantles, ramp backs and landings beyond world bounds',()=>{
    const broad={...barrier,max:{...barrier.max,x:16}};
    expect(traversalRoute({x:9.5,y:0,z:7.5},Math.PI/4,[broad],bounds,[])).toBeNull();
    expect(traversalRoute(pos,yaw,[barrier],{...bounds,width:12.5},[])).toBeNull();
    expect(traversalRoute(pos,yaw,[barrier],bounds,[{minX:12.1,maxX:14,minZ:8,maxZ:14,axis:'x',dir:1,topY:3}])).toBeNull();
  });
  it.each([{ads:true},{crouch:true},{mz:0},{jump:false}])('requires eligible jump intent %j', extra => {
    expect(new WaistTraversal().step(TICK_MS,{...jump,...extra},true,pos,yaw,[barrier],bounds,[])).toBeNull();
  });
  it('a turn or input release cannot bend the committed path into adjacent cover', () => {
    const t=new WaistTraversal();let p=pos;
    for(let i=0;i<13;i++) p=t.step(TICK_MS,i===0?jump:{...jump,jump:false,mz:0,mx:1},i===0,p,i===0?yaw:0,[barrier],bounds,[])!.pos;
    expect(p.z).toBe(11);expect(p.x).toBeCloseTo(12.48);
  });
});

class TestArena extends ArenaRoomImpl { protected override fillToPlayers=0; protected override startInWarmup=false; }
afterEach(()=>vi.useRealTimers());
describe('room and predicted traversal',()=>{
  it('matches actual Undertow intents, ignores forged destinations, blocks combat and restores recovery',async()=>{
    vi.useFakeTimers();vi.setSystemTime(1_000_000);
    const h=await createTestRoom(TestArena,{id:'arena-dom',codec:ArenaSchema,sync:'throttled'});
    const c=await h.connect();const p=(h.room as unknown as {state:ArenaState}).state.players[c.id]!;
    // Unit fixture only. Live browser capture reaches this lip by walking.
    Object.assign(p,{x:22,y:0,z:43.2,yaw:0});const nades=p.nades;
    await c.send('move',{...jump,target:{x:149,y:14,z:99},vault:true,durationMs:1});
    for(let i=0;i<13;i++) {
      await h.advance(TICK_MS);
      if(i===1){await c.send('fire',{});await c.send('nade',{});}
    }
    expect(p.z).toBeCloseTo(46.48);expect(p.y).toBe(0);
    expect(p.nades).toBe(nades);
    expect(c.frames().filter(f=>f.type==='traversal')).toHaveLength(1);
    expect(c.frames().filter(f=>f.type==='shot')).toHaveLength(0);
    await c.send('move',{...jump,mz:0,jump:false});await h.advance(TICK_MS);
    await c.send('fire',{});await h.advance(TICK_MS);
    expect(c.frames().filter(f=>f.type==='shot')).toHaveLength(0);
    await h.advance(150);await c.send('fire',{});await h.advance(TICK_MS);
    expect(c.frames().filter(f=>f.type==='shot')).toHaveLength(1);
  });
});
