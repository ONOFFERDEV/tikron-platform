import { describe, it, expect } from 'vitest';
import { assessHitch } from '../scripts/hitch-policy.mjs';

function run(overrides = {}) {
  const frameHistogram = new Array(2002).fill(0);
  frameHistogram[7] = 9999;
  frameHistogram[1003] = 1;
  return assessHitch({ frames: [{ t: 20000, dt: 1002.6 }], frameHistogram,
    frameCount: 10000, maxFrameMs: 1002.6, maxCallbackMs: 4, measurementMs: 71000,
    longTasks: [], recompiles: [], deaths: 2, errors: [], untilEnded: false,
    phase: 'live', ...overrides });
}

describe('headless hitch acceptance policy', () => {
  it('keeps an isolated presentation stall visible on a passing run', () => {
    const result = run();
    expect(result.status).toBe('PASS');
    expect(result.framesOver150ms).toBe(1);
    expect(result.maxFrameMs).toBe(1002.6);
    expect(result.p99UpperMs).toBe(7);
  });

  it('fails above the absolute presentation ceiling', () => {
    expect(run({ maxFrameMs: 1500 }).status).toBe('PASS');
    expect(run({ maxFrameMs: 1500.1 }).failures).toContain('presentation gap');
  });

  it('fails sustained 30fps pacing even though no frame exceeds 150ms', () => {
    const frameHistogram = new Array(2002).fill(0);
    frameHistogram[34] = 10000;
    expect(run({ frames: [], maxFrameMs: 33.4, frameHistogram }).failures)
      .toContain('sustained frame pacing');
  });

  it('fails main-thread work independently of the presentation allowance', () => {
    expect(run({ maxCallbackMs: 150.1 }).failures).toContain('main-thread stall');
    expect(run({ longTasks: [{ t: 5000, dur: 151 }] }).failures).toContain('main-thread stall');
  });

  it('rejects frequent one-second freezes that frame-count p99 could miss', () => {
    const frameHistogram = new Array(2002).fill(0);
    frameHistogram[7] = 9980; frameHistogram[1000] = 20;
    const result = run({ frameHistogram, maxFrameMs: 1000, measurementMs: 90000,
      frames: Array.from({ length: 20 }, (_, i) => ({ t: i * 4500, dt: 1000 })) });
    expect(result.p99UpperMs).toBe(7);
    expect(result.failures).toContain('repeated presentation stalls');
  });

  it('still rejects the original light-count shader regression', () => {
    expect(run({ recompiles: [{ kind: 'program-new', t: 4000 }] }).failures)
      .toContain('shader change after warm-up');
  });

  it('requires deaths, a clean console and the requested final phase', () => {
    expect(run({ deaths: 1 }).failures).toContain('fewer than two deaths');
    expect(run({ errors: ['WebGL error'] }).failures).toContain('console error');
    expect(run({ untilEnded: true }).failures).toContain('round did not end');
    expect(run({ untilEnded: true, phase: 'ended' }).status).toBe('PASS');
  });

  it('fails missing, corrupted or incomplete frame coverage', () => {
    expect(run({ frameCount: 0, frameHistogram: [] }).status).toBe('FAIL');
    expect(run({ frameCount: 9999 }).failures).toContain('invalid frame coverage');
    expect(run({ maxCallbackMs: NaN }).failures).toContain('invalid frame coverage');
    expect(run({ maxFrameMs: Infinity }).failures).toContain('invalid frame coverage');
    expect(run({ measurementMs: 0 }).failures).toContain('invalid frame coverage');
    expect(run({ frameHistogram: [-1, 10001] }).failures).toContain('invalid frame coverage');
  });
});
