import { describe, expect, it } from 'vitest';
import { RoundHonors } from '../src/round-honors.js';
import { DOM_MODE, type ModeCtx } from '../src/modes.js';
import { ARENA2 } from '../src/map/arena2.js';
import { MODES } from '../src/config.js';
import type { ArenaState, ArenaPlayer } from '../src/schema.js';

const player = (team = 0, k = 0, d = 0): ArenaPlayer => ({ x: 0, y: 0, z: 0,
  yaw: 0, pitch: 0, hp: 100, team, alive: true, crouch: false, prot: false,
  k, d, weapon: 0, nades: 2, reloadEnd: 0 });
const state = (): ArenaState => ({ players: { cap: player(), frag: player(0, 1), enemy: player(1, 99) },
  seed: 1, redScore: 0, blueScore: 0, phase: 'live', mode: 2, matchEndMs: 1e9,
  signalAt: 0, coreOpen: false, warmupEndMs: 0, capA: 100, capB: 100, capC: 100 });

describe('server round honors', () => {
  it('values useful objective work above raw kills and only selects the winning team', () => {
    const h = new RoundHonors(), s = state();
    h.capture(['cap'], 4000);
    expect(h.select(s, 'red')).toEqual({ id: 'cap', team: 0, kills: 0, assists: 0, captureSeconds: 4, score: 4 });
    expect(h.select(s, 'blue')?.id).toBe('enemy');
    expect(h.select(s, 'draw')).toBeUndefined();
    s.mode = 3; expect(h.select(s, 'red')).toBeUndefined();
  });

  it('conserves actual gauge progress across teammates, clipping, contests and idle holding', () => {
    const h = new RoundHonors(), s = state();
    s.players.frag!.k = 0;
    const ctx: ModeCtx = { state: s, now: 1000,
      broadcast: () => {},
      playersAt: (x, z) => x === ARENA2.caps.a.x && z === ARENA2.caps.a.z
        ? Object.entries(s.players).filter(([, p]) => p.x === 0).map(([id, p]) => ({id, ...p})) : [],
      captureProgress: (ids, gauge) => h.capture(ids, gauge / MODES.dom.capturePerSec * 1000),
    };
    // Contested: no useful progress and no points, regardless of elapsed time.
    DOM_MODE.tick(ctx, 1000); expect(h.select(s, 'red')).toBeUndefined();
    s.players.enemy!.x = 20;
    // 4s neutral cap; clipping a 5s tick still credits only 4s shared = 2s each.
    DOM_MODE.tick(ctx, 5000);
    expect(s.capA).toBe(200);
    expect(h.select(s, 'red')).toMatchObject({ id: 'cap', captureSeconds: 2, score: 2 });
    DOM_MODE.tick(ctx, 5000);
    expect(h.select(s, 'red')?.captureSeconds).toBe(2);
    s.players.frag!.alive = false; s.capA = 100;
    DOM_MODE.tick(ctx, 4000);
    expect(h.select(s, 'red')?.captureSeconds).toBe(6);
  });

  it('counts verified assists once, ignores invalid peers/warmup/practice and clears expired seats', () => {
    const h = new RoundHonors(), s = state();
    s.mode = 0; s.players.frag!.k = 0;
    h.assist(s, 'cap', 'frag', 'enemy');
    h.assist(s, 'cap', 'cap', 'enemy');
    h.assist(s, 'enemy', 'frag', 'enemy');
    h.assist(s, 'absent', 'frag', 'enemy');
    h.assist(s, 'cap', 'enemy', 'frag');
    s.phase = 'warmup'; h.assist(s, 'cap', 'frag', 'enemy'); s.phase = 'live';
    s.mode = 3; h.assist(s, 'cap', 'frag', 'enemy'); s.mode = 0;
    expect(h.select(s, 'red')).toMatchObject({ id: 'cap', assists: 1, score: 1 });
    h.forget('cap'); expect(h.select(s, 'red')).toBeUndefined();
    h.assist(s, 'cap', 'frag', 'enemy'); h.clear();
    expect(h.select(s, 'red')).toBeUndefined();
  });

  it('breaks ties deterministically and freezes plain result evidence across reset/leave', () => {
    const h = new RoundHonors(), s = state();
    s.players.cap!.k = 1;
    const selected = h.select(s, 'red');
    expect(selected?.id).toBe('cap');
    s.players.cap!.d = 2; expect(h.select(s, 'red')?.id).toBe('frag');
    delete s.players.cap; h.clear();
    expect(selected).toEqual({id:'cap',team:0,kills:1,assists:0,captureSeconds:0,score:2});
  });

  it('uses the actual FFA winner, never team colour or a runner-up', () => {
    const h = new RoundHonors(), s = state(); s.mode = 1;
    expect(h.select(s, 'frag')?.id).toBe('frag');
    expect(h.select(s, 'red')).toBeUndefined();
    expect(h.select(s, 'missing')).toBeUndefined();
  });
});
