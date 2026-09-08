/** Compare matched natural-round seeds; does not run or modify gameplay.
 * node scripts/compare-contact.mjs session37 session37-baseline session37-candidate 224001 224002 224003
 */
import { readFile, writeFile } from 'node:fs/promises';

const [output, beforePrefix, afterPrefix, ...seeds] = process.argv.slice(2);
if (![output, beforePrefix, afterPrefix].every(p => p && /^[\w-]+$/.test(p)) ||
    !seeds.length || seeds.some(s => !/^\d+$/.test(s) || +s < 1 || +s > 0xffffffff) ||
    new Set(seeds.map(Number)).size !== seeds.length) throw Error('Supply safe prefixes and distinct u32 seeds');
const load = async (prefix, seed) => {
  const round = JSON.parse(await readFile(`.inspect/${prefix}-${seed}-bot-round.json`, 'utf8'));
  if (round.seed !== +seed || round.standings.length !== 12 || round.durationMs !== 300000)
    throw Error(`Unexpected seed/roster/duration: ${prefix}/${seed}`);
  return round;
};
const pairs = await Promise.all(seeds.map(async seed => {
  const [before, after] = await Promise.all([load(beforePrefix, seed), load(afterPrefix, seed)]);
  if (JSON.stringify(before.bounds) !== JSON.stringify(after.bounds)) throw Error('Map footprints differ');
  return { seed: +seed, before, after };
}));
const distribution = (lives, key) => {
  const samples = lives.flatMap(l => Number.isFinite(l[key]) ? [l[key] / 1000] : []).sort((a, b) => a - b);
  const quantile = p => samples.length ? samples[Math.floor((samples.length - 1) * p)] : null;
  return { observed: samples.length, unobserved: lives.length - samples.length,
    p10Seconds: quantile(.1), medianSeconds: quantile(.5), p90Seconds: quantile(.9),
    under5Count: samples.filter(s => s < 5).length,
    under5PercentOfObserved: samples.length ? 100 * samples.filter(s => s < 5).length / samples.length : null,
    target20To30Count: samples.filter(s => s >= 20 && s <= 30).length };
};
const summarize = rounds => {
  const lives = rounds.flatMap(r => r.lives).filter(l => !l.initial);
  const southernLives = lives.filter(l => l.z >= 67).length;
  return { kills: rounds.reduce((sum, r) => sum + r.kills.length, 0), respawnLives: lives.length,
    southernLives, southernPercent: lives.length ? 100 * southernLives / lives.length : null,
    damage: distribution(lives, 'damageMs'), los: distribution(lives, 'losMs'),
    death: distribution(lives, 'deathMs') };
};
const report = {
  note: 'Paired seeds and unchanged 300s twelve-bot FFA rules; layout and two spawn anchors differ. Trajectories diverge after the change, so individual lives are not paired. 100ms samples; absent contacts/deaths are censored, never zero. Three seeds do not establish human fairness, side win rates or deployed performance.',
  beforePrefix, afterPrefix,
  pairs: pairs.map(p => ({ seed: p.seed, before: summarize([p.before]), after: summarize([p.after]) })),
  before: summarize(pairs.map(p => p.before)), after: summarize(pairs.map(p => p.after)),
};
await writeFile(`.inspect/${output}-contact-comparison.json`, JSON.stringify(report, null, 2));

// Keep each round's own collider drawing and common 5m cell/opacity convention.
const panels = await Promise.all(pairs.flatMap((pair, i) => [beforePrefix, afterPrefix].map(async (prefix, column) => {
  const svg = await readFile(`.inspect/${prefix}-${pair.seed}-bot-heatmap.svg`, 'utf8');
  if (!svg.startsWith('<svg ') || !svg.endsWith('</svg>')) throw Error('Unexpected heatmap format');
  const body = svg.slice(svg.indexOf('>') + 1, -6);
  const x = 20 + column * 570, y = 110 + i * 430;
  return `<text x="${x}" y="${y - 10}" fill="#edaa52" font-size="17">${column ? 'AFTER' : 'BEFORE'} / SEED ${pair.seed}</text><svg x="${x}" y="${y}" width="550" height="405" viewBox="-2 -12 154 116">${body}</svg>`;
})));
const height = 135 + pairs.length * 430;
await writeFile(`.inspect/${output}-paired-heatmaps.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="${height}" viewBox="0 0 1160 ${height}"><rect width="1160" height="${height}" fill="#10242b"/><g font-family="Arial,sans-serif"><text x="20" y="32" fill="#e8efea" font-size="24">SWITCHYARD / MATCHED NATURAL BOT ROUNDS</text><text x="20" y="59" fill="#bdd0ce" font-size="16">First-damage median: ${report.before.damage.medianSeconds}s → ${report.after.damage.medianSeconds}s; reference 20–30s remains unmet.</text><text x="20" y="81" fill="#bdd0ce" font-size="14">Observed respawns only. Orange cells = deaths / 5m. Bot evidence does not establish human fairness.</text>${panels.join('')}</g></svg>`);
console.log(JSON.stringify(report, null, 2));
