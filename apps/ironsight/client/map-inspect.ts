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
  const effects = params.get("shot")?.endsWith("effects-stress") ?? false;
  const actorCount = params.get("shot")?.endsWith('stress') ? 11 : 0;
  const scene = new SceneRig(map, host, { loadActors: actorCount > 0, loadViewmodel: effects });
  if (!effects) scene.hideViewmodel();
  const shots: Record<string, readonly [number, number, number, number, number, number]> = {
    overview: [51, 33, 52, 28, 0, 16],
    cooling: [20, 1.65, 9, 34, 2.3, 3],
    uplink: [34, 2.85, 4, 37, 5, -6],
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
    'switchyard-overview': [52, 38, 57, 29, 0, 19],
    'switchyard-center': [25, 1.65, 25, 31, 2.2, 17],
    'switchyard-service': [39, 1.65, 13, 47, 2, 7],
    'switchyard-vista': [48, 13, 37, 26, 4, 8],
    'switchyard-north': [20, 1.65, 3, 31, 3.5, -5],
    'switchyard-stress': [8, 1.65, 11, 35, 1.5, 11],
  };
  const shotName = (params.get("shot") ?? "overview").replace("effects-stress", "stress");
  const shot = shots[shotName] ?? shots.overview!;
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
  const firstFrames: number[] = [];
  let drained: unknown;
  let started = 0, volleyAt = 0, blastAt = 0, volleys = 0, explosions = 0;
  const calls: number[] = [], triangles: number[] = [];
  let peakTextureMiB = 0, peakTextures = 0;
  const tick = (now: number) => {
    const ready = scene.readyForInspection(actorCount) && (!effects || scene.inspectViewmodel(null, false));
    if (ready && !started) { started = now; volleyAt = now; blastAt = now; }
    if (ready) firstFrames.push(now - last);
    if (effects && ready && now - started < 15000) {
      // Twelve rifles at 10 shots/s, pooled flashes/casings/impacts, and a
      // synchronized twelve-grenade burst every 2 seconds. Render load only:
      // this deliberately exceeds normal grenade availability; no server claims.
      if (now >= volleyAt) {
        volleyAt = now + 100; volleys++;
        for (let i = 0; i < 12; i++) {
          const origin = i === 11 ? scene.getSelfMuzzlePos() : scene.getRemoteMuzzleAnchor(`inspect-${i}`);
          if (!origin) continue;
          const dir = { x: -1, y: 0, z: 0 };
          scene.spawnMuzzleFlash(origin, dir); scene.spawnCasing(origin, dir);
          scene.addTracer(origin, dir, 12, false, 300);
          scene.spawnImpact({ x: origin.x - 8, y: 1, z: origin.z }, dir, i % 2 === 0);
        }
        scene.fireRecoil();
      }
      if (now >= blastAt) {
        blastAt = now + 2000;
        for (let i = 0; i < 12; i++) {
          scene.boomNade({ id: `stress-${explosions++}`, x: 17 + i % 4 * 2,
            y: 0.2, z: (map === ARENA2 ? 16 : 10) + Math.floor(i / 4) * 0.7, r: 5 });
        }
      }
    }
    if (frameCount > 30 && (!effects || now - started < 15000)) samples.push(now - last);
    if (actorCount) scene.syncPlayers(actors, "local-inspector", Math.min(50, now - last));
    last = now;
    scene.render();
    const info = scene.getRenderInfo();
    peakCalls = Math.max(peakCalls, info.calls); peakTriangles = Math.max(peakTriangles, info.triangles);
    if (!ready) { frameCount = 0; samples.length = 0; requestAnimationFrame(tick); return; }
    if (frameCount > 30 && (!effects || now - started < 15000)) { calls.push(info.calls); triangles.push(info.triangles); }
    peakTextureMiB = Math.max(peakTextureMiB, scene.textureBytesEstimate() / (1024 * 1024));
    peakTextures = Math.max(peakTextures, info.textures);
    ++frameCount;
    if (effects && now - started >= 18000) drained = { ...scene.getEffectInfo(), ...scene.getRenderInfo() };
    if (effects ? now - started < 18000 : frameCount < 151) { requestAnimationFrame(tick); return; }
    const sorted = [...samples].sort((a, b) => a - b);
    flags.__mapInspect = {
      uplinks: scene.inspectRelayUplinks(),
      preparation: scene.getPreparationInfo(),
      ...scene.getRenderInfo(), gpu, viewport: [innerWidth, innerHeight],
      actorCount, localViewmodel: effects, effects: effects ? { volleys, explosions, durationMs: 15000, drainMs: now - started - 15000, drained,
        rifles: 12, targetShotsPerRiflePerSecond: 10, observedShotsPerRiflePerSecond: volleys / 15, grenadesPerBurst: 12, burstIntervalMs: 2000 } : null,
      medianCalls: [...calls].sort((a,b) => a-b)[Math.floor(calls.length / 2)],
      peakMeasuredCalls: Math.max(...calls), peakMeasuredTriangles: Math.max(...triangles),
      peakTextureMiB, peakTextures,
      peakCallsIncludingShadowBake: peakCalls, peakTrianglesIncludingShadowBake: peakTriangles,
      estimatedTextureMiB: scene.textureBytesEstimate() / (1024 * 1024),
      firstFramesMaxMs: Math.max(...firstFrames.slice(0, 30)),
      samples: samples.length, medianMs: sorted[Math.floor(sorted.length / 2)],
      maxMs: Math.max(...samples), overBudgetFrames: samples.filter(ms => ms > 16.7).length,
      p99Ms: sorted[Math.floor(sorted.length * 0.99)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      note: "Frame intervals on this GPU; not proof of the 60 fps laptop iGPU floor. Static shadows are cached after load.",
    };
    flags.__inspectReady = true;
  };
  // Exercise the production preparation path, before ready-frame timing starts.
  if (actorCount) scene.syncPlayers(actors, "local-inspector", 0);
  void scene.prepare().then(() => { last = performance.now(); requestAnimationFrame(tick); });
}
