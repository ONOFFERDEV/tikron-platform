import { EventEmitter } from 'node:events';
import { afterEach, expect, test, vi } from 'vitest';

const validOwner = JSON.stringify({ protocol: 'ironsight-gpu-inspection-v1', pid: 123, label: 'fixture owner' });
let current;

async function transportFixture(steps, repeat = steps.at(-1)) {
  const state = { steps, repeat, now: 0, attempt: 0, events: [], listeners: 0, sockets: 0, leases: [] };
  current = state;
  const record = (name, details = {}) => state.events.push({ name, atMs: state.now, ...details });
  vi.spyOn(Date, 'now').mockImplementation(() => state.now);
  vi.resetModules();
  vi.doMock('node:net', () => ({
    createServer: listener => {
      const server = new EventEmitter();
      let listening = false;
      server.listen = (options, callback) => {
        state.step = state.steps[state.attempt++] ?? state.repeat;
        record('bind', { options });
        queueMicrotask(() => {
          if (state.step.kind === 'free') {
            state.respond = listener;
            listening = true;
            state.listeners += 1;
            record('bound');
            callback();
          } else server.emit('error', Object.assign(new Error('fixture bind failure'), { code: state.step.bindError ?? 'EADDRINUSE' }));
        });
        return server;
      };
      server.address = () => ({ port: 18796 });
      server.unref = () => record('unref');
      server.close = callback => {
        record('server-close', { wasListening: listening });
        if (listening) state.listeners -= 1;
        listening = false;
        if (callback) queueMicrotask(callback);
        return server;
      };
      return server;
    },
    createConnection: options => {
      const socket = new EventEmitter();
      const step = state.step;
      let closed = false;
      let timeout;
      state.sockets += 1;
      record('connect', { options });
      const close = () => {
        if (closed) return;
        closed = true;
        state.sockets -= 1;
        record('socket-close');
        socket.emit('close');
      };
      socket.setTimeout = (duration, callback) => { timeout = callback; record('probe-timeout', { duration }); return socket; };
      socket.destroy = error => { record('socket-destroy', { message: error?.message }); if (error) socket.emit('error', error); close(); };
      queueMicrotask(() => {
        if (step.socketError) {
          socket.emit('error', Object.assign(new Error(step.socketError), { code: step.socketError }));
        } else if (step.kind === 'timeout') {
          state.now += 1500;
          timeout();
        } else {
          let receivedBytes = 0;
          for (const chunk of step.chunks ?? []) {
            const bytes = Buffer.from(chunk);
            receivedBytes += bytes.length;
            record('data', { hex: bytes.toString('hex'), bytes: bytes.length });
            socket.emit('data', bytes);
            if (closed) return;
          }
          record('end', { receivedBytes });
          socket.emit('end');
        }
        close();
      });
      return socket;
    },
  }));
  vi.doMock('node:timers/promises', () => ({
    setTimeout: async duration => { record('retry', { duration }); state.now += duration; },
  }));
  const module = await import('../scripts/inspection-lease.mjs');
  return {
    state,
    defaultDeadline: module.INSPECTION_LEASE_TIMEOUT_MS,
    acquire: async (timeoutMs = 64) => {
      const lease = await module.acquireInspectionLease('fixture waiter', { timeoutMs, onWait: message => record('wait', { message }) });
      state.leases.push(lease);
      record('acquired');
      return lease;
    },
  };
}

afterEach(async () => {
  try {
    await Promise.all(current?.leases.map(lease => lease.release()) ?? []);
    if (current) {
      expect(current.listeners).toBe(0);
      expect(current.sockets).toBe(0);
      expect(current.events.filter(item => item.name === 'server-close')).toHaveLength(current.attempt);
      for (const item of current.events.filter(item => item.name === 'bind')) {
        expect(item.options).toEqual({ host: '127.0.0.1', port: 18796, exclusive: true });
      }
      expect(current.events.filter(item => item.name === 'probe-timeout').every(item => item.duration === 1500)).toBe(true);
      expect(current.events.filter(item => item.name === 'retry').every(item => item.duration === 16)).toBe(true);
    }
  } finally {
    current = undefined;
    vi.restoreAllMocks();
    vi.doUnmock('node:net');
    vi.doUnmock('node:timers/promises');
  }
});

