import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAP_FAILURE_PATHS = Object.freeze([
  '/assets/ww1/environment/duckboard.glb',
  '/assets/ww1/environment/sandbag.glb',
  '/assets/ww1/environment/wire.glb',
  '/assets/maps/relay-ground-ao.png',
  '/assets/ww1/environment/ammo-crate.glb',
  '/assets/ww1/environment/brick-rubble.glb',
  '/assets/ww1/environment/field-telephone.glb',
  '/assets/ww1/environment/observation-post.glb',
]);

const failurePaths = new Set(MAP_FAILURE_PATHS);
const failurePathSetSha256 = createHash('sha256').update(MAP_FAILURE_PATHS.join('\n')).digest('hex');
const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade']);
const configKeys = ['upstreamOrigin', 'failureOrigin', 'host', 'port', 'logPath', 'failurePathSetSha256'];

function filteredHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !hopHeaders.has(name.toLowerCase())));
}

function assertLoopback(url, host) {
  const allowed = new Set(['127.0.0.1', 'localhost', '::1']);
  if (!allowed.has(url.hostname) || !allowed.has(host)) throw new Error('proxy requires loopback origins');
}

function sameConfig(left, right) {
  return Boolean(left && right && configKeys.every(key => left[key] === right[key]));
}

export async function startMapFailureProxy({ upstream, host = '127.0.0.1', port = 8797, logPath,
  upstreamTimeoutMs = 30_000 }) {
  const upstreamUrl = new URL(upstream);
  assertLoopback(upstreamUrl, host);
  if (upstreamUrl.protocol !== 'http:') throw new Error('proxy requires an HTTP upstream');
  const resolvedLogPath = logPath ? resolve(logPath) : null;
  if (resolvedLogPath) await mkdir(dirname(resolvedLogPath), { recursive: true });
  const entries = [];
  const activeRequests = new Set();
  const activeResponses = new Set();
  let writeChain = Promise.resolve();
  let logError;
  const persist = entry => {
    entries.push(entry);
    if (!resolvedLogPath) return;
    writeChain = writeChain.then(() => appendFile(resolvedLogPath, `${JSON.stringify(entry)}\n`, 'utf8'))
      .catch(error => { logError = error; });
  };

  const server = createServer((incoming, outgoing) => {
    const startedAt = Date.now();
    const requestUrl = new URL(incoming.url ?? '/', `http://${host}`);
    const method = incoming.method ?? 'GET';
    let recorded = false;
    const record = details => {
      if (recorded) return;
      recorded = true;
      persist({ timestamp: new Date(startedAt).toISOString(), durationMs: Date.now() - startedAt,
        method, path: requestUrl.pathname, search: requestUrl.search, ...details });
    };
    if (method !== 'GET' && method !== 'HEAD') {
      outgoing.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' });
      outgoing.end(() => record({ action: 'reject', status: 405, outcome: 'finished', bytes: 0 }));
      return;
    }
    if (failurePaths.has(requestUrl.pathname)) {
      const body = Buffer.from(JSON.stringify({ error: 'task30_exact_asset_failure', path: requestUrl.pathname }));
      outgoing.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store',
        'content-length': body.length });
      outgoing.end(method === 'HEAD' ? undefined : body, () => record({ action: 'failure', status: 503,
        outcome: 'finished', bytes: method === 'HEAD' ? 0 : body.length }));
      outgoing.once('close', () => {
        if (!outgoing.writableFinished) record({ action: 'failure', status: 503, outcome: 'disconnect', bytes: 0 });
      });
      return;
    }

    const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, upstreamUrl);
    const proxyRequest = httpRequest(target, { method, timeout: upstreamTimeoutMs,
      headers: { ...filteredHeaders(incoming.headers), host: upstreamUrl.host, 'accept-encoding': 'identity' } });
    activeRequests.add(proxyRequest);
    let responseBytes = 0;
    const hash = createHash('sha256');
    proxyRequest.once('response', upstreamResponse => {
      activeResponses.add(upstreamResponse);
      const upstreamFailure = error => {
        activeResponses.delete(upstreamResponse);
        if (!outgoing.destroyed) outgoing.destroy();
        record({ action: 'forward', status: upstreamResponse.statusCode ?? 502, outcome: 'upstream_error',
          bytes: responseBytes, error: error?.message ?? 'upstream_response_aborted' });
      };
      upstreamResponse.once('aborted', () => upstreamFailure());
      upstreamResponse.once('error', upstreamFailure);
      upstreamResponse.once('end', () => activeResponses.delete(upstreamResponse));
      upstreamResponse.on('data', chunk => { responseBytes += chunk.length; hash.update(chunk); });
      outgoing.writeHead(upstreamResponse.statusCode ?? 502, filteredHeaders(upstreamResponse.headers));
      upstreamResponse.pipe(outgoing);
      outgoing.once('finish', () => record({ action: 'forward', status: upstreamResponse.statusCode ?? 502,
        upstreamStatus: upstreamResponse.statusCode ?? 502, outcome: 'finished', bytes: responseBytes,
        sha256: hash.digest('hex') }));
    });
    proxyRequest.once('timeout', () => proxyRequest.destroy(new Error('upstream_timeout')));
    proxyRequest.once('error', error => {
      if (!outgoing.headersSent) outgoing.writeHead(502, { 'cache-control': 'no-store' });
      if (!outgoing.writableEnded) outgoing.end();
      record({ action: 'forward', status: 502, outcome: 'upstream_error', bytes: responseBytes, error: error.message });
    });
    proxyRequest.once('close', () => activeRequests.delete(proxyRequest));
    outgoing.once('close', () => {
      if (!outgoing.writableFinished) {
        proxyRequest.destroy();
        record({ action: 'forward', status: outgoing.statusCode || 0, outcome: 'disconnect', bytes: responseBytes });
      }
    });
    incoming.pipe(proxyRequest);
  });
  server.listen(port, host);
  await new Promise((accept, reject) => { server.once('listening', accept); server.once('error', reject); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('proxy did not expose a TCP address');
  const readyReceipt = Object.freeze({ event: 'map_failure_proxy_ready', upstreamOrigin: upstreamUrl.origin,
    failureOrigin: `http://${host}:${address.port}`, host, port: address.port, logPath: resolvedLogPath,
    failurePathSetSha256 });
  let closedReceipt;
  return { origin: readyReceipt.failureOrigin, entries, readyReceipt,
    async close() {
      if (closedReceipt) return closedReceipt;
      for (const request of activeRequests) request.destroy(new Error('proxy_closing'));
      for (const response of activeResponses) response.destroy(new Error('proxy_closing'));
      server.closeIdleConnections?.();
      await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept()));
      await writeChain;
      if (logError) throw logError;
      let log = null;
      if (resolvedLogPath) {
        const bytes = await readFile(resolvedLogPath);
        log = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), entries: entries.length };
      }
      closedReceipt = Object.freeze({ ...readyReceipt, event: 'map_failure_proxy_closed', log });
      return closedReceipt;
    } };
}

