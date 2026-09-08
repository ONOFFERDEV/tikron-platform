import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema } from '../src/schema.js';
import { WEAPONS, WEAPON } from '../src/config.js';
import { advanceRecoil, emptyRecoil, recoilSample, RecoilPrediction } from '../src/recoil.js';
import { accuracySpread, dirFromAngles, jitter } from '../src/weapons.js';

describe('shared recoil and accuracy', () => {
  it.each(WEAPONS)('$name: centered first shot, bounded pattern, exact recovery and slot reset', spec => {
    let s = emptyRecoil();
    expect(recoilSample(s, spec, 1000)).toMatchObject({ index: 0, yaw: 0, pitch: 0 });
    for (let i = 0; i < spec.mag; i++) s = advanceRecoil(s, spec, 1000 + i * spec.fireIntervalMs);
    const wait = Math.min(150, spec.fireIntervalMs * 1.5) + spec.recoil.recoverMs;
    expect(recoilSample(s, spec, s.at + wait - 1).index).toBeGreaterThan(0);
    expect(recoilSample(s, spec, s.at + wait)).toMatchObject({ index: 0, yaw: 0, pitch: 0 });
    expect(recoilSample(s, WEAPONS[spec.slot % 5]!, s.at).index).toBe(0);
    expect(Math.abs(recoilSample(s, spec, s.at).pitch)).toBeLessThan(.04);
  });
  it.each(WEAPONS.slice(0, 2))('$name: first four vertical, later drift, no still opening randomness', spec => {
    let s = emptyRecoil();
    const pitch: number[] = [];
    for (let i = 0; i < 4; i++) {
      const k = recoilSample(s, spec, 1000 + i * spec.fireIntervalMs);
      expect(k.yaw).toBe(0); pitch.push(k.pitch);
      s = advanceRecoil(s, spec, 1000 + i * spec.fireIntervalMs);
    }
    expect(pitch[3]).toBeGreaterThan(pitch[1]!);
    expect(recoilSample(s, spec, s.at + spec.fireIntervalMs).yaw).not.toBe(0);
    expect(accuracySpread(spec, false, true)).toBeLessThanOrEqual(.0002);
    expect(accuracySpread(spec, false, true, false, false, spec.recoil.hybridAfter))
      .toBeCloseTo(spec.spreadStill + spec.recoil.hybridSpread);
  });
  it.each(WEAPONS)('$name: ADS/crouch stack; movement dominates stance and air never gets crouch benefit', spec => {
    const moving = accuracySpread(spec, true, true);
    expect(accuracySpread(spec, true, true, true, true)).toBeCloseTo(moving * spec.recoil.adsMul * .75);
    expect(moving).toBeGreaterThan(accuracySpread(spec, false, true) * 10);
    expect(accuracySpread(spec, false, false, false, true)).toBe(accuracySpread(spec, false, false));
  });
  it('center-biased jitter preserves bounds and has half the uniform variance', () => {
    const values: number[] = [];
    for (let a = 0; a < 100; a++) for (let b = 0; b < 100; b++) {
      let n = 0; values.push(jitter(1, () => (++n === 1 ? a + .5 : b + .5) / 100));
    }
    expect(values.reduce((a, b) => a + b, 0) / values.length).toBeCloseTo(0);
    expect(values.reduce((a, b) => a + b * b, 0) / values.length).toBeCloseTo(1 / 6, 3);
    expect(Math.max(...values)).toBeLessThan(1);
  });
  it('rejection corrects a prediction while preserving in-flight shots; stale replies do not rewind', () => {
    const p = new RecoilPrediction(), spec = WEAPONS[0]!;
    p.fire(1, spec, 1000); p.fire(2, spec, 1100); p.fire(3, spec, 1200);
    const first = advanceRecoil(emptyRecoil(), spec, 1000);
    p.reconcile(2, first); // second rejected; third still in flight
    expect(p.state.count).toBe(2);
    p.reconcile(1, emptyRecoil()); expect(p.state.count).toBe(2);
    p.reconcile(3, advanceRecoil(first, spec, 1200)); expect(p.state.count).toBe(2);
    p.fire(4, spec, 1300);
    p.reset(4); p.reconcile(4, advanceRecoil(first, spec, 1300));
    expect(p.state.count).toBe(0); // old weapon/dead-life replies cannot resurrect recoil
  });
});

class RecoilArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  protected override onReady(): void { super.onReady(); this.queueInputs = false; }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
afterEach(() => vi.useRealTimers());
const events = (c: { frames(): Record<string, unknown>[] }, type: string) =>
  c.frames().filter(f => f.t === 's:msg' && f.type === type).map(f => f.payload as Record<string, number>);

describe('room recoil authority', () => {
  it('current raw mouse compensation rides the fire intent; non-finite angles cannot poison state', async () => {
    const h = await createTestRoom(RecoilArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('fire', { fireSeq: 1, yaw: 0, pitch: 0 });
    vi.setSystemTime(1_000_100);
    await c.send('fire', { fireSeq: 2, yaw: 0, pitch: -.003 });
    expect(events(c, 'shot').at(-1)).toMatchObject({ dx: 0, dy: 0, dz: 1 });
    vi.setSystemTime(1_000_200);
    await c.send('fire', { fireSeq: 3, yaw: 'NaN', pitch: null });
    expect(Number.isFinite(h.snapshot().players[c.id]!.yaw)).toBe(true);
    expect(events(c, 'shot').at(-1)?.dy).toBeCloseTo(Math.sin(.003));
  });
  it('accepted rays follow the pattern; forged indices/releases and rate-rejected fire cannot reset/advance it', async () => {
    const h = await createTestRoom(RecoilArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('look', { yaw: 0, pitch: 0 });
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(1_000_000 + i * 100);
      await c.send('fire', { fireSeq: i * 2 + 1, index: 0, recoil: 0, release: true, at: 0 });
      await c.send('fire', { fireSeq: i * 2 + 2 }); // same timestamp rejected
      expect(events(c, 'recoilSync').at(-1)?.count).toBe(i + 1);
    }
    const shots = events(c, 'shot'); expect(shots).toHaveLength(6);
    // Shot event's base ray is also the hybrid-claim reference direction.
    const expected = dirFromAngles(.004, .015);
    expect(shots[5]).toMatchObject({ dx: expected.x, dy: expected.y, dz: expected.z });
    vi.setSystemTime(1_001_000);
    await c.send('fire', { fireSeq: 13 });
    expect(events(c, 'recoilSync').at(-1)?.count).toBe(1);
    expect(events(c, 'shot').at(-1)).toMatchObject({ dx: 0, dy: 0, dz: 1 });
  });
  it('reload and swap rejected shots do not advance; swap starts a fresh burst', async () => {
    const h = await createTestRoom(RecoilArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('fire', { fireSeq: 1 }); await c.send('reload', {});
    vi.setSystemTime(1_000_100); await c.send('fire', { fireSeq: 2 });
    expect(events(c, 'recoilSync').at(-1)?.count).toBe(1);
    await c.send('switch', { slot: 2 }); await c.send('fire', { fireSeq: 3 });
    expect(events(c, 'recoilSync').at(-1)?.count).toBe(0);
    vi.setSystemTime(1_000_100 + WEAPON.swapMs);
    await c.send('fire', { fireSeq: 4 });
    expect(events(c, 'recoilSync').at(-1)).toMatchObject({ slot: 2, count: 1 });
  });
});
