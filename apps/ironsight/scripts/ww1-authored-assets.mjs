import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_ADMISSION = new URL('../config/ww1-authored-admission.json', import.meta.url);
const policies = {
  'ammo-crate': { joints: { lid: [0, .65, 0], carry_left: [-.6, .4, 0], carry_right: [.6, .4, 0] }, collision: { kind: 'box', dimensionsM: [1.2, .65, .62] }, cladding: .018 },
  'brick-rubble': { joints: { join_left: [-1.2, 0, 0], join_right: [1.2, 0, 0] }, collision: { kind: 'box', dimensionsM: [2.4, .78, .65] }, cladding: .018 },
  'trench-wall': { joints: { join_left: [-2, 0, 0], join_right: [2, 0, 0] }, collision: { kind: 'box', dimensionsM: [4, 2.4, .45] }, cladding: .018 },
  duckboard: { joints: { join_left: [-1, 0, 0], join_right: [1, 0, 0] }, collision: { kind: 'box', dimensionsM: [2, .1, 1] }, cladding: .018 },
  'field-telephone': { joints: { handset: [0, .204, -.055], crank: [.143, .105, .092], cable: [0, .025, .112] }, collision: { kind: 'none' }, cladding: .018 },
  'freight-wagon-wreck': { joints: { coupler_front: [0, .58, 1.35], coupler_rear: [0, .58, -1.35], bogie_front: [2.35, .45, 0], bogie_rear: [-2.35, .45, 0] }, collision: { kind: 'compound', dimensionsM: [7.4, 2.8, 2.7], parts: 7 }, cladding: .018 },
  'observation-post': { joints: { entry: [0, 0, -1.2], view_slit: [0, 2.18, 1.2] }, collision: { kind: 'compound', dimensionsM: [2.4, 3.4, 2.4], parts: 6 }, cladding: .018 },
  sandbag: { joints: { join_left: [-1, 0, 0], join_right: [1, 0, 0] }, collision: { kind: 'box', dimensionsM: [2, .72, .62] }, cladding: .018 },
  'supply-wagon': { joints: { drawbar: [0, .62, .95], load_origin: [0, 1.25, -.15], wheel_front_left: [-1.25, .55, .92], wheel_front_right: [1.25, .55, .92], wheel_rear_left: [-1.25, .55, -.72], wheel_rear_right: [1.25, .55, -.72] }, collision: { kind: 'compound', dimensionsM: [3.6, 2.1, 1.9], parts: 6 }, cladding: .018 },
  'timber-brace': { joints: { join_left: [-1.2, 0, 0], join_right: [1.2, 0, 0] }, collision: { kind: 'compound', dimensionsM: [2.4, 2.5, .22], parts: 5 }, cladding: .018 },
  wire: { joints: { join_left: [-1.5, 0, 0], join_right: [1.5, 0, 0] }, collision: { kind: 'none' }, cladding: 0 },
  'rail-platform': { joints: { join_front: [0, 0, 1.2], join_back: [0, 0, -1.2] }, collision: { kind: 'box', dimensionsM: [4, .32, 2.4] }, cladding: .018 },
  biplane: { joints: { path_origin: [0, 0, 0], propeller: [0, -.225, 3.2], camera_observation: [0, .325, .25] }, collision: { kind: 'none' }, cladding: .018 },
};
const records = [
  ['ammo-crate', 'environment', [1.2, .65, .62], 'bottom-center', [4000, 1800, 650], ['lid', 'carry_left', 'carry_right'], ['wood', 'metal'], 'environment-prop'],
  ['brick-rubble', 'environment', [2.4, .8, .65], 'bottom-center', [5000, 2200, 800], ['join_left', 'join_right'], ['concrete', 'gravel'], 'environment-prop'],
  ['trench-wall', 'environment', [4, 2.4, .45], 'bottom-center', [1800, 950, 420], ['join_left', 'join_right'], ['mud', 'wood'], 'environment-prop'],
  ['duckboard', 'environment', [2, .1, 1], 'bottom-center', [720, 360, 144], ['join_left', 'join_right'], ['wood'], 'environment-prop'],
  ['field-telephone', 'environment', [.28, .22, .22], 'bottom-center', [3000, 1300, 500], ['handset', 'crank', 'cable'], ['wood', 'metal'], 'environment-prop'],
  ['freight-wagon-wreck', 'environment', [7.4, 2.8, 2.7], 'bottom-center', [12000, 5000, 1800], ['coupler_front', 'coupler_rear', 'bogie_front', 'bogie_rear'], ['metal', 'wood'], 'environment-prop'],
  ['observation-post', 'environment', [2.4, 3.4, 2.4], 'bottom-center', [10000, 4500, 1600], ['entry', 'view_slit'], ['wood', 'mud'], 'environment-prop'],
  ['sandbag', 'environment', [2, .72, .62], 'bottom-center', [2700, 1000, 520], ['join_left', 'join_right'], ['mud'], 'environment-prop'],
  ['supply-wagon', 'environment', [3.6, 2.1, 1.9], 'bottom-center', [9000, 4000, 1400], ['drawbar', 'load_origin', 'wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right'], ['wood', 'metal'], 'environment-prop'],
  ['timber-brace', 'environment', [2.4, 2.5, .22], 'bottom-center', [1100, 560, 240], ['join_left', 'join_right'], ['wood'], 'environment-prop'],
  ['wire', 'environment', [3, 1.1, .18], 'bottom-center', [2800, 1200, 420], ['join_left', 'join_right'], ['metal'], 'environment-prop'],
  ['rail-platform', 'environment', [4, .32, 2.4], 'bottom-center', [2100, 1050, 430], ['join_front', 'join_back'], ['wood', 'metal', 'gravel'], 'environment-prop'],
  ['biplane', 'support', [9.2, 2.75, 6.4], 'centre-of-mass', [11000, 5000, 1800], ['path_origin', 'propeller', 'camera_observation'], ['wood', 'metal'], 'support-airframe'],
].map(([key, directory, dimensions, origin, budget, joints, surfaces, role]) => ({ key, directory, dimensions, origin, budget, joints, surfaces, role,
  recipeVersion: ['ammo-crate', 'brick-rubble', 'field-telephone', 'freight-wagon-wreck', 'observation-post', 'supply-wagon'].includes(key) ? 2 : 1, policy: policies[key],
  glb: `assets/ww1/${directory}/${key}.glb`, meta: `assets/ww1/${directory}/${key}.meta.json` }));
