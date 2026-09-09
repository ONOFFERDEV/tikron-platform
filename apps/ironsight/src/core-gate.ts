import type { MapDef } from './map/types.js';
import { rampOccluderBoxes } from './map/tilemap.js';
import type { Box, Vec3 } from './physics.js';
import type { SignalFrame } from './signal-event.js';

/** Precompute both immutable collision sets. No per-frame map rebuilding. */
export class CoreCollision {
  readonly closed: readonly Box[];
  readonly open: readonly Box[];
  readonly closedHits: readonly Box[];
  readonly openHits: readonly Box[];
  constructor(map: MapDef) {
    this.closed = map.boxes;
    this.open = map.signalCore ? map.boxes.filter(b => !map.signalCore!.doors.includes(b)) : map.boxes;
    const ramps = (map.ramps ?? []).flatMap(rampOccluderBoxes);
    this.closedHits = [...this.closed, ...ramps]; this.openHits = [...this.open, ...ramps];
  }
  boxes(open: boolean): readonly Box[] { return open ? this.open : this.closed; }
  hits(open: boolean): readonly Box[] { return open ? this.openHits : this.closedHits; }
}

/** Server-only transitions, with a bounded historical barrier channel for shots.
 * Closed is conservative before retained history. Occupancy holds BOTH doors so
 * a player inside always has two exits; no crushing, teleporting or HP changes. */
export class CoreGate {
  open = false;
  private readonly history: { at: number; open: boolean }[] = [];
  constructor(private readonly core: MapDef['signalCore']) {}
  update(wantsOpen: boolean, occupants: Iterable<Vec3>, now: number): boolean {
    if (!this.core) return false;
    const b = this.core.chamber;
    // Full chamber + 1.5m approach guard, larger than the standing capsule.
    const occupied = this.open && !wantsOpen && [...occupants].some(p =>
      p.x > b.min.x - 1.5 && p.x < b.max.x + 1.5 && p.z > b.min.z - 1.5 && p.z < b.max.z + 1.5 &&
      p.y < b.max.y && p.y + 1.8 > b.min.y);
    const next = wantsOpen || occupied;
    if (next === this.open) return false;
    this.open = next; this.history.push({ at: now, open: next });
    // Keep the predecessor at the start of the 2s window, far beyond rewind.
    while (this.history.length > 2 && this.history[1]!.at < now - 2000) this.history.shift();
    return true;
  }
  at(now: number): boolean {
    for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i]!.at <= now) return this.history[i]!.open;
    return false;
  }
}

/** At most one nearby bot per team volunteers on the public warning. It uses
 * ordinary objective movement/aim/reaction and both real collision sets; never
 * moves a player directly or changes accuracy, HP, speed or target visibility. */
export class CorePush {
  private key='';
  private readonly routes=new Map<string,{entry:{x:number;z:number};exit:{x:number;z:number}}>();
  update(epoch:number,frame:SignalFrame,open:boolean,players:readonly (Vec3 & {id:string;team:number;alive:boolean})[]):void {
    const key=`${epoch}:${frame.cycle}`;
    if(frame.phase==='warning' && key!==this.key) {
      this.key=key;this.routes.clear();
      for(const team of [0,1]) {
        const nearby=players.filter(p=>p.alive && p.team===team && p.y<3 && Math.hypot(p.x-75,p.z-50)<45)
          .sort((a,b)=>Math.hypot(a.x-75,a.z-50)-Math.hypot(b.x-75,b.z-50)||a.id.localeCompare(b.id))[0];
        if(nearby){const west=nearby.x<75;this.routes.set(nearby.id,{entry:{x:west?67:83,z:50},exit:{x:west?83:67,z:50}});}
      }
    }
    if(frame.phase!=='warning' && !open){this.routes.clear();return;}
    for(const [id,r] of this.routes) {
      const p=players.find(p=>p.id===id);
      if(!p?.alive || (open && Math.abs(p.z-50)<3 && (r.exit.x>75?p.x>82:p.x<68)))this.routes.delete(id);
    }
  }
  target(id:string,open:boolean):{x:number;z:number}|undefined {
    const r=this.routes.get(id);return r ? (open?r.exit:r.entry) : undefined;
  }
}
