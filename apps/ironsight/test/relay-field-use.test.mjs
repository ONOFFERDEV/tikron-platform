import { describe, expect, it } from 'vitest';
import { ARENA1 } from '../src/map/arena1.js';
import { relayFieldUsePieces } from '../client/relay-yard.js';
import { relayCraterSites } from '../client/relay-ground-wear.js';

describe('Relay human-scale field use', () => {
  const standing = ARENA1.boxes.filter(b => b.min.y === 0 && b.max.y > 0.5 && !ARENA1.terrain?.boxes.includes(b));

  it('adds no render-only cover: low, overhead, thin or wall-mounted pieces only', () => {
    const mounted = (x, z, depth) => depth <= 0.2 && standing.some(b =>
      x >= b.min.x && x <= b.max.x && (Math.abs(z - b.min.z) < 0.2 || Math.abs(z - b.max.z) < 0.2));
    for (const p of relayFieldUsePieces()) {
      if (Math.min(p.w, p.d) <= 0.13) continue; // poles and wire
      const top = p.y + p.h / 2, bottom = p.y - p.h / 2;
      expect(top <= 0.5 || bottom >= 3.0 || mounted(p.x, p.z, p.d)).toBe(true);
    }
  });

  it('keeps every ground piece and crater clear of existing solids', () => {
    for (const p of relayFieldUsePieces().filter(q => q.y - q.h / 2 < 0.5 && Math.min(q.w, q.d) > 0.13)) {
      const r = Math.hypot(p.w, p.d) / 2 - 0.02;
      for (const b of standing) {
        const inside = p.x > b.min.x + r && p.x < b.max.x - r && p.z > b.min.z + r && p.z < b.max.z - r;
        expect(inside).toBe(false);
      }
    }
    for (const [x, z] of relayCraterSites(ARENA1))
      expect(standing.every(b => x < b.min.x - 4.5 || x > b.max.x + 4.5 || z < b.min.z - 4.5 || z > b.max.z + 4.5)).toBe(true);
  });
});
