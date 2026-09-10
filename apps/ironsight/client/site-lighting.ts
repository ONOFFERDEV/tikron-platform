import * as T from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyConcreteDetail, createConcreteDetail } from './concrete-detail.js';
import { finishRelaySurface } from './relay-surfaces.js';
import { finishUndertowSurface } from './undertow-surfaces.js';
import { applySwitchyardPanels, finishSwitchyardSurface, switchyardSurfaceKind } from './switchyard-surfaces.js';
import { waitForSiteGround } from './site-ground.js';
import { UNDERTOW_DUSK } from './site-atmosphere.js';

/** Decode AO to a single-channel data texture once: 1.33 MiB including mips,
 * rather than a 5.33 MiB RGBA allocation. No extra shader/pass is introduced. */
export async function loadArchitecture(scene: T.Scene, name: string, fallback: T.Mesh[]): Promise<void> {
  const [gltf] = await Promise.all([
    new GLTFLoader().loadAsync(`/assets/maps/${name}-architecture.glb`), waitForSiteGround(scene),
  ]);
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
  if (name === 'relay' || name === 'undertow' || name === 'switchyard') {
    const relay = name === 'relay', undertow = name === 'undertow', switchyard = name === 'switchyard';
    const detail = createConcreteDetail(true);
    gltf.scene.traverse(node => {
      if (node instanceof T.Mesh && node.material instanceof T.MeshStandardMaterial) {
        if (switchyard) {
          const kind = switchyardSurfaceKind(node.material.name);
          applyConcreteDetail(node, detail, kind === 'concrete' ? 0.085 : kind === 'coated' ? 0.022 : 0.025);
          if (kind !== 'concrete') applySwitchyardPanels(node);
          if (kind === 'steel') node.material.roughness = 0.66;
          if (kind === 'deck') { node.material.roughness = 0.72; node.material.metalness = 0.42; }
          finishSwitchyardSurface(node.material, kind);
          return;
        }
        const concrete = node.material.metalness < 0.1 && node.material.roughness >= 0.9;
        // The baked Undertow kit batches by authored material, including ramp
        // variants 6-9. Pale caps and coloured plant trim are coated, not concrete.
        const wetConcrete = undertow && /^undertow-(0|5|[6-9])$/.test(node.material.name);
        applyConcreteDetail(node, detail, undertow ? wetConcrete ? 0.085 : 0.035 : concrete ? 0.22 : 0.07);
        if (relay) finishRelaySurface(node.material, concrete ? 'concrete' : 'coated');
        if (undertow) finishUndertowSurface(node.material, wetConcrete ? 'concrete' : 'coated');
      }
    });
    for (const floorName of [`${name}-ground`, `${name}-apron`]) {
      const floor = scene.getObjectByName(floorName);
      if (floor instanceof T.Mesh) {
        applyConcreteDetail(floor, detail, relay ? 0.15 : 0.10);
        if (switchyard && floor.material instanceof T.MeshStandardMaterial) {
          finishSwitchyardSurface(floor.material, floorName.endsWith('-ground') ? 'ground' : 'apron');
          continue;
        }
        if (undertow && floor.material instanceof T.MeshStandardMaterial) {
          finishUndertowSurface(floor.material, floorName.endsWith('-ground') ? 'ground' : 'apron');
          continue;
        }
        if (relay && floor.material instanceof T.MeshStandardMaterial) {
          finishRelaySurface(floor.material, floorName.endsWith('-ground') ? 'ground' : 'apron');
          continue;
        }
      }
    }
  }
}

export async function loadSiteEnvironment(scene: T.Scene, renderer: T.WebGLRenderer, site: string): Promise<void> {
  const dusk = site === 'undertow' ? UNDERTOW_DUSK : null;
  const path = dusk?.environment ?? '/assets/industrial-daylight.hdr';
  const started = performance.now();
  const [radianceResult, skyResult] = await Promise.allSettled([
    new RGBELoader().loadAsync(path),
    dusk ? new T.TextureLoader().loadAsync(dusk.sky) : Promise.resolve(null),
  ]);
  if (radianceResult.status === 'rejected' || skyResult.status === 'rejected') {
    if (radianceResult.status === 'fulfilled') radianceResult.value.dispose();
    if (skyResult.status === 'fulfilled') skyResult.value?.dispose();
    throw radianceResult.status === 'rejected' ? radianceResult.reason :
      (skyResult as PromiseRejectedResult).reason;
  }
  const source = radianceResult.value, skyTexture = skyResult.value;
  const loaded = performance.now();
  const pmrem = new T.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(source);
  scene.environment = target.texture;
  scene.environmentIntensity = dusk?.environmentIntensity ?? 0.85;
  scene.traverse(node => { if (node instanceof T.HemisphereLight) node.intensity = dusk?.hemisphereIntensity ?? 0.65; });
  const sky = scene.getObjectByName('site-sky');
  if (skyTexture && sky instanceof T.Mesh && sky.material instanceof T.ShaderMaterial) {
    skyTexture.name = 'undertow-dusk-sky';
    skyTexture.colorSpace = T.SRGBColorSpace;
    skyTexture.wrapS = T.RepeatWrapping;
    skyTexture.generateMipmaps = false;
    skyTexture.minFilter = T.LinearFilter;
    sky.material.uniforms.skyRadiance!.value = skyTexture;
    sky.material.uniforms.skyReady!.value = 1;
  } else skyTexture?.dispose();
  source.dispose();
  pmrem.dispose();
  scene.userData.siteEnvironment = { path, loadMs: loaded - started,
    preparationMs: performance.now() - loaded, pmremGenerations: 1 };
}
