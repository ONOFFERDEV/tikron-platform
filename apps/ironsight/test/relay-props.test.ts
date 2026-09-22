import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  RELAY_ENVIRONMENT_PLACEMENTS,
  placeRelayEnvironmentModel,
  placeRelayUplinks,
} from '../client/relay-props.js';
import { WW1_ENVIRONMENT_MANIFEST } from '../config/ww1-environment.js';
import { ARENA1 } from '../src/map/arena1.js';

describe('Relay field aerial placement', () => {
  it('grounds offset/rotated source bounds and keeps both shared instances outside play', () => {
    const source = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(3, 6, 2), new T.MeshStandardMaterial());
    mesh.position.set(12, -7, 4); mesh.rotation.y = 0.35; source.add(mesh);
    source.position.set(-9, 3, 2); source.scale.setScalar(0.7);
    const groups = placeRelayUplinks(source);
    expect(groups).toHaveLength(2);
    for (const [i, group] of groups.entries()) {
      const box = new T.Box3().setFromObject(group), size = box.getSize(new T.Vector3());
      expect(box.min.y).toBeCloseTo(0, 6);
      expect(box.getCenter(new T.Vector3()).x).toBeCloseTo([25, 37][i]!, 6);
      expect(box.max.z).toBeLessThanOrEqual(-3.9 + 1e-6);
      expect(size.x).toBeLessThanOrEqual(4 + 1e-6);
      expect(size.y).toBeLessThanOrEqual(9 + 1e-6);
      expect(group.name).toBe('relay-field-aerial');
      group.traverse(node => {
        expect(node instanceof T.Light).toBe(false);
        if (node instanceof T.Mesh) {
          expect(node.geometry).toBe(mesh.geometry);
          expect(node.material).toBe(mesh.material);
          expect(node.castShadow && node.receiveShadow).toBe(true);
        }
      });
    }
  });

  it('rejects empty/flat geometry and embedded lights before placement', () => {
    expect(() => placeRelayUplinks(new T.Group())).toThrow('bounds');
    expect(() => placeRelayUplinks(new T.Mesh(new T.PlaneGeometry()))).toThrow('bounds');
    const lit = new T.Group(); lit.add(new T.PointLight());
    expect(() => placeRelayUplinks(lit)).toThrow('lights');
  });
});

describe('Relay WW1 environment adapter', () => {
  it('copies the stable environment contract into every placement', () => {
    for (const placement of RELAY_ENVIRONMENT_PLACEMENTS) {
      const asset = WW1_ENVIRONMENT_MANIFEST.assets.find(candidate => candidate.key === placement.key);
      expect(asset).toBeDefined();
      expect(placement).toMatchObject({
        dimensionsM: asset?.dimensionsM,
        origin: 'bottom-center',
        joints: asset?.joints,
        surface: asset?.surfaces[0],
        collision: asset?.collision,
        maxCladdingOffsetM: asset?.maxCladdingOffsetM,
        routeBoundary: asset?.routeBoundary,
      });
    }
  });

  it('aligns duckboards to the lower support and contains sandbags inside authoritative cover', () => {
    const trench = ARENA1.structures?.find(structure => structure.id === 'freight-trench');
    const covers = trench?.parts.filter(part => part.kind === 'cover').map(part => part.box) ?? [];
    for (const placement of RELAY_ENVIRONMENT_PLACEMENTS) {
      const [width, height, depth] = placement.dimensionsM;
      const [x, y, z] = placement.position;
      if (placement.key === 'duckboard') {
        expect(y + height).toBeCloseTo(-3, 6);
        expect(placement.collision).toEqual({ kind: 'box', dimensionsM: [2, .1, 1] });
      }
      if (placement.key === 'sandbag') expect(covers.some(box =>
        box.min.x <= x - width / 2 && box.max.x >= x + width / 2 &&
        box.min.y <= y && box.max.y >= y + height &&
        box.min.z <= z - depth / 2 && box.max.z >= z + depth / 2)).toBe(true);
      if (placement.key === 'wire') expect(placement).toMatchObject({ collision: { kind: 'none' }, routeBoundary: false });
    }
  });

  it('rejects model scale drift beyond the manifest cladding allowance', () => {
    const placement = RELAY_ENVIRONMENT_PLACEMENTS.find(candidate => candidate.key === 'duckboard')!;
    const exact = new T.Mesh(new T.BoxGeometry(2, .1, 1).translate(0, .05, 0), new T.MeshStandardMaterial());
    const group = placeRelayEnvironmentModel(exact, placement);
    expect(group.position.toArray()).toEqual(placement.position);
    expect(group.name).toBe('relay-environment:duckboard');
    expect(() => placeRelayEnvironmentModel(
      new T.Mesh(new T.BoxGeometry(2.05, .1, 1).translate(0, .05, 0), new T.MeshStandardMaterial()),
      placement,
    )).toThrow('bounds');
  });
});
