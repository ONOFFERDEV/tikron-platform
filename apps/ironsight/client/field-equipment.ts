import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let radio: Promise<THREE.Group | undefined> | undefined;
let geometry: THREE.BufferGeometry | undefined;

/** Shared equipment is fetched only with actors, and prepared before play. */
export function loadFieldRadio(): Promise<THREE.Group | undefined> {
  return radio ??= new GLTFLoader().loadAsync('/assets/props/field-radio-pack.glb')
    .then(gltf => { geometry = prepareRadioGeometry(gltf.scene); return gltf.scene; })
    .catch(error => { console.warn('[field-equipment] Radio unavailable', error); return undefined; });
}

export function fieldRadioGeometry(): THREE.BufferGeometry | undefined { return geometry; }

/** The generated controls face -Z. Center in metres; operator-kit applies the
 * actual source rig's scale and complete inverse-bind transform exactly once. */
export function prepareRadioGeometry(asset: THREE.Object3D): THREE.BufferGeometry {
  asset.updateMatrixWorld(true);
  const mesh=asset.getObjectByProperty('isMesh',true) as THREE.Mesh | undefined;
  if (!mesh || !mesh.geometry.getAttribute('color')) throw Error('Radio requires baked vertex albedo');
  const part=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  part.applyMatrix4(mesh.matrixWorld);part.computeBoundingBox();
  const bounds=part.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  part.translate(-center.x,-center.y,-center.z);
  part.scale(.26/size.x,.46/size.y,.18/size.z);
  return part;
}

/** The source is a broad colour atlas. Downsample once at load, retaining its
 * UV layout and material parameters; never export a purchased derivative. */
export function prepareSoldierAtlas(root: THREE.Object3D): void {
  // Keep DOM globals out of the server-side rig audit's TypeScript context.
  const dom = globalThis as unknown as { document: { createElement(tag: 'canvas'): {
    width: number; height: number;
    getContext(type: '2d'): { drawImage(image: unknown, x: number, y: number, w: number, h: number): void } | null;
  } } };
  const maps = new Map<THREE.Texture, THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || !material.map) continue;
      const source = material.map;
      if (maps.has(source)) { material.map = maps.get(source)!; continue; }
      const image = source.image as { width: number; height: number };
      if (Math.max(image.width, image.height) <= 512) continue;
      const canvas = dom.document.createElement('canvas');
      const scale = 512 / Math.max(image.width, image.height);
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const texture = source.clone();
      texture.image = canvas;
      texture.name = 'soldier-field-atlas-512';
      texture.needsUpdate = true;
      maps.set(source, texture); material.map = texture;
    }
  });
  for (const source of maps.keys()) source.dispose();
}
