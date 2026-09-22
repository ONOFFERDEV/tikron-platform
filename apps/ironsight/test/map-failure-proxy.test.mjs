import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, get } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { MAP_FAILURE_PATHS, parseProxyCliArgs, probePortFree, startMapFailureProxy,
  validateProxyEvidence, validateProxyRun } from '../scripts/map-failure-proxy.mjs';

const bundle = Buffer.from('immutable-stage10-client-bundle');
const bundleHash = createHash('sha256').update(bundle).digest('hex');
const pathSetHash = createHash('sha256').update(MAP_FAILURE_PATHS.join('\n')).digest('hex');

async function upstreamFixture() {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    if (request.url === '/client.js') {
      response.writeHead(200, { 'content-type': 'text/javascript', 'content-length': bundle.length });
      response.end(request.method === 'HEAD' ? undefined : bundle);
      return;
    }
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'x-upstream': 'yes' });
    response.end(request.method === 'HEAD' ? undefined : Buffer.from(`upstream:${request.url}`));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return { origin: `http://127.0.0.1:${address.port}`, requests,
    close: () => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); } };
}

test('serves 503 only for the exact eight targets and preserves forwarded bundle bytes', async () => {
  const upstream = await upstreamFixture();
  const temporary = await mkdtemp(join(tmpdir(), 'map-failure-proxy-'));
  const logPath = join(temporary, 'requests.jsonl');
  const proxy = await startMapFailureProxy({ upstream: upstream.origin, port: 0, logPath });
  const expectedConfig = { upstreamOrigin: upstream.origin, failureOrigin: proxy.origin, host: '127.0.0.1',
    port: Number(new URL(proxy.origin).port), logPath: resolve(logPath), failurePathSetSha256: pathSetHash };
  assert.equal(proxy.readyReceipt.event, 'map_failure_proxy_ready');
  assert.equal(Object.entries(expectedConfig).every(([key, value]) => proxy.readyReceipt[key] === value), true);
  try {
    for (const path of MAP_FAILURE_PATHS) {
      const response = await fetch(`${proxy.origin}${path}`);
      assert.equal(response.status, 503);
      await response.arrayBuffer();
    }
    const extra = await fetch(`${proxy.origin}/assets/ww1/environment/future.glb?cache=1`);
    assert.equal(extra.status, 200);
    assert.equal(extra.headers.get('x-upstream'), 'yes');
    assert.equal(await extra.text(), 'upstream:/assets/ww1/environment/future.glb?cache=1');
    const head = await fetch(`${proxy.origin}/client.js`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    const client = await fetch(`${proxy.origin}/client.js`);
    assert.deepEqual(Buffer.from(await client.arrayBuffer()), bundle);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(upstream.requests.some(item => MAP_FAILURE_PATHS.includes(new URL(item.url, upstream.origin).pathname)), false);
    const requestVerdict = validateProxyEvidence(proxy.entries, { expectedBundleSha256: bundleHash });
    assert.deepEqual(requestVerdict.reasons, []);
    assert.equal(requestVerdict.requestsQualified, true);
    assert.equal(requestVerdict.qualified, false);
    assert.equal(requestVerdict.targets.every(item => item.status === 503 && item.outcome === 'finished'), true);
    assert.equal(requestVerdict.bundle.sha256, bundleHash);
    const beforeClose = await validateProxyRun({ entries: proxy.entries, expectedBundleSha256: bundleHash,
      readyReceipt: proxy.readyReceipt, expected: expectedConfig });
    assert.equal(beforeClose.qualified, false);
    assert.equal(beforeClose.reasons.includes('closed_receipt_missing'), true);
  } finally {
    const closedReceipt = await proxy.close();
    const portReceipt = await probePortFree({ host: closedReceipt.host, port: closedReceipt.port });
    const persisted = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(persisted, proxy.entries);
    const finalVerdict = await validateProxyRun({ entries: proxy.entries, expectedBundleSha256: bundleHash,
      readyReceipt: proxy.readyReceipt, closedReceipt, portReceipt, expected: expectedConfig });
    assert.equal(finalVerdict.qualified, true);
    assert.deepEqual(finalVerdict.reasons, []);
    await upstream.close();
    await rm(temporary, { recursive: true, force: true });
  }
});

test('fails closed on unmatched errors, unsupported methods, or missing exact failures', async () => {
  const upstream = await upstreamFixture();
  const proxy = await startMapFailureProxy({ upstream: upstream.origin, port: 0 });
  try {
    await fetch(`${proxy.origin}${MAP_FAILURE_PATHS[0]}`);
    await fetch(`${proxy.origin}${MAP_FAILURE_PATHS[1]}`, { method: 'HEAD' });
    await fetch(`${proxy.origin}/client.js`);
    await fetch(`${proxy.origin}/submit`, { method: 'POST', body: 'no' });
    await new Promise(resolve => setImmediate(resolve));
    const verdict = validateProxyEvidence(proxy.entries, { expectedBundleSha256: bundleHash });
    assert.equal(verdict.requestsQualified, false);
    assert.equal(verdict.qualified, false);
    assert.equal(verdict.reasons.includes('exact_failure_path_missing'), true);
    assert.equal(verdict.reasons.includes('unexpected_method'), true);
    assert.equal(verdict.targets[1].attempts, 1);
    assert.equal(verdict.targets[1].status, undefined);
  } finally {
    await proxy.close();
    await upstream.close();
  }
});

test('strict CLI parser rejects ambiguous configuration', () => {
  const valid = ['--upstream', 'http://127.0.0.1:8796', '--host', '127.0.0.1', '--port', '8797',
    '--log', 'D:/evidence/proxy.jsonl'];
  assert.equal(parseProxyCliArgs(valid).port, 8797);
  for (const args of [valid.slice(0, -1), [...valid, '--wat', 'x'], [...valid, '--port', '8798'],
    ['--upstream', '--host', '127.0.0.1', '--port', '8797', '--log', 'x']]) {
    assert.throws(() => parseProxyCliArgs(args));
  }
});

test('final lifecycle validator rejects missing log and wrong origin binding', async () => {
  const upstream = await upstreamFixture();
  const proxy = await startMapFailureProxy({ upstream: upstream.origin, port: 0 });
  const closedReceipt = await proxy.close();
  const portReceipt = await probePortFree({ host: closedReceipt.host, port: closedReceipt.port });
  const noLog = await validateProxyRun({ entries: proxy.entries, expectedBundleSha256: bundleHash,
    readyReceipt: proxy.readyReceipt, closedReceipt, portReceipt, expected: proxy.readyReceipt });
  assert.equal(noLog.qualified, false);
  assert.equal(noLog.reasons.includes('persisted_log_missing'), true);
  const wrongOrigin = await validateProxyRun({ entries: proxy.entries, expectedBundleSha256: bundleHash,
    readyReceipt: proxy.readyReceipt, closedReceipt, portReceipt,
    expected: { ...proxy.readyReceipt, failureOrigin: 'http://127.0.0.1:9999' } });
  assert.equal(wrongOrigin.reasons.includes('ready_config_mismatch'), true);
  await upstream.close();
});

test('records an aborted upstream body as incomplete and closes deterministically', async () => {
  const upstreamServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': '100' });
    response.write('partial');
    setImmediate(() => response.socket.destroy());
  });
  upstreamServer.listen(0, '127.0.0.1');
  await once(upstreamServer, 'listening');
  const address = upstreamServer.address();
  const proxy = await startMapFailureProxy({ upstream: `http://127.0.0.1:${address.port}`, port: 0 });
  try {
    await assert.rejects(async () => {
      const response = await fetch(`${proxy.origin}/truncated`);
      await response.arrayBuffer();
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(proxy.entries.some(item => item.path === '/truncated' && item.outcome === 'upstream_error'), true);
    const verdict = validateProxyEvidence(proxy.entries, { expectedBundleSha256: bundleHash });
    assert.equal(verdict.reasons.includes('forward_incomplete'), true);
  } finally {
    await proxy.close();
    upstreamServer.closeAllConnections();
    await new Promise(resolve => upstreamServer.close(resolve));
  }
});

test('records downstream disconnects and releases its exact listening port', async () => {
  const upstreamServer = createServer((_request, response) => setTimeout(() => response.end('late'), 100));
  upstreamServer.listen(0, '127.0.0.1');
  await once(upstreamServer, 'listening');
  const upstreamAddress = upstreamServer.address();
  const proxy = await startMapFailureProxy({ upstream: `http://127.0.0.1:${upstreamAddress.port}`, port: 0 });
  const proxyPort = new URL(proxy.origin).port;
  const reachedUpstream = once(upstreamServer, 'request');
  const request = get(`${proxy.origin}/slow`);
  request.on('error', () => {});
  await reachedUpstream;
  request.destroy();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(proxy.entries.some(item => item.path === '/slow' && item.outcome === 'disconnect'), true);
  await proxy.close();

  const probe = createServer();
  probe.listen(Number(proxyPort), '127.0.0.1');
  await once(probe, 'listening');
  const socket = createConnection({ host: '127.0.0.1', port: Number(proxyPort) });
  await once(socket, 'connect');
  socket.destroy();
  await new Promise(resolve => probe.close(resolve));
  upstreamServer.closeAllConnections();
  await new Promise(resolve => upstreamServer.close(resolve));
});
