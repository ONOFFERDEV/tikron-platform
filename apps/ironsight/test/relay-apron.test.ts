import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildRelayApronGeometry } from '../client/relay-apron.js';
import { architectureMeshes } from '../client/site-architecture.js';

describe('Relay exterior paving', () => {
  it('keeps untextured site ground out of architecture replacement on every map', () => {
    const scene = new T.Scene();
    const cover = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
    scene.add(cover);
    for (const map of ['relay', 'undertow', 'switchyard']) {
      const apron = new T.Mesh(new T.PlaneGeometry(180, 160), new T.MeshStandardMaterial());
      apron.name = `${map}-apron`; apron.userData.siteGround = true; scene.add(apron);
    }
    // This is the actual selection passed to loadArchitecture's disposal loop.
    expect(architectureMeshes(scene)).toEqual([cover]);
    scene.traverse(node => {
      if (node instanceof T.Mesh) { node.geometry.dispose(); node.material.dispose(); }
    });
  });

  it('covers the exterior through the fog horizon with upward flat faces outside playable ground', () => {
    const geometry = buildRelayApronGeometry();
    const p = geometry.getAttribute('position');
    expect(p.count / 3).toBeLessThan(4500);
    let area = 0;
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      expect([a, b, c].every(v => Number.isFinite(v.x) && Number.isFinite(v.z) && Math.abs(v.y + 0.03) < 1e-7)).toBe(true);
      expect(Math.max(a.x, b.x, c.x) <= 0 || Math.min(a.x, b.x, c.x) >= 60 ||
        Math.max(a.z, b.z, c.z) <= 0 || Math.min(a.z, b.z, c.z) >= 40).toBe(true);
      const cross = b.sub(a).cross(c.sub(a));
      expect(cross.y).toBeGreaterThan(0);
      area += cross.y / 2;
    }
    expect(area).toBeCloseTo(480 * 440 - 60 * 40, 2);
    expect(geometry.boundingBox!.min.toArray()).toEqual([-210, expect.closeTo(-0.03, 6), -200]);
    expect(geometry.boundingBox!.max.toArray()).toEqual([270, expect.closeTo(-0.03, 6), 240]);
    for (const attribute of ['uv', 'normal', 'color']) {
      expect(geometry.getAttribute(attribute).count).toBe(p.count);
      expect([...geometry.getAttribute(attribute).array].every(Number.isFinite)).toBe(true);
    }
    geometry.dispose();
  });
});
