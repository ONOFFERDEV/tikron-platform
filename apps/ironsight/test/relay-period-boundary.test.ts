import { describe, expect, it } from 'vitest';
import { relaySiteBoundary, relayWorkshopPlant } from '../client/relay-site.js';

describe('Relay period boundary', () => {
  it('uses masonry for the continuous works shell while limiting iron to fittings', () => {
    const width = 150, depth = 100;

    const parts = relaySiteBoundary(width, depth);

    const volume = (material: string) => parts.filter(p => p.material === material)
      .reduce((total, p) => total + p.w * p.h * p.d, 0);
    const total = parts.reduce((sum, p) => sum + p.w * p.h * p.d, 0);
    expect(volume('concrete') / total).toBeGreaterThan(.85);
    expect(volume('metal') / total).toBeLessThan(.01);
  });

  it('keeps the roof workshop silhouette narrow and masonry above the existing roof', () => {
    const roof = 11.24;

    const parts = relayWorkshopPlant();

    const stacks = parts.filter(p => p.material === 'concrete' && p.y - p.h / 2 >= roof - .001 && p.h >= 3);
    expect(stacks.length).toBeGreaterThanOrEqual(2);
    for (const p of stacks) {
      expect(p.w).toBeLessThan(2.5);
      expect(p.d).toBeLessThan(2.5);
    }
    expect(parts.filter(p => p.material === 'metal' && p.w * p.h * p.d > .5)).toEqual([]);
  });

  it('keeps every rotated extent outside the unchanged map within the existing box budget', () => {
    const width = 150, depth = 100;

    const parts = relaySiteBoundary(width, depth);

    expect(parts.length).toBeLessThanOrEqual(785);
    expect(new Set(parts.map(p => p.material)).size).toBeLessThanOrEqual(7);
    for (const p of parts) {
      const rx = (Math.abs(Math.cos(p.yaw)) * p.w + Math.abs(Math.sin(p.yaw)) * p.d) / 2;
      const rz = (Math.abs(Math.sin(p.yaw)) * p.w + Math.abs(Math.cos(p.yaw)) * p.d) / 2;
      expect(p.x + rx <= 1e-9 || p.x - rx >= width - 1e-9 || p.z + rz <= 1e-9 || p.z - rz >= depth - 1e-9).toBe(true);
      expect([p.x, p.y, p.z, p.w, p.h, p.d, p.yaw].every(Number.isFinite)).toBe(true);
      expect(Math.min(p.w, p.h, p.d)).toBeGreaterThan(0);
    }
  });
});
