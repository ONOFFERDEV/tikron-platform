import { describe, it, expect } from 'vitest';
import { firstUseWindows } from '../scripts/hitch-first-use.mjs';

describe('first combat presentation windows', () => {
  it('retains a stall crossing the event and the trailing window boundary', () => {
    const result = firstUseWindows([[900, 10], [1050, 250], [1900, 10], [2500, 600]],
      [{ kind: 'damage', t: 1000 }, { kind: 'death', t: 1050 }]);
    expect(result.map(window => window.status)).toEqual(['FAIL', 'FAIL']);
    expect(result[0].maxMs).toBe(600);
    expect(result[0].spikes).toHaveLength(2);
  });
  it('does not mistake a missing event or incomplete capture for a pass', () => {
    const result = firstUseWindows([[1000, 7], [1500, 7]], [{ kind: 'damage', t: 1000 }]);
    expect(result.map(window => window.status)).toEqual(['INCOMPLETE', 'MISSING']);
  });
  it('keeps later occurrences from hiding the first event', () => {
    const result = firstUseWindows([[900, 7], [1100, 160], [2100, 7], [4000, 7]],
      [{ kind: 'damage', t: 1000 }, { kind: 'damage', t: 3000 }, { kind: 'death', t: 3000 }]);
    expect(result[0].status).toBe('FAIL');
    expect(result[1].status).toBe('PASS');
  });
  it('includes a live-join hit before the gameplay profiler origin', () => {
    const result = firstUseWindows([[-600, 7], [-350, 250], [100, 7], [600, 7], [2500, 7]],
      [{ kind: 'damage', t: -400 }, { kind: 'damage', t: 2000 }, { kind: 'death', t: 1500 }]);
    expect(result[0].at).toBe(-400);
    expect(result[0].status).toBe('FAIL');
    expect(result[1].status).toBe('PASS');
  });
});
