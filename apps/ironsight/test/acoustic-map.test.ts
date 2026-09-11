import { expect, it } from 'vitest';
import { acousticOccluders, coverMix } from '../client/spatial-audio.js';
import { ARENA1 } from '../src/map/arena1.js';
import { CoreCollision } from '../src/core-gate.js';

it.each(['x', 'z'] as const)('muffles the solid side of a %s ramp but not the air above it', axis => {
  for (const dir of [1, -1] as const) for (const baseY of [0, -3]) {
    const map = { ...ARENA1, boxes: [], ramps: [
      { minX: 4, maxX: 8, minZ: 4, maxZ: 8, axis, dir, baseY, topY: baseY + 3 },
    ] };
    const crossing = dir === 1 ? 7 : 5;
    const ear = axis === 'x' ? { x: crossing, y: baseY + 1, z: 0 } : { x: 0, y: baseY + 1, z: crossing };
    const sound = axis === 'x' ? { ...ear, z: 12 } : { ...ear, x: 12 };
    const boxes = acousticOccluders(map);
    expect(coverMix(sound, ear, map.boxes).blocked).toBe(false);
    expect(coverMix(sound, ear, boxes)).toEqual({ blocked: true, gain: .32, cutoff: 1100 });
    expect(coverMix(ear, sound, boxes).blocked).toBe(true);
    expect(coverMix({ ...sound, y: baseY + 4 }, { ...ear, y: baseY + 4 }, boxes).blocked).toBe(false);
    expect(acousticOccluders(map)).toBe(boxes);
    expect(map.boxes).toEqual([]);
  }
});

it('uses distinct cached open/closed shutters and leaves an authored doorway audible', () => {
  const collision = new CoreCollision(ARENA1);
  const open = { ...ARENA1, boxes: collision.open };
  const ear = { x: 68, y: 1.5, z: 50 }, sound = { x: 75, y: 1.5, z: 50 };
  expect(coverMix(sound, ear, acousticOccluders(ARENA1)).blocked).toBe(true);
  expect(coverMix(sound, ear, acousticOccluders(open)).blocked).toBe(false);
  expect(coverMix(sound, ear, acousticOccluders(ARENA1)).blocked).toBe(true);
  expect(coverMix({ x: 41, y: 1.5, z: 42 }, { x: 41, y: 1.5, z: 46 }, acousticOccluders(ARENA1)).blocked).toBe(false);
  // A floor between listeners on different levels is real acoustic cover.
  expect(coverMix({ x: 41, y: 4, z: 42 }, { x: 41, y: 1.5, z: 42 }, acousticOccluders(ARENA1)).blocked).toBe(true);
});
