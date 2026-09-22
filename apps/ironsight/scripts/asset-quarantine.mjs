import { WW1_SOLDIER_CANDIDATE_PATHS } from './ww1-soldier-candidates.mjs';

export function quarantinedAssetPaths(audit, assetsIgnore) {
  const rules = assetsIgnore.split(/\r?\n/)
    .filter(line => line && !line.startsWith('#'));
  const expected = WW1_SOLDIER_CANDIDATE_PATHS.map(path => `/${path}`);
  if (rules.length !== expected.length || expected.some(rule => !rules.includes(rule)))
    throw Error('Asset exclusions must contain only the exact quarantine paths');
  if (audit.valid || !audit.issues.some(issue => issue.code === 'soldier_candidate_quarantined'))
    throw Error('Excluded soldiers require an explicit quarantine verdict');
  const integrityIssues = audit.issues.filter(issue => issue.code !== 'soldier_candidate_quarantined'
    && issue.code !== 'soldier_builder_hash');
  if (integrityIssues.length) throw Error(`Soldier quarantine integrity failed: ${JSON.stringify(integrityIssues)}`);
  return new Set(WW1_SOLDIER_CANDIDATE_PATHS);
}
