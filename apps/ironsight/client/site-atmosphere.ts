import * as T from 'three';
import dusk from './undertow-dusk.json';
import overcast from './switchyard-overcast.json';

/** Shared with the offline bake: key, visible sky and wet-surface reflection
 * have one world-space sun direction. No live clock or graphics-mode variant. */
export function siteAtmosphere(site: string | undefined): typeof dusk | null {
  return site === 'undertow' ? dusk : site === 'switchyard' ? overcast : null;
}

export function siteSunDirection(profile: typeof dusk): T.Vector3 {
  return new T.Vector3(...profile.sunDirection as [number, number, number]).normalize();
}

export function createSiteSkyMaterial(profile: typeof dusk): T.ShaderMaterial {
  return new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: {
      skyRadiance: { value: null }, skyReady: { value: 0 },
      sunDirection: { value: siteSunDirection(profile) },
      // Overcast has a broad baked bright patch, with no visible solar disc.
      sunRadiance: { value: profile.name === dusk.name ? new T.Vector3(3, 1.9, .9) : new T.Vector3() },
      horizon: { value: new T.Color().setRGB(...profile.horizon as [number, number, number]) },
      zenith: { value: new T.Color().setRGB(...profile.zenith as [number, number, number]) },
    },
    // Ignore camera translation: clouds and the sun are at infinity, even from
    // the raised decks and the deployment camera. Keep the existing sky draw.
    vertexShader: `varying vec3 vDirection;
      void main() {
        vDirection = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `uniform sampler2D skyRadiance;
      uniform float skyReady;
      uniform vec3 horizon, zenith, sunDirection, sunRadiance;
      varying vec3 vDirection;
      #include <common>
      void main() {
        vec3 direction = normalize(vDirection);
        vec3 fallback = mix(horizon, zenith, smoothstep(0., .75, direction.y));
        vec3 radiance = texture2D(skyRadiance, equirectUv(direction)).rgb;
        // The sub-texel sun is analytic; the baked broad halo supplies the
        // reflection environment. No glare overlay obscures combat silhouettes.
        float disc = smoothstep(0.99978, 0.99990, dot(direction, sunDirection));
        radiance += disc * sunRadiance;
        gl_FragColor = vec4(mix(fallback, radiance, skyReady), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
