import { SceneRig } from "./scene.js";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";

/** Deterministic production-renderer review. No matchmaking, no gameplay sockets. */
export function startMapInspector(): void {
  const params = new URLSearchParams(location.search);
  // Offline spawn-policy review: supply eye/look-at and one fixed threat.
  // These parameters are read only by the inspector, never live gameplay.
  const vector = (key: string, length: number): number[] | null => {
    const raw = params.get(key);
    if (!raw) return null;
    const values = raw.split(',').map(Number);
    if (values.length !== length || values.some(v => !Number.isFinite(v) || Math.abs(v) > 1000))
      throw Error(`Invalid inspection ${key}`);
    return values;
  };
  const reviewCamera = vector('review-camera', 6), reviewEnemy = vector('review-enemy', 3);
  const host = document.getElementById("app") ?? document.body;
  host.replaceChildren();
  const map = params.get("map") === "arena2" ? ARENA2 : params.get("map") === "arena3" ? ARENA3 : ARENA1;
  const effects = params.get("shot")?.endsWith("effects-stress") ?? false;
  const reaction = params.get("shot")?.startsWith("reaction-") ?? false;
  const actorCount = params.get("shot")?.endsWith('stress') ? 11 : reviewEnemy ? 1 : 0;
  const scene = new SceneRig(map, host, { loadActors: actorCount > 0 || reaction, loadViewmodel: effects });
  if (!effects) scene.hideViewmodel();
  const shots: Record<string, readonly [number, number, number, number, number, number]> = {
    overview: [124, 91, 126, 75, 0, 45],
    cooling: [52, 1.65, 25, 94, 2.3, 25],
    uplink: [78, 2.85, 4, 81, 5, -6],
    exterior: [110, 9, 3, 75, 0, -10],
    relay: [58, 1.65, 56, 75, 3, 47],
    impact: [18, 1.65, 23, 22, 1.5, 23],
    freight: [54, 1.65, 77, 77, 1.4, 72],
    spawn: [3, 1.65, 39, 20, 1.8, 28],
    vista: [105, 20, 91, 75, 4.2, 37],
    stress: [8, 1.65, 11, 35, 1.5, 11],
    'undertow-overview': [130, 96, 138, 75, 0, 48],
    'undertow-home': [27, 1.65, 16, 55, 2, 15],
    'undertow-center': [75, 1.65, 95, 82, 2, 85],
    'undertow-deck': [45, 4.65, 42, 75, 3, 50],
    'undertow-vista': [120, 22, 95, 75, 4, 25],
    'undertow-maintenance': [52, 1.65, 85, 75, 2.5, 88],
    'undertow-stress': [46, 1.65, 27, 65, 1.5, 27],
    'switchyard-overview': [52, 38, 57, 29, 0, 19],
    'switchyard-center': [25, 1.65, 25, 31, 2.2, 17],
    'switchyard-service': [39, 1.65, 13, 47, 2, 7],
    'switchyard-vista': [48, 13, 37, 26, 4, 8],
    'switchyard-north': [20, 1.65, 3, 31, 3.5, -5],
    'switchyard-stress': [8, 1.65, 11, 35, 1.5, 11],
  };
  const shotName = (params.get("shot") ?? "overview").replace("effects-stress", "stress");
  const shot = reaction ? [13, 1.6, 23, 10, 1, 20] as const : shots[shotName] ?? shots.overview!;
  scene.camera.position.set(shot[0], shot[1], shot[2]);
  scene.camera.lookAt(shot[3], shot[4], shot[5]);
  if (reviewCamera) {
    scene.camera.position.set(reviewCamera[0]!, reviewCamera[1]!, reviewCamera[2]!);
    scene.camera.lookAt(reviewCamera[3]!, reviewCamera[4]!, reviewCamera[5]!);
  }
  const flags = window as unknown as { __inspectReady: boolean; __mapInspect: unknown };
  flags.__inspectReady = false;
  const gl = scene.canvas.getContext("webgl2");
  const debug = gl?.getExtension("WEBGL_debug_renderer_info");
  const gpu = gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : "unavailable";
  const samples: number[] = [];
  const actors = new Map(Array.from({ length: actorCount }, (_, i) => [`inspect-${i}`, {
    x: (map === ARENA2 ? 56 : 20) + Math.floor(i / 3) * 4, y: 0, z: (map === ARENA2 ? 27 : 10) + (i % 3) * 0.6,
    yaw: -Math.PI / 2, pitch: 0, crouch: false, team: i % 2,
    alive: true, weapon: 0,
  }] as const));
  if (reviewEnemy) {
    const actor = actors.get('inspect-0')!;
    Object.assign(actor, { x: reviewEnemy[0], y: reviewEnemy[1], z: reviewEnemy[2], team: 1,
      yaw: Math.atan2(scene.camera.position.x - reviewEnemy[0]!, scene.camera.position.z - reviewEnemy[2]!) });
  }
  let frameCount = 0, last = performance.now(), peakCalls = 0, peakTriangles = 0;
  const firstFrames: number[] = [];
  let drained: unknown;
  let reactionSampled = false;
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
    // Paired server-event presentation sample: surface on the left, player on
    // the right. Stop rendering shortly after the burst to retain it for capture.
    if (shotName === "impact" && frameCount === 140) {
      scene.spawnImpact({ x: 22, y: 1.5, z: 22.5 }, { x: 1, y: 0, z: 0 }, false);
      scene.spawnImpact({ x: 22, y: 1.5, z: 23.5 }, { x: 1, y: 0, z: 0 }, true);
    }
    if (reaction && !reactionSampled) {
      reactionSampled = scene.inspectReaction(shotName.split("-")[1]!, shotName.endsWith("death") ? 2500 : 120);
      if (!reactionSampled) { requestAnimationFrame(tick); return; }
    }
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
      mapBounds: map.bounds,
      spawnReview: reviewCamera ? { camera: reviewCamera, enemy: reviewEnemy } : null,
      reaction: reaction ? { kind: shotName.split("-")[1], ageMs: shotName.endsWith("death") ? 2500 : 120, ...scene.inspectionReactionInfo() } : null,
      uplinks: scene.inspectRelayUplinks(),
      concreteDetail: scene.inspectConcreteDetail(),
      siteGround: scene.inspectSiteGround(),
      preparation: scene.getPreparationInfo(),
      ...scene.getRenderInfo(), gpu, viewport: [innerWidth, innerHeight],
      actorCount: reaction ? 1 : actorCount, localViewmodel: effects, effects: effects ? { volleys, explosions, durationMs: 15000, drainMs: now - started - 15000, drained,
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
