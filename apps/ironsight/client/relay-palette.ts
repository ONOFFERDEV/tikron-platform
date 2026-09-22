import type { MeshStandardMaterial, MeshStandardMaterialParameters } from 'three';
import { RELAY_FIELD_PATTERNS, RELAY_FIELD_RELIEF } from './relay-field-patterns.js';

/** Brick, lime coping, timber and iron. Shared by the procedural fallback and the
 * original AO bake's material slots, so a colour pass never requires changing
 * collision geometry or re-baking unchanged occlusion. Signs own their accents. */
export const RELAY_FINISH = {
  concrete: { color: 0x987e67, roughness: 0.96, metalness: 0 },
  pale: { color: 0xa59a80, roughness: 0.94, metalness: 0 },
  // Existing coping and foundation cladding share faces with the concrete bake.
  // Resolve depth ties consistently in both the fallback and baked materials.
  dark: { color: 0x75614b, roughness: 0.9, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
  metal: { color: 0x55574d, roughness: 0.82, metalness: 0.32 },
  amber: { color: 0x897252, roughness: 0.9, metalness: 0 },
  teal: { color: 0x727359, roughness: 0.9, metalness: 0 },
  paint: { color: 0xaca17e, roughness: 1, metalness: 0 },
  ramp: { color: 0x817057, roughness: 0.9, metalness: 0 },
} as const satisfies Record<string, MeshStandardMaterialParameters>;

// Slot order is first use in dump-architecture, not object property order.
const BAKE_SLOTS = ['concrete', 'pale', 'dark', 'teal', 'metal', 'amber', 'paint',
  'ramp', 'ramp', 'ramp', 'ramp'] as const;

export function relayBakedFinish(name: string): keyof typeof RELAY_FINISH | undefined {
  const match = /^relay-(\d+)$/.exec(name);
  return match ? BAKE_SLOTS[Number(match[1])] : undefined;
}

/** Keep the existing dressing UVs and PBR maps; fade its painted colour at
 * load. Never applied to operators, gameplay cues or another map's assets. */
export function fadeRelayDressing(material: MeshStandardMaterial): void {
  const village = material.name === 'signal-village-masonry';
  material.roughness = Math.max(material.roughness, 0.84);
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float fieldValue = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(vec3(fieldValue), diffuseColor.rgb, 0.22) * vec3(0.79, 0.77, 0.68);
    `);
    if (village) {
      shader.vertexShader = `varying vec3 vVillagePosition; varying vec3 vVillageNormal;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vVillagePosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vVillageNormal = normalize(mat3(modelMatrix) * normal);
        `);
      shader.fragmentShader = `varying vec3 vVillagePosition; varying vec3 vVillageNormal;\n${shader.fragmentShader}`
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          vec2 metres = abs(vVillageNormal.x) > abs(vVillageNormal.z) ? vVillagePosition.zy : vVillagePosition.xy;
          vec2 footprint = max(fwidth(metres), vec2(0.001));
          float vRelayWall = 1.0 - smoothstep(0.05, 0.2, abs(vVillageNormal.y));
          float fieldRelief = 0.0;
          ${RELAY_FIELD_PATTERNS.brick}
          float soot = smoothstep(0.35, 0.88, sin(metres.x * 1.71) * sin(metres.x * 0.43 + metres.y * 0.08));
          diffuseColor.rgb *= 1.0 - soot * vRelayWall * 0.20;
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${RELAY_FIELD_RELIEF}`);
    }
  };
  material.customProgramCacheKey = () => village ? 'relay-signal-village-v2' : 'relay-dressing-field-v1';
  material.needsUpdate = true;
}
