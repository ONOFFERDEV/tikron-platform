import * as THREE from "three";

function visible(node) {
  for (let current = node; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

function dominantGroup(mesh, vertexIndex, side) {
  const indices = mesh.geometry.getAttribute("skinIndex");
  const weights = mesh.geometry.getAttribute("skinWeight");
  const totals = { palm: 0, thumb: 0, index: 0, middle: 0, ring: 0, little: 0 };
  for (let lane = 0; lane < 4; lane++) {
    const name = mesh.skeleton.bones[indices.getComponent(vertexIndex, lane)]?.name ?? "";
    const weight = weights.getComponent(vertexIndex, lane);
    if (name === `Hand_${side.toUpperCase()}`) totals.palm += weight;
    if (name.startsWith("thumb_") && name.endsWith(`_${side}`)) totals.thumb += weight;
    if ((name.startsWith("indexFinger_") || name.startsWith("index_")) && name.endsWith(`_${side}`)) totals.index += weight;
    if ((name.startsWith("finger_") || name.startsWith("middle_")) && name.endsWith(`_${side}`)) totals.middle += weight;
    if (name.startsWith("ring_") && name.endsWith(`_${side}`)) totals.ring += weight;
    if (name.startsWith("little_") && name.endsWith(`_${side}`)) totals.little += weight;
  }
  const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  return winner?.[1] > .5 ? winner[0] : undefined;
}

function appendTriangle(surface, a, b, c) {
  const offset = surface.vertices.length / 3;
  surface.vertices.push(...a, ...b, ...c);
  surface.indices.push(offset, offset + 1, offset + 2);
  surface.maximumEdgeM = Math.max(surface.maximumEdgeM,
    new THREE.Vector3().fromArray(a).distanceTo(new THREE.Vector3().fromArray(b)),
    new THREE.Vector3().fromArray(b).distanceTo(new THREE.Vector3().fromArray(c)),
    new THREE.Vector3().fromArray(c).distanceTo(new THREE.Vector3().fromArray(a)));
}

function skinnedHandSurfaces(root, side) {
  const surfaces = Object.fromEntries(["palm", "thumb", "index", "middle", "ring", "little"]
    .map(group => [group, { vertices: [], indices: [], maximumEdgeM: 0 }]));
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh) || !visible(node)) return;
    const positions = node.geometry.getAttribute("position");
    const indices = node.geometry.index;
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      const vertices = [0, 1, 2].map(lane => indices ? indices.getX(offset + lane) : offset + lane);
      const groups = vertices.map(index => dominantGroup(node, index, side));
      const counts = Object.entries(groups.reduce((result, group) => {
        if (group) result[group] = (result[group] ?? 0) + 1;
        return result;
      }, {})).sort((a, b) => b[1] - a[1]);
      const group = counts[0]?.[1] >= 2 ? counts[0][0] : undefined;
      if (!group) continue;
      for (let lane = 0; lane < 3; lane++) {
        points[lane].fromBufferAttribute(positions, vertices[lane]);
        node.applyBoneTransform(vertices[lane], points[lane]);
        node.localToWorld(points[lane]);
      }
      appendTriangle(surfaces[group], points[0].toArray(), points[1].toArray(), points[2].toArray());
    }
  });
  return surfaces;
}

function skinnedArmSurface(root, side) {
  const surface = { vertices: [], indices: [], maximumEdgeM: 0 };
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh) || !visible(node)) return;
    const positions = node.geometry.getAttribute("position");
    const indices = node.geometry.index;
    const skinIndices = node.geometry.getAttribute("skinIndex");
    const skinWeights = node.geometry.getAttribute("skinWeight");
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      const vertices = [0, 1, 2].map(lane => indices ? indices.getX(offset + lane) : offset + lane);
      const selected = vertices.filter(vertex => {
        let weight = 0;
        for (let lane = 0; lane < 4; lane++) {
          const name = node.skeleton.bones[skinIndices.getComponent(vertex, lane)]?.name ?? "";
          if (name === `UpperArm_${side.toUpperCase()}` || name === `lowerarm_${side}`
            || name === `Hand_${side.toUpperCase()}` || name.endsWith(`_${side}`)
            && /^(thumb|indexFinger|finger|index|middle|ring|little)_/.test(name))
            weight += skinWeights.getComponent(vertex, lane);
        }
        return weight > .5;
      }).length;
      if (selected < 2) continue;
      for (let lane = 0; lane < 3; lane++) {
        points[lane].fromBufferAttribute(positions, vertices[lane]);
        node.applyBoneTransform(vertices[lane], points[lane]);
        node.localToWorld(points[lane]);
      }
      appendTriangle(surface, points[0].toArray(), points[1].toArray(), points[2].toArray());
    }
  });
  return surface;
}

