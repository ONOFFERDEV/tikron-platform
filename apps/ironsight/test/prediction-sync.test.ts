import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import type { Room } from '@tikron/client';
import { Predictor, type PredictionCorrection } from '../client/predict.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import { MOVEMENT_SYNC, MovementInbox, readMovementBatch, type MovementCommand, type MovementSnapshot } from '../src/rooms/movement-sync.js';
import type { MapDef } from '../src/map/types.js';
import { TICK_MS } from '../src/config.js';

afterEach(()=>{ vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); });
const walk={mx:0,mz:1,jump:false,crouch:false,sprint:false,ads:false};
const command=(seq:number):MovementCommand=>({...walk,seq,yaw:Math.PI/2});
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
class QuietRoom extends ArenaRoomImpl {
  protected override fillToPlayers=0;
  protected override startInWarmup=false;
}

/** The real room/harness, with deterministic delay ONLY in the fake transport.
 * No predictor/server internals are patched; initial placement is fixture setup. */
async function link(map:MapDef, id:string, start:{x:number;y:number;z:number}, delayTicks=2, dropStart=false) {
  vi.useFakeTimers();vi.setSystemTime(1_000_000);
  const h=await createTestRoom(QuietRoom,{id,codec:ArenaSchema,sync:'throttled'}), c=await h.connect();
  const me=(h.room as unknown as {state:ArenaState}).state.players[c.id]!;
  Object.assign(me,start,{yaw:0});
  const p=new Predictor(map), samples:PredictionCorrection[]=[];
  p.onCorrection=s=>samples.push(s);
  let now=0, seen=0;
  const outgoing:{at:number;type:string;payload:unknown}[]=[], incoming:{at:number;payload:unknown}[]=[];
  const handlers=new Map<string,(v:unknown)=>void>();
  const eyeJumps:number[]=[];
  const transport={send(type:string,payload:unknown){
    if(type==='movementStart'&&dropStart){dropStart=false;return;}
    outgoing.push({at:now+delayTicks,type,payload:structuredClone(payload)});},
    onMessage(type:string|((m:unknown)=>void),handler?:(v:unknown)=>void){
      if(typeof type==='string'&&handler)handlers.set(type,handler);
      return ()=>{if(typeof type==='string')handlers.delete(type);};
    }} as unknown as Pick<Room,'send'|'onMessage'>;
  const network={online:true};
  p.connect(transport,()=>network.online);
  const tick=async(input=walk,yaw=0)=>{
    now++;
    while(outgoing[0]&&outgoing[0].at<=now){const m=outgoing.shift()!;await c.send(m.type,m.payload);}
    await h.advance(TICK_MS);
    const frames=c.frames();
    for(const f of frames.slice(seen))if(f.type==='movement')incoming.push({at:now+delayTicks,payload:f.payload});
    seen=frames.length;
    while(incoming[0]&&incoming[0].at<=now){
      const before=p.eye(),count=samples.length;
      handlers.get('movement')?.(incoming.shift()!.payload);
      if(samples.length>count&&!samples.at(-1)!.reset&&samples.at(-1)!.correction<2.5)eyeJumps.push(distance(before,p.eye()));
    }
    // Keep the legacy state callbacks in place, as main does after integration.
    const state=c.lastState() as ArenaState;
    const self=state.players[c.id]!;p.reconcile(self);p.setAlive(self.alive);
    p.frame(TICK_MS,input,yaw);
  };
  for(let i=0;i<delayTicks*2+4;i++)await tick({...walk,mz:0});
  samples.length=0;
  return {h,c,me,p,tick,samples,outgoing,incoming,eyeJumps,network};
}

