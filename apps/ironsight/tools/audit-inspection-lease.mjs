// Standalone tooling audit; does not touch the combat stream's test/** files.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { acquireInspectionLease } from '../scripts/inspection-lease.mjs';

const moduleUrl = new URL('../scripts/inspection-lease.mjs', import.meta.url).href;
const checks = [];
const spawnOwner = port => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { acquireInspectionLease } from ${JSON.stringify(moduleUrl)};
    const lease = await acquireInspectionLease('audit child', {port:${port}, onWait:()=>{}});
    console.log(JSON.stringify(lease.info));
    setInterval(()=>{},1000);
  `], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  return { child, acquired: once(lines, 'line').then(([line]) => JSON.parse(line)),
    async stop() {
      if (child.exitCode === null && child.signalCode === null) { const closed = once(child, 'close'); child.kill(); await closed; }
      lines.close();
    } };
};

const first = await acquireInspectionLease('audit parent', { port: 0 });
let child;
try {
  child = spawnOwner(first.info.port);
  let entered = false;
  child.acquired.then(() => { entered = true; });
  await delay(500);
  assert.equal(entered, false, 'a second process entered before release');
  await first.release();
  const info = await Promise.race([child.acquired, delay(5000).then(() => { throw Error('Waiting child never acquired'); })]);
  assert.equal(info.port, first.info.port);
  assert.notEqual(info.pid, process.pid);
  checks.push('cross-process exclusion and handover');
  await child.stop();
  const recovered = await acquireInspectionLease('after crash', { port: info.port, timeoutMs: 1000 });
  try {
    checks.push('automatic recovery after owner termination');
    await assert.rejects(acquireInspectionLease('deadline', { port: info.port, timeoutMs: 100, onWait: () => {} }), /timed out/);
    checks.push('contention timeout fails without bypass');
  } finally { await recovered.release(); await recovered.release(); }
  checks.push('idempotent release');
} finally { await first.release(); await child?.stop(); }

const foreign = createServer(socket => socket.end('{"protocol":"unrelated-service"}'));
await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
try {
  await assert.rejects(acquireInspectionLease('foreign', { port: foreign.address().port }), /another service/);
  checks.push('unrelated listener refused without termination');
} finally { await new Promise(resolve => foreign.close(resolve)); }
const report = JSON.stringify({ status: 'PASS', checks }, null, 2);
if (process.argv[2]) await writeFile(process.argv[2], report);
console.log(report);
