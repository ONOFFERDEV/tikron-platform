import { MORTAR, type MortarView } from '../src/mortar.js';

export function readMortar(value: unknown, now: number, width: number, depth: number): MortarView | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as MortarView;
  if (typeof v.available !== 'boolean' || !Number.isFinite(v.readyAt) || !Array.isArray(v.strikes) || v.strikes.length > 2) return null;
  for (const s of v.strikes) if (!s || typeof s.owner !== 'string' || s.owner.length > 128 || ![0, 1].includes(s.team) ||
    !Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.z) || s.x < 0 || s.x > width || s.z < 0 || s.z > depth || s.y !== .12 ||
    !Number.isFinite(s.startedAt) || !Number.isFinite(s.endsAt) || s.startedAt > now + 1000 ||
    s.endsAt - s.startedAt !== MORTAR.warningMs + (MORTAR.rounds - 1) * MORTAR.intervalMs + MORTAR.tailMs) return null;
  return { available: v.available, readyAt: v.readyAt, strikes: v.strikes.map(s => ({ ...s })) };
}
