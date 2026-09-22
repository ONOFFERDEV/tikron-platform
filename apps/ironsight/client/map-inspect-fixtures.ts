import type { MapDef } from '../src/map/types.js';

export type MapInspectionShot = readonly [number, number, number, number, number, number];

export function coreInspectionShots(map: MapDef): Readonly<{
  closed: MapInspectionShot;
  open: MapInspectionShot;
  inside: MapInspectionShot;
}> {
  const chamber = map.signalCore?.chamber;
  if (chamber === undefined) throw new TypeError('signal core inspection requires a chamber');
  const midX = (chamber.min.x + chamber.max.x) / 2;
  const midZ = (chamber.min.z + chamber.max.z) / 2;
  const approach = [chamber.min.x - 7, 1.65, midZ, midX, 1.65, midZ] as const;
  return {
    closed: approach,
    open: approach,
    inside: [midX - 2, 1.65, midZ, chamber.max.x + 10, 1.65, midZ],
  };
}
