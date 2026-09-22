import * as THREE from 'three';
import { botRole } from '../src/bot-roles.js';
import { fieldEquipmentParts, type OperatorKit } from './field-equipment.js';

export { type OperatorKit } from './field-equipment.js';

export function operatorKit(id: string): OperatorKit {
  const role = botRole(id);
  return role === 'rusher' ? 'flanker' : role ?? 'anchor';
}

const cache = new WeakMap<THREE.BufferGeometry, Map<OperatorKit, THREE.BufferGeometry>>();
const point = new THREE.Vector3();

export function fitOperatorKit(root: THREE.Object3D, kit: OperatorKit): void {
  root.updateMatrixWorld(true);
  const mesh = root.getObjectByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh | undefined;
  if (!mesh || !mesh.skeleton.bones.some(bone => bone.name === 'spine_03')) return;
  const source = mesh.geometry;
  let variants = cache.get(source);
  if (!variants) { variants = new Map(); cache.set(source, variants); }
  let geometry = variants.get(kit);
  if (!geometry) { geometry = buildKit(mesh, kit); variants.set(kit, geometry); }
  mesh.geometry = geometry;
  mesh.userData.operatorKit = kit;
  mesh.raycast = function raycastWithoutEquipment(raycaster, hits) {
    const firstHit = hits.length;
    THREE.SkinnedMesh.prototype.raycast.call(this, raycaster, hits);
    const firstEquipmentTriangle = Number(this.geometry.userData.equipmentStartTriangle);
    for (let index = hits.length - 1; index >= firstHit; index -= 1) {
      if ((hits[index]!.faceIndex ?? -1) >= firstEquipmentTriangle) hits.splice(index, 1);
    }
  };
}

function buildKit(mesh: THREE.SkinnedMesh, kit: OperatorKit): THREE.BufferGeometry {
  const source = mesh.geometry, positions = source.getAttribute('position');
  const sourceIndices = source.index ? Array.from(source.index.array) : Array.from({ length: positions.count }, (_, index) => index);
  const indices = [...sourceIndices];
  const attributes = new Map<string, { readonly size: number; readonly values: number[] }>();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values: number[] = [];
    for (let vertex = 0; vertex < attribute.count; vertex += 1) {
      for (let lane = 0; lane < attribute.itemSize; lane += 1) values.push(attribute.getComponent(vertex, lane));
    }
    attributes.set(name, { size: attribute.itemSize, values });
  }
  const fieldKit = Array.from({ length: positions.count }, () => [0, 0.84, 0.96, 0]).flat();
  const fieldPosition: number[] = [];
  const bones = mesh.skeleton.bones, box = new THREE.Box3().setFromObject(mesh);
  const unit = (box.max.y - box.min.y) / 1.8;
  const chest = bones.find(bone => bone.name === 'spine_03')!.getWorldPosition(new THREE.Vector3());
  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
    fieldPosition.push((point.x - chest.x) / unit, (point.y - box.min.y) / unit, (point.z - chest.z) / unit);
  }
  const equipmentStartTriangle = indices.length / 3;
  const equipmentKinds = new Set<string>();
  for (const equipment of fieldEquipmentParts(kit)) {
    equipmentKinds.add(equipment.kind);
    const boneIndex = bones.findIndex(bone => bone.name === equipment.bone);
    if (boneIndex < 0) { equipment.geometry.dispose(); continue; }
    const inverse = mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse)
      .multiply(bones[boneIndex]!.matrixWorld).multiply(mesh.skeleton.boneInverses[boneIndex]!)
      .multiply(mesh.bindMatrix).invert();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(inverse);
    const partPositions = equipment.geometry.getAttribute('position');
    const partNormals = equipment.geometry.getAttribute('normal');
    const vertexStart = attributes.get('position')!.values.length / 3;
    const origin = new THREE.Vector3(
      chest.x + equipment.center[0] * unit,
      chest.y + equipment.center[1] * unit,
      chest.z + equipment.center[2] * unit,
    );
    for (let vertex = 0; vertex < partPositions.count; vertex += 1) {
      point.fromBufferAttribute(partPositions, vertex).multiplyScalar(unit).add(origin);
      fieldPosition.push((point.x - chest.x) / unit, (point.y - box.min.y) / unit, (point.z - chest.z) / unit);
      point.applyMatrix4(inverse);
      const localPosition = point.toArray();
      point.fromBufferAttribute(partNormals, vertex).applyNormalMatrix(normalMatrix);
      const localNormal = point.toArray();
      for (const [name, attribute] of attributes) {
        for (let lane = 0; lane < attribute.size; lane += 1) {
          attribute.values.push(name === 'position' ? localPosition[lane]! : name === 'normal' ? localNormal[lane]!
            : name === 'skinIndex' ? (lane === 0 ? boneIndex : 0) : name === 'skinWeight' ? (lane === 0 ? 1 : 0) : 0);
        }
      }
      fieldKit.push(1, equipment.tint, 0.98, 0);
      indices.push(vertexStart + vertex);
    }
    equipment.geometry.dispose();
  }
  const result = new THREE.BufferGeometry();
  for (const [name, attribute] of attributes) {
    result.setAttribute(name, name === 'skinIndex'
      ? new THREE.Uint16BufferAttribute(attribute.values, attribute.size)
      : new THREE.Float32BufferAttribute(attribute.values, attribute.size));
  }
  result.setAttribute('fieldKit', new THREE.Float32BufferAttribute(fieldKit, 4));
  result.setAttribute('fieldPosition', new THREE.Float32BufferAttribute(fieldPosition, 3));
  result.setIndex(indices); result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData = {
    kit, equipmentStartTriangle, equipmentKinds: [...equipmentKinds].sort(), originalVertices: positions.count,
    addedTriangles: indices.length / 3 - equipmentStartTriangle, hitTarget: false,
  };
  return result;
}

