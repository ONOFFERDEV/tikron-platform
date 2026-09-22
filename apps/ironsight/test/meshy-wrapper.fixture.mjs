import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), 'meshy-wrapper-fixture-'));
const shadow = join(root, 'shadow'); const shadowMarker = join(root, 'shadow-ran.txt');
const secret = join(root, 'synthetic.clixml'); const successResult = join(root, 'success.json'); const failureResult = join(root, 'failure.json');
const wrapper = resolve(import.meta.dirname, '..', 'scripts', 'meshy-credential.ps1');
const reportPath = process.argv[process.argv.indexOf('--report') + 1];

try {
  await mkdir(join(shadow, 'test'), { recursive: true });
  await writeFile(join(shadow, 'node.cmd'), `@echo off\r\necho PATH-shadow>${shadowMarker}\r\nexit /b 0\r\n`);
  await writeFile(join(shadow, 'test', 'meshy-wrapper-child.fixture.mjs'), `throw new Error("cwd shadow executed")\n`);
  const exportCommand = `$value=ConvertTo-SecureString 'synthetic-wrapper-secret' -AsPlainText -Force; Export-Clixml -InputObject $value -LiteralPath '${secret.replaceAll("'", "''")}'`;
  await execute('powershell.exe', ['-NoProfile', '-Command', exportCommand], { windowsHide: true });
  const env = { ...process.env, PATH: `${shadow};${process.env.PATH ?? ''}`, MESHY_WRAPPER_TEST_MODE: '1', MESHY_FIXTURE_MODE: '1' };
  const baseArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, 'test/meshy-wrapper-child.fixture.mjs', '-TestCredentialPath', secret];
  await execute('powershell.exe', [...baseArgs, '-TestResultPath', successResult], { cwd: shadow, env, windowsHide: true });
  const success = JSON.parse(await readFile(successResult, 'utf8'));
  assert.deepEqual(success, { trustedChildRan: true, receivedSyntheticCredential: true, keyPresentAfterCleanup: false, sourcePresentAfterCleanup: false });
  await assert.rejects(execute('powershell.exe', [...baseArgs, '-TestResultPath', failureResult, '-ForceChildFailure'], { cwd: shadow, env, windowsHide: true }));
  const failure = JSON.parse(await readFile(failureResult, 'utf8'));
  assert.equal(failure.trustedChildRan, true); assert.equal(failure.keyPresentAfterCleanup, false); assert.equal(failure.sourcePresentAfterCleanup, false);
  await assert.rejects(readFile(shadowMarker, 'utf8'));
  const report = { verdict: 'PASS', syntheticCredentialOnly: true, absoluteWrapper: wrapper, outsideCwdUsed: true, pathShadowRan: false, cwdShadowRan: false, childReceivedSyntheticCredential: true, cleanupAfterSuccess: true, cleanupAfterExit7: true };
  if (reportPath) await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally { await rm(root, { recursive: true, force: true }); }
