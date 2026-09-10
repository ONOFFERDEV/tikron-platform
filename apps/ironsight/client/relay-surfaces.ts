import * as T from 'three';

interface GroundCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): { getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray } } | null;
}

/** Metric, derivative-filtered surface finish in the existing opaque pass.
 * uv2 is projected by applyConcreteDetail; neither paint nor baked AO UVs move.
 * The fine normal and R8 roughness textures are shared by the entire Relay kit.
 * No uniforms, texture uploads, resource creation or CPU bakes during play. */
export function finishRelaySurface(material: T.MeshStandardMaterial, kind: 'ground' | 'concrete' | 'apron' | 'coated'): void {
  material.onBeforeCompile = shader => {
    if (kind === 'ground') shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        diffuseColor.rgb *= vec3(texture2D(map, vMapUv).r);
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
      float surfaceGrain = texture2D(roughnessMap, vRoughnessMapUv).r;
      roughnessFactor *= surfaceGrain;
      // Small aggregate remains subordinate to team-colour masses and signs.
      diffuseColor.rgb *= mix(${kind === 'coated' ? '0.96, 1.04' : '0.87, 1.10'}, clamp((surfaceGrain - 0.64) / 0.36, 0.0, 1.0));
      ${kind === 'apron' || kind === 'coated' ? '' : `
      vec2 metres = vNormalMapUv * 0.8;
      vec2 spacing = vec2(${kind === 'ground' ? '6.0, 5.0' : '2.4, 1.2'});
      vec2 cell = floor(metres / spacing);
      vec2 local = mod(metres, spacing);
      vec2 edgeDistance = min(local, spacing - local);
      vec2 footprint = max(fwidth(metres), vec2(0.001));
      // Physical widths, with a pixel-wide analytic filter at grazing angles.
      vec2 seam = 1.0 - smoothstep(vec2(0.016), vec2(0.016) + footprint, edgeDistance);
      seam *= min(vec2(1.0), vec2(0.032) / footprint);
      float joint = max(seam.x, seam.y);
      float pour = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= mix(0.96, 1.04, pour) * mix(1.0, 0.68, joint);
      roughnessFactor = mix(roughnessFactor, 0.99, joint);
      ${kind === 'concrete' ? `
      // Recessed form ties: shading only, never holes through gameplay cover.
      vec2 tieDistance = abs(local - spacing * 0.5);
      float tie = 1.0 - smoothstep(0.021, 0.021 + max(footprint.x, footprint.y), length(tieDistance));
      tie *= min(1.0, 0.042 / max(footprint.x, footprint.y));
      diffuseColor.rgb *= 1.0 - 0.32 * tie;
      ` : ''}
      `}
      #endif
    `);
  };
  material.customProgramCacheKey = () => `relay-surface-v1-${kind}`;
  material.needsUpdate = true;
}

/** Linear R8 frees three colour channels for finer ground/detail resolution.
 * Canvas rows are north-first; reverse them explicitly for the typed upload.
 * Tint is kept on the material, not triplicated in every atlas texel. */
export function relayGroundTexture(canvas: GroundCanvas): T.DataTexture {
  const texture = new T.DataTexture(new Uint8Array(canvas.width * canvas.height), canvas.width, canvas.height, T.RedFormat);
  texture.name = 'relay-ground-luminance';
  texture.generateMipmaps = true; texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter; texture.anisotropy = 4;
  updateRelayGroundTexture(texture, canvas);
  return texture;
}

export function updateRelayGroundTexture(texture: T.DataTexture, canvas: GroundCanvas): void {
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const data = texture.image.data!;
  for (let i = 0; i < data.length; i++) {
    const s = rgba[i * 4]! / 255;
    const row = Math.floor(i / canvas.width), column = i % canvas.width;
    data[(canvas.height - 1 - row) * canvas.width + column] =
      Math.round((s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * 255);
  }
  texture.needsUpdate = true;
}
