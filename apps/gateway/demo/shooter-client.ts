import { GameClient, InputPredictor, SnapshotBuffer } from "@tikron/client";
import { stepToward } from "@tikron/sim";
import { ShooterSchema, SHOOTER, type ShooterState } from "../src/rooms/shooter-schema.js";

/**
 * FPS proof-of-concept client. Shows the full FPS-grade SDK usage: **subtick input
 * timestamps** (each `send` is stamped with its server-clock time) so the room can
 * rewind lag compensation to the exact shot instant, **input batching** (one WS
 * frame per ~tick to stay under the Durable Object inbound rate), client-side
 * prediction for the local player, server reconciliation, and interpolation for
 * everyone else. WASD to move, mouse to aim, click to shoot.
 *
 * Bundled to public/shooter.js by `pnpm --filter @tikron/gateway build:demo`.
 */
type Vec = { x: number; y: number };

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;

const roomName = new URLSearchParams(location.search).get("room") ?? "demo";
const client = new GameClient(location.host, {
  party: "shooter-room",
  stateCodec: ShooterSchema,
  // FPS-grade netcode: stamp inputs with a subtick server-clock time (rewind pins
  // the hitscan to the exact shot instant) and coalesce inputs into ~one frame/tick.
  subtickTimestamps: true,
  inputBatchMs: 33,
});

// Prediction input = the next target position; applying it replaces the predicted
// position (the server validates the same movement model).
const predictor = new InputPredictor<Vec, Vec>({ x: 1000, y: 1000 }, { apply: (_s, i) => ({ ...i }) });
const buffer = new SnapshotBuffer<ShooterState>({ delayMs: 100, lerp: lerpState });

let myId = "";
let seq = 0;
let aim = 0; // radians, player -> mouse
const mouse: Vec = { x: canvas.width / 2, y: canvas.height / 2 };
const keys = new Set<string>();
/** Live tracers to draw for a few frames after a `shot` event. */
const tracers: { ox: number; oy: number; tx: number; ty: number; hit: boolean; until: number }[] = [];
/** Sample the interpolation buffer on the server's clock (set once connected). */
let sampleServerNow: () => number = () => performance.now();

function lerpState(a: ShooterState, b: ShooterState, t: number): ShooterState {
  const players: ShooterState["players"] = {};
  for (const id of Object.keys(b.players)) {
    const pb = b.players[id]!;
    const pa = a.players[id];
    players[id] = pa
      ? { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, aim: pb.aim, hp: pb.hp, score: pb.score, alive: pb.alive }
      : pb;
  }
  return { players };
}

