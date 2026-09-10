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
    const panel = kind === 'concrete' || kind === 'coated';
    shader.vertexShader = `${panel ? 'attribute vec2 relayElevation; varying vec2 vRelayElevation;' : ''}\nvarying float vRelayHeight;\nvarying float vRelayWall;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRelayHeight = (modelMatrix * vec4(position, 1.0)).y;
        vRelayWall = 1.0 - abs(normalize(mat3(modelMatrix) * normal).y);
        ${panel ? 'vRelayElevation = relayElevation;' : ''}
      `);
    shader.fragmentShader = `${panel ? 'varying vec2 vRelayElevation;' : ''}\nvarying float vRelayHeight;\nvarying float vRelayWall;\n${shader.fragmentShader}`;
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
      float aggregate = clamp((surfaceGrain - 0.64) / 0.36, 0.0, 1.0);
      diffuseColor.rgb *= mix(${kind === 'coated' ? '0.96, 1.04' : '0.94, 1.06'}, aggregate);
      vec2 metres = vNormalMapUv * 0.8;
      vec2 footprint = max(fwidth(metres), vec2(0.001));
      // Reuse the resident periodic R8 tile at metre scale: no extra image,
      // sampler allocation, transparency, light or animation-time upload.
      float broad = clamp((texture2D(roughnessMap, vNormalMapUv * 0.017 + vec2(0.31, 0.73)).r - 0.64) / 0.36, 0.0, 1.0);
      float stain = smoothstep(0.40, 0.64, broad);
      diffuseColor.rgb *= mix(1.02, ${panel ? '0.89' : '0.95'}, stain);
      float dust = (1.0 - smoothstep(0.12, 1.25, vRelayHeight + broad * 0.65)) * vRelayWall;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.64, 0.60, 0.51), dust * 0.55);
      ${kind === 'concrete' || kind === 'coated' ? `
      float runoff = clamp((texture2D(roughnessMap, vNormalMapUv * vec2(0.09, 0.003)).r - 0.64) / 0.36, 0.0, 1.0);
      float drop = max(0.0, vRelayElevation.y - vRelayHeight);
      float extent = vRelayElevation.y - vRelayElevation.x;
      float streak = smoothstep(0.54, 0.69, runoff) * vRelayWall * step(0.5, extent);
      streak *= 1.0 - smoothstep(0.12, min(extent, 0.35 + broad * 2.4), drop);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.63, 0.57, 0.43), streak * 0.72);
      roughnessFactor = mix(roughnessFactor, 0.97, max(streak, dust) * 0.55);
      ` : ''}
      ${kind === 'coated' ? `
      // Broken paint reveals dull steel in small patches; derivative filtering
      // fades the fine chips before they can sparkle down a rifle lane.
      float chip = smoothstep(0.58, 0.72, aggregate) * smoothstep(0.51, 0.64, broad);
      chip *= 1.0 - smoothstep(0.02, 0.07, max(footprint.x, footprint.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.16, 0.13), chip * 0.48);
      roughnessFactor = mix(roughnessFactor, 0.65, chip);
      ` : ''}
      ${kind === 'apron' || kind === 'coated' ? '' : `
      vec2 spacing = vec2(${kind === 'ground' ? '6.0, 5.0' : '2.4, 1.2'});
      vec2 cell = floor(metres / spacing);
      vec2 local = mod(metres, spacing);
      vec2 edgeDistance = min(local, spacing - local);
      // Physical widths, with a pixel-wide analytic filter at grazing angles.
      vec2 seam = 1.0 - smoothstep(vec2(0.016), vec2(0.016) + footprint, edgeDistance);
      seam *= min(vec2(1.0), vec2(0.032) / footprint);
      float joint = max(seam.x, seam.y);
      float pour = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= mix(0.90, 1.06, pour) * mix(1.0, 0.68, joint);
      roughnessFactor = mix(roughnessFactor, 0.99, joint);
      ${kind === 'concrete' ? `
      // Recessed form ties: shading only, never holes through gameplay cover.
      vec2 tieDistance = abs(local - spacing * 0.5);
      float tie = 1.0 - smoothstep(0.021, 0.021 + max(footprint.x, footprint.y), length(tieDistance));
      tie *= min(1.0, 0.042 / max(footprint.x, footprint.y));
      diffuseColor.rgb *= 1.0 - 0.32 * tie;
      // Rust bleed directly beneath recessed tie plugs, never alpha holes.
      float rustWidth = 0.023 + local.y * 0.004;
      float rust = (1.0 - smoothstep(rustWidth, rustWidth + footprint.x, tieDistance.x));
      rust *= smoothstep(0.0, 0.025, spacing.y * 0.5 - local.y)
        * (1.0 - smoothstep(0.03 + pour * 0.10, 0.18 + pour * 0.24, spacing.y * 0.5 - local.y));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.63, 0.46, 0.29), rust * vRelayWall * 0.40);
      ` : ''}
      `}
      #endif
    `);
  };
  material.customProgramCacheKey = () => `relay-surface-v2-${kind}`;
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
