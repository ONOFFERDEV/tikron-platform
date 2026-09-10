import * as T from 'three';

export type SwitchyardSurface = 'ground' | 'concrete' | 'apron' | 'coated' | 'steel' | 'deck';

/** The original baked kit's material slots: concrete shell, dark steel, pale
 * enamel, teal/amber paint, switchgear steel, then the four ramp directions. */
export function switchyardSurfaceKind(name: string): SwitchyardSurface {
  if (name === 'switchyard-0') return 'concrete';
  if (/^switchyard-[6-9]$/.test(name)) return 'deck';
  return name === 'switchyard-1' || name === 'switchyard-5' ? 'steel' : 'coated';
}

/** Recover rectangle pairs from the original kit at load, including the ramps'
 * duplicated triangle corners. Both triangles must share a diagonal, have the
 * same normal and form a rectangle. Other regions get a zero mask. Positions,
 * normals, paint/AO UVs and indices stay put; no work during play. */
export function applySwitchyardPanels(mesh: T.Mesh): void {
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  const index = geometry.index, normal = geometry.getAttribute('normal');
  const panel = new Float32Array(position.count * 4);
  if (normal) {
    mesh.updateWorldMatrix(true, false);
    const p = new T.Vector3(), origin = new T.Vector3(), faceNormal = new T.Vector3();
    const count = index?.count ?? position.count;
    for (let offset = 0; offset + 5 < count; offset += 6) {
      const vertices = Array.from({ length: 6 }, (_, i) => index ? index.getX(offset + i) : offset + i);
      const first = vertices[0]!;
      faceNormal.fromBufferAttribute(normal, first);
      if (vertices.some(i => p.fromBufferAttribute(normal, i).dot(faceNormal) < 0.9999)) continue;
      const points = vertices.map(i => new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
      const unique = points.filter((point, i) => points.findIndex(other => other.equals(point)) === i);
      if (unique.length !== 4) continue;
      origin.copy(unique[0]!);
      const edges = unique.slice(1).map(point => point.clone().sub(origin)).sort((a, b) => a.lengthSq() - b.lengthSq());
      const u = edges[0]!, v = edges[1]!, diagonal = edges[2]!;
      const width = u.length(), height = v.length();
      if (width < 0.025 || height < 0.025 || Math.abs(u.dot(v)) > width * height * 0.001 ||
          p.copy(u).add(v).distanceTo(diagonal) > 0.001) continue;
      const shared = points.slice(0, 3).filter(point => points.slice(3).some(other => other.equals(point)));
      if (shared.length !== 2 || Math.abs(shared[0]!.distanceTo(shared[1]!) - diagonal.length()) > 0.001) continue;
      u.divideScalar(width); v.divideScalar(height);
      for (const i of vertices) {
        p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).sub(origin);
        panel.set([p.dot(u), p.dot(v), width, height], i * 4);
      }
    }
  }
  geometry.setAttribute('switchyardPanel', new T.BufferAttribute(panel, 4));
}

/** Original metric finish in the existing opaque PBR pass. Mipmapped fine grain,
 * derivative-filtered joints, worn panel edges and shallow anti-slip tread.
 * Fixed shaders/textures are prepared before play; no lights or extra passes. */
