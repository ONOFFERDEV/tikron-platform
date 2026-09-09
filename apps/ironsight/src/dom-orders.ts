import type { MapDef } from './map/types.js';

type Point = { x: number; z: number };
type Cap = 'a' | 'b' | 'c';
export interface DomAlly extends Point {
  id: string; team: number; alive: boolean; bot: boolean; available: boolean;
}
interface Order { cap: Cap; point: Point; until: number;
  approach?: { points: readonly Point[]; index: number; until: number } }
const KEYS: readonly Cap[] = ['a', 'b', 'c'];
export const DOM_ORDERS = { reviewMs: 1000, commitmentMs: 12000, humanRadius: 8 } as const;

/** Public objectives + allied positions only. Split pushes before arriving, so
 * every bot doesn't independently choose the same nearest flag. Capture speed,
 * enemy perception, weapon stats and ordinary collision navigation are unchanged.
 * No orders are persisted: a fresh room reconstructs them from its own state. */
export class DomOrders {
  private readonly orders = new Map<string, Order>();
  private nextReview = 0;
  private signature = '';
  private readonly approaches: readonly (Point | undefined)[];
  constructor(private readonly map: Pick<MapDef, 'caps' | 'capWaypoints' | 'capApproaches'> & Partial<Pick<MapDef, 'spawns'>>) {
    // Authored deployment-side centres, not live opponent positions. Compute
    // once; guards watch the incoming lane while retaining ordinary perception.
    this.approaches = [map.spawns?.blue, map.spawns?.red].map(points => points?.length
      ? { x: points.reduce((n,p)=>n+p.x,0)/points.length, z: points.reduce((n,p)=>n+p.z,0)/points.length }
      : undefined);
  }

  clear(): void { this.orders.clear(); this.signature = ''; this.nextReview = 0; }
  target(id: string): Point | undefined { return this.orders.get(id)?.point; }
  approach(id: string): Point | undefined {
    const route = this.orders.get(id)?.approach;
    return route?.points[route.index];
  }
  watch(team: number): Point | undefined { return this.approaches[team]; }

  update(now: number, gauges: Record<Cap, number>, allies: readonly DomAlly[]): void {
    const bots = allies.filter(p => p.alive && p.bot && p.available);
    // Progress every simulation tick, including between assignment reviews.
    // Close duels interrupt movement; resuming never rewinds a passed corner.
    for (const p of bots) {
      const order = this.orders.get(p.id), route = order?.approach;
      if (!order || !route) continue;
      if (now >= route.until || this.distance(p, order.cap) <= 4) {
        order.approach = undefined; continue;
      }
      let point = route.points[route.index];
      while (point && Math.hypot(point.x-p.x,point.z-p.z) < .8) point = route.points[++route.index];
    }
    const owners = KEYS.map(k => gauges[k] === 200 ? 0 : gauges[k] === 0 ? 1 : -1);
    const signature = `${owners.join(',')}/${bots.map(p => `${p.id}:${p.team}`).sort().join(',')}`;
    if (signature === this.signature && now < this.nextReview) return;
    this.signature = signature; this.nextReview = now + DOM_ORDERS.reviewMs;
    const previous = new Map(this.orders); this.orders.clear();
    for (const team of [0, 1]) {
      const roster = bots.filter(p => p.team === team).sort((a,b) => a.id.localeCompare(b.id));
      const secured = (k: Cap) => gauges[k] === (team === 0 ? 200 : 0);
      const allSecured = KEYS.every(secured);
      const loads: Record<Cap, number> = {a:0,b:0,c:0};
      // Humans keep full control. Their visible presence near a flag occupies a
      // reinforcement slot; gallery volunteers also yield their regular order.
      for (const p of allies.filter(p => p.alive && p.team === team && (!p.bot || !p.available))) {
        const k = [...KEYS].sort((a,b) => this.distance(p,a)-this.distance(p,b))[0]!;
        if (this.distance(p,k) <= DOM_ORDERS.humanRadius) loads[k]++;
      }
      const capacity = (k: Cap) => !allSecured && secured(k) ? 1 : 2;
      const retain = [...roster].sort((a,b) => {
        const x=previous.get(a.id),y=previous.get(b.id);
        return (x?this.distance(a,x.cap):Infinity)-(y?this.distance(b,y.cap):Infinity) || a.id.localeCompare(b.id);
      });
      for (const p of retain) {
        const old = previous.get(p.id);
        if (!old || old.until <= now || loads[old.cap] >= capacity(old.cap)) continue;
        this.orders.set(p.id,old); loads[old.cap]++;
      }
      for (const p of roster) {
        if (this.orders.has(p.id)) continue;
        let candidates = KEYS.filter(k => loads[k] < capacity(k));
        // Full team plus human grouping can exceed the preferred slots. Overflow
        // reinforces the least staffed unfinished flag, never an unseen enemy.
        if (!candidates.length) {
          candidates = KEYS.filter(k => allSecured || !secured(k));
          const least = Math.min(...candidates.map(k => loads[k]));
          candidates = candidates.filter(k => loads[k] === least);
        }
        candidates.sort((a,b) => (this.distance(p,a)+(secured(a)&&!allSecured?40:0))
          -(this.distance(p,b)+(secured(b)&&!allSecured?40:0)) || KEYS.indexOf(a)-KEYS.indexOf(b));
        const cap = candidates[0]!;
        const point = this.anchors(cap).reduce((a,b) => Math.hypot(a.x-p.x,a.z-p.z) <= Math.hypot(b.x-p.x,b.z-p.z) ? a : b);
        // Renewing the same flag preserves completed/active route progress.
        // Reassignment, death, departure or a gallery volunteer drops the route.
        const old = previous.get(p.id);
        const approach = old?.cap === cap ? old.approach : this.chooseApproach(p,cap,now);
        this.orders.set(p.id,{cap,point:{x:point.x,z:point.z},until:now+DOM_ORDERS.commitmentMs,approach});
        loads[cap]++;
      }
    }
  }
  private chooseApproach(p: Point, cap: Cap, now: number): Order['approach'] {
    const distance = this.distance(p,cap);
    if (distance <= 25) return;
    const routes = this.map.capApproaches?.[cap]?.filter(route => route.length > 0);
    const points = routes?.reduce<readonly Point[] | undefined>((best,route) => !best ||
      Math.hypot(route[0]!.x-p.x,route[0]!.z-p.z) < Math.hypot(best[0]!.x-p.x,best[0]!.z-p.z) ? route : best,undefined);
    // A reinforcement already beyond both entries goes straight to its flag.
    if (!points || Math.hypot(points[0]!.x-p.x,points[0]!.z-p.z) >= distance) return;
    return {points,index:0,until:now+45000};
  }
  private anchors(k: Cap): readonly Point[] {
    const anchors = this.map.capWaypoints?.[k];
    return anchors?.length ? anchors : [this.map.caps[k]];
  }
  private distance(p: Point, k: Cap): number {
    return Math.min(...this.anchors(k).map(a => Math.hypot(a.x-p.x,a.z-p.z)));
  }
}
