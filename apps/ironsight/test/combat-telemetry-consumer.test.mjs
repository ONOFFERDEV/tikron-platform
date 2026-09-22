import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { build } from 'esbuild';

async function productionModules() {
  const bundled = await build({
    stdin: {
      contents: "export {Net} from './client/net.ts';export {CombatTelemetry} from './client/combat-telemetry.ts';",
      loader: 'ts',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`);
}

function accepted(shotId) {
  return {
    kind: 'accepted',
    shotId,
    acceptedAt: 5_000,
    ammo: { mag: 4, reserve: 20 },
    recoil: { slot: 1, count: 1, at: 5_000 },
  };
}

test('source consumer records send before the actual predicted commit', async () => {
  const main = readFileSync('client/main.ts', 'utf8');
  const start = main.indexOf('      const predicts = canPredictFire');
  const end = main.indexOf('        if (mag !== null) mag -= 1;', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const slice = `${main.slice(start, end)}\n}`;
  const code = ts.transpileModule(`let lastShotAttempt = null;\n${slice}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { CombatTelemetry, Net } = await productionModules();
  const nativePerformance = globalThis.performance;
  let tick = 2_000;
  const timeline = [];
  Object.defineProperty(globalThis, 'performance', { value: { now: () => tick }, configurable: true });
  try {
    const room = {
      connectionId: 'self',
      send: () => {
        timeline.push({ event: 'send', at: tick });
        tick += 25;
      },
      onMessage: () => undefined,
    };
    const net = new Net(room, 'arena-practice', { open: true, lostAt: 0 });
    net.setFireInterval(0);
    const telemetry = new CombatTelemetry();
    telemetry.captureInput('fire', 'press', 1_999, { source: 'synthetic', trusted: false }, true);
    new Function('canPredictFire', 'now', 'mag', 'reloadUntil', 'swapUntil', 'net', 'computeClaim', 'input',
      'combatTelemetry', 'shotFeedback', 'recoil', 'spec', 'shotNow', 'scene', 'curWeapon', 'weaponAudio',
      'playFire', 'fireRequest', 'fireHandlerAt', code)(
      () => true, 2_000, 30, 0, 0, net,
      () => { timeline.push({ event: 'claim', at: tick }); tick += 30; return null; },
      { yaw: 0, pitch: 0 }, telemetry, { attempt: attempt => ({ ...attempt, recoilScale: 1 }) },
      { fire: () => timeline.push({ event: 'recoil', at: tick }) }, {}, 2_000,
      { fireRecoil: () => timeline.push({ event: 'scene', at: tick }) }, 0,
      { acceptLocalAttempt: () => true }, () => true, { pressedAt: 1_999 }, 2_000,
    );
    const stages = telemetry.snapshot().events.filter(event => event.id === 'self:1:1');
    assert.deepEqual(timeline, [
      { event: 'claim', at: 2_000 },
      { event: 'send', at: 2_030 },
      { event: 'recoil', at: 2_055 },
      { event: 'scene', at: 2_055 },
    ]);
    assert.equal(stages.find(event => event.stage === 'send')?.at, 2_030);
    assert.equal(stages.find(event => event.stage === 'predicted_commit')?.at, 2_055);
  } finally {
    Object.defineProperty(globalThis, 'performance', { value: nativePerformance, configurable: true });
  }
});

test('source command association rejects an evicted trusted press for a later synthetic press', async () => {
  const { CombatTelemetry } = await productionModules();
  const telemetry = new CombatTelemetry();
  telemetry.captureInput('fire', 'press', 0, { source: 'trusted-device', trusted: true }, true);
  for (let at = 1; at <= 1_024; at += 1) {
    telemetry.captureInput('fire', 'press', at, { source: 'synthetic', trusted: false }, true);
  }
  telemetry.captureInput('fire', 'press', 2_000, { source: 'synthetic', trusted: false }, true);
  const attempt = { kind: 'attempt', shotId: 'self:1:1', weaponIndex: 0, localMonoAt: 2_001, rawAim: { yaw: 0, pitch: 0 } };
  telemetry.beginShot(attempt, { pressedAt: 2_000 }, { handlerAt: 2_001, sendAt: 2_002 });
  telemetry.predictedCommitted(attempt.shotId, 2_003);
  telemetry.shotResult(accepted(attempt.shotId), { receiptAt: 2_004 });
  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.metrics.actual.validShots, 0);
  assert.equal(snapshot.metrics.synthetic.validShots, 1);
  assert.ok(snapshot.retained.pendingFire <= 1_024);
});
