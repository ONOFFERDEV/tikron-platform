import { afterEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { acquireMapDressing, cloneMapDressing, dressingCacheSnapshot } from '../client/dressing-loader.js';

describe('Signal village cache ownership', () => {
  afterEach(() => vi.restoreAllMocks());

  it('releases the failed-load skyline after its last scene and retries on the next map', async () => {
    const recovered = await new GLTFLoader().parseAsync(JSON.stringify({
      asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [],
    }), '');
    const request = vi.spyOn(GLTFLoader.prototype, 'loadAsync')
      .mockRejectedValueOnce(new Error('skyline unavailable')).mockResolvedValueOnce(recovered);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const first = acquireMapDressing('/assets/maps/relay-skyline.glb');
    const second = acquireMapDressing('/assets/maps/relay-skyline.glb');

    const source = await first.value;
    expect(source).toBeDefined();
    if (!source) { first.release(); second.release(); return; }
    expect(await second.value).toBe(source);
    const geometryDisposals: T.BufferGeometry[] = [];
    const materialDisposals: T.Material[] = [];
    const materials = new Set<T.Material>();
    source.scene.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      node.geometry.addEventListener('dispose', () => geometryDisposals.push(node.geometry));
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
    });
    for (const material of materials) material.addEventListener('dispose', () => materialDisposals.push(material));
    const instance = cloneMapDressing(source);
    instance.dispose(); first.release();
    expect(geometryDisposals).toHaveLength(0);
    second.release(); second.release();

    expect(geometryDisposals).toHaveLength(4);
    expect(materialDisposals).toHaveLength(1);
    expect(dressingCacheSnapshot().entries).toBe(0);
    const next = acquireMapDressing('/assets/maps/relay-skyline.glb');
    expect(await next.value).toBe(recovered);
    expect(request).toHaveBeenCalledTimes(2);
    next.release();
  });
});
