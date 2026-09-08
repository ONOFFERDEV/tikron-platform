import { expect, it } from 'vitest';
import { GAME } from '../src/game-config.js';
import { FIRE_VARIANTS, synthesizeWeaponSound, WEAPON_SOUND_SHAPES } from '../client/weapon-sound.js';

it('bakes finite, click-free endpoints with distinct weapon decays at supported sample rates', () => {
  for (const rate of [44100, 48000, 96000]) {
    const durations = new Set<number>();
    for (const [weapon, tone] of GAME.audio.fireParams.entries()) {
      const pcm = synthesizeWeaponSound(rate, weapon, tone);
      durations.add(pcm.length);
      expect(Math.abs(pcm[0]!)).toBe(0); expect(Math.abs(pcm.at(-1)!)).toBe(0);
      let energy = 0, tail = 0, peak = 0;
      for (let i = 0; i < pcm.length; i++) {
        const value = pcm[i]!;
        expect(Number.isFinite(value)).toBe(true);
        energy += value * value; peak = Math.max(peak, Math.abs(value));
        if (i > rate * 0.15) tail += value * value;
      }
      expect(peak).toBeLessThan(1); expect(energy).toBeGreaterThan(1);
      expect(tail).toBeGreaterThan(0.0001); expect(tail).toBeLessThan(energy * 0.15);
    }
    expect(durations.size).toBe(5);
  }
});

it('reproduces each variant without sharing mutable buffers or consuming global randomness', () => {
  const tone = GAME.audio.fireParams[0]!;
  const a = synthesizeWeaponSound(48000, 0, tone);
  const b = synthesizeWeaponSound(48000, 0, tone);
  expect(a).toEqual(b); expect(a.buffer).not.toBe(b.buffer);
  for (let variant = 1; variant < FIRE_VARIANTS; variant++) {
    const c = synthesizeWeaponSound(48000, 0, tone, variant);
    expect(c).not.toEqual(a);
  }
  expect(synthesizeWeaponSound(48000, -1, tone).length).toBe(a.length);
});

it('bounds cached PCM storage and tail occupancy at the fastest weapon rate', () => {
  const bytes = WEAPON_SOUND_SHAPES.reduce((n, s) => n + Math.ceil(s.tail * 48000) * 4 * FIRE_VARIANTS, 0);
  expect(bytes).toBeLessThan(1.1 * 1024 * 1024);
  expect(Math.max(...WEAPON_SOUND_SHAPES.map(s => s.tail))).toBeLessThan(0.6);
  expect(WEAPON_SOUND_SHAPES[1].tail).toBeLessThan(WEAPON_SOUND_SHAPES[0].tail);
});
