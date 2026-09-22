import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import {
  VisualSolidError,
  applyArchitectureLoadResult,
  assertVisualScene,
  assertVisualSolids,
  mapVisualResourceTable,
  visualSolidPlan,
} from '../client/site-architecture.js';
import { siteGroundFaces } from '../client/site-ground.js';
import { finishRelaySurface, RELAY_PHYSICAL_SURFACES } from '../client/relay-surfaces.js';
import { finishUndertowSurface, UNDERTOW_PHYSICAL_SURFACES } from '../client/undertow-surfaces.js';
import { finishSwitchyardSurface, SWITCHYARD_PHYSICAL_SURFACES } from '../client/switchyard-surfaces.js';
import { switchyardSiteBoundary, switchyardSiteSigns, switchyardSiteSupplies } from '../client/switchyard-site.js';

const MAPS = [ARENA1, ARENA2, ARENA3] as const;

describe('WW1 visual solids', () => {
  it('binds every opaque shell to a real map support within two centimetres', () => {
    for (const map of MAPS) {
      const plan = visualSolidPlan(map);
      expect(() => assertVisualSolids(map, plan)).not.toThrow();
      expect(plan.filter((solid) => solid.kind === 'box')).toHaveLength(map.boxes.length);
      expect(plan.filter((solid) => solid.kind === 'ramp')).toHaveLength(map.ramps?.length ?? 0);
    }
  });

  it('rejects unbacked opaque face', () => {
    const foreign = { min: { x: 70, y: 0, z: 52 }, max: { x: 80, y: 3, z: 54 } };
    expect(() => assertVisualSolids(ARENA1, [{
      id: 'fake-door-fill', kind: 'box', support: foreign, surface: 'wood', claddingOffsetM: 0.01,
    }])).toThrowError(new VisualSolidError('unbacked_opaque_face', 'fake-door-fill'));
  });

  it('rejects cladding beyond two centimetres', () => {
    const solid = visualSolidPlan(ARENA1)[0];
    expect(solid).toBeDefined();
    if (solid === undefined) return;
    expect(() => assertVisualSolids(ARENA1, [{ ...solid, claddingOffsetM: 0.0201 }]))
      .toThrowError(new VisualSolidError('cladding_offset', solid.id));
  });

  it('preserves solid shell on asset failure', () => {
    const scene = new T.Scene();
    const fallback = new T.Mesh(new T.BoxGeometry(4, 2.4, 0.45), new T.MeshStandardMaterial());
    scene.add(fallback);
    const before = new T.Box3().setFromObject(fallback).clone();
    expect(applyArchitectureLoadResult(scene, [fallback], { status: 'rejected', reason: new Error('offline') })).toBe('fallback');
    expect(fallback.parent).toBe(scene);
    expect(new T.Box3().setFromObject(fallback)).toEqual(before);
  });

  it('preserves solid shell when an asset fulfills without opaque geometry', () => {
    const scene = new T.Scene();
    const fallback = new T.Mesh(new T.BoxGeometry(2, 3, 4), new T.MeshStandardMaterial());
    scene.add(fallback);
    expect(applyArchitectureLoadResult(scene, [fallback], { status: 'fulfilled', value: new T.Group() })).toBe('fallback');
    expect(fallback.parent).toBe(scene);
    expect(scene.children).toEqual([fallback]);
  });

  it('rejects an actual unbacked opaque scene mesh', () => {
    const scene = new T.Scene();
    const foreign = new T.Mesh(new T.BoxGeometry(3, 3, 3), new T.MeshStandardMaterial());
    foreign.position.set(65, 1.5, 47);
    foreign.name = 'fake-courtyard-fill';
    scene.add(foreign);
    expect(() => assertVisualScene(ARENA1, scene)).toThrowError(
      new VisualSolidError('unbacked_opaque_face', 'fake-courtyard-fill'),
    );
  });

  it('does not place a fake floor over an excavation cut', () => {
    for (const map of MAPS.filter((candidate) => candidate.terrain !== undefined)) {
      const cut = map.terrain?.cut;
      expect(cut).toBeDefined();
      const inside = siteGroundFaces(map).filter((face) => cut !== undefined
        && face.minX < cut.maxX && face.maxX > cut.minX && face.minZ < cut.maxZ && face.maxZ > cut.minZ);
      expect(inside).toHaveLength(1);
      expect(inside[0]?.y).toBe(map.bounds.floor);
    }
  });

  it('publishes map-owned physical resource tables', () => {
    for (const map of MAPS) {
      const table = mapVisualResourceTable(map);
      expect(table.presentation).toBe(map.presentation);
      expect(table.supports).toBe(map.boxes.length + (map.ramps?.length ?? 0) + (map.terrain?.faces.length ?? 0));
      expect(table.surfaces).toContain('wood');
      expect(table.surfaces).toContain('mud');
    }
    for (const profile of [RELAY_PHYSICAL_SURFACES, UNDERTOW_PHYSICAL_SURFACES, SWITCHYARD_PHYSICAL_SURFACES]) {
      expect(profile.mud.roughness).toBeGreaterThan(0.8);
      expect(profile.wood.metalness).toBe(0);
      expect(profile.concrete.roughness).toBeGreaterThan(0.7);
      expect(profile.metal.metalness).toBeGreaterThan(0.25);
    }
    const relay = new T.MeshStandardMaterial();
    const undertow = new T.MeshStandardMaterial();
    const switchyard = new T.MeshStandardMaterial();
    finishRelaySurface(relay, 'ground');
    finishUndertowSurface(undertow, 'concrete');
    finishSwitchyardSurface(switchyard, 'deck');
    expect([relay.userData.physicalSurface, undertow.userData.physicalSurface, switchyard.userData.physicalSurface])
      .toEqual(['mud', 'concrete', 'metal']);
    expect([relay.roughness, undertow.roughness, switchyard.roughness]).toEqual([0.97, 0.91, 0.78]);
    relay.dispose(); undertow.dispose(); switchyard.dispose();
  });

  it('keeps Switchyard signs and supplies supported by exterior solids', () => {
    const parts = switchyardSiteBoundary(ARENA3.bounds.width, ARENA3.bounds.depth);
    const boxes = parts.map((part) => new T.Box3(
      new T.Vector3(part.x - part.w / 2, part.y - part.h / 2, part.z - part.d / 2),
      new T.Vector3(part.x + part.w / 2, part.y + part.h / 2, part.z + part.d / 2),
    ));
    for (const sign of switchyardSiteSigns(ARENA3.bounds.width, ARENA3.bounds.depth)) {
      const point = new T.Vector3(sign.x, sign.y, sign.z);
      expect(Math.min(...boxes.map((box) => box.distanceToPoint(point)))).toBeLessThanOrEqual(0.02);
      expect(boxes.some((box) => box.containsPoint(point))).toBe(false);
    }
    for (const supply of switchyardSiteSupplies(ARENA3.bounds.depth)) {
      const point = new T.Vector3(supply.x, supply.y - 0.001, supply.z);
      expect(boxes.some((box) => box.containsPoint(point))).toBe(true);
    }
  });
});
