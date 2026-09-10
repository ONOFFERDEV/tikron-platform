import { SceneRig } from "./scene.js";
import { DeploymentIntro, introPose, type IntroPose } from './deployment-intro.js';
import { DeploymentIntroView } from './deployment-intro-view.js';
import { Hud } from './hud.js';
import { SettingsStore } from './settings.js';
import type { ArenaState } from '../src/schema.js';
import { signalFrame } from '../src/signal-event.js';
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import { BOT_ROLES } from '../src/bot-roles.js';
import { enemyHighlight } from './actor-appearance.js';

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
  const reviewEnemyYaw = vector('review-enemy-yaw', 1);
  const host = document.getElementById("app") ?? document.body;
  host.replaceChildren();
  const map = params.get("map") === "arena2" ? ARENA2 : params.get("map") === "arena3" ? ARENA3 : ARENA1;
  const effects = params.get("shot")?.endsWith("effects-stress") ?? false;
  const reaction = params.get("shot")?.startsWith("reaction-") ?? false;
  const muzzleLineup = params.get('shot') === 'muzzle-lineup';
  const roleLineup = params.get('shot')?.startsWith('roles-') ?? false;
  const contrastReview = params.get('shot')?.startsWith('contrast-') ?? false;
  const mixedWeapons = params.get('shot') === 'muzzle-effects-stress';
  const glintReview = params.get('shot')?.startsWith('glint-') ?? false;
  const blastReview = params.get('shot')?.startsWith('blast-') ?? false;
  const introReview = params.get('shot')?.includes('intro-') ?? false;
  const actorCount = params.get('shot') === 'contrast-empty-cover' ? 0 : params.get("shot")?.endsWith('stress') || introReview ? 11 : roleLineup || contrastReview ? 3 : muzzleLineup ? 5 : glintReview || reviewEnemy ? 1 : 0;
  const scene = new SceneRig(map, host, { loadActors: actorCount > 0 || reaction, loadViewmodel: effects || blastReview || introReview });
  if (!effects && !blastReview) scene.hideViewmodel();
  let introFixture: IntroPose | undefined;
  let introChecks: Record<string, boolean> | undefined;
  if (introReview) {
    const hud = new Hud(new SettingsStore()); hud.setDeploymentSite(map.presentation ?? 'Relay');
    const state: ArenaState = {players:{},seed:1,redScore:0,blueScore:0,phase:'warmup',matchEndMs:0,
      signalAt:0,coreOpen:false,warmupEndMs:10000,mode:map===ARENA2?2:map===ARENA3?1:0,capA:100,capB:0,capC:-100};
    hud.setMode(state.mode); hud.setMatchContext(state,3000,'self'); hud.updateDeployment(state,3000,'self',true);
    const view = new DeploymentIntroView(map,new DeploymentIntro(),scene.canvas); view.update(true);
    introFixture = introPose(map,params.get('shot')?.includes('end') ? .9 : .35,
      {eye:{x:0,y:0,z:0},target:{x:0,y:0,z:0},fov:68});
    const copy=document.querySelector<HTMLElement>('.intro-copy')!, banner=document.querySelector<HTMLElement>('#deployment-banner')!;
    const c=copy.getBoundingClientRect(), b=banner.getBoundingClientRect(), ping=document.querySelector<HTMLElement>('#ping')!.getBoundingClientRect();
    introChecks = {
      copyFits:c.left>=0&&c.right<=innerWidth&&c.bottom<=innerHeight&&copy.scrollWidth<=copy.clientWidth,
      bannerFits:b.left>=0&&b.right<=innerWidth&&b.top>=0&&banner.scrollWidth<=banner.clientWidth,
      separated:c.top>b.bottom,
      connectionClear:b.bottom<=ping.top||b.top>=ping.bottom||b.right<=ping.left||b.left>=ping.right,
      noAnimation:getComputedStyle(copy).animationName==='none',
      crosshairHidden:getComputedStyle(document.querySelector('#xhair')!).visibility==='hidden',
    };
    if(Object.values(introChecks).some(ok=>!ok))throw Error(`Introduction layout failed: ${JSON.stringify(introChecks)}`);
  }
  const shots: Record<string, readonly [number, number, number, number, number, number]> = {
    overview: [124, 91, 126, 75, 0, 45],
    'undertow-gallery-closed': [61,1.65,48,75,1.65,50],
    'undertow-gallery-open': [61,1.65,48,75,1.65,50],
    'undertow-gallery-inside': [73,1.65,50,89,1.65,50],
    'undertow-flood-before': [75,1.65,19,75,13,-7],
    'undertow-flood-warning': [75,1.65,19,75,13,-7],
    'undertow-flood-active': [75,1.65,19,75,13,-7],
    'undertow-flood-reduced': [75,1.65,19,75,13,-7],
    'undertow-flood-recovery': [75,1.65,19,75,13,-7],
    'signal-warning': [61,1.65,22,75,28,-15],
    'signal-blackout': [61,1.65,22,75,28,-15],
    'signal-recovery': [61,1.65,22,75,28,-15],
    'signal-stress': [61,1.65,22,75,28,-15],
    'core-closed': [63,1.65,48,75,1.65,50],
    'core-open': [63,1.65,48,75,1.65,50],
    'core-inside': [73,1.65,50,88,1.65,50],
    'core-stress': [63,1.65,48,75,1.65,50],
    'recon-stress': [8,1.65,11,75,24,45],
    'recon-flyover': [30,1.65,24,75,32,34],
    'mortar-stress': [8,1.65,11,24,2,11],
    'drone-hero': [5,1.65,8,9,2.8,12],
    'muzzle-lineup': [8,1.65,11,14,1.5,11],
    'roles-before': [8,1.65,11,14,1.5,11],
    'roles-after': [8,1.65,11,14,1.5,11],
    'muzzle-stress': [8,1.65,11,35,1.5,11],
    'glint-stress': [8,1.65,26,35,1.5,26],
    'drone-stress': [5,1.65,8,9,2.8,12],
    'mortar-warning': [8,1.65,11,16,.5,11],
    'mortar-impact': [8,1.65,11,16,2,11],
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
    'switchyard-overview': [128, 96, 135, 75, 0, 47],
    'switchyard-center': [58, 1.65, 66, 75, 2.5, 49],
    'switchyard-service': [57, 1.65, 87, 75, 2, 84],
    'switchyard-vista': [117, 22, 94, 75, 4, 29],
    'switchyard-north': [55, 1.65, 29, 95, 2, 29],
    'switchyard-stress': [46, 1.65, 29, 65, 1.5, 29],
    'switchyard-cargo-before': [143,1.65,53,156,11,40],
    'switchyard-cargo-cover': [120.5,1.65,50,127,1.4,49],
    'switchyard-cargo-crossing': [120.5,1.65,50,127,1.4,49],
    'switchyard-cargo-warning': [143,1.65,53,156,11,40],
    'switchyard-cargo-lift': [143,1.65,53,156,11,40],
    'switchyard-cargo-transfer': [143,1.65,53,156,11,40],
    'switchyard-cargo-reduced': [143,1.65,53,156,11,40],
    'switchyard-cargo-recovery': [143,1.65,53,156,11,40],
  };
  const shotName = (params.get("shot") ?? "overview").replace("effects-stress", "stress");
  const shot = reaction ? [13, 1.6, 23, 10, 1, 20] as const : glintReview && !effects
    ? [40, 1.65, 26, 78, 1.5, 26] as const : blastReview ? [8,1.65,11,24,1.65,11] as const : shots[shotName] ?? shots.overview!;
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
    x: (map === ARENA1 ? 20 : 56) + Math.floor(i / 3) * 4, y: 0, z: (map === ARENA2 ? 27 : map === ARENA3 ? 29 : 10) + (i % 3) * 0.6,
    yaw: -Math.PI / 2, pitch: 0, crouch: false, team: i % 2,
    alive: true, weapon: 0, reloadEnd: 0,
  }] satisfies [string, unknown]));
  if (reviewEnemy) {
    const actor = actors.get('inspect-0')!;
    Object.assign(actor, { x: reviewEnemy[0], y: reviewEnemy[1], z: reviewEnemy[2], team: 1,
      yaw: Math.atan2(scene.camera.position.x - reviewEnemy[0]!, scene.camera.position.z - reviewEnemy[2]!) });
    if (reviewEnemyYaw) actor.yaw = reviewEnemyYaw[0]!;
  }
  if (muzzleLineup || mixedWeapons) for (const [i, actor] of [...actors.values()].entries()) {
    Object.assign(actor, { weapon: i % 5 });
    if (muzzleLineup) Object.assign(actor, { x: 14, z: 8 + i * 1.5 });
  }
  if (roleLineup) for (const [i, role] of (['rusher','anchor','sniper'] as const).entries()) {
    const actor = actors.get(`inspect-${i}`)!;
    Object.assign(actor, { x: 14, z: 9 + i * 2, team: 1,
      weapon: shotName === 'roles-before' ? 0 : BOT_ROLES[role].weapon });
    actors.delete(`inspect-${i}`); actors.set(`bot-${i*2+1}`,actor);
  }
  if (contrastReview) {
    scene.camera.position.set(8, 1.65, 11); scene.camera.lookAt(14, 1.5, 11);
    scene.setActorAppearance(0, false, enemyHighlight(shotName.split('-')[1]));
    scene.reducedMotion = shotName.endsWith('-reduced');
    for (const [i, actor] of [...actors.values()].entries()) {
      Object.assign(actor, { x: 14, z: 9 + i * 2, team: i === 0 ? 0 : 1,
        weapon: i === 2 ? 3 : i });
    }
    if (shotName.endsWith('-cover')) {
      scene.camera.position.set(63, 1.65, 50); scene.camera.lookAt(75, 1.5, 50);
      for (const actor of actors.values()) Object.assign(actor, { x: 75, z: 50 });
    }
  }
  if (glintReview) {
    scene.reducedMotion = shotName === 'glint-reduced';
    for (const actor of actors.values()) {
      Object.assign(actor, { weapon: 3 });
      if (effects) actor.z += 15;
      if (!effects) Object.assign(actor, { x: 78, z: 26 });
      if (shotName === 'glint-near') actor.x = 52;
      if (shotName === 'glint-far') actor.x = 138;
      if (shotName === 'glint-cover') { actor.x = 75; actor.z = 50; scene.camera.position.set(63,1.65,50); scene.camera.lookAt(75,1.5,50); }
      actor.yaw = Math.atan2(scene.camera.position.x - actor.x, scene.camera.position.z - actor.z);
      if (shotName === 'glint-away') actor.yaw += Math.PI / 2;
      if (shotName === 'glint-before') actor.reloadEnd = Date.now() + 60000;
      if (shotName === 'glint-reload') actor.reloadEnd = Date.now() + 60000;
      if (shotName === 'glint-dead') actor.alive = false;
    }
  }
  let frameCount = 0, last = performance.now(), peakCalls = 0, peakTriangles = 0;
  const firstFrames: number[] = [];
  let drained: unknown;
  let reactionSampled = false;
  let started = 0, volleyAt = 0, blastAt = 0, volleys = 0, explosions = 0;
  const calls: number[] = [], triangles: number[] = [];
  let peakTextureMiB = 0, peakTextures = 0;
  let peakBlastDegrees = 0;
  const tick = (now: number) => {
    const ready = scene.readyForInspection(actorCount) && (!(effects || blastReview) || scene.inspectViewmodel(null, shotName === 'blast-ads'));
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
          scene.spawnMuzzleFlash(origin, dir, mixedWeapons ? i % 5 : 0); scene.spawnCasing(origin, dir);
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
    if(map === ARENA1 && (effects || shotName.startsWith('signal-') || shotName.startsWith('core-'))) {
      // Explicit OFFLINE fixture: normal schedule sampled through warning, waves,
      // rotation and recovery during effects stress; no game state is modified.
      const age=effects ? 6800 + now-started : shotName==='signal-warning' || shotName==='core-closed' ? 1000 : shotName==='signal-blackout' || shotName==='core-open' || shotName==='core-inside' ? 9300 : 23500;
      const frame=signalFrame(1000,'live',1000+age);
      scene.setCoreOpen(frame.phase==='blackout');scene.updateSignal(frame);
    }
    if(map===ARENA2 && (effects || shotName.startsWith('undertow-flood-') || shotName.startsWith('undertow-gallery-'))) {
      // Offline schedule fixture, including the first stream/foam submission.
      const age=effects?6800+now-started:shotName.endsWith('before')?-1:shotName.endsWith('warning')||shotName.endsWith('closed')?1000:shotName.endsWith('recovery')?24500:12000;
      scene.reducedMotion=shotName.endsWith('reduced');
      const frame=signalFrame(1000,'live',1000+age);
      scene.setCoreOpen(frame.phase==='blackout');scene.updateSignal(frame);
    }
    if(map===ARENA3 && (effects || shotName.startsWith('switchyard-cargo-'))) {
      const age=effects?6800+now-started:shotName.endsWith('before')?-1:shotName.endsWith('warning')||shotName.endsWith('cover')?1000:shotName.endsWith('lift')?11000:shotName.endsWith('recovery')?24000:15500;
      scene.reducedMotion=shotName.endsWith('reduced');
      const frame=signalFrame(1000,'live',1000+age);scene.setCoreOpen(frame.phase==='blackout');scene.updateSignal(frame);
    }
    if (effects || shotName === 'recon-flyover') {
      const age = effects ? now - started : 6000;
      scene.updateSupport([0, 1].map(team => ({ owner: `fixture-${team}`, team, startedAt: 1000, endsAt: 13000 })), 1000 + age);
    }
    if (effects || shotName.startsWith('mortar-')) {
      const age = effects ? now - started : shotName === 'mortar-warning' ? 2400 : 4450;
      scene.updateMortar([0,1].map(team => ({ owner:`fixture-${team}`,team,x:(effects ? 24+team*8 : 16),y:.12,z:11+(!effects ? team*15 : 0),
        startedAt:1000,endsAt:6900 })), 1000 + age);
    }
    if (effects || shotName.startsWith('drone-')) {
      const age=effects?now-started:1800;
      scene.updateDrone([0,1].map(team=>({owner:`fixture-${team}`,team,x:9+team*8,y:3.2,z:12,
        startedAt:1000,endsAt:13000,lock:{point:{x:18+team*8,y:1.1,z:13},fireAt:1000+Math.floor(age/1800)*1800+900}})),1000+age);
    }
    if (muzzleLineup && frameCount === 150) for (let i = 0; i < 5; i++) {
      const origin = scene.getRemoteMuzzleAnchor(`inspect-${i}`);
      if (origin) scene.spawnMuzzleFlash(origin, { x: -1, y: 0, z: 0 }, i);
    }
    let renderAt = now;
    if (blastReview && frameCount === 150) {
      scene.reducedMotion = shotName === 'blast-reduced';
      scene.setBlastFeedback(shotName !== 'blast-before');
      if (shotName !== 'blast-quiet') scene.boomNade({ id: 'offline-blast', x: 12.5, y: .2, z: 11, r: 5 }, now);
      renderAt += shotName === 'blast-settled' ? 2100 : 30;
    }
    scene.render(blastReview && frameCount === 150 ? renderAt : undefined, introFixture);
    peakBlastDegrees = Math.max(peakBlastDegrees, Math.abs(scene.inspectBlast().rollRadians) * 180 / Math.PI);
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
      structures: (map.structures ?? []).map(s => ({ id: s.id, footprint: s.footprint,
        parts: s.parts.length, ramps: s.ramps, bots: 'ground floor only' })),
      intro: introFixture ? {pose:introFixture,checks:introChecks,note:'Offline production renderer/HUD at fixed flight progress; 11 fixture actors, no room.'} : undefined,
      spawnReview: reviewCamera ? { camera: reviewCamera, enemy: reviewEnemy, enemyYaw: reviewEnemyYaw?.[0] } : null,
      reaction: reaction ? { kind: shotName.split("-")[1], ageMs: shotName.endsWith("death") ? 2500 : 120, ...scene.inspectionReactionInfo() } : null,
      actorAppearance: contrastReview || roleLineup ? scene.inspectActorAppearance() : undefined,
      operatorKits: actorCount ? scene.inspectOperatorKits() : undefined,
      uplinks: scene.inspectRelayUplinks(),
      fieldworks: scene.inspectRelayFieldworks(),
      signal: scene.inspectSignal(),
      support: scene.inspectSupport(),
      mortar: scene.inspectMortar(),
      drone: scene.inspectDrone(),
      glints: scene.inspectGlints(),
      blast: { ...scene.inspectBlast(), peakDegrees: peakBlastDegrees, fixture: blastReview ? 'Offline confirmed-impact presentation, same event at 30ms; settled at 2100ms. Before disables only camera response.' : null },
      concreteDetail: scene.inspectConcreteDetail(),
      siteGround: scene.inspectSiteGround(),
      preparation: scene.getPreparationInfo(),
      lighting: scene.inspectLighting(),
      ...scene.getRenderInfo(), gpu, viewport: [innerWidth, innerHeight],
      actorCount: reaction ? 1 : actorCount, localViewmodel: effects || blastReview, effects: effects ? { volleys, explosions, durationMs: 15000, drainMs: now - started - 15000, drained,
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
