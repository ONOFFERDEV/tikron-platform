import { SceneRig } from "./scene.js";
import { ARENA } from "../src/config.js";
import { mapForRoom } from "../src/modes.js";
import type { RigInspectOptions } from "./rig-inspect-query.js";

export function startRigInspector(options: RigInspectOptions): void {
  const host = document.getElementById("app") ?? document.body;
  for (const child of Array.from(document.body.children)) {
    if (child !== host && child instanceof HTMLElement) child.hidden = true;
  }
  host.replaceChildren();
  const scene = new SceneRig(mapForRoom("tdm", ""), host);
  // Relay's center is now solid machinery. Use the clear west service pocket
  // so orbit cameras and the operator never intersect the new architecture.
  const x = 10, z = ARENA.depth / 2;
  const pose = { x, y: 0, z, yaw: 0, pitch: 0, crouch: options.pose === "crouch",
    alive: true, team: 0, weapon: options.weapon };
  const clip = options.pose === "crouch" ? "crouch_idle" : options.pose;
  const yaw = options.yaw * Math.PI / 180, pitch = options.pitch * Math.PI / 180;
  const chest = pose.crouch ? 0.8 : 1.3;
  scene.camera.position.set(x + Math.sin(yaw) * Math.cos(pitch) * options.dist,
    chest + Math.sin(pitch) * options.dist, z + Math.cos(yaw) * Math.cos(pitch) * options.dist);
  scene.camera.lookAt(x, chest, z);
  const flags = window as unknown as { __inspectReady: boolean };
  flags.__inspectReady = false;
  let frames = 0;
  const frame = () => {
    const ready = scene.inspectRig(pose, clip, options.blend, options.arms);
    const focus = options.dist <= 1.1 ? scene.inspectionHandFocus() : undefined;
    if (focus) {
      scene.camera.position.set(focus.x + Math.sin(yaw) * Math.cos(pitch) * options.dist,
        focus.y + Math.sin(pitch) * options.dist, focus.z + Math.cos(yaw) * Math.cos(pitch) * options.dist);
      scene.camera.lookAt(focus);
    }
    scene.render();
    if (ready && ++frames >= 2) flags.__inspectReady = true;
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
