import * as T from 'three';
/** Isolates the private AR drum using an authored selection volume in grip
 * space. Cached geometry stays immutable; dispose the owned copies on swap. */
export function splitRifleMagazine(object: T.Object3D): { magazine: T.Group; bolt: T.Group; owned: T.BufferGeometry[] } {
  object.updateMatrixWorld(true);
  const magazine = new T.Group(); magazine.name = 'rifle-magazine';
  const bolt = new T.Group(); bolt.name = 'rifle-bolt';
  const owned: T.BufferGeometry[] = [];
  const p = new T.Vector3();
  object.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.geometry.index) return;
    const source = node.geometry, positions = source.getAttribute('position');
    const index = source.index!;
    // Weld positions across UV/normal seams, then keep whole connected parts.
    const parents = Array.from({ length: positions.count }, (_, i) => i), vertices = new Map<string, number>();
    const find = (vertex: number): number => {
      let i = vertex;
      while (parents[i] !== i) { parents[i] = parents[parents[i]!]!; i = parents[i]!; }
      return i;
    };
    const union = (a: number, b: number): void => { parents[find(a)] = find(b); };
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i);
      const key = p.toArray().map(v => v.toFixed(5)).join(','), previous = vertices.get(key);
      if (previous !== undefined) union(i, previous); else vertices.set(key, i);
    }
    for (let i = 0; i < index.count; i += 3) {
      union(index.getX(i), index.getX(i + 1)); union(index.getX(i), index.getX(i + 2));
    }
    const parts = new Map<number, { bounds: T.Box3; indices: number[] }>();
    for (let i = 0; i < index.count; i++) {
      const vertex = index.getX(i), key = find(vertex);
      let part = parts.get(key);
      if (!part) { part = { bounds: new T.Box3(), indices: [] }; parts.set(key, part); }
      part.indices.push(vertex); part.bounds.expandByPoint(p.fromBufferAttribute(positions, vertex).applyMatrix4(node.matrixWorld));
    }
    const keep: number[] = [], drum: number[] = [], handle: number[] = [];
    for (const { bounds: b, indices } of parts.values()) {
      const target = b.min.z > 0.10 && b.max.z < 0.26 && b.max.y < 0.03 ? drum
        : b.min.x < -0.05 && b.max.x < 0 && b.min.y > 0.05 && b.max.z < 0.03 ? handle : keep;
      target.push(...indices);
    }
    if (!drum.length || !handle.length) return;
    const body = source.clone().setIndex(keep); owned.push(body); node.geometry = body;
    for (const [indices, group] of [[drum, magazine], [handle, bolt]] as const) {
      const geometry = source.clone().setIndex(indices); owned.push(geometry);
      const mesh = new T.Mesh(geometry, node.material); mesh.applyMatrix4(node.matrixWorld); group.add(mesh);
    }
  });
  object.add(magazine, bolt);
  return { magazine, bolt, owned };
}