export const AUTHORED_WW1_PATHS = records.flatMap(record => [record.glb, record.meta]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const component = { 5121: [1, 'getUint8'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function parseGlb(bytes) {
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('invalid_glb_header');
  let offset = 12, json, binary;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw Error('invalid_chunk_header');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4), end = offset + 8 + length;
    if (length % 4 || end > bytes.length) throw Error('invalid_chunk_length');
    if (type === 0x4e4f534a) { if (json) throw Error('duplicate_json_chunk'); json = JSON.parse(bytes.subarray(offset + 8, end).toString('utf8').trim()); }
    else if (type === 0x004e4942) { if (binary) throw Error('duplicate_binary_chunk'); binary = bytes.subarray(offset + 8, end); }
    else throw Error('unknown_glb_chunk');
    offset = end;
  }
  if (!json || !binary || offset !== bytes.length || json.buffers?.length !== 1 || json.buffers[0].byteLength > binary.length) throw Error('invalid_glb_structure');
  return { document: json, binary };
}

function accessor(document, binary, index) {
  const value = document.accessors?.[index], view = document.bufferViews?.[value?.bufferView], shape = widths[value?.type], format = component[value?.componentType];
  if (!value || !view || !shape || !format || value.sparse || value.normalized || (value.byteOffset ?? 0) < 0 || (view.byteOffset ?? 0) < 0) throw Error('unsupported_accessor');
  const [size, method] = format, stride = view.byteStride ?? size * shape, start = (view.byteOffset ?? 0) + (value.byteOffset ?? 0), end = start + Math.max(0, value.count - 1) * stride + size * shape;
  if (!Number.isSafeInteger(value.count) || value.count < 1 || stride < size * shape || end > (view.byteOffset ?? 0) + view.byteLength || end > binary.length) throw Error('accessor_out_of_bounds');
  const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength), output = [];
  for (let row = 0; row < value.count; row += 1) for (let column = 0; column < shape; column += 1) output.push(data[method](start + row * stride + column * size, true));
  if (output.some(number => !Number.isFinite(number))) throw Error('non_finite_accessor');
  return { values: output, count: value.count, shape, componentType: value.componentType };
}

