import * as T from 'three';
import { undertowBakedFinish } from './undertow-palette.js';
import { RELAY_FIELD_PATTERNS, RELAY_FIELD_RELIEF } from './relay-field-patterns.js';

export const UNDERTOW_PHYSICAL_SURFACES = {
  mud: { roughness: 0.95, metalness: 0 },
  gravel: { roughness: 0.93, metalness: 0 },
  wood: { roughness: 0.88, metalness: 0 },
  concrete: { roughness: 0.91, metalness: 0 },
  metal: { roughness: 0.54, metalness: 0.52 },
} as const;
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

/** Burlap sandbags: staggered 0.62 x 0.30 m cells with pillowed edges and
 * per-bag tint, procedural on the existing metre UVs. Fades below pixel size. */
export const UNDERTOW_SANDBAG = `
    vec2 bagSize = vec2(0.62, 0.30);
    float bagCourse = floor(metres.y / bagSize.y);
    vec2 bagUv = metres + vec2(mod(bagCourse, 2.0) * bagSize.x * 0.5, 0.0);
    vec2 bagCell = floor(bagUv / bagSize);
    vec2 bagEdge = min(fract(bagUv / bagSize), 1.0 - fract(bagUv / bagSize));
    float bagDetail = 1.0 - smoothstep(0.05, 0.2, max(footprint.x, footprint.y));
    float pillow = smoothstep(0.0, 0.2, bagEdge.x) * smoothstep(0.0, 0.32, bagEdge.y);
    float sack = fract(sin(dot(bagCell, vec2(12.9898, 78.233))) * 43758.5453);
    diffuseColor.rgb *= mix(1.0, mix(0.62, 1.0, pillow) * mix(0.86, 1.1, sack), bagDetail);
    fieldRelief = pillow * 0.012 * bagDetail;
`;

/** Fixed, opaque PBR finish: wet areas darken and catch the existing environment.
 * No planar reflections, extra pass/light, animation or runtime resource churn. */
export function finishUndertowSurface(material: T.MeshStandardMaterial, kind: 'ground' | 'concrete' | 'apron' | 'coated'): void {
  const finish = undertowBakedFinish(material.name);
  const timber = kind === 'coated' && (finish === 'olive' || finish === 'ochre');
  const surface = kind === 'ground' ? 'mud' : kind === 'apron' ? 'gravel'
    : kind === 'concrete' || finish === 'pale' ? 'concrete' : timber ? 'wood' : 'metal';
  const pattern = kind === 'concrete' ? RELAY_FIELD_PATTERNS.brick.replaceAll('vRelayWall', 'vUndertowWall.y')
    : timber ? RELAY_FIELD_PATTERNS.wood : kind === 'coated' && finish === 'pale' ? UNDERTOW_SANDBAG
      : kind === 'ground' || kind === 'apron' ? RELAY_FIELD_PATTERNS.earth : '';
  material.setValues(UNDERTOW_PHYSICAL_SURFACES[surface]);
  material.userData.physicalSurface = surface;
  material.onBeforeCompile = shader => {
    const panel = kind === 'concrete' || kind === 'coated';
    if (panel) {
      shader.vertexShader = `attribute vec2 relayElevation;
        varying vec2 vUndertowElevation; varying vec2 vUndertowWall;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vUndertowWall = vec2((modelMatrix * vec4(position, 1.0)).y,
          1.0 - abs(normalize(mat3(modelMatrix) * normal).y));
        vUndertowElevation = relayElevation;
      `);
      shader.fragmentShader = `varying vec2 vUndertowElevation; varying vec2 vUndertowWall;\n${shader.fragmentShader}`;
    }
    if (kind === 'ground') shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 undertowGround = texture2D(map, vMapUv).rg;
      diffuseColor.rgb *= undertowGround.r;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      float undertowWet = 0.0;
      float fieldRelief = 0.0;
      #ifdef USE_ROUGHNESSMAP
      float grain = texture2D(roughnessMap, vRoughnessMapUv).r;
      float aggregate = clamp((grain - 0.64) / 0.36, 0.0, 1.0);
      roughnessFactor *= grain;
      diffuseColor.rgb *= mix(${kind === 'coated' ? '0.98, 1.02' : '0.96, 1.05'}, aggregate);
      vec2 metres = vNormalMapUv * 0.8;
      vec2 footprint = max(fwidth(metres), vec2(0.001));
      // Metre-scale aging reuses the resident R8 tile. No extra map or sampler.
      float broad = clamp((texture2D(roughnessMap, vNormalMapUv * 0.017 + vec2(0.31, 0.73)).r - 0.64) / 0.36, 0.0, 1.0);
      diffuseColor.rgb *= mix(1.02, ${kind === 'concrete' ? '0.89' : '0.95'}, smoothstep(0.40, 0.64, broad));
      ${panel ? `
      float vertical = smoothstep(0.5, 0.95, vUndertowWall.y);
      float runoff = clamp((texture2D(roughnessMap, vNormalMapUv * vec2(0.09, 0.003)).r - 0.64) / 0.36, 0.0, 1.0);
      float extent = vUndertowElevation.y - vUndertowElevation.x;
      float drop = max(0.0, vUndertowElevation.y - vUndertowWall.x);
      float streak = smoothstep(0.51, 0.69, runoff) * vertical * step(0.5, extent);
      streak *= 1.0 - smoothstep(0.12, max(0.3, min(extent, 0.35 + broad * 2.2)), drop);
      // Iron runoff below exposed ledges; dark damp silt at the ground line.
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.59, 0.43, 0.29), streak * ${kind === 'concrete' ? '0.65' : '0.48'});
      float damp = (1.0 - smoothstep(0.12, 0.65 + 0.5 * broad, vUndertowWall.x)) * vertical;
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.48, 0.54, 0.40), damp * 0.7);
      undertowWet = damp * 0.6;
      roughnessFactor = mix(roughnessFactor, 0.46, undertowWet);
      ${surface === 'metal' ? `
      float chip = smoothstep(0.59, 0.74, aggregate) * smoothstep(0.49, 0.64, broad);
      chip *= 1.0 - smoothstep(0.02, 0.07, max(footprint.x, footprint.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.15, 0.13, 0.095), chip * 0.48);
      roughnessFactor = mix(roughnessFactor, 0.70, chip);
      ` : ''}
      ` : ''}
      { ${pattern} }
      ${kind === 'ground' ? `
      undertowWet = smoothstep(0.24, 0.80, undertowGround.g + (aggregate - 0.5) * 0.10);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.48, 0.53, 0.47), undertowWet);
      roughnessFactor = mix(roughnessFactor, 0.24, undertowWet);
      ` : ''}
      #endif
    `);
    // The existing normal sample stays; flooded aggregate is optically smoother.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * mix(1.0, 0.35, undertowWet);') + (pattern ? RELAY_FIELD_RELIEF : ''));
  };
  material.customProgramCacheKey = () => `undertow-field-v1-${kind}-${surface}`;
  material.needsUpdate = true;
}
