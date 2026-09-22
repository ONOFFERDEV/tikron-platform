import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ROOT = resolve(".inspect/ww1-art/production-candidates-v3");
const OUTPUT = resolve("D:/webgame-baas/.omo/evidence/ww1/task-08/production-candidates-v3/contact-frames-v1/contact-frames-v1.json");
const EXPECTED_SHA = Object.freeze({
  automatic_rifle: "37259feb884e69708483e65d86a42e1cbeeadefabb01dc92c25bf37537331eb9",
  trench_smg: "780868bc7453150b2aa1156ecf11230536b54bc0390ae2e905df6330ae300197",
  pump_shotgun: "a85d9b42a39ed1e961f6db9f16165f9680c5b4829abd800123b350840a68833a",
  bolt_service_rifle: "06fba41ab8e6e457ccf2496b936d587a0cdabaf53fe79e5295be05f0a05139e7",
  service_pistol: "0a62fdfb5a429985c20950813359d170b8f3ba885dcad5186a35fb45427511f3",
});
const DEFINITIONS = Object.freeze({
  automatic_rifle: [
    ["grip_r", "fp", "grip_r", [0.08, 0, 0], [0, -1, 0]], ["grip_l", "fp", "grip_l", [0.08, 0, 0], [0, 0, -1]],
    ["magazine", "magazine", "magwell", [0.07, 0, 0], [0, -1, 0]],
  ],
  trench_smg: [
    ["grip_r", "fp", "grip_r", [0.08, 0, 0], [0, -1, 0]], ["grip_l", "fp", "grip_l", [0.08, 0, 0], [0, 0, -1]],
    ["magazine", "magazine", "magwell", [0.07, 0, 0], [0, -1, 0]],
  ],
  pump_shotgun: [
    ["grip_r", "fp", "grip_r", [0.08, 0, 0], [0, -1, 0]], ["pump", "pump", "grip_l", [0.08, 0, 0], [0, 0, -1]],
    ["shell", "shell", "chamber", [0.04, 0, 0], [0, -1, 0]],
  ],
  bolt_service_rifle: [
    ["grip_r", "fp", "grip_r", [0.08, 0, 0], [0, -1, 0]], ["grip_l", "fp", "grip_l", [0.08, 0, 0], [0, 0, -1]],
    ["bolt_handle_grip", "bolt", "chamber", [0.14, -0.015, -0.19], [0, -1, 0]], ["clip", "clip", "clip_mount", [0.05, 0, 0], [0, 1, 0]],
  ],
  service_pistol: [
    ["grip_r", "fp", "grip_r", [0.07, 0, 0], [0, -1, 0]], ["grip_l", "fp", "grip_l", [0.07, 0, 0], [0, 0, -1]],
    ["magazine", "magazine", "magwell", [0.05, 0, 0], [0, -1, 0]], ["slide", "slide", "chamber", [0.05, 0, 0], [0, 0, -1]],
  ],
});

const add = (a, b) => a.map((value, index) => value + b[index]);
const sub = (a, b) => a.map((value, index) => value - b[index]);
const mul = (a, scalar) => a.map((value) => value * scalar);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (value) => Math.sqrt(dot(value, value));
const unit = (value) => mul(value, 1 / length(value));
const round = (value) => value.map((entry) => Number(entry.toFixed(8)));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = node.scale ?? [1, 1, 1], [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - yy - zz) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - xx - zz) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - xx - yy) * sz, 0, tx, ty, tz, 1];
}