function inspect(document, binary, record) {
  const names = new Map((document.nodes ?? []).map(node => [node.name, node])); const lodTriangles = [], min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const lod of ['LOD0', 'LOD1', 'LOD2']) {
    const mesh = document.meshes?.[names.get(lod)?.mesh]; if (!mesh?.primitives?.length) throw Error('missing_lod'); let triangles = 0;
    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? 4) !== 4 || primitive.indices === undefined || primitive.attributes?.POSITION === undefined || primitive.attributes.NORMAL === undefined || primitive.attributes.TEXCOORD_0 === undefined) throw Error('invalid_primitive');
      const positions = accessor(document, binary, primitive.attributes.POSITION), normals = accessor(document, binary, primitive.attributes.NORMAL), uvs = accessor(document, binary, primitive.attributes.TEXCOORD_0), indices = accessor(document, binary, primitive.indices);
      if (positions.shape !== 3 || normals.shape !== 3 || uvs.shape !== 2 || positions.count !== normals.count || positions.count !== uvs.count || indices.shape !== 1 || ![5121, 5123, 5125].includes(indices.componentType) || indices.values.length % 3 || indices.values.some(index => !Number.isSafeInteger(index) || index >= positions.count)) throw Error('invalid_mesh_data');
      for (let index = 0; index < positions.values.length; index += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], positions.values[index + axis]); max[axis] = Math.max(max[axis], positions.values[index + axis]); }
      triangles += indices.values.length / 3;
    }
    lodTriangles.push(triangles);
  }
  if (!(lodTriangles[0] > lodTriangles[1] && lodTriangles[1] > lodTriangles[2]) || lodTriangles.some((count, index) => count > record.budget[index])) throw Error('lod_order_or_budget');
  for (const name of [record.key, ...record.joints]) if (!names.has(name)) throw Error('missing_required_node');
  const image = document.images?.[0], view = document.bufferViews?.[image?.bufferView], start = (view?.byteOffset ?? -1);
  if (!image || image.uri || image.mimeType !== 'image/png' || !view || start < 0 || start + view.byteLength > binary.length || binary.readUInt32BE(start) !== 0x89504e47 || binary.readUInt32BE(start + 16) !== 512 || binary.readUInt32BE(start + 20) !== 512) throw Error('invalid_embedded_texture');
  if (record.key === 'biplane') {
    for (const name of ['Faction_Khaki', 'Faction_Fieldgrey']) if (!names.has(name)) throw Error('support_behavior');
    const variants = document.extensions?.KHR_materials_variants?.variants, mappings = document.meshes?.[0]?.primitives?.[1]?.extensions?.KHR_materials_variants?.mappings;
    if (!same(variants, [{ name: 'khaki' }, { name: 'fieldgrey' }]) || !Array.isArray(mappings) || mappings.length !== 2) throw Error('support_behavior');
  }
  return { lodTriangles, min, max, texture: [512, 512] };
}

function validateMetadata(meta, record, metrics, hash) {
  if (meta.sha256 !== hash) throw Error('metadata_hash');
  if (record.key === 'wire' && meta.collision?.kind !== 'none') throw Error('wire_collision');
  if (meta.schemaVersion !== 1 || meta.key !== record.key || !same(meta.dimensionsM, record.dimensions) || meta.origin !== record.origin || !same(meta.coordinateSystem, { units: 'metres', up: '+Y', forward: '+Z' }) || !same(meta.lods, ['LOD0', 'LOD1', 'LOD2']) || !same(meta.lodTriangles, metrics.lodTriangles) || !same(meta.joints, record.policy.joints) || !same(meta.surfaces, record.surfaces) || !same(meta.collision, record.policy.collision)) throw Error('metadata_contract');
  if (meta.texture?.width !== 512 || meta.texture?.height !== 512 || meta.texture?.wrap !== 'repeat' || meta.maxCladdingOffsetM !== record.policy.cladding || meta.maxCladdingOffsetM > .02) throw Error('runtime_material_contract');
  if (!same(meta.source, { kind: 'original-authored', generator: 'tools/build-ww1-environment.mjs', recipeVersion: record.recipeVersion })) throw Error('source_contract');
  if (!same(meta.provenance, { status: 'authored', sourceKind: 'original-authored', receiptRole: record.role, receiptPath: `artifacts/ww1/receipts/${record.key}.json`, outputSha256: hash })) throw Error('provenance_contract');
  if (record.key === 'biplane' && (meta.pilotable !== false || !same(meta.factionVariants, ['khaki', 'fieldgrey']) || !same(meta.presentation, ['observation', 'fixed-linear-strafing']))) throw Error('support_behavior');
  const size = metrics.max.map((value, axis) => value - metrics.min[axis]), expectedMin = record.origin === 'centre-of-mass' ? record.dimensions.map(value => -value / 2) : [-record.dimensions[0] / 2, 0, -record.dimensions[2] / 2];
  if (size.some((value, axis) => Math.abs(value - record.dimensions[axis]) > .005) || metrics.min.some((value, axis) => Math.abs(value - expectedMin[axis]) > .005)) throw Error('geometry_bounds');
}

