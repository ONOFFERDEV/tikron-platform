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

  for (const [x, span, height] of [[width * .24, 18, 7], [width * .70, 23, 10]] as const) {
    add(0, x, height / 2, depth + span / 2, width * .38, height, span);
    add(1, x, height + .15, depth + span / 2 + .21, width * .38 + .4, .3, span + .4);
  }
  return parts;
}
