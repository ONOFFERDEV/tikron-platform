/** Original exterior architecture. Every rotated extent remains outside the
 * playable rectangle, so this batch cannot add cover between playable points. */
export type RelaySiteMaterial = 'concrete' | 'pale' | 'dark' | 'metal' | 'amber' | 'teal' | 'paint';
export interface RelaySitePart {
  readonly material: RelaySiteMaterial;
  readonly x: number; readonly y: number; readonly z: number;
  readonly w: number; readonly h: number; readonly d: number; readonly yaw: number;
}
type SitePosition = readonly [x: number, y: number, z: number, yaw?: number];
type SiteSize = readonly [width: number, height: number, depth: number];

function sitePart(material: RelaySiteMaterial, position: SitePosition, size: SiteSize): RelaySitePart {
  const [x, y, z, yaw = 0] = position, [w, h, d] = size;
  return { material, x, y, z, w, h, d, yaw };
}

/** The retained export now supplies a damaged brick works roof: corbelled flues,
 * broken parapets and exposed timber, all supported by the original 11.24 m slab. */
export function relayWorkshopPlant(): RelaySitePart[] {
  const parts: RelaySitePart[] = [];
  const add = (material: RelaySiteMaterial, position: SitePosition, size: SiteSize) =>
    parts.push(sitePart(material, position, size));
  for (const [x, z, height] of [[-5.5, 39.8, 5.2], [-8.2, 63.7, 3.7]] as const) {
    const crown = 11.24 + height;
    add('concrete', [x, 11.24 + height / 2, z], [1.75, height, 1.95]);
    add('pale', [x, 11.46, z], [2.25, .44, 2.45]);
    add('concrete', [x, crown - .33, z], [2.05, .32, 2.25]);
    add('pale', [x, crown - .10, z], [2.18, .14, 2.38]);
    // A recessed soot bed inside four brick lips gives the flue a real opening.
    add('dark', [x, crown + .02, z], [1.65, .12, 1.85]);
    for (const dx of [-.89, .89]) add('concrete', [x + dx, crown + .22, z], [.28, .44, 2.15]);
    for (const dz of [-.94, .94]) add('concrete', [x, crown + .22, z + dz], [1.5, .44, .28]);
  }
  // Unequal surviving parapet lengths expose the roof's broken timber ends.
  for (const [z, length, height] of [[35.1, 5.8, .8], [48.2, 9.4, 1.1], [60.4, 4.6, .55], [69.8, 3.8, .9]] as const) {
    add('concrete', [-.42, 11.24 + height / 2, z], [.72, height, length]);
    add('pale', [-.42, 11.24 + height + .09, z - .5], [.78, .18, length - 1]);
    add('concrete', [-.42, 11.24 + height + .18, z + length / 2 - .35], [.72, .36, .7]);
  }
  for (const [z, reach] of [[42.5, 4.7], [44.1, 3.4], [55.2, 5.8], [57.1, 4.2], [65.1, 3.1]] as const) {
    add('dark', [-2.4 - reach / 2, 11.44, z], [reach, .4, .28]);
    add('amber', [-2.65, 11.35, z + .3], [.65, .22, .85]);
  }
  // Bricked-up repairs keep the facade solid; shallow toothed edges read as
  // missing render rather than surface-mounted industrial service equipment.
  for (const [z, width, y, height] of [[37.7, 2.2, 4.2, 4.5], [54.3, 3.5, 5.2, 6.2], [69, 1.7, 3.7, 3.6]] as const) {
    add('pale', [-.025, y, z], [.026, height, width]);
    for (let row = 0; row < 4; row++) {
      const side = row % 2 === 0 ? -1 : 1;
      add('concrete', [-.013, y - height / 2 + .3 + row * .7, z + side * width / 2], [.024, .28, .65]);
    }
  }
  return parts;
}

