/** Includes the frame crossing the event and the following second of presentation.
 * The preceding 250ms catches the render callback that exposed the effect before
 * the probe observed the state edge. This does not replace the whole-round gate. */
export function firstUseWindows(samples, events) {
  return ['damage', 'death'].map(kind => {
    const event = events.find(event => event.kind === kind);
    if (!event) return { kind, status: 'MISSING', limitMs: 150 };
    const start = event.t - 250, end = event.t + 1000;
    const frames = samples.filter(([t, dt]) => t >= start && t - dt <= end);
    const maxMs = Math.max(0, ...frames.map(([, dt]) => dt));
    const covered = samples.some(([t]) => t >= end);
    return { kind, at: event.t, from: start, to: end, frames: frames.length, maxMs,
      limitMs: 150, status: !covered ? 'INCOMPLETE' : maxMs > 150 ? 'FAIL' : 'PASS',
      spikes: frames.filter(([, dt]) => dt > 150).map(([t, dt]) => ({ t, dt })) };
  });
}
