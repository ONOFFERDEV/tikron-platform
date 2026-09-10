/** Original reclamation-plant context. All geometry, including the yawed
 * workshops and supplies, stays outside the convex playable rectangle.
 * The existing architecture bake/material batches own these static parts. */
export interface UndertowSitePart {
  material: number;
  x: number; y: number; z: number;
  w: number; h: number; d: number; yaw: number;
}
export interface UndertowSiteSign {
  label: number; x: number; y: number; z: number; yaw: number; width: number;
}

export function undertowCanalSurface(width: number, depth: number) {
  return { x: width / 2, y: .025, z: depth + 10, w: width + 50, d: 14 };
}

export function undertowCanalLookouts(width: number) {
  // Flank the existing B court's solid back wall (x66-84); the lookouts
  // must be visible from valid yard feet, not an inspector inside that wall.
  return [[width * .32, width * .42], [width * .58, width * .68]] as const;
}

/** Real-world size comes from the already resident ammo-crate-stack library.
 * No extra texture is loaded; these are sealed external maintenance supplies. */
export function undertowSiteSupplies(depth: number): { x: number; y: number; z: number }[] {
  return [18, 68, 87].flatMap(z => [0, .72].map(offset => ({ x: -1.65, y: 2.8, z: z / 100 * depth + offset })));
}

export function undertowSiteSigns(width: number, depth: number): UndertowSiteSign[] {
  return [
    { label: 4, x: -2.368, y: 5.8, z: depth * .18, yaw: Math.PI / 2, width: 5 },
    { label: 7, x: -2.368, y: 5.8, z: depth * .68, yaw: Math.PI / 2, width: 5 },
    { label: 5, x: width + .004, y: 6.35, z: depth * .50, yaw: -Math.PI / 2, width: 9 },
    { label: 7, x: width + .004, y: 4.1, z: depth * .94, yaw: -Math.PI / 2, width: 6 },
    { label: 6, x: width / 2, y: 2.15, z: -.012, yaw: 0, width: 6 },
    { label: 7, x: width * .76, y: 2.15, z: depth + .012, yaw: Math.PI, width: 6 },
  ];
}

