import { DRONE, type DroneFlight, type DroneView } from '../src/drone.js';

const record = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const point = (value: unknown, width: number, depth: number, maxY: number): boolean => {
  if (!record(value)) return false;
  const { x, y, z } = value;
  return [x, y, z].every(Number.isFinite) && (x as number) >= 0 && (x as number) <= width
    && (z as number) >= 0 && (z as number) <= depth && (y as number) >= 0 && (y as number) <= maxY;
};

export function readDrone(value: unknown, now: number, width: number, depth: number): DroneView | null {
  if (!record(value)) return null;
  const v = value as unknown as DroneView;
  if (v.protocol !== 2 || v.kind !== 'fixed_linear_strafe' || typeof v.queued !== 'boolean'
    || !Number.isFinite(v.readyAt) || v.readyAt < 0 || !Array.isArray(v.flights) || v.flights.length > 2) return null;
  for (const flight of v.flights) {
    const corridor = flight?.corridor;
    if (!flight || flight.kind !== 'attack_biplane' || !point(flight, width, depth, 20)
      || typeof flight.owner !== 'string' || flight.owner.length > 128 || ![0, 1].includes(flight.team)
      || !Number.isFinite(flight.startedAt) || !Number.isFinite(flight.warningEndsAt) || !Number.isFinite(flight.endsAt)
      || flight.startedAt > now + 1_000 || flight.warningEndsAt - flight.startedAt !== DRONE.warningMs
      || flight.endsAt - flight.warningEndsAt !== DRONE.passMs || flight.lock !== null || !corridor
      || !point(corridor.start, width, depth, 0) || !point(corridor.end, width, depth, 0)
      || Math.abs(flight.x - corridor.start.x) > 1e-6 || Math.abs(flight.z - corridor.start.z) > 1e-6 || flight.y !== DRONE.altitude
      || corridor.width !== DRONE.corridorWidth
      || Math.abs(Math.hypot(corridor.end.x - corridor.start.x, corridor.end.z - corridor.start.z) - DRONE.corridorLength) > 1e-6) return null;
  }
  return { ...v, flights: v.flights.map(flight => ({ ...flight, lock: null, corridor: flight.corridor && {
    width: flight.corridor.width, start: { ...flight.corridor.start }, end: { ...flight.corridor.end },
  } })) };
}
