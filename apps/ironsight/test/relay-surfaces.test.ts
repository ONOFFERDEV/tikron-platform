import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createConcreteDetail } from '../client/concrete-detail.js';
import { relayGroundTexture, updateRelayGroundTexture } from '../client/relay-surfaces.js';

describe('Relay surface residency and map orientation', () => {
  it('preserves north/south and linear light when compacting an asymmetric atlas', () => {
    // North-west white, north-east middle grey, south-west black, south-east dark.
    const rgba = new Uint8ClampedArray([255,255,255,255, 128,128,128,255, 0,0,0,255, 64,64,64,255]);
    const canvas = { width: 2, height: 2, getContext: () => ({ getImageData: () => ({ data: rgba }) }) };
    const texture = relayGroundTexture(canvas);
    expect(texture.format).toBe(T.RedFormat);
    expect(texture.colorSpace).toBe(T.NoColorSpace);
    expect(texture.flipY).toBe(false);
    // V=0 is south on the -90 degree ground plane; V=1 is north.
    expect([...texture.image.data!]).toEqual([0, 13, 255, 55]);
    const allocation = texture.image.data;
    rgba[0] = 0; updateRelayGroundTexture(texture, canvas);
    expect(texture.image.data).toBe(allocation);
    expect([...texture.image.data!]).toEqual([0, 13, 0, 55]);
  });

  it('fits the finer Relay pair and atlas inside the former combined allocation', () => {
    const old = createConcreteDetail(), fine = createConcreteDetail(true);
    const bytes = (pair: typeof fine) => Object.values(pair).reduce((sum, texture) => sum + texture.image.data!.byteLength, 0) * 4 / 3;
    expect(fine.normal.image.width / 0.8).toBe(320);
    expect(fine.roughness.format).toBe(T.RedFormat);
    expect(fine.normal.generateMipmaps && fine.roughness.generateMipmaps).toBe(true);
    expect(bytes(fine) + 1024 * 683 * 4 / 3).toBeLessThan(bytes(old) + 512 * 512 * 4 * 4 / 3);
    // Unchanged non-Relay data and deterministic generation are separate maps.
    expect(old.roughness.format).toBe(T.RGBAFormat);
    expect(fine.normal.image.data).toEqual(createConcreteDetail(true).normal.image.data);
  });
});
