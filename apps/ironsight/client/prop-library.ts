import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface PropDefinition {
  readonly url: `/assets/props/${string}.glb`;
  /** Exact intended envelope [width, height, depth], in metres, before placement yaw. */
  readonly sizeM: readonly [number, number, number];
  readonly origin: 'base-centre';
  readonly category: 'equipment' | 'supplies' | 'machinery';
  /** Visual placement guidance only. The authoritative map must supply all collision. */
  readonly placement: string;
  readonly triangles: number;
  readonly bytes: number;
  /** Rotate the source before fitting its envelope; glTF and the returned group are Y-up. */
  readonly sourceYaw?: number;
}

/** Data only: importing the registry never fetches an asset or allocates GPU resources. */
export const PROP_LIBRARY = {
  'field-radio-pack': {
    url: '/assets/props/field-radio-pack.glb', sizeM: [.26, .46, .18], origin: 'base-centre',
    category: 'equipment', triangles: 1895, bytes: 260176,
    placement: 'Issued radio, controls face -Z. Rig attachment and team readability need a separate fitting pass.',
  },
  'relay-field-sandbags': {
    url: '/assets/props/relay-field-sandbags.glb', sizeM: [.67, .235, .44], origin: 'base-centre',
    category: 'supplies', triangles: 1043, bytes: 83456, sourceYaw: Math.PI / 2,
    placement: 'One filled sack, long axis X. Assemble only against matching solid cover or outside play.',
  },
  'field-chest-panel': {
    url: '/assets/props/field-chest-panel.glb', sizeM: [.510897, .48, .382378], origin: 'base-centre',
    category: 'equipment', triangles: 3550, bytes: 229180,
    placement: 'Source name retained: this is a full hollow chest rig, pouches face +Z. Static supply dressing only; not a flat skinned attachment.',
  },
  'ammo-crate-stack': {
    url: '/assets/props/ammo-crate-stack.glb', sizeM: [.531171, 1.15, .598316], origin: 'base-centre',
    category: 'supplies', triangles: 2840, bytes: 238624,
    placement: 'Three closed issued crates, long vertical axis Y. Outside play or fitted against matching authoritative cover.',
  },
  'relay-uplink': {
    url: '/assets/props/relay-uplink.glb', sizeM: [7, 8.86056, 2.69281], origin: 'base-centre',
    category: 'machinery', triangles: 2827, bytes: 279624,
    placement: 'Legacy communications landmark. Keep its entire envelope beyond the movement boundary.',
  },
  'switchyard-transformer': {
    url: '/assets/props/switchyard-transformer.glb', sizeM: [7, 5.00102, 3.42663], origin: 'base-centre',
    category: 'machinery', triangles: 2599, bytes: 243392,
    placement: 'Legacy power landmark. Keep its entire envelope beyond the movement boundary.',
  },
} as const satisfies Record<string, PropDefinition>;

export type PropName = keyof typeof PROP_LIBRARY;

export interface PropLibrary {
  /** Load during map preparation, before shader/texture warm-up. Each call returns a new transform hierarchy. */
  load(name: PropName): Promise<THREE.Group>;
  /** Remove instances from the scene first. Frees this library's shared geometry, materials and textures. */
  dispose(): void;
}

function disposeTemplate(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

/** One library per map lifetime. Concurrent loads share a template; failed loads can be retried.
 * Instances share immutable materials/geometries. Clone a material before customising it.
 * This module never adds lights, collision or objects to the scene on the caller's behalf.
 */
export function createPropLibrary(): PropLibrary {
  const templates = new Map<PropName, Promise<THREE.Group>>();
  const resident = new Set<THREE.Group>();
  let disposed = false;

  function template(name: PropName): Promise<THREE.Group> {
    const cached = templates.get(name);
    if (cached) return cached;
    const definition: PropDefinition = PROP_LIBRARY[name];
    const pending = new GLTFLoader().loadAsync(definition.url).then(gltf => {
      const root = new THREE.Group();
      root.name = `prop:${name}`;
      root.userData.propName = name;
      root.userData.sizeM = [...definition.sizeM];
      const oriented = new THREE.Group();
      oriented.rotation.y = definition.sourceYaw ?? 0;
      oriented.add(gltf.scene);
      root.add(oriented);
      try {
        if (disposed) throw Error('Prop library has been disposed');
        const bounds = new THREE.Box3().setFromObject(oriented, true);
        const size = bounds.getSize(new THREE.Vector3());
        if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0))
          throw Error(`Invalid bounds for prop ${name}`);
        const centre = bounds.getCenter(new THREE.Vector3());
        // A separate parent keeps source rotations/node transforms intact.
        const fit = new THREE.Group();
        fit.scale.set(definition.sizeM[0] / size.x, definition.sizeM[1] / size.y, definition.sizeM[2] / size.z);
        fit.position.set(-centre.x * fit.scale.x, -bounds.min.y * fit.scale.y, -centre.z * fit.scale.z);
        root.add(fit);
        fit.add(oriented);
        root.updateMatrixWorld(true);
        resident.add(root);
        return root;
      } catch (error) {
        disposeTemplate(root);
        throw error;
      }
    }).catch(error => { templates.delete(name); throw error; });
    templates.set(name, pending);
    return pending;
  }

  return {
    async load(name) {
      if (disposed) throw Error('Prop library has been disposed');
      if (!Object.hasOwn(PROP_LIBRARY, name)) throw Error(`Unknown prop: ${name}`);
      const source = await template(name);
      if (disposed) throw Error('Prop library has been disposed');
      return source.clone(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const root of resident) disposeTemplate(root);
      resident.clear();
      templates.clear();
    },
  };
}