export function undertowSiteBoundary(width: number, depth: number): UndertowSitePart[] {
  const parts: UndertowSitePart[] = [];
  // Material slots match buildUndertowEnvironment: concrete/housing/steel/
  // pale/olive/ochre/lamp. No new shader, light or texture allocation.
  const add = (material: number, x: number, y: number, z: number,
    w: number, h: number, d: number, yaw = 0) => parts.push({ material, x, y, z, w, h, d, yaw });

  // WEST FILTER HOUSE. A continuous loading plinth meets the boundary. The
  // hall is set back four metres, so its doors, buttresses and wet loading
  // ledge have depth at eye level. Existing filter vessels rise behind it.
  // Partition concrete and coping: two coincident top faces shimmer even
  // with baked materials. Preserve the finished 2.8m supply ledge height.
  add(0, -2, 1.35, depth / 2, 4, 2.7, depth);
  add(2, -2, 2.75, depth / 2, 4, .1, depth);
  for (const [a, b, h, span] of [[0, .31, 9, 17], [.31, .73, 7.4, 22], [.73, 1, 10.8, 14]] as const) {
    const z = (a + b) * depth / 2, length = (b - a) * depth;
    add(1, -4.05 - span / 2, h / 2, z, span, h, length);
    add(2, -4.05 - span / 2, h + .13, z, span + .05, .26, length);
    for (let pz = a * depth + 1; pz < b * depth - 1; pz += 5) {
      add(0, -4.16, h / 2, pz, .25, h, .34);
      add(2, -4.027, h - 1.25, pz + 1.9, .024, .85, 3.2);
      add(3, -4.01, h - 1.25, pz + 1.9, .008, .045, 3.2);
      add(2, -4.05 - span / 2, h + .3, pz, span - .1, .08, .1);
    }
  }
  for (const z of [depth * .18, depth * .68, depth * .87]) {
    // Closed elevated shutter, never an implied playable doorway.
    add(4, -4.024, 4.05, z, .03, 2.5, 4.6);
    for (let y = 3.05; y < 5.3; y += .3) add(2, -4.005, y, z, .006, .018, 4.45);
    add(3, -3.2, 5.45, z, 1.65, .18, 5.2);
    add(2, -2.42, 5.8, z, .08, .78, 5.4);
    for (const dz of [-2.6, 2.6]) add(2, -3.3, 4.1, z + dz, .14, 2.6, .14);
    add(5, -.025, 2.7, z, .04, .15, 5.1);
  }
  for (let z = 2; z < depth; z += 5) {
    add(1, -.035, 1.3, z, .06, 2.6, .3);
    add(4, -.004, .65, z + 1.8, .006, .7, 1.9);
  }

  // EAST MAINTENANCE HALL. A high, shallow central hall stands behind the
  // existing lifting gantry; lower end wings change its silhouette. A band
  // of opaque clerestory glazing describes two floors without fake entrances.
  for (const [a, b, h, span] of [[0, .27, 6.2, 12], [.27, .73, 10.5, 19], [.73, 1, 7, 25]] as const) {
    const z = (a + b) * depth / 2, length = (b - a) * depth;
    add(0, width + span / 2 + .04, 1.35, z, span, 2.7, length);
    add(4, width + span / 2 + .04, (h + 2.7) / 2, z, span, h - 2.7, length);
    add(2, width + span / 2 + .04, h + .14, z, span + .06, .28, length);
    for (let pz = a * depth + 1; pz < b * depth - 1; pz += 5) {
      add(1, width + .025, h / 2, pz, .03, h, .24);
      add(2, width + .02, h - 1.2, pz + 2, .03, 1.1, 3.3);
      for (const dz of [-.8, .8]) add(3, width + .002, h - 1.2, pz + 2 + dz, .003, 1.1, .055);
      add(1, width + span / 2, h + .31, pz, span, .06, .09);
    }
  }
  for (const z of [depth * .36, depth * .5, depth * .64, depth * .83]) {
    add(1, width + .018, 2.65, z, .022, 4.9, 7.4);
    for (let y = .4; y < 4.9; y += .4) add(2, width + .004, y, z, .006, .018, 7.15);
    for (const dz of [-3.85, 3.85]) add(3, width + .006, 2.75, z + dz, .01, 5.5, .18);
  }
  // Raised service duct ties the hall's upper wall to the crane silhouette.
  for (const z of [depth * .29, depth * .71]) {
    add(1, width + 8, 8.2, z, 15, .55, 1.1);
    add(5, width + 8, 8.56, z, 14.9, .1, 1.1);
  }

  // NORTH CLARIFIER QUAY. Keep the flood towers and intake crown visible.
  // Buttresses connect the old thin wall to the actual basin. The low central
  // roofline leaves the animated sluices clear above it.
  add(0, width / 2, 1.35, -.74, width, 2.7, 1.4);
  add(2, width / 2, 2.75, -.74, width, .1, 1.4);
  for (let x = 2; x < width; x += 6) {
    add(1, x, 1.45, -1.57, .55, 2.9, 3.1);
    add(4, x + 2.4, .65, -.004, 2.3, .8, .006);
  }
  for (const x of [width * .13, width * .87]) {
    add(1, x, 2.8, -5.5, 17, 5.6, 9);
    add(2, x, 5.75, -5.5, 17.2, .3, 9.2);
    for (let dx = -6; dx <= 6; dx += 3) {
      add(2, x + dx, 4.3, -.982, 2.4, .8, .024);
      add(3, x + dx, 4.3, -.967, .055, .8, .006);
    }
  }
  for (const x of [width * .30, width * .42, width * .58, width * .70]) {
    add(0, x, 2.65, -3.5, 1.2, 5.3, 3.8);
    add(2, x, 5.4, -3.5, 1.3, .2, 4);
  }

  // SOUTH OUTFALL CANAL. A substantial quay face at the play edge, then
  // water, an opposite retaining bank and offset pump buildings. The three
  // raised service crossings are exterior; no accessible route is advertised.
  for (const [from, to] of [[-10, width * .32], [width * .42, width * .58], [width * .68, width + 10]]) {
    add(0, (from! + to!) / 2, 1.35, depth + 1.54, to! - from!, 2.7, 3);
    add(2, (from! + to!) / 2, 2.75, depth + 1.54, to! - from!, .1, 3);
  }
  // A waist-high parapet is a view onto the water, not a gate. Its entire
  // thickness remains beyond the unchanged server boundary. The nearer
  // ledge is narrow enough to reveal the canal from a standing yard eye.
  for (const [from, to] of undertowCanalLookouts(width)) {
    add(0, (from + to) / 2, .55, depth + .74, to - from, 1.1, 1.4);
    add(2, (from + to) / 2, 1.15, depth + .74, to - from, .1, 1.4);
  }
  // The water surface is a separate opaque reflection draw, not concrete
  // cladding in the architecture atlas. It is created once before warm-up.
  add(0, width / 2, 2.6, depth + 18.5, width + 60, 5.2, 3);
  add(2, width / 2, 5.28, depth + 18.5, width + 60, .16, 3);
  for (let x = -6; x < width + 8; x += 6) {
    const nearHeight = undertowCanalLookouts(width).some(([from,to]) => x >= from && x <= to) ? 1.1 : 2.7;
    add(1, x, nearHeight / 2, depth + .065, .4, nearHeight, .08);
    add(4, x + 2.8, .55, depth + .004, 2, .7, .006);
    add(1, x, 2.6, depth + 16.9, .45, 5.2, .24);
    // Recessed-looking outfall grille, backed by opaque retaining concrete.
    add(2, x + 2.8, 1.8, depth + 16.982, 2.6, 2.5, .024);
    for (const dx of [-.8, 0, .8]) add(3, x + 2.8 + dx, 1.8, depth + 16.967, .075, 2.5, .006);
    add(1, x + 1, .04, depth + 7.5, 1.6, .008, .035);
    add(1, x + 3, .04, depth + 12.5, 2.4, .008, .025);
  }
  for (const x of [width * .19, width * .56, width * .85]) {
    add(1, x, 3, depth + 10, 4, .5, 14);
    for (const side of [-1, 1]) {
      add(5, x + side * 1.95, 3.3, depth + 10, .12, .1, 14);
      add(2, x + side * 1.95, 4.15, depth + 10, .08, .08, 14);
      for (let z = depth + 3; z <= depth + 17; z += 2)
        add(2, x + side * 1.95, 3.7, z, .08, .85, .08);
    }
  }
  // Offset footprints across the canal. Rotation breaks the tile grid only
  // in background space; collision remains the exact existing box list.
  for (const [x, z, w, h, d, yaw] of [
    [width * .17, depth + 29, 37, 9, 15, .075],
    [width * .51, depth + 32, 28, 13, 17, -.065],
    [width * .82, depth + 29, 34, 7.5, 14, .045],
  ] as const) {
    const local = (material: number, dx: number, y: number, dz: number, pw: number, ph: number, pd: number) =>
      add(material, x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y,
        z - dx * Math.sin(yaw) + dz * Math.cos(yaw), pw, ph, pd, yaw);
    local(1, 0, h / 2, 0, w, h, d);
    local(2, 0, h + .13, 0, w + .2, .26, d + .2);
    local(4, 0, 1.15, -d / 2 - .015, w, 2.3, .02);
    for (let dx = -w / 2 + 2; dx < w / 2 - 1; dx += 4) {
      local(3, dx, h / 2, -d / 2 - .05, .22, h, .08);
      local(2, dx + 1.5, h - 1.5, -d / 2 - .03, 2.6, 1.2, .04);
      local(2, dx, h + .3, 0, .1, .1, d);
    }
    local(2, 0, h + .9, 0, w * .55, 1.3, 3);
    local(3, 0, h + 1.6, 0, w * .55 + .2, .15, 3.2);
  }
  return parts;
}
