import { SceneRig } from "./scene.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";

/** Deterministic production-renderer review. No matchmaking, no gameplay sockets. */
export function startMapInspector(): void {
  const params = new URLSearchParams(location.search);
  const host = document.getElementById("app") ?? document.body;
  host.replaceChildren();
  const map = params.get("map") === "arena2" ? ARENA2 : params.get("map") === "arena3" ? ARENA3 : ARENA1;
  const actorCount = params.get("shot")?.endsWith('stress') ? 11 : 0;
  const scene = new SceneRig(map, host, { loadActors: actorCount > 0, loadViewmodel: false });
  scene.hideViewmodel();
  const shots: Record<string, readonly [number, number, number, number, number, number]> = {
    overview: [51, 33, 52, 28, 0, 16],
    cooling: [20, 1.65, 9, 34, 2.3, 3],
    relay: [20, 1.65, 23, 31, 3, 16],
    freight: [42, 1.65, 31, 27, 1.4, 35],
    spawn: [5, 1.65, 15, 23, 1.8, 20],
    vista: [45, 13, 37, 26, 4.2, 10],
    stress: [8, 1.65, 11, 35, 1.5, 11],
    'undertow-overview': [52, 38, 57, 29, 0, 19],
    'undertow-home': [15, 1.65, 21, 28, 1.6, 17],
    'undertow-center': [30, 1.65, 20, 33, 2, 12],
    'undertow-deck': [17, 2.85, 9, 30, 1.6, 20],
    'undertow-vista': [48, 13, 37, 25, 4.0, 9],
    'undertow-maintenance': [36, 1.65, 35, 23, 2.5, 28],
    'undertow-stress': [14, 1.65, 16, 33, 1.5, 19],
  };
  const shot = shots[params.get("shot") ?? "overview"] ?? shots.overview!;
  scene.camera.position.set(shot[0], shot[1], shot[2]);
  scene.camera.lookAt(shot[3], shot[4], shot[5]);
  const flags = window as unknown as { __inspectReady: boolean; __mapInspect: unknown };
  flags.__inspectReady = false;
  const gl = scene.canvas.getContext("webgl2");
  const debug = gl?.getExtension("WEBGL_debug_renderer_info");
  const gpu = gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : "unavailable";
  const samples: number[] = [];
  const actors = new Map(Array.from({ length: actorCount }, (_, i) => [`inspect-${i}`, {
    x: 20 + Math.floor(i / 3) * 4, y: 0, z: (map === ARENA2 ? 16 : 10) + (i % 3) * 0.6,
    yaw: -Math.PI / 2, pitch: 0, crouch: false, team: i % 2,
    alive: true, weapon: 0,
  }] as const));
  let frameCount = 0, last = performance.now(), peakCalls = 0, peakTriangles = 0;
  const tick = (now: number) => {
    if (frameCount > 30) samples.push(now - last);
    if (actorCount) scene.syncPlayers(actors, "local-inspector", Math.min(50, now - last));
    last = now;
    scene.render();
    const info = scene.getRenderInfo();
    peakCalls = Math.max(peakCalls, info.calls); peakTriangles = Math.max(peakTriangles, info.triangles);
    if (!scene.readyForInspection(actorCount)) { frameCount = 0; samples.length = 0; requestAnimationFrame(tick); return; }
    if (++frameCount < 151) { requestAnimationFrame(tick); return; }
    const sorted = [...samples].sort((a, b) => a - b);
    flags.__mapInspect = {
      ...scene.getRenderInfo(), gpu, viewport: [innerWidth, innerHeight],
      actorCount,
      peakCallsIncludingShadowBake: peakCalls, peakTrianglesIncludingShadowBake: peakTriangles,
      estimatedTextureMiB: scene.textureBytesEstimate() / (1024 * 1024),
      samples: samples.length, medianMs: sorted[Math.floor(sorted.length / 2)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      note: "Frame intervals on this GPU; not proof of the 60 fps laptop iGPU floor. Static shadows are cached after load.",
    };
    flags.__inspectReady = true;
  };
  requestAnimationFrame(tick);
}
