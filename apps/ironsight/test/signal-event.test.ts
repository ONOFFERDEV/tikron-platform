import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { SIGNAL, signalEpoch, signalFrame } from '../src/signal-event.js';

class SignalRoom extends ArenaRoomImpl {
  protected override fillToPlayers=0;
  protected override startInWarmup=false;
  protected override intermissionMs=100;
  protected override warmupMs=100;
  protected override warmupMinPlayers=1;
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(1000000);});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});

it('telegraphs for 8s, blanks for exactly 15s, restores and repeats on a shared epoch',()=>{
  const epoch=1000, at=(age:number)=>signalFrame(epoch,'live',epoch+age);
  expect(at(-1).phase).toBe('idle');expect(at(0).phase).toBe('warning');
  expect(at(7999).phase).toBe('warning');expect(at(8000).phase).toBe('blackout');
  expect(at(22999).phase).toBe('blackout');expect(at(23000).phase).toBe('recovery');
  expect(at(25999).phase).toBe('recovery');expect(at(26000).phase).toBe('idle');
  expect(at(90000).phase).toBe('warning');expect(at(98000).alignment).toBe(1);
  expect(at(104000).alignment).toBe(0);expect(at(180000).alignment).toBe(0);
  expect(at(11000).alignment).toBe(.5);
  for(const phase of ['warmup','ended'] as const)expect(signalFrame(epoch,phase,epoch+9000).phase).toBe('idle');
  for(const invalid of [0,NaN,Infinity,-10])expect(signalFrame(invalid,'live',1e6).phase).toBe('idle');
});

it('replicates one deadline to late seats, ignores forged move fields, and stops with the round',async()=>{
  const h=await createTestRoom(SignalRoom,{codec:ArenaSchema,id:'arena-tdm'});
  const first=await h.connect();await h.advance(50);
  const epoch=h.snapshot().signalAt;
  expect(epoch).toBe(1000000+SIGNAL.firstWarningMs);
  await first.send('move',{mx:0,mz:0,signalAt:Date.now(),blackout:true});await h.advance(50);
  expect(h.snapshot().signalAt).toBe(epoch);
  vi.setSystemTime(epoch+SIGNAL.warningMs+5000);await h.advance(50);
  const late=await h.connect();await h.advance(50);
  expect(h.snapshot().signalAt).toBe(epoch);
  expect(signalFrame(h.snapshot().signalAt,h.snapshot().phase,Date.now()).phase).toBe('blackout');
  const state=(h.room as unknown as {state:ArenaState}).state;
  state.players[first.id]!.alive=false;
  await first.send('respawn',{});await h.advance(50);
  expect(h.snapshot().signalAt).toBe(epoch);
  expect(late.frames().length).toBeGreaterThan(0);
  state.redScore=50;await h.advance(50);
  expect(h.snapshot().phase).toBe('ended');
  expect(signalFrame(epoch,h.snapshot().phase,Date.now()).phase).toBe('idle');
  await h.advance(400);
  expect(h.snapshot().phase).toBe('live');
  expect(h.snapshot().signalAt).toBeGreaterThan(epoch);
  expect(signalFrame(h.snapshot().signalAt,'live',Date.now()).phase).toBe('idle');
});

it('keeps Switchyard and warmup inactive, while both event maps get the same real timer',async()=>{
  expect(signalEpoch('relay',false,1e6)).toBe(0);
  expect(signalEpoch('undertow',false,1e6)).toBe(0);
  for(const id of ['arena-practice-arena3-test']) {
    const h=await createTestRoom(SignalRoom,{codec:ArenaSchema,id});
    await h.connect();await h.advance(50);expect(h.snapshot().signalAt).toBe(0);
  }
  const h=await createTestRoom(SignalRoom,{codec:ArenaSchema,id:'arena-practice-test'});
  await h.connect();await h.advance(50);expect(h.snapshot().signalAt).toBeGreaterThan(Date.now());
});

it('replicates Undertow discharge to late seats without allowing input to reset it or blanking earned UAV',async()=>{
  const h=await createTestRoom(SignalRoom,{codec:ArenaSchema,id:'arena-dom'});
  const first=await h.connect();await h.advance(50);
  const epoch=h.snapshot().signalAt;expect(epoch).toBe(1000000+SIGNAL.firstWarningMs);
  await first.send('move',{mx:0,mz:0,signalAt:1,coreOpen:true});await h.advance(50);
  expect(h.snapshot().signalAt).toBe(epoch);expect(h.snapshot().coreOpen).toBe(false);
  vi.setSystemTime(epoch+8500);await h.advance(50);
  const late=await h.connect();await h.advance(50);
  expect(h.snapshot().signalAt).toBe(epoch);expect(late.frames().length).toBeGreaterThan(0);
  const room=h.room as unknown as {state:ArenaState;airSupport:{earn:(id:string,count:number,state:ArenaState)=>void}};
  room.airSupport.earn(first.id,3,room.state);await h.advance(100);
  await first.send('syncView',{});await h.advance(50);
  const support=first.frames().filter(f=>f.type==='support').at(-1)?.payload as {flights:unknown[]};
  expect(support.flights).toHaveLength(1); // discharge must not defer an earned launch
  expect(h.snapshot().coreOpen).toBe(false);
  const training=await createTestRoom(SignalRoom,{codec:ArenaSchema,id:'arena-practice-arena2-flood'});
  await training.connect();await training.advance(50);expect(training.snapshot().signalAt).toBeGreaterThan(Date.now());
});
