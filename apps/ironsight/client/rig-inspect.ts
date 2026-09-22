import { SceneRig } from "./scene.js";
import { mapForRoom } from "../src/modes.js";
import type { RigInspectOptions } from "./rig-inspect-query.js";
import { createBundledHitAuthorityContract } from "../src/hit-authority-contract.js";

export function startRigInspector(options: RigInspectOptions): void {
  const host = document.getElementById("app") ?? document.body;
  for (const child of Array.from(document.body.children)) {
    if (child !== host && child instanceof HTMLElement) child.hidden = true;
  }
  host.replaceChildren();
  const map = mapForRoom("tdm", "");
  const hitAuthority = createBundledHitAuthorityContract();
  const scene = new SceneRig(map, host, hitAuthority === undefined
    ? {}
    : { hitAnimationAuthority: hitAuthority });
  // Relay's center is now solid machinery. Use the clear west service pocket
  // so orbit cameras and the operator never intersect the new architecture.
  const x = 10, z = map.bounds.depth / 2;
  const pose = { x, y: 0, z, yaw: 0, pitch: options.aim * Math.PI / 180, crouch: options.pose.startsWith('crouch'),
    alive: true, team: options.team, weapon: options.weapon };
  const clip = options.pose === "crouch" ? "crouch_idle" : options.pose;
  const yaw = options.yaw * Math.PI / 180, pitch = options.pitch * Math.PI / 180;
  const chest = pose.crouch ? 0.8 : 1.3;
  scene.camera.position.set(x + Math.sin(yaw) * Math.cos(pitch) * options.dist,
    chest + Math.sin(pitch) * options.dist, z + Math.cos(yaw) * Math.cos(pitch) * options.dist);
  scene.camera.lookAt(x, chest, z);
  const flags = window as unknown as { __inspectReady: boolean; __rigInspect: unknown };
  flags.__inspectReady = false;
  let frames = 0;
  const frame = () => {
    const ready = scene.inspectRig(pose, clip, options.blend, options.arms, options.sample, options.reload);
    const focus = options.dist <= 1.1 ? scene.inspectionHandFocus() : undefined;
    if (focus) {
      scene.camera.position.set(focus.x + Math.sin(yaw) * Math.cos(pitch) * options.dist,
        focus.y + Math.sin(pitch) * options.dist, focus.z + Math.cos(yaw) * Math.cos(pitch) * options.dist);
      scene.camera.lookAt(focus);
    }
    scene.render();
    const actor = scene.inspectionActorInfo("inspect");
    if (!actor.supported) {
      flags.__rigInspect = { actor };
      flags.__inspectReady = true;
      return;
    }
    if (ready && ++frames >= 2) {
      const result: Record<string, unknown> = { actor };
      const grip = scene.inspectionGrip();
      if (typeof grip === "object" && grip !== null) Object.assign(result, grip);
      flags.__rigInspect = result;
      flags.__inspectReady = true;
    } else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
