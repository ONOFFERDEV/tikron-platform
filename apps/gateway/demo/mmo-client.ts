import { GameClient } from "@tikron/client";
import { MmoSchema, MAP, HOTBAR, type MmoState, type MmoUnit } from "../src/rooms/mmo-schema.js";

/**
 * MMORPG demo client. Renders the room's synced @tikron/rpg state (players, wolves,
 * boss), and drives it with click-to-move, click-to-attack, and number-key skill
 * casts. Combat feedback (floating damage/heal numbers, XP, deaths) rides the room's
 * batched `combat` developer message — the same `CombatEvent[]` the engine returns
 * each tick — so the client never re-simulates anything; the server owns all truth.
 *
 * Bundled to public/mmo.js by `pnpm --filter @tikron/gateway build:demo`.
 */
type Vec = { x: number; y: number };
type FloatText = { x: number; y: number; text: string; color: string; born: number };

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const hotbarEl = document.getElementById("hotbar")!;

/** World units -> screen pixels. The small RPG map scales up to fill the canvas. */
const SCALE = 6;

const client = new GameClient(location.host, { party: "mmo-room", stateCodec: MmoSchema });

let myId = "";
let state: MmoState = { units: {}, engine: null };
let targetId = "";
const floats: FloatText[] = [];

/** Screen-space -> world-space, with the camera centred on the local player. */
function toWorld(sx: number, sy: number, me: MmoUnit): Vec {
  const rect = canvas.getBoundingClientRect();
  return {
    x: me.x + (sx - rect.left - canvas.width / 2) / SCALE,
    y: me.y + (sy - rect.top - canvas.height / 2) / SCALE,
  };
}