export function finishSwitchyardSurface(material: T.MeshStandardMaterial, kind: SwitchyardSurface): void {
  const panelled = kind === 'steel' || kind === 'coated' || kind === 'deck';
  material.userData.switchyardSurface = kind;
  material.onBeforeCompile = shader => {
    if (panelled) {
      shader.vertexShader = `attribute vec4 switchyardPanel;\nvarying vec4 vSwitchyardPanel;\nvarying float vSwitchyardUp;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vSwitchyardPanel = switchyardPanel;
          vSwitchyardUp = abs(normalize(mat3(modelMatrix) * normal).y);
        `);
      shader.fragmentShader = `varying vec4 vSwitchyardPanel;\nvarying float vSwitchyardUp;\n${shader.fragmentShader}`;
    }
    if (kind === 'ground') shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        diffuseColor.rgb *= vec3(texture2D(map, vMapUv).r);
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      float switchyardWear = 0.0;
      vec2 switchyardTreadNormal = vec2(0.0);
      #ifdef USE_ROUGHNESSMAP
      float grain = texture2D(roughnessMap, vRoughnessMapUv).r;
      float aggregate = clamp((grain - 0.64) / 0.36, 0.0, 1.0);
      vec2 metres = vNormalMapUv * 0.8;
      vec2 footprint = max(fwidth(metres), vec2(0.001));
      roughnessFactor *= ${panelled ? 'mix(0.94, 1.02, aggregate)' : 'grain'};
      diffuseColor.rgb *= mix(${panelled ? '0.98, 1.02' : '0.95, 1.05'}, aggregate);
      ${kind === 'ground' || kind === 'concrete' ? `
      vec2 spacing = vec2(${kind === 'ground' ? '6.0, 5.0' : '2.4, 1.2'});
      vec2 local = mod(metres, spacing), cell = floor(metres / spacing);
      vec2 seam = 1.0 - smoothstep(vec2(0.012), vec2(0.012) + footprint, min(local, spacing - local));
      seam *= min(vec2(1.0), vec2(0.024) / footprint);
      float joint = max(seam.x, seam.y);
      float pour = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= mix(0.98, 1.02, pour) * mix(1.0, 0.70, joint);
      roughnessFactor = mix(roughnessFactor, 0.98, joint);
      ` : ''}
      ${panelled ? `
      vec2 edgeDistance = min(vSwitchyardPanel.xy, vSwitchyardPanel.zw - vSwitchyardPanel.xy);
      vec2 pixel = max(fwidth(vSwitchyardPanel.xy), vec2(0.001));
      vec2 edge = (1.0 - smoothstep(vec2(0.012), vec2(0.012) + pixel, edgeDistance))
        * min(vec2(1.0), vec2(0.024) / pixel);
      float hasPanel = step(0.08, min(vSwitchyardPanel.z, vSwitchyardPanel.w));
      switchyardWear = max(edge.x, edge.y) * hasPanel * smoothstep(0.34, 0.66, aggregate);
      // Rubbed paint exposes quiet grey steel; dirt collects behind the edge.
      float grime = (1.0 - smoothstep(0.02, 0.09, min(edgeDistance.x, edgeDistance.y))) * hasPanel;
      diffuseColor.rgb *= 1.0 - 0.08 * grime;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.31, 0.30), switchyardWear * ${kind === 'coated' ? '0.32' : '0.44'});
      roughnessFactor = mix(roughnessFactor, 0.48, switchyardWear);
      ` : ''}
      ${kind === 'steel' ? `
      // Fine rolled finish loses contrast before it becomes a grazing moire.
      float brushed = sin(metres.y * 310.0) * (1.0 - smoothstep(0.0025, 0.008, footprint.y));
      roughnessFactor += brushed * 0.025;
      ` : ''}
      ${kind === 'deck' ? `
      // Raised lozenges on upward ramp faces only; the sides remain flat steel.
      vec2 treadCell = floor(metres / 0.18), q = mod(metres, 0.18) - 0.09;
      float alternate = mod(treadCell.x + treadCell.y, 2.0) * 2.0 - 1.0;
      vec2 axis = vec2(0.707107, 0.707107 * alternate);
      vec2 crossAxis = vec2(-axis.y, axis.x);
      float along = dot(q, axis), across = dot(q, crossAxis);
      float ridgeDistance = abs(across) + max(abs(along) - 0.045, 0.0);
      float filterWidth = max(footprint.x, footprint.y);
      float top = smoothstep(0.6, 0.9, vSwitchyardUp);
      float fade = (1.0 - smoothstep(0.025, 0.075, filterWidth)) * top;
      float tread = (1.0 - smoothstep(0.007, 0.013 + filterWidth, ridgeDistance)) * fade;
      diffuseColor.rgb *= 1.0 + 0.09 * tread;
      roughnessFactor = mix(roughnessFactor, 0.46, tread);
      switchyardTreadNormal = crossAxis * sign(across) * tread * 0.22;
      ` : ''}
      #endif
    `);
    if (panelled) shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `
      #include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, 0.62, switchyardWear);
    `);
    if (kind === 'deck') shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy = mapN.xy * normalScale + switchyardTreadNormal;'));
  };
  material.customProgramCacheKey = () => `switchyard-surface-v1-${kind}`;
  material.needsUpdate = true;
}
