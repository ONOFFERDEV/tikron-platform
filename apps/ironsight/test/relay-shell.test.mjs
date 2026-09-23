import { readFile } from 'node:fs/promises';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { addCoreSigns, SignalCore } from '../client/signal-core.js';
import { nearestBox } from '../src/physics.js';

describe('Signal Station rendered collision shell', () => {
  afterEach(() => vi.unstubAllGlobals());
  let architecture;
  beforeAll(async () => {
    const bytes = await readFile(new URL('../public/assets/maps/relay-architecture.glb', import.meta.url));
    const loader = new GLTFLoader();
    // Node has no image decoder; retain the real shipped geometry and transforms.
    loader.register(() => ({ name: 'node-texture-decoder', loadTexture: async () => new T.Texture() }));
    architecture = (await loader.parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
    architecture.updateMatrixWorld(true);
  });

  it('places the baked hut roof at the authoritative height', () => {
    const origin = { x: 73.5, y: 10, z: 53 };
    const direction = { x: 0, y: -1, z: 0 };
    const hits = new T.Raycaster(new T.Vector3(origin.x, origin.y, origin.z), new T.Vector3(0, -1, 0))
      .intersectObject(architecture, true);
    expect(hits[0]?.distance).toBeCloseTo(nearestBox(origin, direction, ARENA1.boxes, 12), 4);
  });

  it('leaves the retired tower volume open to a ray above the hut', () => {
    const origin = { x: 68, y: 4, z: 50 };
    const direction = { x: 1, y: 0, z: 0 };
    expect(nearestBox(origin, direction, ARENA1.boxes, 14)).toBe(Infinity);
    const ray = new T.Raycaster(new T.Vector3(68, 4, 50), new T.Vector3(1, 0, 0), 0, 14);
    expect(ray.intersectObject(architecture, true)).toHaveLength(0);
  });

  it.each([ARENA1, ARENA2])('puts $presentation shutters on their actual collision faces', map => {
    const core = map.signalCore;
    if (!core) throw new Error('Relay requires a signal core');
    const scene = new T.Scene();
    const visual = new SignalCore(scene, core);
    visual.setOpen(false);
    scene.updateMatrixWorld(true);
    const z = (core.chamber.min.z + core.chamber.max.z) / 2;
    for (const [x, direction] of [[core.chamber.min.x - 3, 1], [core.chamber.max.x + 3, -1]]) {
      const origin = { x, y: 1.65, z };
      const expected = nearestBox(origin, { x: direction, y: 0, z: 0 }, core.doors, 10);
      const ray = new T.Raycaster(new T.Vector3(x, 1.65, z), new T.Vector3(direction, 0, 0), 0, 10);
      expect(ray.intersectObject(scene, true)[0]?.distance).toBeCloseTo(expected, 1);
    }
  });

  it.each([ARENA1, ARENA2])('keeps $presentation shutter-kit vertices on real support in both states', map => {
    const core = map.signalCore;
    if (!core) throw new Error('Relay requires a signal core');
    const scene = new T.Scene();
    const visual = new SignalCore(scene, core);
    for (const open of [false, true]) {
      visual.setOpen(open);
      scene.updateMatrixWorld(true);
      const supports = map.boxes.filter(box => !open || !core.doors.includes(box)).map(box =>
        new T.Box3(new T.Vector3(box.min.x, box.min.y, box.min.z), new T.Vector3(box.max.x, box.max.y, box.max.z)).expandByScalar(0.02001));
      const point = new T.Vector3();
      scene.traverseVisible(node => {
        if (!(node instanceof T.Mesh)) return;
        const positions = node.geometry.getAttribute('position');
        for (let index = 0; index < positions.count; index++) {
          point.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld);
          expect(supports.some(box => box.containsPoint(point)), `${node.name}: ${point.toArray()}`).toBe(true);
        }
      });
    }
  });

  it.each([ARENA1, ARENA2])('keeps $presentation state markers visible beside backed portal labels', map => {
    const core = map.signalCore;
    if (!core) throw new Error('The map requires a signal core');
    const context = { fillRect() {}, fillText() {} };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
    const scene = new T.Scene();
    const visual = new SignalCore(scene, core);
    addCoreSigns(visual.root, core, map.presentation === 'undertow');
    visual.setOpen(true);
    scene.updateMatrixWorld(true);
    const markers = visual.root.children.filter(node => node.name === 'gate-state-marker');
    expect(markers).toHaveLength(2);
    for (const marker of markers) {
      const direction = marker.position.x < core.chamber.min.x ? 1 : -1;
      const origin = marker.position.clone().add(new T.Vector3(-direction * 2, 0, 0));
      const ray = new T.Raycaster(origin, new T.Vector3(direction, 0, 0), 0, 3);
      expect(ray.intersectObjects(visual.root.children, false)[0]?.object).toBe(marker);
    }
    const supports = map.boxes.map(box => new T.Box3(
      new T.Vector3(box.min.x, box.min.y, box.min.z), new T.Vector3(box.max.x, box.max.y, box.max.z)).expandByScalar(.02001));
    scene.traverseVisible(node => {
      if (!(node instanceof T.Mesh)) return;
      const position = node.geometry.getAttribute('position');
      for (let index = 0; index < position.count; index++) {
        const point = new T.Vector3().fromBufferAttribute(position, index).applyMatrix4(node.matrixWorld);
        expect(supports.some(box => box.containsPoint(point))).toBe(true);
      }
    });
  });
});