function closestPoint(point, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(point, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(point, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, mul(ab, d1 / (d1 - d3)));
  const cp = sub(point, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, mul(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, mul(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const denominator = 1 / (va + vb + vc);
  return add(a, add(mul(ab, vb * denominator), mul(ac, vc * denominator)));
}

function parseGlb(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim());
  const binaryStart = 28 + jsonLength;
  const binaryLength = bytes.readUInt32LE(20 + jsonLength);
  return { json, binary: bytes.subarray(binaryStart, binaryStart + binaryLength) };
}

function accessorData(document, binary, index) {
  const accessor = document.accessors[index], view = document.bufferViews[accessor.bufferView];
  const components = accessor.type === "VEC3" ? 3 : 1;
  const widths = { 5123: 2, 5125: 4, 5126: 4 };
  const width = widths[accessor.componentType], stride = view.byteStride ?? width * components;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), output = [];
  for (let row = 0; row < accessor.count; row += 1) {
    const values = [];
    for (let column = 0; column < components; column += 1) {
      const at = offset + row * stride + column * width;
      values.push(accessor.componentType === 5126 ? binary.readFloatLE(at)
        : accessor.componentType === 5125 ? binary.readUInt32LE(at) : binary.readUInt16LE(at));
    }
    output.push(components === 1 ? values[0] : values);
  }
  return output;
}

function quaternionFromAxes(x, y, z) {
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2];
  const trace = m00 + m11 + m22;
  let q;
  if (trace > 0) { const s = Math.sqrt(trace + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
  return round(unit(q));
}

function derive(document, binary, definition) {
  const [frameName, partName, anchorName, queryOffset, wristHint] = definition;
  const nodes = new Map(document.nodes.map((node) => [node.name, node]));
  const part = nodes.get(partName), anchor = nodes.get(anchorName);
  if (part?.mesh === undefined || anchor === undefined) throw new Error(`missing_node:${frameName}`);
  if (part.matrix || part.rotation || part.scale || anchor.matrix || anchor.rotation || anchor.scale) {
    throw new Error(`unsupported_non_translation_node:${frameName}`);
  }
  const partTranslation = part.translation ?? [0, 0, 0], anchorPosition = anchor.translation ?? [0, 0, 0];
  const query = sub(add(anchorPosition, queryOffset), partTranslation);
  let selected;
  for (const [primitiveIndex, primitive] of document.meshes[part.mesh].primitives.entries()) {
    const positions = accessorData(document, binary, primitive.attributes.POSITION);
    const indices = accessorData(document, binary, primitive.indices);
    for (let index = 0; index < indices.length; index += 3) {
      const vertices = [positions[indices[index]], positions[indices[index + 1]], positions[indices[index + 2]]];
      const point = closestPoint(query, ...vertices), distance = length(sub(query, point));
      const face = cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0]));
      if (length(face) < 1e-8) continue;
      const alignment = Math.abs(unit(face)[0]), score = distance + (1 - alignment) * 0.08;
      if (selected === undefined || score < selected.score) selected = { primitiveIndex, triangleIndex: index / 3, vertices, point, distance, score };
    }
  }
  if (selected === undefined) throw new Error(`empty_mesh:${partName}`);
  let normal = unit(cross(sub(selected.vertices[1], selected.vertices[0]), sub(selected.vertices[2], selected.vertices[0])));
  if (dot(normal, sub(query, selected.point)) < 0) normal = mul(normal, -1);
  let y = sub(wristHint, mul(normal, dot(wristHint, normal)));
  if (length(y) < 1e-5) y = sub([0, 0, 1], mul(normal, normal[2]));
  y = unit(y); const z = unit(cross(normal, y)); y = unit(cross(z, normal));
  const position = add(selected.point, partTranslation), handedness = dot(cross(normal, y), z);
  const errors = { xLength: Math.abs(length(normal) - 1), yLength: Math.abs(length(y) - 1), zLength: Math.abs(length(z) - 1), xyDot: Math.abs(dot(normal, y)), xzDot: Math.abs(dot(normal, z)), yzDot: Math.abs(dot(y, z)), handednessError: Math.abs(handedness - 1), surfaceDistance: length(sub(selected.point, closestPoint(selected.point, ...selected.vertices))) };
  if (![...position, ...normal, ...y, ...z, ...Object.values(errors)].every(Number.isFinite) || Math.max(...Object.values(errors)) > 1e-5) throw new Error(`invalid_frame:${frameName}`);
  return { frameName, partName, anchorName, space: "namedPartLocal", partNodeLocalMatrix: nodeMatrix(part).map((value) => Number(value.toFixed(8))), anchorNodeLocalMatrix: nodeMatrix(anchor).map((value) => Number(value.toFixed(8))), partLocalPosition: round(selected.point), contractRootLocalPosition: round(position), quaternionXyzw: quaternionFromAxes(normal, y, z), axes: { surfaceNormalX: round(normal), wristDirectionY: round(y), tangentZ: round(z) }, sample: { primitiveIndex: selected.primitiveIndex, triangleIndex: selected.triangleIndex, queryDistance: Number(selected.distance.toFixed(8)), selectionScore: Number(selected.score.toFixed(8)), triangle: selected.vertices.map(round) }, validation: Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, Number(value.toExponential(3))])) };
}

const weapons = {};
for (const [assetKey, definitions] of Object.entries(DEFINITIONS)) {
  const path = resolve(ROOT, assetKey, "candidate.glb"), bytes = await readFile(path), { json, binary } = parseGlb(bytes);
  if (sha(bytes) !== EXPECTED_SHA[assetKey]) throw new Error(`candidate_hash_mismatch:${assetKey}`);
  weapons[assetKey] = { candidate: { path, bytes: bytes.length, sha256: sha(bytes) }, frames: definitions.map((definition) => derive(json, binary, definition)) };
}
const report = { schemaVersion: 1, contract: "ww1-weapon-contact-frames-v1", frozenCandidateManifestSha256: "d2d4e4531ebd5ef6124c64e7977465058016ec45112cb8aca16fc38eedad1051", coordinateSystem: { units: "metres", up: "+Y", forward: "+Z", frameConvention: "+X=outward surface normal, +Y=projected wrist direction, +Z=X cross Y, quaternion=xyzw" }, weapons };
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output: OUTPUT, bytes: (await readFile(OUTPUT)).length, sha256: sha(await readFile(OUTPUT)), frames: Object.values(weapons).reduce((sum, weapon) => sum + weapon.frames.length, 0) }));
