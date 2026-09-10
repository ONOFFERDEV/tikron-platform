import * as THREE from 'three';
import { botRole, type BotRole } from '../src/bot-roles.js';
import { fieldRadioGeometry } from './field-equipment.js';

/** Stable across death, weapon changes and AOI re-entry. Humans use the balanced
 * carrier; bot kit identifies the existing server role, never invents a role. */
export function operatorKit(id: string): BotRole { return botRole(id) ?? 'anchor'; }

const cache = new WeakMap<THREE.BufferGeometry, Map<string, THREE.BufferGeometry>>();
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
export function fitOperatorKit(root: THREE.Object3D, role: BotRole, radio = fieldRadioGeometry()): void {
  root.updateMatrixWorld(true);
  const mesh = root.getObjectByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh | undefined;
  if (!mesh || !mesh.skeleton.bones.some(b => b.name === 'spine_03')) return;
  const source = mesh.geometry;
  let variants = cache.get(source);
  if (!variants) { variants = new Map(); cache.set(source, variants); }
  const cacheKey = `${role}:${role==='anchor' ? radio?.uuid ?? '' : ''}`;
  let geometry = variants.get(cacheKey);
  if (!geometry) {
    geometry = buildKit(mesh, role, radio);
    variants.set(cacheKey, geometry);
  }
  mesh.geometry = geometry;
  mesh.userData.operatorKit = role;
  if (geometry.userData.radioStartTriangle !== undefined) {
    // Luggage is visual only: keep its appended triangles out of hit claims.
    mesh.raycast = function(raycaster, hits) {
      const start = hits.length;
      THREE.SkinnedMesh.prototype.raycast.call(this,raycaster,hits);
      for(let i=hits.length-1;i>=start;i--)
        if((hits[i]!.faceIndex ?? -1)>=this.geometry.userData.radioStartTriangle) hits.splice(i,1);
    };
  }
}

