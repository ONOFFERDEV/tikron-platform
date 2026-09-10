import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { ARENA2 } from '../src/map/arena2.js';
import type { RoundResult } from '../src/round-honors.js';
import { PLAYER } from '../src/config.js';

class HonorsArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override matchTimeMs = 5000;
  protected override intermissionMs = 200;
  protected override warmupMs = 200;
  protected override warmupMinPlayers = 1;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000000); });
afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('earns capture MVP through room ticks, rejects forged credit, resyncs frozen evidence and resets next round', async () => {
  const h = await createTestRoom(HonorsArena, { id: 'arena-dom', codec: ArenaSchema });
  const a = await h.connect(), b = await h.connect();
  const s = (h.room as unknown as {state:ArenaState}).state;
  Object.assign(s.players[a.id]!, {x:ARENA2.caps.a.x,z:ARENA2.caps.a.z,y:0});
  await a.send('syncView', { mvp: { id: a.id, score: 99999 }, assists: 99999 });
  await h.advance(5000);
  expect(s.phase).toBe('ended');
  const result = a.frames().find(f => f.t === 's:msg' && f.type === 'matchEnd')?.payload as RoundResult;
  expect(result).toMatchObject({winner:'red',mvp:{id:a.id,kills:0,assists:0,captureSeconds:4,score:4}});
  await b.send('syncView'); await h.advance(50);
  expect(b.frames().filter(f => f.t === 's:msg' && f.type === 'matchEnd').at(-1)?.payload).toEqual(result);
  await h.advance(500);
  expect(s.phase).toBe('live');
  Object.assign(s.players[b.id]!, {x:ARENA2.caps.c.x,z:ARENA2.caps.c.z,y:0});
  await h.advance(5000);
  const next = a.frames().filter(f => f.t === 's:msg' && f.type === 'matchEnd').at(-1)?.payload as RoundResult;
  expect(next).toMatchObject({winner:'blue',mvp:{id:b.id,kills:0,assists:0,captureSeconds:4,score:4}});
  expect(result.mvp?.id).toBe(a.id);
});

it('credits an actual gun assist in the final TDM award, rather than choosing by kill count alone', async () => {
  class DuelHonors extends HonorsArena {
    protected override spawnProtectMs = 0;
    protected override respawnMs = 200;
    protected override killTarget = 2;
  }
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const h = await createTestRoom(DuelHonors, { codec: ArenaSchema });
  const a = await h.connect(), b = await h.connect(), c = await h.connect();
  const s = (h.room as unknown as {state:ArenaState}).state;
  const place = (id:string,x:number,z=11) => Object.assign(s.players[id]!,
    {x,z,y:0,alive:true,prot:false,hp:100,yaw:Math.PI/2,pitch:Math.atan2(1-PLAYER.standEye,10)});
  await h.advance(100);
  place(a.id,10); place(b.id,20); place(c.id,4,9);
  await h.advance(150); // Record the fixture positions in the real lag history.
  await a.send('fire'); await h.advance(150);
  expect(s.players[b.id]!.hp).toBeLessThan(100);
  place(a.id,4,9); place(c.id,10); await h.advance(150);
  for(let i=0;i<3;i++){await c.send('fire'); await h.advance(150);}
  expect(s.players[c.id]!.k).toBe(1);
  const kill = a.frames().find(f=>f.t==='s:msg'&&f.type==='kill')?.payload as {assist?:string};
  expect(kill.assist).toBe(a.id);
  await h.advance(300);
  place(b.id,20); place(c.id,4,9); place(a.id,10); await h.advance(150);
  for(let i=0;i<4;i++){await a.send('fire'); await h.advance(150);}
  expect(s.phase).toBe('ended');
  const result = a.frames().find(f=>f.t==='s:msg'&&f.type==='matchEnd')?.payload as RoundResult;
  expect(result.mvp).toEqual({id:a.id,team:0,kills:1,assists:1,captureSeconds:0,score:3});
});
