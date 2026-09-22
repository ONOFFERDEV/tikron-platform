import { randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JournalError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'JournalError'; this.code = code; }
}

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx');
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temporary, path);
}

export async function readJson(path, missingValue) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return missingValue;
    throw error;
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false;
    if (error instanceof Error && 'code' in error && error.code === 'EPERM') return true;
    return null;
  }
}

async function createOwnedFile(path, record) {
  const candidate = `${path}.${process.pid}.${record.token}.candidate`;
  const handle = await open(candidate, 'wx');
  try { await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
  try { await link(candidate, path); return true; }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return false;
    throw error;
  } finally { await unlink(candidate); }
}

async function ownerAt(path) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return typeof value === 'object' && value !== null && Number.isInteger(value.pid) && typeof value.token === 'string' ? value : null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    return null;
  }
}

async function releaseOwned(path, token) {
  const owner = await ownerAt(path);
  if (owner?.token === token) await unlink(path);
}

async function recoverDeadOwner(lockPath, repair) {
  const recoveryPath = `${lockPath}.recovery`;
  const recovery = { pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() };
  if (!await createOwnedFile(recoveryPath, recovery)) return false;
  try {
    const owner = await ownerAt(lockPath);
    if (!owner || processIsAlive(owner.pid) !== false) return false;
    await repair(owner);
    const unchanged = await ownerAt(lockPath);
    if (unchanged?.token !== owner.token) throw new JournalError('lock_owner_changed');
    await unlink(lockPath);
    return true;
  } finally { await releaseOwned(recoveryPath, recovery.token); }
}

export async function withJournalLock(journalPath, repair, action) {
  const lockPath = `${journalPath}.lock`;
  await mkdir(dirname(journalPath), { recursive: true });
  const owner = { pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const recoveryOwner = await ownerAt(`${lockPath}.recovery`);
    if (recoveryOwner) {
      if (processIsAlive(recoveryOwner.pid) === false) await releaseOwned(`${lockPath}.recovery`, recoveryOwner.token);
      else await delay(25);
      continue;
    }
    if (await createOwnedFile(lockPath, owner)) {
      while (await ownerAt(`${lockPath}.recovery`)) await delay(10);
      try { return await action(); }
      finally { await releaseOwned(lockPath, owner.token); }
    }
    const current = await ownerAt(lockPath);
    if (current && processIsAlive(current.pid) === false && await recoverDeadOwner(lockPath, repair)) continue;
    await delay(25);
  }
  throw new JournalError('budget_lock_busy', lockPath);
}