export function relaySiteBoundary(width: number, depth: number): RelaySitePart[] {
  const parts: RelaySitePart[] = [];
  const add = (material: RelaySiteMaterial, position: SitePosition, size: SiteSize) =>
    parts.push(sitePart(material, position, size));

  // West brick works: the exact old shell and roof remain continuous. Broad
  // brick piers, stone lintels and narrow boarded lights replace sheet cladding.
  for (const [from, to, height, span] of [[0, 32, 9, 18], [32, 72, 11, 24], [72, depth, 8, 15]] as const) {
    const length = to - from, mid = (from + to) / 2;
    add('concrete', [-span / 2 - .04, height / 2, mid], [span, height, length]);
    add('dark', [-span / 2 - .04, height + .12, mid], [span + .06, .24, length]);
    add('pale', [-.2, .6, mid], [.38, 1.2, length]);
    add('pale', [-.12, height - .22, mid], [.20, .26, length]);
    for (let z = from + 2; z < to - 1; z += 6) {
      add('concrete', [-.26, height / 2, z], [.48, height, .62]);
      add('pale', [-.25, height - .7, z], [.46, .25, .88]);
      add('dark', [-.026, height - 2, z + 2.4], [.022, 1.7, 2.1]);
      add('teal', [-.010, height - 2, z + 2.4], [.008, 1.52, 1.9]);
      add('pale', [-.018, height - 1.06, z + 2.4], [.032, .20, 2.4]);
      add('dark', [-.004, height - 2, z + 2.4], [.004, 1.52, .08]);
    }
    // A surviving stepped masonry gable above each unequal hall bay.
    for (const [rise, run] of [[.44, 7], [1.05, 4.6], [1.57, 2.2]] as const) {
      add('concrete', [-.5, height + rise, mid - 3], [.8, .68, run]);
      add('pale', [-.5, height + rise + .36, mid - 3], [.84, .10, run]);
    }
  }
  // Closed double timber doors: vertical planks, central stiles and two iron
  // strap hinges. They remain backed by the boundary mass, never fake routes.
  for (const z of [16, 46, 62, 84]) {
    add('dark', [-.024, 2.6, z], [.028, 5, 5.2]);
    add('amber', [-.013, 2.55, z], [.012, 4.7, 4.8]);
    for (let dz = -2.1; dz <= 2.1; dz += .6) add('dark', [-.005, 2.55, z + dz], [.004, 4.7, .035]);
    add('dark', [-.007, 2.55, z], [.01, 4.7, .13]);
    for (const y of [1.3, 3.8]) add('metal', [-.004, y, z], [.006, .10, 4.5]);
    add('pale', [-.06, 5.22, z], [.10, .34, 5.7]);
    for (const dz of [-2.65, 2.65]) add('pale', [-.06, 2.6, z + dz], [.10, 5.2, .28]);
  }

  // East stores keep their original lower-to-taller envelope. Solid masonry,
  // pale stringcourses and shutters replace corrugated sides and roller doors.
  for (const [from, to, height, span] of [[0, 18, 7, 10], [18, 80, 8.4, 20], [80, depth, 12, 28]] as const) {
    const mid = (from + to) / 2, length = to - from;
    add('concrete', [width + span / 2 + .04, height / 2, mid], [span, height, length]);
    add('dark', [width + span / 2 + .04, height + .14, mid], [span + .06, .28, length]);
    add('pale', [width + .2, .75, mid], [.38, 1.5, length]);
    add('pale', [width + .08, height - .35, mid], [.14, .22, length]);
    for (let z = from + 1; z < to - 1; z += 6) {
      add('concrete', [width + .27, height / 2, z], [.5, height, .60]);
      add('pale', [width + .25, height - .78, z], [.46, .24, .9]);
      add('dark', [width + .026, height - 2, z + 2.4], [.022, 1.55, 1.8]);
      add('amber', [width + .01, height - 2, z + 2.4], [.008, 1.38, 1.65]);
      add('dark', [width + .004, height - 2, z + 2.4], [.004, 1.38, .09]);
    }
    for (const [offset, run, rise] of [[-length / 3, 4.2, .65], [length / 4, 6.8, 1.05]] as const) {
      add('concrete', [width + .5, height + rise / 2 + .28, mid + offset], [.8, rise, run]);
      add('pale', [width + .5, height + rise + .34, mid + offset - .45], [.86, .12, run - .9]);
    }
  }
  for (const z of [28, 44, 60, 74]) {
    add('dark', [width + .024, 2.45, z], [.028, 4.7, 5.2]);
    add('teal', [width + .013, 2.45, z], [.012, 4.4, 4.8]);
    for (let dz = -2.1; dz <= 2.1; dz += .6) add('dark', [width + .005, 2.45, z + dz], [.004, 4.4, .035]);
    for (const y of [1.25, 3.6]) add('metal', [width + .004, y, z], [.006, .10, 4.5]);
    add('pale', [width + .06, 4.98, z], [.10, .32, 5.7]);
    for (const dz of [-2.65, 2.65]) add('pale', [width + .06, 2.45, z + dz], [.10, 4.9, .28]);
  }

  // North station annexes flank the unchanged low emplacement wall.
  add('concrete', [width / 2, 1.45, -.4], [width, 2.9, .8]);
  add('pale', [width / 2, 2.82, -.4], [width, .16, .8]);
  for (const [from, to, height, span] of [[0, 53, 10, 17], [98, width, 7.2, 13]] as const) {
    const mid = (from + to) / 2, length = to - from;
    add('concrete', [mid, height / 2, -span / 2 - .9], [length, height, span]);
    add('dark', [mid, height + .12, -span / 2 - .9], [length, .24, span]);
    add('pale', [mid, height - .3, -.86], [length, .24, .08]);
    for (let x = from + 2; x < to - 2; x += 6) {
      add('concrete', [x, height / 2, -.86], [.6, height, .08]);
      add('dark', [x + 1.8, height - 2, -.83], [1.8, 1.6, .04]);
      add('teal', [x + 1.8, height - 2, -.803], [1.6, 1.4, .01]);
      add('pale', [x + 1.8, height - 1.1, -.80], [2.1, .20, .02]);
    }
  }
  // Timber shelter remnants occupy the former utility gantry footprint.
  for (const x of [46, 57, 68, 79, 90, 101]) {
    add('dark', [x, 2.4, -2.4], [.32, 4.8, .36]);
    add('amber', [x, 4.8, -2.4], [.24, .24, 3]);
  }
  for (const z of [-3.1, -1.7]) add('dark', [73.5, 4.82, z], [57, .28, .28]);
  for (const [x, length] of [[52, 11], [73, 8], [95, 12]] as const)
    add('amber', [x, 5.04, -2.4], [length, .16, 2.6]);

  // South railway embankment retains its exact enclosure, sleepers and rails.
  add('concrete', [width / 2, 1.95, depth + 3.6], [width + 40, 3.9, 7.2]);
  add('concrete', [width / 2, 1.65, depth + .26], [width, 3.3, .5]);
  add('pale', [width / 2, 3.45, depth + .6], [width, .3, 1.2]);
  for (let x = 2; x < width; x += 6) {
    add('concrete', [x, 1.65, depth + .22], [.45, 3.3, .42]);
    add('dark', [x + 2.4, .6, depth + .004], [.65, .4, .006]);
  }
  for (const z of [depth + 2.3, depth + 5.6]) {
    add('dark', [width / 2, 3.97, z], [width + 32, .12, 2.8]);
    for (const dz of [-.76, .76]) add('metal', [width / 2, 4.12, z + dz], [width + 32, .16, .09]);
    for (let x = -14; x < width + 14; x += 2) add('amber', [x, 4.05, z], [.20, .10, 2.35]);
  }
  for (const [x, z, yaw] of [[62, depth + 15, .06], [81, depth + 17, -.08], [112, depth + 16, -.05]] as const) {
    add('dark', [x, 1.45, z, yaw], [12.2, 2.9, 2.5]);
    add('amber', [x, 3, z, yaw], [12.25, .2, 2.55]);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let k = -5; k <= 5; k++)
      add('amber', [x + k * c - 1.26 * s, 1.5, z - k * s - 1.26 * c, yaw], [.10, 2.7, .06]);
  }
  parts.push(...relayWorkshopPlant());
  return parts;
}
