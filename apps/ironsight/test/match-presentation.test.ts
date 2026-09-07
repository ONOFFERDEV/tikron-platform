import { describe, expect, it } from 'vitest';
import { matchBrief } from '../client/match-presentation.js';
import type { ArenaState } from '../src/schema.js';

const state: ArenaState = { players: {}, seed: 1, redScore: 0, blueScore: 0,
  phase: 'live', matchEndMs: 300000, mode: 0, capA: 100, capB: 100, capC: 100 };

describe('match briefing', () => {
  it('uses the server clock and clamps expired time without declaring a winner', () => {
    expect(matchBrief(state, 270001, 'self')).toMatchObject({ clock: '0:30', urgent: true });
    expect(matchBrief(state, 300001, 'self').clock).toBe('0:00');
  });
  it('does not expose Infinity or a fictitious countdown in training and warmup', () => {
    expect(matchBrief({ ...state, mode: 3, matchEndMs: Infinity }, 0, 'self').clock).toBe('NO TIME LIMIT');
    expect(matchBrief({ ...state, phase: 'warmup' }, 0, 'self').clock).toContain('WARMUP');
  });
  it('explains capture scoring separately from eliminations', () => {
    expect(matchBrief({ ...state, mode: 2 }, 0, 'self').objective).toContain('HOLD A / B / C');
    expect(matchBrief({ ...state, mode: 1 }, 0, 'self').affiliation).toBe('SOLO');
  });
});
