import { describe, expect, it } from 'vitest';
import { GAME } from '../src/game-config.js';
import { weaponSource, weaponSupportSource, WW1_WEAPON_CANDIDATE_SOURCES, WW1_WEAPON_SUPPORT_SOURCES } from '../client/weapon-loader.js';

describe('WW1 weapon candidate selector', () => {
  it('selects the exact five reviewed paths only in explicit preview mode', () => {
    for (const [index, expected] of WW1_WEAPON_CANDIDATE_SOURCES.entries())
      expect(weaponSource(GAME.weaponVis, index, { candidatePreview: true })).toEqual(expected);
    expect(weaponSource(GAME.weaponVis, 5, { candidatePreview: true })).toBeUndefined();
  });

  it('exposes reviewed support nodes only in explicit preview mode', () => {
    for (const kind of ['grenade', 'clip', 'shell', 'casing'] as const)
      expect(weaponSupportSource(kind, { candidatePreview: true })).toEqual(WW1_WEAPON_SUPPORT_SOURCES[kind]);
    expect(weaponSupportSource('grenade')).toBeUndefined();
    expect(weaponSupportSource('casing')).toBeUndefined();
  });

  it('preserves the ordinary runtime resolver by default', () => {
    expect(weaponSource(GAME.weaponVis, 0)).toEqual({ url: '/assets/weapons/field-carbine.glb', nodeName: 'field-carbine' });
    expect(weaponSource(GAME.weaponVis, 1)).toEqual({ url: '/assets/models/weapons-vm.glb', nodeName: 'wep_smg' });
  });
});