describe('acknowledged local movement',()=>{
  it('does not enqueue retries into an offline reconnecting transport',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},1);
    l.network.online=false;l.outgoing.length=0;
    for(let i=0;i<240;i++)l.p.frame(1000/120,walk,Math.PI/2);
    expect(l.outgoing).toHaveLength(0);
    l.network.online=true;
    for(let i=0;i<35;i++)await l.tick(walk,Math.PI/2);
    expect(l.samples.at(-1)!.ack).toBeGreaterThan(25);
  });
  it('recovers when the initial movement handshake is silently dropped',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},1,true);
    for(let i=0;i<45;i++)await l.tick(walk,Math.PI/2);
    expect(l.samples.at(-1)?.ack).toBeGreaterThan(25);
    expect(l.samples.some(s=>s.reset)).toBe(true);
  });
  it.each([
    ['Relay yard',ARENA1,'arena-tdm',{x:55,y:0,z:27},Math.PI/2,80,0],
    ['Relay doorway/interior',ARENA1,'arena-tdm',{x:41,y:0,z:46},Math.PI,32,0],
    ['Relay stair/roof',ARENA1,'arena-tdm',{x:42,y:0,z:35.5},Math.PI/2,35,3],
    ['Relay trench',ARENA1,'arena-tdm',{x:36,y:0,z:76},Math.PI/2,90,-3],
    ['Undertow ramp/slab',ARENA2,'arena-dom',{x:45,y:0,z:29},0,76,3],
    ['Switchyard ramp/slab',ARENA3,'arena-ffa',{x:59,y:0,z:49},Math.PI/2,110,3],
  ] as const)('%s compares the matching step with 200ms RTT',async(_name,map,id,start,yaw,steps,height)=>{
    const l=await link(map,id,start);
    const heights:number[]=[];
    for(let i=0;i<steps;i++){await l.tick(walk,yaw);heights.push(l.me.y);}
    // A clear result must actually visit the claimed floor, not stop at its wall.
    expect(heights.filter(y=>Math.abs(y-height)<.01).length).toBeGreaterThan(5);
    const matched=l.samples.filter(s=>s.matchedError!==null);
    expect(matched.length).toBeGreaterThan(steps-10);
    expect(Math.max(...matched.map(s=>s.matchedError!))).toBeLessThan(1e-8);
    expect(Math.max(...matched.map(s=>s.correction))).toBeLessThan(1e-8);
    expect(matched.some(s=>s.rawError>.15)).toBe(true);
    expect(l.samples.every(s=>s.pending<=MOVEMENT_SYNC.maxPending)).toBe(true);
  });

  it('replays jump, sprint slide, crouch and cooldown state without latency corrections',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},3);
    for(let i=0;i<90;i++)await l.tick({...walk,sprint:i<20||i>50,crouch:i>=12&&i<28,jump:i===45},Math.PI/2);
    const matched=l.samples.filter(s=>s.matchedError!==null);
    expect(matched.length).toBeGreaterThan(75);
    expect(Math.max(...matched.map(s=>s.matchedError!))).toBeLessThan(1e-8);
    expect(Math.max(...matched.map(s=>s.correction))).toBeLessThan(1e-8);
  });

  it('absorbs one-tick delivery jitter during a jump without adding an unpredicted gravity step',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},2);
    for(let i=0;i<60;i++){
      // Delay an ordered transport burst by one tick, then deliver it normally.
      if(i===10){expect(l.me.y).toBeGreaterThan(0);for(const message of l.outgoing)message.at++;}
      await l.tick({...walk,jump:i===6},Math.PI/2);
    }
    expect(Math.max(...l.samples.map(s=>s.matchedError??0))).toBeLessThan(1e-8);
    expect(Math.max(...l.samples.filter(s=>!s.reset).map(s=>s.correction))).toBeLessThan(1e-8);
  });

  it.each([
    ['vault',ARENA2,'arena-dom',{x:22,y:0,z:43.2},0,20],
    ['launch',ARENA3,'arena-ffa',ARENA3.launchPads![0]!.from,Math.PI/2,30],
  ] as const)('round-trips active %s progress through delayed snapshots',async(_name,map,id,start,yaw,steps)=>{
    const l=await link(map,id,start,2);
    for(let i=0;i<steps;i++)await l.tick({...walk,jump:i===0,mz:i===0?1:0},yaw);
    expect(Math.max(...l.samples.map(s=>s.matchedError??0))).toBeLessThan(1e-8);
    expect(Math.max(...l.samples.map(s=>s.correction))).toBeLessThan(1e-8);
  });

  it('repairs a dropped command batch without double-integrating its retransmission',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},1);
    for(let i=0;i<70;i++){
      if(i===10)l.outgoing.splice(0,l.outgoing.length);
      await l.tick(walk,Math.PI/2);
    }
    expect(l.samples.at(-1)!.ack).toBeGreaterThan(60);
    expect(Math.max(...l.samples.map(s=>s.matchedError??0))).toBeLessThan(1e-8);
  });

  it('retries a full prediction window after a transport outage and resumes without a rollback',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},1);
    for(let i=0;i<12;i++)await l.tick(walk,Math.PI/2);
    const beforeAck=l.samples.at(-1)!.ack;
    // Lose every upstream batch for longer than the bounded prediction window.
    // The socket remains open, as with the room's silent rate-limit drops.
    for(let i=0;i<20;i++){
      l.outgoing.length=0;
      await l.tick(walk,Math.PI/2);
    }
    l.outgoing.length=0;
    const frozen={...l.p.pos};
    const frozenEye=l.p.eye();
    for(let i=0;i<144;i++)l.p.frame(1000/144,walk,Math.PI/2);
    expect(l.outgoing.length).toBeGreaterThanOrEqual(19);
    expect(l.outgoing.length).toBeLessThanOrEqual(20);
    expect(distance(frozen,l.p.pos)).toBe(0);
    expect(distance(frozenEye,l.p.eye())).toBeLessThan(1e-8);
    l.outgoing.length=0;
    for(let i=0;i<35;i++)await l.tick(walk,Math.PI/2);
    expect(l.samples.at(-1)!.ack).toBeGreaterThan(beforeAck+25);
    expect(Math.max(...l.samples.map(s=>s.matchedError??0))).toBeLessThan(1e-8);
    expect(l.samples.every(s=>s.pending<=MOVEMENT_SYNC.maxPending)).toBe(true);
  });

  it('corrects a real displacement and retains a continuous eye across a small correction',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},1);
    for(let i=0;i<12;i++)await l.tick(walk,Math.PI/2);
    l.me.x-=.8; // simulate a real authoritative correction, NOT RTT
    for(let i=0;i<16;i++)await l.tick(walk,Math.PI/2);
    expect(l.samples.some(s=>(s.matchedError??0)>.7)).toBe(true);
    expect(l.samples.slice(-8).every(s=>(s.matchedError??0)<1e-8)).toBe(true);
    expect(Math.max(...l.eyeJumps)).toBeLessThan(1e-10);
  });

  it('does not accept old-epoch commands after death and a nearby respawn',async()=>{
    const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},2);
    for(let i=0;i<14;i++)await l.tick(walk,Math.PI/2);
    const old=l.c.frames().filter(f=>f.type==='movement').at(-1)!.payload as MovementSnapshot;
    l.me.alive=false;
    for(let i=0;i<8;i++)await l.tick(walk,Math.PI/2);
    expect(l.p.alive).toBe(false);
    // Exercise the real respawn handler and its normal spawn/epoch reset.
    await l.c.send('respawn');
    for(let i=0;i<12;i++)await l.tick({...walk,mz:0});
    expect(l.p.alive).toBe(true);
    const fresh=l.c.frames().filter(f=>f.type==='movement').at(-1)!.payload as MovementSnapshot;
    expect(fresh.epoch).toBeGreaterThan(old.epoch);
    const before={...l.me};
    await l.c.send('movementSteps',{epoch:old.epoch,commands:[command(fresh.ack+1)]});
    for(let i=0;i<8;i++)await l.tick({...walk,mz:0});
    expect(distance(before,l.me)).toBeLessThan(1e-8);
    expect(l.samples.filter(s=>s.reset).length).toBeGreaterThanOrEqual(2);
  });
});

