import { describe, expect, it } from 'vitest';
import { WW1_ENVIRONMENT_MANIFEST } from '../config/ww1-environment.js';
import {
  MAP_ENVIRONMENT_PLACEMENTS,
  blockingEnvironmentBoxes,
  placementIssues,
} from '../src/map/environment-props.js';
import { createEnvironmentFallback, placeEnvironmentPropModel } from '../client/map-environment-props.js';
import { assertVisualScene } from '../client/site-architecture.js';
import * as T from 'three';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';

const bounds = { width: 150, depth: 100 } as const;

describe('map environment prop placement contract', () => {
  it('rejects the legacy crate envelope as backing for the admitted ammo crate', () => {
    const ammo = WW1_ENVIRONMENT_MANIFEST.assets.find(asset => asset.key === 'ammo-crate')!;
    const legacy = { kind: 'box' as const, dimensionsM: [.531171, 1.15, .598316] as const };
    expect(placementIssues({
      id: 'bad-direct-swap', map: 'relay', key: 'ammo-crate', position: [25, 0, 35], yaw: 0,
      dimensionsM: ammo.dimensionsM, maxCladdingOffsetM: ammo.maxCladdingOffsetM,
      policy: 'authoritative-box', collision: legacy,
    }, bounds)).toContain('visual_outside_collision');
  });

  it('provides the complete required inventory with exact backing or exterior decoration policy', () => {
    expect([...new Set(MAP_ENVIRONMENT_PLACEMENTS.map(placement => placement.key))].sort()).toEqual([
      'ammo-crate', 'brick-rubble', 'field-telephone', 'freight-wagon-wreck', 'observation-post', 'supply-wagon',
    ]);
    for (const placement of MAP_ENVIRONMENT_PLACEMENTS) {
      expect(placementIssues(placement, bounds)).toEqual([]);
      if (placement.policy === 'nonblocking-exterior') expect(placement.support.length).toBeGreaterThan(0);
    }
    expect(MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.policy === 'authoritative-box')).toHaveLength(6);
    expect(MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.policy === 'nonblocking-exterior')).toHaveLength(4);
  });

  it.each(['relay', 'undertow', 'switchyard'] as const)('publishes exact %s authority boxes without reusing legacy envelopes', map => {
    const placements = MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.map === map && placement.policy === 'authoritative-box');
    const boxes = blockingEnvironmentBoxes(map);
    expect(boxes).toHaveLength(placements.length);
    for (const [index, placement] of placements.entries()) {
      if (placement.policy !== 'authoritative-box') throw new TypeError('Expected an authoritative placement');
      const box = boxes[index]!;
      const actual = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
      placement.collision.dimensionsM.forEach((dimension, axis) => expect(actual[axis]).toBeCloseTo(dimension, 9));
    }
  });

  it('places only admitted bottom-centred dimensions and builds an equal fallback envelope', () => {
    const placement = MAP_ENVIRONMENT_PLACEMENTS.find(candidate => candidate.id === 'relay-ammo-west')!;
    const model = new T.Mesh(new T.BoxGeometry(...placement.dimensionsM).translate(0, placement.dimensionsM[1] / 2, 0));
    const group = placeEnvironmentPropModel(model, placement);
    expect(group.position.toArray()).toEqual(placement.position);
    expect(group.name).toBe(`map-environment:${placement.id}`);
    const fallback = createEnvironmentFallback(placement);
    const size = new T.Box3().setFromObject(fallback).getSize(new T.Vector3());
    placement.dimensionsM.forEach((dimension, axis) => expect(size.getComponent(axis)).toBeCloseTo(dimension, 6));
    const offset = new T.Mesh(new T.BoxGeometry(...placement.dimensionsM).translate(.01, placement.dimensionsM[1] / 2, 0));
    expect(() => placeEnvironmentPropModel(offset, placement)).toThrow('bounds/origin');
  });

  it.each([[ARENA1, 'relay'], [ARENA2, 'undertow'], [ARENA3, 'switchyard']] as const)(
    'keeps $1 fallback opacity collision-backed or wholly outside play', (map, presentation) => {
      const scene = new T.Scene();
      scene.add(...MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.map === presentation)
        .map(createEnvironmentFallback));
      const receipt = assertVisualScene(map, scene);
      expect(receipt.opaqueInstances).toBe(scene.children.length);
      expect(receipt.backedInstances + receipt.exteriorInstances).toBe(receipt.opaqueInstances);
    },
  );

  it.each([[ARENA1, 'relay'], [ARENA2, 'undertow'], [ARENA3, 'switchyard']] as const)(
    'keeps $1 backed props out of existing solids and spawn envelopes', (map, presentation) => {
      const additions = new Set(blockingEnvironmentBoxes(presentation));
      const existing = map.boxes.filter(box => !additions.has(box));
      for (const box of additions) {
        expect(existing.some(other => box.min.x < other.max.x && box.max.x > other.min.x
          && box.min.y < other.max.y && box.max.y > other.min.y
          && box.min.z < other.max.z && box.max.z > other.min.z)).toBe(false);
        const center = { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 };
        for (const spawn of [...map.spawns.red, ...map.spawns.blue])
          expect(Math.hypot(spawn.x - center.x, spawn.z - center.z)).toBeGreaterThan(3);
      }
    },
  );
});
