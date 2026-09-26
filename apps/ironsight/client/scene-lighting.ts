import * as T from 'three';
import dusk from './undertow-dusk.json';
import overcast from './switchyard-overcast.json';

/** Linear-radiance grades shared by the visible sky and its reflection bake. */
const FRONT_LIGHT = {
  relay: {
    exposure: 1.05, key: 5.6, keyColor: 0xfff0d8,
    // 30 degrees, matching tools/bake-environment.py: long hard shadows across the yard.
    sun: [-0.733, 0.5, -0.462],
    sky: 0xb9c6cc, ground: 0x4a4436, hemisphere: 0.52,
    ambient: 0.05, ambientColor: 0xa2a79b, environment: 0.68,
    saturation: 0.8, tint: [1, 0.99, 0.95], fog: 0xcdd0c8,
    skyHorizon: 0xd6d4c6, skyZenith: 0x4e7496,
    // Sky-only: bright sun bloom around the key direction, no extra geometry.
    sunGlow: { color: [1.6, 1.45, 1.15], power: 48 },
    shadow: 1,
    // Hard noon: deep contact shade, white-warm lit faces, cool shadow.
    grade: { contrast: 1.38, saturation: 1.1, shadow: [0.86, 0.94, 1.1], highlight: [1.1, 1.01, 0.86] },
  },
  undertow: {
    exposure: dusk.exposure, key: dusk.keyIntensity, keyColor: dusk.keyColor,
    sun: dusk.sunDirection,
    sky: dusk.hemisphereSky, ground: dusk.hemisphereGround, hemisphere: dusk.hemisphereIntensity,
    ambient: dusk.ambientIntensity, ambientColor: 0x8c9abb, environment: dusk.environmentIntensity,
    saturation: 0.85, tint: [1, 0.94, 0.85], fog: dusk.fogColor,
    // Reflections: less saturated than the visible sky and capped, so wet ground
    // mirrors a dim dusk instead of glinting gold.
    environmentSaturation: 0.5, environmentCeiling: 0.45,
    // Sky-only: amber band low on the horizon toward the setting sun, held below the ground's brightness.
    horizonBand: { color: [0.95, 0.46, 0.17], height: 0.3, spread: 1.5, floor: 0.35 },
    sunGlow: { color: [1.1, 0.55, 0.22], power: 24 },
    shadow: 1,
    // Low dusk: blue shade and amber where the raking key lands, with the shade
    // lifted into a readable mid-dark instead of crushed to black.
    grade: { contrast: 1.06, saturation: 1, shadow: [0.9, 0.96, 1.12], highlight: [1.22, 1, 0.74], lift: 0.014 },
  },
  switchyard: {
    exposure: overcast.exposure, key: overcast.keyIntensity, keyColor: overcast.keyColor,
    sun: overcast.sunDirection,
    sky: overcast.hemisphereSky, ground: overcast.hemisphereGround, hemisphere: overcast.hemisphereIntensity,
    ambient: overcast.ambientIntensity, ambientColor: 0x60708a, environment: overcast.environmentIntensity,
    saturation: 0.22, tint: [0.9, 0.98, 0.9], fog: overcast.fogColor,
    // Overcast: the cloud deck leaves only a faint shadow.
    shadow: 0.18,
    // Flat overcast: soft contrast, drained grey-green, no warm highlights.
    grade: { contrast: 0.72, saturation: 0.75, shadow: [0.93, 1.02, 0.95], highlight: [0.93, 1.01, 0.93] },
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
      node.shadow.intensity = profile.shadow;
    } else if (node instanceof T.AmbientLight) {
      node.color.set(profile.ambientColor);
      node.intensity = profile.ambient;
    }
  });
}

export function gradeSiteSky(material: T.ShaderMaterial, site: string | undefined): void {
  const profile = siteLightProfile(site);
  if (!profile) return;
  if ('skyHorizon' in profile) {
    material.uniforms.horizon?.value.set(profile.skyHorizon);
    material.uniforms.zenith?.value.set(profile.skyZenith);
  }
  const glow = 'sunGlow' in profile ? profile.sunGlow : { color: [0, 0, 0], power: 1 };
  const band = 'horizonBand' in profile ? profile.horizonBand : { color: [0, 0, 0], height: 1, spread: 1, floor: 0 };
  material.uniforms.frontSkySaturation = { value: profile.saturation };
  material.uniforms.frontSkyTint = { value: new T.Vector3(...profile.tint) };
  material.uniforms.frontSkySun = { value: new T.Vector3(...profile.sun).normalize() };
  material.uniforms.frontSkyGlow = { value: new T.Vector4(...glow.color, glow.power) };
  material.uniforms.frontSkyBand = { value: new T.Vector3(...band.color) };
  material.uniforms.frontSkyBandShape = { value: new T.Vector3(band.height, band.spread, band.floor) };
  material.fragmentShader = `uniform float frontSkySaturation;
uniform vec3 frontSkyTint, frontSkySun, frontSkyBand;
uniform vec4 frontSkyGlow;
uniform vec3 frontSkyBandShape;
${material.fragmentShader}`.replace('#include <tonemapping_fragment>', `
float skyLuminance = dot(gl_FragColor.rgb, vec3(.2126, .7152, .0722));
gl_FragColor.rgb = mix(vec3(skyLuminance), gl_FragColor.rgb, frontSkySaturation) * frontSkyTint;
vec3 skyDir = normalize(vDirection);
float skyToward = max(dot(normalize(skyDir.xz + 1e-4), normalize(frontSkySun.xz + 1e-4)), 0.);
float skyBand = mix(frontSkyBandShape.z, 1., pow(skyToward, frontSkyBandShape.y)) * (1. - smoothstep(-.02, frontSkyBandShape.x, skyDir.y)) * smoothstep(-.12, 0., skyDir.y);
gl_FragColor.rgb += frontSkyBand * skyBand + frontSkyGlow.rgb * pow(max(dot(skyDir, frontSkySun), 0.), frontSkyGlow.w);
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
  const saturation = 'environmentSaturation' in profile ? profile.environmentSaturation : profile.saturation;
  const ceiling = 'environmentCeiling' in profile ? profile.environmentCeiling : Infinity;
  for (let i = 0; i < data.length; i += 4) {
    const r = decode(data[i] ?? 0), g = decode(data[i + 1] ?? 0), b = decode(data[i + 2] ?? 0);
    const luma = r * .2126 + g * .7152 + b * .0722;
    const cap = luma > ceiling ? ceiling / luma : 1;
    data[i] = encode((luma + (r - luma) * saturation) * profile.tint[0] * cap);
    data[i + 1] = encode((luma + (g - luma) * saturation) * profile.tint[1] * cap);
    data[i + 2] = encode((luma + (b - luma) * saturation) * profile.tint[2] * cap);
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
      color *= mix(${glsl(grade.shadow)}, ${glsl(grade.highlight)}, smoothstep(.01, .22, luma));${'lift' in grade
        ? `
      color += ${grade.lift.toFixed(4)} * ${glsl(grade.shadow)} * (1. - smoothstep(0., .2, luma));` : ''}
      color = .18 * pow(color / .18, vec3(${grade.contrast.toFixed(4)}));
      return ACESFilmicToneMapping(color);
    }`);
}