async function main() {
  let roomId = roomName;
  let sessionId = "";
  const stored = sessionStorage.getItem("tikron-shooter-seat");
  if (stored) {
    ({ roomId, sessionId } = JSON.parse(stored) as { roomId: string; sessionId: string });
  } else {
    try {
      const m = await client.matchmake({ mode: "ffa", maxClients: 20 });
      roomId = m.roomId;
      sessionId = m.sessionId;
    } catch {
      sessionId = crypto.randomUUID();
    }
    sessionStorage.setItem("tikron-shooter-seat", JSON.stringify({ roomId, sessionId }));
  }

  const room = await client.joinOrCreate(roomId, { _session: sessionId });
  myId = room.connectionId ?? "";
  statusEl.textContent = `connected as ${myId.slice(0, 6)} · WASD move · mouse aim · click shoot`;
  sampleServerNow = () => room.clock.serverNow();

  room.onMessage((msg) => {
    if (msg.t === "s:welcome" && (msg as { reconnected?: boolean }).reconnected) {
      statusEl.textContent = `reconnected as ${myId.slice(0, 6)} · seat preserved`;
    }
  });

  room.onStateChange((s) => {
    const st = s as ShooterState;
    buffer.push(room.lastStateServerTime ?? performance.now(), st);
    const me = st.players[myId];
    if (me) predictor.reconcile({ x: me.x, y: me.y }, room.lastAckSeq);
  });

  // Server-broadcast shots — draw a tracer for ~120 ms (green on a connect).
  room.onMessage("shot", (payload) => {
    const p = payload as { ox: number; oy: number; dir: number; hitId?: string };
    tracers.push({
      ox: p.ox,
      oy: p.oy,
      tx: p.ox + Math.cos(p.dir) * SHOOTER.shotRange,
      ty: p.oy + Math.sin(p.dir) * SHOOTER.shotRange,
      hit: p.hitId !== undefined,
      until: performance.now() + 120,
    });
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener("mousedown", () => {
    // Client stamps the subtick ts automatically (subtickTimestamps: true).
    room.send("shoot", { dir: aim });
  });
  addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // Input loop at the tick rate: integrate the WASD velocity into the predicted
  // position, update aim, predict locally, and send one authoritative `move`.
  setInterval(() => {
    let vx = 0;
    let vy = 0;
    if (keys.has("w")) vy -= 1;
    if (keys.has("s")) vy += 1;
    if (keys.has("a")) vx -= 1;
    if (keys.has("d")) vx += 1;
    const len = Math.hypot(vx, vy) || 1;
    const desired: Vec = {
      x: predictor.predicted.x + (vx / len) * SHOOTER.maxSpeed * (SHOOTER.stepMs / 1000),
      y: predictor.predicted.y + (vy / len) * SHOOTER.maxSpeed * (SHOOTER.stepMs / 1000),
    };
    const stepped = vx === 0 && vy === 0 ? predictor.predicted : stepToward(predictor.predicted, desired, SHOOTER.maxSpeed, SHOOTER.stepMs);
    const next: Vec = { x: clamp(stepped.x, 0, SHOOTER.world), y: clamp(stepped.y, 0, SHOOTER.world) };
    // Aim points from the (screen-centered) local player toward the mouse.
    aim = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
    seq += 1;
    room.send("move", { x: next.x, y: next.y, aim });
    predictor.predict(seq, next);
  }, SHOOTER.stepMs);

  requestAnimationFrame(render);
  void refreshLeaderboard();
  setInterval(() => void refreshLeaderboard(), 5000);
}

interface LeaderRow {
  rank: number;
  playerId: string;
  displayName: string | null;
  score: number;
}

const lbEl = document.getElementById("lb");

async function refreshLeaderboard() {
  if (!lbEl) return;
  try {
    const res = await fetch("/api/leaderboard?board=shooter-top&limit=10");
    if (!res.ok) return;
    const rows = (await res.json()) as LeaderRow[];
    const items = rows
      .map((r) => `<li>${escapeHtml(r.displayName ?? r.playerId.slice(0, 6))} — ${r.score}</li>`)
      .join("");
    lbEl.innerHTML = `<b>shooter-top</b><ol>${items}</ol>`;
  } catch {
    /* leaderboard is best-effort; ignore transient fetch errors */
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function render() {
  const me = predictor.predicted;
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camX = me.x - canvas.width / 2;
  const camY = me.y - canvas.height / 2;

  // Tracers first (under the players), fading as they expire.
  const now = performance.now();
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i]!;
    if (tr.until <= now) {
      tracers.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = tr.hit ? "#00e5a0" : "rgba(230,237,243,0.35)";
    ctx.lineWidth = tr.hit ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(tr.ox - camX, tr.oy - camY);
    ctx.lineTo(tr.tx - camX, tr.ty - camY);
    ctx.stroke();
  }

  const view = buffer.sample(sampleServerNow());
  if (view) {
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id]!;
      drawPlayer(pl, pl.x - camX, pl.y - camY, "#58a6ff");
    }
  }

  // Local player (predicted -> zero latency).
  const meState = view?.players[myId];
  drawPlayer(
    { aim, hp: meState?.hp ?? SHOOTER.maxHp, score: meState?.score ?? 0, alive: meState?.alive ?? true },
    me.x - camX,
    me.y - camY,
    "#00e5a0",
  );

  requestAnimationFrame(render);
}

function drawPlayer(
  p: { aim: number; hp: number; score: number; alive: boolean },
  x: number,
  y: number,
  color: string,
): void {
  if (!p.alive) {
    ctx.strokeStyle = "rgba(230,237,243,0.25)";
    circle(x, y, 12, false);
    return;
  }
  ctx.fillStyle = color;
  circle(x, y, 12, true);
  // Aim direction.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(p.aim) * 20, y + Math.sin(p.aim) * 20);
  ctx.stroke();
  // HP bar.
  const w = 26;
  ctx.fillStyle = "rgba(16,21,29,0.9)";
  ctx.fillRect(x - w / 2, y - 22, w, 4);
  ctx.fillStyle = "#00e5a0";
  ctx.fillRect(x - w / 2, y - 22, (w * Math.max(0, p.hp)) / SHOOTER.maxHp, 4);
  label(`${p.score}`, x, y + 26);
}

function circle(x: number, y: number, r: number, fill: boolean) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
}
function label(text: string, x: number, y: number) {
  ctx.fillStyle = "#e6edf3";
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

void main();