function buildKit(mesh: THREE.SkinnedMesh, role: BotRole, radio?: THREE.BufferGeometry): THREE.BufferGeometry {
  const source = mesh.geometry, positions = source.getAttribute('position');
  const index: number[] = source.index ? Array.from(source.index.array) : Array.from({length: positions.count}, (_, i) => i);
  const attributes = new Map<string, { size: number; values: number[] }>();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values: number[] = [];
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values.push(attribute.getComponent(i, c));
    attributes.set(name, { size: attribute.itemSize, values });
  }
  if(radio && !attributes.has('color')) attributes.set('color',{size:3,values:Array(positions.count*3).fill(1)});
  const kit: number[] = [];
  const fieldPosition: number[] = [];
  const bones = mesh.skeleton.bones;
  mesh.skeleton.update();
  const box = new THREE.Box3().setFromObject(mesh);
  const height = box.max.y - box.min.y;
  const unit = height / 1.8;
  const chest = bones.find(b => b.name === 'spine_03')!.getWorldPosition(new THREE.Vector3());
  const skin = source.getAttribute('skinIndex'), weights = source.getAttribute('skinWeight');
  for (let i = 0; i < positions.count; i++) {
    let strongest = 0;
    for (let c = 1; c < 4; c++) if (weights.getComponent(i,c) > weights.getComponent(i,strongest)) strongest = c;
    const name = bones[skin.getComponent(i,strongest)]?.name ?? '';
    mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
    fieldPosition.push((point.x-chest.x)/unit,(point.y-box.min.y)/unit,(point.z-chest.z)/unit);
    const tint = /spine|clavicle/.test(name) ? .84 : /UpperArm/.test(name) ? .68 : .06;
    kit.push(0, tint, .94, .01);
  }
  const add = (boneName: string, center: number[], size: number[], tint: number, roughness = .9, metalness = .02,
    shape?: THREE.BufferGeometry, colors?: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, kind=1) => {
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
    const part = shape ?? plateGeometry(w,h,d,Math.min(.009*unit,w*.15,h*.15));
    const p = part.getAttribute('position'), n = part.getAttribute('normal');
    const start = attributes.get('position')!.values.length / 3;
    const origin = new THREE.Vector3(chest.x+center[0]!*unit,chest.y+center[1]!*unit,chest.z+center[2]!*unit);
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p,i).add(origin);
      fieldPosition.push((point.x-chest.x)/unit,(point.y-box.min.y)/unit,(point.z-chest.z)/unit);
      point.applyMatrix4(inverse);
      const pos = point.toArray();
      point.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
      const normal = point.toArray();
      for (const [name, attr] of attributes) for (let c = 0; c < attr.size; c++) {
        attr.values.push(name === 'position' ? pos[c]! : name === 'normal' ? normal[c]! :
          name === 'skinIndex' ? (c === 0 ? bone : 0) : name === 'skinWeight' ? (c === 0 ? 1 : 0) :
          name.startsWith('color') ? (colors && c<3 ? colors.getComponent(i,c) : 1) : 0);
      }
      kit.push(kind,tint,roughness,metalness);
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
    add(`Thigh_${side}`,[x,-.62,.09],[heavy?.14:.11,heavy?.23:.18,.055],.12,.92,.02);
  }
  // Rounded cloth over the source's narrow mechanical limbs. Each segment uses
  // its existing joint, leaving the original vertices and authored clips intact.
  const sleeve = (from: string, to: string, radiusTop: number, radiusBottom: number, tint: number) => {
    const a = bones.find(b => b.name === from)?.getWorldPosition(new THREE.Vector3());
    const b = bones.find(b => b.name === to)?.getWorldPosition(new THREE.Vector3());
    if (!a || !b) return;
    const direction = a.clone().sub(b), length = direction.length();
    const indexed = new THREE.CylinderGeometry(radiusTop*unit,radiusBottom*unit,length,10,3);
    const p = indexed.getAttribute('position');
    for (let i=0;i<p.count;i++) {
      const fold = 1.0 + .055*Math.cos(p.getY(i)/length*Math.PI*6.0);
      p.setX(i,p.getX(i)*fold); p.setZ(i,p.getZ(i)*fold);
    }
    indexed.computeVertexNormals();
    indexed.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
    const shape=indexed.toNonIndexed(); indexed.dispose();
    const center=a.add(b).multiplyScalar(.5).sub(chest).divideScalar(unit).toArray();
    add(from,center,[1,1,1],tint,.96,.01,shape);
  };
  for (const side of ['L','R']) {
    const lower=side.toLowerCase();
    sleeve(`Thigh_${side}`,`calf_${lower}`,.095,.075,.07);
    sleeve(`calf_${lower}`,`Foot_${side}`,.075,.058,.04);
    sleeve(`UpperArm_${side}`,`lowerarm_${lower}`,.081,.065,.60);
    sleeve(`lowerarm_${lower}`,`Hand_${side}`,.063,.044,.20);
  }
  const head = bones.find(b => b.name === 'head')?.getWorldPosition(new THREE.Vector3());
  if (head) {
    // Rounded-square helmet rings enclose the source's squared crown. A sphere
    // intersected its corners. The crown/feet normalization stays exact.
    const top = (box.max.y-chest.y)/unit;
    const helmet = new THREE.CylinderGeometry(.135*unit,.165*unit,.12*unit,12,3);
    const hp=helmet.getAttribute('position');
    for(let i=0;i<hp.count;i++) {
      const x=hp.getX(i),z=hp.getZ(i),r=Math.hypot(x,z);
      if(r<1e-6) continue;
      hp.setX(i,Math.sign(x)*Math.sqrt(Math.abs(x/r))*r);
      hp.setZ(i,Math.sign(z)*Math.sqrt(Math.abs(z/r))*r);
    }
    helmet.computeVertexNormals();
    const cover=helmet.toNonIndexed();helmet.dispose();
    add('head',[(head.x-chest.x)/unit,top-.062,(head.z-chest.z)/unit],[1,1,1],.08,.96,.01,cover);
    const eye = bones.find(b => b.name === 'eyes')?.getWorldPosition(new THREE.Vector3());
    if (eye) {
      const center=eye.sub(chest).divideScalar(unit);
      add('head',[center.x,center.y,center.z+.018],[.235,.069,.021],.05,.96,.01);
      add('head',[center.x,center.y,center.z+.034],[.196,.040,.017],-.4,.9,.01);
    }
  }
  const radioStartTriangle = heavy && radio ? index.length/3 : undefined;
  if(heavy && radio) {
    const shape=radio.clone().scale(unit,unit,unit);
    add('spine_03',[0,-.07,-.225],[1,1,1],.08,.94,.01,shape,shape.getAttribute('color'),2);
  }
  const result = new THREE.BufferGeometry();
  for (const [name, attr] of attributes) result.setAttribute(name,
    name === 'skinIndex' ? new THREE.Uint16BufferAttribute(attr.values, attr.size) : new THREE.Float32BufferAttribute(attr.values, attr.size));
  result.setAttribute('fieldKit', new THREE.Float32BufferAttribute(kit,4));
  result.setAttribute('fieldPosition', new THREE.Float32BufferAttribute(fieldPosition,3));
  result.setIndex(index);
  result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData = { role, originalVertices:positions.count, addedTriangles:(index.length-(source.index?.count??positions.count))/3,
    radioStartTriangle, radioTriangles:radioStartTriangle === undefined ? 0 : index.length/3-radioStartTriangle };
  return result;
}

