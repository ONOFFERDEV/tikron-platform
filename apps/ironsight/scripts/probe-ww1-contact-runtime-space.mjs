import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Box3, Matrix4, Quaternion, Triangle, Vector3 } from "three";

const CONTRACT = resolve("D:/webgame-baas/.omo/evidence/ww1/task-08/production-candidates-v3/contact-frames-v1/contact-frames-v1.json");
const OUTPUT = resolve("D:/webgame-baas/.omo/evidence/ww1/task-08/production-candidates-v3/contact-frames-v1/runtime-space-probe.json");
const EXPECTED_GLB_SHA = "06fba41ab8e6e457ccf2496b936d587a0cdabaf53fe79e5295be05f0a05139e7";
const EXPECTED_SCENE_SHA = "67030f43b980ae297f2c351dd128969b40a9e9813baa4a2eb4886e74895b04d4";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseGlb(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim());
  return { json, binary: bytes.subarray(28 + jsonLength) };
}

function positions(document, binary, nodeName) {
  const node = document.nodes.find((candidate) => candidate.name === nodeName);
  if (node?.mesh === undefined) throw new Error(`missing_mesh:${nodeName}`);
  const output = [];
  for (const primitive of document.meshes[node.mesh].primitives) {
    const accessor = document.accessors[primitive.attributes.POSITION], view = document.bufferViews[accessor.bufferView];
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
    for (let index = 0; index < accessor.count; index += 1) {
      output.push(new Vector3(binary.readFloatLE(offset + index * stride), binary.readFloatLE(offset + index * stride + 4), binary.readFloatLE(offset + index * stride + 8)));
    }
  }
  return output;
}

const vec = (values) => new Vector3().fromArray(values);
const rounded = (values) => values.map((value) => Number(value.toFixed(8)));
const matrixValues = (matrix) => rounded(matrix.toArray());
function compose(position, quaternion, scale) {
  return new Matrix4().compose(vec(position), new Quaternion().fromArray(quaternion), vec(scale));
}
function transformPoint(values, matrix) {
  return rounded(vec(values).applyMatrix4(matrix).toArray());
}
function transformedBounds(points, matrix) {
  const box = new Box3();
  for (const point of points) box.expandByPoint(point.clone().applyMatrix4(matrix));
  return { min: rounded(box.min.toArray()), max: rounded(box.max.toArray()) };
}
function transformedSurfaceDistance(point, vertices, matrix) {
  const transformed = vertices.map((vertex) => vec(vertex).applyMatrix4(matrix));
  const value = vec(point).applyMatrix4(matrix), closest = new Vector3();
  new Triangle(...transformed).closestPointToPoint(value, closest);
  return { point: rounded(value.toArray()), triangle: transformed.map((vertex) => rounded(vertex.toArray())), closest: rounded(closest.toArray()), distance: Number(value.distanceTo(closest).toExponential(3)) };
}

const contractBytes = await readFile(CONTRACT), contract = JSON.parse(contractBytes);
const weapon = contract.weapons.bolt_service_rifle;
if (weapon.candidate.sha256 !== EXPECTED_GLB_SHA) throw new Error("contract_candidate_hash_mismatch");
const glbBytes = await readFile(weapon.candidate.path);
if (sha(glbBytes) !== EXPECTED_GLB_SHA) throw new Error("live_candidate_hash_mismatch");
const scenePath = resolve("client/scene.ts"), sceneBytes = await readFile(scenePath);
if (sha(sceneBytes) !== EXPECTED_SCENE_SHA) throw new Error("runtime_transform_source_changed");
const { json, binary } = parseGlb(glbBytes), boltVertices = positions(json, binary, "bolt");
const frame = weapon.frames.find((candidate) => candidate.frameName === "bolt_handle_grip");
if (!frame) throw new Error("missing_bolt_handle_frame");

