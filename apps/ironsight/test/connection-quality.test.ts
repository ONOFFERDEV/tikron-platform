import { describe, expect, it } from 'vitest';
import { ConnectionQuality } from '../client/connection-quality.js';

describe('network delay presentation', () => {
  it('never presents absent or invalid RTT as low delay; disconnect overrides the estimate', () => {
    const q = new ConnectionQuality();
    for (const ms of [0, -1, NaN, Infinity]) expect(q.update(ms, true, 0)).toBe('measuring');
    expect(q.update(20, true, 1)).toBe('low');
    expect(q.update(20, false, 2)).toBe('offline');
    expect(q.update(200, true, 3)).toBe('high');
  });
  it('rejects transient spikes and requires sustained degradation', () => {
    const q = new ConnectionQuality();
    q.update(20, true, 0);
    expect(q.update(200, true, 100)).toBe('low');
    expect(q.update(20, true, 500)).toBe('low');
    expect(q.update(200, true, 1000)).toBe('low');
    expect(q.update(200, true, 2999)).toBe('low');
    expect(q.update(200, true, 3000)).toBe('high');
  });
  it('holds near boundaries and recovers after sustained lower delay', () => {
    const q = new ConnectionQuality();
    q.update(160, true, 0);
    expect(q.update(150, true, 3000)).toBe('high');
    expect(q.update(139, true, 4000)).toBe('high');
    expect(q.update(139, true, 6000)).toBe('delayed');
    expect(q.update(70, true, 9000)).toBe('delayed');
    expect(q.update(64, true, 10000)).toBe('delayed');
    expect(q.update(64, true, 12000)).toBe('low');
  });
});