export function kitShader(shader: THREE.WebGLProgramParametersWithUniforms, wool: THREE.Color): void {
  shader.uniforms.fieldWoolColor = { value: wool };
  shader.vertexShader = shader.vertexShader.replace('#include <common>',
    '#include <common>\nattribute vec4 fieldKit; varying vec4 vFieldKit;\nattribute vec3 fieldPosition; varying vec3 vFieldPosition;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFieldKit = fieldKit; vFieldPosition = fieldPosition;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
    varying vec4 vFieldKit; varying vec3 vFieldPosition; uniform vec3 fieldWoolColor;
    float fieldNoise(vec3 p){ return fract(sin(dot(floor(p),vec3(127.1,311.7,74.7)))*43758.5453); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float sourceValue = clamp(dot(diffuseColor.rgb / max(diffuse,vec3(.001)),vec3(.2126,.7152,.0722)),.15,1.0);
      vec3 p = vFieldPosition;
      float wear = fieldNoise(p * 31.0);
      float threadFade = 1.0 - smoothstep(.2,.8,max(length(dFdx(p * 260.0)),length(dFdy(p * 260.0))));
      float weave = sin(p.y * 1500.0) * sin((p.x + p.z) * 1500.0) * threadFade;
      float torso = smoothstep(.83,.97,p.y) * (1.0 - smoothstep(1.36,1.46,p.y));
      vec3 cloth = mix(fieldWoolColor, diffuse * .62, torso * .32);
      cloth *= (.65 + .35 * sourceValue) * (.92 + .12 * wear + .045 * weave);
      float boot = 1.0 - smoothstep(.22,.34,p.y);
      cloth = mix(cloth,vec3(.047,.036,.025) * (.78 + .3 * sourceValue),boot);
      vec3 canvas = mix(vec3(.052,.034,.019),vec3(.24,.205,.13),clamp(vFieldKit.y,0.0,1.0));
      canvas *= .84 + .20 * wear + .025 * weave;
      diffuseColor.rgb = mix(cloth,canvas,min(1.0,vFieldKit.x));`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(.9,roughnessFactor);')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = min(.03,metalnessFactor);');
}
