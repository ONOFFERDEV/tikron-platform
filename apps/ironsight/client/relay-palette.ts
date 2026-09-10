import type { MeshStandardMaterial, MeshStandardMaterialParameters } from 'three';

/** Issued industrial finishes. Shared by the procedural fallback and the
 * original AO bake's material slots, so a colour pass never requires changing
 * collision geometry or re-baking unchanged occlusion. Signs own their accents. */
export const RELAY_FINISH = {
  concrete: { color: 0x929185, roughness: 0.96, metalness: 0 },
  pale: { color: 0xa4a18f, roughness: 0.88, metalness: 0 },
  // Existing coping and foundation cladding share faces with the concrete bake.
  // Resolve depth ties consistently in both the fallback and baked materials.
  dark: { color: 0x383d36, roughness: 0.86, metalness: 0.18,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
  metal: { color: 0x64665c, roughness: 0.78, metalness: 0.32 },
  amber: { color: 0x887958, roughness: 0.9, metalness: 0 },
  teal: { color: 0x637166, roughness: 0.9, metalness: 0 },
  paint: { color: 0xaca17e, roughness: 1, metalness: 0 },
  ramp: { color: 0x686d63, roughness: 0.86, metalness: 0.18 },
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
  material.roughness = Math.max(material.roughness, 0.84);
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float fieldValue = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(vec3(fieldValue), diffuseColor.rgb, 0.22) * vec3(0.79, 0.77, 0.68);
    `);
  };
  material.customProgramCacheKey = () => 'relay-dressing-field-v1';
  material.needsUpdate = true;
}