export function validateProxyEvidence(entries, { expectedBundleSha256, bundlePath = '/client.js' }) {
  const reasons = new Set();
  const targets = MAP_FAILURE_PATHS.map(path => {
    const matches = entries.filter(entry => entry.path === path);
    const completed = matches.filter(entry => entry.method === 'GET' && entry.action === 'failure'
      && entry.status === 503 && entry.outcome === 'finished');
    if (completed.length === 0) reasons.add('exact_failure_path_missing');
    if (matches.some(entry => entry.action !== 'failure' || entry.status !== 503 || entry.outcome !== 'finished'))
      reasons.add('exact_failure_incomplete');
    return { path, attempts: matches.length, status: completed.at(-1)?.status, outcome: completed.at(-1)?.outcome };
  });
  const forwarded = entries.filter(entry => !failurePaths.has(entry.path));
  if (forwarded.some(entry => entry.action === 'reject')) reasons.add('unexpected_method');
  if (forwarded.some(entry => entry.action === 'forward' &&
    (entry.outcome !== 'finished' || entry.status !== entry.upstreamStatus || entry.status === 503)))
    reasons.add('forward_incomplete');
  const bundle = [...forwarded].reverse().find(entry => entry.path === bundlePath && entry.method === 'GET'
    && entry.action === 'forward' && entry.status === 200 && entry.outcome === 'finished');
  if (!bundle) reasons.add('bundle_passthrough_missing');
  else if (bundle.sha256 !== expectedBundleSha256) reasons.add('bundle_hash_mismatch');
  return { qualified: false, requestsQualified: reasons.size === 0, reasons: [...reasons], targets, forwarded,
    bundle: bundle ?? null };
}

