import * as THREE from 'three';

/** Dust on the lens after a nearby blast: one clip-space quad drawn in the normal
 *  pass (no render target, no texture), only while a blast is still settling.
 *  The centre stays clear so it never covers the crosshair or an enemy in front
 *  of it; it follows blast trauma, which reduced motion and the blast-feedback
 *  setting already keep at zero. */
export function createLensDirt() {
  const strength = { value: 0 };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { lensDirt: strength },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy * 2., 0., 1.); }`,
    fragmentShader: `uniform float lensDirt;
      varying vec2 vUv;
      float dirtHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float dirtNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(dirtHash(i), dirtHash(i + vec2(1., 0.)), f.x), mix(dirtHash(i + vec2(0., 1.)), dirtHash(i + vec2(1., 1.)), f.x), f.y);
      }
      void main() {
        vec2 c = vUv - .5; c.x *= 1.6;
        float edge = smoothstep(.34, .78, length(c)); // clear centre, dirt toward the rim
        // Fine grit specks plus a faint soft smear; no hard-edged blotches.
        float speck = smoothstep(.86, .97, dirtNoise(vUv * vec2(150., 90.))) + .6 * smoothstep(.8, .95, dirtNoise(vUv * vec2(70., 42.) + 5.));
        float smear = smoothstep(.35, .9, dirtNoise(vUv * 3. + 3.)) * .3;
        float a = lensDirt * edge * clamp(speck + smear, 0., 1.) * .45;
        gl_FragColor = vec4(vec3(.36, .31, .24), a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.name = 'lens-dirt';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  mesh.raycast = () => {};
  mesh.visible = false;
  return {
    object: mesh,
    /** `trauma` is the existing 0..1 blast trauma; the 1.5 power keeps light knocks nearly clean. */
    update(trauma: number): void {
      strength.value = Math.min(1, Math.max(0, trauma)) ** 1.5;
      mesh.visible = strength.value > .01;
    },
    dispose(): void { mesh.geometry.dispose(); material.dispose(); },
  };
}
