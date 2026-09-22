import * as T from 'three';
import type { Box } from '../src/physics.js';
import type { MapSurface, SurfaceBinding } from '../src/map/materials.js';
import type { FloorFace } from '../src/map/terrain.js';
import type { MapDef, RampDef } from '../src/map/types.js';

export type VisualSolid =
  | { readonly id: string; readonly kind: 'box'; readonly support: Box; readonly surface: MapSurface; readonly claddingOffsetM: number }
  | { readonly id: string; readonly kind: 'ramp'; readonly support: RampDef; readonly surface: MapSurface; readonly claddingOffsetM: number }
  | { readonly id: string; readonly kind: 'terrain'; readonly support: FloorFace; readonly surface: MapSurface; readonly claddingOffsetM: number };

export type VisualSolidErrorCode = 'unbacked_opaque_face' | 'cladding_offset';

export class VisualSolidError extends Error {
  override readonly name = 'VisualSolidError';

  constructor(readonly code: VisualSolidErrorCode, readonly solidId: string) {
    super(`${code}: ${solidId}`);
  }
}

function bindingSolid(binding: SurfaceBinding): VisualSolid {
  switch (binding.kind) {
    case 'box':
      return { id: binding.id, kind: binding.kind, support: binding.box, surface: binding.surface, claddingOffsetM: 0 };
    case 'ramp':
      return { id: binding.id, kind: binding.kind, support: binding.ramp, surface: binding.surface, claddingOffsetM: 0 };
    case 'terrain':
      return { id: binding.id, kind: binding.kind, support: binding.face, surface: binding.surface, claddingOffsetM: 0.012 };
  }
}

export function visualSolidPlan(map: MapDef): readonly VisualSolid[] {
  return (map.surfaceBindings ?? []).map(bindingSolid);
}

export function assertVisualSolids(map: MapDef, solids: readonly VisualSolid[]): void {
  for (const solid of solids) {
    const backed = solid.kind === 'box' ? map.boxes.includes(solid.support)
      : solid.kind === 'ramp' ? (map.ramps?.includes(solid.support) ?? false)
        : (map.terrain?.faces.includes(solid.support) ?? false);
    if (!backed) throw new VisualSolidError('unbacked_opaque_face', solid.id);
    if (!Number.isFinite(solid.claddingOffsetM) || solid.claddingOffsetM < 0 || solid.claddingOffsetM > 0.02)
      throw new VisualSolidError('cladding_offset', solid.id);
  }
}

export function mapVisualResourceTable(map: MapDef): {
  readonly presentation: MapDef['presentation'];
  readonly supports: number;
  readonly surfaces: readonly MapSurface[];
} {
  const plan = visualSolidPlan(map);
  assertVisualSolids(map, plan);
  return {
    presentation: map.presentation,
    supports: plan.length,
    surfaces: [...new Set(plan.map(({ surface }) => surface))].sort(),
  };
}

function opaqueMesh(node: T.Object3D): node is T.Mesh {
  if (!(node instanceof T.Mesh) || !node.visible) return false;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  return materials.some(material => material.visible && !material.transparent && material.opacity > 0);
}

function containsBounds(support: T.Box3, rendered: T.Box3): boolean {
  return support.containsBox(rendered);
}

function supportBounds(map: MapDef): readonly T.Box3[] {
  const boxes = map.boxes.map(box => new T.Box3(
    new T.Vector3(box.min.x, box.min.y, box.min.z),
    new T.Vector3(box.max.x, box.max.y, box.max.z),
  ));
  const ramps = (map.ramps ?? []).map(ramp => new T.Box3(
    new T.Vector3(ramp.minX, ramp.baseY ?? 0, ramp.minZ),
    new T.Vector3(ramp.maxX, ramp.topY, ramp.maxZ),
  ));
  const terrain = (map.terrain?.faces ?? []).map(face => new T.Box3(
    new T.Vector3(face.minX, face.y, face.minZ),
    new T.Vector3(face.maxX, face.y, face.maxZ),
  ));
  return [...boxes, ...ramps, ...terrain].map(support => support.expandByScalar(0.02001));
}

