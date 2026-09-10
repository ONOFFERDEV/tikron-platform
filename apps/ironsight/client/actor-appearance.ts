import * as THREE from 'three';
import { kitShader } from './operator-kit.js';

export const ENEMY_HIGHLIGHTS = ['team', 'yellow', 'violet'] as const;
export type EnemyHighlight = typeof ENEMY_HIGHLIGHTS[number];
export function enemyHighlight(value: unknown): EnemyHighlight {
  return value === 'yellow' || value === 'violet' ? value : 'team';
}

/** Team colours remain the default. Only a known opponent gets the override;
 * FFA treats every remote operator as hostile, regardless of its team field. */
export function actorColor(base: number, team: number, viewerTeam: number | undefined,
  teamless: boolean, highlight: EnemyHighlight): number {
  const hostile = teamless || (viewerTeam !== undefined && team !== viewerTeam);
  return hostile && highlight !== 'team' ? (highlight === 'yellow' ? 0xffdf55 : 0xd995ff) : base;
}

/** One opaque, depth-tested character draw. The rim is emissive light in the
 * existing material, not geometry, a light, a screen effect or an x-ray outline.
 * Colour changes touch uniforms only; every choice uses the same shader. */
export class ActorAppearance {
  readonly materials: THREE.MeshStandardMaterial[] = [];
  private color: number;

  constructor(root: THREE.Object3D, color: number) {
    this.color = color;
    const clones = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    root.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const fieldKit = !!node.geometry.getAttribute('fieldKit');
      const tint = (source: THREE.Material) => {
        let material = clones.get(source);
        if (material) return material;
        material = source instanceof THREE.MeshStandardMaterial && source.map
          ? source.clone() : new THREE.MeshStandardMaterial({ roughness: .7, metalness: .05 });
        material.color.setHex(color);
        // Keep cover occlusion invariant for every accessibility choice.
        material.depthTest = true;
        material.depthWrite = true;
        material.transparent = false;
        const rim = { value: material.color };
        material.onBeforeCompile = shader => {
          if (fieldKit) kitShader(shader);
          shader.uniforms.actorRimColor = rim;
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
            '#include <common>\nuniform vec3 actorRimColor;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
            #include <emissivemap_fragment>
            float actorEdge = 1.0 - abs(dot(normal, normalize(vViewPosition)));
            float actorRange = smoothstep(10.0, 45.0, length(vViewPosition));
            totalEmissiveRadiance += actorRimColor * actorEdge * actorEdge * (0.42 + 0.20 * actorRange);
          `);
        };
        material.customProgramCacheKey = () => fieldKit ? 'ironsight-field-kit-rim-v1' : 'ironsight-actor-rim-v1';
        clones.set(source, material);
        this.materials.push(material);
        return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
    });
  }

  setColor(color: number): void {
    if (color === this.color) return;
    this.color = color;
    for (const material of this.materials) material.color.setHex(color);
  }
}
