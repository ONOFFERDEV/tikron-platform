import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { TICK_MS } from '../src/config.js';
import type { RoundResult } from '../src/round-honors.js';
import { intermissionLabel } from '../client/intermission.js';

class IntermissionRoom extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override intermissionMs = 1000;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000000); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it('shares one immutable deadline with late subscribers, rejects forged values and advances on that boundary', async () => {
  const h = await createTestRoom(IntermissionRoom, { codec: ArenaSchema });
  const a = await h.connect();
  const state = (h.room as unknown as {state:ArenaState}).state;
  state.redScore = 50; await h.advance(TICK_MS);
  const result = a.frames().find(f => f.t === 's:msg' && f.type === 'matchEnd')?.payload as RoundResult;
  expect(result.intermissionEndMs).toBe(Date.now() + Math.ceil(1000 / TICK_MS) * TICK_MS);
  await h.advance(250);
  const late = await h.connect();
  await late.send('syncView', { intermissionEndMs: 1 }); await h.advance(TICK_MS);
  expect(late.frames().filter(f => f.t === 's:msg' && f.type === 'matchEnd').at(-1)?.payload).toEqual(result);
  await h.advance(result.intermissionEndMs! - Date.now() - 1);
  expect(state.phase).toBe('ended');
  await h.advance(TICK_MS + 1);
  expect(state.phase).toBe('warmup');
});

it('uses the published clock after a delayed tick and still permits an early majority vote', async () => {
  for (const vote of [false, true]) {
    const h = await createTestRoom(IntermissionRoom, { codec: ArenaSchema });
    const a = await h.connect();
    const state = (h.room as unknown as {state:ArenaState}).state;
    state.redScore = 50; await h.advance(TICK_MS);
    if (vote) await a.send('voteRestart');
    else vi.setSystemTime(Date.now() + 2000);
    await h.advance(TICK_MS);
    expect(state.phase).toBe('warmup');
  }
});

it('rounds up seconds, waits for server at zero and handles older servers without inventing a deadline', () => {
  expect(intermissionLabel(20000, 7001)).toBe('IN 13s');
  expect(intermissionLabel(20000, 19999)).toBe('IN 1s');
  expect(intermissionLabel(20000, 20000)).toBe('AWAITING SERVER');
  expect(intermissionLabel(20000, 25000)).toBe('AWAITING SERVER');
  expect(intermissionLabel(undefined, 1000)).toBe('AUTOMATIC / STAND BY');
  expect(intermissionLabel(NaN, 1000)).toBe('AUTOMATIC / STAND BY');
});
