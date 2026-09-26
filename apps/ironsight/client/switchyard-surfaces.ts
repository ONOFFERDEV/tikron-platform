import * as T from 'three';
import { applyRelayWeathering } from './relay-weathering.js';
import { RELAY_FIELD_PATTERNS, RELAY_FIELD_RELIEF } from './relay-field-patterns.js';
import { switchyardBakedFinish } from './switchyard-palette.js';
import { UNDERTOW_SANDBAG } from './undertow-surfaces.js';

/** Stacked ammunition boxes: 0.72 x 0.40 m faces in columns that shift every
 * third course, each with a batten frame, dark gaps, a painted/raw tint and a
 * pale stencil panel on some boxes. Existing metre UVs only; the detail fades
 * to a quiet brown below pixel size. */
const SWITCHYARD_CRATES = `
    vec2 crateSize = vec2(0.72, 0.40);
    float crateRow = floor(metres.y / crateSize.y);
    vec2 crateUv = metres + vec2(fract(floor(crateRow / 3.0) * 0.37) * crateSize.x, 0.0);
    vec2 crateCell = floor(crateUv / crateSize);
    vec2 crateLocal = mod(crateUv, crateSize);
    vec2 crateEdge = min(crateLocal, crateSize - crateLocal);
    float crateDetail = 1.0 - smoothstep(0.04, 0.18, max(footprint.x, footprint.y));
    vec2 crateGap = 1.0 - smoothstep(vec2(0.014), vec2(0.022) + footprint, crateEdge);
    float gap = max(crateGap.x, crateGap.y) * crateDetail;
    vec2 crateFrame = 1.0 - smoothstep(vec2(0.055), vec2(0.06) + footprint, crateEdge);
    float frame = max(crateFrame.x, crateFrame.y) * crateDetail;
    float crateId = fract(sin(dot(crateCell, vec2(41.3, 289.1))) * 43758.5453);
    vec3 crateTint = mix(vec3(0.62, 0.70, 0.50), vec3(1.14, 1.02, 0.84), step(0.6, crateId));
    crateTint *= mix(0.78, 1.12, fract(crateId * 7.3));
    vec2 stencilEdge = abs(crateLocal - crateSize * 0.5) - crateSize * vec2(0.2, 0.12);
    float stencil = (1.0 - smoothstep(0.0, 0.004 + footprint.x, max(stencilEdge.x, stencilEdge.y)))
      * step(0.55, fract(crateId * 3.1)) * crateDetail;
    diffuseColor.rgb *= mix(vec3(1.0), crateTint * mix(1.0, 0.72, frame), crateDetail);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.58, 0.47), stencil * 0.28);
    diffuseColor.rgb *= 1.0 - gap * 0.82;
    // Shell-fire scorch: about one 2.9 x 1.6 m cell in eight carries a charred
    // blotch with a ragged grain-broken edge. Metre UVs restart on every face,
    // so the cell is keyed by world position. Pure colour; no new map or pass.
    vec2 burnUv = vec2((vSwitchyardWorld.x + vSwitchyardWorld.y) / 2.9, metres.y / 1.6);
    vec3 burnCell = vec3(floor(burnUv), floor(vSwitchyardWorld.x / 2.9) - floor(vSwitchyardWorld.y / 2.9));
    float burnt = step(0.875, fract(sin(dot(burnCell, vec3(7.13, 13.71, 3.97))) * 43758.5453));
    float burnEdge = length((fract(burnUv) - 0.5) * vec2(2.0, 2.4)) + (aggregate - 0.5) * 0.7;
    float soot = burnt * (1.0 - smoothstep(0.55, 1.05, burnEdge));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.03, 0.026), soot * 0.94);
    roughnessFactor = mix(roughnessFactor, 1.0, soot);
    fieldRelief = ((1.0 - gap) * 0.012 + frame * 0.004) * crateDetail;
    roughnessFactor = max(roughnessFactor, 0.84);
`;

export const SWITCHYARD_PHYSICAL_SURFACES = {
  mud: { roughness: 0.96, metalness: 0 },
  gravel: { roughness: 0.92, metalness: 0 },
  wood: { roughness: 0.84, metalness: 0 },
  concrete: { roughness: 0.88, metalness: 0 },
  metal: { roughness: 0.78, metalness: 0.32 },
} as const;
export type SwitchyardSurface = 'ground' | 'concrete' | 'apron' | 'coated' | 'steel' | 'deck';

