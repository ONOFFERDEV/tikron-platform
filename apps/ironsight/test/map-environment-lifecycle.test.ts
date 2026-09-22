import { beforeEach, expect, it, vi } from 'vitest';
import * as T from 'three';

const state = vi.hoisted(() => ({ released: [] as string[], rejectKey: undefined as string | undefined }));

vi.mock('../client/dressing-loader.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../client/dressing-loader.js')>();
  const dimensions: Readonly<Record<string, readonly [number, number, number]>> = {
    'ammo-crate': [1.2, .65, .62],
    'brick-rubble': [2.4, .8, .65],
    'field-telephone': [.28, .22, .22],
    'observation-post': [2.4, 3.4, 2.4],
    'supply-wagon': [3.6, 2.1, 1.9],
    'freight-wagon-wreck': [7.4, 2.8, 2.7],
  };
  return {
    ...actual,
    acquireMapDressing: (url: string) => {
      const key = url.split('/').at(-1)?.replace('.glb', '') ?? '';
      const size = dimensions[key];
      if (size === undefined) throw new TypeError(`Unexpected fixture candidate ${key}`);
      const scene = new T.Group();
      scene.add(new T.Mesh(new T.BoxGeometry(...size).translate(0, size[1] / 2, 0), new T.MeshStandardMaterial()));
      return {
        value: state.rejectKey === key
          ? Promise.reject(new Error(`Failed candidate ${key}`))
          : Promise.resolve({ scene, scenes: [scene] }),
        release: () => state.released.push(url),
      };
    },
  };
});

import { loadMapEnvironmentProps } from '../client/map-environment-props.js';
import { authoredEnvironmentEnabled } from '../client/environment-selection.js';
import { MAP_ENVIRONMENT_PLACEMENTS } from '../src/map/environment-props.js';

beforeEach(() => { state.released.length = 0; state.rejectKey = undefined; });


it.each(['relay', 'undertow', 'switchyard'] as const)(
  'loads every admitted %s placement in the ordinary no-query route',
  async map => {
    const scene = new T.Scene();
    const props = await loadMapEnvironmentProps(scene, map, {
      candidatePreview: authoredEnvironmentEnabled(''),
    });
    const expected = MAP_ENVIRONMENT_PLACEMENTS
      .filter(placement => placement.map === map)
      .map(placement => placement.id);
    expect(props.loaded).toEqual(expected);
    expect(props.fallback).toEqual([]);
    expect(scene.children.map(child => child.name)).toEqual(
      expected.map(id => `map-environment:${id}`),
    );
    props.dispose();
    expect(scene.children).toEqual([]);
  },
);

it('keeps admitted templates leased through map lifetime and disposes once', async () => {
  const scene = new T.Scene();
  const props = await loadMapEnvironmentProps(scene, 'relay', { candidatePreview: true });
  expect(props.loaded).toEqual(['relay-ammo-west', 'relay-rubble-north', 'relay-field-telephone', 'relay-observation-post']);
  expect(props.fallback).toEqual([]);
  expect(scene.children.map(child => child.name)).toEqual(props.loaded.map(id => `map-environment:${id}`));
  expect(state.released).toEqual([]);
  props.dispose(); props.dispose();
  expect(scene.children).toEqual([]);
  expect(state.released).toHaveLength(4);
});

it('keeps deterministic fallbacks in ordinary runtime until visual approval', async () => {
  const scene = new T.Scene();
  const props = await loadMapEnvironmentProps(scene, 'relay');
  expect(props.loaded).toEqual([]);
  expect(props.fallback).toEqual(['relay-ammo-west', 'relay-rubble-north', 'relay-field-telephone', 'relay-observation-post']);
  expect(scene.children.every(child => child.name.startsWith('map-environment-fallback:'))).toBe(true);
  expect(state.released).toEqual([]);
  props.dispose();
  expect(scene.children).toEqual([]);
});

it('retains and returns the procedural fallback when one candidate request fails', async () => {
  state.rejectKey = 'brick-rubble';
  const scene = new T.Scene();
  const props = await loadMapEnvironmentProps(scene, 'relay', { candidatePreview: true });
  expect(props.loaded).toEqual(['relay-ammo-west', 'relay-field-telephone', 'relay-observation-post']);
  expect(props.fallback).toEqual(['relay-rubble-north']);
  expect(scene.getObjectByName('map-environment-fallback:relay-rubble-north')).toBeDefined();
  expect(state.released).toHaveLength(1);
  props.dispose();
  expect(state.released).toHaveLength(4);
});
