import { expect, it } from 'vitest';
import * as THREE from 'three';
import { ReconFlyover } from '../client/recon-flyover.js';
import { readSupport, emptySupport } from '../client/support-view.js';

it('rejects malformed/oversized support data and copies frozen contact snapshots', () => {
  const v = { ...emptySupport(), scan: { startedAt: 1000, sampledAt: 3000, expiresAt: 5200, contacts: [{ x: 5, z: 5 }] } };
  const decoded = readSupport(v, 3000, 150, 100)!;
  v.scan.contacts[0]!.x = 9; expect(decoded.scan!.contacts[0]!.x).toBe(5);
  for (const bad of [null, {}, { ...v, count: NaN }, { ...v, flights: Array(3).fill({}) },
    { ...v, scan: { ...v.scan, contacts: Array(13).fill({ x: 5, z: 5 }) } },
    { ...v, scan: { ...v.scan, contacts: [{ x: Infinity, z: 0 }] } },
    { ...v, scan: { ...v.scan, expiresAt: 999999 } }]) expect(readSupport(bad, 3000, 150, 100)).toBeNull();
});

it('seeks a fixed two-aircraft pool without new resources, lights or playable cover', () => {
  const scene = new THREE.Scene(), flyover = new ReconFlyover(scene, 150, 100);
  const objects: THREE.Object3D[] = []; scene.traverse(o => objects.push(o));
  const flights = [0, 1].map(team => ({ owner: String(team), team, startedAt: 1000, endsAt: 13000 }));
  for (let now = 0; now < 14000; now += 100) {
    flyover.update(flights, now);
    expect(flyover.inspect().filter(p => p.visible)).toHaveLength(now >= 1000 && now < 13000 ? 2 : 0);
    for (const p of flyover.inspect()) if (p.visible) expect(p.position[1]).toBeGreaterThan(16);
  }
  const final: THREE.Object3D[] = []; scene.traverse(o => final.push(o)); expect(final).toEqual(objects);
  expect(objects.some(o => o instanceof THREE.Light)).toBe(false);
  expect(objects.filter(o => o instanceof THREE.Mesh).every(o => !o.castShadow)).toBe(true);
  flyover.update(flights, 7000);
  expect(flyover.inspect()[0]!.position[0]).toBe(75); expect(flyover.inspect()[1]!.position[0]).toBe(75);
  const independent = new ReconFlyover(new THREE.Scene(), 150, 100); independent.update(flights, 7000);
  expect(independent.inspect()).toEqual(flyover.inspect());
  const bluePose = flyover.inspect()[1]!.position;
  flyover.update([flights[1]!], 7000);
  expect(flyover.inspect()[0]!.position).toEqual(bluePose);
});
