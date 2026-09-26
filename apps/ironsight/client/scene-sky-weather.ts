import * as T from 'three';

/** Sky-only weather: geometry and soldiers always depth-occlude this material. */
const FRONT_SKIES = {
  relay: { smoke: 0x55534b, cloud: 0xd6cfb9, strength: 0.72, cloudiness: 0.20, bearing: 0.15, height: 0.35,
    // Daytime barrage: dust bursts rising off the far horizon with a faint flash at each.
    front: { bearing: -0.35, spread: 0.55, flash: [0.75, 0.55, 0.32], flashHeight: 0.16, flashWidth: 0.12,
      burst: [0.2, 0.18, 0.15], burstStrength: 1, flare: 0 } },
  undertow: { smoke: 0x494b50, cloud: 0xc4b4a0, strength: 0.62, cloudiness: 0.07, bearing: 0.72, height: 0.27,
    // Dusk: gun flashes under the cloud base and slow star-shell arcs.
    front: { bearing: 0.05, spread: 0.6, flash: [0.98, 0.6, 0.3], flashHeight: 0.17, flashWidth: 0.2,
      burst: [0, 0, 0], burstStrength: 0, flare: 1 } },
  switchyard: { smoke: 0x575b59, cloud: 0xb7bbb5, strength: 0.66, cloudiness: 0.14, bearing: -2.05, height: 0.34,
    // Overcast: broad, muffled glows inside the cloud deck.
    front: { bearing: -0.8, spread: 0.7, flash: [0.95, 0.82, 0.66], flashHeight: 0.2, flashWidth: 0.34,
      burst: [0, 0, 0], burstStrength: 0, flare: 0 } },
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
uniform float frontLineBearing, frontLineSpread, frontFlashHeight, frontFlashWidth, frontBurstStrength, frontFlare, frontMotion;
uniform vec3 frontFlash, frontBurst;
float frontAngle(vec3 d, float bearing) {
  return abs(mod(atan(d.z, d.x) - bearing + 3.14159265, 6.2831853) - 3.14159265);
}
// Far front: everything sits on one sector just above the far skyline (about 7-25 degrees up),
// is broad and dim next to combat effects, and is off entirely under reduced motion.
vec3 frontLine(vec3 radiance, vec3 d) {
  if (frontMotion < .5 || d.y < .02 || d.y > .6) return radiance;
  vec3 sky = radiance;
  for (int i = 0; i < 4; i++) {
    float fi = float(i), period = 2.3 + fi * 1.37, t = frontTime / period + fi * .31;
    float cell = floor(t), phase = fract(t);
    float bearing = frontLineBearing + (frontHash(vec2(cell, fi)) - .5) * frontLineSpread;
    float away = frontAngle(d, bearing);
    // Flash: a quick double flicker lighting the cloud underside.
    float since = phase * period; // seconds since this gun fired
    float flicker = exp(-since * 11.) + .6 * exp(-abs(since - .14) * 22.);
    float gx = away / frontFlashWidth, gy = (d.y - frontFlashHeight) / (frontFlashWidth * .55);
    float glow = exp(-(gx * gx + gy * gy)); // no pow(): GLSL pow is undefined for negative bases
    radiance += frontFlash * glow * flicker * (.6 + .4 * frontHash(vec2(fi, cell)));
    // Daytime burst: a dust cloud rising and spreading from the horizon, fading over the period.
    if (frontBurstStrength > 0.) {
      float r = .035 + .09 * phase, rise = .13 + .14 * phase;
      float bx = away / (r * 1.4), by = (d.y - rise) / r;
      float blob = exp(-(bx * bx + by * by));
      radiance = mix(radiance, frontBurst, blob * frontBurstStrength * (1. - phase) * smoothstep(0., .05, phase));
    }
  }
  if (frontFlare > 0.) for (int i = 0; i < 2; i++) {
    float fi = float(i), period = 9. + fi * 3.7, t = frontTime / period + fi * .5;
    float cell = floor(t), s = fract(t) / .75;
    if (s > 1.) continue;
    float bearing = frontLineBearing + (frontHash(vec2(fi, cell + 7.)) - .5) * frontLineSpread + s * .05;
    float height = .12 + .16 * sin(3.14159 * s);
    float away = frontAngle(d, bearing), dy = d.y - height;
    float light = smoothstep(0., .08, s) * (1. - smoothstep(.8, 1., s));
    radiance += vec3(.95, 1., .82) * light * (exp(-(away * away + dy * dy) / .00002) * 1.6
      + exp(-(away * away + dy * dy) / .0012) * .22);
  }
  // Fade out at the band edges instead of cutting a line into the clouds.
  return mix(sky, radiance, smoothstep(.02, .07, d.y) * (1. - smoothstep(.36, .58, d.y)));
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
  return frontLine(mix(radiance, frontSmoke, smoke * frontStrength), d);
}
`;

export function createSkyWeather(material: T.ShaderMaterial, site: string | undefined) {
  const profile = site === 'relay' ? FRONT_SKIES.relay : site === 'undertow' ? FRONT_SKIES.undertow
    : site === 'switchyard' ? FRONT_SKIES.switchyard : undefined;
  if (profile === undefined) return undefined;
  const clock = { value: 0 }, motion = { value: 1 };
  Object.assign(material.uniforms, {
    frontTime: clock,
    frontStrength: { value: profile.strength },
    frontCloudiness: { value: profile.cloudiness },
    frontBearing: { value: profile.bearing },
    frontHeight: { value: profile.height },
    frontSmoke: { value: new T.Color(profile.smoke) },
    frontCloud: { value: new T.Color(profile.cloud) },
    frontLineBearing: { value: profile.front.bearing },
    frontLineSpread: { value: profile.front.spread },
    frontFlash: { value: new T.Vector3(...profile.front.flash) },
    frontFlashHeight: { value: profile.front.flashHeight },
    frontFlashWidth: { value: profile.front.flashWidth },
    frontBurst: { value: new T.Vector3(...profile.front.burst) },
    frontBurstStrength: { value: profile.front.burstStrength },
    frontFlare: { value: profile.front.flare },
    frontMotion: motion,
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
      motion.value = reducedMotion ? 0 : 1;
      previous = now;
    },
  };
}
