import type { StructureDef } from './structures.js';

/** Places B: a pair of working rooms on the two sides of the relay core.
 * Both ground entrances face the yard, visible together from behind the
 * central console. Permanent windows answer the roof/yard firing positions.
 * Ground bots cross the rooms; humans can take the internal stair to +3m.
 */
export const RELAY_COMMS: StructureDef = {
  id: 'cooling-comms', origin: { x: 34, y: 0, z: 34 }, width: 22, depth: 10,
  walls: [
    { axis: 'z', at: 0, from: 0, to: 10, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 3, to: 5, bottom: 1.1, top: 2.35 }, { from: 6.5, to: 8.5, bottom: 1.1, top: 2.35 }] },
    { axis: 'z', at: 21.6, from: 0, to: 10, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 3, to: 5, bottom: 1.1, top: 2.35 }, { from: 6.5, to: 8.5, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 0, from: .4, to: 21.6, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 3, to: 7, bottom: 1.1, top: 2.35 }, { from: 16, to: 20, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 9.6, from: .4, to: 21.6, thickness: .4, bottom: 0, top: 2.72,
      openings: [{ from: 6, to: 8, bottom: 0, top: 2.35 }, { from: 14, to: 16, bottom: 0, top: 2.35 },
        { from: 9, to: 13, bottom: 1.1, top: 2.35 }] },
    { axis: 'x', at: 0, from: 0, to: 22, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 9.6, from: 0, to: 9, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'x', at: 9.6, from: 13, to: 22, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 0, from: .4, to: 9.6, thickness: .4, bottom: 3, top: 4.1 },
    { axis: 'z', at: 21.6, from: .4, to: 9.6, thickness: .4, bottom: 3, top: 4.1 },
  ],
  slabs: [
    { minX: 0, maxX: 22, minZ: 0, maxZ: 10, bottom: 2.72, top: 3,
      openings: [{ minX: 8.6, maxX: 15.4, minZ: .4, maxZ: 2.7 }] },
  ],
  stairs: [{ minX: 9, maxX: 15.4, minZ: .5, maxZ: 2.5, axis: 'x', dir: 1, topY: 3 }],
  cover: [
    // Solid consoles, shared by body collision and hit validation.
    { min: { x: 4.5, y: 0, z: 1.5 }, max: { x: 7, y: 1.1, z: 2.3 } },
    { min: { x: 10, y: 0, z: 4.8 }, max: { x: 12, y: 1.1, z: 5.6 } },
    { min: { x: 17.8, y: 0, z: 5.4 }, max: { x: 20.6, y: 1.1, z: 6.4 } },
  ],
};

// Mirror the actual geometry, including the stair void and consoles, so a roof
// advantage has an equal opposite answer. Round authoring arithmetic only;
// neither runtime collision nor movement is quantized here.
const reflect = (x: number) => Math.round((22 - x) * 1e6) / 1e6;
export const RELAY_CONTROL: StructureDef = {
  ...RELAY_COMMS, id: 'cooling-control', origin: { x: 94, y: 0, z: 34 },
  walls: RELAY_COMMS.walls.map(w => w.axis === 'z'
    ? { ...w, at: reflect(w.at + w.thickness) }
    : { ...w, from: reflect(w.to), to: reflect(w.from),
      openings: w.openings?.map(h => ({ ...h, from: reflect(h.to), to: reflect(h.from) })) }),
  slabs: RELAY_COMMS.slabs.map(s => ({ ...s, minX: reflect(s.maxX), maxX: reflect(s.minX),
    openings: s.openings?.map(h => ({ ...h, minX: reflect(h.maxX), maxX: reflect(h.minX) })) })),
  stairs: RELAY_COMMS.stairs!.map(r => ({ ...r, minX: reflect(r.maxX), maxX: reflect(r.minX), dir: -1 })),
  cover: RELAY_COMMS.cover!.map(b => ({ min: { ...b.min, x: reflect(b.max.x) }, max: { ...b.max, x: reflect(b.min.x) } })),
};

export const RELAY_BUILDINGS = [RELAY_COMMS, RELAY_CONTROL] as const;
