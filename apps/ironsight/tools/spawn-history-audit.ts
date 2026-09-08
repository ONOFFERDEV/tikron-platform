/** Server CPU fixture, not deployed room capacity or encounter pacing.
 * pnpm exec esbuild tools/spawn-history-audit.ts --bundle --platform=node --format=esm --outfile=.inspect/spawn-history-audit.mjs
 * node .inspect/spawn-history-audit.mjs > .inspect/session32-spawn-history-audit.json
 */
import { performance } from 'node:perf_hooks';
import { ARENA1 } from '../src/map/arena1.js';
import { ARENA2 } from '../src/map/arena2.js';
import { ARENA3 } from '../src/map/arena3.js';
import { SpawnSightHistory, chooseSafeSpawn } from '../src/map/spawn.js';

const results = [ARENA1, ARENA2, ARENA3].map(map => {
  const points = [...map.spawns.red, ...map.spawns.blue];
  const players = Array.from({ length: 12 }, (_, i) => ({
    ...points[i % points.length]!, id: `audit-${i}`, team: i % 2, alive: true,
  }));
  const history = new SpawnSightHistory();
  const sampleMs: number[] = [], selectionMs: number[] = [];
  let changedChoices = 0;
  for (let i = 0; i < 720; i++) {
    // Authored legal spawn anchors cycle the threats; no fabricated cover.
    for (let j = 0; j < players.length; j++) Object.assign(players[j]!, points[(i + j) % points.length]!);
    const now = i * 500;
    let start = performance.now();
    history.observe(points, players, map.boxes, now);
    const sample = performance.now() - start;
    start = performance.now();
    const choice = chooseSafeSpawn(points, i, players, 'arriving', 0, map.boxes, false, history, now);
    const selection = performance.now() - start;
    if (i >= 120) { sampleMs.push(sample); selectionMs.push(selection); }
    if (choice !== chooseSafeSpawn(points, i, players, 'arriving', 0, map.boxes, false)) changedChoices++;
  }
  const stats = (values: number[]) => {
    values.sort((a, b) => a - b);
    return { samples: values.length, medianMs: values[Math.floor(values.length / 2)],
      p95Ms: values[Math.floor(values.length * .95)], maxMs: values.at(-1) };
  };
  return { map: map.presentation, points: points.length, players: players.length,
    observation: stats(sampleMs), selection: stats(selectionMs), changedChoices };
});
console.log(JSON.stringify({ note: 'Local Node CPU, 120 warmup/600 measured observations per map. 2 Hz history and one FFA spawn choice; not workerd capacity. All threats cycle legal anchors; no human fairness claim.', results }, null, 2));
