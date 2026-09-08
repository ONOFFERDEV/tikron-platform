/** node scripts/summarize-contact.mjs <output-prefix> <round-prefix> ... */
import { readFile, writeFile } from 'node:fs/promises';

const [output, ...prefixes] = process.argv.slice(2);
if (!output || !prefixes.length || [output, ...prefixes].some(p => !/^[\w-]+$/.test(p))) throw Error('Supply output prefix and round prefixes');
const rounds = await Promise.all(prefixes.map(async prefix => JSON.parse(await readFile(`.inspect/${prefix}-bot-round.json`, 'utf8'))));
if (new Set(rounds.map(r => r.seed)).size !== rounds.length) throw Error('Repeated seeds are not independent round evidence');
function distribution(lives, key) {
  const values = lives.flatMap(l => Number.isFinite(l[key]) ? [l[key] / 1000] : []).sort((a, b) => a - b);
  const percentile = p => values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] : null;
  return { lives: lives.length, observed: values.length, unobserved: lives.length - values.length,
    p10Seconds: percentile(.1), medianSeconds: percentile(.5), p90Seconds: percentile(.9),
    under5Seconds: values.filter(v => v < 5).length, target20To30Seconds: values.filter(v => v >= 20 && v <= 30).length };
}
const lives = rounds.flatMap(r => r.lives);
const respawns = lives.filter(l => !l.initial);
const summary = {
  note: 'Natural twelve-bot Switchyard FFA, distinct fixed seeds, production room in fake-time test harness. LOS is a 100m eye segment without FOV, sampled each 100ms. Quantiles describe observed contacts only; unobserved contacts are censored, never counted as zero. Life starts are sampled positions, not exact spawn anchors. FFA has no side win rate. Not human balance, network performance or a controlled before/after change.',
  rounds: rounds.map(r => ({ seed: r.seed, durationSeconds: r.durationMs / 1000, kills: r.kills.length,
    initialDamage: distribution(r.lives.filter(l => l.initial), 'damageMs'),
    respawnDamage: distribution(r.lives.filter(l => !l.initial), 'damageMs'),
    respawnLOS: distribution(r.lives.filter(l => !l.initial), 'losMs') })),
  pooled: { initialDamage: distribution(lives.filter(l => l.initial), 'damageMs'),
    respawnDamage: distribution(respawns, 'damageMs'), respawnLOS: distribution(respawns, 'losMs'),
    lifeDuration: distribution(respawns, 'deathMs') },
  // Coarse readable sectors; do not pretend a sampled moving position is an exact spawn id.
  sectors: ['north', 'middle', 'south'].flatMap(lane => ['west', 'east'].map(half => {
    const selected = respawns.filter(l => (l.x < 75 ? 'west' : 'east') === half && (l.z < 33 ? 'north' : l.z < 67 ? 'middle' : 'south') === lane);
    return { lane, half, damage: distribution(selected, 'damageMs'), los: distribution(selected, 'losMs') };
  })),
};
await writeFile(`.inspect/${output}-contact-summary.json`, JSON.stringify(summary, null, 2));
const rows = summary.rounds.map(r => [`Seed ${r.seed}`, r.respawnDamage]);
const bars = rows.map(([label, d], i) => {
  const y = 105 + i * 64;
  return `<text x="24" y="${y}" fill="#e8efea" font-size="16">${label}</text><rect x="195" y="${y - 20}" width="${d.medianSeconds * 16}" height="28" fill="#edaa52"/><text x="${205 + d.medianSeconds * 16}" y="${y}" fill="#e8efea" font-size="15">${d.medianSeconds.toFixed(1)}s (${d.observed}/${d.lives} observed)</text>`;
}).join('');
await writeFile(`.inspect/${output}-contact-summary.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="390" viewBox="0 0 900 390"><rect width="900" height="390" fill="#10242b"/><g font-family="Arial,sans-serif"><text x="24" y="35" fill="#e8efea" font-size="22">SWITCHYARD / RESPAWN TO FIRST DAMAGE</text><text x="24" y="60" fill="#bdd0ce" font-size="14">${rounds.length} natural bot rounds / observed-contact medians</text><rect x="515" y="75" width="160" height="200" fill="#64c7cc" opacity=".18"/>${bars}<text x="515" y="295" fill="#64c7cc" font-size="14">Reference target: 20–30s</text><text x="24" y="335" fill="#bdd0ce" font-size="14">100ms sampling; unobserved contacts remain censored. FFA has no spawn-side win rate.</text><text x="24" y="360" fill="#bdd0ce" font-size="14">Test-harness bot evidence does not establish human pacing or fairness.</text></g></svg>`);
console.log(JSON.stringify(summary, null, 2));
