import type { Box } from '../physics.js';

export type EnvironmentPropKey =
  | 'ammo-crate'
  | 'brick-rubble'
  | 'field-telephone'
  | 'freight-wagon-wreck'
  | 'observation-post'
  | 'supply-wagon';

type MapPresentation = 'relay' | 'undertow' | 'switchyard';
type BoxCollision = { readonly kind: 'box'; readonly dimensionsM: readonly [number, number, number] };
type CompoundCollision = { readonly kind: 'compound'; readonly dimensionsM: readonly [number, number, number]; readonly parts: number };
type NoCollision = { readonly kind: 'none' };

export type EnvironmentPropPlacement = {
  readonly id: string;
  readonly map: MapPresentation;
  readonly key: EnvironmentPropKey;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
  readonly dimensionsM: readonly [number, number, number];
  readonly maxCladdingOffsetM: number;
} & (
  | { readonly policy: 'authoritative-box'; readonly collision: BoxCollision }
  | { readonly policy: 'nonblocking-exterior'; readonly collision: CompoundCollision | NoCollision; readonly support: string }
);

const backed = (
  id: string,
  map: MapPresentation,
  key: 'ammo-crate' | 'brick-rubble',
  position: readonly [number, number, number],
  dimensionsM: readonly [number, number, number],
  collisionDimensionsM: readonly [number, number, number],
): EnvironmentPropPlacement => ({
  id, map, key, position, yaw: 0, dimensionsM, maxCladdingOffsetM: .02,
  policy: 'authoritative-box', collision: { kind: 'box', dimensionsM: collisionDimensionsM },
});

export const MAP_ENVIRONMENT_PLACEMENTS: readonly EnvironmentPropPlacement[] = [
  backed('relay-ammo-west', 'relay', 'ammo-crate', [25, 0, 35], [1.2, .65, .62], [1.2, .65, .62]),
  backed('relay-rubble-north', 'relay', 'brick-rubble', [45, 0, 25], [2.4, .8, .65], [2.4, .78, .65]),
  { id: 'relay-field-telephone', map: 'relay', key: 'field-telephone', position: [30, 13.64, -9], yaw: 0,
    dimensionsM: [.28, .22, .22], maxCladdingOffsetM: .018, policy: 'nonblocking-exterior',
    collision: { kind: 'none' }, support: 'relay-observation-post-top' },
  { id: 'relay-observation-post', map: 'relay', key: 'observation-post', position: [30, 10.24, -9], yaw: 0,
    dimensionsM: [2.4, 3.4, 2.4], maxCladdingOffsetM: .018, policy: 'nonblocking-exterior',
    collision: { kind: 'compound', dimensionsM: [2.4, 3.4, 2.4], parts: 6 }, support: 'relay-north-annex-roof' },
  backed('undertow-ammo-south', 'undertow', 'ammo-crate', [25, 0, 60], [1.2, .65, .62], [1.2, .65, .62]),
  backed('undertow-rubble-north', 'undertow', 'brick-rubble', [45, 0, 25], [2.4, .8, .65], [2.4, .78, .65]),
  { id: 'undertow-supply-wagon', map: 'undertow', key: 'supply-wagon', position: [-1.8, 2.8, 30], yaw: 0,
    dimensionsM: [3.6, 2.1, 1.9], maxCladdingOffsetM: .018, policy: 'nonblocking-exterior',
    collision: { kind: 'compound', dimensionsM: [3.6, 2.1, 1.9], parts: 6 }, support: 'undertow-west-loading-plinth' },
  backed('switchyard-ammo-west', 'switchyard', 'ammo-crate', [31, 0, 35], [1.2, .65, .62], [1.2, .65, .62]),
  backed('switchyard-rubble-east', 'switchyard', 'brick-rubble', [115, 0, 35], [2.4, .8, .65], [2.4, .78, .65]),
  { id: 'switchyard-freight-wreck', map: 'switchyard', key: 'freight-wagon-wreck', position: [75, 4.2, 105.6], yaw: 0,
    dimensionsM: [7.4, 2.8, 2.7], maxCladdingOffsetM: .018, policy: 'nonblocking-exterior',
    collision: { kind: 'compound', dimensionsM: [7.4, 2.8, 2.7], parts: 7 }, support: 'switchyard-south-rail-bed' },
];

function collisionBox(placement: EnvironmentPropPlacement): Box | undefined {
  if (placement.policy !== 'authoritative-box') return undefined;
  const [x, y, z] = placement.position;
  const [width, height, depth] = placement.collision.dimensionsM;
  return {
    min: { x: x - width / 2, y, z: z - depth / 2 },
    max: { x: x + width / 2, y: y + height, z: z + depth / 2 },
  };
}

const boxesByMap = Object.freeze({
  relay: MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.map === 'relay').flatMap(placement => collisionBox(placement) ?? []),
  undertow: MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.map === 'undertow').flatMap(placement => collisionBox(placement) ?? []),
  switchyard: MAP_ENVIRONMENT_PLACEMENTS.filter(placement => placement.map === 'switchyard').flatMap(placement => collisionBox(placement) ?? []),
});

export function blockingEnvironmentBoxes(map: MapPresentation): readonly Box[] {
  return boxesByMap[map];
}

export function placementIssues(
  placement: EnvironmentPropPlacement,
  bounds: { readonly width: number; readonly depth: number },
): readonly string[] {
  if (placement.policy === 'authoritative-box') {
    const collision = placement.collision.dimensionsM;
    const visual = placement.dimensionsM;
    const excess = [Math.max(0, (visual[0] - collision[0]) / 2), Math.max(0, visual[1] - collision[1]),
      Math.max(0, (visual[2] - collision[2]) / 2)];
    return excess.some(value => value > placement.maxCladdingOffsetM + 1e-9) ? ['visual_outside_collision'] : [];
  }
  const [x, , z] = placement.position;
  const [width, , depth] = placement.dimensionsM;
  const outside = x + width / 2 <= 0 || x - width / 2 >= bounds.width
    || z + depth / 2 <= 0 || z - depth / 2 >= bounds.depth;
  return outside ? [] : ['nonblocking_decoration_inside_play'];
}
