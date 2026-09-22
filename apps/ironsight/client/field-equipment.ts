import * as THREE from 'three';

export type OperatorKit = 'anchor' | 'flanker' | 'sniper';
export type FieldEquipmentKind = 'webbing' | 'ammunition-pouches' | 'canteen' | 'pack' | 'blanket-roll';

export type FieldEquipmentPart = {
  readonly kind: FieldEquipmentKind;
  readonly bone: string;
  readonly center: readonly [number, number, number];
  readonly tint: number;
  readonly geometry: THREE.BufferGeometry;
};

function roundedBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth, 2, 2, 2);
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
    const crease = 0.018 * Math.min(width, height) / Math.max(0.001, Math.hypot(x, y, z));
    position.setXYZ(index, x * (1 - crease), y * (1 - crease), z * (1 - crease));
  }
  geometry.computeVertexNormals();
  return geometry.toNonIndexed();
}

function roll(radius: number, length: number): THREE.BufferGeometry {
  const indexed = new THREE.CylinderGeometry(radius, radius * 0.94, length, 12, 3);
  indexed.rotateZ(Math.PI / 2);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  return geometry;
}

function canteen(): THREE.BufferGeometry {
  const indexed = new THREE.CylinderGeometry(0.065, 0.072, 0.15, 12, 3);
  indexed.rotateX(Math.PI / 2);
  indexed.scale(1, 1.12, 0.43);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  return geometry;
}

function part(kind: FieldEquipmentKind, bone: string, center: readonly [number, number, number],
  tint: number, geometry: THREE.BufferGeometry): FieldEquipmentPart {
  return { kind, bone, center, tint, geometry };
}

/** Original late-war field kit. Every role carries the same required equipment;
 * placement changes silhouette only and never grants mechanics or hit volume. */
export function fieldEquipmentParts(kit: OperatorKit): readonly FieldEquipmentPart[] {
  const packX = kit === 'flanker' ? -0.035 : kit === 'sniper' ? 0.04 : 0;
  const pouchY = kit === 'anchor' ? -0.23 : -0.26;
  const parts: FieldEquipmentPart[] = [
    part('webbing', 'spine_03', [-0.12, -0.08, 0.155], 0.54, roundedBox(0.035, 0.55, 0.025)),
    part('webbing', 'spine_03', [0.12, -0.08, 0.155], 0.54, roundedBox(0.035, 0.55, 0.025)),
    part('webbing', 'spine_02', [0, -0.27, 0.16], 0.48, roundedBox(0.31, 0.035, 0.025)),
    part('ammunition-pouches', 'spine_02', [-0.105, pouchY, 0.185], 0.28, roundedBox(0.085, 0.12, 0.055)),
    part('ammunition-pouches', 'spine_02', [0, pouchY, 0.19], 0.28, roundedBox(0.085, 0.12, 0.055)),
    part('ammunition-pouches', 'spine_02', [0.105, pouchY, 0.185], 0.28, roundedBox(0.085, 0.12, 0.055)),
    part('pack', 'spine_03', [packX, -0.09, -0.15], 0.4, roundedBox(0.32, 0.34, 0.105)),
    part('blanket-roll', 'spine_03', [packX, 0.105, -0.185], 0.72, roll(0.065, 0.35)),
    part('canteen', 'spine_02', [kit === 'sniper' ? -0.18 : 0.18, -0.42, -0.055], 0.18, canteen()),
  ];
  if (kit === 'anchor') {
    parts.push(part('ammunition-pouches', 'spine_02', [-0.175, -0.18, 0.12], 0.24, roundedBox(0.075, 0.14, 0.05)));
    parts.push(part('ammunition-pouches', 'spine_02', [0.175, -0.18, 0.12], 0.24, roundedBox(0.075, 0.14, 0.05)));
  }
  return parts;
}

/** Compatibility hook for rig-loader. Individual modern radios were removed. */
export async function loadFieldRadio(): Promise<THREE.Group | undefined> { return undefined; }
export function fieldRadioGeometry(): THREE.BufferGeometry | undefined { return undefined; }

const EQUIPMENT_MATERIAL_NAMES = ['field-kit', 'aged-leather', 'blanket', 'canvas', 'helmet', 'collar'] as const;

function isEquipmentMaterial(material: THREE.Material): boolean {
  return EQUIPMENT_MATERIAL_NAMES.some(name => material.name.includes(name));
}

export function prepareSoldierAtlas(root: THREE.Object3D): void {
  const dom = globalThis as unknown as { document?: { createElement(tag: 'canvas'): {
    width: number; height: number;
    getContext(type: '2d'): { drawImage(image: unknown, x: number, y: number, w: number, h: number): void } | null;
  } } };
  const maps = new Map<THREE.Texture, THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const equipmentIndices = new Set(materials.flatMap((material, index) => isEquipmentMaterial(material) ? [index] : []));
    if (equipmentIndices.size > 0 && node.userData.fieldEquipmentRaycast !== true) {
      node.userData.fieldEquipment = true;
      node.userData.fieldEquipmentRaycast = true;
      const visualRaycast = node.raycast.bind(node);
      node.raycast = (raycaster, intersections) => {
        const first = intersections.length;
        visualRaycast(raycaster, intersections);
        for (let index = intersections.length - 1; index >= first; index -= 1) {
          const materialIndex = intersections[index]?.face?.materialIndex;
          if (materialIndex !== undefined && equipmentIndices.has(materialIndex)) intersections.splice(index, 1);
        }
      };
    }
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || !material.map) continue;
      const source = material.map, image = source.image as { width?: number; height?: number };
      const width = image.width ?? 0, height = image.height ?? 0;
      if (Math.max(width, height) <= 512) continue;
      let texture = maps.get(source);
      if (!texture) {
        if (!dom.document) continue;
        const canvas = dom.document.createElement('canvas'), scale = 512 / Math.max(width, height);
        canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
        const context = canvas.getContext('2d');
        if (!context) continue;
        context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
        texture = source.clone(); texture.image = canvas; texture.name = 'soldier-field-atlas-512'; texture.needsUpdate = true;
        maps.set(source, texture);
      }
      material.map = texture;
    }
  });
}