export async function probePortFree({ host, port }) {
  const probe = createServer();
  try {
    probe.listen(port, host);
    await new Promise((accept, reject) => { probe.once('listening', accept); probe.once('error', reject); });
    return { event: 'map_failure_proxy_port_free', host, port, free: true };
  } finally {
    if (probe.listening) await new Promise(accept => probe.close(accept));
  }
}

export async function validateProxyRun({ entries, expectedBundleSha256, readyReceipt, closedReceipt,
  portReceipt, expected }) {
  const requestVerdict = validateProxyEvidence(entries, { expectedBundleSha256 });
  const reasons = new Set(requestVerdict.reasons);
  if (!readyReceipt || readyReceipt.event !== 'map_failure_proxy_ready' || !sameConfig(readyReceipt, expected))
    reasons.add('ready_config_mismatch');
  if (!closedReceipt || closedReceipt.event !== 'map_failure_proxy_closed') reasons.add('closed_receipt_missing');
  else if (!sameConfig(closedReceipt, readyReceipt)) reasons.add('closed_config_mismatch');
  if (!portReceipt || portReceipt.event !== 'map_failure_proxy_port_free' || !portReceipt.free
    || portReceipt.host !== readyReceipt?.host
    || portReceipt.port !== readyReceipt?.port) reasons.add('port_free_receipt_missing');
  if (!readyReceipt?.logPath || !closedReceipt?.log) reasons.add('persisted_log_missing');
  else {
    try {
      const bytes = await readFile(readyReceipt.logPath);
      const parsed = bytes.toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (bytes.length === 0 || hash !== closedReceipt.log.sha256 || bytes.length !== closedReceipt.log.bytes
        || parsed.length !== closedReceipt.log.entries || JSON.stringify(parsed) !== JSON.stringify(entries))
        reasons.add('persisted_log_mismatch');
    } catch { reasons.add('persisted_log_missing'); }
  }
  return { ...requestVerdict, qualified: requestVerdict.requestsQualified && reasons.size === 0,
    reasons: [...reasons] };
}

export function parseProxyCliArgs(argv) {
  const required = new Set(['upstream', 'host', 'port', 'log']);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const raw = argv[index];
    const value = argv[index + 1];
    if (!raw?.startsWith('--') || !required.has(raw.slice(2))) throw new Error(`unknown option: ${raw}`);
    const key = raw.slice(2);
    if (Object.hasOwn(values, key)) throw new Error(`duplicate option: ${raw}`);
    if (!value || value.startsWith('--')) throw new Error(`missing value: ${raw}`);
    values[key] = value;
  }
  for (const key of required) if (!Object.hasOwn(values, key)) throw new Error(`missing option: --${key}`);
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid --port');
  return { upstream: values.upstream, host: values.host, port, logPath: resolve(values.log) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = parseProxyCliArgs(process.argv.slice(2));
  const fixture = await startMapFailureProxy(args);
  process.stdout.write(`${JSON.stringify(fixture.readyReceipt)}\n`);
  const shutdown = async signal => {
    const closed = await fixture.close();
    const portFree = await probePortFree({ host: closed.host, port: closed.port });
    process.stdout.write(`${JSON.stringify({ ...closed, signal })}\n${JSON.stringify(portFree)}\n`);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
