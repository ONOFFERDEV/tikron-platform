/** Original ruined canal settlement. All extents are outside gameplay bounds;
 * these parts use the same six batches in the fallback and architecture bake. */
export interface UndertowSkylinePart {
  readonly material: 0 | 1 | 2 | 3 | 4 | 5;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly yaw: number;
  readonly roll: number;
}

type Material = UndertowSkylinePart['material'];

export function undertowSkylineParts(width: number, depth: number): readonly UndertowSkylinePart[] {
  const parts: UndertowSkylinePart[] = [];
  const add = (material: Material, x: number, y: number, z: number,
    w: number, h: number, d: number, yaw = 0, roll = 0) => {
    parts.push({ material, x, y, z, w, h, d, yaw, roll });
  };
  const house = (x: number, z: number, w: number, h: number, d: number, yaw: number, ruin: number) => {
    const local = (material: Material, dx: number, y: number, dz: number,
      pw: number, ph: number, pd: number, roll = 0) =>
      add(material, x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y,
        z - dx * Math.sin(yaw) + dz * Math.cos(yaw), pw, ph, pd, yaw, roll);
    // Thick lower walls, real black window voids and surviving upper lintels.
    for (const side of [-1, 1]) {
      local(1, 0, h * .24, side * d / 2, w, h * .48, .6);
      local(0, 0, h - .6, side * d / 2, w, 1.2, .6);
      local(3, 0, h * .49, side * (d / 2 + .04), w, .14, .68);
      for (let dx = -w / 2 + .6; dx < w / 2; dx += 4) {
        local(1, dx, h * .7, side * d / 2, 1.2, h * .44, .6);
      }
      local(1, side * (w / 2 - .3), h / 2, 0, .6, h, d);
    }
    const rise = w * .24;
    const slope = Math.atan2(rise, w / 2);
    const length = Math.hypot(w / 2, rise);
    for (const side of [-1, 1]) {
      const roofDepth = d * (side === ruin ? .36 : .78);
      const roofZ = side === ruin ? d * .28 : -d * .11;
      local(4, side * w / 4, h + rise / 2, roofZ, length + .45, .20, roofDepth, -side * slope);
      for (const dz of [-d * .45, 0, d * .44])
        local(5, side * w / 4, h + rise / 2 - .15, dz, length, .18, .18, -side * slope);
    }
    local(5, 0, h + rise, -d * .1, .22, .24, d * .8);
    // Unequal masonry stacks and broken coping interrupt the roof rhythm.
    local(1, -w * .28, h + 1.6, -d * .2, 1.3, 4.1, 1.1);
    local(3, -w * .28, h + 3.72, -d * .2, 1.5, .14, 1.3);
    for (const dx of [-w * .42, w * .32])
      local(0, dx, h + .22, d / 2, 1.1, .44, .62);
  };

  // North: shelled lock keeper's houses frame one unmistakable bell tower.
  house(width * .28, -17, 20, 9.2, 13, -.065, 1);
  house(width * .72, -20, 23, 10.5, 14, .045, -1);
  const towerX = width / 2, towerZ = -18;
  add(1, towerX, 8.8, towerZ, 7.8, 17.6, 7);
  add(3, towerX, 17.75, towerZ, 8.2, .3, 7.4);
  for (const dx of [-3.35, 3.35]) for (const dz of [-2.95, 2.95])
    add(0, towerX + dx, 20.5, towerZ + dz, 1.1, 5.2, 1.1);
  // Open belfry bays, with a solid sign lintel at the existing sign coordinates.
  add(1, towerX, 23, towerZ, 8, 1, 7.2);
  add(3, towerX, 23.57, towerZ, 8.4, .14, 7.6);
  add(0, towerX - 2.9, 24.2, towerZ - 2.8, 2, 1.12, 1.2);
  add(0, towerX + 2.6, 24.65, towerZ + 2.8, 2.2, 2.02, 1.1);
  add(4, towerX - .8, 24.7, towerZ, 5.8, .16, .18, 0, -.62);
  add(4, towerX + 1.4, 24.4, towerZ, 4.3, .16, .18, 0, .62);
  for (const side of [-1, 1]) {
    add(0, towerX + side * 4.05, 6.2, towerZ, .7, 12.4, 1.8);
    add(3, towerX + side * 4.05, 12.52, towerZ, .86, .24, 2);
  }
  // West: steep, interrupted rooftops replace the three upright filter tanks.
  house(-15, depth * .38, 16, 13.2, 18, .06, 1);
  house(-18, depth * .62, 19, 17.4, 17, -.055, -1);
  // East: a low timber lifting trestle, visibly distinct from the western roofs.
  const hoistX = width + 6, hoistZ = depth / 2;
  for (const dz of [-13, 13]) {
    for (const side of [-1, 1])
      add(4, hoistX + side * 1.7, 5.7, hoistZ + dz, .5, 11.8, .55, 0, side * .29);
    add(5, hoistX, 4.4, hoistZ + dz, 5.9, .4, .6);
    add(2, hoistX, 10.9, hoistZ + dz, 1.1, .24, .85);
  }
  add(4, hoistX, 11.35, hoistZ, .8, .7, 29);
  add(2, hoistX, 8.1, hoistZ + 2.4, .055, 5.8, .055);
  add(2, hoistX, 5.25, hoistZ + 2.4, .6, .18, .3);
  // South: brick flues beyond the far bank; keep the standing water views open.
  for (const [x, h] of [[width * .43, 18], [width * .49, 14]] as const) {
    add(1, x, h / 2, depth + 23, 1.8, h, 1.8);
    add(3, x, h + .13, depth + 23, 2.1, .26, 2.1);
    add(2, x, h + .265, depth + 23, 1.3, .01, 1.3);
  }
  return parts;
}
