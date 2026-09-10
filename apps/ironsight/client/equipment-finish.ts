import * as T from 'three';

type Finish = 'weapon' | 'fabric' | 'glove';
const finishes = new WeakMap<T.MeshStandardMaterial, Map<Finish, T.MeshStandardMaterial>>();

// Object-space, static detail follows each reload part. Fade subpixel detail
// with derivatives so a distant weapon cannot turn into crawling noise. No
// texture, clock uniform, extra pass or CPU work after material preparation.
const common = /* glsl */ `
  varying vec3 vEquipmentPosition;
  varying vec3 vEquipmentNormal;
  float equipmentHash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float equipmentNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(equipmentHash(i), equipmentHash(i + vec3(1,0,0)), f.x),
                   mix(equipmentHash(i + vec3(0,1,0)), equipmentHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(equipmentHash(i + vec3(0,0,1)), equipmentHash(i + vec3(1,0,1)), f.x),
                   mix(equipmentHash(i + vec3(0,1,1)), equipmentHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float equipmentDetailFade(vec3 p) {
    return 1.0 - smoothstep(.35, 1.2, max(length(dFdx(p)), length(dFdy(p))));
  }
`;

/** Page-lifetime material cache, like the weapon model/template caches. Source
 * materials and purchased buffers are never changed. All instances and both
 * held views share the finish and the source texture allocation. */
export function equipmentFinish(source: T.MeshStandardMaterial, kind: Finish): T.MeshStandardMaterial {
  let entries = finishes.get(source);
  if (!entries) { entries = new Map(); finishes.set(source, entries); }
  const previous = entries.get(kind); if (previous) return previous;
  const material = source.clone();
  material.name = `issued-${kind}`;
  material.roughness = kind === 'weapon' ? .78 : .94;
  material.metalness = kind === 'weapon' ? .32 : 0;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vEquipmentPosition;\nvarying vec3 vEquipmentNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvEquipmentPosition = position;\nvEquipmentNormal = normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${common}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 equipmentP = vEquipmentPosition;
      float equipmentMottle = equipmentNoise(equipmentP * 24.0);
      float equipmentGrain = (equipmentNoise(equipmentP * 420.0) - .5)
        * equipmentDetailFade(equipmentP * 420.0);
      ${kind === 'weapon' ? /* glsl */ `
        // The existing palette atlas identifies panels. Remap it to parkerised
        // steel, olive polymer and faded tape while retaining panel contrast.
        float equipmentValue = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
        float equipmentPanel = smoothstep(.15,.65,equipmentValue);
        float equipmentTape = smoothstep(.035,.15,diffuseColor.r - diffuseColor.b)
          * smoothstep(.02,.12,diffuseColor.g);
        vec3 equipmentSteel = mix(vec3(.023,.028,.026), vec3(.14,.16,.145),
          smoothstep(.008,.55,equipmentValue));
        vec3 equipmentPolymer = vec3(.105,.112,.078);
        diffuseColor.rgb = mix(equipmentSteel,equipmentPolymer,equipmentPanel * .72);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.23,.195,.12),equipmentTape * .75);
        float equipmentScuff = smoothstep(.72,.88,
          equipmentNoise(equipmentP * vec3(210.0,90.0,9.0)))
          * equipmentDetailFade(equipmentP * 210.0);
        diffuseColor.rgb *= .79 + .32 * equipmentMottle + .18 * equipmentGrain;
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.24,.255,.23),equipmentScuff * .28);
        float equipmentRoughness = .74 + .16 * equipmentMottle - .30 * equipmentScuff;
        float equipmentMetal = mix(.48,.08,max(equipmentPanel,equipmentTape));
      ` : /* glsl */ `
        // Broad dyed-cloth variation, smaller scuffs and a filtered weave.
        vec3 equipmentBlend = pow(abs(vEquipmentNormal),vec3(4.0));
        equipmentBlend /= max(.001,dot(equipmentBlend,vec3(1.0)));
        vec3 equipmentThread = sin(equipmentP * ${kind === 'fabric' ? '1800.0' : '2400.0'});
        float equipmentWeave = dot(equipmentThread.yzx * equipmentThread.zxy,equipmentBlend)
          * equipmentDetailFade(equipmentP * ${kind === 'fabric' ? '290.0' : '380.0'});
        float equipmentDye = smoothstep(.43,.67,equipmentNoise(equipmentP * vec3(32.0,13.0,32.0)));
        diffuseColor.rgb *= (.86 + .24 * equipmentMottle + .14 * equipmentGrain + .10 * equipmentWeave);
        diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb * vec3(.66,.65,.55),equipmentDye * .50);
        float equipmentRoughness = .94 + .035 * equipmentWeave;
        float equipmentMetal = 0.0;
      `}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor = clamp(equipmentRoughness,.42,.99);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>',
      '#include <metalnessmap_fragment>\nmetalnessFactor = equipmentMetal;');
  };
  material.customProgramCacheKey = () => `ironsight-issued-${kind}-v1`;
  entries.set(kind, material);
  return material;
}

/** Finish only the legacy secondary bundle nodes, after cloning and before
 * separating reload parts. Generated PBR replacements keep their authored maps. */
export function finishLegacyWeapon(object: T.Object3D, nodeName: string): void {
  if (!['wep_smg', 'wep_shotgun', 'wep_sniper', 'wep_pistol'].includes(nodeName)) return;
  object.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const finish = (m: T.Material) => m instanceof T.MeshStandardMaterial ? equipmentFinish(m, 'weapon') : m;
    node.material = Array.isArray(node.material) ? node.material.map(finish) : finish(node.material);
  });
}
