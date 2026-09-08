/** Static reference measurements, not real encounter/6v6 telemetry.
 * pnpm exec esbuild tools/reference-audit.ts --bundle --platform=node --format=esm --outfile=.inspect/reference-audit.mjs
 * node .inspect/reference-audit.mjs > .inspect/session24-reference-audit.json
 */
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import { walkSeconds } from '../src/map/nav.js';
import { MATCH, MODES, MOVE, WEAPONS } from '../src/config.js';
import { GAME } from '../src/game-config.js';

const maps = [ARENA1, ARENA2, ARENA3].map(map => {
  const caps = Object.entries(map.caps);
  const point = (key: string, fallback: typeof map.caps.a) => map.capWaypoints?.[key as 'a']?.[0] ?? fallback;
  return {
    map: map.presentation, bounds: map.bounds,
    colliders: map.boxes.map((b, index) => {
      const height = +(b.max.y - b.min.y).toFixed(3);
      return { index, height, class: height < 0.5 ? 'decoration' : height >= 1 && height <= 1.25 ? 'waist' :
        height >= 1.75 ? 'full' : height >= 1.5 && height <= 1.6 ? 'head-height' : 'other', min: b.min, max: b.max };
    }),
    rotations: caps.flatMap(([a, from], i) => caps.slice(i + 1).map(([b, to]) => ({
      from: a, to: b, walkSeconds: walkSeconds(map, point(a, from), point(b, to), MOVE.walk),
      sprintSeconds: walkSeconds(map, point(a, from), point(b, to), MOVE.sprint),
    }))),
    spawnToObjective: Object.entries(map.spawns).flatMap(([team, spawns]) => spawns.flatMap((from, index) =>
      caps.map(([cap, to]) => ({ team, index, cap, walkSeconds: walkSeconds(map, from, point(cap, to)),
        sprintSeconds: walkSeconds(map, from, point(cap, to), MOVE.sprint) })))),
  };
});
console.log(JSON.stringify({ note: '1m four-neighbour ground BFS; cap waypoint overrides used where platforms block ground cells. Spawn-to-objective is a travel proxy, NOT measured first contact. Null means unreachable.',
  maps, weapons: WEAPONS.map(w => ({ name: w.name, adsMs: w.adsMs, sprintToFireMs: w.sprintToFireMs,
    visualAdsCompleteMs: w.adsMs,
    closeBodyHits: Math.ceil(100 / w.damageBody), closeBodyTtkMs: (Math.ceil(100 / w.damageBody) - 1) * w.fireIntervalMs,
    note: 'Server arrival-time ADS/sprint gate; hip fire does not require ADS. Body TTK assumes one pellet; not a shotgun volley.' })),
  match: MATCH, modes: MODES, dom: { neutralCaptureSeconds: 100 / MODES.dom.capturePerSec,
    enemyCaptureSeconds: 200 / MODES.dom.capturePerSec, pointsPerFlagPerSecond: MODES.dom.pointsPer2s / 2, sideSwap: false },
  audio: { enemyAllyFootstepRatio: 1.4, hit: GAME.audio.hit, kill: GAME.audio.kill, footstep: GAME.audio.footstep,
    note: 'Session27: hostileFoley gain 1.4; box occlusion .32 / 1100 Hz; remote reload phase cues; headphone mix unverified.' },
  damageCues: ['60ms victim flash (omitted with reduced motion)', '900ms directional edge and labelled sector'], killfeed: 'top-right, five rows, weapon and HEADSHOT text, team colours, no objective events',
}, null, 2));
