import { expect, it } from 'vitest';
import { GAME } from '../src/game-config.js';
import { FIRE_VARIANTS, synthesizeWeaponSound } from '../client/weapon-sound.js';
import { prepareDistantFire } from '../client/spatial-audio.js';

function energy(pcm: Float32Array, start = 0, end = pcm.length) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += pcm[i]! ** 2;
  return sum;
}
function brightness(pcm: Float32Array) {
  let sum = 0;
  for (let i = 1; i < pcm.length; i++) sum += (pcm[i]! - pcm[i - 1]!) ** 2;
  return sum / energy(pcm);
}

it('distant gunfire loses mechanical edge and gains relative tail energy for every weapon', () => {
  for (const rate of [44100, 48000, 96000]) for (const [weapon, tone] of GAME.audio.fireParams.entries()) {
    const close = synthesizeWeaponSound(rate, weapon, tone);
    const field = prepareDistantFire(close, rate, 1), far = prepareDistantFire(close, rate, 2);
    expect(prepareDistantFire(close, rate, 0)).toBe(close);
    expect(brightness(field)).toBeLessThan(brightness(close));
    expect(brightness(far)).toBeLessThan(brightness(field));
    const tailShare = (pcm: Float32Array) => energy(pcm, Math.round(.06 * rate)) / energy(pcm);
    expect(tailShare(field)).toBeGreaterThan(tailShare(close));
    expect(tailShare(far)).toBeGreaterThan(tailShare(field));
    expect(energy(far)).toBeLessThan(energy(close));
    for (const pcm of [field, far]) {
      expect(pcm.length).toBe(close.length);
      expect(Math.abs(pcm[0]!)).toBe(0); expect(Math.abs(pcm.at(-1)!)).toBe(0);
      let invalid = 0;
      for (const value of pcm) if (!Number.isFinite(value) || Math.abs(value) >= 1) invalid++;
      expect(invalid).toBe(0);
    }
  }
});

it('keeps distance variants deterministic without changing the shared close recording', () => {
  const pcm = synthesizeWeaponSound(48000, 0, GAME.audio.fireParams[0]!);
  const original = pcm.slice();
  const field = prepareDistantFire(pcm, 48000, 1);
  expect(prepareDistantFire(pcm, 48000, 1)).toEqual(field);
  expect(field.buffer).not.toBe(pcm.buffer);
  expect(pcm).toEqual(original);
});

it('bounds all cached perspectives to 3.3 MiB at 48 kHz and keeps existing voice lifetimes', () => {
  let bytes = 0;
  for (const [weapon, tone] of GAME.audio.fireParams.entries()) {
    const pcm = synthesizeWeaponSound(48000, weapon, tone);
    bytes += pcm.byteLength * FIRE_VARIANTS * 3;
    expect(pcm.length / 48000).toBeLessThan(.6);
  }
  expect(bytes).toBeLessThan(3.3 * 1024 * 1024);
});
