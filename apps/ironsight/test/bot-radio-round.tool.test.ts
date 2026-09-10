import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error -- opt-in Node telemetry, shared Workers-only test tsconfig
import { writeFile } from 'node:fs/promises';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import type { BotRadio } from '../src/rooms/bot-radio.js';
import type { SquadPing } from '../src/bots.js';
declare const process: { env: Record<string, string | undefined> };
const wallNow = performance.now.bind(performance);
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
it.skipIf(!process.env.BOT_RADIO_REPORT)('records radio in three natural bot rounds without tactical or damage injection', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000000);
  class Round extends ArenaRoomImpl { protected override startInWarmup = false; }
  const reports = [];
  for (const mode of ['tdm', 'dom', 'ffa']) {
    const h = await createTestRoom(Round, { id: `arena-${mode}`, codec: ArenaSchema, sync: 'throttled' });
    const r = h.room as unknown as { state: ArenaState; botContacts: BotRadio; tickBots: (dt: number) => void };
    const calls: (SquadPing & { at: number; team: number })[] = [], times: number[] = [];
    const observe = r.botContacts.observe.bind(r.botContacts), tickBots = r.tickBots.bind(r);
    vi.spyOn(r.botContacts, 'observe').mockImplementation((...args) => {
      const ping = observe(...args);
      if (ping) calls.push({ ...ping, at: Date.now(), team: args[1].self.team });
      return ping;
    });
    vi.spyOn(r, 'tickBots').mockImplementation(dt => { const start = wallNow(); tickBots(dt); times.push(wallNow() - start); });
    for (let tick = 0; tick < 3600 && r.state.phase !== 'ended'; tick++) await h.advance(50);
    times.sort((a, b) => a - b);
    reports.push({ mode, ticks: times.length, botTickMs: { p50: times[Math.floor(times.length * .5)],
      p95: times[Math.floor(times.length * .95)], max: times.at(-1) }, calls,
      counts: Object.fromEntries([...new Set(calls.map(p => p.radio))].map(kind => [kind, calls.filter(p => p.radio === kind).length])),
      kills: Object.values(r.state.players).reduce((sum, p) => sum + p.k, 0) });
    vi.restoreAllMocks(); vi.clearAllTimers();
  }
  await writeFile('.inspect/combat-s6-natural-radio-verified.json', JSON.stringify(reports, null, 2));
  for (const r of reports) {
    expect(r.kills).toBeGreaterThan(0);
    if (r.mode === 'ffa') expect(r.calls).toHaveLength(0);
    else {
      expect(r.calls.length).toBeGreaterThan(10);
      for (const team of [0, 1]) {
        const calls = r.calls.filter(p => p.team === team);
        for (let i = 1; i < calls.length; i++) expect(calls[i]!.at - calls[i - 1]!.at).toBeGreaterThanOrEqual(8000);
      }
    }
  }
  // Airtime is shared, so a busy DOM team may have no free channel during a
  // reload. Require variety over the observed rounds, not every kind per map.
  expect(reports.some(r => r.calls.some(p => p.radio === 'reload'))).toBe(true);
}, 120000);
