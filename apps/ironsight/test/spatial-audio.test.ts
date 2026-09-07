import { expect, it } from 'vitest';
import { spatialMix } from '../client/spatial-audio.js';
const origin = { x: 0, y: 0, z: 0 };
it('tracks screen-right as the listener turns through the four compass headings', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const right = { x: -Math.cos(yaw) * 10, y: 0, z: Math.sin(yaw) * 10 };
    expect(spatialMix(right, origin, yaw).pan).toBeCloseTo(1);
    expect(spatialMix({ x: -right.x, y: 0, z: -right.z }, origin, yaw).pan).toBeCloseTo(-1);
  }
});
it('centres coincident sounds, rolls off distant cues and silences beyond range', () => {
  expect(spatialMix(origin, origin, 0)).toMatchObject({ pan: 0, gain: 1 });
  const near = spatialMix({ x: 0, y: 0, z: 5 }, origin, 0);
  const far = spatialMix({ x: 0, y: 0, z: 40 }, origin, 0);
  expect(far.gain).toBeLessThan(near.gain); expect(far.cutoff).toBeLessThan(near.cutoff);
  expect(spatialMix({ x: 0, y: 0, z: 55 }, origin, 0).gain).toBe(0);
});
