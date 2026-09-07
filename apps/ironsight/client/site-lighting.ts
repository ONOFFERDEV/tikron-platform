import * as T from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Decode AO to a single-channel data texture once: 1.33 MiB including mips,
 * rather than a 5.33 MiB RGBA allocation. No extra shader/pass is introduced. */
export async function loadArchitecture(scene: T.Scene, name: string, fallback: T.Mesh[]): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync(`/assets/maps/${name}-architecture.glb`);
  let ao: T.DataTexture | undefined;
  const sourceTextures = new Set<T.Texture>();
  gltf.scene.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    node.castShadow = true; node.receiveShadow = true;
    const material = node.material as T.MeshStandardMaterial;
    if (material.aoMap) {
      const source = material.aoMap;
      sourceTextures.add(source);
      if (!ao) {
        const image = source.image as ImageBitmap;
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const red = new Uint8Array(canvas.width * canvas.height);
        for (let i = 0; i < red.length; i++) red[i] = rgba[i * 4]!;
        ao = new T.DataTexture(red, canvas.width, canvas.height, T.RedFormat);
        ao.generateMipmaps = true; ao.minFilter = T.LinearMipmapLinearFilter;
        ao.magFilter = T.LinearFilter; ao.needsUpdate = true;
      }
      material.aoMap = ao;
      material.aoMapIntensity = 0.75;
    }
  });
  scene.add(gltf.scene);
  // All geometry in this list is original. Shared emissive materials survive.
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  for (const mesh of fallback) {
    mesh.removeFromParent(); geometries.add(mesh.geometry);
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(mat);
  }
  scene.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    geometries.delete(node.geometry);
    for (const mat of Array.isArray(node.material) ? node.material : [node.material]) materials.delete(mat);
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  sourceTextures.forEach(t => { t.dispose(); (t.image as ImageBitmap).close?.(); });
}

export async function loadSiteEnvironment(scene: T.Scene, renderer: T.WebGLRenderer): Promise<void> {
  const source = await new RGBELoader().loadAsync('/assets/industrial-daylight.hdr');
  const pmrem = new T.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(source);
  scene.environment = target.texture;
  scene.environmentIntensity = 0.85;
  scene.traverse(node => { if (node instanceof T.HemisphereLight) node.intensity = 0.65; });
  source.dispose(); pmrem.dispose();
}
