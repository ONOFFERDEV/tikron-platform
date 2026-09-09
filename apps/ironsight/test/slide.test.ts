import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { SprintSlide, SLIDE, type SlideInput } from '../src/slide.js';
import { MOVE, TICK_MS } from '../src/config.js';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';

const sprint: SlideInput = { mx: 0, mz: 1, sprint: true, crouch: false, jump: false };
const crouch = { ...sprint, crouch: true };
function charge(slide: SprintSlide, distance = MOVE.sprint * TICK_MS / 1000) {
  for (let i = 0; i < SLIDE.runUpMs / TICK_MS; i++) {
    slide.step(TICK_MS, sprint, true, 0); slide.observe(distance, true);
  }
}

describe('earned, bounded sprint slide', () => {
  it('requires actual sprint travel, never standing crouch, wall-running or a forged deadline', () => {
    for (const distance of [0, .1]) {
      const slide = new SprintSlide(); charge(slide, distance);
      expect(slide.step(TICK_MS, crouch, true, 0)).toBeNull();
    }
    const slide = new SprintSlide();
    expect(slide.step(TICK_MS, crouch, true, 0)).toBeNull();
    charge(slide);
    expect(slide.step(TICK_MS, crouch, true, 0)?.speed).toBeCloseTo(11.75);
  });
  it('travels exactly 6.4 m, locks direction despite aim changes, and cannot auto-repeat a held crouch', () => {
    const slide = new SprintSlide(); charge(slide);
    let distance = 0;
    for (let i = 0; i < 16; i++) {
      const move = slide.step(TICK_MS, crouch, true, i ? Math.PI / 2 : 0)!;
      expect(move.x).toBe(0); expect(move.z).toBe(1);
      distance += move.speed * TICK_MS / 1000;
      slide.observe(move.speed * TICK_MS / 1000, true);
    }
    expect(distance).toBeCloseTo(6.4); expect(slide.active).toBe(false);
    for (let i = 0; i < 60; i++) expect(slide.step(TICK_MS, crouch, true, 0)).toBeNull();
  });
  it.each([{ crouch: false }, { ads: true }, { jump: true }, { mz: 0 }])('cancels on %j and preserves cooldown', extra => {
    const slide = new SprintSlide(); charge(slide);
    slide.step(TICK_MS, crouch, true, 0); slide.observe(.58, true);
    expect(slide.step(TICK_MS, { ...crouch, ...extra }, true, 0)).toBeNull();
    charge(slide); expect(slide.step(TICK_MS, crouch, true, 0)).toBeNull();
    for (let i = 0; i < 30; i++) { slide.step(TICK_MS, sprint, true, 0); slide.observe(.45, true); }
    expect(slide.step(TICK_MS, crouch, true, 0)).not.toBeNull();
  });
  it('wall impact and leaving a ledge stop momentum; airborne crouch cannot launch', () => {
    for (const grounded of [false, true]) {
      const slide = new SprintSlide(); charge(slide);
      slide.step(TICK_MS, crouch, true, 0); slide.observe(grounded ? .01 : .58, grounded);
      expect(slide.active).toBe(false);
    }
    const slide = new SprintSlide(); charge(slide);
    expect(slide.step(TICK_MS, crouch, false, 0)).toBeNull();
  });
  it('normalizes diagonal travel instead of multiplying the slide budget', () => {
    const slide = new SprintSlide(); charge(slide);
    const move = slide.step(TICK_MS, { ...crouch, mx: 1 }, true, 0)!;
    expect(Math.hypot(move.x, move.z)).toBeCloseTo(1);
  });
});

class SlideArena extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}
afterEach(() => vi.useRealTimers());
describe('room slide authority', () => {
  it('integrates real intents, retains crouch and fire recovery, emits bounded near events, and ignores claimed speed', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const h = await createTestRoom(SlideArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    // Static unobstructed Relay rifle corridor. Only unit fixture placement, never live probe writes.
    const p = (h.room as unknown as { state: ArenaState }).state.players[c.id]!;
    Object.assign(p, { x: 55, y: 0, z: 27, yaw: Math.PI / 2 });
    await c.send('move', sprint);
    for (let i = 0; i < 6; i++) await h.advance(TICK_MS);
    const start = p.x;
    expect(start).toBeCloseTo(57.7);
    await c.send('move', { ...crouch, speed: 1000, slideEnd: 1e20, slide: true });
    await c.send('fire', {}); await h.advance(TICK_MS);
    expect(c.frames().filter(f => f.type === 'shot')).toHaveLength(0);
    expect(p.crouch).toBe(true); expect(p.x - start).toBeCloseTo(.5875);
    for (let i = 1; i < 16; i++) await h.advance(TICK_MS);
    expect(p.x - start).toBeCloseTo(6.4);
    const events = c.frames().filter(f => f.type === 'slide').map(f => f.payload);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ id: c.id, active: true });
    expect(events[1]).toMatchObject({ id: c.id, active: false });
    await c.send('fire', {}); await h.advance(TICK_MS);
    expect(c.frames().filter(f => f.type === 'shot')).toHaveLength(1);
    const end = p.x; await h.advance(TICK_MS);
    expect(p.x - end).toBeCloseTo(MOVE.crouch * TICK_MS / 1000);
  });
  it('rejects no-run-up forged slide fields and stops at real collision cover', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const h = await createTestRoom(SlideArena, { codec: ArenaSchema, sync: 'throttled' });
    const c = await h.connect();
    const p = (h.room as unknown as { state: ArenaState }).state.players[c.id]!;
    Object.assign(p, { x: 55, y: 0, z: 27, yaw: Math.PI / 2 });
    await c.send('move', { ...crouch, slide: true, speed: 1000, charged: true }); await h.advance(TICK_MS);
    expect(p.x - 55).toBeCloseTo(MOVE.crouch * TICK_MS / 1000);
    expect(c.frames().filter(f => f.type === 'slide')).toHaveLength(0);
    // Sprint into the world boundary: collision-derived run-up must expire.
    Object.assign(p, { x: 148, z: 27 });
    await c.send('move', sprint);
    for (let i = 0; i < 30; i++) await h.advance(TICK_MS);
    const stopped = p.x;
    await c.send('move', crouch); await h.advance(TICK_MS);
    expect(p.x).toBe(stopped); expect(p.x).toBeLessThan(150);
    expect(c.frames().filter(f => f.type === 'slide')).toHaveLength(0);
  });
});
