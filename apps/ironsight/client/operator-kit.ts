import * as THREE from 'three';
import { botRole, type BotRole } from '../src/bot-roles.js';

/** Stable across death, weapon changes and AOI re-entry. Humans use the balanced
 * carrier; bot kit identifies the existing server role, never invents a role. */
export function operatorKit(id: string): BotRole { return botRole(id) ?? 'anchor'; }

const cache = new WeakMap<THREE.BufferGeometry, Map<BotRole, THREE.BufferGeometry>>();
const point = new THREE.Vector3();

/** Convex eight-sided plate, with one bevel ring at either end. Explicit fans
 * avoid shipping a general polygon triangulator for this fixed silhouette. */
function plateGeometry(w: number, h: number, d: number, bevel: number): THREE.BufferGeometry {
  const corner = Math.min(w,h)*.16;
  const outline = [[-w/2+corner,-h/2],[w/2-corner,-h/2],[w/2,-h/2+corner],[w/2,h/2-corner],
    [w/2-corner,h/2],[-w/2+corner,h/2],[-w/2,h/2-corner],[-w/2,-h/2+corner]];
  const rings = [-d/2-bevel,-d/2,d/2,d/2+bevel].map((z,i) => outline.map(([x,y]) =>
    [x! * (i===0||i===3 ? 1-2*bevel/w : 1),y! * (i===0||i===3 ? 1-2*bevel/h : 1),z]));
  const vertices: number[] = [];
  const face = (a: number[], b: number[], c: number[]) => vertices.push(...a,...b,...c);
  for(let ring=0;ring<3;ring++)for(let i=0;i<8;i++){
    const next=(i+1)%8, a=rings[ring]![i]!,b=rings[ring]![next]!,c=rings[ring+1]![next]!,e=rings[ring+1]![i]!;
    face(a,b,c);face(a,c,e);
  }
  for(let i=1;i<7;i++){face(rings[0]![0]!,rings[0]![i+1]!,rings[0]![i]!);face(rings[3]![0]!,rings[3]![i]!,rings[3]![i+1]!);}
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();return geometry;
}

/** Original field equipment, built once per role in the GLB's bind pose and
 * merged into its existing skinned draw. No images, extra meshes or runtime bake.
 * Source geometry and animations stay shared and unchanged. */
export function fitOperatorKit(root: THREE.Object3D, role: BotRole): void {
  root.updateMatrixWorld(true);
  const mesh = root.getObjectByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh | undefined;
  if (!mesh || !mesh.skeleton.bones.some(b => b.name === 'spine_03')) return;
  const source = mesh.geometry;
  let variants = cache.get(source);
  if (!variants) { variants = new Map(); cache.set(source, variants); }
  let geometry = variants.get(role);
  if (!geometry) {
    geometry = buildKit(mesh, role);
    variants.set(role, geometry);
  }
  mesh.geometry = geometry;
  mesh.userData.operatorKit = role;
}

