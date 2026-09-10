import { describe, expect, it, vi } from 'vitest';
import { createTestRoom } from '@tikron/server/testing';
import { ArenaRoomImpl } from '../src/rooms/arena-room.js';
import { ArenaSchema, type ArenaState } from '../src/schema.js';
import { compileStructure, withStructures, type StructureDef } from '../src/map/structures.js';
import { RELAY_COMMS } from '../src/map/relay-structures.js';
import { ARENA1 } from '../src/map/arena1.js';
import { canStand, moveAndSlide, nearestBox, type Vec3 } from '../src/physics.js';
import { GroundNavigator } from '../src/map/navigation.js';
import { CoreCollision } from '../src/core-gate.js';
import { MOVE, PLAYER } from '../src/config.js';
import { rampOccluderBoxes } from '../src/map/tilemap.js';

const hits = new CoreCollision(ARENA1);
// Contact at a mathematically tangent face can differ by ~1e-14 after stepping.
const stand = (p: Vec3) => canStand(p.x, p.y, p.z, PLAYER.radius - 1e-6, PLAYER.standHeight, ARENA1.boxes, ARENA1.bounds);
function walk(start: Vec3, targets: readonly Vec3[], stride = .10): Vec3[] {
  let pos = { ...start };
  const samples: Vec3[] = [pos];
  for (const target of targets) {
    let remaining = 600;
    while (Math.hypot(pos.x - target.x, pos.z - target.z) > .05 && remaining-- > 0) {
      const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz), step = Math.min(stride, d);
      const moved = moveAndSlide(pos, PLAYER.radius, PLAYER.standHeight,
        { x: dx / d * step, y: -.01, z: dz / d * step }, -.5, ARENA1.boxes, ARENA1.bounds, MOVE.stepUp, ARENA1.ramps);
      pos = moved.pos; samples.push(pos);
      expect(stand(pos), `standing clearance at ${JSON.stringify(pos)}`).toBe(true);
    }
    expect(Math.hypot(pos.x - target.x, pos.z - target.z), JSON.stringify(target)).toBeLessThan(.06);
    expect(pos.y).toBeCloseTo(target.y, 1);
  }
  return samples;
}

describe('structure authoring', () => {
  it('cuts overlapping apertures as a union and leaves no hidden door/window solid', () => {
    const def: StructureDef = { id: 'test', origin: { x: 2, y: 1, z: 3 }, width: 8, depth: 4,
      walls: [{ axis: 'x', at: 0, from: 0, to: 8, thickness: .4, bottom: 0, top: 3,
        openings: [{ from: 1, to: 3, bottom: 0, top: 2.2 }, { from: 2, to: 6, bottom: 1, top: 2.5 }] }],
      slabs: [{ minX: 0, maxX: 8, minZ: 0, maxZ: 4, bottom: 3, top: 3.3,
        openings: [{ minX: 2, maxX: 4, minZ: 1, maxZ: 3 }] }] };
    const structure = compileStructure(def), boxes = structure.parts.map(p => p.box);
    for (const x of [3.5, 4.5, 6.5, 7.5]) expect(nearestBox({ x, y: 2.5, z: 2 }, { x: 0, y: 0, z: 1 }, boxes, 2)).toBe(Infinity);
    expect(nearestBox({ x: 2.5, y: 2.5, z: 2 }, { x: 0, y: 0, z: 1 }, boxes, 2)).toBe(1);
    expect(nearestBox({ x: 5, y: 3, z: 5 }, { x: 0, y: 1, z: 0 }, boxes, 3)).toBe(Infinity);
    expect(nearestBox({ x: 8, y: 3, z: 5 }, { x: 0, y: 1, z: 0 }, boxes, 3)).toBe(1);
  });

  it('rejects malformed geometry, out-of-bounds apertures and unsupported elevated stair starts', () => {
    expect(() => compileStructure({ ...RELAY_COMMS, width: NaN })).toThrow('footprint');
    expect(() => compileStructure({ ...RELAY_COMMS, walls: [{ ...RELAY_COMMS.walls[0]!, thickness: -1 }] })).toThrow('wall');
    expect(() => compileStructure({ ...RELAY_COMMS, slabs: [{ ...RELAY_COMMS.slabs[0]!, openings: [{ minX: -1, maxX: 4, minZ: 1, maxZ: 2 }] }] })).toThrow('opening');
    expect(() => compileStructure({ ...RELAY_COMMS, origin: { x: 0, y: 3, z: 0 } })).toThrow('ground stair');
    expect(() => withStructures({ ...ARENA1, structures: [] }, [{ ...RELAY_COMMS, origin: { x: 149, y: 0, z: 0 } }])).toThrow('bounds');
    expect(() => withStructures(ARENA1, [RELAY_COMMS])).toThrow('duplicate');
  });
});