/** Baked material slot to surface family, through the palette's slot table:
 * brick shell, deck ramps, iron and box stacks, then timber/burlap coats. */
export function switchyardSurfaceKind(name: string): SwitchyardSurface {
  const finish = switchyardBakedFinish(name);
  if (finish === 'concrete') return 'concrete';
  if (finish === 'deck') return 'deck';
  return finish === 'steel' || finish === 'housing' ? 'steel' : 'coated';
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

/** Keep the authored ledge and height in the same fixed space as metric UVs.
 * Packing them at load makes rain wear travel with the hoist/counterweight.
 * Split corners retain the exact rendered triangle stream and baked AO. */
export function applySwitchyardWeathering(mesh: T.Mesh): void {
  applyRelayWeathering(mesh);
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal'), elevation = geometry.getAttribute('relayElevation');
  const weather = new Float32Array(position.count * 4);
  const p = new T.Vector3(), n = new T.Vector3(), basis = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(normal, i).applyNormalMatrix(basis);
    weather.set([p.y, elevation.getX(i), elevation.getY(i), 1 - Math.abs(n.y)], i * 4);
  }
  geometry.setAttribute('switchyardWeather', new T.BufferAttribute(weather, 4));
  geometry.deleteAttribute('relayElevation');
}

/** Original metric finish in the existing opaque PBR pass. Mipmapped fine grain,
 * derivative-filtered joints, worn panel edges and plank ramps.
 * Fixed shaders/textures are prepared before play; no lights or extra passes. */
