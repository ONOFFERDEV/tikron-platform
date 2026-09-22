import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export class ReviewEvidenceError extends Error {
  constructor(code) { super(code); this.name = 'ReviewEvidenceError'; this.code = code; }
}

const inside = (root, path) => { const value = relative(root, path); return value !== '' && !value.startsWith('..') && !isAbsolute(value); };
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);

export async function bindReviewEvidence(context, paths, fixtureMode) {
  const roots = fixtureMode ? [dirname(context.out)] : [resolve('D:/webgame-baas/.omo/evidence/ww1'), join(context.out, 'reviews', context.assetKey)];
  try {
    return await Promise.all(paths.map(async path => {
      const ownedPath = await realpath(resolve(path)); if (!roots.some(root => inside(root, ownedPath))) throw new ReviewEvidenceError('unowned_review_evidence');
      const bytes = await readFile(ownedPath); return { path: ownedPath, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
    }));
  } catch (error) { if (error instanceof ReviewEvidenceError) throw error; throw new ReviewEvidenceError('missing_review_evidence'); }
}

export async function verifyReviewEvidence(context, review, fixtureMode) {
  if (!isRecord(review) || !['accepted', 'rejected'].includes(review.status)) throw new ReviewEvidenceError('invalid_review_decision');
  const evidence = review.evidence; const minimum = review.status === 'accepted' ? 4 : 2;
  if (!Array.isArray(evidence) || evidence.length < minimum || evidence.some(item => !isRecord(item) || typeof item.path !== 'string' || typeof item.sha256 !== 'string' || !Number.isInteger(item.bytes))) throw new ReviewEvidenceError('unbound_review_evidence');
  const current = await bindReviewEvidence(context, evidence.map(item => item.path), fixtureMode);
  if (current.some((item, index) => item.sha256 !== evidence[index].sha256 || item.bytes !== evidence[index].bytes)) throw new ReviewEvidenceError('changed_review_evidence');
}
