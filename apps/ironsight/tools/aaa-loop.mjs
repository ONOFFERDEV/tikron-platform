// Supervisor loop: run astra (codex) sessions against AAA-PLAN.md, gate, commit, deploy, repeat.
//
//   node tools/aaa-loop.mjs [--max 50 | --until 2026-09-09T10:00:00+09:00] [--dry-gates] [--no-deploy]
//
// State under apps/ironsight/.inspect/aaa-loop/: status.md (what astra reads), log.jsonl,
// run.log, STOP (create it to stop after the current session). Requires: omc, codex login,
// wrangler login, Blender, Edge, ~/.claude/secrets/meshy.json.
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const app = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const repo = resolve(app, '../..');
const state = join(app, '.inspect/aaa-loop');
await mkdir(state, { recursive: true });
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MAX = Number(opt('--max', 50));
// --until <ISO datetime>: keep starting sessions while now < until (MAX becomes a safety cap of 500).
const UNTIL = opt('--until') ? Date.parse(opt('--until')) : Infinity;
if (opt('--until') && Number.isNaN(UNTIL)) throw new Error('--until must be an ISO datetime, e.g. 2026-09-09T10:00:00+09:00');
const CAP = UNTIL === Infinity ? MAX : 500;
const DRY = args.includes('--dry-gates');
const DEPLOY = !args.includes('--no-deploy');
const PREVIEW = 'http://localhost:8796';
const log = async (line) => { const s = `[${new Date().toISOString()}] ${line}`; console.log(s); await appendFile(join(state, 'run.log'), s + '\n'); };
const jsonl = async (obj) => appendFile(join(state, 'log.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...obj }) + '\n');

function run(cmd, { cwd = app, timeoutMs = 20 * 60 * 1000, tail = 4000 } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, { cwd, shell: true, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
    let out = '';
    const push = (b) => { out += b.toString(); if (out.length > 200000) out = out.slice(-100000); };
    child.stdout.on('data', push); child.stderr.on('data', push);
    const timer = setTimeout(() => { killTree(child.pid); out += `\n[aaa-loop] TIMEOUT after ${timeoutMs} ms`; }, timeoutMs);
    child.on('close', (code) => { clearTimeout(timer); resolveRun({ code: code ?? 1, out: out.slice(-tail), full: out }); });
  });
}
const killTree = (pid) => { try { spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {} };
const sh = async (cmd, opts) => { const r = await run(cmd, opts); return r; };

async function nextSession() {
  const plan = await readFile(join(app, 'AAA-PLAN.md'), 'utf8');
  const nums = [...plan.matchAll(/^### Session (\d+)/gm)].map(m => Number(m[1]));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}
async function meshyBalance() {
  const r = await sh('node tools/meshy-generate.mjs --balance', { timeoutMs: 60000 });
  try { return JSON.parse(r.out.trim().split('\n').pop()).balance; } catch { return 'unknown'; }
}
async function gates(tag) {
  const results = [];
  const step = async (name, cmd, opts) => {
    const r = await sh(cmd, opts);
    results.push({ name, code: r.code, tail: r.out.slice(-1500) });
    await log(`gate ${name}: ${r.code === 0 ? 'PASS' : 'FAIL'}`);
    return r.code === 0;
  };
  let ok = true;
  ok = await step('typecheck', 'pnpm typecheck') && ok;
  ok = await step('test', 'pnpm test') && ok;
  ok = await step('build', 'pnpm build:client') && ok;
  ok = await step('audit', 'pnpm audit:assets') && ok;
  if (!ok) return { ok, results };
  // Fresh Durable Object state every gate: a persisted arena room that already finished a
  // match can come back stuck in warmup with no bot fill, which would make the probe fail
  // for reasons unrelated to the session's change (seen 2026-09-08).
  await rm(join(app, '.wrangler/state'), { recursive: true, force: true }).catch(async (e) => { await log('could not clear .wrangler/state: ' + e.message); });
  const server = spawn('npx wrangler dev --config wrangler.next.jsonc --port 8796', { cwd: app, shell: true, windowsHide: true, stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(PREVIEW)).status === 200; } catch {} if (!up) await new Promise(r => setTimeout(r, 2000)); }
    if (!up) { results.push({ name: 'server', code: 1, tail: 'wrangler dev did not answer on 8796' }); return { ok: false, results }; }
    ok = await step('inspect', `node scripts/inspect-map.mjs --url ${PREVIEW} --shots relay,practice-two --prefix ${tag}`, { timeoutMs: 10 * 60 * 1000 }) && ok;
    if (ok) {
      try {
        const report = JSON.parse(await readFile(join(app, `.inspect/${tag}-report.json`), 'utf8'));
        const errs = (report.errors ?? []).length + (report.forbiddenNetwork ?? []).length;
        results.push({ name: 'inspect-errors', code: errs ? 1 : 0, tail: `errors=${(report.errors ?? []).length} forbidden=${(report.forbiddenNetwork ?? []).length}` });
        ok = errs === 0 && ok;
      } catch (e) { results.push({ name: 'inspect-errors', code: 1, tail: String(e) }); ok = false; }
    }
    ok = await step('hitch', `node scripts/hitch-probe.mjs ${PREVIEW} 150000 .inspect/${tag}-hitch.json --assert`, { timeoutMs: 6 * 60 * 1000 }) && ok;
  } finally { killTree(server.pid); await new Promise(r => setTimeout(r, 1500)); }
  return { ok, results };
}
async function writeStatus({ session, last, balance, remaining, failures }) {
  const md = [`# aaa-loop status (written by the supervisor, ${new Date().toISOString()})`, '',
    `- This is **Session ${session}**. Run continues: ${remaining}.`,
    `- Meshy balance: **${balance} credits** (stop generating below 300; <= 60 per session).`,
    `- Preview worker: https://ironsight-next.plain-wave-5d5b.workers.dev (deployed after every green session).`,
    '', '## Last session outcome', '', ...(last ? last : ['First session of this run. Start from the current AAA gap list in AAA-PLAN.md (create it if missing).']),
    '', '## Supervisor / owner notes (relayed; act on them this session if they outrank your top gap item)', '',
    await readFile(join(state, 'notes.md'), 'utf8').catch(() => '(none)'),
    '', failures ? `## Consecutive gate failures: ${failures}\nIf 2 in a row, the supervisor resets the working tree to HEAD before the next session; fix the gate first this session.` : ''].join('\n');
  await writeFile(join(state, 'status.md'), md);
}
async function commitAndDeploy(session) {
  const plan = await readFile(join(app, 'AAA-PLAN.md'), 'utf8');
  const heading = plan.match(new RegExp(`^### Session ${session}[^\\n]*`, 'm'))?.[0] ?? `Session ${session}`;
  const title = heading.replace(/^### /, '').replace(/\s+/g, ' ').slice(0, 110);
  await sh('git add -A apps/ironsight', { cwd: repo, timeoutMs: 120000 });
  const status = await sh('git status --porcelain apps/ironsight', { cwd: repo, timeoutMs: 60000 });
  if (!status.full.trim()) { await log('nothing to commit'); return { committed: false }; }
  const msg = `ironsight: astra ${title}\n\nAutomated aaa-loop session; gates re-run by the supervisor (typecheck, tests, build, asset audit, headless inspect, hitch probe).\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`;
  await writeFile(join(state, 'commit-msg.txt'), msg);
  const c = await sh(`git -c core.safecrlf=false commit -q -F "${join(state, 'commit-msg.txt')}"`, { cwd: repo, timeoutMs: 120000 });
  if (c.code !== 0) { await log('commit failed: ' + c.out); return { committed: false, error: c.out }; }
  const hash = (await sh('git rev-parse --short HEAD', { cwd: repo, timeoutMs: 60000 })).out.trim();
  let deployed = 'skipped';
  if (DEPLOY) {
    const d = await sh('npx wrangler deploy --config wrangler.next.jsonc', { timeoutMs: 10 * 60 * 1000 });
    deployed = d.code === 0 ? (d.out.match(/Current Version ID: (\S+)/)?.[1] ?? 'ok') : 'FAILED ' + d.out.slice(-400);
    const p = await sh('git push origin ironsight-aaa', { cwd: repo, timeoutMs: 5 * 60 * 1000 });
    await log(`push: ${p.code === 0 ? 'ok' : 'FAILED ' + p.out.slice(-300)}`);
  }
  return { committed: true, hash, deployed, title };
}

let failures = 0; let last = null;
// --gate-first: a previous loop died mid-session and left uncommitted astra work in the tree.
// Gate and commit it as that session before starting a new one (or reset it if red).
if (args.includes('--gate-first') && !DRY) {
  const dirty = (await sh('git status --porcelain apps/ironsight', { cwd: repo, timeoutMs: 60000 })).full.trim();
  if (dirty) {
    const session = (await nextSession()) - 1; // the heading astra already wrote, if any
    await log(`gate-first: uncommitted work found, gating it as session ${session}`);
    const g = await gates(`loop${session}-recovered`);
    const summary = g.results.map(r => `${r.name}:${r.code === 0 ? 'PASS' : 'FAIL'}`).join(' ');
    if (g.ok) { const c = await commitAndDeploy(session); await log(`gate-first GREEN — ${summary}; ${c.committed ? 'committed ' + c.hash : 'nothing to commit'}`); last = [`Session ${session} was recovered by the supervisor after a loop restart: gates ${summary}, ${c.committed ? `committed as ${c.hash}` : 'nothing to commit'}.`]; }
    else { await sh('git checkout -- apps/ironsight && git clean -fd apps/ironsight', { cwd: repo, timeoutMs: 120000 }); await log(`gate-first RED — ${summary}; working tree reset`); last = [`Session ${session} was interrupted by a loop restart and its uncommitted work FAILED the gates (${summary}); the tree was reset to the last green commit. Re-plan it as a fresh session.`]; }
    await jsonl({ session, ok: g.ok, recovered: true, gates: summary });
  }
}
for (let i = 0; i < CAP; i++) {
  if (existsSync(join(state, 'STOP'))) { await log('STOP file present; exiting'); break; }
  if (Date.now() >= UNTIL) { await log(`deadline ${opt('--until')} reached; exiting`); break; }
  const session = await nextSession();
  const balance = await meshyBalance();
  const remaining = UNTIL === Infinity ? String(MAX - i - 1) : `until ${opt('--until')} (${Math.max(0, Math.round((UNTIL - Date.now()) / 60000))} min left)`;
  await writeStatus({ session, last, balance, remaining, failures });
  await log(`=== session ${session} (${i + 1}${UNTIL === Infinity ? '/' + MAX : ', ' + remaining}) balance=${balance} ===`);
  let ask = { code: 0, out: 'dry' };
  if (!DRY) {
    const prompt = `Continue the ironsight AAA rebuild as Session ${session}. First read apps/ironsight/tools/aaa-loop-brief.md (standing brief, all rules), then apps/ironsight/.inspect/aaa-loop/status.md (supervisor status for this session), then apps/ironsight/AAA-PLAN.md. Repo D:\\webgame-baas, branch ironsight-aaa, scope apps/ironsight/** only, no git commit/push/deploy. End green per the brief and log the session in AAA-PLAN.md.`;
    ask = await run(`omc ask codex --prompt "${prompt}"`, { cwd: repo, timeoutMs: 110 * 60 * 1000, tail: 3000 });
    await log(`astra finished code=${ask.code}`);
    // A provider that fails before doing any work (usage limit, auth, network) must stop the
    // loop, not spin every two minutes on an unchanged tree until the deadline (seen 2026-09-09:
    // 140 no-op iterations after "You've hit your usage limit").
    const quotaHit = /usage limit|invalid_refresh_token|rate limit|401|429|Provider command failed/i.test(ask.full ?? ask.out);
    if (ask.code !== 0 || quotaHit) {
      const changed = (await sh('git status --porcelain apps/ironsight', { cwd: repo, timeoutMs: 60000 })).full.trim();
      if (!changed) { await log(`astra produced no changes and reported failure (${quotaHit ? 'quota/auth' : 'exit ' + ask.code}); stopping loop. Tail: ${ask.out.slice(-300).replace(/\s+/g, ' ')}`); await jsonl({ session, ok: false, failed: ['astra'], askCode: ask.code, quotaHit }); break; }
    }
  }
  const tag = `loop${session}`;
  const g = await gates(tag);
  const summary = g.results.map(r => `${r.name}:${r.code === 0 ? 'PASS' : 'FAIL'}`).join(' ');
  await log(`gates ${g.ok ? 'GREEN' : 'RED'} — ${summary}`);
  let outcome;
  if (g.ok) {
    failures = 0;
    const c = DRY ? { committed: false } : await commitAndDeploy(session);
    outcome = { session, ok: true, ...c, gates: summary };
    last = [`Session ${session} passed all gates and was ${c.committed ? `committed as ${c.hash} and deployed (${c.deployed})` : 'not committed (nothing changed)'}.`, `Gates: ${summary}.`,
      'Owner feedback since then: none relayed. Continue with the next top item of the AAA gap list.'];
  } else {
    failures += 1;
    const failed = g.results.filter(r => r.code !== 0);
    outcome = { session, ok: false, failed: failed.map(f => f.name), gates: summary };
    last = [`Session ${session} FAILED the supervisor gates and was NOT committed. Failing gates: ${failed.map(f => f.name).join(', ')}.`, '',
      ...failed.flatMap(f => [`### ${f.name}`, '```', f.tail.trim().slice(-1200), '```']),
      failures >= 2 ? '\nThe working tree was RESET to the last green commit; your uncommitted work from that session is gone. Re-plan a smaller step.' : '\nYour uncommitted changes are still in the working tree: fix the failing gate first, then continue.'];
    if (failures >= 2 && !DRY) { await sh('git checkout -- apps/ironsight && git clean -fd apps/ironsight', { cwd: repo, timeoutMs: 120000 }); await log('working tree reset to HEAD after 2 consecutive failures'); failures = 0; }
  }
  await jsonl({ ...outcome, askCode: ask.code });
  if (DRY) break;
}
await log('loop finished');
