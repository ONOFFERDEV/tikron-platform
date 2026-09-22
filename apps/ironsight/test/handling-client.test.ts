import { describe, expect, it } from 'vitest';
import { Net } from '../client/net.js';
import { FireInputBuffer } from '../client/fire-input.js';

describe('client boundary-shot recovery', () => {
  it('corrects ammo, retries after the server delay instead of a sniper cycle, and does not fire by itself', () => {
    const handlers = new Map<string, ((p: unknown) => void)[]>();
    const sent: { type: string; payload: unknown }[] = [];
    const room = { connectionId: 'self', send: (type: string, payload: unknown) => sent.push({ type, payload }),
      onMessage: (type: unknown, cb?: (p: unknown) => void) => {
        if (typeof type === 'string' && cb) handlers.set(type, [...handlers.get(type) ?? [], cb]);
      } };
    // Exercise the real private-constructor wiring using a socket-free Room stand-in.
    const net = new (Net as unknown as new (...args: unknown[]) => Net)(room, 'arena-practice', { open: true, lostAt: 0 });
    net.setFireInterval(3);
    let ammo: number | undefined;
    net.onFireBlocked((mag, slot) => { expect(slot).toBe(4); ammo = mag; });
    const start = performance.now();
    const first = net.tryFire(start + 2000, undefined, { yaw: 1.25, pitch: -.2 });
    expect(first).toMatchObject({ kind: 'attempt', weaponIndex: 3, localMonoAt: start + 2000,
      rawAim: { yaw: 1.25, pitch: -.2 } });
    expect(first?.shotId).toBe('self:1:1');
    expect(sent[0]).toMatchObject({ type: 'fire', payload: { fireSeq: 1, shotId: 'self:1:1', yaw: 1.25, pitch: -.2 } });
    console.log(JSON.stringify({ attempt: first, wire: sent[0] }));
    const received = performance.now();
    for (const cb of handlers.get('fireBlocked') ?? []) cb({ retryMs: 33, mag: 5, weapon: 4 });
    expect(ammo).toBe(5); expect(sent).toHaveLength(1);
    expect(net.tryFire(received + 32)).toBeNull();
    expect(net.tryFire(received + 34)).toMatchObject({ kind: 'attempt', weaponIndex: 3 });
    expect(sent.map(message => message.type)).toEqual(['fire', 'fire']);
    // A malformed correction must not shorten the normal 1300 ms cadence.
    for (const cb of handlers.get('fireBlocked') ?? []) cb({ retryMs: NaN, mag: -1, weapon: 4 });
    expect(ammo).toBe(5);
    expect(net.tryFire(received + 100)).toBeNull();
  });

  it('keeps a released semi press through the local cadence deadline', () => {
    const room = { connectionId: 'self', send: () => undefined, onMessage: () => undefined };
    const net = new (Net as unknown as new (...args: unknown[]) => Net)(room, 'arena-practice', { open: true, lostAt: 0 });
    net.setFireInterval(4);
    const firstAt = performance.now() + 2000;
    expect(net.tryFire(firstAt)).not.toBeNull();
    const fire = new FireInputBuffer();
    const pressedAt = firstAt + 150;
    fire.press(pressedAt);
    fire.release();
    expect(fire.take(firstAt + 199, 'semi', net.canTryFire(firstAt + 199))).toBeNull();
    expect(fire.take(firstAt + 200, 'semi', net.canTryFire(firstAt + 200))).toEqual({ kind: 'press', pressedAt });
    expect(net.tryFire(firstAt + 200)).not.toBeNull();
  });

  it('observes the exact prepared attempt immediately before send and skips both while cadence-blocked', () => {
    const order: string[] = [];
    const room = { connectionId: 'self', send: () => order.push('send'), onMessage: () => undefined };
    const net = new (Net as unknown as new (...args: unknown[]) => Net)(room, 'arena-practice', { open: true, lostAt: 0 });
    net.setFireInterval(3);
    let observed: ReturnType<Net['tryFire']> = null;
    let sendAt = Number.NaN;
    const fireAt = performance.now() + 2000;

    const attempt = net.tryFire(fireAt, undefined, undefined, (prepared, at) => {
      order.push('onSend');
      observed = prepared;
      sendAt = at;
    });
    const blocked = net.tryFire(fireAt + 1, undefined, undefined, () => order.push('blocked-onSend'));

    expect(observed).toBe(attempt);
    expect(Number.isFinite(sendAt)).toBe(true);
    expect(order).toEqual(['onSend', 'send']);
    expect(blocked).toBeNull();
  });

  it('uses only a valid server life scope for local attempt ids', () => {
    const handlers = new Map<string, (payload: unknown) => void>();
    const room = { connectionId: 'self', send: () => undefined,
      onMessage: (type: unknown, cb?: (payload: unknown) => void) => {
        if (typeof type === 'string' && cb) handlers.set(type, cb);
      } };
    const net = new (Net as unknown as new (...args: unknown[]) => Net)(room, 'arena-practice', { open: true, lostAt: 0 });
    handlers.get('shotScope')?.({ life: Number.NaN });
    handlers.get('shotScope')?.({ life: 3 });
    expect(net.tryFire(performance.now() + 2000)?.shotId).toBe('self:3:1');
  });
});

