import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { finishRelaySurface } from '../client/relay-surfaces.js';

describe('Signal Station material conversion', () => {
  it.each(['relay-2', 'relay-3', 'relay-5', 'relay-7'])('renders %s as nonmetallic timber while retaining resident maps', name => {
    const normalMap = new T.Texture();
    const roughnessMap = new T.Texture();
    const aoMap = new T.Texture();
    const material = new T.MeshStandardMaterial({ name, normalMap, roughnessMap, aoMap });

    finishRelaySurface(material, 'coated');

    expect(material.userData.physicalSurface).toBe('wood');
    expect(material.metalness).toBe(0);
    expect(material.normalMap).toBe(normalMap);
    expect(material.roughnessMap).toBe(roughnessMap);
    expect(material.aoMap).toBe(aoMap);
    expect(material.transparent).toBe(false);
    expect(material.alphaTest).toBe(0);
  });

  it('keeps iron hardware distinct from timber under the same legacy loader call', () => {
    const timber = new T.MeshStandardMaterial({ name: 'relay-2' });
    const iron = new T.MeshStandardMaterial({ name: 'relay-4' });

    finishRelaySurface(timber, 'coated');
    finishRelaySurface(iron, 'coated');

    expect(iron.userData.physicalSurface).toBe('metal');
    expect(iron.metalness).toBeGreaterThan(timber.metalness);
    expect(iron.customProgramCacheKey()).not.toBe(timber.customProgramCacheKey());
  });

  it('retains a stable program identity when the same finish is prepared again', () => {
    const material = new T.MeshStandardMaterial({ name: 'relay-2' });
    finishRelaySurface(material, 'coated');
    const key = material.customProgramCacheKey();

    finishRelaySurface(material, 'coated');

    expect(material.customProgramCacheKey()).toBe(key);
  });
});