describe('Relay communications building', () => {
  it('uses the exact structural objects in both collision states and keeps ground door routes navigable', () => {
    for (const p of ARENA1.structures![0]!.parts) {
      expect(hits.closed).toContain(p.box); expect(hits.open).toContain(p.box);
    }
    for (const [start, target] of [[{ x: 32, y: 0, z: 38 }, { x: 58, y: 0, z: 38 }],
      [{ x: 58, y: 0, z: 38 }, { x: 32, y: 0, z: 38 }]] as const) {
      const samples = walk(start, [target]);
      expect(samples.every(p => p.y === 0)).toBe(true);
      const nav = new GroundNavigator(ARENA1);
      const destination = { x: target.x, z: target.z };
      for (const p of samples) expect(nav.next(p, destination)).toEqual(destination);
    }
  });

  it.each([.10, .32, .45])('walks upstairs/downstairs with %sm input steps and no slab penetration', stride => {
    const samples = walk({ x: 32, y: 0, z: 38 }, [
      { x: 42, y: 0, z: 38 }, { x: 42, y: 0, z: 35.5 },
      { x: 51, y: 3, z: 35.5 }, { x: 51, y: 3, z: 38.5 },
      { x: 51, y: 3, z: 35.5 }, { x: 42, y: 0, z: 35.5 },
      { x: 42, y: 0, z: 38 }, { x: 58, y: 0, z: 38 },
    ], stride);
    expect(Math.max(...samples.map(p => p.y))).toBeCloseTo(3);
    expect(samples.some(p => p.y > 1 && p.y < 2)).toBe(true);
  });

  it('blocks jumps at the ceiling and lands a descending player on the roof slab', () => {
    const start = { x: 36, y: 0, z: 38 };
    const jumped = moveAndSlide(start, PLAYER.radius, PLAYER.standHeight, { x: 0, y: 2, z: 0 }, 5,
      ARENA1.boxes, ARENA1.bounds, MOVE.stepUp, ARENA1.ramps);
    expect(jumped.pos.y + PLAYER.standHeight).toBeCloseTo(2.72);
    expect(jumped.vy).toBe(0);
    const landed = moveAndSlide({ ...start, y: 4 }, PLAYER.radius, PLAYER.standHeight,
      { x: 0, y: -2, z: 0 }, -5, ARENA1.boxes, ARENA1.bounds, MOVE.stepUp, ARENA1.ramps);
    expect(landed.pos.y).toBe(3); expect(landed.grounded).toBe(true);
  });

  it('admits eye rays through all four windows while sills, lintels, consoles and roof block fire', () => {
    for (const boxes of [hits.openHits, hits.closedHits]) {
      for (const [x, z, dir] of [[39, 33, 1], [52, 33, 1], [40, 41, -1], [47, 41, -1]] as const) {
        expect(nearestBox({ x, y: 1.65, z }, { x: 0, y: 0, z: dir }, boxes, 1.5)).toBe(Infinity);
        for (const y of [.65, 2.5]) expect(nearestBox({ x, y, z }, { x: 0, y: 0, z: dir }, boxes, 1.5)).toBeLessThan(1.5);
      }
      expect(nearestBox({ x: 39, y: .8, z: 37.5 }, { x: 0, y: 0, z: -1 }, boxes, 3)).toBeLessThan(3);
      expect(nearestBox({ x: 36, y: 1.65, z: 38 }, { x: 0, y: 1, z: 0 }, boxes, 5)).toBeCloseTo(1.07);
      expect(nearestBox({ x: 48.5, y: 2.3, z: 37.3 }, { x: 0, y: 0, z: -1 }, boxes, 2)).toBeLessThan(2);
    }
    const stair = ARENA1.structures![0]!.ramps[0]!;
    expect(rampOccluderBoxes(stair).map(b => b.max.y)).toEqual([1, 2, 3]);
  });
});

describe('structure shots in the authoritative room', () => {
  class BuildingRoom extends ArenaRoomImpl {
    protected override fillToPlayers = 0;
    protected override startInWarmup = false;
    protected override spawnProtectMs = 0;
  }
  it.each([false, true])('accepts open-window shots and rejects intact-wall shots, hybrid=%s', async claim => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    try {
      for (const [x, blocked] of [[50.5, false], [54.8, true]] as const) {
        const h = await createTestRoom(BuildingRoom, { id: 'arena-tdm', codec: ArenaSchema });
        const a = await h.connect(), b = await h.connect(); await h.advance(100);
        const s = (h.room as unknown as { state: ArenaState }).state;
        Object.assign(s.players[a.id]!, { x, y: 0, z: 38, team: 0, prot: false,
          yaw: Math.PI, pitch: Math.atan2(1.4 - PLAYER.standEye, 5.5) });
        Object.assign(s.players[b.id]!, { x, y: 0, z: 32.5, team: 1, prot: false });
        await h.advance(300);
        await a.send('fire', claim ? { claim: { id: b.id, part: 'body' } } : undefined); await h.advance(50);
        if (blocked) expect(s.players[b.id]!.hp).toBe(100);
        else expect(s.players[b.id]!.hp).toBeLessThan(100);
      }
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
  });
});
