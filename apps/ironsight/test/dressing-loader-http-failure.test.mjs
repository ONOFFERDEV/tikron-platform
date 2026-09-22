import { createServer } from 'node:http';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DefaultLoadingManager, Scene } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { acquireMapDressing, dressingCacheSnapshot } from '../client/dressing-loader.js';
import { loadMapEnvironmentProps } from '../client/map-environment-props.js';

const FAILURE_PATHS = ['/http-503.glb', '/socket-drop.glb', '/corrupt.glb'];
const EXPECTED_SCENARIOS = ['raw-gltf-http-503', ...FAILURE_PATHS.map(path => `lease-${path.slice(1)}`),
  'relay-map-all-candidates-http-503'];
const server = createServer((request, response) => {
  if (request.url === FAILURE_PATHS[0] || request.url?.startsWith('/environment/') === true) {
    response.writeHead(503, { 'Content-Type': 'application/octet-stream' });
    response.end('unavailable');
    return;
  }
  if (request.url === FAILURE_PATHS[1]) {
    request.socket.destroy();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
  response.end('not-a-glb');
});

let origin;
const observations = [];

function settledWithin(operation, milliseconds = 1_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`operation remained pending after ${milliseconds}ms`)), milliseconds);
    operation.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

beforeAll(async () => {
  const reportPath = process.env.WW1_HTTP_REJECTION_REPORT;
  if (reportPath) await rm(reportPath, { force: true });
  globalThis.ProgressEvent ??= class ProgressEvent {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  };
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('ephemeral HTTP server did not expose an address');
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  let cleanupError = null;
  try {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } catch (error) {
    cleanupError = error;
  }
  let portClosed = false;
  try { await fetch(`${origin}/after-close`); } catch { portClosed = true; }
  if (process.env.WW1_HTTP_REJECTION_FORCE_CLEANUP_FAILURE === '1')
    cleanupError = new Error('forced cleanup failure');
  const bodyComplete = EXPECTED_SCENARIOS.every(scenario => observations.some(item => item.scenario === scenario));
  const verdict = cleanupError === null && portClosed && bodyComplete ? 'PASS' : 'FAIL';
  const reportPath = process.env.WW1_HTTP_REJECTION_REPORT;
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify({ verdict, origin, bodyComplete, portClosed,
      cleanupError: cleanupError instanceof Error ? `${cleanupError.name}: ${cleanupError.message}` : cleanupError,
      observations }, null, 2)}\n`);
  }
  expect(bodyComplete).toBe(true);
  expect(cleanupError).toBeNull();
  expect(portClosed).toBe(true);
});

describe('production dressing loader HTTP failures', () => {
  it('receives an actual GLTFLoader rejection from localhost HTTP 503', async () => {
    const started = performance.now();
    await expect(settledWithin(new GLTFLoader().loadAsync(`${origin}${FAILURE_PATHS[0]}`))).rejects.toThrow('503');
    observations.push({ scenario: 'raw-gltf-http-503', settledMs: performance.now() - started, outcome: 'rejected' });
  });

  it.each(FAILURE_PATHS)('settles %s to fallback and clears its cache entry', async path => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const started = performance.now();
    const lease = acquireMapDressing(`${origin}${path}`);
    await expect(settledWithin(lease.value)).resolves.toBeUndefined();
    lease.release();
    expect(dressingCacheSnapshot()).toEqual({ entries: 0, pending: 0, ready: 0, references: 0 });
    expect(warning).toHaveBeenCalledOnce();
    observations.push({ scenario: `lease-${path.slice(1)}`, settledMs: performance.now() - started,
      outcome: 'undefined-fallback', cache: dressingCacheSnapshot() });
    warning.mockRestore();
  });

  it('settles the production map adapter after every candidate receives a real HTTP 503', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    DefaultLoadingManager.setURLModifier(url => url.startsWith('/assets/ww1/environment/')
      ? `${origin}/environment/${url.slice(url.lastIndexOf('/') + 1)}` : url);
    try {
      const started = performance.now();
      const scene = new Scene();
      const props = await settledWithin(loadMapEnvironmentProps(scene, 'relay', { candidatePreview: true }));
      expect(props.loaded).toEqual([]);
      expect(props.fallback.length).toBeGreaterThan(0);
      expect(dressingCacheSnapshot()).toEqual({ entries: 0, pending: 0, ready: 0, references: 0 });
      const observation = { scenario: 'relay-map-all-candidates-http-503', settledMs: performance.now() - started,
        outcome: 'fallback-set', loaded: props.loaded.length, fallback: props.fallback.length,
        cache: dressingCacheSnapshot() };
      props.dispose();
      observations.push(observation);
    } finally {
      DefaultLoadingManager.setURLModifier(url => url);
      warning.mockRestore();
    }
  });
});
