import { describe, expect, it } from 'vitest';
import type { ArenaPlayer, ArenaState } from '../src/schema.js';
import type { Box } from '../src/physics.js';
import type { RampDef } from '../src/map/types.js';
import { STRAFE, StrafeSupport } from '../src/strafe-support.js';
import { AirSupport, RECON } from '../src/air-support.js';
import { MORTAR, MortarSupport } from '../src/mortar.js';
import { signalFrame } from '../src/signal-event.js';
import { HIT_ANIMATION_NONE } from '../src/hit-state-bucket.js';

const player = (team: number, x: number, z = 50): ArenaPlayer => ({
  x, y: 0, z, team, hp: 100, alive: true, prot: false, yaw: Math.PI / 2,
  pitch: 0, crouch: false, k: 0, d: 0, weapon: 0, nades: 2, reloadEnd: 0,
  hitClipIndex: HIT_ANIMATION_NONE, hitClipStartedAt: 0, hitBlendSources: [], hitReactionKind: 0, hitReactionStartedAt: 0, hitReactionSeq: 0,
  hitSegmentSeq: 0, hitSegmentStartedAt: 0,
});
const state = (): ArenaState => ({
  players: { owner: player(0, 75), west: player(1, 52.5), east: player(1, 97.5) },
  mode: 0, phase: 'live', seed: 1, redScore: 0, blueScore: 0,
  signalAt: 0, coreOpen: false, warmupEndMs: 0, matchEndMs: 1e9,
  capA: 100, capB: 100, capC: 100,
});
const bounds = { width: 150, depth: 100, ceiling: 16 };

describe('WW1 fixed-path attack biplane', () => {
  it('freezes one 60m corridor, warns for 3s, then makes four 500ms bursts without retargeting', () => {
    const support = new StrafeSupport(), match = state();
    support.earn('owner', STRAFE.kills, match);
    expect(support.tick(match, 1_000, [], bounds, new Map(), []).changed).toBe(true);
    const flight = support.view('owner', match).flights[0]!;
    expect(flight.corridor).toMatchObject({ start: { x: 45, z: 50 }, end: { x: 105, z: 50 }, width: 4 });
    expect(flight.warningEndsAt).toBe(4_000);
    expect(flight.endsAt).toBe(6_000);
    match.players.owner!.yaw = -Math.PI / 2;
    expect(support.tick(match, 3_999, [], bounds, new Map(), []).shots).toEqual([]);
    const bursts = [4_000, 4_500, 5_000, 5_500].map(now => support.tick(match, now, [], bounds, new Map(), []).shots);
    expect(bursts.flat().map(shot => shot.burst)).toEqual([0, 3]);
    expect(support.tick(match, 5_500, [], bounds, new Map(), []).shots).toEqual([]);
    expect(support.view('owner', match).flights[0]!.corridor).toEqual(flight.corridor);
  });

  it('rechecks occupancy, protection, box cover, and ramp cover at each authoritative burst', () => {
    const run = (boxes: readonly Box[] = [], ramps: readonly RampDef[] = []) => {
      const support = new StrafeSupport(), match = state();
      support.earn('owner', STRAFE.kills, match);
      support.tick(match, 1_000, boxes, bounds, new Map(), ramps);
      return { support, match };
    };
    const departed = run();
    departed.match.players.west!.z = 54;
    expect(departed.support.tick(departed.match, 4_000, [], bounds, new Map(), []).shots).toEqual([]);
    const protectedTarget = run();
    protectedTarget.match.players.west!.prot = true;
    expect(protectedTarget.support.tick(protectedTarget.match, 4_000, [], bounds, new Map(), []).shots).toEqual([]);
    const roof: Box = { min: { x: 50, y: 2, z: 48 }, max: { x: 55, y: 3, z: 52 } };
    const boxed = run([roof]);
    expect(boxed.support.tick(boxed.match, 4_000, [roof], bounds, new Map(), []).shots).toEqual([]);
    const ramp: RampDef = { minX: 50, maxX: 55, minZ: 48, maxZ: 52, baseY: 0, topY: 3, axis: 'x', dir: 1 };
    const sloped = run([], [ramp]);
    expect(sloped.support.tick(sloped.match, 4_000, [], bounds, new Map(), [ramp]).shots).toEqual([]);
  });

  it('rejects FFA, stale phases, owner loss, and clears deadlines so late ticks deal no damage', () => {
    for (const mode of [1] as const) {
      const support = new StrafeSupport(), match = state(); match.mode = mode;
      support.earn('owner', STRAFE.kills, match);
      expect(support.tick(match, 1_000, [], bounds, new Map(), []).shots).toEqual([]);
      expect(support.view('owner', match).flights).toEqual([]);
    }
    for (const cancel of ['leave', 'phase', 'restore'] as const) {
      const support = new StrafeSupport(), match = state();
      support.earn('owner', STRAFE.kills, match); support.tick(match, 1_000, [], bounds, new Map(), []);
      if (cancel === 'leave') support.forget('owner');
      if (cancel === 'phase') match.phase = 'ended';
      if (cancel === 'restore') support.clear();
      expect(support.tick(match, 4_000, [], bounds, new Map(), []).shots, cancel).toEqual([]);
    }
  });

  it('keeps practice private and only permits registered practice targets', () => {
    const support = new StrafeSupport(), match = state(); match.mode = 3;
    support.earn('owner', STRAFE.kills, match); support.tick(match, 1_000, [], bounds, new Map([['west', {}]]), []);
    expect(support.view('east', match).flights).toEqual([]);
    expect(support.tick(match, 4_000, [], bounds, new Map([['west', {}]]), []).shots.map(shot => shot.victim)).toEqual(['west']);
  });
});

describe('WW1 support authority boundaries', () => {
  it('expires observation snapshots and excludes contacts beneath overhead cover', () => {
    const support = new AirSupport(), match = state();
    const roof: Box = { min: { x: 50, y: 2, z: 48 }, max: { x: 55, y: 3, z: 52 } };
    support.earn('owner', RECON.kills, match); support.tick(match, 1_000, false, [roof]);
    support.tick(match, 3_000, false, [roof]);
    expect(support.view('owner', RECON.kills, match, 3_000).scan?.contacts).toEqual([{ x: 98, z: 50 }]);
    expect(support.view('owner', RECON.kills, match, 3_000).kind).toBe('observation_biplane');
    expect(support.view('owner', RECON.kills, match, 3_000 + RECON.contactMs).scan).toBeNull();
  });

  it('publishes server-owned mortar warning deadlines and drops stale impact catch-up', () => {
    const support = new MortarSupport(), match = state(), point = { x: 80, y: .12, z: 50 };
    support.earn('owner', MORTAR.kills, match); expect(support.call('owner', match, 1_000, point)).toBe(true);
    const strike = support.view('owner', match).strikes[0]!;
    expect(strike).toMatchObject({ kind: 'ww1_mortar', warningEndsAt: 4_000, startedAt: 1_000 });
    expect(support.tick(match, 4_300).impacts).toEqual([]);
  });

  it('frames interruption as a field-line observation outage with a fixed server deadline', () => {
    expect(signalFrame(1_000, 'live', 9_000)).toMatchObject({
      protocol: 2, service: 'field_line', effect: 'observation_interrupted', phase: 'blackout', remainingMs: 15_000,
    });
    expect(signalFrame(1_000, 'live', 24_000)).toMatchObject({ effect: 'recovering', phase: 'recovery' });
  });
});
