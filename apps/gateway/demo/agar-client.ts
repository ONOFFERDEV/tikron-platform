import { GameClient, InputPredictor, SnapshotBuffer } from "@playedge/client";
import { AgarSchema, AGAR, type AgarState } from "../src/rooms/agar-schema.js";

/**
 * Flagship .io demo client. Shows the full SDK usage: binary state decode,
 * client-side prediction for the local player (zero-latency movement), server
 * reconciliation, and entity interpolation for everyone else.
 *
 * Bundled to public/agar.js by `pnpm --filter @playedge/gateway build:demo`.
 */
type Vec = { x: number; y: number };

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;

const roomName = new URLSearchParams(location.search).get("room") ?? "demo";
const client = new GameClient(location.host, { party: "agar-room", stateCodec: AgarSchema });

// The "input" for prediction is simply the next target position; applying it
// replaces the predicted position (the server uses the same movement model).
const predictor = new InputPredictor<Vec, Vec>({ x: 100, y: 100 }, { apply: (_s, i) => ({ ...i }) });
const buffer = new SnapshotBuffer<AgarState>({ delayMs: 100, lerp: lerpState });

let myId = "";
let seq = 0;
const mouse: Vec = { x: 0, y: 0 };
const perTick = (AGAR.maxSpeed * AGAR.stepMs) / 1000; // max distance per input

function lerpState(a: AgarState, b: AgarState, t: number): AgarState {
  const players: AgarState["players"] = {};
  for (const id of Object.keys(b.players)) {
    const pb = b.players[id]!;
    const pa = a.players[id];
    players[id] = pa
      ? { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, score: pb.score }
      : pb;
  }
  return { players, orbs: b.orbs };
}

async function main() {
  // Reuse this tab's seat after a reload (the server holds it for 30s); else
  // matchmake into a room (falling back to a fixed room id if the API is absent).
  let roomId = roomName;
  let sessionId = "";
  const stored = sessionStorage.getItem("playedge-seat");
  if (stored) {
    ({ roomId, sessionId } = JSON.parse(stored) as { roomId: string; sessionId: string });
  } else {
    try {
      const m = await client.matchmake({ mode: "ffa", maxClients: 20 });
      roomId = m.roomId;
      sessionId = m.sessionId;
    } catch {
      /* no matchmaker reachable — join a fixed room directly */
      sessionId = crypto.randomUUID();
    }
    sessionStorage.setItem("playedge-seat", JSON.stringify({ roomId, sessionId }));
  }

  const room = await client.joinOrCreate(roomId, { _session: sessionId });
  myId = room.connectionId ?? "";
  statusEl.textContent = `connected as ${myId.slice(0, 6)} · move with the mouse`;

  room.onMessage((msg) => {
    if (msg.t === "s:welcome" && (msg as { reconnected?: boolean }).reconnected) {
      statusEl.textContent = `reconnected as ${myId.slice(0, 6)} · seat preserved`;
    }
  });

  room.onStateChange((s) => {
    const st = s as AgarState;
    buffer.push(performance.now(), st);
    const me = st.players[myId];
    if (me) predictor.reconcile({ x: me.x, y: me.y }, room.lastAckSeq);
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    // Screen -> world: camera is centered on the local player.
    mouse.x = predictor.predicted.x + (e.clientX - rect.left - canvas.width / 2);
    mouse.y = predictor.predicted.y + (e.clientY - rect.top - canvas.height / 2);
  });

  // Send inputs at the tick rate; predict locally for instant feedback.
  setInterval(() => {
    const p = predictor.predicted;
    const dx = mouse.x - p.x;
    const dy = mouse.y - p.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, perTick);
    const next: Vec =
      dist > 0.001
        ? { x: clamp(p.x + (dx / dist) * step, 0, AGAR.world), y: clamp(p.y + (dy / dist) * step, 0, AGAR.world) }
        : p;
    seq += 1;
    room.send("move", next, seq);
    predictor.predict(seq, next);
  }, AGAR.stepMs);

  requestAnimationFrame(render);

  // Poll the public leaderboard (board "agar-top") and render the top 10. Keyless
  // read → the demo project in production, the "dev" scope locally.
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
    const res = await fetch("/api/leaderboard?board=agar-top&limit=10");
    if (!res.ok) return;
    const rows = (await res.json()) as LeaderRow[];
    const items = rows
      .map((r) => `<li>${escapeHtml(r.displayName ?? r.playerId.slice(0, 6))} — ${r.score}</li>`)
      .join("");
    lbEl.innerHTML = `<b>agar-top</b><ol>${items}</ol>`;
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
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camX = me.x - canvas.width / 2;
  const camY = me.y - canvas.height / 2;

  const view = buffer.sample(performance.now());
  if (view) {
    ctx.fillStyle = "#f2cc60";
    for (const id of Object.keys(view.orbs)) {
      const o = view.orbs[id]!;
      circle(o.x - camX, o.y - camY, 6);
    }
    for (const id of Object.keys(view.players)) {
      if (id === myId) continue;
      const pl = view.players[id]!;
      ctx.fillStyle = "#58a6ff";
      circle(pl.x - camX, pl.y - camY, 14);
      label(`${pl.score}`, pl.x - camX, pl.y - camY - 20);
    }
  }

  // Local player (predicted -> zero latency).
  const myScore = view?.players[myId]?.score ?? 0;
  ctx.fillStyle = "#3fb950";
  circle(me.x - camX, me.y - camY, 14);
  label(`you: ${myScore}`, me.x - camX, me.y - camY - 20);

  requestAnimationFrame(render);
}

function circle(x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
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