test('empty owner EOF retries an exclusive bind and release remains idempotent', async () => {
  const { state, acquire, defaultDeadline } = await transportFixture([{ kind: 'empty' }, { kind: 'free' }]);
  const lease = await acquire();
  expect(defaultDeadline).toBe(1_800_000);
  expect(state.attempt).toBe(2);
  expect(state.events.filter(item => ['bind', 'end', 'retry', 'bound', 'acquired'].includes(item.name)).map(item => item.name))
    .toEqual(['bind', 'end', 'retry', 'bind', 'bound', 'acquired']);
  expect(state.events.find(item => item.name === 'end').receivedBytes).toBe(0);
  expect(state.events.filter(item => item.name === 'wait')).toHaveLength(0);
  const response = new EventEmitter();
  response.end = body => { response.body = JSON.parse(body); };
  state.respond(response);
  expect(response.body).toMatchObject({ protocol: 'ironsight-gpu-inspection-v1', pid: process.pid, label: 'fixture waiter', port: 18796 });
  const released = lease.release();
  expect(lease.release()).toBe(released);
  await released;
  expect(state.events.filter(item => item.name === 'server-close' && item.wasListening)).toHaveLength(1);
});

test('a validated owner followed by empty EOF can acquire only after the next successful bind', async () => {
  const { state, acquire } = await transportFixture([{ kind: 'valid', chunks: [validOwner.slice(0, 20), validOwner.slice(20)] }, { kind: 'empty' }, { kind: 'free' }]);
  await acquire();
  expect(state.attempt).toBe(3);
  expect(state.events.filter(item => item.name === 'wait')).toHaveLength(1);
  expect(state.events.at(-1).name).toBe('acquired');
  expect(state.events.filter(item => item.name === 'bound')).toHaveLength(1);
});

test('persistent empty responders reach the unchanged deadline without acquiring', async () => {
  const { state, acquire } = await transportFixture([{ kind: 'empty' }]);
  await expect(acquire(32)).rejects.toThrow('GPU inspection lease timed out after 32ms');
  expect(state.attempt).toBe(3);
  expect(state.now).toBe(32);
  expect(state.events.filter(item => ['bound', 'acquired', 'wait'].includes(item.name))).toEqual([]);
});

test('empty EOF followed by a valid occupied owner keeps waiting until an exclusive bind succeeds', async () => {
  const { state, acquire } = await transportFixture([{ kind: 'empty' }, { kind: 'valid', chunks: [validOwner] }, { kind: 'valid', chunks: [validOwner] }, { kind: 'free' }]);
  await acquire();
  expect(state.attempt).toBe(4);
  expect(state.now).toBe(48);
  expect(state.events.filter(item => item.name === 'wait')).toHaveLength(1);
  expect(state.events.filter(item => item.name === 'acquired')).toHaveLength(1);
});

const terminalCases = [
  ['truncated JSON', { kind: 'response', chunks: ['{"protocol":'] }, /Unexpected end of JSON input/],
  ['malformed JSON', { kind: 'response', chunks: ['not-json'] }, /not valid JSON/],
  ['nonempty whitespace', { kind: 'response', chunks: [' \n'] }, /Unexpected end of JSON input/],
  ['foreign protocol', { kind: 'response', chunks: ['{"protocol":"foreign","pid":123}'] }, /Port belongs to another service/],
  ['noninteger PID', { kind: 'response', chunks: ['{"protocol":"ironsight-gpu-inspection-v1","pid":"123"}'] }, /Port belongs to another service/],
  ['oversized response', { kind: 'response', chunks: ['x'.repeat(4097)] }, /Invalid inspection lease response/],
  ['probe timeout', { kind: 'timeout' }, /Inspection lease owner did not identify itself/],
];
for (const [name, response, expected] of terminalCases) {
  test(`after empty EOF, ${name} remains terminal and cannot bypass the owner`, async () => {
    const { state, acquire } = await transportFixture([{ kind: 'empty' }, response, { kind: 'free' }]);
    await expect(acquire()).rejects.toThrow(expected);
    expect(state.attempt).toBe(2);
    expect(state.events.filter(item => item.name === 'retry')).toHaveLength(1);
    expect(state.leases).toHaveLength(0);
  });
}

for (const code of ['ECONNRESET', 'ECONNREFUSED']) {
  test(`${code} retains the existing retry and cleanup behavior`, async () => {
    const { state, acquire } = await transportFixture([{ kind: 'socket-error', socketError: code }, { kind: 'free' }]);
    await acquire();
    expect(state.attempt).toBe(2);
    expect(state.events.filter(item => item.name === 'retry')).toHaveLength(1);
  });
}

test('other transport errors remain terminal', async () => {
  const { state, acquire } = await transportFixture([{ kind: 'socket-error', socketError: 'ECONNABORTED' }, { kind: 'free' }]);
  await expect(acquire()).rejects.toThrow('Cannot acquire GPU inspection port 18796: ECONNABORTED');
  expect(state.attempt).toBe(1);
});

test('non-contention bind errors close their candidate server and fail visibly', async () => {
  const { state, acquire } = await transportFixture([{ kind: 'bind-error', bindError: 'EACCES' }, { kind: 'free' }]);
  await expect(acquire()).rejects.toMatchObject({ code: 'EACCES' });
  expect(state.attempt).toBe(1);
  expect(state.events.filter(item => item.name === 'connect')).toHaveLength(0);
});
