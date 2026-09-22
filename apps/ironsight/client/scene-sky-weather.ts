import * as T from 'three';

/** Sky-only weather: geometry and soldiers always depth-occlude this material. */
const FRONT_SKIES = {
  relay: { smoke: 0x55534b, cloud: 0xd6cfb9, strength: 0.72, cloudiness: 0.20, bearing: 0.15, height: 0.35 },
  undertow: { smoke: 0x494b50, cloud: 0xc4b4a0, strength: 0.62, cloudiness: 0.07, bearing: 0.72, height: 0.27 },
  switchyard: { smoke: 0x575b59, cloud: 0xb7bbb5, strength: 0.66, cloudiness: 0.14, bearing: -2.05, height: 0.34 },
} as const;

const WEATHER_SHADER = `
uniform float frontTime, frontStrength, frontCloudiness, frontBearing, frontHeight;
uniform vec3 frontSmoke, frontCloud;
float frontHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float frontNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(frontHash(i), frontHash(i + vec2(1., 0.)), f.x),
    mix(frontHash(i + vec2(0., 1.)), frontHash(i + vec2(1., 1.)), f.x), f.y);
}
float frontBillow(vec2 p) {
  return frontNoise(p) * .65 + frontNoise(p * 2.13 + 7.1) * .35;
}
float frontPlume(vec3 d, float bearing, float height, float seed) {
  vec2 axis = vec2(cos(bearing), sin(bearing));
  float facing = dot(d.xz, axis), rise = (d.y + .18) / (height + .18);
  if (facing < .75 || rise < 0. || rise > 1.3) return 0.;
  float crosswind = dot(d.xz, vec2(-axis.y, axis.x));
  float bend = .065 * rise * rise;
  float width = .023 + .080 * smoothstep(0., 1., rise);
  vec2 p = vec2(crosswind - bend, d.y) * 30. - vec2(0., frontTime * .10);
  float billow = frontBillow(p + seed);
  float edge = abs(crosswind - bend + (billow - .5) * .060);
  float body = 1. - smoothstep(width * .22, width, edge);
  float crown = 1. - smoothstep(.62 + billow * .30, 1.25, rise);
  return body * crown * smoothstep(0., .06, rise) * (.45 + billow * .55);
}
vec3 frontWeather(vec3 radiance, vec3 direction) {
  vec3 d = normalize(direction);
  vec2 drift = vec2(frontTime * .004, frontTime * .001);
  float clouds = frontBillow(d.xz * 5. + vec2(d.y * 6.) + drift);
  float veil = smoothstep(.35, .78, clouds) * smoothstep(0., .18, d.y);
  radiance = mix(radiance, frontCloud, veil * frontCloudiness);
  float smoke = frontPlume(d, frontBearing, frontHeight, 2.7);
  smoke = max(smoke, frontPlume(d, frontBearing + .66, frontHeight * .65, 13.2) * .72);
  smoke = max(smoke, frontPlume(d, frontBearing - 1.25, frontHeight * .5, 24.8) * .48);
  return mix(radiance, frontSmoke, smoke * frontStrength);
}
`;

export function createSkyWeather(material: T.ShaderMaterial, site: string | undefined) {
  const profile = site === 'relay' ? FRONT_SKIES.relay : site === 'undertow' ? FRONT_SKIES.undertow
    : site === 'switchyard' ? FRONT_SKIES.switchyard : undefined;
  if (profile === undefined) return undefined;
  const clock = { value: 0 };
  Object.assign(material.uniforms, {
    frontTime: clock,
    frontStrength: { value: profile.strength },
    frontCloudiness: { value: profile.cloudiness },
    frontBearing: { value: profile.bearing },
    frontHeight: { value: profile.height },
    frontSmoke: { value: new T.Color(profile.smoke) },
    frontCloud: { value: new T.Color(profile.cloud) },
  });
  material.fragmentShader = WEATHER_SHADER + material.fragmentShader.replace(
    '#include <tonemapping_fragment>',
    'gl_FragColor.rgb = frontWeather(gl_FragColor.rgb, vDirection);\n#include <tonemapping_fragment>',
  );
  // All three skies live at infinity. Camera translation must not drag smoke
  // through the skyline, including from raised decks and deployment cameras.
  material.vertexShader = `varying vec3 vDirection;
    void main() {
      vDirection = position;
      vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
      gl_Position = clip.xyww;
    }`;
  let previous: number | undefined;
  return {
    update(now: number, reducedMotion: boolean): void {
      if (previous !== undefined && !reducedMotion) clock.value += Math.max(0, Math.min(50, now - previous)) / 1000;
      previous = now;
    },
  };
}