export async function auditAuthoredWw1Assets(publicRoot, builderPath, admissionPath = DEFAULT_ADMISSION) {
  const issues = [], files = [];
  const admission = JSON.parse(await readFile(admissionPath, 'utf8')), anchors = new Map(admission.assets?.map(asset => [asset.key, asset]) ?? []);
  const review = admission.review, placement = admission.placementReview;
  if (admission.schemaVersion !== 2 || admission.kind !== 'ww1-original-authored-admission' || admission.releaseStatus !== 'source-model-candidate' || admission.runtimePlacement !== 'source-adapter-approved-preview-only' || admission.runtimeVisual !== 'unqualified-pending-browser' || admission.fallbackRequiredUntilRuntimeVisualReview !== true || review?.status !== 'accepted' || review?.scope !== 'source-model-only' || review?.evidence !== 'D:/webgame-baas/.omo/evidence/ww1/task-10/post-deploy/independent-review.json' || review?.sha256 !== '3e388feb6f68e7b2856e680ab86c701f0d5248585fd5190a379c56b067aeccc5' || placement?.status !== 'accepted' || placement?.scope !== 'source-transform-and-collision-adapter-only' || placement?.evidence !== 'D:/webgame-baas/.omo/evidence/ww1/task-30/placement/independent-review.json' || placement?.sha256 !== '346f5632c4499308eed4c38e6371721d807c2fe78be16d8929299dc58bb9932a' || anchors.size !== records.length || admission.assets?.length !== records.length) issues.push({ code: 'admission_contract', path: String(admissionPath) });
  const builder = await readFile(builderPath); if (sha256(builder) !== admission.builder?.sha256 || admission.builder?.path !== 'tools/build-ww1-environment.mjs') issues.push({ code: 'builder_hash', path: builderPath });
  const allowed = new Set(AUTHORED_WW1_PATHS);
  for (const directory of ['assets/ww1/environment', 'assets/ww1/support']) for (const entry of await readdir(join(publicRoot, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`; if (!entry.isFile() || !allowed.has(path)) issues.push({ code: 'unexpected_authored_asset', path });
  }
  for (const record of records) {
    try {
      const anchor = anchors.get(record.key); if (!anchor || anchor.glb !== record.glb || anchor.meta !== record.meta || !/^[a-f0-9]{64}$/.test(anchor.glbSha256) || !/^[a-f0-9]{64}$/.test(anchor.metaSha256)) throw Error('admission_contract');
      const glbBytes = await readFile(join(publicRoot, record.glb)), metaBytes = await readFile(join(publicRoot, record.meta)), hash = sha256(glbBytes); if (hash !== anchor.glbSha256) throw Error('trusted_glb_hash');
      const meta = JSON.parse(metaBytes), { document, binary } = parseGlb(glbBytes), metrics = inspect(document, binary, record);
      if (!same(document.extras?.dimensionsM, record.dimensions) || document.extras?.origin !== record.origin || !same(document.extras?.coordinateSystem, { units: 'metres', up: '+Y', forward: '+Z' }) || !same(document.extras?.lodTriangles, metrics.lodTriangles)) throw Error('glb_extras_contract');
      validateMetadata(meta, record, metrics, hash); if (sha256(metaBytes) !== anchor.metaSha256) throw Error('trusted_meta_hash');
      files.push({ key: record.key, glb: record.glb, meta: record.meta, sha256: hash, bytes: glbBytes.length, triangles: metrics.lodTriangles, bounds: { min: metrics.min, max: metrics.max }, texture: metrics.texture });
    } catch (error) { issues.push({ code: error?.code === 'ENOENT' ? 'missing_pair' : error instanceof Error ? error.message : 'authored_asset_error', path: record.glb }); }
  }
  return { valid: issues.length === 0, builderSha256: sha256(builder), files, issues };
}
