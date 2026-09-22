import { describe, expect, it } from 'vitest';
import { quarantinedAssetPaths } from '../scripts/asset-quarantine.mjs';
import { WW1_SOLDIER_CANDIDATE_PATHS } from '../scripts/ww1-soldier-candidates.mjs';

const rules = WW1_SOLDIER_CANDIDATE_PATHS.map(path => `/${path}`).join('\n');
const quarantine = { valid: false, issues: [
  { code: 'soldier_candidate_quarantined', path: 'assets/ww1/characters' },
  { code: 'soldier_builder_hash', path: 'tools/fit-ww1-soldiers.py' },
] };

describe('quarantined asset deployment boundary', () => {
  it('excludes historical candidates without admitting them or rewriting their builder receipt', () => {
    expect([...quarantinedAssetPaths(quarantine, rules)]).toEqual(WW1_SOLDIER_CANDIDATE_PATHS);
    expect(quarantine.valid).toBe(false);
  });

  it.each(['', rules.split('\n').slice(1).join('\n'), `${rules}\n!/assets/ww1/characters/soldier-khaki.glb`,
    `${rules}\n/assets/**`, rules.replace('/assets/', 'assets/'), ` ${rules}`,
    rules.replace('.glb', '.glb ')])('rejects inexact exclusions: %s', source => {
    expect(() => quarantinedAssetPaths(quarantine, source)).toThrow(/exact quarantine paths/);
  });

  it.each(['soldier_admission_contract', 'soldier_glb_hash', 'soldier_meta_hash',
    'soldier_metadata_contract', 'soldier_missing_pair', 'soldier_source_hash',
    'soldier_clip_contract', 'soldier_rig_contract'])('still rejects %s', code => {
    expect(() => quarantinedAssetPaths({ ...quarantine, issues: [...quarantine.issues, { code }] }, rules))
      .toThrow(/quarantine integrity/);
  });

  it('requires an explicit quarantine verdict before applying the historical-builder exception', () => {
    expect(() => quarantinedAssetPaths({ valid: true, issues: [] }, rules)).toThrow(/quarantine verdict/);
    expect(() => quarantinedAssetPaths({ valid: false, issues: [{ code: 'soldier_builder_hash' }] }, rules))
      .toThrow(/quarantine verdict/);
  });
});
