import * as T from 'three';
import dusk from './undertow-dusk.json';
import overcast from './switchyard-overcast.json';

/** Linear-radiance grades shared by the visible sky and its reflection bake. */
const FRONT_LIGHT = {
  relay: {
    exposure: 1.05, key: 4.2, keyColor: 0xffe4b8,
    sun: [-0.46, 0.84, -0.29],
    sky: 0xc1c7c2, ground: 0x5a5341, hemisphere: 0.52,
    ambient: 0.07, ambientColor: 0xa2a79b, environment: 0.68,
    saturation: 0.65, tint: [1, 0.98, 0.91], fog: 0xbdbbb0,
    // Hard noon: deep contact shade, warm-lit faces, cool neutral shadow.
    grade: { contrast: 1.32, saturation: 1.05, shadow: [0.9, 0.96, 1.08], highlight: [1.1, 1, 0.84] },
  },
  undertow: {
    exposure: dusk.exposure, key: dusk.keyIntensity, keyColor: dusk.keyColor,
    sun: dusk.sunDirection,
    sky: dusk.hemisphereSky, ground: dusk.hemisphereGround, hemisphere: dusk.hemisphereIntensity,
    ambient: dusk.ambientIntensity, ambientColor: 0x4e5f80, environment: dusk.environmentIntensity,
    saturation: 0.60, tint: [1, 0.94, 0.85], fog: dusk.fogColor,
    // Low dusk: blue shade, amber where the low key lands.
    grade: { contrast: 1.12, saturation: 0.95, shadow: [0.84, 0.92, 1.14], highlight: [1.14, 0.98, 0.8] },
  },
  switchyard: {
    exposure: overcast.exposure, key: overcast.keyIntensity, keyColor: overcast.keyColor,
    sun: overcast.sunDirection,
    sky: overcast.hemisphereSky, ground: overcast.hemisphereGround, hemisphere: overcast.hemisphereIntensity,
    ambient: overcast.ambientIntensity, ambientColor: 0x60708a, environment: overcast.environmentIntensity,
    saturation: 0.22, tint: [0.96, 0.97, 0.94], fog: overcast.fogColor,
    // Flat overcast: soft contrast, drained colour, faint cold cast.
    grade: { contrast: 0.88, saturation: 0.72, shadow: [0.97, 1, 1.03], highlight: [0.97, 0.99, 1.01] },
  },
} as const;

export function siteLightProfile(site: string | undefined) {
  switch (site) {
    case 'relay': return FRONT_LIGHT.relay;
    case 'undertow': return FRONT_LIGHT.undertow;
    case 'switchyard': return FRONT_LIGHT.switchyard;
    default: return undefined;
  }
}

export function applySiteLightRig(scene: T.Scene, site: string | undefined, center: T.Vector3): void {
  const profile = siteLightProfile(site);
  if (!profile) return;
  if (scene.fog) scene.fog.color.set(profile.fog);
  scene.traverse(node => {
    if (node instanceof T.HemisphereLight) {
      node.color.set(profile.sky);
      node.groundColor.set(profile.ground);
      node.intensity = profile.hemisphere;
    } else if (node instanceof T.DirectionalLight) {
      node.color.set(profile.keyColor);
      node.intensity = profile.key;
      node.position.fromArray(profile.sun).normalize().multiplyScalar(110).add(center);
    } else if (node instanceof T.AmbientLight) {
      node.color.set(profile.ambientColor);
      node.intensity = profile.ambient;
    }
  });
}

export function gradeSiteSky(material: T.ShaderMaterial, site: string | undefined): void {
  const profile = siteLightProfile(site);
  if (!profile) return;
  material.uniforms.frontSkySaturation = { value: profile.saturation };
  material.uniforms.frontSkyTint = { value: new T.Vector3(...profile.tint) };
  material.fragmentShader = `uniform float frontSkySaturation;
uniform vec3 frontSkyTint;
${material.fragmentShader}`.replace('#include <tonemapping_fragment>', `
float skyLuminance = dot(gl_FragColor.rgb, vec3(.2126, .7152, .0722));
gl_FragColor.rgb = mix(vec3(skyLuminance), gl_FragColor.rgb, frontSkySaturation) * frontSkyTint;
#include <tonemapping_fragment>`);
}

/** Grade the loaded HDR once, before its existing PMREM upload; preserve alpha. */
export function gradeSiteEnvironment(texture: T.DataTexture, site: string): void {
  const profile = siteLightProfile(site);
  if (!profile) return;
  const data = texture.image.data;
  if (!(data instanceof Uint16Array || data instanceof Float32Array)) {
    throw new TypeError('Site radiance must use half-float or float RGBA data');
  }
  const decode = data instanceof Uint16Array ? T.DataUtils.fromHalfFloat : (value: number) => value;
  const encode = data instanceof Uint16Array ? T.DataUtils.toHalfFloat : (value: number) => value;
  for (let i = 0; i < data.length; i += 4) {
    const r = decode(data[i] ?? 0), g = decode(data[i + 1] ?? 0), b = decode(data[i + 2] ?? 0);
    const luma = r * .2126 + g * .7152 + b * .0722;
    data[i] = encode((luma + (r - luma) * profile.saturation) * profile.tint[0]);
    data[i + 1] = encode((luma + (g - luma) * profile.saturation) * profile.tint[1]);
    data[i + 2] = encode((luma + (b - luma) * profile.saturation) * profile.tint[2]);
  }
}

const ORIGINAL_TONEMAPPING = T.ShaderChunk.tonemapping_pars_fragment;
const glsl = (v: readonly number[]) => `vec3(${v.map(n => n.toFixed(4)).join(', ')})`;

/** Per-site colour grade inside the existing tone-mapping step of every material:
 *  no pass, no texture, no uniform. The page holds one site, so the grade is baked
 *  as constants before the first compile; unauthored sites keep plain ACES. */
export function installSiteGrade(renderer: T.WebGLRenderer, site: string | undefined): void {
  const grade = siteLightProfile(site)?.grade;
  T.ShaderChunk.tonemapping_pars_fragment = ORIGINAL_TONEMAPPING;
  if (!grade) return;
  renderer.toneMapping = T.CustomToneMapping;
  T.ShaderChunk.tonemapping_pars_fragment = ORIGINAL_TONEMAPPING.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    `vec3 CustomToneMapping( vec3 color ) {
      float luma = dot(color, vec3(.2126, .7152, .0722));
      color = max(mix(vec3(luma), color, ${grade.saturation.toFixed(4)}), 0.);
      color *= mix(${glsl(grade.shadow)}, ${glsl(grade.highlight)}, smoothstep(.02, .6, luma));
      color = .18 * pow(color / .18, vec3(${grade.contrast.toFixed(4)}));
      return ACESFilmicToneMapping(color);
    }`);
}
