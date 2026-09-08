import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema } from '../src/schema.js';
import { WEAPONS, WEAPON, TICK_MS } from '../src/config.js';
import { WeaponHandling, easeAds, isSprinting } from '../src/handling.js';

class HandlingArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
  // Exact arrival-time boundary tests. Separate test below retains production queueing.
  protected override onReady(): void { super.onReady(); this.queueInputs = false; }
}
class QueuedArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
afterEach(() => vi.useRealTimers());
const shots = (c: { frames(): Record<string, unknown>[] }) => c.frames().filter(f => f.t === 's:msg' && f.type === 'shot');

describe('shared weapon handling', () => {
  it.each(WEAPONS)('$name: exact ADS boundary, repeated holds, interruption, hip fire', spec => {
    const h = new WeaponHandling();
    h.update(1000, spec, false, false); expect(h.canFire).toBe(true);
    h.update(1000, spec, false, true); expect(h.canFire).toBe(false);
    h.update(1000 + spec.adsMs / 2, spec, false, true);
    expect(easeAds(h.adsProgress)).toBeCloseTo(0.5);
    h.update(1000 + spec.adsMs - 1, spec, false, true); expect(h.canFire).toBe(false);
    h.update(1000 + spec.adsMs, spec, false, true); expect(h.canFire).toBe(true);
    h.update(2000, spec, false, true, true); expect(h.canFire).toBe(false);
    h.update(3000, spec, false, true); expect(h.adsProgress).toBe(0);
    h.update(3001, spec, false, false); expect(h.canFire).toBe(true);
    h.update(3002, spec, false, true); expect(h.adsProgress).toBe(0);
  });
  it.each(WEAPONS)('$name: sprint release cannot be shortened by batching or clock rewind', spec => {
    const h = new WeaponHandling();
    h.update(1000, spec, true, false); expect(h.canFire).toBe(false);
    h.update(1000, spec, false, false); expect(h.canFire).toBe(false);
    h.update(900, spec, false, false); expect(h.canFire).toBe(false);
    h.update(1000 + spec.sprintToFireMs - 1, spec, false, false); expect(h.canFire).toBe(false);
    h.update(1000 + spec.sprintToFireMs, spec, false, false); expect(h.canFire).toBe(true);
  });
  it('aim, crouch, air and backwards movement do not sprint; switching restarts acquisition', () => {
    for (const extra of [{ ads: true }, { crouch: true }, { mz: -1 }])
      expect(isSprinting({ sprint: true, mz: 1, crouch: false, ...extra }, true)).toBe(false);
    expect(isSprinting({ sprint: true, mz: 1, crouch: false }, false)).toBe(false);
    const h = new WeaponHandling();
    h.update(1000, WEAPONS[0]!, false, true);
    h.update(2000, WEAPONS[0]!, false, true); expect(h.canFire).toBe(true);
    h.update(2001, WEAPONS[3]!, false, true); expect(h.adsProgress).toBe(0);
  });
});

describe('real room handling authority', () => {
  it.each(WEAPONS)('$name: early aimed shots spend no ammo/protection and forged deadlines do not help', async spec => {
    const h = await createTestRoom(HandlingArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('switch', { slot: spec.slot });
    vi.setSystemTime(1_000_000 + WEAPON.swapMs);
    await c.send('move', { ads: true, adsMs: 0, adsAt: -1e12, ready: true });
    await c.send('fire', { ts: -1e12 });
    expect(shots(c)).toHaveLength(0);
    expect(c.frames().filter(f => f.t === 's:msg' && f.type === 'fireBlocked').at(-1)?.payload)
      .toMatchObject({ retryMs: spec.adsMs, mag: spec.mag, weapon: spec.slot });
    expect(h.snapshot().players[c.id]!.prot).toBe(true);
    vi.setSystemTime(1_000_000 + WEAPON.swapMs + spec.adsMs - 1);
    await c.send('move', { ads: true }); // held keepalive must not restart the timer
    await c.send('fire', {}); expect(shots(c)).toHaveLength(0);
    vi.setSystemTime(1_000_000 + WEAPON.swapMs + spec.adsMs);
    await c.send('fire', {}); expect(shots(c)).toHaveLength(1);
    const ammo = c.frames().filter(f => f.t === 's:msg' && f.type === 'ammo').at(-1)!;
    expect(ammo.payload).toMatchObject({ mag: spec.mag - 1 });
    expect(h.snapshot().players[c.id]!.prot).toBe(false);
  });
  it.each(WEAPONS)('$name: sprint and exact recovery gate apply to hip fire', async spec => {
    const h = await createTestRoom(HandlingArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('switch', { slot: spec.slot });
    vi.setSystemTime(1_001_000);
    await c.send('move', { mz: 1, sprint: true });
    await c.send('fire', {}); expect(shots(c)).toHaveLength(0);
    await c.send('move', { mz: 1 });
    vi.setSystemTime(1_001_000 + spec.sprintToFireMs - 1);
    await c.send('fire', {}); expect(shots(c)).toHaveLength(0);
    vi.setSystemTime(1_001_000 + spec.sprintToFireMs);
    await c.send('fire', {}); expect(shots(c)).toHaveLength(1);
  });
  it('reload completion starts fresh acquisition and malformed ADS cannot assert a ready state', async () => {
    const h = await createTestRoom(HandlingArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect(); const ar = WEAPONS[0]!;
    await c.send('move', { ads: 'true' }); // not boolean: stays hip fire
    await c.send('fire', {}); expect(shots(c)).toHaveLength(1);
    await c.send('move', { ads: true });
    await c.send('reload', {});
    vi.setSystemTime(1_000_000 + ar.reloadMs);
    await c.send('fire', {}); expect(shots(c)).toHaveLength(1);
    vi.setSystemTime(1_000_000 + ar.reloadMs + ar.adsMs);
    await c.send('fire', {}); expect(shots(c)).toHaveLength(2);
  });
  it('production queue preserves a sprint press/release/fire burst in the same tick', async () => {
    const h = await createTestRoom(QueuedArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    await c.send('move', { mz: 1, sprint: true });
    await c.send('move', { mz: 1, sprint: false });
    await c.send('fire', {});
    await h.advance(TICK_MS); expect(shots(c)).toHaveLength(0);
    await h.advance(WEAPONS[0]!.sprintToFireMs + TICK_MS);
    await c.send('fire', {});
    await h.advance(TICK_MS); expect(shots(c)).toHaveLength(1);
  });
});

