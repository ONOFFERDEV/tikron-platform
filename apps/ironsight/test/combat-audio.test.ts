import { expect, it } from 'vitest';
import { GAME } from '../src/game-config.js';
import {
  FIRE_VARIANTS,
  WeaponAudioEventGate,
  WEAPON_FAMILY_NAMES,
  consumeWeaponActionAudio,
  synthesizeWeaponSound,
} from '../client/weapon-sound.js';
import { FOOTSTEP_SURFACE_PROFILES, prepareDistantFire } from '../client/spatial-audio.js';

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

it('gives every weapon family a distinct deterministic close signature', () => {
  expect(WEAPON_FAMILY_NAMES).toEqual(['rifle', 'smg', 'shotgun', 'sniper', 'pistol']);
  const signatures = GAME.audio.fireParams.map((tone, weapon) => {
    const pcm = synthesizeWeaponSound(48000, weapon, tone);
    return [pcm.length, Math.round(brightness(pcm) * 1e6), Math.round(energy(pcm) * 1e3)].join(':');
  });
  expect(new Set(signatures).size).toBe(WEAPON_FAMILY_NAMES.length);
});

it('uses a distinct footstep filter profile for every authored surface', () => {
  expect(Object.keys(FOOTSTEP_SURFACE_PROFILES).sort())
    .toEqual(['concrete', 'gravel', 'metal', 'mud', 'wood']);
  const signatures = Object.values(FOOTSTEP_SURFACE_PROFILES)
    .map(profile => `${profile.playbackRate}:${profile.filter}:${profile.frequency}:${profile.q}:${profile.gain}`);
  expect(new Set(signatures).size).toBe(5);
});

it('plays local attempt one once, rejects its self echo, and deduplicates confirmations', () => {
  const gate = new WeaponAudioEventGate();
  expect(gate.acceptLocalAttempt('me:1:1')).toBe(true);
  expect(gate.acceptLocalAttempt('me:1:1')).toBe(false);
  expect(gate.acceptRemoteShot('me:1:1', true)).toBe(false);
  expect(gate.acceptRemoteShot('them:1:1', false)).toBe(true);
  expect(gate.acceptRemoteShot('them:1:1', false)).toBe(false);
  expect(gate.acceptConfirmation('hit', 'me:1:1')).toBe(true);
  expect(gate.acceptConfirmation('hit', 'me:1:1')).toBe(false);
  expect(gate.acceptConfirmation('kill', 'me:1:1')).toBe(true);
  expect(gate.acceptConfirmation('hit', undefined)).toBe(false);
});

it('turns authoritative reload phases into once-only markers and cancels stale schedules', () => {
  const gate = new WeaponAudioEventGate();
  const reload = {
    weaponIndex: 0, kind: 'magazine_reload' as const, phase: 'reload' as const,
    startedAt: 1000, phaseStartedAt: 1000, endsAt: 3000, serial: 7, committed: 0, fireBuffered: false,
  };
  expect(gate.updateAction('remote', reload)).toEqual({
    accepted: true,
    cancelSerial: null,
    cues: [
      { cue: 'mag-out', delayMs: 0, serial: 7 },
      { cue: 'mag-in', delayMs: 1300, serial: 7 },
      { cue: 'bolt', delayMs: 1760, serial: 7 },
    ],
  });
  expect(gate.updateAction('remote', reload).cues).toEqual([]);
  expect(gate.updateAction('remote', null, 0, { serial: 6, weaponIndex: 4 }))
    .toEqual({ accepted: false, cancelSerial: null, cues: [] });
  expect(gate.updateAction('remote', null)).toEqual({ accepted: true, cancelSerial: 7, cues: [] });

  const shell = { ...reload, kind: 'pump_reload' as const, phase: 'reload_insert' as const,
    serial: 8, committed: 1, phaseStartedAt: 1200, endsAt: 1800 };
  expect(gate.updateAction('remote', shell).cues).toEqual([{ cue: 'shell', delayMs: 0, serial: 8 }]);
  expect(gate.updateAction('remote', { ...shell, committed: 2 }).cues)
    .toEqual([{ cue: 'shell', delayMs: 0, serial: 8 }]);
  expect(gate.updateAction('remote', { ...reload, serial: 7 }).cues).toEqual([]);
  expect(gate.updateAction('remote', { ...shell, committed: 1 }).cues).toEqual([]);

  gate.clear();
  expect(gate.acceptLocalAttempt('me:1:1')).toBe(true);
  expect(gate.updateAction('remote', reload).cues).toHaveLength(3);

  const late = new WeaponAudioEventGate();
  expect(late.updateAction('late-remote', reload, 2000).cues).toEqual([
    { cue: 'mag-in', delayMs: 300, serial: 7 },
    { cue: 'bolt', delayMs: 760, serial: 7 },
  ]);
});

it('consumer adapter preserves a newer action and drops unknown remote audio', () => {
  const gate = new WeaponAudioEventGate();
  const state = {
    weaponIndex: 0, kind: 'magazine_reload' as const, phase: 'reload' as const,
    startedAt: 1000, phaseStartedAt: 1000, endsAt: 3000, serial: 7, committed: 0, fireBuffered: false,
  };
  const missing = consumeWeaponActionAudio(gate, { id: 'remote', state },
    { observedAt: 1000, localId: 'self', remoteKnown: false });
  expect(missing).toMatchObject({ accepted: true, schedule: false, cancelSerial: null });
  const stale = consumeWeaponActionAudio(gate,
    { id: 'remote', state: null, weaponIndex: 4, serial: 6 },
    { observedAt: 1200, localId: 'self', remoteKnown: true });
  expect(stale).toEqual({ accepted: false, schedule: false, cancelSerial: null, cues: [] });
  const finish = consumeWeaponActionAudio(gate,
    { id: 'remote', state: null, weaponIndex: 0, serial: 7 },
    { observedAt: 3000, localId: 'self', remoteKnown: true });
  expect(finish).toEqual({ accepted: true, schedule: false, cancelSerial: 7, cues: [] });
});
