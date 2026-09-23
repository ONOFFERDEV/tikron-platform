import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { auditGlb } from './ww1-glb-core.mjs';
import { canonicalTextSha256, WW1_TEXT_HASH_POLICY } from './ww1-text-provenance.mjs';

const DEFAULT_ADMISSION = new URL('../config/ww1-preview-authored-admission.json', import.meta.url);
const ACTIONS = ['equip', 'ready', 'ads_in', 'ads_out', 'fire', 'sprint_in', 'sprint_out', 'reload'];
const REQUIRED_NODES = ['root', 'upperarm_l', 'lowerarm_l', 'Hand_L', 'upperarm_r', 'lowerarm_r', 'Hand_R', 'ik_hand_root', 'ik_hand_gun', 'ik_hand_l', 'ik_hand_r'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);

export const PREVIEW_AUTHORED_WW1_PATHS = ['assets/ww1/characters/fp-arms.glb', 'assets/ww1/characters/fp-arms.meta.json'];

function inspectFpArms(bytes, metadata) {
  const common = auditGlb(bytes, { role: 'first-person-arms', assetKey: 'fp-arms' });
  if (!common.valid) throw new Error(`glb_structure:${common.issues.map(issue => issue.code).join(',')}`);
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const names = new Set((document.nodes ?? []).map(node => node.name));
  if (REQUIRED_NODES.some(name => !names.has(name))) throw new Error('rig_nodes');
  const skin = document.skins?.[0];
  if (skin?.name !== 'ironsight-fp-arms' || skin.joints?.length !== 41 || skin.joints.length > 48 || metadata.bones !== skin.joints.length) throw new Error('rig_contract');
  if (!same(document.animations?.map(animation => animation.name), ACTIONS) || document.animations.some(animation => animation.channels?.length !== 2)) throw new Error('animation_contract');
  if (!same(document.extensions?.KHR_materials_variants?.variants?.map(variant => variant.name), ['khaki', 'fieldgrey'])) throw new Error('variant_contract');
  return common;
}

export async function auditPreviewAuthoredWw1Assets(publicRoot, builderPath, admissionPath = DEFAULT_ADMISSION) {
  const issues = [];
  let file = null;
  try {
    const admissionBytes = await readFile(admissionPath);
    const admission = JSON.parse(admissionBytes.toString('utf8'));
    const asset = admission.asset;
    const review = admission.independentReview;
    if (admission.textHashPolicy !== WW1_TEXT_HASH_POLICY) throw new Error('admission_contract');
    if (asset?.builderSha256 !== '8cd82167528a89dfb762c1801ab2be1b55ee09e7340b4091eaacdb10741c4a70' || asset.metaSha256 !== 'fd3da35ae102ccdc7988ad9a4286acdd88eca985a33b032bcf2efe49d23e5fcd' || asset.builderCanonicalLfSha256 !== asset.builderSha256 || asset.metaCanonicalLfSha256 !== asset.metaSha256) throw new Error('admission_contract');
    if (admission.schemaVersion !== 1 || admission.kind !== 'ww1-development-preview-original-authored-admission' || admission.releaseStatus !== 'development-preview' || admission.qualityStatus !== 'unfinished' || admission.sourceOfflineStatus !== 'accepted' || admission.runtimeStatus !== 'unqualified-pending-browser' || admission.heroAccepted !== false || review?.scope !== 'final-source-and-offline-only' || review?.evidence !== 'D:/webgame-baas/.omo/evidence/ww1/task-19/post-deploy/independent-full48-review.json' || review?.sha256 !== '247176f8fb1b23f493327bdb24359f911d6c3f25d9e58245076f78d85b94f50f') throw new Error('admission_contract');
    if (asset?.key !== 'fp-arms' || asset.role !== 'first-person-arms' || asset.glb !== PREVIEW_AUTHORED_WW1_PATHS[0] || asset.meta !== PREVIEW_AUTHORED_WW1_PATHS[1] || asset.builder !== 'tools/build-ww1-fp-arms.mjs' || asset.reviewStatus !== 'runtime_contact_validation_pending') throw new Error('admission_contract');
    const builder = await readFile(builderPath);
    if (canonicalTextSha256(builder) !== asset.builderCanonicalLfSha256) throw new Error('builder_hash');
    const glbBytes = await readFile(join(publicRoot, asset.glb));
    const metaBytes = await readFile(join(publicRoot, asset.meta));
    if (sha256(glbBytes) !== asset.glbSha256) throw new Error('trusted_glb_hash');
    if (canonicalTextSha256(metaBytes) !== asset.metaCanonicalLfSha256) throw new Error('trusted_meta_hash');
    const metadata = JSON.parse(metaBytes.toString('utf8'));
    if (metadata.schemaVersion !== 1 || metadata.key !== 'fp-arms' || metadata.sha256 !== asset.glbSha256 || !same(metadata.source, { kind: 'original-authored', generator: asset.builder, recipeVersion: 5 })) throw new Error('source_contract');
    if (metadata.reviewStatus !== asset.reviewStatus || !same(metadata.coordinateSystem, { units: 'metres', up: '+Y', forward: '+Z' }) || metadata.skeleton !== 'ironsight-fp-arms' || metadata.triangleCount !== 2316 || metadata.contactFit !== 'v3-surfaces' || metadata.triggerDiscipline !== true || !same(metadata.sleeveVariants, ['khaki', 'fieldgrey']) || !same(metadata.actionClips, ACTIONS) || metadata.uv !== true || metadata.normals !== true || metadata.skinWeights !== true || metadata.inverseBindMatrices !== true) throw new Error('metadata_contract');
    const common = inspectFpArms(glbBytes, metadata);
    file = { key: asset.key, glb: asset.glb, meta: asset.meta, sha256: asset.glbSha256, bytes: glbBytes.length, triangles: common.metrics.triangles, bones: metadata.bones, releaseStatus: admission.releaseStatus, qualityStatus: admission.qualityStatus, sourceOfflineStatus: admission.sourceOfflineStatus, runtimeStatus: admission.runtimeStatus, heroAccepted: admission.heroAccepted, reviewStatus: metadata.reviewStatus };
  } catch (error) {
    issues.push({ code: error?.code === 'ENOENT' ? 'missing_preview_asset' : error instanceof Error ? error.message : 'preview_asset_error', path: 'assets/ww1/characters/fp-arms.glb' });
  }
  return { valid: issues.length === 0, file, issues };
}
