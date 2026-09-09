import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { TICK_MS } from '../src/config.js';
import { DeploymentPresentation, warmupSeconds } from '../client/deployment-presentation.js';

class CountdownRoom extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override warmupMinPlayers = 2;
  protected override warmupMs = 1000;
  protected override intermissionMs = 100;
  protected override reconnectWindowSec = .1;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000000); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it('publishes one deadline to late joins, rejects forged deadlines, and starts on the server boundary', async () => {
  const h = await createTestRoom(CountdownRoom, { id: 'arena-tdm', codec: ArenaSchema });
  const first = await h.connect('first'); await h.advance(TICK_MS);
  expect(h.snapshot().warmupEndMs).toBe(0);
  await h.connect('second'); await h.advance(TICK_MS);
  const deadline = h.snapshot().warmupEndMs;
  expect(deadline).toBe(Date.now() + Math.ceil(1000 / TICK_MS) * TICK_MS);
  await h.advance(200); const late = await h.connect('late');
  await first.send('move', { mx: 0, mz: 0, warmupEndMs: 1, phase: 'live' });
  await h.advance(TICK_MS);
  expect(h.snapshot().warmupEndMs).toBe(deadline);
  expect(late.frames().some(f => f.t === 's:welcome')).toBe(true);
  await h.advance(deadline - Date.now() - 1);
  expect(h.snapshot().phase).toBe('warmup');
  await h.advance(TICK_MS + 1);
  expect(h.snapshot().phase).toBe('live'); expect(h.snapshot().warmupEndMs).toBe(0);
});

it('cancels when seats expire, rearms for a new group, and uses the published clock after a delayed tick', async () => {
  const h = await createTestRoom(CountdownRoom, { id: 'arena-tdm', codec: ArenaSchema });
  await h.connect('first'); const second = await h.connect('second'); await h.advance(TICK_MS);
  const old = h.snapshot().warmupEndMs;
  const closing = second.close(); await h.advance(250); await closing;
  expect(h.snapshot().phase).toBe('warmup'); expect(h.snapshot().warmupEndMs).toBe(0);
  await h.connect('replacement'); await h.advance(TICK_MS);
  const next = h.snapshot().warmupEndMs; expect(next).toBeGreaterThan(old);
  vi.setSystemTime(next + 300); await h.advance(TICK_MS);
  expect(h.snapshot().phase).toBe('live'); expect(h.snapshot().warmupEndMs).toBe(0);
  const state = (h.room as unknown as { state: ArenaState }).state;
  state.redScore = 50; await h.advance(TICK_MS);
  expect(h.snapshot().phase).toBe('ended'); expect(h.snapshot().warmupEndMs).toBe(0);
  await h.advance(200);
  expect(h.snapshot().phase).toBe('warmup'); expect(h.snapshot().warmupEndMs).toBeGreaterThan(next);
});

const warmup = { players: {}, seed: 1, redScore: 0, blueScore: 0, phase: 'warmup',
  matchEndMs: 1e9, warmupEndMs: 10000, signalAt: 0, coreOpen: false, mode: 0,
  capA: 100, capB: 100, capC: 100 } satisfies ArenaState;

it('shows 3/2/1 once each, never GO from the local clock, and expires the confirmed start', () => {
  const p = new DeploymentPresentation();
  expect(p.update(warmup, 6000, true).cue).toBeUndefined();
  for (const [now, seconds] of [[7000, 3], [8000, 2], [9000, 1]]) {
    expect(p.update(warmup, now!, true)).toEqual({ kind: 'countdown', seconds, cue: 'tick' });
    expect(p.update(warmup, now! + 50, true).cue).toBeUndefined();
  }
  expect(p.update(warmup, 10000, true)).toMatchObject({ kind: 'standby', cue: undefined });
  const live = { ...warmup, phase: 'live' as const, warmupEndMs: 0 };
  expect(p.update(live, 10050, true)).toMatchObject({ kind: 'go', cue: 'go' });
  expect(p.update(live, 10060, true).cue).toBeUndefined();
  expect(p.update(live, 12250, true).kind).toBe('hidden');
});

it('does not replay skipped/rewound beats, initial live joins, pause/reconnect or background starts', () => {
  const p = new DeploymentPresentation(), live = { ...warmup, phase: 'live' as const, warmupEndMs: 0 };
  expect(p.update(live, 10050, true).kind).toBe('hidden');
  p.update(warmup, 6500, true);
  expect(p.update(warmup, 8600, true).cue).toBeUndefined(); // missed 3 and late for 2
  expect(p.update(warmup, 7100, true).cue).toBeUndefined(); // clock correction
  expect(p.update(warmup, 8000, true).cue).toBeUndefined();
  p.update(warmup, 8900, false);
  expect(p.update(warmup, 9000, true).cue).toBeUndefined();
  p.update(warmup, 9500, false);
  expect(p.update(live, 10050, true).kind).toBe('hidden');
  p.update(warmup, 9000, true);
  expect(p.update(live, 15000, true).kind).toBe('hidden');
  expect(p.update({ ...warmup, mode: 3 }, 7000, true).kind).toBe('hidden');
  expect(warmupSeconds({ ...warmup, warmupEndMs: Infinity }, 0)).toBeNull();
  expect(p.update({ ...warmup, warmupEndMs: 0 }, 7000, true).kind).toBe('waiting');
});

it('trusts a confirmed LIVE edge despite clock-sync error and expires with monotonic render time', () => {
  const p = new DeploymentPresentation(), live = { ...warmup, phase: 'live' as const, warmupEndMs: 0 };
  p.update(warmup, 9800, true, 100);
  expect(p.update(live, 9900, true, 200).cue).toBe('go');
  expect(p.update(live, 9700, true, 2399).kind).toBe('go');
  expect(p.update(live, 9700, true, 2400).kind).toBe('hidden');
  expect(p.update(live, 9600, true, 2401).kind).toBe('hidden');
});
