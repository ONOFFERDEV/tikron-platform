import * as T from 'three';

export interface RelayWeatherSource {
  position: T.BufferAttribute;
  index: T.BufferAttribute;
  parents: T.BufferAttribute;
}

/** Record each original kit face's real top/bottom once. Both triangles of an
 * axis-aligned vertical rectangle span the same heights. Split shared corners
 * so an adjacent panel cannot overwrite its neighbour's elevation. Positions,
 * normals, AO and the rendered triangle stream stay intact. */
export function applyRelayWeathering(mesh: T.Mesh, source?: RelayWeatherSource): void {
  if (mesh.geometry.index) {
    const original = mesh.geometry;
    mesh.geometry = original.toNonIndexed();
    original.dispose();
  }
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const elevation = new Float32Array(position.count * 2);
  if (source && source.parents.count * 3 !== position.count) throw Error('Relay weathering parent count mismatch');
  mesh.updateWorldMatrix(true, false);
  const world = new T.Vector3(), n = new T.Vector3(), firstNormal = new T.Vector3();
  for (let i = 0; i < position.count; i++) {
    world.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    elevation.set([world.y, world.y], i * 2);
  }
  for (let offset = 0; normal && offset + 2 < position.count; offset += 3) {
    const vertices = [offset, offset + 1, offset + 2];
    firstNormal.fromBufferAttribute(normal, vertices[0]!);
    if (vertices.some(i => n.fromBufferAttribute(normal, i).dot(firstNormal) < 0.9999)) continue;
    // weather-architecture.py subdivides the concrete for vertex AO/weathering.
    // Its retained parent triangles identify the actual ledge, rather than
    // mistaking every tessellation edge for a fresh source of rain streaks.
    const parent = source ? source.parents.getX(offset / 3) * 3 : offset;
    const points = [0, 1, 2].map(i => new T.Vector3().fromBufferAttribute(
      source?.position ?? position, source ? source.index.getX(parent + i) : parent + i).applyMatrix4(mesh.matrixWorld));
    const min = Math.min(...points.map(p => p.y)), max = Math.max(...points.map(p => p.y));
    for (const i of vertices) elevation.set([min, max], i * 2);
  }
  geometry.setAttribute('relayElevation', new T.BufferAttribute(elevation, 2));
}
