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
import { PLAYER } from '../src/config.js';
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
  const map = { ...ARENA1, bounds: { ...ARENA1.bounds, floor: 0 }, terrain: undefined,
    boxes: [wall], ramps: [{ minX: 4, maxX: 8, minZ: 0, maxZ: 2, axis: 'x' as const, dir: 1 as const, topY: 2 }] };
  expect(footSurface({ x: 0, y: 3, z: 4.5 }, map)).toBe('metal');
  expect(footSurface({ x: 6, y: 1, z: 1 }, map)).toBe('metal');
  expect(footGrounded({ x: 6, y: 1, z: 1 }, map)).toBe(true);
  expect(footGrounded({ x: 6, y: 3, z: 1 }, map)).toBe(false);
  expect(footSurface({ x: 10, y: 0, z: 10 }, map)).toBe('concrete');
  expect(footGrounded({ x: 10, y: 0, z: 10 }, map)).toBe(true);
});

it('keeps excavated yard, trench and authored concrete floors out of the metal set', () => {
  const terrain = ARENA1.terrain!;
  for (const face of terrain.faces) {
    const p = { x: (face.minX + face.maxX) / 2, y: face.y, z: (face.minZ + face.maxZ) / 2 };
    expect(footSurface(p, ARENA1)).toBe('concrete');
    expect(footGrounded(p, ARENA1)).toBe(true);
  }
  for (const structure of ARENA1.structures!) {
    for (const part of structure.parts.filter(p => p.kind === 'slab')) {
      const b = part.box;
      expect(footSurface({ x: (b.min.x + b.max.x) / 2, y: b.max.y, z: (b.min.z + b.max.z) / 2 }, ARENA1)).toBe('concrete');
    }
    for (const r of structure.ramps) {
      expect(footSurface({ x: (r.minX + r.maxX) / 2, y: ((r.baseY ?? 0) + r.topY) / 2,
        z: (r.minZ + r.maxZ) / 2 }, ARENA1)).toBe('concrete');
    }
  }
});

it('does not play a grounded step while falling through the old yard height over the trench', () => {
  const cut = ARENA1.terrain!.cut;
  // The centre (x=75) is a real bridge; use the open shaft west of it.
  const p = { x: cut.minX + 25, y: 0, z: (cut.minZ + cut.maxZ) / 2 };
  expect(footGrounded(p, ARENA1)).toBe(false);
  expect(footGrounded({ ...p, y: ARENA1.bounds.floor! }, ARENA1)).toBe(true);
  expect(footGrounded({ ...p, x: 75 }, ARENA1)).toBe(true);
});

it('keeps steps at a supporting capsule edge and stops them when fully off the ledge', () => {
  const map = { ...ARENA1, boxes: [wall], ramps: [] };
  expect(footGrounded({ x: wall.max.x + PLAYER.radius - .01, y: wall.max.y, z: 4.5 }, map)).toBe(true);
  expect(footGrounded({ x: wall.max.x + PLAYER.radius + .01, y: wall.max.y, z: 4.5 }, map)).toBe(false);
});

it('muffles a wall touching either sound endpoint but leaves an outward or tangent ray clear', () => {
  const contact = { x: 0, y: 1, z: 4 };
  const far = { x: 0, y: 1, z: 10 };
  expect(coverMix(far, contact, [wall]).blocked).toBe(true);
  expect(coverMix(contact, far, [wall]).blocked).toBe(true);
  expect(coverMix({ x: 0, y: 1, z: 0 }, contact, [wall]).blocked).toBe(false);
  expect(coverMix({ x: 2, y: 1, z: 10 }, { x: 2, y: 1, z: 0 }, [wall]).blocked).toBe(false);
});

it('retains thin cover close to the listener even on a long audible segment', () => {
  const thin = { min: { x: -1, y: 0, z: .01 }, max: { x: 1, y: 3, z: .03 } };
  const ear = { x: 0, y: 1, z: 0 }, sound = { x: 0, y: 1, z: 50 };
  expect(coverMix(sound, ear, [thin]).blocked).toBe(true);
  expect(coverMix(ear, sound, [thin]).blocked).toBe(true);
});
