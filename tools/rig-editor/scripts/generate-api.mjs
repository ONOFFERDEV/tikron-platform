// scripts/generate-api.mjs — the M3 Generate panel's backend: POST /api/generate,
// GET /api/generate/:id/events (SSE), GET /api/generate/:id/result.glb.
//
// Runs unirig_pipeline.sh on the Rocky box over ssh. NEVER shell:true and NEVER a
// hand-built single command string locally — spawn always gets a plain argv array.
// The one place a string genuinely gets shell-interpreted is on the REMOTE end:
// ssh forwards argv[1] (the whole remote command) to the remote user's bash for
// parsing, so THAT string is built with POSIX single-quote escaping (shQuote) as
// if we were typing it into a real shell — prompt/name are also restricted to a
// tight whitelist first (defense in depth: even a quoting bug couldn't smuggle a
// shell metacharacter through, since none of the allowed characters are one).
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";

const CACHE_DIR = path.resolve("./.cache");
const SSH_HOST = "onofferserver";
const TIMEOUT_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 10_000;

const PROMPT_RE = /^[A-Za-z0-9 ,.'-]{1,200}$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SEED_RE = /^[0-9]{1,10}$/;
const BACKENDS = new Set(["hunyuan", "trellis"]);

/** @type {{ id: string, name: string, lines: string[], subscribers: Set<import("node:http").ServerResponse>, status: "running"|"done"|"error", resultPath?: string } | null} */
let currentJob = null;

function shQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastLine(job, line) {
  job.lines.push(line);
  for (const res of job.subscribers) sendSse(res, "log", line);
}

function finishJob(job, payload) {
  job.status = payload.success ? "done" : "error";
  for (const res of job.subscribers) {
    sendSse(res, "done", payload);
    res.end();
  }
  job.subscribers.clear();
}

function validateBody(body) {
  if (typeof body.prompt !== "string" || !PROMPT_RE.test(body.prompt)) {
    return "prompt must be 1-200 chars matching [A-Za-z0-9 ,.'-]";
  }
  if (typeof body.name !== "string" || !NAME_RE.test(body.name)) {
    return "name must match [a-z0-9][a-z0-9-]{0,39} (start with a letter/digit)";
  }
  if (body.seed !== undefined && body.seed !== null && body.seed !== "") {
    if (typeof body.seed !== "string" && typeof body.seed !== "number") return "seed must be numeric";
    if (!SEED_RE.test(String(body.seed))) return "seed must be a positive integer (up to 10 digits)";
  }
  if (typeof body.backend !== "string" || !BACKENDS.has(body.backend)) {
    return "backend must be 'hunyuan' or 'trellis'";
  }
  if (body.gameSlim !== undefined && typeof body.gameSlim !== "boolean") {
    return "gameSlim must be a boolean";
  }
  return null;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function buildRemoteCommand(body) {
  let cmd = `bash ~/assetgen/unirig_pipeline.sh ${shQuote(body.prompt)} ${shQuote(body.name)}`;
  if (body.seed !== undefined && body.seed !== null && body.seed !== "") {
    cmd += ` ${shQuote(String(body.seed))}`;
  }
  if (body.gameSlim) cmd += " --game-slim";
  cmd += ` --backend ${body.backend}`; // body.backend is restricted to a fixed enum by validateBody — safe as a bare token
  return cmd;
}

async function runJob(job, body) {
  const remoteCmd = buildRemoteCommand(body);
  broadcastLine(job, `[rig-editor] ssh ${SSH_HOST} — starting pipeline for "${body.name}" (backend=${body.backend})`);

  const child = spawn("ssh", [SSH_HOST, remoteCmd], { shell: false });

  const onOutput = (buf) => {
    for (const line of buf.toString("utf8").split(/\r?\n/)) {
      if (line.length) broadcastLine(job, line);
    }
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);

  const timeoutHandle = setTimeout(() => {
    broadcastLine(job, "[rig-editor] TIMEOUT after 10 minutes — killing remote job");
    child.kill();
  }, TIMEOUT_MS);

  const code = await new Promise((resolve) => child.on("close", resolve));
  clearTimeout(timeoutHandle);

  if (code !== 0) {
    finishJob(job, { success: false, error: `pipeline exited with code ${code}` });
    return;
  }

  broadcastLine(job, "[rig-editor] pipeline succeeded — fetching result.glb via scp...");
  await mkdir(CACHE_DIR, { recursive: true });
  const localPath = path.join(CACHE_DIR, `${body.name}.glb`);
  const scpCode = await new Promise((resolve) => {
    const scp = spawn("scp", [`${SSH_HOST}:~/unirig/poc_out/${body.name}/rigged-animated.glb`, localPath], { shell: false });
    scp.stdout.on("data", onOutput);
    scp.stderr.on("data", onOutput);
    scp.on("close", resolve);
  });

  if (scpCode !== 0 || !existsSync(localPath)) {
    finishJob(job, { success: false, error: "scp fetch of result.glb failed" });
    return;
  }

  job.resultPath = localPath;
  broadcastLine(job, "[rig-editor] done");
  finishJob(job, { success: true, jobId: job.id });
}

async function handlePost(req, res) {
  if (currentJob && currentJob.status === "running") {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "a generation job is already running", jobId: currentJob.id }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `invalid request body: ${err instanceof Error ? err.message : String(err)}` }));
    return;
  }

  const validationError = validateBody(body);
  if (validationError) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: validationError }));
    return;
  }

  const job = { id: randomUUID(), name: body.name, lines: [], subscribers: new Set(), status: "running", resultPath: undefined };
  currentJob = job;

  res.writeHead(202, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jobId: job.id }));

  runJob(job, body).catch((err) => {
    broadcastLine(job, `[rig-editor] internal error: ${err instanceof Error ? err.message : String(err)}`);
    finishJob(job, { success: false, error: String(err) });
  });
}

function handleEvents(req, res, jobId) {
  if (!currentJob || currentJob.id !== jobId) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unknown jobId" }));
    return;
  }
  const job = currentJob;
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  for (const line of job.lines) sendSse(res, "log", line);
  if (job.status !== "running") {
    sendSse(res, "done", { success: job.status === "done", jobId: job.id });
    res.end();
    return;
  }
  job.subscribers.add(res);
  req.on("close", () => job.subscribers.delete(res));
}

function handleResult(req, res, jobId) {
  if (!currentJob || currentJob.id !== jobId || currentJob.status !== "done" || !currentJob.resultPath) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "no completed result for this jobId" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "model/gltf-binary" });
  createReadStream(currentJob.resultPath).pipe(res);
}

/** True if `pathname`/`method` is one of this module's routes (checked before
 *  reading the request body, so dev.mjs can proxy everything else untouched). */
export function isGenerateApiRoute(pathname, method) {
  if (method === "POST" && pathname === "/api/generate") return true;
  if (method === "GET" && /^\/api\/generate\/[^/]+\/events$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/generate\/[^/]+\/result\.glb$/.test(pathname)) return true;
  return false;
}

/** Dispatches an already-route-matched request (see isGenerateApiRoute). */
export function handleGenerateApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/generate") return handlePost(req, res);
  const eventsMatch = url.pathname.match(/^\/api\/generate\/([^/]+)\/events$/);
  if (eventsMatch) return handleEvents(req, res, eventsMatch[1]);
  const resultMatch = url.pathname.match(/^\/api\/generate\/([^/]+)\/result\.glb$/);
  if (resultMatch) return handleResult(req, res, resultMatch[1]);
}
