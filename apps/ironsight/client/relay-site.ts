/** Original exterior architecture. The playable rectangle remains a convex
 * boundary: every vertex stays outside it, including rotated rail freight.
 * These parts join the existing material batches and static architecture bake.
 * They cannot intervene between two playable positions or become extra cover.
 */
export type RelaySiteMaterial = 'concrete' | 'pale' | 'dark' | 'metal' | 'amber' | 'teal' | 'paint';
export interface RelaySitePart {
  material: RelaySiteMaterial;
  x: number; y: number; z: number;
  w: number; h: number; d: number; yaw: number;
}

export function relaySiteBoundary(width: number, depth: number): RelaySitePart[] {
  const parts: RelaySitePart[] = [];
  const add = (material: RelaySiteMaterial, x: number, y: number, z: number,
    w: number, h: number, d: number, yaw = 0) => parts.push({ material, x, y, z, w, h, d, yaw });

  // West: long repair hall with three unequal roof bays. The front is on the
  // old boundary, with closed roller shutters and high clerestory glazing.
  // Different roof depths and extensions break the old mirrored fence outline.
  for (const [from, to, height, span] of [[0, 32, 9, 18], [32, 72, 11, 24], [72, depth, 8, 15]]) {
    const length = to! - from!, mid = (from! + to!) / 2;
    add('metal', -span! / 2 - .04, height! / 2, mid, span!, height!, length);
    add('dark', -span! / 2 - .04, height! + .12, mid, span! + .06, .24, length);
    add('concrete', -.2, .6, mid, .38, 1.2, length);
    for (let z = from! + 2; z < to! - 1; z += 6) {
      add('pale', -.1, height! / 2, z, .18, height!, .28);
      add('dark', -.02, height! - 1.7, z + 2.4, .026, 1.2, 4.25);
      add('metal', -.004, height! - 1.7, z + 2.4, .006, .09, 4.25);
      add('metal', -span! / 2, height! + .30, z, span! - .2, .16, .10);
    }
  }
  for (const z of [16, 46, 62, 84]) {
    add('teal', -.018, 3.4, z, .024, 6.4, 7.6);
    for (let y = .45; y < 6.4; y += .36)
      add('dark', -.004, y, z, .006, .018, 7.2);
    add('amber', -.003, .20, z, .004, .17, 7.2);
  }
  // Roof lanterns have opaque dusty glass: background, never firing windows.
  for (const z of [12, 25, 41, 55, 68]) {
    const tall = z > 32, x = tall ? -13 : -10, y = tall ? 11.8 : 9.8;
    add('dark', x, y, z, 8, 1.1, 4);
    add('pale', x, y + .65, z, 8.4, .2, 4.4);
    for (const dx of [-3, -1, 1, 3]) add('metal', x + dx, y, z + 2.01, .1, 1.1, .04);
  }

  // East: a lower freight shed followed by a taller dispatch block. Its large
  // loading bays answer the west hall at human scale, without mirroring its roof.
  for (const [from, to, height, span] of [[0, 18, 7, 10], [18, 80, 8.4, 20], [80, depth, 12, 28]]) {
    const mid = (from! + to!) / 2, length = to! - from!;
    add('amber', width + span! / 2 + .04, height! / 2, mid, span!, height!, length);
    add('dark', width + span! / 2 + .04, height! + .14, mid, span! + .06, .28, length);
    add('concrete', width + .2, .75, mid, .38, 1.5, length);
    for (let z = from! + 1; z < to! - 1; z += 5) {
      add('metal', width + .03, height! / 2, z, .04, height!, .16);
      add('metal', width + span! / 2, height! + .33, z, span! - .1, .10, .08);
    }
  }
  for (const z of [28, 44, 60, 74]) {
    add('metal', width + .018, 3.1, z, .024, 5.8, 8.2);
    for (let y = .45; y < 5.8; y += .4)
      add('dark', width + .004, y, z, .006, .020, 7.8);
    for (const dz of [-4.4, 4.4]) add('pale', width + .008, 3.3, z + dz, .014, 6.6, .3);
  }

  // North: receiver annex and utility wing flank the dish approach. The low
  // central wall keeps its sandbag emplacement; taller masses sit behind it.
  add('concrete', width / 2, 1.45, -.4, width, 2.9, .8);
  add('dark', width / 2, 2.82, -.4, width, .16, .8);
  for (const [from, to, height, span] of [[0, 53, 10, 17], [98, width, 7.2, 13]]) {
    const mid = (from! + to!) / 2, length = to! - from!;
    add('teal', mid, height! / 2, -span! / 2 - .9, length, height!, span!);
    add('dark', mid, height! + .12, -span! / 2 - .9, length, .24, span!);
    for (let x = from! + 2; x < to! - 2; x += 5) {
      add('pale', x, height! / 2, -.86, .18, height!, .08);
      add('dark', x + 1.8, height! - 1.65, -.83, 3.3, 1.2, .04);
      add('metal', x, height! + .30, -span! / 2 - .9, .10, .12, span!);
    }
  }
  // A service gallery ties the west plant to the actual receiver mast. All
  // support feet, beams and conduits remain north of the server boundary.
  for (const x of [46, 57, 68, 79, 90, 101]) {
    add('metal', x, 4, -2.4, .28, 8, .32);
    add('metal', x, 8.1, -2.4, .2, .2, 3);
  }
  for (const z of [-3.1, -2.4, -1.7]) add('dark', 73.5, 8.4, z, 57, .24, .32);
  add('amber', 73.5, 8, -2.4, 57.5, .18, 2.6);

  // South: heavy rail retaining bank, no fence. Buttresses, track beds and
  // offset freight stacks explain the trench's industrial service frontage.
  add('metal', width / 2, 1.95, depth + 3.6, width + 40, 3.9, 7.2);
  add('concrete', width / 2, 1.65, depth + .26, width, 3.3, .5);
  add('pale', width / 2, 3.45, depth + .6, width, .3, 1.2);
  for (let x = 2; x < width; x += 6) {
    add('concrete', x, 1.65, depth + .22, .45, 3.3, .42);
    add('dark', x + 2.4, .6, depth + .004, .65, .4, .006);
  }
  for (const z of [depth + 2.3, depth + 5.6]) {
    add('dark', width / 2, 3.97, z, width + 32, .12, 2.8);
    for (const dz of [-.76, .76]) add('metal', width / 2, 4.12, z + dz, width + 32, .16, .09);
    for (let x = -14; x < width + 14; x += 2)
      add('amber', x, 4.05, z, .20, .10, 2.35);
  }
  // Sealed freight, deliberately offset behind the track. Simple original
  // stand-ins reserve footprints for the assets stream's packed prop library.
  for (const [x, z, yaw] of [[62, depth + 15, .06], [81, depth + 17, -.08], [112, depth + 16, -.05]]) {
    add('dark', x!, 1.45, z!, 12.2, 2.9, 2.5, yaw);
    add('amber', x!, 3.0, z!, 12.25, .2, 2.55, yaw);
    for (let k = -5; k <= 5; k++) {
      const c = Math.cos(yaw!), s = Math.sin(yaw!);
      add('metal', x! + k * c - 1.26 * s, 1.5, z! - k * s - 1.26 * c, .08, 2.7, .06, yaw);
    }
  }
  return parts;
}
