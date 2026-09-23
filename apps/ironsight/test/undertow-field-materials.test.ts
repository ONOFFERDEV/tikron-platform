import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { finishUndertowSurface } from '../client/undertow-surfaces.js';

describe('Underpass field materials', () => {
  it.each(['undertow-3', 'undertow-4'])('keeps %s timber nonmetallic with the resident wet detail maps', name => {
    const normalMap = new T.Texture(), roughnessMap = new T.Texture(), aoMap = new T.Texture();
    const material = new T.MeshStandardMaterial({ name, normalMap, roughnessMap, aoMap });

    finishUndertowSurface(material, 'coated');

    expect(material.userData.physicalSurface).toBe('wood');
    expect(material.metalness).toBe(0);
    expect([material.normalMap, material.roughnessMap, material.aoMap]).toEqual([normalMap, roughnessMap, aoMap]);
    expect(material.transparent).toBe(false);
  });

  it('keeps limestone nonmetallic despite the legacy coated loader category', () => {
    const material = new T.MeshStandardMaterial({ name: 'undertow-2' });

    finishUndertowSurface(material, 'coated');

    expect(material.userData.physicalSurface).toBe('concrete');
    expect(material.metalness).toBe(0);
  });

  it('retains iron hardware and stable, distinct shader identities on repeated preparation', () => {
    const iron = new T.MeshStandardMaterial({ name: 'undertow-1' });
    const wood = new T.MeshStandardMaterial({ name: 'undertow-3' });

    finishUndertowSurface(iron, 'coated');
    finishUndertowSurface(wood, 'coated');
    const key = wood.customProgramCacheKey();
    finishUndertowSurface(wood, 'coated');

    expect(iron.metalness).toBeGreaterThan(wood.metalness);
    expect(iron.customProgramCacheKey()).not.toBe(key);
    expect(wood.customProgramCacheKey()).toBe(key);
  });
});
