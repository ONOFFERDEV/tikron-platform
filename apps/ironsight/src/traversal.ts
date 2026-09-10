import { PLAYER, TICK_MS } from './config.js';
import { canStand, type Box, type Bounds, type MoveResult, type Vec3 } from './physics.js';
import type { LaunchPad, RampDef } from './map/types.js';
import type { SlideInput } from './slide.js';

export const TRAVERSAL = Object.freeze({ reach: .8, durationMs: 650, cooldownMs: 450,
  minHeight: 1, maxHeight: 1.25, maxVaultDepth: 2.2, clearance: .06 });
type Route = { start: Vec3; end: Vec3; top: number; kind: 'vault' | 'mantle' | 'launch' };
export const LAUNCH = Object.freeze({ radius: 1.5, durationMs: 1200, arcHeight: 5, cooldownMs: 900 });

/** Each simulation segment and its render interpolation is continuously swept.
 * Full landing footprint must be supported, and every route stays in world bounds.
 * A pad is intentional: jump + forward, facing its painted flight direction. */
export function launchRoute(pos: Vec3, yaw: number, pads: readonly LaunchPad[], boxes: readonly Box[],
  bounds: Bounds, ramps: readonly RampDef[]): Route | null {
  for (const pad of pads) {
    if (Math.abs(pos.y-pad.from.y)>.03 || Math.hypot(pos.x-pad.from.x,pos.z-pad.from.z)>LAUNCH.radius) continue;
    const dx=pad.to.x-pad.from.x,dz=pad.to.z-pad.from.z,length=Math.hypot(dx,dz);
    if (length<1 || (Math.sin(yaw)*dx+Math.cos(yaw)*dz)/length < .7) continue;
    const end=pad.to;
    if (end.y!==0 && !boxes.some(b=>Math.abs(b.max.y-end.y)<.001 &&
      end.x>=b.min.x+PLAYER.radius && end.x<=b.max.x-PLAYER.radius &&
      end.z>=b.min.z+PLAYER.radius && end.z<=b.max.z-PLAYER.radius)) continue;
    const route:Route={start:{...pos},end:{...end},top:0,kind:'launch'};
    const obstacles=[...boxes,...ramps.map(r=>({min:{x:r.minX,y:r.baseY ?? 0,z:r.minZ},max:{x:r.maxX,y:r.topY,z:r.maxZ}}))];
    let previous=pos, clear=true;
    // 24 segments match the fixed 50ms simulation. Each segment is swept, not
    // just point-tested; tiny ceilings and corner obstructions cannot be skipped.
    const steps=LAUNCH.durationMs/TICK_MS;
    for(let i=0;i<=steps;i++) {
      const next=launchPoint(route,i/steps);
      if(next.x<PLAYER.radius || next.x>bounds.width-PLAYER.radius || next.z<PLAYER.radius ||
        next.z>bounds.depth-PLAYER.radius || next.y<(bounds.floor ?? 0) ||
        !canStand(next.x,next.y,next.z,PLAYER.radius,PLAYER.standHeight,boxes,bounds) ||
        obstacles.some(b=>sweptBlocked(previous,next,b))) {clear=false;break;}
      previous=next;
    }
    if(clear)return route;
  }
  return null;
}
function launchPoint(route:Route,t:number):Vec3 {
  return {x:route.start.x+(route.end.x-route.start.x)*t,
    y:route.start.y+(route.end.y-route.start.y)*t+4*LAUNCH.arcHeight*t*(1-t),
    z:route.start.z+(route.end.z-route.start.z)*t};
}

/** A jump near waist cover chooses a capsule-clear lift/cross/settle path.
 * Only map geometry and actual feet are inputs; no client target or deadline.
 * The conservative expanded-box sweep also rejects corner/ceiling clipping.
 */
