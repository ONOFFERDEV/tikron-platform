import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createConcreteDetail } from '../client/concrete-detail.js';
import { undertowGroundTexture, updateUndertowGroundTexture } from '../client/undertow-surfaces.js';

describe('Undertow packed water material', () => {
  it('keeps wetness linear and aligned with north-first colour through an AO update', () => {
    const rgba = new Uint8ClampedArray([255,255,255,255, 128,128,128,255, 0,0,0,255, 64,64,64,255]);
    const wet = new Uint8ClampedArray([0,0,0,255, 64,64,64,255, 128,128,128,255, 255,255,255,255]);
    const canvas = (data: Uint8ClampedArray) => ({ width: 2, height: 2, getContext: () => ({ getImageData: () => ({ data }) }) });
    const texture = undertowGroundTexture(canvas(rgba), canvas(wet));
    expect(texture.format).toBe(T.RGFormat);
    expect(texture.colorSpace).toBe(T.NoColorSpace);
    expect(texture.flipY).toBe(false);
    // South is V=0. Colour decodes sRGB, but the physical wetness mask does not.
    expect([...texture.image.data!]).toEqual([0,128, 13,255, 255,0, 55,64]);
    const allocation = texture.image.data;
    rgba[0] = 128;
    updateUndertowGroundTexture(texture, canvas(rgba), canvas(wet));
    expect(texture.image.data).toBe(allocation);
    expect([...texture.image.data!]).toEqual([0,128, 13,255, 55,0, 55,64]);
    texture.dispose();
  });

  it('keeps a packed atlas and fine detail within one additional MiB over the previous map', () => {
    const pair = createConcreteDetail(true);
    const bytes = (1024 * 683 * 2 + pair.normal.image.data!.byteLength + pair.roughness.image.data!.byteLength) * 4 / 3;
    const previous = (512 * 512 * 4 + 128 * 128 * 8) * 4 / 3;
    expect(bytes - previous).toBeLessThan(1024 * 1024);
    expect(pair.normal.image.width / 0.8).toBe(320);
    pair.normal.dispose(); pair.roughness.dispose();
  });
});
