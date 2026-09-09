import type { DroneSupport, DroneFlight } from '../src/drone.js';
import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error Node-only opt-in tool; production tsconfig targets Workers.
import { writeFileSync } from 'node:fs';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaPlayer } from '../src/schema.js';
import { ARENA1 } from '../src/map/arena1.js';
import { nearestBox } from '../src/physics.js';
import { PLAYER } from '../src/config.js';
import { CoreCollision } from '../src/core-gate.js';
import type { MortarSupport, MortarStrike } from '../src/mortar.js';
import type { AirSupport, ReconFlight } from '../src/air-support.js';
import type { ArenaState } from '../src/schema.js';

// RELAY_METRICS=1 pnpm exec vitest run test/relay-metrics.tool.test.ts
// Optional METRICS_SEED and METRICS_PREFIX retain independent natural rounds.
// No shortened clocks, changed damage/respawn rules, teleports or scripted routes.
// In-process room/production bot evidence; not workerd capacity or human balance.
// @ts-expect-error Node-only opt-in tool.
describe.skipIf(process.env.RELAY_METRICS !== '1')('expanded Relay natural bot round', () => {
  it('records a complete 6v6 round, life contact samples and a death heatmap', { timeout: 120000 }, async () => {
    // @ts-expect-error Node-only opt-in tool.
    const prefix: string = process.env.METRICS_PREFIX ?? 'session28';
    // @ts-expect-error Node-only opt-in tool.
    const seed = Number(process.env.METRICS_SEED ?? 0x28abc);
    if (!/^[a-zA-Z0-9-]+$/.test(prefix)) throw new Error('Invalid METRICS_PREFIX');
    if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Invalid METRICS_SEED');
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(arr => {
      if (arr) new Uint32Array(arr.buffer, arr.byteOffset, 1)[0] = seed;
      return arr;
    });
    const kills: { vx: number; vz: number; kx: number; kz: number }[] = [];
    vi.spyOn(console, 'log').mockImplementation((raw: unknown) => {
      if (typeof raw !== 'string' || !raw.startsWith('{')) return;
      const event = JSON.parse(raw);
      if (event.tag === 'killPos') kills.push(event);
    });
    try {
      const h = await createTestRoom(ArenaRoomImpl, { id: 'arena-tdm', codec: ArenaSchema, sync: 'throttled' });
      // The real simulation fills all twelve empty seats. No observer consumes a team slot.
      let liveAt = 0, endedAt = 0;
      const collision=new CoreCollision(ARENA1);
      const coreTransitions:{atMs:number;open:boolean}[]=[], coreVisitors=new Set<string>();
      let coreSamples=0, priorOpen=false;
      const supportFlights = new Map<string, ReconFlight>(), supportScans = new Map<string, {atMs:number;team:number;contacts:number}>();
      const drones = new Map<string, DroneFlight>(); const droneEarners = new Set<string>(); let maxStreak = 0;
      let supportPeak = 0; const mortarStrikes = new Map<string, MortarStrike>();
      const lives: { id: string; team: number; bornMs: number; initial: boolean; losMs?: number; damageMs?: number }[] = [];
      const active = new Map<string, typeof lives[number]>();
      let previous: Record<string, ArenaPlayer> = {};
      for (let elapsed = 100; elapsed <= 320000; elapsed += 100) {
        await h.advance(100);
        const state = h.snapshot();
        if (state.phase !== 'live' && !liveAt) continue;
        if (!liveAt) { liveAt = elapsed; previous = {}; }
        if (state.phase === 'ended') { endedAt = elapsed; break; }
        const players = Object.entries(state.players);
        // Read-only production support telemetry; no observer takes a seat and
        // no streak, aim, HP, route or reward is injected by this tool.
        const runtime = h.room as unknown as { droneSupport: DroneSupport; mortarSupport: MortarSupport; airSupport: AirSupport; streaks: Map<string, number>; state: ArenaState };
        for (const [id, p] of players) {
          maxStreak = Math.max(maxStreak, runtime.streaks.get(id) ?? 0);
          if (runtime.droneSupport.view(id,runtime.state,collision.hits(state.coreOpen)).queued) droneEarners.add(id);
          for (const f of runtime.droneSupport.view(id,runtime.state,collision.hits(state.coreOpen)).flights) drones.set(`${f.owner}:${f.startedAt}`,f);
          for (const strike of runtime.mortarSupport.view(id,runtime.state).strikes) mortarStrikes.set(`${strike.owner}:${strike.startedAt}`,strike);
          const view = runtime.airSupport.view(id, runtime.streaks.get(id) ?? 0, runtime.state, Date.now());
          supportPeak = Math.max(supportPeak, view.flights.length);
          for (const f of view.flights) supportFlights.set(`${f.owner}:${f.startedAt}`, f);
          if (view.scan) supportScans.set(`${p.team}:${view.scan.sampledAt}`, {atMs:view.scan.sampledAt-1000000-liveAt,team:p.team,contacts:view.scan.contacts.length});
        }
        if(state.coreOpen!==priorOpen){coreTransitions.push({atMs:elapsed-liveAt,open:state.coreOpen});priorOpen=state.coreOpen;}
        for(const [id,p] of players)if(p.alive && p.x>70.5 && p.x<79.5 && p.z>48 && p.z<52 && p.y<3){coreVisitors.add(id);coreSamples++;}
        expect(players).toHaveLength(12);
        for (const [id, p] of players) {
          if (!p.alive) { active.delete(id); continue; }
          let life = active.get(id);
          if (!life) { life = { id, team: p.team, bornMs: elapsed - liveAt, initial: !previous[id] }; active.set(id, life); lives.push(life); }
          if (life.damageMs === undefined && p.hp < (previous[id]?.hp ?? 100)) life.damageMs = elapsed - liveAt - life.bornMs;
          if (life.losMs === undefined && players.some(([otherId, e]) => {
            if (otherId === id || !e.alive || e.team === p.team) return false;
            const dx = e.x - p.x, dz = e.z - p.z, dy = e.y - p.y;
            const d = Math.hypot(dx, dy, dz);
            return d > .01 && d <= 100 && nearestBox({ x: p.x, y: p.y + PLAYER.standEye, z: p.z },
              { x: dx / d, y: dy / d, z: dz / d }, collision.hits(state.coreOpen), d) === Infinity;
          })) life.losMs = elapsed - liveAt - life.bornMs;
        }
        previous = structuredClone(state.players);
      }
      const state = h.snapshot();
      expect(state.phase).toBe('ended');
      writeFileSync(`.inspect/${prefix}-bot-debug.json`, JSON.stringify({state,lives,killCount:kills.length},null,2));
      const cells = new Map<string, number>();
      for (const k of kills) { const key = `${Math.floor(k.vx / 5)},${Math.floor(k.vz / 5)}`; cells.set(key, (cells.get(key) ?? 0) + 1); }
      const report = { note: 'One seeded natural production-bot 6v6 TDM round in the test harness. LOS is a 100m eye-segment opportunity, without FOV; damage is sampled each 100ms. Unobserved contact remains absent, never zero. Not human fairness or deployed capacity.',
        bounds: ARENA1.bounds, seed, liveAtMs: liveAt, durationMs: endedAt - liveAt,
        core:{transitions:coreTransitions,visitors:[...coreVisitors],samples:coreSamples,sampleMs:100},
        support:{maxStreak,droneEarners:[...droneEarners],drones:[...drones.values()],mortars:[...mortarStrikes.values()],flights:[...supportFlights.values()],scans:[...supportScans.values()],peakFlights:supportPeak},
        redScore: state.redScore, blueScore: state.blueScore, lives, kills, cells: Object.fromEntries(cells) };
      writeFileSync(`.inspect/${prefix}-bot-round.json`, JSON.stringify(report, null, 2));
      expect(kills.length).toBeGreaterThan(0);
      const solids = ARENA1.boxes.map(b => `<rect x="${b.min.x}" y="${b.min.z}" width="${b.max.x-b.min.x}" height="${b.max.z-b.min.z}" fill="#536b70"/>`).join('');
      const heat = [...cells].map(([key, n]) => { const [x, z] = key.split(',').map(Number); return `<rect x="${x! * 5}" y="${z! * 5}" width="5" height="5" fill="#ff984d" opacity="${Math.min(.95, .2 + n * .08)}"><title>${n} deaths</title></rect>`; }).join('');
      writeFileSync(`.inspect/${prefix}-bot-heatmap.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -12 154 116"><rect x="-2" y="-12" width="154" height="116" fill="#132b33"/><text x="1" y="-5" fill="white" font-size="4">RELAY / 6v6 bots / ${state.redScore}:${state.blueScore} / ${((endedAt-liveAt)/1000).toFixed(1)}s</text>${solids}${heat}</svg>`);
    } finally { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); }
  });
});