function skinnedVisibleSurface(root) {
  const surface = { vertices: [], indices: [], maximumEdgeM: 0 };
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh) || !visible(node)) return;
    const positions = node.geometry.getAttribute("position");
    const indices = node.geometry.index;
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      for (let lane = 0; lane < 3; lane++) {
        const index = indices ? indices.getX(offset + lane) : offset + lane;
        points[lane].fromBufferAttribute(positions, index);
        node.applyBoneTransform(index, points[lane]);
        node.localToWorld(points[lane]);
      }
      appendTriangle(surface, points[0].toArray(), points[1].toArray(), points[2].toArray());
    }
  });
  return surface;
}

function skinnedDonorVertices(root, side) {
  const result = [];
  const rest = new THREE.Vector3();
  const posed = new THREE.Vector3();
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh) || !visible(node)) return;
    const positions = node.geometry.getAttribute("position");
    const skinIndices = node.geometry.getAttribute("skinIndex");
    const skinWeights = node.geometry.getAttribute("skinWeight");
    for (let index = 0; index < positions.count; index++) {
      const joints = [], weights = [];
      let donorWeight = 0;
      for (let lane = 0; lane < 4; lane++) {
        const joint = node.skeleton.bones[skinIndices.getComponent(index, lane)]?.name ?? "";
        const weight = skinWeights.getComponent(index, lane);
        joints.push(joint); weights.push(weight);
        if (joint === `Hand_${side.toUpperCase()}` || joint.endsWith(`_${side}`)
          && /^(thumb|index|middle|ring|little)_\d_/.test(joint)) donorWeight += weight;
      }
      if (donorWeight <= .5) continue;
      rest.fromBufferAttribute(positions, index);
      posed.copy(rest); node.applyBoneTransform(index, posed); node.localToWorld(posed);
      result.push({ mesh: node.name, vertex: index, joints, weights,
        rest: rest.toArray(), posed: posed.toArray() });
    }
  });
  return result;
}

function weaponSurfaces(root) {
  const surfaces = [];
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || !visible(node)) return;
    const names = [];
    for (let current = node; current && current !== root; current = current.parent) {
      names.unshift(current.name || current.type);
    }
    const surface = { name: node.name, path: names.join("/"), vertices: [], indices: [], maximumEdgeM: 0 };
    const positions = node.geometry.getAttribute("position");
    const indices = node.geometry.index;
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      for (let lane = 0; lane < 3; lane++) {
        const index = indices ? indices.getX(offset + lane) : offset + lane;
        points[lane].fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld);
      }
      appendTriangle(surface, points[0].toArray(), points[1].toArray(), points[2].toArray());
    }
    if (surface.indices.length) surfaces.push(surface);
  });
  return surfaces;
}

export function captureContactSample(key, hold, soldierRoot, weaponRoot) {
  return {
    key,
    hold,
    handSurfaces: {
      r: skinnedHandSurfaces(soldierRoot, "r"),
      l: skinnedHandSurfaces(soldierRoot, "l"),
    },
    armSurfaces: { r: skinnedArmSurface(soldierRoot, "r"), l: skinnedArmSurface(soldierRoot, "l") },
    bodySurface: skinnedVisibleSurface(soldierRoot),
    donorVertices: { r: skinnedDonorVertices(soldierRoot, "r"), l: skinnedDonorVertices(soldierRoot, "l") },
    weaponSurfaces: weaponSurfaces(weaponRoot),
  };
}