export function finishSwitchyardSurface(material: T.MeshStandardMaterial, kind: SwitchyardSurface): void {
  // Depot conversion: olive/ochre are timber, pale is burlap sandbag, the
  // housing slot is stacked ammunition boxes and the concrete shell is brick on
  // its vertical faces. All patterns reuse the resident grain tile only.
  const finish = switchyardBakedFinish(material.name);
  // Deck ramps are plank ramps: the wood pattern replaced their iron tread plate.
  const timber = kind === 'deck' || (kind === 'coated' && (finish === 'olive' || finish === 'ochre'));
  const sandbag = kind === 'coated' && finish === 'pale';
  const crates = finish === 'housing';
  const panelled = !crates && (kind === 'steel' || (kind === 'coated' && !timber && !sandbag));
  const weathered = panelled || timber || sandbag || crates || kind === 'concrete';
  const pattern = timber ? RELAY_FIELD_PATTERNS.wood : sandbag ? UNDERTOW_SANDBAG : crates ? SWITCHYARD_CRATES
    : kind === 'concrete' ? RELAY_FIELD_PATTERNS.brick.replaceAll('vRelayWall', 'vertical') : '';
  const variant = timber ? 'timber' : sandbag ? 'sandbag' : crates ? 'crates' : 'plain';
  material.userData.switchyardSurface = kind;
  const surface = kind === 'ground' ? 'gravel' : kind === 'apron' ? 'mud' : kind === 'concrete' || sandbag ? 'concrete'
    : timber || crates ? 'wood' : 'metal';
  material.setValues(SWITCHYARD_PHYSICAL_SURFACES[surface]);
  material.userData.physicalSurface = surface;
  material.onBeforeCompile = shader => {
    if (weathered) {
      shader.vertexShader = `attribute vec4 switchyardWeather; varying vec4 vSwitchyardWeather;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSwitchyardWeather = switchyardWeather;');
      shader.fragmentShader = `varying vec4 vSwitchyardWeather;\n${shader.fragmentShader}`;
    }
    if (crates) {
      shader.vertexShader = `varying vec2 vSwitchyardWorld;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvSwitchyardWorld = (modelMatrix * vec4(position, 1.0)).xz;');
      shader.fragmentShader = `varying vec2 vSwitchyardWorld;\n${shader.fragmentShader}`;
    }
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
      float switchyardWet = 0.0;
      float fieldRelief = 0.0;
      #ifdef USE_ROUGHNESSMAP
      float grain = texture2D(roughnessMap, vRoughnessMapUv).r;
      float aggregate = clamp((grain - 0.64) / 0.36, 0.0, 1.0);
      vec2 metres = vNormalMapUv * 0.8;
      vec2 footprint = max(fwidth(metres), vec2(0.001));
      roughnessFactor *= ${panelled ? 'mix(0.94, 1.02, aggregate)' : 'grain'};
      diffuseColor.rgb *= mix(${panelled ? '0.98, 1.02' : '0.95, 1.05'}, aggregate);
      float broad = clamp((texture2D(roughnessMap, vNormalMapUv * 0.017 + vec2(0.31, 0.73)).r - 0.64) / 0.36, 0.0, 1.0);
      diffuseColor.rgb *= mix(1.02, ${weathered ? '0.93' : '0.95'}, smoothstep(0.40, 0.65, broad));
      ${weathered ? `
      float vertical = smoothstep(0.5, 0.95, vSwitchyardWeather.w);
      float drop = max(0.0, vSwitchyardWeather.z - vSwitchyardWeather.x);
      float extent = vSwitchyardWeather.z - vSwitchyardWeather.y;
      float runoff = clamp((texture2D(roughnessMap, vNormalMapUv * vec2(0.21, 0.003)).r - 0.64) / 0.36, 0.0, 1.0);
      float rust = smoothstep(0.50, 0.68, runoff) * vertical * step(0.5, extent);
      rust *= 1.0 - smoothstep(0.07, max(0.2, min(extent, 0.22 + broad * 1.25)), drop);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.35, 0.20), rust * 0.62);
      float silt = (1.0 - smoothstep(0.08, 0.6 + broad * 0.3, vSwitchyardWeather.x)) * vertical;
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.47, 0.46, 0.38), silt * 0.62);
      roughnessFactor = mix(roughnessFactor, 0.97, rust * 0.5);
      ` : ''}
      ${kind === 'ground' ? `
      // Irregular shallow wet patches on asphalt. The existing R8 detail tile
      // supplies both scales; reflect only the resident sky, never hidden actors.
      float wetField = clamp((texture2D(roughnessMap, vNormalMapUv * 0.004 + vec2(0.67, 0.19)).r - 0.64) / 0.36, 0.0, 1.0);
      switchyardWet = smoothstep(0.58, 0.67, wetField + (broad - 0.5) * 0.16);
      diffuseColor.rgb *= vec3(0.80, 0.76, 0.68); // trodden cinder and mud, not pale asphalt
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.52, 0.54, 0.50), switchyardWet);
      roughnessFactor = mix(roughnessFactor, 0.23, switchyardWet);
      ` : ''}
      ${kind === 'apron' ? 'diffuseColor.rgb *= vec3(0.74, 0.70, 0.62); // churned mud beyond the yard' : ''}
      ${kind === 'concrete' ? `
      vec2 spacing = vec2(2.4, 1.2);
      vec2 local = mod(metres, spacing), cell = floor(metres / spacing);
      vec2 seam = 1.0 - smoothstep(vec2(0.012), vec2(0.012) + footprint, min(local, spacing - local));
      seam *= min(vec2(1.0), vec2(0.024) / footprint);
      float joint = max(seam.x, seam.y) * (1.0 - vertical);
      float pour = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= mix(0.98, 1.02, pour) * mix(1.0, 0.70, joint);
      roughnessFactor = mix(roughnessFactor, 0.98, joint);
      ` : ''}
      ${pattern ? `{ ${pattern} }` : ''}
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
      // Corrosion gathers behind exposed edges, with a few fine broken chips.
      float corrosion = grime * smoothstep(0.43, 0.65, broad) * (1.0 - switchyardWear);
      float chip = smoothstep(0.59, 0.73, aggregate) * smoothstep(0.48, 0.65, broad);
      chip *= 1.0 - smoothstep(0.02, 0.07, max(footprint.x, footprint.y));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.34, 0.19), corrosion * 0.65);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.08, 0.055), chip * ${kind === 'coated' ? '0.4' : '0.18'});
      ` : ''}
      ${kind === 'steel' ? `
      // Fine rolled finish loses contrast before it becomes a grazing moire.
      float brushed = sin(metres.y * 310.0) * (1.0 - smoothstep(0.0025, 0.008, footprint.y));
      roughnessFactor += brushed * 0.025;
      ` : ''}
      #endif
    `);
    if (panelled) shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `
      #include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, 0.62, switchyardWear);
    `);
    if (pattern) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps + RELAY_FIELD_RELIEF);
    if (kind === 'ground') shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy = mapN.xy * normalScale * mix(1.0, 0.12, switchyardWet);'));
  };
  material.customProgramCacheKey = () => `switchyard-surface-v3-${kind}-${variant}`;
  material.needsUpdate = true;
}
