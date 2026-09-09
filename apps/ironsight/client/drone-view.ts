import { DRONE, type DroneView } from '../src/drone.js';
export function readDrone(value: unknown, now: number, width: number, depth: number): DroneView | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as DroneView;
  const point = (p: {x:number;y:number;z:number}) => !!p && [p.x,p.y,p.z].every(Number.isFinite) &&
    p.x>=0 && p.x<=width && p.z>=0 && p.z<=depth && p.y>=0 && p.y<=20;
  if (typeof v.queued !== 'boolean' || !Number.isFinite(v.readyAt) || !Array.isArray(v.flights) || v.flights.length>2) return null;
  for (const f of v.flights) if (!f || !point(f) || typeof f.owner!=='string' || f.owner.length>128 || ![0,1].includes(f.team) ||
    !Number.isFinite(f.startedAt) || !Number.isFinite(f.endsAt) || f.startedAt>now+1000 || f.endsAt-f.startedAt!==DRONE.durationMs ||
    f.lock!==null && (!f.lock || !point(f.lock.point) || !Number.isFinite(f.lock.fireAt) || f.lock.fireAt<f.startedAt || f.lock.fireAt>=f.endsAt)) return null;
  return { ...v, flights:v.flights.map(f=>({...f,lock:f.lock?{point:{...f.lock.point},fireAt:f.lock.fireAt}:null})) };
}
