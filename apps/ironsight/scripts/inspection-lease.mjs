// All worktrees on this machine share one GPU. Hold this loopback lease from
// before browser launch until cleanup; parallel agents can keep coding/baking,
// but two updated inspectors cannot measure each other's rendering workload.
// No stale lock file survives a crash, and no other process is ever terminated.
import { createConnection, createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const HOST = '127.0.0.1';
const PORT = 18796;
const PROTOCOL = 'ironsight-gpu-inspection-v1';
// Supervisors must budget queue time separately from browser execution time.
export const INSPECTION_LEASE_TIMEOUT_MS = 600000;

function ownerAt(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: HOST, port });
    let body = '';
    socket.setTimeout(1500, () => socket.destroy(Error('Inspection lease owner did not identify itself')));
    socket.on('data', chunk => {
      body += chunk;
      if (body.length > 4096) socket.destroy(Error('Invalid inspection lease response'));
    });
    socket.once('error', reject);
    socket.once('end', () => {
      try {
        const owner = JSON.parse(body);
        if (owner.protocol !== PROTOCOL || !Number.isInteger(owner.pid)) throw Error('Port belongs to another service');
        resolve(owner);
      } catch (error) { reject(error); }
    });
  });
}

/** `port:0` is for the standalone concurrency audit only. Production callers
 * use the same fixed port, including when launched from different worktrees.
 * Acquisition timeout fails visibly; it never bypasses the lease or a gate. */
export async function acquireInspectionLease(label, { port = PORT, timeoutMs = INSPECTION_LEASE_TIMEOUT_MS, onWait = console.log } = {}) {
  const started = Date.now();
  let announced = false;
  for (;;) {
    const info = { protocol: PROTOCOL, pid: process.pid, label, port,
      acquiredAt: new Date().toISOString(), waitMs: Date.now() - started };
    const server = createServer(socket => {
      socket.on('error', () => {}); // a waiting inspector may be cancelled
      socket.end(JSON.stringify(info));
    });
    const error = await new Promise(resolve => {
      server.once('error', resolve);
      server.listen({ host: HOST, port, exclusive: true }, () => resolve(null));
    });
    if (!error) {
      info.port = server.address().port;
      server.unref(); // an unhandled CLI error must not leave the process alive
      let released;
      const lease = { info, release: () => released ??= new Promise((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve())) };
      return lease;
    }
    server.close();
    if (error.code !== 'EADDRINUSE') throw error;
    try {
      const owner = await ownerAt(port);
      if (!announced) {
        onWait(`Waiting for GPU inspection: ${owner.label} (PID ${owner.pid}).`);
        announced = true;
      }
    } catch (error) {
      // The previous owner may exit between bind and identification.
      if (error.code !== 'ECONNREFUSED' && error.code !== 'ECONNRESET')
        throw Error(`Cannot acquire GPU inspection port ${port}: ${error.message}`, { cause: error });
    }
    if (Date.now() - started >= timeoutMs) throw Error(`GPU inspection lease timed out after ${timeoutMs}ms`);
    // A new sequential probe can bind again inside the old 250ms sleep,
    // starving an inspector already waiting in another worktree. Retry once
    // per display interval; exclusivity and the acquisition deadline are unchanged.
    await delay(16);
  }
}
