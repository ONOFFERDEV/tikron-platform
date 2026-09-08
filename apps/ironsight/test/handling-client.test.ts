import { describe, expect, it } from 'vitest';
import { Net } from '../client/net.js';

describe('client boundary-shot recovery', () => {
  it('corrects ammo, retries after the server delay instead of a sniper cycle, and does not fire by itself', () => {
    const handlers = new Map<string, ((p: unknown) => void)[]>();
    const sent: string[] = [];
    const room = { connectionId: 'self', send: (type: string) => sent.push(type),
      onMessage: (type: unknown, cb?: (p: unknown) => void) => {
        if (typeof type === 'string' && cb) handlers.set(type, [...handlers.get(type) ?? [], cb]);
      } };
    // Exercise the real private-constructor wiring using a socket-free Room stand-in.
    const net = new (Net as unknown as new (...args: unknown[]) => Net)(room, 'arena-practice', { open: true, lostAt: 0 });
    net.setFireInterval(3);
    let ammo: number | undefined;
    net.onFireBlocked((mag, slot) => { expect(slot).toBe(4); ammo = mag; });
    const start = performance.now();
    expect(net.tryFire(start + 2000)).toBe(true);
    const received = performance.now();
    for (const cb of handlers.get('fireBlocked') ?? []) cb({ retryMs: 33, mag: 5, weapon: 4 });
    expect(ammo).toBe(5); expect(sent).toHaveLength(1);
    expect(net.tryFire(received + 32)).toBe(false);
    expect(net.tryFire(received + 34)).toBe(true);
    expect(sent).toEqual(['fire', 'fire']);
    // A malformed correction must not shorten the normal 1300 ms cadence.
    for (const cb of handlers.get('fireBlocked') ?? []) cb({ retryMs: NaN, mag: -1, weapon: 4 });
    expect(ammo).toBe(5);
    expect(net.tryFire(received + 100)).toBe(false);
  });
});

