import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquireMapDressing, cloneMapDressing } from '../client/dressing-loader.js';
import { acquireWeaponModel } from '../client/weapon-loader.js';
import { SharedAssetCache, disposeGltfTemplate } from '../client/shared-gltf-cache.js';

const gltf = () => new GLTFLoader().parseAsync(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] }), '');

describe('WW1 asset loader lifecycle', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['weapon', acquireWeaponModel],
    ['dressing', acquireMapDressing],
  ])('retries a failed %s URL instead of caching fallback forever', async (_name, acquire) => {
    // Given a URL whose first request fails and whose second request succeeds.
    const recovered = await gltf();
    const request = vi.spyOn(GLTFLoader.prototype, 'loadAsync')
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce(recovered);

    // When the same URL is loaded again after failure.
    const failed = acquire('/retry-after-404.glb');
    expect(await failed.value).toBeUndefined();
    failed.release();
    const retry = acquire('/retry-after-404.glb');
    const result = await retry.value;

    // Then the loader retries and returns the recovered asset.
    expect(result).toBe(recovered);
    expect(request).toHaveBeenCalledTimes(2);
    retry.release();
  });

  it('coalesces one URL while keeping two faction URLs isolated', async () => {
    // Given two faction URLs and two consumers of the khaki URL.
    const loaded: string[] = [];
    const disposed: Group[] = [];
    const cache = new SharedAssetCache(async url => { loaded.push(url); return new Group(); }, value => disposed.push(value));

    // When both factions resolve through the cache.
    const khakiA = cache.acquire('/soldier-khaki.glb');
    const khakiB = cache.acquire('/soldier-khaki.glb');
    const fieldgrey = cache.acquire('/soldier-fieldgrey.glb');
    await Promise.all([khakiA.value, khakiB.value, fieldgrey.value]);

    // Then each URL loads once and remains held by its exact reference count.
    expect(loaded).toEqual(['/soldier-khaki.glb', '/soldier-fieldgrey.glb']);
    expect(cache.snapshot()).toEqual({ entries: 2, pending: 0, ready: 2, references: 3 });
    khakiA.release();
    expect(disposed).toHaveLength(0);
    khakiB.release(); fieldgrey.release();
    expect(disposed).toHaveLength(2);
    expect(cache.snapshot()).toEqual({ entries: 0, pending: 0, ready: 0, references: 0 });
  });

  it('ignores and disposes a request that resolves after its owner releases it', async () => {
    // Given a pending request whose only owner has gone away.
    let finish: ((value: Group) => void) | undefined;
    const pending = new Promise<Group>(resolve => { finish = resolve; });
    const disposed: Group[] = [];
    const cache = new SharedAssetCache(() => pending, value => disposed.push(value));
    const lease = cache.acquire('/late.glb');
    lease.release();

    // When the abandoned request resolves.
    const value = new Group();
    if (finish === undefined) throw new Error('pending resolver missing');
    finish(value);

    // Then the old owner receives no asset and the decoded template is released.
    await expect(lease.value).resolves.toBeUndefined();
    expect(disposed).toEqual([value]);
    expect(cache.snapshot().entries).toBe(0);
  });

  it('reuses a pending request when a new owner arrives after cancellation', async () => {
    // Given a released lease followed by a new lease before the shared request resolves.
    let finish: ((value: Group) => void) | undefined;
    const pending = new Promise<Group>(resolve => { finish = resolve; });
    const load = vi.fn(() => pending);
    const dispose = vi.fn();
    const cache = new SharedAssetCache(load, dispose);
    const stale = cache.acquire('/shared-pending.glb');
    stale.release();
    const current = cache.acquire('/shared-pending.glb');

    // When the shared request resolves.
    const value = new Group();
    if (finish === undefined) throw new Error('pending resolver missing');
    finish(value);

    // Then only the current owner receives it and one request was made.
    await expect(stale.value).resolves.toBeUndefined();
    await expect(current.value).resolves.toBe(value);
    expect(load).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
    current.release();
    expect(dispose).toHaveBeenCalledWith(value);
  });

  it('keeps only the final asset during a rapid slot 1 to 5 to 2 switch', async () => {
    // Given three independently pending weapon URLs.
    const requests = new Map<string, { readonly promise: Promise<Group>; readonly finish: (value: Group) => void }>();
    const cache = new SharedAssetCache<Group>(url => {
      let finish: ((value: Group) => void) | undefined;
      const promise = new Promise<Group>(resolve => { finish = resolve; });
      if (finish === undefined) throw new Error('pending resolver missing');
      requests.set(url, { promise, finish });
      return promise;
    }, value => value.clear());
    const first = cache.acquire('/slot-1.glb'); first.release();
    const fifth = cache.acquire('/slot-5.glb'); fifth.release();
    const second = cache.acquire('/slot-2.glb');

    // When requests finish out of order.
    const one = new Group(), five = new Group(), two = new Group();
    await Promise.resolve();
    requests.get('/slot-5.glb')?.finish(five);
    requests.get('/slot-1.glb')?.finish(one);
    requests.get('/slot-2.glb')?.finish(two);

    // Then stale owners see no model and the final slot retains its model.
    await expect(first.value).resolves.toBeUndefined();
    await expect(fifth.value).resolves.toBeUndefined();
    await expect(second.value).resolves.toBe(two);
    expect(cache.snapshot()).toEqual({ entries: 1, pending: 0, ready: 1, references: 1 });
    second.release();
  });

  it('releases real Three geometry, material, and texture resources', () => {
    // Given a decoded GLTF template with observable Three disposal events.
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture });
    const geometry = new BoxGeometry();
    const scene = new Group(); scene.add(new Mesh(geometry, material));
    const disposed: string[] = [];
    geometry.addEventListener('dispose', () => disposed.push('geometry'));
    material.addEventListener('dispose', () => disposed.push('material'));
    texture.addEventListener('dispose', () => disposed.push('texture'));

    // When the shared template disposer runs.
    disposeGltfTemplate({ scene, scenes: [scene] });

    // Then each distinct GPU-backed resource is released exactly once.
    expect(disposed.sort()).toEqual(['geometry', 'material', 'texture']);
  });

  it('returns to zero retained entries across repeated acquire and release cycles', async () => {
    // Given a cache that creates a distinct real Three group per completed cycle.
    let disposed = 0;
    const cache = new SharedAssetCache(async () => new Group(), () => { disposed += 1; });

    // When one hundred scene contexts acquire and release the same URL.
    for (let cycle = 0; cycle < 100; cycle += 1) {
      const lease = cache.acquire('/cycle.glb');
      await lease.value;
      lease.release();
    }

    // Then every decoded template was disposed and no cache entry remains.
    expect(disposed).toBe(100);
    expect(cache.snapshot()).toEqual({ entries: 0, pending: 0, ready: 0, references: 0 });
  });

  it('retries a rejected shared entry after releasing its failed lease', async () => {
    // Given a shared URL whose first request rejects.
    const recovered = new Group();
    const load = vi.fn<(_: string) => Promise<Group>>()
      .mockRejectedValueOnce(new Error('corrupt glb'))
      .mockResolvedValueOnce(recovered);
    const cache = new SharedAssetCache(load, value => value.clear());
    const failed = cache.acquire('/recover.glb');

    // When the caller releases the failure and acquires the URL again.
    await expect(failed.value).rejects.toThrow('corrupt glb');
    failed.release();
    const retry = cache.acquire('/recover.glb');

    // Then a fresh request succeeds instead of retaining the rejected promise.
    await expect(retry.value).resolves.toBe(recovered);
    expect(load).toHaveBeenCalledTimes(2);
    retry.release();
  });

  it('clones dressing materials per context and releases only instance ownership', async () => {
    // Given one cached dressing template used by two scene contexts.
    const geometry = new BoxGeometry();
    const sourceMaterial = new MeshStandardMaterial();
    const scene = new Group(); scene.add(new Mesh(geometry, sourceMaterial));
    const source = await gltf(); source.scene.add(...scene.children);
    const first = cloneMapDressing(source), second = cloneMapDressing(source);
    const firstMesh = first.object.children[0];
    const secondMesh = second.object.children[0];
    if (!(firstMesh instanceof Mesh) || !(secondMesh instanceof Mesh)) throw new Error('dressing fixture missing mesh');
    const firstMaterial = firstMesh.material;
    const secondMaterial = secondMesh.material;
    if (Array.isArray(firstMaterial) || Array.isArray(secondMaterial)) throw new Error('dressing fixture material array');
    let firstDisposed = 0;
    let geometryDisposed = 0;
    firstMaterial.addEventListener('dispose', () => { firstDisposed += 1; });
    geometry.addEventListener('dispose', () => { geometryDisposed += 1; });

    // When the first context changes and disposes its material.
    firstMaterial.roughness = 0.25;
    first.dispose();

    // Then the template and second context remain independent and usable.
    expect(firstDisposed).toBe(1);
    expect(sourceMaterial.roughness).not.toBe(0.25);
    expect(secondMaterial.roughness).not.toBe(0.25);
    expect(geometryDisposed).toBe(0);
    second.dispose();
    expect(geometryDisposed).toBe(0);
    geometry.dispose(); sourceMaterial.dispose();
    expect(geometryDisposed).toBe(1);
  });
});
