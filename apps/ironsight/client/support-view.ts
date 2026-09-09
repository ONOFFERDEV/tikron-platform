import { RECON, type SupportView } from '../src/air-support.js';

export const emptySupport = (): SupportView => ({ count: 0, queued: false, readyAt: 0, flights: [], scan: null });
/** Treat transient messages as unknown too; bound work and reject nonfinite data. */
export function readSupport(value: unknown, now: number, width: number, depth: number): SupportView | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as SupportView;
  if (!Number.isSafeInteger(v.count) || v.count < 0 || v.count > 65535 || typeof v.queued !== 'boolean' ||
    !Number.isFinite(v.readyAt) || !Array.isArray(v.flights) || v.flights.length > 2) return null;
  for (const f of v.flights) if (!f || typeof f.owner !== 'string' || f.owner.length > 128 || ![0, 1].includes(f.team) ||
    !Number.isFinite(f.startedAt) || !Number.isFinite(f.endsAt) || f.endsAt - f.startedAt !== RECON.durationMs ||
    f.startedAt > now + 1000) return null;
  if (v.scan !== null) {
    const s = v.scan;
    if (!s || !Number.isFinite(s.sampledAt) || !Number.isFinite(s.startedAt) || !Number.isFinite(s.expiresAt) ||
      s.expiresAt <= s.sampledAt || s.expiresAt - s.sampledAt > RECON.contactMs || s.sampledAt > now + 1000 ||
      !Array.isArray(s.contacts) || s.contacts.length > 12 || s.contacts.some(p => !p || !Number.isFinite(p.x) ||
        !Number.isFinite(p.z) || p.x < 0 || p.z < 0 || p.x > width || p.z > depth)) return null;
  }
  return { ...v, flights: v.flights.map(f => ({ ...f })), scan: v.scan ? { ...v.scan, contacts: v.scan.contacts.map(p => ({ ...p })) } : null };
}
