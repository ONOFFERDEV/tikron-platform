import * as T from 'three';

const SIZE = 128;
const TILE_METRES = 0.8;

/** Original periodic aggregate, generated once during loading. Small enough to
 * share across the entire Relay kit: two RGBA8 mip chains total 0.167 MiB. */
export function createConcreteDetail(): { normal: T.DataTexture; roughness: T.DataTexture } {
  let seed = 14071;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const height = new Float32Array(SIZE * SIZE);
  // Periodic value noise at three scales; wrapping the samples and derivatives
  // avoids a seam. No image, canvas, shader injection or frame-loop work.
  for (const [cells, weight] of [[8, 0.4], [32, 0.35], [64, 0.25]] as const) {
    const grid = Float32Array.from({ length: cells * cells }, random);
    const at = (x: number, y: number) => grid[(y % cells) * cells + x % cells]!;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const gx = x * cells / SIZE, gy = y * cells / SIZE;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const fx = gx - ix, fy = gy - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = T.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), u);
      const b = T.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u);
      const i = y * SIZE + x;
      height[i] = height[i]! + T.MathUtils.lerp(a, b, v) * weight;
    }
  }
  const normal = new Uint8Array(SIZE * SIZE * 4), roughness = new Uint8Array(normal.length);
  const at = (x: number, y: number) => height[((y + SIZE) % SIZE) * SIZE + (x + SIZE) % SIZE]!;
  const n = new T.Vector3();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    n.set((at(x - 1, y) - at(x + 1, y)) * 2.8,
      (at(x, y - 1) - at(x, y + 1)) * 2.8, 1).normalize();
    normal.set([Math.round((n.x * 0.5 + 0.5) * 255), Math.round((n.y * 0.5 + 0.5) * 255),
      Math.round((n.z * 0.5 + 0.5) * 255), 255], i);
    const r = Math.round((0.64 + at(x, y) * 0.36) * 255);
    roughness.set([r, r, r, 255], i);
  }
  const texture = (data: Uint8Array, name: string) => {
    const t = new T.DataTexture(data, SIZE, SIZE);
    t.name = name; t.channel = 2;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
    t.magFilter = T.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  return { normal: texture(normal, 'relay-concrete-normal'), roughness: texture(roughness, 'relay-concrete-roughness') };
}

/** Planar metric UVs in a separate channel: existing paint and baked AO UVs stay
 * untouched. Only use on the flat concrete kit, never smooth curved machinery. */
export function applyConcreteDetail(mesh: T.Mesh, detail: ReturnType<typeof createConcreteDetail>, strength = 0.2): void {
  const material = mesh.material;
  if (!(material instanceof T.MeshStandardMaterial)) return;
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  const p = new T.Vector3(), n = new T.Vector3(), normalMatrix = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(normal, i).applyNormalMatrix(normalMatrix);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const u = ay >= ax && ay >= az ? p.x : ax > az ? -p.z * Math.sign(n.x) : p.x * Math.sign(n.z);
    const v = ay >= ax && ay >= az ? -p.z * Math.sign(n.y) : p.y;
    uv[i * 2] = u / TILE_METRES; uv[i * 2 + 1] = v / TILE_METRES;
  }
  mesh.geometry.setAttribute('uv2', new T.BufferAttribute(uv, 2));
  material.normalMap = detail.normal; material.normalScale.set(strength, strength);
  material.roughnessMap = detail.roughness;
  material.needsUpdate = true;
}
