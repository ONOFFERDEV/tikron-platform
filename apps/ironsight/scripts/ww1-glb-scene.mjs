const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function issue(code, path, detail) {
  return detail === undefined ? { code, path } : { code, path, detail };
}

function multiplyMatrices(left, right) {
  const output = Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) for (let row = 0; row < 4; row += 1) {
    for (let lane = 0; lane < 4; lane += 1) output[column * 4 + row] += left[lane * 4 + row] * right[column * 4 + lane];
  }
  return output;
}

function nodeMatrix(node, path, issues) {
  if (node.matrix !== undefined) {
    if (Array.isArray(node.matrix) && node.matrix.length === 16 && node.matrix.every(Number.isFinite)) return node.matrix;
    issues.push(issue("invalid_node_transform", `${path}.matrix`));
    return IDENTITY;
  }
  const translation = node.translation ?? [0, 0, 0];
  const rotation = node.rotation ?? [0, 0, 0, 1];
  const scale = node.scale ?? [1, 1, 1];
  if (![translation, rotation, scale].every((value, index) => Array.isArray(value) && value.length === (index === 1 ? 4 : 3) && value.every(Number.isFinite))) {
    issues.push(issue("invalid_node_transform", path));
    return IDENTITY;
  }
  const [x, y, z, w] = rotation;
  const [sx, sy, sz] = scale;
  const quaternionLength = Math.hypot(x, y, z, w);
  if (!Number.isFinite(quaternionLength) || Math.abs(quaternionLength - 1) > 1e-4) {
    issues.push(issue("invalid_node_transform", `${path}.rotation`));
    return IDENTITY;
  }
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    translation[0], translation[1], translation[2], 1,
  ];
}

export function transformPoint(matrix, value) {
  return [
    matrix[0] * value[0] + matrix[4] * value[1] + matrix[8] * value[2] + matrix[12],
    matrix[1] * value[0] + matrix[5] * value[1] + matrix[9] * value[2] + matrix[13],
    matrix[2] * value[0] + matrix[6] * value[1] + matrix[10] * value[2] + matrix[14],
  ];
}

export function activeSceneGraph(document, issues) {
  const sceneIndex = document.scene ?? 0;
  const scene = Number.isSafeInteger(sceneIndex) ? document.scenes?.[sceneIndex] : undefined;
  if (!scene) {
    issues.push(issue("invalid_scene_reference", "scene"));
    return { active: new Set(), world: new Map(), meshInstances: [] };
  }
  const roots = Array.isArray(scene.nodes) ? scene.nodes : [];
  if (roots.length === 0) issues.push(issue("empty_active_scene", `scenes[${sceneIndex}].nodes`));
  const active = new Set();
  const world = new Map();
  const meshInstances = [];
  const visit = (nodeIndex, parentMatrix, ancestors, path) => {
    const node = Number.isSafeInteger(nodeIndex) ? document.nodes?.[nodeIndex] : undefined;
    if (!node) { issues.push(issue("invalid_node_reference", path, nodeIndex)); return; }
    if (ancestors.has(nodeIndex)) { issues.push(issue("node_cycle", path, nodeIndex)); return; }
    if (active.has(nodeIndex)) { issues.push(issue("multiple_node_parent", path, nodeIndex)); return; }
    const matrix = multiplyMatrices(parentMatrix, nodeMatrix(node, `nodes[${nodeIndex}]`, issues));
    active.add(nodeIndex);
    world.set(nodeIndex, matrix);
    if (node.mesh !== undefined) {
      if (!Number.isSafeInteger(node.mesh) || !document.meshes?.[node.mesh]) issues.push(issue("invalid_mesh_reference", `nodes[${nodeIndex}].mesh`, node.mesh));
      else meshInstances.push({ meshIndex: node.mesh, matrix });
    }
    if (node.skin !== undefined && (!Number.isSafeInteger(node.skin) || !document.skins?.[node.skin])) issues.push(issue("invalid_skin_reference", `nodes[${nodeIndex}].skin`, node.skin));
    const children = node.children ?? [];
    if (!Array.isArray(children)) { issues.push(issue("invalid_node_reference", `nodes[${nodeIndex}].children`)); return; }
    const nextAncestors = new Set(ancestors).add(nodeIndex);
    for (const [childOffset, child] of children.entries()) visit(child, matrix, nextAncestors, `nodes[${nodeIndex}].children[${childOffset}]`);
  };
  for (const [rootOffset, root] of roots.entries()) visit(root, IDENTITY, new Set(), `scenes[${sceneIndex}].nodes[${rootOffset}]`);
  if (meshInstances.length === 0) issues.push(issue("missing_scene_mesh", `scenes[${sceneIndex}]`));
  return { active, world, meshInstances };
}
