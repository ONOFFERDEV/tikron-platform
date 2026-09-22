import { Material, Mesh, SkinnedMesh, Texture } from 'three';
import type { BufferGeometry, Skeleton } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type AssetLease<T> = {
  readonly value: Promise<T | undefined>;
  release(): void;
};

type CacheEntry<T> = {
  references: number;
  state: 'pending' | 'ready';
  value?: T;
  readonly promise: Promise<T>;
};

export type AssetCacheSnapshot = {
  readonly entries: number;
  readonly pending: number;
  readonly ready: number;
  readonly references: number;
};

export class SharedAssetCache<T> {
  readonly #entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly load: (url: string) => Promise<T>,
    private readonly dispose: (value: T) => void,
  ) {}

  acquire(url: string): AssetLease<T> {
    let entry = this.#entries.get(url);
    if (entry === undefined) {
      const created: CacheEntry<T> = {
        references: 0,
        state: 'pending',
        promise: Promise.resolve().then(() => this.load(url)).then(value => {
          created.state = 'ready';
          created.value = value;
          if (created.references === 0) this.disposeEntry(url, created);
          return value;
        }, error => {
          if (this.#entries.get(url) === created) this.#entries.delete(url);
          throw error;
        }),
      };
      entry = created;
      this.#entries.set(url, entry);
    }
    entry.references += 1;
    let released = false;
    return {
      value: entry.promise.then(value => released ? undefined : value),
      release: () => {
        if (released) return;
        released = true;
        entry.references -= 1;
        if (entry.references === 0 && entry.state === 'ready') this.disposeEntry(url, entry);
      },
    };
  }

  snapshot(): AssetCacheSnapshot {
    const values = [...this.#entries.values()];
    return {
      entries: values.length,
      pending: values.filter(entry => entry.state === 'pending').length,
      ready: values.filter(entry => entry.state === 'ready').length,
      references: values.reduce((total, entry) => total + entry.references, 0),
    };
  }

  private disposeEntry(url: string, entry: CacheEntry<T>): void {
    if (this.#entries.get(url) !== entry || entry.value === undefined) return;
    this.#entries.delete(url);
    this.dispose(entry.value);
  }
}

export function disposeGltfTemplate(gltf: Pick<GLTF, 'scene' | 'scenes'>): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  for (const scene of gltf.scenes.length > 0 ? gltf.scenes : [gltf.scene]) scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
    if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
