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

import { coverMix, hostileFoley, footSurface, footGrounded } from '../client/spatial-audio.js';
import { ARENA1 } from '../src/map/arena1.js';
const wall = { min: { x: -2, y: 0, z: 4 }, max: { x: 2, y: 3, z: 5 } };
it('prioritizes opposing teams and every other player in FFA without changing allies', () => {
  expect(hostileFoley(0, 0, false)).toBe(1);
  expect(hostileFoley(1, 0, false)).toBe(1.4);
  expect(hostileFoley(0, 0, true)).toBe(1.4);
});
it('muffles a segment through solid cover but never a wall beyond the sound', () => {
  const listener = { x: 0, y: 1, z: 0 };
  expect(coverMix({ x: 0, y: 1, z: 10 }, listener, [wall])).toEqual({ blocked: true, gain: .32, cutoff: 1100 });
  expect(coverMix({ x: 0, y: 1, z: 3 }, listener, [wall]).blocked).toBe(false);
  expect(coverMix({ x: 0, y: 1, z: -10 }, listener, [wall]).blocked).toBe(false);
});
it('allows sound over low cover and through open routes; coincident sources are clear', () => {
  expect(coverMix({ x: 0, y: 4, z: 10 }, { x: 0, y: 4, z: 0 }, [wall]).blocked).toBe(false);
  expect(coverMix({ x: 4, y: 1, z: 10 }, { x: 4, y: 1, z: 0 }, [wall]).blocked).toBe(false);
  expect(coverMix(origin, origin, [wall]).blocked).toBe(false);
});
it('does not compound attenuation for overlapping structural boxes', () => {
  expect(coverMix({ x: 0, y: 1, z: 10 }, { x: 0, y: 1, z: 0 }, [wall, wall]).gain).toBe(.32);
});
it('uses actual deck tops and ramp slopes, not height alone, for metal steps', () => {
  const map = { ...ARENA1, boxes: [wall], ramps: [{ minX: 4, maxX: 8, minZ: 0, maxZ: 2, axis: 'x' as const, dir: 1 as const, topY: 2 }] };
  expect(footSurface({ x: 0, y: 3, z: 4.5 }, map)).toBe('metal');
  expect(footSurface({ x: 6, y: 1, z: 1 }, map)).toBe('metal');
  expect(footGrounded({ x: 6, y: 1, z: 1 }, map)).toBe(true);
  expect(footGrounded({ x: 6, y: 3, z: 1 }, map)).toBe(false);
  expect(footSurface({ x: 10, y: 0, z: 10 }, map)).toBe('concrete');
  expect(footGrounded({ x: 10, y: 0, z: 10 }, map)).toBe(true);
});
