import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error -- this opt-in Node tool shares the Workers-only tsconfig (no @types/node)
import { writeFile } from 'node:fs/promises';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { botReached, type BotArchetype, type BotBrain } from '../src/bots.js';
declare const process: { env: Record<string, string | undefined> };

/** Opt-in deterministic natural round telemetry, independent of GPU acceptance.
 * BOT_TACTICS_REPORT=1 pnpm exec vitest run test/bot-tactics-round.tool.test.ts
 * No player placement, invented damage, or modified bot/weapon settings.
 */
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
it.skipIf(!process.env.BOT_TACTICS_REPORT)('records natural combat and reached reload cover in TDM and FFA', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000000);
  class Round extends ArenaRoomImpl { protected override startInWarmup = false; }
  const reports = [];
  for (const mode of ['tdm', 'ffa']) {
    const h = await createTestRoom(Round, { id: `arena-${mode}`, codec: ArenaSchema, sync: 'throttled' });
    const r = h.room as unknown as { state: ArenaState; botBrains: Map<string, BotBrain> };
    const roles = new Map<BotArchetype, { reloads: number; coverTrips: number; coverArrivals: number; kills: number }>();
    const lastReload = new Map<string, number>(), lastTrip = new Map<string, object>(), arrived = new Set<object>();
    for (let tick = 0; tick < 2400; tick++) {
      await h.advance(50);
      for (const [id, brain] of r.botBrains) {
        const p = r.state.players[id]; if (!p || !brain.archetype) continue;
        if (!roles.has(brain.archetype)) roles.set(brain.archetype, { reloads: 0, coverTrips: 0, coverArrivals: 0, kills: 0 });
        const counters = roles.get(brain.archetype)!;
        if (p.reloadEnd && p.reloadEnd !== lastReload.get(id)) counters.reloads++;
        lastReload.set(id, p.reloadEnd);
        if (brain.recovery) {
          if (lastTrip.get(id) !== brain.recovery) { counters.coverTrips++; lastTrip.set(id, brain.recovery); }
          if (!arrived.has(brain.recovery) && botReached(p, brain.recovery.point, .35)) {
            arrived.add(brain.recovery); counters.coverArrivals++;
          }
        }
      }
    }
    for (const [id, p] of Object.entries(r.state.players)) {
      const role = r.botBrains.get(id)?.archetype;
      if (role) roles.get(role)!.kills += p.k;
    }
    const report = { mode, durationMs: 120000, roles: Object.fromEntries(roles),
      kills: Object.values(r.state.players).reduce((total, p) => total + p.k, 0) };
    reports.push(report);
    expect(report.kills).toBeGreaterThan(0);
    expect([...roles.values()].reduce((total, s) => total + s.reloads, 0)).toBeGreaterThan(0);
    expect([...roles.values()].reduce((total, s) => total + s.coverArrivals, 0)).toBeGreaterThan(0);
    vi.clearAllTimers(); // this harness exposes no dispose; release its fake tick/sync timers
  }
  await writeFile('.inspect/combat-s1-natural-tactics.json', JSON.stringify(reports, null, 2));
}, 60000);
