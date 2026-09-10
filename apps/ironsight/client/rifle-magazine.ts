import * as T from 'three';
const insertMaterial = new T.MeshStandardMaterial({ color: 0x263033, roughness: 0.72, metalness: 0.3 });
/** Select whole connected magazine/charge parts in each weapon's grip space.
 * Cached geometry stays immutable; only runtime copies move and are disposed.
 * The energy-shotgun receiver uses a side cell; pistol uses an original insert. */
export function splitRifleMagazine(object: T.Object3D, weapon = 0): { magazine: T.Group; bolt: T.Group; owned: T.BufferGeometry[] } {
  object.updateMatrixWorld(true);
  const magazine = new T.Group(); magazine.name = 'rifle-magazine';
  const bolt = new T.Group(); bolt.name = 'rifle-bolt';
  const owned: T.BufferGeometry[] = [];
  // Generated weapons are cut/capped offline. Reparent each authored part in
  // root space; templates share immutable geometry and own only transforms.
  const authoredMagazine = object.getObjectByName('field-magazine');
  const authoredBolt = object.getObjectByName('field-bolt');
  if (object.userData.issuedCarbine && authoredMagazine && authoredBolt) {
    object.add(magazine, bolt);
    magazine.attach(authoredMagazine); bolt.attach(authoredBolt);
    return { magazine, bolt, owned };
  }
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
      const isMagazine = weapon === 0 ? b.min.z > 0.10 && b.max.z < 0.26 && b.max.y < 0.03
        : weapon === 1 ? b.min.z > 0.12 && b.max.z < 0.23 && b.max.y < 0.025 && b.min.y < -0.15
        : weapon === 2 ? b.min.z > -0.11 && b.max.z < 0.02 && b.min.y > -0.07 && b.max.y < 0.07
        : weapon === 3 ? b.min.z > 0.15 && b.max.z < 0.26 && b.max.y < -0.02 : false;
      const isBolt = weapon === 4 ? b.min.z > -0.06 && b.max.z > 0.28 && b.min.y > -0.01 && b.max.y < 0.13
        : b.min.x < -0.045 && b.max.x < 0 && b.min.y > (weapon === 3 ? 0 : 0.05) && b.max.z < (weapon === 0 ? 0.03 : 0.09);
      const target = isMagazine ? drum : isBolt ? handle : keep;
      target.push(...indices);
    }
    if (!drum.length && !handle.length) return;
    const body = source.clone().setIndex(keep); owned.push(body); node.geometry = body;
    for (const [indices, group] of [[drum, magazine], [handle, bolt]] as const) {
      if (!indices.length) continue;
      const geometry = source.clone().setIndex(indices); owned.push(geometry);
      const mesh = new T.Mesh(geometry, node.material); mesh.applyMatrix4(node.matrixWorld); group.add(mesh);
    }
  });
  if (weapon === 4) {
    // Original insert inside the integrated pistol grip; the source frame stays
    // intact. Its base follows the same extraction/seat timeline as the hand.
    const geometry = new T.BoxGeometry(0.028, 0.10, 0.055).translate(0, -0.105, -0.045);
    owned.push(geometry); magazine.add(new T.Mesh(geometry, insertMaterial));
  }
  object.add(magazine, bolt);
  return { magazine, bolt, owned };
}