/** The unit under a world point (for click-to-target), preferring hostiles. */
function unitAt(w: Vec): string | undefined {
  let best: string | undefined;
  let bestD = 3; // world-unit pick radius
  for (const [id, u] of Object.entries(state.units)) {
    if (id === myId || !u.alive) continue;
    const d = Math.hypot(u.x - w.x, u.y - w.y);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

async function main() {
  // Reuse this tab's seat after a reload (server holds it 30 s); else matchmake.
  let roomId = new URLSearchParams(location.search).get("room") ?? "demo";
  let sessionId = "";
  const stored = sessionStorage.getItem("tikron-mmo-seat");
  if (stored) {
    ({ roomId, sessionId } = JSON.parse(stored) as { roomId: string; sessionId: string });
  } else {
    try {
      const m = await client.matchmake({ maxClients: 20 });
      roomId = m.roomId;
      sessionId = m.sessionId;
    } catch {
      sessionId = crypto.randomUUID(); // no matchmaker — join a fixed room directly
    }
    sessionStorage.setItem("tikron-mmo-seat", JSON.stringify({ roomId, sessionId }));
  }

  const room = await client.joinOrCreate(roomId, { _session: sessionId });
  myId = room.connectionId ?? "";
  statusEl.textContent = `connected as ${myId.slice(0, 6)} · click to move · click a monster to attack · 1-${HOTBAR.length} to cast`;

  room.onStateChange((s) => {
    state = s as MmoState;
    if (targetId && !state.units[targetId]?.alive) targetId = ""; // drop a dead target
  });

  // The engine's per-tick event batch → floating combat text.
  room.onMessage("combat", (payload) => {
    for (const ev of payload as CombatEventLite[]) {
      if (ev.t === "damaged" && ev.amount > 0) spawnFloat(ev.target, `-${Math.round(ev.amount)}`, "#ff6b6b");
      else if (ev.t === "healed" && ev.amount > 0) spawnFloat(ev.target, `+${Math.round(ev.amount)}`, "#3fb950");
      else if (ev.t === "death") spawnFloat(ev.unit, "DIED", "#e6edf3");
      else if (ev.t === "levelUp") spawnFloat(ev.unit, `LVL ${ev.level}`, "#f2cc60");
      else if (ev.t === "xpGained" && ev.unit === myId) spawnFloat(ev.unit, `+${ev.amount} xp`, "#58a6ff");
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const me = state.units[myId];
    if (!me) return;
    const w = toWorld(e.clientX, e.clientY, me);
    const hit = unitAt(w);
    if (hit) {
      targetId = hit;
      room.send("attack", { unitId: hit }); // auto-attack the clicked monster
    } else {
      room.send("move", { x: Math.max(0, Math.min(MAP, w.x)), y: Math.max(0, Math.min(MAP, w.y)) });
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") {
      room.send("respawn");
      return;
    }
    const i = Number(e.key) - 1;
    if (i < 0 || i >= HOTBAR.length) return;
    const skillId = HOTBAR[i]!;
    // frost-nova is self-centred; heal targets self; the rest need the current target.
    if (skillId === "mage-frost-nova") room.send("cast", { skillId });
    else if (skillId === "healer-heal") room.send("cast", { skillId, target: { unitId: myId } });
    else if (targetId) room.send("cast", { skillId, target: { unitId: targetId } });
  });

  renderHotbar();
  requestAnimationFrame(render);
}

function spawnFloat(unitId: string, text: string, color: string) {
  const u = state.units[unitId];
  if (u) floats.push({ x: u.x, y: u.y, text, color, born: performance.now() });
}

function renderHotbar() {
  hotbarEl.innerHTML = HOTBAR.map(
    (id, i) => `<span class="key"><b>${i + 1}</b> ${id.replace(/^(warrior|mage|healer)-/, "")}</span>`,
  ).join("");
}

function render() {
  const me = state.units[myId];
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (me) {
    const camX = me.x - canvas.width / 2 / SCALE;
    const camY = me.y - canvas.height / 2 / SCALE;

    // Map bounds.
    ctx.strokeStyle = "#30363d";
    ctx.strokeRect((0 - camX) * SCALE, (0 - camY) * SCALE, MAP * SCALE, MAP * SCALE);

    for (const [id, u] of Object.entries(state.units)) {
      const sx = (u.x - camX) * SCALE;
      const sy = (u.y - camY) * SCALE;
      drawUnit(id, u, sx, sy);
    }

    // Floating combat text (rises + fades over ~1s).
    const now = performance.now();
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]!;
      const age = (now - f.born) / 1000;
      if (age > 1) {
        floats.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = f.color;
      ctx.font = "bold 14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.text, (f.x - camX) * SCALE, (f.y - camY) * SCALE - 24 - age * 24);
      ctx.globalAlpha = 1;
    }

    if (!me.alive) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#e6edf3";
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("You died — press R to respawn", canvas.width / 2, canvas.height / 2);
    }
  } else {
    ctx.fillStyle = "#8b949e";
    ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("connecting…", canvas.width / 2, canvas.height / 2);
  }

  requestAnimationFrame(render);
}

function drawUnit(id: string, u: MmoUnit, sx: number, sy: number) {
  const radius = u.kind === "boss" ? 14 : u.kind === "wolf" ? 8 : 10;
  const color = id === myId ? "#3fb950" : u.kind === "player" ? "#58a6ff" : u.kind === "boss" ? "#d29922" : "#f85149";

  ctx.globalAlpha = u.alive ? 1 : 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.strokeStyle = "#0d1117";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + Math.cos(u.facing) * radius, sy + Math.sin(u.facing) * radius);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (id === targetId) {
    ctx.strokeStyle = "#f2cc60";
    ctx.beginPath();
    ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HP bar (and MP for players).
  bar(sx - radius, sy - radius - 8, radius * 2, 3, u.hp / Math.max(1, u.maxHp), "#f85149");
  if (u.kind === "player" && u.maxMp > 0) bar(sx - radius, sy - radius - 4, radius * 2, 2, u.mp / u.maxMp, "#58a6ff");

  ctx.fillStyle = "#e6edf3";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";
  const label = u.kind === "player" ? (id === myId ? "you" : "player") : u.kind;
  ctx.fillText(`${label} L${u.level}`, sx, sy - radius - 12);
  if (u.cast) ctx.fillText("casting…", sx, sy + radius + 12);
}

function bar(x: number, y: number, w: number, h: number, pct: number, color: string) {
  ctx.fillStyle = "#161b22";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
}

/**
 * The subset of engine CombatEvent variants the client renders (typed locally to avoid
 * a server import). The room's `combat` batch also carries other event types; the cast
 * treats them as this union and the `t` guards below simply never match them.
 */
type CombatEventLite =
  | { t: "damaged"; target: string; amount: number }
  | { t: "healed"; target: string; amount: number }
  | { t: "death"; unit: string }
  | { t: "levelUp"; unit: string; level: number }
  | { t: "xpGained"; unit: string; amount: number };

void main();