const baselinePart = new Matrix4().fromArray(frame.partNodeLocalMatrix);
const wrapper = compose([0, 0, -0.30], [0, 1, 0, 0], [0.38, 0.38, 0.38]);
const closed = wrapper.clone().multiply(baselinePart);
const actionPart = compose([0, 0.08, 0.35 - 0.085], new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -1.05).toArray(), [1, 1, 1]);
const action = wrapper.clone().multiply(actionPart);
const reportedBoundsX = [-0.03082, 0.00489];
let reconciliation;
for (let step = 0; step <= 10000; step += 1) {
  const fraction = step / 10000, part = compose([0, 0.08, 0.35], new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -1.05 * fraction).toArray(), [1, 1, 1]);
  const matrix = wrapper.clone().multiply(part), bounds = transformedBounds(boltVertices, matrix);
  const error = (bounds.min[0] - reportedBoundsX[0]) ** 2 + (bounds.max[0] - reportedBoundsX[1]) ** 2;
  if (reconciliation === undefined || error < reconciliation.squaredError) reconciliation = { fraction, squaredError: error, boundsX: [bounds.min[0], bounds.max[0]], frame: transformPoint(frame.partLocalPosition, matrix), surface: transformedSurfaceDistance(frame.partLocalPosition, frame.sample.triangle, matrix) };
}
const report = {
  schemaVersion: 1,
  scope: "bolt-handle exact runtime hierarchy reconciliation",
  bindings: { contract: { path: CONTRACT, bytes: contractBytes.length, sha256: sha(contractBytes) }, candidateSha256: EXPECTED_GLB_SHA, runtimeTransformSource: { path: scenePath, sha256: EXPECTED_SCENE_SHA, lines: "143-149 and 864-876" } },
  hierarchy: ["weaponHolder common root", "GLTF scene wrapper: scale .38, rotationY PI, positionZ -.30", "contract root: identity", "bolt: baseline translation [0,.08,.35], action rotationZ -1.05 and pullZ -.085", "sampled bolt triangle 132"],
  conventionCorrection: { partLocalPosition: frame.partLocalPosition, contractRootClosedPosition: frame.contractRootLocalPosition, note: "contractRootLocalPosition is before the runtime GLTF wrapper; partLocalPosition is the consumer transform for a child of partName." },
  closed: { combinedMatrix: matrixValues(closed), frame: transformPoint(frame.partLocalPosition, closed), boltBounds: transformedBounds(boltVertices, closed), surface: transformedSurfaceDistance(frame.partLocalPosition, frame.sample.triangle, closed) },
  fullBoltAction: { combinedMatrix: matrixValues(action), frame: transformPoint(frame.partLocalPosition, action), boltBounds: transformedBounds(boltVertices, action), surface: transformedSurfaceDistance(frame.partLocalPosition, frame.sample.triangle, action) },
  reportedSnapshotReconciliation: { reportedBoundsX, ...reconciliation, conclusion: "The reported bounds match a 0.648 bolt-lift rotation fraction; they do not measure the unrotated raw handle cap." },
};
for (const state of [report.closed, report.fullBoltAction, report.reportedSnapshotReconciliation]) {
  if (!Number.isFinite(state.surface.distance) || state.surface.distance > 1e-7) throw new Error("runtime_surface_binding_failed");
}
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(report, null, 2) + "\n");
const outputBytes = await readFile(OUTPUT);
console.log(JSON.stringify({ output: OUTPUT, bytes: outputBytes.length, sha256: sha(outputBytes), closedBoundsX: [report.closed.boltBounds.min[0], report.closed.boltBounds.max[0]], actionBoundsX: [report.fullBoltAction.boltBounds.min[0], report.fullBoltAction.boltBounds.max[0]], reportedReconciliation: report.reportedSnapshotReconciliation, actionFrame: report.fullBoltAction.frame, surfaceDistances: [report.closed.surface.distance, report.fullBoltAction.surface.distance] }));
