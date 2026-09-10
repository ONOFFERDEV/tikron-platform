import * as T from 'three';

interface GroundCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): { getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray } } | null;
}

/** R = linear base intensity; G = linear wetness. One RG8 upload replaces the
 * stretched RGBA ground. Explicit row reversal matches north-first canvas/AO. */
export function undertowGroundTexture(canvas: GroundCanvas, wetness: GroundCanvas): T.DataTexture {
  const texture = new T.DataTexture(new Uint8Array(canvas.width * canvas.height * 2), canvas.width, canvas.height, T.RGFormat);
  texture.name = 'undertow-ground-intensity-wetness';
  texture.generateMipmaps = true; texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter; texture.anisotropy = 4;
  updateUndertowGroundTexture(texture, canvas, wetness);
  return texture;
}

export function updateUndertowGroundTexture(texture: T.DataTexture, canvas: GroundCanvas, wetness: GroundCanvas): void {
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const wet = wetness.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const data = texture.image.data!;
  for (let i = 0; i < canvas.width * canvas.height; i++) {
    const s = rgba[i * 4]! / 255, row = Math.floor(i / canvas.width), column = i % canvas.width;
    const out = ((canvas.height - 1 - row) * canvas.width + column) * 2;
    data[out] = Math.round((s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * 255);
    data[out + 1] = wet[i * 4]!;
  }
  texture.needsUpdate = true;
}

/** Fixed, opaque PBR finish: wet areas darken and catch the existing environment.
 * No planar reflections, extra pass/light, animation or runtime resource churn. */
export function finishUndertowSurface(material: T.MeshStandardMaterial, kind: 'ground' | 'concrete' | 'apron' | 'coated'): void {
  material.onBeforeCompile = shader => {
    if (kind === 'concrete') {
      shader.vertexShader = `varying vec2 vUndertowWall;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vUndertowWall = vec2((modelMatrix * vec4(position, 1.0)).y,
          1.0 - abs(normalize(mat3(modelMatrix) * normal).y));
      `);
      shader.fragmentShader = `varying vec2 vUndertowWall;\n${shader.fragmentShader}`;
    }
    if (kind === 'ground') shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 undertowGround = texture2D(map, vMapUv).rg;
      diffuseColor.rgb *= undertowGround.r;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      float undertowWet = 0.0;
      #ifdef USE_ROUGHNESSMAP
      float grain = texture2D(roughnessMap, vRoughnessMapUv).r;
      float aggregate = clamp((grain - 0.64) / 0.36, 0.0, 1.0);
      roughnessFactor *= grain;
      diffuseColor.rgb *= mix(${kind === 'coated' ? '0.98, 1.02' : '0.96, 1.05'}, aggregate);
      ${kind === 'apron' || kind === 'coated' ? '' : `
      vec2 metres = vNormalMapUv * 0.8;
      vec2 spacing = vec2(${kind === 'ground' ? '6.0, 5.0' : '2.4, 1.2'});
      vec2 cell = floor(metres / spacing), local = mod(metres, spacing);
      vec2 footprint = max(fwidth(metres), vec2(0.001));
      vec2 seam = 1.0 - smoothstep(vec2(0.014), vec2(0.014) + footprint, min(local, spacing - local));
      seam *= min(vec2(1.0), vec2(0.028) / footprint);
      float joint = max(seam.x, seam.y);
      float pour = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= mix(0.97, 1.03, pour) * mix(1.0, 0.70, joint);
      ${kind === 'ground' ? `
      undertowWet = smoothstep(0.24, 0.80, undertowGround.g + (aggregate - 0.5) * 0.10);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.50, 0.63, 0.62), undertowWet);
      roughnessFactor = mix(roughnessFactor, 0.27, undertowWet);
      ` : `
      float vertical = smoothstep(0.5, 0.95, vUndertowWall.y);
      float run = 0.5 + 0.5 * sin(metres.x * 10.7 + sin(metres.x * 3.1));
      float damp = (1.0 - smoothstep(0.22, 0.68 + 0.15 * run, vUndertowWall.x)) * vertical;
      float streak = pow(run, 8.0) * 0.055 * vertical * min(1.0, 0.10 / footprint.x);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.68, 0.77, 0.72), damp) * (1.0 - streak);
      undertowWet = damp * 0.5;
      roughnessFactor = mix(roughnessFactor, 0.46, undertowWet);
      float tie = 1.0 - smoothstep(0.023, 0.023 + max(footprint.x, footprint.y), length(local - spacing * 0.5));
      tie *= min(1.0, 0.046 / max(footprint.x, footprint.y));
      diffuseColor.rgb *= 1.0 - 0.30 * tie * vertical;
      `}
      roughnessFactor = mix(roughnessFactor, 0.97, joint);
      `}
      #endif
    `);
    // The existing normal sample stays; flooded aggregate is optically smoother.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * mix(1.0, 0.35, undertowWet);'));
  };
  material.customProgramCacheKey = () => `undertow-surface-v1-${kind}`;
  material.needsUpdate = true;
}