it('rejects forged movement time/sequence/batches and bounds out-of-order storage',()=>{
  for(const payload of [null,{}, {epoch:1,commands:Array(9).fill(command(1))},
    {epoch:1,commands:[command(2),command(1)]}, {epoch:1,commands:[{...command(1),mx:2}]},
    {epoch:1,commands:[{...command(1),yaw:Infinity}]}, {epoch:-1,commands:[command(1)]}])
    expect(readMovementBatch(payload)).toBeNull();
  const inbox=new MovementInbox(1);
  inbox.receive([command(2),command(1000)]);expect(inbox.next()).toBeUndefined();
  inbox.receive([command(1),command(2)]);expect(inbox.next()!.seq).toBe(1);
  expect(inbox.next()!.seq).toBe(2);expect(inbox.next()).toBeUndefined();
  expect(inbox.commands.size).toBe(0);
});

it('the authoritative tick caps a flooded command queue and keeps airborne physics running without commands',async()=>{
  const l=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},0);
  const snapshot=l.c.frames().filter(f=>f.type==='movement').at(-1)!.payload as MovementSnapshot;
  const x=l.me.x;
  for(let batch=0;batch<4;batch++)await l.c.send('movementSteps',{epoch:snapshot.epoch,
    commands:Array.from({length:8},(_,i)=>command(batch*8+i+snapshot.ack+1))});
  await l.h.advance(TICK_MS);expect(l.me.x-x).toBeLessThanOrEqual(.600001);
  await l.h.advance(TICK_MS*9);expect(l.me.x-x).toBeLessThanOrEqual(3.300001);
  // Start a separate jumped seat; a silent client must still land, not hover.
  vi.clearAllTimers();
  const b=await link(ARENA1,'arena-tdm',{x:55,y:0,z:27},0);
  await b.tick({...walk,jump:true},Math.PI/2);await b.tick({...walk,mz:0},Math.PI/2);
  expect(b.me.y).toBeGreaterThan(0);
  await b.h.advance(1500);expect(b.me.y).toBe(0);
});
