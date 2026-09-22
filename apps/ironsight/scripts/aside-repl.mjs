import { spawn, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ANSI = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripAnsi(value) {
  return value.replace(ANSI, '').replace(/\r/g, '');
}

export function normalizeReplCode(value) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export class ReplProtocolBuffer {
  constructor() {
    this.buffer = '';
  }

  push(chunk) {
    this.buffer += stripAnsi(String(chunk));
    const match = /(?:^|\n)repl >\s*$/.exec(this.buffer);
    if (!match) return null;
    const frame = this.buffer.slice(0, match.index).trim();
    this.buffer = '';
    return frame;
  }

  hasError(frame) {
    return /(?:^|\n)\[error \||(?:^|\n)(?:Error|TypeError|ReferenceError):/.test(frame);
  }
}

async function isFile(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverAsideExecutable(environment = process.env) {
  const candidates = [];
  if (environment.ASIDE_CLI) candidates.push(environment.ASIDE_CLI);
  if (process.platform === 'win32') {
    const local = environment.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    candidates.push(path.join(local, 'Aside', 'CLI', 'current', 'aside.exe'));
  } else {
    candidates.push('/usr/local/bin/aside', path.join(os.homedir(), '.local', 'bin', 'aside'));
  }
  for (const candidate of candidates) if (await isFile(candidate)) return candidate;
  const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['aside'], { encoding: 'utf8' });
  const discovered = lookup.status === 0 ? lookup.stdout.split(/\r?\n/).find(Boolean) : null;
  if (discovered && await isFile(discovered)) return discovered;
  throw new Error('Aside CLI executable not found');
}

export class PersistentAsideRepl {
  constructor(options = {}) {
    this.executable = options.executable;
    this.account = options.account;
    this.host = options.host;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.child = null;
    this.protocol = new ReplProtocolBuffer();
    this.pending = null;
    this.queue = Promise.resolve();
    this.sessionDir = null;
    this.transcript = [];
    this.poisonError = null;
  }

  isUsable() {
    return this.child !== null && this.child.exitCode === null && this.poisonError === null;
  }

  async start() {
    if (this.child) throw new Error('Aside REPL already started');
    const executable = this.executable ?? await discoverAsideExecutable();
    const args = ['repl'];
    if (this.account) args.push('--account', this.account);
    if (this.host) args.push('--host', this.host);
    this.child = this.spawnProcess(executable, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.child.stdout.on('data', chunk => this.#accept(chunk));
    this.child.stderr.on('data', chunk => this.#accept(chunk));
    this.child.once('exit', (code, signal) => {
      const error = new Error(`Aside REPL exited before response: code=${code} signal=${signal}`);
      const pending = this.pending;
      this.pending = null;
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
    });
    const startup = await this.#waitForFrame(this.timeoutMs);
    this.sessionDir = /sessionDir:\s*([^\n]+)/.exec(startup)?.[1]?.trim() ?? null;
    if (!this.sessionDir) throw new Error('Aside REPL did not report sessionDir');
    return { executable, sessionDir: this.sessionDir, startup };
  }

  run(code, options = {}) {
    const operation = this.queue.then(async () => {
      if (this.poisonError) throw new Error(`Aside REPL session is poisoned after timeout: ${this.poisonError.message}`, { cause: this.poisonError });
      if (!this.child || this.child.exitCode !== null) throw new Error('Aside REPL session is not alive');
      const normalized = normalizeReplCode(code);
      this.child.stdin.write(`${normalized}\n`);
      const frame = await this.#waitForFrame(options.timeoutMs ?? this.timeoutMs, true);
      this.transcript.push({ code: normalized, frame, at: new Date().toISOString() });
      if (this.protocol.hasError(frame) && !options.allowError) throw new Error(`Aside REPL command failed:\n${frame}`);
      return frame;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async close() {
    if (!this.child) return;
    const child = this.child;
    this.child = null;
    if (child.exitCode === null && !this.poisonError) {
      child.stdin.write('exit\n');
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 3_000)),
      ]);
      if (child.exitCode === null) child.kill();
    } else if (child.exitCode === null) {
      child.kill();
    }
  }

  #accept(chunk) {
    const frame = this.protocol.push(chunk);
    if (frame === null || !this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve(frame);
  }

  #waitForFrame(timeoutMs, poisonOnTimeout = false) {
    if (this.pending) return Promise.reject(new Error('Aside REPL command overlap'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.timer === timer) this.pending = null;
        const error = new Error(`Aside REPL timed out after ${timeoutMs}ms`);
        if (poisonOnTimeout) {
          this.poisonError = error;
          if (this.child?.exitCode === null) this.child.kill();
        }
        reject(error);
      }, timeoutMs);
      this.pending = { resolve, reject, timer };
    });
  }
}
