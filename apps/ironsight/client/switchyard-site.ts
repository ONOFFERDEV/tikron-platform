export interface SwitchyardSitePart {
  material: number;
  x: number; y: number; z: number;
  w: number; h: number; d: number; yaw: number;
}

export function switchyardSiteSupplies(depth: number) {
  return [.17, .50, .84].flatMap(t => [0, .75].map(offset => ({
    x: -1.35, y: 2.7, z: depth * t + offset,
  })));
}

export function switchyardSiteSigns(width: number, depth: number) {
  return [
    { label: 9, x: -.012, y: 1.9, z: depth * .5, yaw: Math.PI / 2, width: 6 },
    { label: 10, x: width + 9.988, y: 7.3, z: depth * .5, yaw: -Math.PI / 2, width: 10 },
    { label: 11, x: width * .30, y: 5.2, z: depth - .012, yaw: Math.PI, width: 8 },
    { label: 12, x: width * .73, y: 7.4, z: depth - .012, yaw: Math.PI, width: 9 },
  ];
}

export function switchyardSiteBoundary(width: number, depth: number): SwitchyardSitePart[] {
  const parts: SwitchyardSitePart[] = [];
  const add = (material: number, x: number, y: number, z: number,
    w: number, h: number, d: number, yaw = 0) => parts.push({ material, x, y, z, w, h, d, yaw });

  add(0, -2.02, 1.35, depth / 2, 4, 2.7, depth);
  for (const [z, length, height] of [[18, 28, 6], [51, 24, 7], [80, 20, 5]] as const) {
    add(4, -12, height / 2, z, 16, height, length);
    add(1, -12, height + .15, z, 16.4, .3, length + .4);
  }

  add(0, width + 1.52, 1.35, depth / 2, 3, 2.7, depth);
  for (const [z, length, height] of [[16, 25, 7], [48, 30, 9], [81, 21, 6]] as const) {
    add(0, width + 20, height / 2, z, 20, height, length);
    add(1, width + 20, height + .15, z, 20.4, .3, length + .4);
  }

  add(0, width / 2, .65, -.77, width, 1.3, 1.5);
  for (const x of [28, 82, 128]) {
    add(3, x, 2.1, -4, 8, 4.2, 3.2);
    add(1, x, 4.35, -4, 8.4, .3, 3.6);
  }
  for (const x of [width * .22, width * .78]) {
    add(4, x, 3.5, -14, 34, 7, 12);
    add(1, x, 7.15, -14, 34.4, .3, 12.4);
  }

  // East goods shed intact; the west one is shell-hit, its front wall blown open
  // above a 2.4 m sill and the roof caved over the breach (x 16..28, clear of signs).
  const [eastX, eastSpan, eastHeight] = [width * .70, 23, 10];
  add(0, eastX, eastHeight / 2, depth + eastSpan / 2, width * .38, eastHeight, eastSpan);
  add(1, eastX, eastHeight + .15, depth + eastSpan / 2 + .21, width * .38 + .4, .3, eastSpan + .4);
  const west = width * .24, half = width * .19, span = 18, height = 7, zc = depth + span / 2;
  add(0, west, 1.2, zc, half * 2, 2.4, span);
  for (const [a, b] of [[west - half, 16], [28, west + half]] as const) {
    add(0, (a + b) / 2, 4.7, zc, b - a, 4.6, span);
    add(1, (a + b) / 2, height + .15, zc + .21, b - a + .4, .3, span + .4);
  }
  add(0, 22, 4.2, depth + span - 1, 12, 3.6, 2); // surviving back wall
  for (const [x, y, w] of [[16.6, 3.1, 1.2], [27.4, 3.4, 1.2], [17, 3.9, .8], [27.1, 4.4, .6]] as const)
    add(0, x, y, depth + .75, w, .9, 1.5); // broken brick edges
  for (let i = 0; i < 6; i++) // charred rafters, some fallen onto the rubble
    add(1, 22, i % 2 ? 6.7 : 2.52 + i * .05, depth + 2.5 + i * 2.6, 12.6, .22, .22, i % 2 ? 0 : .3);
  for (const [x, z, s] of [[19.5, 3.4, 1.3], [24.5, 6.2, 1.6], [21.8, 10.1, 1.1]] as const)
    add(0, x, 2.4 + s * .25, depth + z, s * 2, s * .5, s * 1.4, s); // rubble heaps on the sill
  return parts;
}
