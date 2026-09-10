/** Original depot context. All volumes, including rotated freight sheds,
 * remain outside the playable rectangle. Baked into the existing map atlas. */
export interface SwitchyardSitePart {
  material: number;
  x: number; y: number; z: number;
  w: number; h: number; d: number; yaw: number;
}

export function switchyardSiteSupplies(depth: number) {
  return [.17, .50, .84].flatMap(t => [0, .75].map(offset => ({
    x: -1.35, y: 2.8, z: depth * t + offset,
  })));
}

export function switchyardSiteSigns(width: number, depth: number) {
  return [
    { label: 9, x: -.012, y: 1.9, z: depth * .5, yaw: Math.PI / 2, width: 6 },
    { label: 10, x: width + 11.818, y: 7.3, z: depth * .5, yaw: -Math.PI / 2, width: 10 },
    { label: 11, x: width * .30, y: 5.2, z: depth + .004, yaw: Math.PI, width: 8 },
    { label: 12, x: width * .73, y: 7.4, z: depth + .004, yaw: Math.PI, width: 9 },
  ];
}

export function switchyardSiteBoundary(width: number, depth: number): SwitchyardSitePart[] {
  const parts: SwitchyardSitePart[] = [];
  // Same six finishes as switchyard-environment: concrete, steel, housing,
  // ochre, olive, pale. No added material or texture.
  const add = (material: number, x: number, y: number, z: number,
    w: number, h: number, d: number, yaw = 0) => parts.push({material,x,y,z,w,h,d,yaw});

  // WEST CAPACITOR COURT. A deep service plinth closes the yard edge; behind
  // it the existing capacitor towers keep their entire x[-11.2,-4.8] footprint.
  // The switch house starts at x=-13, making an actual equipment court.
  add(0, -2.02, 1.35, depth / 2, 4, 2.7, depth);
  add(1, -2.02, 2.75, depth / 2, 4, .1, depth);
  for (let z = 2; z < depth; z += 5) {
    add(2, -.055, 1.32, z, .06, 2.64, .36);
    add(4, -.024, .7, z + 1.7, .006, .8, 2.2);
    add(3, -.024, 2.63, z + 1.7, .006, .13, 2.2);
  }
  for (const [a,b,h,span] of [[0,.28,9,18],[.28,.75,7.5,24],[.75,1,11.5,16]] as const) {
    const z = (a + b) * depth / 2, length = (b - a) * depth;
    add(0, -13 - span / 2, 1.2, z, span, 2.4, length);
    add(4, -13 - span / 2, (h + 2.4) / 2, z, span, h - 2.4, length);
    add(1, -13 - span / 2, h + .12, z, span + .12, .24, length);
    for (let pz = a * depth + 1; pz < b * depth - 3; pz += 5) {
      add(2, -12.92, h / 2, pz, .15, h, .25);
      add(1, -12.972, h - 1.4, pz + 2, .05, 1.05, 3.3);
      add(5, -12.942, h - 1.4, pz + 2, .006, .065, 3.3);
      add(2, -13 - span / 2, h + .29, pz, span - .2, .10, .12);
    }
  }
  for (const z of [depth * .17, depth * .50, depth * .84]) {
    add(2, -12.96, 2.45, z, .07, 4.5, 6);
    for (let y = .4; y < 4.5; y += .4) add(1, -12.917, y, z, .012, .04, 5.8);
    // Raised closed loading doors behind the equipment yard. No walkable exit.
    add(1, -11.6, 4.95, z, 2.8, .18, 6.8);
    for (const dz of [-3.2,3.2]) add(2, -10.3, 2.4, z + dz, .18, 4.8, .18);
  }

  // EAST CRANE HALL. The load travels at x153.9..158.2; the facade begins
  // at x162. The low boundary never intersects the hoist or its two berths.
  add(0, width + 1.52, 1.35, depth / 2, 3, 2.7, depth);
  add(1, width + 1.52, 2.75, depth / 2, 3, .1, depth);
  for (let z = 2; z < depth; z += 5) {
    add(2, width + .055, 1.32, z, .06, 2.64, .36);
    add(3, width + .024, 2.6, z + 1.7, .006, .15, 2.2);
  }
  for (const [a,b,h,span] of [[0,.24,8,16],[.24,.77,15,23],[.77,1,10.5,19]] as const) {
    const z = (a + b) * depth / 2, length = (b - a) * depth;
    add(0, width + 12 + span / 2, 1.2, z, span, 2.4, length);
    add(2, width + 12 + span / 2, (h + 2.4) / 2, z, span, h - 2.4, length);
    add(1, width + 12 + span / 2, h + .14, z, span + .14, .28, length);
    for (let pz = a * depth + 1; pz < b * depth - 3; pz += 5) {
      add(0, width + 11.92, h / 2, pz, .16, h, .34);
      add(1, width + 11.974, h - 1.8, pz + 2, .05, 1.6, 3.2);
      for (const dz of [-.8,.8]) add(5, width + 11.942, h - 1.8, pz + 2 + dz, .008, 1.6, .06);
      add(1, width + 12 + span / 2, h + .34, pz, span - .2, .12, .1);
    }
  }
  for (const z of [depth * .36, depth * .64]) {
    add(4, width + 11.96, 3.0, z, .07, 5.6, 10);
    for (let y = .4; y < 5.7; y += .42) add(1, width + 11.917, y, z, .01, .03, 9.7);
    for (const dz of [-5.25,5.25]) add(3, width + 11.88, 3.1, z + dz, .14, 6.2, .22);
  }

  // NORTH BUS COMPOUND. Thick containment curb, unchanged transformer/portal
  // court, then two control wings. The mast still reads against open sky.
  add(0, width / 2, .65, -.77, width, 1.3, 1.5);
  add(1, width / 2, 1.35, -.77, width, .1, 1.5);
  for (let x = 2; x < width; x += 6) {
    add(2, x, .64, -.055, .3, 1.28, .06);
    add(0, x, 1, -1.8, .6, 2, 2);
  }
  for (const [x,w,h,z,d] of [[width*.22,54,8.5,-24,15],[width*.79,48,6,-23,13]] as const) {
    add(0, x, 1.1, z, w, 2.2, d);
    add(4, x, (h+2.2)/2, z, w, h-2.2, d);
    add(1, x, h+.14, z, w+.2, .28, d+.2);
    for (let px=x-w/2+2; px<x+w/2-2; px+=5) {
      add(2, px, h/2, z+d/2+.04, .22, h, .08);
      add(1, px+1.9, h-1.3, z+d/2+.026, 3.2, .95, .05);
      add(5, px+1.9, h-1.3, z+d/2+.055, 3.2, .06, .008);
    }
  }

  // SOUTH FREIGHT DEPOT. Unequal workshop and dispatch heights meet the old
  // edge. Shutters are opaque; actual enterable rooms remain inside the yard.
  for (const [a,b,h,span,finish] of [[0,.43,8.4,18,4],[.43,.59,5.8,11,0],[.59,1,12.8,23,2]] as const) {
    const x=(a+b)*width/2, length=(b-a)*width;
    add(0,x,1.1,depth+span/2+.04,length,2.2,span);
    add(finish,x,(h+2.2)/2,depth+span/2+.04,length,h-2.2,span);
    add(1,x,h+.13,depth+span/2+.04,length,.26,span+.06);
    for(let px=a*width+1;px<b*width-3;px+=5) {
      add(0,px,h/2,depth+.025,.28,h,.03);
      add(1,px+2,h-1.3,depth+.025,3.3,1.0,.028);
      add(5,px+2,h-1.3,depth+.007,3.3,.06,.006);
      add(2,px,h+.32,depth+span/2+.04,.12,.12,span-.2);
    }
  }
  for(const x of [width*.13,width*.30,width*.69,width*.86]) {
    add(1,x,2.2,depth+.025,8.8,4.1,.028);
    for(let y=.4;y<4.1;y+=.35) add(2,x,y,depth+.008,8.55,.022,.004);
    for(const dx of [-4.65,4.65]) add(3,x+dx,2.2,depth+.011,.2,4.4,.02);
  }
  // Three broad roof ventilators, contained above the west workshop only.
  for(const x of [width*.10,width*.23,width*.36]) {
    add(2,x,9.3,depth+9,9,1.5,12);
    add(1,x,10.13,depth+9,9.3,.16,12.3);
    for(const y of [8.9,9.3,9.7]) add(5,x,y,depth+2.98,8.4,.12,.024);
  }
  // Rail-side sheds beyond the depot: varied, offset footprints instead of
  // another mirrored box row. Their yaw never crosses the convex play bounds.
  for(const [x,z,w,h,d,yaw] of [
    [width*.24,depth+36,48,6.5,12,.11],
    [width*.72,depth+42,36,9,17,-.08],
  ] as const) {
    const local=(m:number,dx:number,y:number,dz:number,pw:number,ph:number,pd:number)=>
      add(m,x+dx*Math.cos(yaw)+dz*Math.sin(yaw),y,z-dx*Math.sin(yaw)+dz*Math.cos(yaw),pw,ph,pd,yaw);
    local(2,0,h/2,0,w,h,d);
    local(1,0,h+.12,0,w+.16,.24,d+.16);
    for(let dx=-w/2+1;dx<w/2;dx+=3) {
      local(0,dx,h/2,-d/2-.03,.2,h,.06);
      local(1,dx,h+.29,0,.1,.1,d-.1);
    }
  }
  return parts;
}
