import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error Node-only opt-in tool; production tsconfig targets Workers.
import { writeFileSync } from 'node:fs';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer } from '../src/schema.js';
import { ARENA3 } from '../src/map/arena3.js';
import { nearestBox } from '../src/physics.js';
import { PLAYER } from '../src/config.js';

// SWITCHYARD_METRICS=1 pnpm exec vitest run test/switchyard-metrics.tool.test.ts
// Optional METRICS_PREFIX saves independent session evidence.
// No shortened clocks, changed damage/respawn rules, teleports or scripted routes.
// In-process room/production bot evidence; not workerd capacity or human balance.
// @ts-expect-error Node-only opt-in tool.
describe.skipIf(process.env.SWITCHYARD_METRICS !== '1')('expanded Switchyard natural bot round', () => {
  it('records a complete twelve-player FFA round, life contact samples and a death heatmap', { timeout: 120000 }, async () => {
    // @ts-expect-error Node-only opt-in tool.
    const prefix: string = process.env.METRICS_PREFIX ?? 'session30';
    if (!/^[a-zA-Z0-9-]+$/.test(prefix)) throw new Error('Invalid METRICS_PREFIX');
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(arr => {
      if (arr) new Uint32Array(arr.buffer, arr.byteOffset, 1)[0] = 0x30abc;
      return arr;
    });
    const kills: { vx: number; vz: number; kx: number; kz: number }[] = [];
    vi.spyOn(console, 'log').mockImplementation((raw: unknown) => {
      if (typeof raw !== 'string' || !raw.startsWith('{')) return;
      const event = JSON.parse(raw);
      if (event.tag === 'killPos') kills.push(event);
    });
    try {
      const h = await createTestRoom(ArenaRoomImpl, { id: 'arena-ffa', codec: ArenaSchema, sync: 'throttled' });
      // The real simulation fills twelve FFA seats; no observer consumes a slot.
      let liveAt = 0, endedAt = 0;
      const lives: { id: string; team: number; bornMs: number; initial: boolean; losMs?: number; damageMs?: number }[] = [];
      const active = new Map<string, typeof lives[number]>();
      let previous: Record<string, ArenaPlayer> = {};
      for (let elapsed = 100; elapsed <= 320000; elapsed += 100) {
        await h.advance(100);
        const state = h.snapshot();
        if (state.phase !== 'live' && !liveAt) continue;
        if (!liveAt) { liveAt = elapsed; previous = {}; kills.length = 0; }
        if (state.phase === 'ended') { endedAt = elapsed; break; }
        const players = Object.entries(state.players);
        expect(players).toHaveLength(12);
        for (const [id, p] of players) {
          if (!p.alive) { active.delete(id); continue; }
          let life = active.get(id);
          if (!life) { life = { id, team: p.team, bornMs: elapsed - liveAt, initial: !previous[id] }; active.set(id, life); lives.push(life); }
          if (life.damageMs === undefined && p.hp < (previous[id]?.hp ?? 100)) life.damageMs = elapsed - liveAt - life.bornMs;
          if (life.losMs === undefined && players.some(([otherId, e]) => {
            if (otherId === id || !e.alive) return false;
            const dx = e.x - p.x, dz = e.z - p.z, dy = e.y - p.y;
            const d = Math.hypot(dx, dy, dz);
            return d > .01 && d <= 100 && nearestBox({ x: p.x, y: p.y + PLAYER.standEye, z: p.z },
              { x: dx / d, y: dy / d, z: dz / d }, ARENA3.boxes, d) === Infinity;
          })) life.losMs = elapsed - liveAt - life.bornMs;
        }
        previous = structuredClone(state.players);
      }
      const state = h.snapshot();
      expect(state.phase).toBe('ended');
      writeFileSync(`.inspect/${prefix}-bot-debug.json`, JSON.stringify({state,lives,killCount:kills.length},null,2));
      const cells = new Map<string, number>();
      for (const k of kills) { const key = `${Math.floor(k.vx / 5)},${Math.floor(k.vz / 5)}`; cells.set(key, (cells.get(key) ?? 0) + 1); }
      const report = { note: 'One seeded natural production-bot twelve-player FFA round in the test harness. LOS is a 100m eye-segment opportunity, without FOV; damage is sampled each 100ms. Unobserved contact remains absent, never zero. Not human fairness or deployed capacity.',
        bounds: ARENA3.bounds, seed: 0x30abc, liveAtMs: liveAt, durationMs: endedAt - liveAt,
        redScore: state.redScore, blueScore: state.blueScore, standings: Object.entries(state.players).map(([id, p]) => ({ id, kills: p.k, deaths: p.d })), lives, kills, cells: Object.fromEntries(cells) };
      writeFileSync(`.inspect/${prefix}-bot-round.json`, JSON.stringify(report, null, 2));
      expect(kills.length).toBeGreaterThan(0);
      const solids = ARENA3.boxes.map(b => `<rect x="${b.min.x}" y="${b.min.z}" width="${b.max.x-b.min.x}" height="${b.max.z-b.min.z}" fill="#536b70"/>`).join('');
      const heat = [...cells].map(([key, n]) => { const [x, z] = key.split(',').map(Number); return `<rect x="${x! * 5}" y="${z! * 5}" width="5" height="5" fill="#ff984d" opacity="${Math.min(.95, .2 + n * .08)}"><title>${n} deaths</title></rect>`; }).join('');
      writeFileSync(`.inspect/${prefix}-bot-heatmap.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -12 154 116"><rect x="-2" y="-12" width="154" height="116" fill="#132b33"/><text x="1" y="-5" fill="white" font-size="4">SWITCHYARD / 12 FFA bots / ${Math.max(...Object.values(state.players).map(p => p.k))} winning kills / ${((endedAt-liveAt)/1000).toFixed(1)}s</text>${solids}${heat}</svg>`);
    } finally { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); }
  });
});
