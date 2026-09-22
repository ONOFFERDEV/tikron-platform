import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MOVE, PLAYER } from '../src/config.js';
import { ARENA3 } from '../src/map/arena3.js';
import type { RampDef } from '../src/map/types.js';
import { canStand, moveAndSlide, type Vec3 } from '../src/physics.js';
import { spawnExposed } from '../src/map/spawn.js';
import { loadSwitchyardTransformers } from '../client/switchyard-props.js';

function rampRun(ramp: RampDef): number {
  return ramp.axis === 'x' ? ramp.maxX - ramp.minX : ramp.maxZ - ramp.minZ;
}

describe('WW1 Switchyard geometry', () => {
  it('has no required induction launch route', () => {
    // Given: the authored Switchyard movement contract.
    // When: assisted launch routes are inspected.
    // Then: ordinary walking owns every required route.
    expect(ARENA3.launchPads ?? []).toHaveLength(0);
  });

  it('uses four ten-metre walking ramps for the loading deck', () => {
    // Given: ramps that rise from yard level to the central three-metre deck.
    const deckRamps = (ARENA3.ramps ?? []).filter((ramp) => (ramp.baseY ?? 0) === 0 && ramp.topY === 3
      && (ramp.axis === 'x' ? ramp.minZ === 48 : ramp.minX === 74));
    // When: their physical rise and run are measured.
    const dimensions = deckRamps.map((ramp) => ({ run: rampRun(ramp), rise: ramp.topY - (ramp.baseY ?? 0) }));
    // Then: each side provides a walkable approach near the approved 10 m run / 3 m rise.
    expect(dimensions).toHaveLength(4);
    expect(dimensions.every(({ run, rise }) => run >= 9.5 && run <= 10.5 && rise === 3)).toBe(true);
  });

  it.each([
    ['west', { x: 55, y: 0, z: 49 }, { x: 1, z: 0 }],
    ['east', { x: 95, y: 0, z: 49 }, { x: -1, z: 0 }],
    ['north', { x: 75, y: 0, z: 31 }, { x: 0, z: 1 }],
    ['south', { x: 75, y: 0, z: 69 }, { x: 0, z: -1 }],
  ] as const)('walks from the %s yard onto the deck without jumping', (_side, start, direction) => {
    // Given: a grounded player facing one deck approach.
    let pos: Vec3 = { ...start };
    let velocityY = 0;
    let peak = 0;
    // When: ordinary fixed-step walk input crosses the ramp.
    for (let step = 0; step < 55; step += 1) {
      velocityY -= MOVE.gravity * 0.05;
      const result = moveAndSlide(pos, PLAYER.radius, PLAYER.standHeight, {
        x: direction.x * MOVE.walk * 0.05,
        y: velocityY * 0.05,
        z: direction.z * MOVE.walk * 0.05,
      }, velocityY, ARENA3.boxes, ARENA3.bounds, MOVE.stepUp, ARENA3.ramps);
      pos = result.pos;
      velocityY = result.vy;
      peak = Math.max(peak, pos.y);
      expect(result.grounded).toBe(true);
    }
    // Then: the capsule reaches and remains supported on the three-metre deck.
    expect(peak).toBeCloseTo(3, 5);
    expect(canStand(pos.x, pos.y, pos.z, PLAYER.radius, PLAYER.standHeight, ARENA3.boxes, ARENA3.bounds)).toBe(true);
  });

  it('keeps the freight stack fixed while preserving a permanent bypass', () => {
    // Given: the former Cargo Shift footprint and its north/south aisles.
    const cover = ARENA3.boxes.find((box) => box.min.x === 124 && box.max.x === 128 && box.min.z === 46 && box.max.z === 52);
    // When: dynamic door membership and adjacent capsule clearance are inspected.
    const dynamic = ARENA3.signalCore?.doors.includes(cover ?? ARENA3.boxes[0]!);
    // Then: the cargo is permanent cover and both side aisles remain open.
    expect(cover).toBeDefined();
    expect(dynamic).not.toBe(true);
    for (const z of [44.5, 53.5]) for (let x = 121; x <= 131; x += 0.5)
      expect(canStand(x, 0, z, PLAYER.radius, PLAYER.standHeight, ARENA3.boxes, ARENA3.bounds)).toBe(true);
  });

  it('gives all twelve spawns two collision-clear escape paths', () => {
    // Given: each authored FFA spawn and two opposite lateral exits.
    const routes: { readonly spawn: Vec3; readonly end: Vec3 }[] = [];
    for (const spawn of [...ARENA3.spawns.red, ...ARENA3.spawns.blue]) for (const direction of [-1, 1]) {
      let pos: Vec3 = { ...spawn };
      // When: the standing capsule walks two metres toward that exit.
      for (let step = 0; step < 20; step += 1) pos = moveAndSlide(pos, PLAYER.radius, PLAYER.standHeight,
        { x: 0, y: -0.1, z: direction * 0.1 }, -1, ARENA3.boxes, ARENA3.bounds, MOVE.stepUp, ARENA3.ramps).pos;
      routes.push({ spawn, end: pos });
      // Then: the route travels its full distance without collision.
      expect(Math.abs(pos.z - spawn.z)).toBeCloseTo(2, 5);
    }
    expect(routes).toHaveLength(24);
  });

  it('rejects FFA spawn crossfire', () => {
    // Given: every spawn treated as hostile to every other spawn.
    const spawns = [...ARENA3.spawns.red, ...ARENA3.spawns.blue];
    // When: direct standing-body exposure is evaluated against shared collision.
    const exposed = spawns.flatMap((spawn) => spawns.filter((other) => other !== spawn).map((other) =>
      spawnExposed(spawn, { ...other, id: 'hostile', team: 0, alive: true }, ARENA3.boxes)));
    // Then: all hostile spawn pairs are screened, while an empty-collision fixture proves the rejection can fail.
    expect(exposed.some(Boolean)).toBe(false);
    expect(spawnExposed(spawns[0]!, { ...spawns[1]!, id: 'hostile', team: 0, alive: true }, [])).toBe(true);
  });

  it('places three unlit semaphore signals outside the playable yard', async () => {
    const scene = new THREE.Scene();
    await loadSwitchyardTransformers(scene, ARENA3.bounds.width);
    const signals = scene.children.filter((child) => child.name === 'switchyard-rail-signal');
    expect(signals).toHaveLength(3);
    for (const signal of signals) expect(new THREE.Box3().setFromObject(signal).max.z).toBeLessThan(0);
    expect(signals.flatMap((signal) => signal.children).some((child) => child instanceof THREE.Light)).toBe(false);
  });
});
