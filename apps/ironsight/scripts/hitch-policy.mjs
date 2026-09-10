// Session74: explicit headless presentation budget, per the owner's 2026-09-10
// driver/compositor exception. See docs/HITCH-GATE.md for traces and limitations.
// A >150ms gap is still reported; it is never silently discarded or classified
// as a driver stall from CPU idleness alone.
export const HITCH_LIMITS = Object.freeze({
  presentationMs: 1500,
  mainThreadMs: 150,
  p99Ms: 25,
  stalledTimeFraction: 0.05,
});

export function framePercentile(histogram, fraction) {
  const count = histogram.reduce((sum, value) => sum + value, 0);
  if (!count) return Infinity;
  const target = Math.ceil(count * fraction);
  let total = 0;
  for (let ms = 0; ms < histogram.length; ms++) {
    total += histogram[ms];
    if (total >= target) return ms;
  }
  return Infinity;
}

export function assessHitch({ frames, frameHistogram, frameCount, maxFrameMs,
  maxCallbackMs, measurementMs, longTasks, recompiles, deaths, errors, untilEnded, phase }) {
  const p99Ms = framePercentile(frameHistogram, 0.99);
  const stalledMs = frames.filter(frame => frame.dt > 150).reduce((sum, frame) => sum + frame.dt, 0);
  const stalledTimeFraction = stalledMs / measurementMs;
  const failures = [];
  if (!Number.isFinite(maxFrameMs) || !Number.isFinite(maxCallbackMs) ||
      !Number.isFinite(measurementMs) || measurementMs <= 0 ||
      !Number.isInteger(frameCount) || frameCount <= 0 ||
      frameHistogram.some(n => !Number.isInteger(n) || n < 0) ||
      frameHistogram.reduce((sum, n) => sum + n, 0) !== frameCount) failures.push('invalid frame coverage');
  if (maxFrameMs > HITCH_LIMITS.presentationMs) failures.push('presentation gap');
  if (p99Ms > HITCH_LIMITS.p99Ms) failures.push('sustained frame pacing');
  if (stalledTimeFraction > HITCH_LIMITS.stalledTimeFraction) failures.push('repeated presentation stalls');
  if (maxCallbackMs > HITCH_LIMITS.mainThreadMs ||
      longTasks.some(task => task.dur > HITCH_LIMITS.mainThreadMs)) failures.push('main-thread stall');
  if (recompiles.length) failures.push('shader change after warm-up');
  if (deaths < 2) failures.push('fewer than two deaths');
  if (errors.length) failures.push('console error');
  if (untilEnded && phase !== 'ended') failures.push('round did not end');
  return { status: failures.length ? 'FAIL' : 'PASS', limits: HITCH_LIMITS, failures,
    p50UpperMs: framePercentile(frameHistogram, 0.5),
    p95UpperMs: framePercentile(frameHistogram, 0.95), p99UpperMs: p99Ms,
    maxFrameMs, maxCallbackMs, stalledMs, stalledTimeFraction,
    presentationOverLimit: frames.filter(frame => frame.dt > HITCH_LIMITS.presentationMs),
    // Keep the original trigger visible, including on green runs.
    framesOver150ms: frames.filter(frame => frame.dt > 150).length };
}
