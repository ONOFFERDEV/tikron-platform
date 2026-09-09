import { expect, it } from 'vitest';
import * as THREE from 'three';
import { flashEnvelope, WEAPON_FLASHES, weaponFlashTexture, weaponFlashTextures } from '../client/weapon-flash.js';


it('bakes five distinct silhouettes into one immutable shared GPU source', () => {
  const textures = weaponFlashTextures();
  expect(new Set(textures.map(t => t.source)).size).toBe(1);
  expect(textures.every(t => !t.generateMipmaps && t.minFilter === THREE.LinearFilter)).toBe(true);
  const data = (textures[0]!.image as { data: Uint8Array }).data;
  const occupied = textures.map((_, slot) => {
    let count = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const index = ((Math.floor(slot / 4) * 64 + y) * 256 + (slot % 4) * 64 + x) * 4 + 3;
      if (data[index]! > 128) count++;
      if (x === 0 || y === 0 || x === 63 || y === 63) expect(data[index]).toBe(0);
    }
    return count;
  });
  expect(new Set(occupied).size).toBe(5);
  expect(occupied[2]).toBeGreaterThan(occupied[3]! * 2);
  expect(weaponFlashTexture(99)).toBe(textures[0]);
  expect(weaponFlashTextures()).toBe(textures);
});

it('expires every flash in 2-4 frames at 60Hz without a frame-rate-dependent tail', () => {
  for (let i = 0; i < 5; i++) {
    const spec = WEAPON_FLASHES[i]!;
    expect(spec.lifeMs).toBeGreaterThanOrEqual(1000 / 60 * 2);
    expect(spec.lifeMs).toBeLessThanOrEqual(1000 / 60 * 4);
    expect(flashEnvelope(-1, i)).toBe(0);
    expect(flashEnvelope(0, i)).toBe(1);
    expect(flashEnvelope(spec.lifeMs / 2, i)).toBeGreaterThan(0);
    expect(flashEnvelope(spec.lifeMs, i)).toBe(0);
    expect(flashEnvelope(10000, i)).toBe(0);
  }
});

