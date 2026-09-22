import { describe, expect, it } from 'vitest';
import { CombatTelemetry } from '../client/combat-telemetry.js';
import type { ServerShotResult, ShotAttempt } from '../src/combat-events.js';

const attempt = (shotId: string, at = 105): ShotAttempt => ({
  kind: 'attempt', shotId, weaponIndex: 0, localMonoAt: at, rawAim: { yaw: 0, pitch: 0 },
});
const accepted = (shotId: string): ServerShotResult => ({
  kind: 'accepted', shotId, acceptedAt: 1000, ammo: { mag: 4, reserve: 20 }, recoil: { slot: 0, count: 1, at: 1000 },
});
const blocked = (shotId: string): ServerShotResult => ({
  kind: 'blocked', shotId, reason: 'cadence', retryMs: 20, ammo: { mag: 5, reserve: 20 },
  recoil: { slot: 0, count: 0, at: 1000 },
});

describe('combat telemetry', () => {
  it('separates local prediction, RTT, confirmation, audio and server resolve pairs', () => {
    const telemetry = new CombatTelemetry();
    const commandId = telemetry.captureInput('fire', 'press', 100,
      { source: 'trusted-device', trusted: true }, true);
    telemetry.beginShot(attempt('self:1:1'), commandId, { handlerAt: 105, sendAt: 107 });
    telemetry.predictedCommitted('self:1:1', 108);
    telemetry.audioScheduled('self:1:1', 109);
    telemetry.shotResult(accepted('self:1:1'), { receiptAt: 160, serverReceiveAt: 1000, serverResolveAt: 1004 });
    telemetry.confirmed('self:1:1', 'confirmed_paint', 170);
    telemetry.confirmed('self:1:1', 'confirmed_paint', 171);

    const snapshot = telemetry.snapshot();
    expect(snapshot.metrics.actual).toMatchObject({
      validShots: 1, predictedMs: { count: 1, p50: 8 }, rttMs: { count: 1, p50: 53 },
      confirmationMs: { count: 1, p50: 10 }, audioScheduleMs: { count: 1, p50: 1 },
      serverResolveMs: { count: 1, p50: 4 },
    });
    expect(snapshot.counts.duplicate).toBe(1);
    expect(snapshot.hud).toMatchObject({ status: 'ready', validSamples: 1, clockUncertaintyMs: 1 });
    expect(snapshot.clockPairs).toEqual({
      local: ['input→handler', 'handler→send', 'send→predicted_commit', 'send→receipt',
        'receipt→confirmed_paint', 'predicted_commit→audio_schedule'],
      server: ['server_receive→resolve'], crossClockSubtraction: false,
    });
  });

  it('keeps blocked and duplicate results from producing confirmation samples', () => {
    const telemetry = new CombatTelemetry();
    const id = telemetry.captureInput('fire', 'press', 10, { source: 'trusted-device', trusted: true }, true);
    telemetry.beginShot(attempt('self:1:2', 12), id, { handlerAt: 12, sendAt: 13 });
    telemetry.predictedCommitted('self:1:2', 14);
    telemetry.shotResult(blocked('self:1:2'), { receiptAt: 20, serverReceiveAt: 100, serverResolveAt: 101 });
    telemetry.shotResult(blocked('self:1:2'), { receiptAt: 21, serverReceiveAt: 100, serverResolveAt: 101 });
    telemetry.confirmed('self:1:2', 'confirmed_paint', 22);
    const snapshot = telemetry.snapshot();
    expect(snapshot.counts).toMatchObject({ blocked: 1, duplicate: 1, ignoredConfirmation: 1 });
    expect(snapshot.metrics.actual.confirmationMs.count).toBe(0);
  });

  it('rejects reversed, out-of-order and cross-generation stages without negative latency', () => {
    const telemetry = new CombatTelemetry();
    const id = telemetry.captureInput('fire', 'press', 100, { source: 'trusted-device', trusted: true }, true);
    telemetry.beginShot(attempt('self:1:3'), id, { handlerAt: 105, sendAt: 110 });
    telemetry.predictedCommitted('self:1:3', 104);
    telemetry.shotResult(accepted('self:1:3'), { receiptAt: 90, serverReceiveAt: 1004, serverResolveAt: 1000 });
    telemetry.confirmed('self:1:3', 'confirmed_paint', 80);
    const beforeReset = telemetry.snapshot();
    expect(beforeReset.counts.invalid).toBeGreaterThan(0);
    expect(JSON.stringify(beforeReset.metrics)).not.toContain('-');

    telemetry.reset('reconnect', 120);
    telemetry.shotResult(accepted('self:1:3'), { receiptAt: 130, serverReceiveAt: 1010, serverResolveAt: 1011 });
    expect(telemetry.snapshot().counts.stale).toBeGreaterThan(0);
  });

  it('invalidates active traces on a monotonic clock reset', () => {
    const telemetry = new CombatTelemetry();
    telemetry.captureInput('fire', 'press', 500, { source: 'trusted-device', trusted: true }, true);
    telemetry.captureInput('fire', 'press', 5, { source: 'trusted-device', trusted: true }, true);
    expect(telemetry.snapshot()).toMatchObject({ generation: 2, counts: { clockReset: 1 } });
  });

  it('keeps synthetic samples visible in evidence but unavailable to the HUD', () => {
    const telemetry = new CombatTelemetry();
    const id = telemetry.captureInput('fire', 'press', 10, { source: 'synthetic', trusted: false }, true);
    telemetry.beginShot(attempt('self:1:4', 12), id, { handlerAt: 12, sendAt: 13 });
    telemetry.predictedCommitted('self:1:4', 14);
    telemetry.shotResult(accepted('self:1:4'), { receiptAt: 20, serverReceiveAt: 100, serverResolveAt: 102 });
    const snapshot = telemetry.snapshot();
    expect(snapshot.metrics.synthetic.rttMs).toMatchObject({ count: 1, p50: 7 });
    expect(snapshot.hud).toEqual({ status: 'unavailable', validSamples: 0, clockUncertaintyMs: 1 });
  });

  it('assigns stable ADS command ids and records no input while gameplay is unlocked', () => {
    const telemetry = new CombatTelemetry();
    expect(telemetry.captureInput('fire', 'press', 1, { source: 'trusted-device', trusted: true }, false)).toBeNull();
    const first = telemetry.captureInput('ads', 'press', 2, { source: 'trusted-device', trusted: true }, true);
    const second = telemetry.captureInput('ads', 'release', 3, { source: 'trusted-device', trusted: true }, true);
    telemetry.adsApplied(true, 4, 5);
    telemetry.adsApplied(false, 6, 7);
    expect(first).toBe('g1:ads:1');
    expect(second).toBe('g1:ads:2');
    expect(telemetry.snapshot().counts.adsTransitions).toBe(2);
    expect(telemetry.snapshot().metrics.actual.validAdsTransitions).toBe(2);
  });

  it('bounds the exported ring below two MiB', () => {
    const telemetry = new CombatTelemetry();
    for (let index = 0; index < 20_000; index += 1) {
      telemetry.captureInput('ads', index % 2 ? 'release' : 'press', index,
        { source: 'synthetic', trusted: false }, true);
    }
    const bytes = new TextEncoder().encode(JSON.stringify(telemetry.snapshot())).byteLength;
    expect(bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(new TextEncoder().encode(telemetry.csv()).byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(telemetry.csv().split('\n')[0]).toBe('id,generation,stage,at,clock,source,trusted,detail');
    expect(telemetry.snapshot().counts.evicted).toBeGreaterThan(0);
  });

  it('bounds pending input queues and associates a shot with the newest retained fire press', () => {
    const telemetry = new CombatTelemetry();
    for (let index = 0; index < 20_000; index += 1) {
      telemetry.captureInput('ads', index % 2 ? 'release' : 'press', index,
        { source: 'synthetic', trusted: false }, true);
    }
    for (let index = 20_000; index < 24_990; index += 1) {
      telemetry.captureInput('fire', 'press', index,
        { source: 'synthetic', trusted: false }, true);
    }
    telemetry.captureInput('fire', 'press', 25_000,
      { source: 'trusted-device', trusted: true }, true);
    telemetry.beginShot(attempt('self:1:5', 25_001), { pressedAt: 25_000.25 },
      { handlerAt: 25_001, sendAt: 25_003 });
    telemetry.predictedCommitted('self:1:5', 25_004);
    telemetry.shotResult(accepted('self:1:5'),
      { receiptAt: 25_010, serverReceiveAt: 50_000, serverResolveAt: 50_001 });

    const snapshot = telemetry.snapshot();
    expect(snapshot.retained).toMatchObject({ inputs: 1024, pendingAds: 0 });
    expect(snapshot.retained.pendingFire).toBeLessThanOrEqual(1024);
    expect(snapshot.metrics.actual.validShots).toBe(1);
    expect(snapshot.metrics.synthetic.validShots).toBe(0);
  });

  it('rejects ambiguous timestamp association and reuses an explicit held command', () => {
    const telemetry = new CombatTelemetry();
    telemetry.captureInput('fire', 'press', 100, { source: 'trusted-device', trusted: true }, true);
    telemetry.captureInput('fire', 'press', 101, { source: 'synthetic', trusted: false }, true);
    telemetry.beginShot(attempt('self:1:6'), { pressedAt: 100 }, { handlerAt: 102, sendAt: 103 });
    telemetry.predictedCommitted('self:1:6', 104);
    telemetry.shotResult(accepted('self:1:6'), { receiptAt: 110 });
    expect(telemetry.snapshot()).toMatchObject({ metrics: { actual: { validShots: 0 } }, counts: { invalid: 1 } });

    const held = new CombatTelemetry();
    held.captureInput('fire', 'press', 200, { source: 'trusted-device', trusted: true }, true);
    for (const [shotId, offset] of [['self:1:7', 0], ['self:1:8', 10]] as const) {
      held.beginShot(attempt(shotId), { pressedAt: 199.5 }, { handlerAt: 201 + offset, sendAt: 202 + offset });
      held.predictedCommitted(shotId, 203 + offset);
      held.shotResult(accepted(shotId), { receiptAt: 204 + offset });
    }
    expect(held.snapshot().metrics.actual.validShots).toBe(2);
  });

  it('associates telemetry captured just before the input consumer timestamp', () => {
    const telemetry = new CombatTelemetry();
    telemetry.captureInput('fire', 'press', 100, { source: 'trusted-device', trusted: true }, true);
    telemetry.beginShot(attempt('self:1:9'), { pressedAt: 100.25 }, { handlerAt: 101, sendAt: 102 });
    telemetry.predictedCommitted('self:1:9', 103);
    telemetry.shotResult(accepted('self:1:9'), { receiptAt: 104 });

    const snapshot = telemetry.snapshot();
    expect(snapshot.metrics.actual.validShots).toBe(1);
    expect(snapshot.metrics.synthetic.validShots).toBe(0);
  });

});
