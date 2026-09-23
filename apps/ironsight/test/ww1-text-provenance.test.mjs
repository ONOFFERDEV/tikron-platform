import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditWw1WeaponCandidates } from '../scripts/ww1-weapon-candidates.mjs';
import { auditPreviewAuthoredWw1Assets } from '../scripts/ww1-preview-authored-assets.mjs';
import { canonicalTextSha256 } from '../scripts/ww1-text-provenance.mjs';

const app = resolve(import.meta.dirname, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const forms = text => [lf(text), lf(text).replaceAll('\n', '\r\n'), lf(text).replace('\n', '\r\n')];
async function scratch(run) {
  const base = join(app, '.inspect/ww1-text-provenance-tests');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'case-'));
  try { return await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function write(root, path, bytes) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes);
  return target;
}

describe('WW1 checkout text provenance', () => {
  it('normalizes only paired CRLF bytes and preserves all other bytes', () => {
    const canonical = Buffer.from([0x61, 0x0a, 0x62, 0x0d, 0x63, 0xff, 0x00]);
    expect(canonicalTextSha256(Buffer.from([0x61, 0x0d, 0x0a, 0x62, 0x0d, 0x63, 0xff, 0x00]))).toBe(hash(canonical));
    for (const bytes of [Buffer.from('a\n'), Buffer.from('a \n'), Buffer.from('a\r'), Buffer.from('a'), Buffer.from([0x61, 0xff]), Buffer.from([0x61, 0xfe])]) {
      expect(canonicalTextSha256(bytes)).toBe(hash(bytes));
    }
  });

  it('accepts the same weapon builder with LF, CRLF or mixed checkout line endings', async () => scratch(async root => {
    const text = await readFile(join(app, 'tools/build-ww1-production-weapons.py'), 'utf8');
    for (const content of forms(text)) {
      const builder = await write(root, 'builder.py', content);
      const result = await auditWw1WeaponCandidates(join(root, 'public'), builder);
      expect(result.issues.map(issue => issue.code)).not.toContain('candidate_builder_hash');
      expect(result.issues.filter(issue => issue.code === 'candidate_missing_published_pair')).toHaveLength(7);
    }
  }));

  it('pins canonical metadata bytes while keeping historical generation hashes', async () => {
    for (const name of ['weapon-candidate', 'soldier-candidate', 'preview-authored']) {
      const admission = JSON.parse(await readFile(join(app, `config/ww1-${name}-admission.json`), 'utf8'));
      expect(admission.textHashPolicy).toBe('sha256-crlf-to-lf-v1');
      for (const asset of admission.assets ?? [admission.asset]) {
        const text = await readFile(join(app, 'public', asset.meta), 'utf8');
        expect(asset.metaCanonicalLfSha256).toBe(hash(lf(text)));
        expect(asset.metaSha256).toMatch(/^[a-f0-9]{64}$/);
      }
    }
    const soldier = JSON.parse(await readFile(join(app, 'config/ww1-soldier-candidate-admission.json'), 'utf8'));
    expect(soldier.builder.sha256).toBe('7dcc94ded7c62488bb6d09f5ed9fa6a0f80fbd1f17ee9dbcb7bc92517e50c815');
    expect(soldier.runtimeAccepted).toBe(false);
    expect(soldier.sourceOfflineAccepted).toBe(false);
  });

  it('preserves the first-person preview gate across text line endings', async () => scratch(async root => {
    const admission = JSON.parse(await readFile(join(app, 'config/ww1-preview-authored-admission.json'), 'utf8'));
    const asset = admission.asset;
    const builderText = await readFile(join(app, asset.builder), 'utf8');
    const metadataText = await readFile(join(app, 'public', asset.meta), 'utf8');
    await write(root, `public/${asset.glb}`, await readFile(join(app, 'public', asset.glb)));
    for (const [index, content] of forms(builderText).entries()) {
      const builder = await write(root, 'builder.mjs', content);
      await write(root, `public/${asset.meta}`, forms(metadataText)[index]);
      const result = await auditPreviewAuthoredWw1Assets(join(root, 'public'), builder);
      expect(result.issues).toEqual([]);
      expect(result.file.heroAccepted).toBe(false);
      expect(result.file.runtimeStatus).toBe('unqualified-pending-browser');
    }
  }));

  it('still rejects one-byte builder edits and a forged weapon runtime acceptance', async () => scratch(async root => {
    const builder = await write(root, 'builder.py', `${lf(await readFile(join(app, 'tools/build-ww1-production-weapons.py'), 'utf8'))} `);
    const changed = await auditWw1WeaponCandidates(join(root, 'public'), builder);
    expect(changed.issues.map(issue => issue.code)).toContain('candidate_builder_hash');
    const admission = JSON.parse(await readFile(join(app, 'config/ww1-weapon-candidate-admission.json'), 'utf8'));
    admission.runtimeAccepted = true;
    const forged = await write(root, 'admission.json', JSON.stringify(admission));
    const result = await auditWw1WeaponCandidates(join(root, 'public'), builder, forged);
    expect(result.issues.map(issue => issue.code)).toContain('candidate_admission_contract');
  }));

  it('rejects forged or missing canonical anchors and forged historical fingerprints', async () => scratch(async root => {
    const admission = JSON.parse(await readFile(join(app, 'config/ww1-weapon-candidate-admission.json'), 'utf8'));
    const builder = join(app, admission.builder.path);
    for (const mutate of [value => { delete value.textHashPolicy; }, value => { value.builder.canonicalLfSha256 = '0'.repeat(64); }, value => { value.assets[0].metaCanonicalLfSha256 = '0'.repeat(64); }, value => { value.assets[0].metaSha256 = '0'.repeat(64); }]) {
      const changed = structuredClone(admission); mutate(changed);
      const path = await write(root, 'admission.json', JSON.stringify(changed));
      expect((await auditWw1WeaponCandidates(join(root, 'public'), builder, path)).issues.map(issue => issue.code)).toContain('candidate_admission_contract');
    }
    const preview = JSON.parse(await readFile(join(app, 'config/ww1-preview-authored-admission.json'), 'utf8'));
    preview.asset.metaSha256 = '0'.repeat(64);
    const path = await write(root, 'preview.json', JSON.stringify(preview));
    expect((await auditPreviewAuthoredWw1Assets(join(root, 'public'), builder, path)).issues.map(issue => issue.code)).toContain('admission_contract');
  }));

  it('still rejects metadata whitespace edits and binary edits after LF normalization', async () => scratch(async root => {
    const admission = JSON.parse(await readFile(join(app, 'config/ww1-preview-authored-admission.json'), 'utf8'));
    const asset = admission.asset, publicRoot = join(root, 'public');
    const builder = await write(root, 'builder.mjs', lf(await readFile(join(app, asset.builder), 'utf8')));
    const bytes = await readFile(join(app, 'public', asset.glb));
    await write(root, `public/${asset.glb}`, bytes);
    const text = lf(await readFile(join(app, 'public', asset.meta), 'utf8'));
    await write(root, `public/${asset.meta}`, `${text} `);
    expect((await auditPreviewAuthoredWw1Assets(publicRoot, builder)).issues.map(issue => issue.code)).toContain('trusted_meta_hash');
    await write(root, `public/${asset.meta}`, text);
    bytes[bytes.length - 1] ^= 1; await write(root, `public/${asset.glb}`, bytes);
    expect((await auditPreviewAuthoredWw1Assets(publicRoot, builder)).issues.map(issue => issue.code)).toContain('trusted_glb_hash');
  }));
});