function buildKit(mesh: THREE.SkinnedMesh, role: BotRole): THREE.BufferGeometry {
  const source = mesh.geometry, positions = source.getAttribute('position');
  const index: number[] = source.index ? Array.from(source.index.array) : Array.from({length: positions.count}, (_, i) => i);
  const attributes = new Map<string, { size: number; values: number[] }>();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values: number[] = [];
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values.push(attribute.getComponent(i, c));
    attributes.set(name, { size: attribute.itemSize, values });
  }
  const kit: number[] = [];
  const bones = mesh.skeleton.bones;
  const skin = source.getAttribute('skinIndex'), weights = source.getAttribute('skinWeight');
  for (let i = 0; i < positions.count; i++) {
    let strongest = 0;
    for (let c = 1; c < 4; c++) if (weights.getComponent(i,c) > weights.getComponent(i,strongest)) strongest = c;
    const name = bones[skin.getComponent(i,strongest)]?.name ?? '';
    const tint = /spine|clavicle|UpperArm|head|neck/.test(name) ? .92 : /Thigh|calf/.test(name) ? .36 : .14;
    kit.push(0, tint, .72, .08);
  }
  const box = new THREE.Box3().setFromObject(mesh);
  const height = box.max.y - box.min.y;
  const unit = height / 1.8;
  const chest = bones.find(b => b.name === 'spine_03')!.getWorldPosition(new THREE.Vector3());
  const add = (boneName: string, center: number[], size: number[], tint: number, roughness = .55, metalness = .22) => {
    const bone = bones.findIndex(b => b.name === boneName);
    if (bone < 0) return;
    // Quantized glTF positions may have a decode transform embedded in inverse
    // bind matrices. Invert the COMPLETE rigid skin transform, not mesh.world.
    const inverse = mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse)
      .multiply(bones[bone]!.matrixWorld).multiply(mesh.skeleton.boneInverses[bone]!)
      .multiply(mesh.bindMatrix).invert();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(inverse);
    // Bevelled eight-corner profile: readable broad planes without box corners.
    const [w,h,d] = size.map(v => v * unit) as [number,number,number];
    const part = plateGeometry(w,h,d,Math.min(.009*unit,w*.15,h*.15));
    const p = part.getAttribute('position'), n = part.getAttribute('normal');
    const start = attributes.get('position')!.values.length / 3;
    const origin = new THREE.Vector3(chest.x+center[0]!*unit,chest.y+center[1]!*unit,chest.z+center[2]!*unit);
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p,i).add(origin).applyMatrix4(inverse);
      const pos = point.toArray();
      point.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
      const normal = point.toArray();
      for (const [name, attr] of attributes) for (let c = 0; c < attr.size; c++) {
        attr.values.push(name === 'position' ? pos[c]! : name === 'normal' ? normal[c]! :
          name === 'skinIndex' ? (c === 0 ? bone : 0) : name === 'skinWeight' ? (c === 0 ? 1 : 0) :
          name.startsWith('color') ? 1 : 0);
      }
      kit.push(1,tint,roughness,metalness);
      index.push(start+i);
    }
    part.dispose();
  };
  // Large team-colour carrier, a graphite abdominal flex section and a pale
  // identification bar. All variants retain the original head/hit silhouette.
  const heavy = role === 'anchor', scout = role === 'sniper';
  add('spine_03',[0,-.06,.14],[heavy?.40:.33,.29,.07],.92);
  add('spine_02',[0,-.29,.125],[.28,.13,.055],.08,.86,.02);
  add('spine_03',[0,.015,.188],[.20,.026,.012],1.2,.35,.65);
  // A compact back carrier gives the rear approach the same readable identity.
  add('spine_03',[0,-.08,-.12],[heavy?.37:.29,.33,heavy?.14:.08],.78,.72,.12);
  if (heavy) {
    add('UpperArm_L',[.255,.015,0],[.18,.19,.23],.95);
    add('UpperArm_R',[-.255,.015,0],[.18,.19,.23],.95);
    for (const x of [-.105,0,.105]) add('spine_03',[x,-.16,.197],[.076,.12,.045],.12,.84,.02);
  } else if (scout) {
    add('spine_03',[.19,.035,-.025],[.13,.22,.21],.72,.8,.04);
    add('spine_03',[-.15,-.075,.195],[.046,.23,.028],.10,.85,.02);
    add('spine_03',[.12,-.13,-.19],[.09,.29,.09],.12,.58,.3);
  } else {
    add('UpperArm_L',[.25,.015,0],[.13,.12,.19],.95);
    add('spine_03',[-.12,-.09,.187],[.037,.25,.022],.1,.85,.02);
    add('spine_03',[.11,-.14,.19],[.10,.095,.035],.2,.84,.02);
  }
  for (const [side,x] of [['L',.105],['R',-.105]] as const) {
    add(`Thigh_${side}`,[x,-.62,.09],[heavy?.14:.11,heavy?.23:.18,.055],.78,.62,.18);
  }
  const result = new THREE.BufferGeometry();
  for (const [name, attr] of attributes) result.setAttribute(name,
    name === 'skinIndex' ? new THREE.Uint16BufferAttribute(attr.values, attr.size) : new THREE.Float32BufferAttribute(attr.values, attr.size));
  result.setAttribute('fieldKit', new THREE.Float32BufferAttribute(kit,4));
  result.setIndex(index);
  result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData = { role, originalVertices:positions.count, addedTriangles:(index.length-(source.index?.count??positions.count))/3 };
  return result;
}

/** Same program for every role and highlight colour. The bind-pose attribute
 * follows skinning, so finish boundaries cannot swim while the operator moves. */
export function kitShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader.replace('#include <common>',
    '#include <common>\nattribute vec4 fieldKit; varying vec4 vFieldKit;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFieldKit = fieldKit;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
    '#include <common>\nvarying vec4 vFieldKit;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 kitNeutral = vec3(0.065,0.083,0.102);
      vec3 kitBase = diffuseColor.rgb / max(diffuse, vec3(0.001));
      float kitShade = clamp(dot(kitBase,vec3(.2126,.7152,.0722))*2.0,.24,1.0);
      vec3 tailoredBase = mix(kitNeutral * kitShade, diffuseColor.rgb, vFieldKit.y);
      vec3 plateBase = mix(kitNeutral, diffuse, clamp(vFieldKit.y,0.0,1.0));
      plateBase = mix(plateBase,vec3(.62,.68,.71),step(1.01,vFieldKit.y));
      diffuseColor.rgb = mix(tailoredBase,plateBase,vFieldKit.x);
    `)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vFieldKit.z;')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vFieldKit.w;');
}