function unionContains(supports: readonly T.Box3[], rendered: T.Box3): boolean {
  const candidates = supports.filter(support => support.intersectsBox(rendered));
  if (candidates.some(support => containsBounds(support, rendered))) return true;
  const cells = (minimum: number, maximum: number, edges: readonly number[]): readonly number[] => {
    const boundaries = [...new Set([minimum, maximum, ...edges.filter(edge => edge > minimum && edge < maximum)])].sort((a, b) => a - b);
    return boundaries.slice(1).map((edge, index) => ((boundaries[index] ?? minimum) + edge) / 2);
  };
  const xs = cells(rendered.min.x, rendered.max.x, candidates.flatMap(support => [support.min.x, support.max.x]));
  const ys = cells(rendered.min.y, rendered.max.y, candidates.flatMap(support => [support.min.y, support.max.y]));
  const zs = cells(rendered.min.z, rendered.max.z, candidates.flatMap(support => [support.min.z, support.max.z]));
  const point = new T.Vector3();
  return xs.every(x => ys.every(y => zs.every(z => {
    point.set(x, y, z);
    return candidates.some(support => support.containsPoint(point));
  })));
}

export function assertVisualScene(map: MapDef, root: T.Object3D): {
  readonly opaqueInstances: number;
  readonly backedInstances: number;
  readonly exteriorInstances: number;
} {
  root.updateMatrixWorld(true);
  const supports = supportBounds(map);
  let opaqueInstances = 0;
  let backedInstances = 0;
  let exteriorInstances = 0;
  root.traverse(node => {
    if (!opaqueMesh(node) || node.userData.siteGround === true) return;
    node.geometry.computeBoundingBox();
    const local = node.geometry.boundingBox;
    if (local === null) return;
    const count = node instanceof T.InstancedMesh ? node.count : 1;
    for (let index = 0; index < count; index++) {
      const matrix = node.matrixWorld.clone();
      if (node instanceof T.InstancedMesh) {
        const instance = new T.Matrix4();
        node.getMatrixAt(index, instance);
        matrix.multiply(instance);
      }
      const rendered = local.clone().applyMatrix4(matrix);
      opaqueInstances++;
      const exterior = rendered.max.x <= 0.02 || rendered.min.x >= map.bounds.width - 0.02
        || rendered.max.z <= 0.02 || rendered.min.z >= map.bounds.depth - 0.02;
      if (exterior) {
        exteriorInstances++;
        continue;
      }
      if (unionContains(supports, rendered)) {
        backedInstances++;
        continue;
      }
      const meshName = node.name || `mesh-${node.id}`;
      const extent = `${rendered.min.toArray().map(value => value.toFixed(3)).join(',')}/${rendered.max.toArray().map(value => value.toFixed(3)).join(',')}`;
      const instanceName = `${meshName}[${index}]@${extent}`;
      throw new VisualSolidError('unbacked_opaque_face', node instanceof T.InstancedMesh ? instanceName : meshName);
    }
  });
  return { opaqueInstances, backedInstances, exteriorInstances };
}

export function applyArchitectureLoadResult(
  scene: T.Scene,
  fallback: readonly T.Mesh[],
  result: PromiseSettledResult<T.Object3D>,
): 'loaded' | 'fallback' {
  if (result.status === 'rejected') return 'fallback';
  let hasOpaqueGeometry = false;
  result.value.traverse(node => { if (opaqueMesh(node)) hasOpaqueGeometry = true; });
  if (!hasOpaqueGeometry) return 'fallback';
  scene.add(result.value);
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  for (const mesh of fallback) {
    mesh.removeFromParent();
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  }
  scene.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    geometries.delete(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.delete(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  return 'loaded';
}

/** Same selection for the offline bake and runtime replacement. Never includes
 * purchased dressing, signs, ground (including untextured aprons), emissive strips
 * or fallback skyline. Ground is not exported in bakeOnly and must survive loading. */
export function architectureMeshes(root: T.Object3D): T.Mesh[] {
  const meshes: T.Mesh[] = [];
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || node.userData.siteGround === true || node.userData.architectureExclude === true ||
        !(node.material instanceof T.MeshStandardMaterial) || node.material.map) return;
    for (let p: T.Object3D | null = node; p; p = p.parent)
      if (p.name === 'relay-skyline-fallback') return;
    meshes.push(node);
  });
  return meshes;
}
