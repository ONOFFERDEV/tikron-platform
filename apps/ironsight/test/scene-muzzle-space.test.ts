import { describe, expect, it } from "vitest";
import { Object3D, Vector3 } from "three";

import { setObjectWorldPosition } from "../client/scene-space.js";

describe("viewmodel muzzle coordinate space", () => {
  it("keeps the emitter on each source socket through non-identity slot transforms", () => {
    const camera = new Object3D();
    camera.position.set(3, 2, -4);
    camera.rotation.set(0.1, -0.4, 0.05);
    const viewmodel = new Object3D();
    viewmodel.position.set(0.18, -0.22, -0.65);
    viewmodel.rotation.set(-0.07, 0.2, -0.03);
    camera.add(viewmodel);
    const emitter = new Object3D();
    viewmodel.add(emitter);

    const weapon = new Object3D();
    viewmodel.add(weapon);
    const socket = new Object3D();
    weapon.add(socket);

    for (const slot of [
      { position: [0.08, -0.03, -0.2], rotationY: Math.PI, socket: [0.01, 0.04, 0.72] },
      { position: [-0.05, 0.06, -0.31], rotationY: Math.PI * 0.8, socket: [-0.02, 0.02, 0.64] },
      { position: [0.03, -0.01, -0.12], rotationY: Math.PI * 1.1, socket: [0.04, 0.01, 0.51] },
    ] as const) {
      weapon.position.fromArray(slot.position);
      weapon.rotation.set(0, slot.rotationY, 0);
      socket.position.fromArray(slot.socket);
      camera.updateWorldMatrix(true, true);

      const sourceWorld = socket.getWorldPosition(new Vector3());
      expect(setObjectWorldPosition(emitter, sourceWorld)).toBe(true);
      camera.updateWorldMatrix(true, true);
      expect(emitter.getWorldPosition(new Vector3()).distanceTo(sourceWorld)).toBeLessThan(1e-9);
    }
  });

  it("fails closed when the marker has no owning parent", () => {
    const emitter = new Object3D();
    emitter.position.set(1, 2, 3);
    expect(setObjectWorldPosition(emitter, new Vector3(8, 9, 10))).toBe(false);
    expect(emitter.position.toArray()).toEqual([1, 2, 3]);
  });
});