/** Same program for every role and highlight colour. The bind-pose attribute
 * follows skinning, so finish boundaries cannot swim while the operator moves. */
export function kitShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader.replace('#include <common>',
    '#include <common>\nattribute vec4 fieldKit; varying vec4 vFieldKit;\nattribute vec3 fieldPosition; varying vec3 vFieldPosition;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFieldKit = fieldKit; vFieldPosition = fieldPosition;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
    `#include <common>
    varying vec4 vFieldKit; varying vec3 vFieldPosition;
    float fieldNoise(vec3 p) {
      vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      // Smooth irregular fabric dye; fixed bind coordinates survive animation.
      vec4 a = fract(sin(vec4(dot(i,vec3(127.1,311.7,74.7))) + vec4(0.0,127.1,311.7,438.8))*43758.5453);
      vec4 b = fract(sin(vec4(dot(i,vec3(127.1,311.7,74.7))+74.7) + vec4(0.0,127.1,311.7,438.8))*43758.5453);
      return mix(mix(mix(a.x,a.y,f.x),mix(a.z,a.w,f.x),f.y),mix(mix(b.x,b.y,f.x),mix(b.z,b.w,f.x),f.y),f.z);
    }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 kitNeutral = vec3(0.105,0.118,0.078);
      vec3 kitBase = diffuseColor.rgb / max(diffuse, vec3(0.001));
      float kitShade = clamp(dot(kitBase,vec3(.2126,.7152,.0722))*2.0,.24,1.0);
      vec3 fieldTeam = mix(vec3(.23,.215,.18),diffuse,.66);
      float helmetBand = step(1.64,vFieldPosition.y) * (1.0-step(1.695,vFieldPosition.y));
      float fabricTint = max(vFieldKit.y,helmetBand*.94);
      vec3 tailoredBase = mix(kitNeutral,fieldTeam,fabricTint) * kitShade;
      vec3 plateBase = mix(kitNeutral*.7,fieldTeam,clamp(vFieldKit.y,0.0,1.0));
      plateBase = mix(plateBase,vec3(.008,.014,.016),1.0-step(-.1,vFieldKit.y));
      plateBase = mix(plateBase,vec3(.48,.45,.34),step(1.01,vFieldKit.y));
      diffuseColor.rgb = mix(tailoredBase,plateBase,min(1.0,vFieldKit.x));
      float dye = fieldNoise(vFieldPosition * vec3(19.0,13.0,19.0));
      float broadWear = fieldNoise(vFieldPosition * 5.0);
      float weave = sin(vFieldPosition.y*2100.0) * sin((vFieldPosition.x+vFieldPosition.z)*2100.0);
      float weaveFade = 1.0-smoothstep(.0006,.003,max(fwidth(vFieldPosition.x),fwidth(vFieldPosition.y)));
      diffuseColor.rgb *= .80 + .23*dye + .15*broadWear + .035*weave*weaveFade;
      // Pale abrasion on equipment; broad colour masses remain the team cue.
      diffuseColor.rgb += vec3(.018,.015,.009)*smoothstep(.64,.82,dye);
      #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
        diffuseColor.rgb = mix(diffuseColor.rgb,vColor.rgb,step(1.5,vFieldKit.x));
      #endif
    `)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(.86,vFieldKit.z);')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = min(.06,vFieldKit.w);');
}
