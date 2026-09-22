import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

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
  return new RoundedBoxGeometry(width, height, depth, 1, Math.min(width, height, depth) * .2);
}

function box(width: number, height: number, depth: number): THREE.BufferGeometry {
  const indexed = new THREE.BoxGeometry(width, height, depth);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  return geometry;
}

function roll(radius: number, length: number, open = false): THREE.BufferGeometry {
  const indexed = new THREE.CylinderGeometry(radius, radius, length, 12, 1, open);
  indexed.rotateZ(Math.PI / 2);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  return geometry;
}

function canteen(): THREE.BufferGeometry {
  const indexed = new THREE.SphereGeometry(1, 12, 8);
  indexed.scale(.064, .083, .032);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  return geometry;
}

function named(name: string, geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.name = name;
  return geometry;
}

function part(kind: FieldEquipmentKind, bone: string, center: readonly [number, number, number],
  tint: number, geometry: THREE.BufferGeometry): FieldEquipmentPart {
  return { kind, bone, center, tint, geometry };
}

/** Original late-war field kit. Closures share their load's bone; all geometry
 * joins the existing skin draw and is excluded from body hit claims. */
export function fieldEquipmentParts(kit: OperatorKit): readonly FieldEquipmentPart[] {
  const packX = kit === 'flanker' ? -.025 : kit === 'sniper' ? .025 : 0;
  const pouchY = kit === 'anchor' ? -.26 : -.28;
  const canteenX = kit === 'sniper' ? -.22 : .22;
  const parts: FieldEquipmentPart[] = [
    part('webbing', 'spine_03', [-.12, -.08, .155], .54, box(.035, .55, .025)),
    part('webbing', 'spine_03', [.12, -.08, .155], .54, box(.035, .55, .025)),
    part('webbing', 'spine_02', [0, -.27, .16], .48, box(.34, .035, .025)),
    part('pack', 'spine_02', [packX, -.17, -.17], .4,
      named('pack-body', roundedBox(.28, .30, .13))),
    part('pack', 'spine_02', [packX, -.071, -.242], .54,
      named('pack-flap', roundedBox(.275, .095, .019))),
    part('blanket-roll', 'spine_02', [packX, -.397, -.18], .72,
      named('blanket-roll-body', roll(.063, .34))),
    part('canteen', 'spine_02', [canteenX, -.39, -.045], .36,
      named('canteen-body', canteen())),
    part('canteen', 'spine_02', [canteenX, -.296, -.045], .12,
      named('canteen-cap', roll(.018, .03).rotateZ(-Math.PI / 2))),
    part('canteen', 'spine_02', [canteenX, -.31, -.005], .18, box(.018, .14, .008)),
    part('canteen', 'spine_02', [canteenX, -.40, -.01], .18, box(.09, .018, .008)),
  ];
  for (const x of [-.105, 0, .105]) {
    parts.push(part('ammunition-pouches', 'spine_02', [x, pouchY, .187], .34, roundedBox(.086, .12, .062)));
    parts.push(part('ammunition-pouches', 'spine_02', [x, pouchY + .033, .221], .52,
      box(.082, .046, .009).rotateX(-.12)));
    parts.push(part('ammunition-pouches', 'spine_02', [x, pouchY + .008, .229], .16, box(.018, .048, .007)));
  }
  for (const side of [-1, 1]) {
    const x = packX + side * .086;
    parts.push(part('pack', 'spine_02', [x, -.182, -.242], .17, box(.023, .272, .01)));
    parts.push(part('pack', 'spine_02', [x, -.347, -.245], .17, box(.023, .074, .01)));
    parts.push(part('blanket-roll', 'spine_02', [x, -.397, -.18], .17, roll(.066, .024, true)));
    const seam = new THREE.TorusGeometry(.040, .003, 3, 12);
    seam.rotateY(Math.PI / 2);
    const seamGeometry = seam.toNonIndexed();
    seam.dispose();
    parts.push(part('blanket-roll', 'spine_02', [packX + side * .171, -.397, -.18], .42, seamGeometry));
    // Open buckle frames retain a visible strap through the centre.
    for (const edge of [-1, 1]) {
      parts.push(part('pack', 'spine_02', [x + edge * .014, -.15, -.249], .66, box(.005, .033, .004)));
      parts.push(part('pack', 'spine_02', [x, -.15 + edge * .014, -.249], .66, box(.023, .005, .004)));
    }
    if (kit === 'anchor') {
      parts.push(part('ammunition-pouches', 'spine_02', [side * .175, -.20, .12], .28, roundedBox(.07, .13, .055)));
      parts.push(part('ammunition-pouches', 'spine_02', [side * .175, -.16, .151], .48, box(.068, .043, .009)));
    }
  }
  // A rigid load follows the back's taper; translating it alone buries the top.
  const pivot = new THREE.Vector3(packX, -.02, -.105);
  const axis = new THREE.Vector3(1, 0, 0);
  return parts.map(equipment => {
    if (equipment.kind !== 'pack' && equipment.kind !== 'blanket-roll') return equipment;
    equipment.geometry.rotateX(-.25);
    const center = new THREE.Vector3(...equipment.center).sub(pivot).applyAxisAngle(axis, -.25).add(pivot);
    return { ...equipment, center: [center.x, center.y, center.z - .015] as const };
  });
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
