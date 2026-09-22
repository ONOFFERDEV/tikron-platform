import { expect, it } from 'vitest';
import { coreInspectionShots } from '../client/map-inspect-fixtures.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';

it.each([ARENA1, ARENA2])('aims event inspection through the current $presentation shutters', (map) => {
  const shots = coreInspectionShots(map);
  const z = shots.closed[2];
  expect(z).toBe((map.signalCore!.chamber.min.z + map.signalCore!.chamber.max.z) / 2);
  expect(map.signalCore!.doors.every(door => z >= door.min.z && z <= door.max.z)).toBe(true);
  expect(map.signalCore!.doors.every(door => 50 >= door.min.z && 50 <= door.max.z)).toBe(false);
  expect(shots.closed).toEqual(shots.open);
  expect(shots.inside[0]).toBeGreaterThan(map.signalCore!.chamber.min.x);
  expect(shots.inside[3]).toBeGreaterThan(map.signalCore!.chamber.max.x);
});