export function traversalRoute(pos: Vec3, yaw: number, boxes: readonly Box[], bounds: Bounds,
  ramps: readonly RampDef[]): Route | null {
  // Ground-level waist cover only: never chain a low crate into a full-cover roof.
  if (Math.abs(pos.y) > .03) return null;
  const dx = Math.sin(yaw), dz = Math.cos(yaw), r = PLAYER.radius + TRAVERSAL.clearance;
  let nearest: { box: Box; enter: number; exit: number } | undefined;
  for (const box of boxes) {
    if (box.max.y <= pos.y || box.min.y >= pos.y + PLAYER.standHeight) continue;
    let enter = -Infinity, exit = Infinity;
    for (const [p, d, lo, hi] of [[pos.x, dx, box.min.x - r, box.max.x + r],
      [pos.z, dz, box.min.z - r, box.max.z + r]]) {
      if (Math.abs(d!) < 1e-8) { if (p! < lo! || p! > hi!) { exit = -Infinity; break; } }
      else { const a = (lo! - p!) / d!, b = (hi! - p!) / d!;
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b)); }
    }
    if (exit < Math.max(0, enter) || enter > TRAVERSAL.reach || exit < 0) continue;
    if (!nearest || enter < nearest.enter) nearest = { box, enter, exit };
  }
  if (!nearest) return null;
  const b = nearest.box, height = b.max.y - b.min.y;
  if (b.min.y !== 0 || height < TRAVERSAL.minHeight || height > TRAVERSAL.maxHeight) return null;
  const vault = nearest.exit - Math.max(0, nearest.enter) <= TRAVERSAL.maxVaultDepth + 2 * r;
  const travel = vault ? nearest.exit + .02 : Math.max(0, nearest.enter) + 2 * r + .12;
  const route: Route = { start: { ...pos }, end: { x: pos.x + dx * travel,
    y: vault ? 0 : b.max.y, z: pos.z + dz * travel }, top: b.max.y + TRAVERSAL.clearance,
    kind: vault ? 'vault' : 'mantle' };
  // A diagonal skim must not finish floating beside the platform. Require the
  // entire landing footprint on its top for a mantle; vaults land on ground.
  if (!vault && (route.end.x < b.min.x + PLAYER.radius || route.end.x > b.max.x - PLAYER.radius ||
    route.end.z < b.min.z + PLAYER.radius || route.end.z > b.max.z - PLAYER.radius)) return null;
  // Sweep the standing capsule's conservative AABB over all three segments.
  // Continuous slab intersections catch even millimetre-thick obstructions.
  // Ramp bounding volumes are conservative here; ordinary movement still uses
  // the exact slope. An assisted move never cuts through the back of a ramp.
  const obstacles = [...boxes, ...ramps.map(r => ({ min:{x:r.minX,y:r.baseY ?? 0,z:r.minZ},
    max:{x:r.maxX,y:r.topY,z:r.maxZ} }))];
  const points = [pos, { ...pos, y: route.top }, { ...route.end, y: route.top }, route.end];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, c = points[i]!;
    if (c.x < PLAYER.radius || c.x > bounds.width - PLAYER.radius ||
      c.z < PLAYER.radius || c.z > bounds.depth - PLAYER.radius || c.y < (bounds.floor ?? 0)) return null;
    if (!canStand(c.x,c.y,c.z,PLAYER.radius,PLAYER.standHeight,boxes,bounds)) return null;
    if (obstacles.some(box => sweptBlocked(a,c,box))) return null;
  }
  return route;
}

function sweptBlocked(a: Vec3, b: Vec3, box: Box): boolean {
  let enter=0, exit=1;
  for (const axis of ['x','y','z'] as const) {
    const lo=box.min[axis]-(axis==='y'?PLAYER.standHeight:PLAYER.radius)+1e-5;
    const hi=box.max[axis]+(axis==='y'?0:PLAYER.radius)-1e-5;
    const d=b[axis]-a[axis];
    if(Math.abs(d)<1e-9){if(a[axis]<=lo || a[axis]>=hi)return false;}
    else { const t0=(lo-a[axis])/d,t1=(hi-a[axis])/d;
      enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1)); }
    if(enter>exit)return false;
  }
  return true;
}

/** Once committed, finishes the waist/launch route even if forward is released; death resets
 * the controller. Horizontal intent cannot steer a player through the side wall.
 */
export class WaistTraversal {
  private route: Route | null = null;
  private elapsed = 0;
  private cooldown = 0;
  get active(): boolean { return this.route !== null; }
  get progress(): number { return this.active ? this.elapsed / (this.kind==='launch'?LAUNCH.durationMs:TRAVERSAL.durationMs) : 0; }
  get kind(): Route['kind'] | null { return this.route?.kind ?? null; }
  step(dtMs: number, input: SlideInput, grounded: boolean, pos: Vec3, yaw: number,
    boxes: readonly Box[], bounds: Bounds, ramps: readonly RampDef[], pads: readonly LaunchPad[] = []): MoveResult | null {
    this.cooldown = Math.max(0, this.cooldown - dtMs);
    if (!this.route && this.cooldown === 0 && grounded && input.jump && input.mz > 0 && !input.crouch && !input.ads) {
      this.route = launchRoute(pos,yaw,pads,boxes,bounds,ramps) ?? traversalRoute(pos,yaw,boxes,bounds,ramps); this.elapsed = 0;
    }
    const route = this.route;
    if (!route) return null;
    const duration=route.kind==='launch'?LAUNCH.durationMs:TRAVERSAL.durationMs;
    this.elapsed = Math.min(duration,this.elapsed + dtMs);
    const t = this.elapsed / duration;
    const ease = (n: number) => { const v=Math.min(1,Math.max(0,n)); return v*v*(3-2*v); };
    const across = ease((t - .3) / .45);
    const y = t < .3 ? route.start.y + (route.top-route.start.y)*ease(t/.3)
      : t < .75 ? route.top : route.top + (route.end.y-route.top)*ease((t-.75)/.25);
    const next = route.kind==='launch' ? launchPoint(route,t) : { x:route.start.x+(route.end.x-route.start.x)*across,
      y, z:route.start.z+(route.end.z-route.start.z)*across };
    const done = this.elapsed === duration;
    if (done) { this.route = null; this.cooldown = route.kind==='launch'?LAUNCH.cooldownMs:TRAVERSAL.cooldownMs; }
    return { pos: next, vy: 0, grounded: done };
  }
}
