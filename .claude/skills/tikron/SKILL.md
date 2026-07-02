---
name: tikron
description: Use when building or modifying a multiplayer game or room on Tikron (server-authoritative realtime BaaS on Cloudflare Workers + Durable Objects; the @tikron/* SDK, Room classes, onMessage handlers, matchmaking, deploy via wrangler). Triggers on tasks that add/change a Room subclass, room state, message handlers, ticks, AOI, binary sync, reconnection, or deploying a Tikron game.
---

# Building on Tikron

Server-authoritative multiplayer for web games — open source, self-hosted on **your own
Cloudflare account** (one Durable Object per room at the edge, no lock-in). You author a
`Room<TState>` subclass. Read [`AGENTS.md`](../../../AGENTS.md) first (the operational
brief; includes a **Limits & roadmap** section) and [`docs/PERF.md`](../../../docs/PERF.md)
for measured limits. Do not duplicate their numbers — cite them.

## 1. Pick a preset

Match the genre, then override handlers (`packages/server/src/presets.ts` has the
full decision table):

- **`TurnBasedRoom`** — players act in alternating turns (board/card/quiz/word). Core
  only: JSON sync on mutation, no tick. Implement `onCreate`, `onJoin`, `onLeave`.
- **`CasualRealtimeRoom`** — free movement but NO physics tick (cursors, whiteboards,
  party games). Throttled ~20 Hz JSON sync + built-in 30 s reconnection window.
  Implement `onCreate`, `onJoin`, `onSeatExpired` (never write the reconnection
  try/catch yourself).
- **`IoArenaRoom`** — fixed-timestep simulation (`.io` arenas, shooters, racers).
  Tick (`onTick`) + binary delta `stateCodec` + input acks + optional per-viewer AOI
  (anti-wallhack) + built-in reconnection. Implement the codec, `onTick`,
  `onSeatExpired`.

A preset is a thin `Room` subclass — dropping to the raw core is always possible. Copy
[`examples/starter/src/arena-room.ts`](../../../examples/starter/src/arena-room.ts)
(`CasualRealtimeRoom`) as a working reference; `apps/gateway`'s `AgarRoom` shows
`IoArenaRoom` with AOI.

## 2. Author the room (checklist)

Work in one file (the room). In order:

1. **State shape** — define `interface TState` (plain, structured-clone-able). Set it
   in `onCreate` via `this.setState({...})`.
2. **`onMessage(type, handler)` per intent** — register in `onCreate`. In each handler:
   `payload` is `unknown` → **type-guard and range-check it**, act on the *server's*
   view of the player (never the client's claim), mutate `this.state`, then call
   `this.markStateChanged()`.
3. **Lifecycle hooks** — `onJoin(client)` adds the player to state; `onLeave(client)`
   removes it (wrap in `allowReconnection` for a grace window); `onReconnect(client)`
   for re-attach; `onDispose` for teardown.
4. **Realtime only** — in `onCreate`, `this.setSimulationInterval(fn, 50)` for a 20 Hz
   tick; set `this.stateCodec` for binary delta; `this.enableAOI({...})` for interest
   management (requires a codec). Set `this.sendAcks = true` and `this.maxClients` for
   capped competitive rooms.

Hard rules (full list in AGENTS.md): server owns state / clients send intents;
validate every payload; `markStateChanged()` after every mutation; party name is the
kebab-case of the DO binding (`ArenaRoom` → `arena-room`); don't lower `syncIntervalMs`
(50 ms) without reading the flush-throttle rationale in PERF.md.

## 3. Verify locally (loop until green)

```bash
pnpm install
pnpm --filter <project> typecheck          # e.g. tikron-starter
pnpm --filter <project> dev                # http://127.0.0.1:8787 — open 2 tabs
```

**Prefer the harness for logic tests.** Unit-test room logic in-process with
`@tikron/server/testing` — no Durable Object, no WebSocket, no network. It's faster and
more precise than a WS script for asserting game rules:

```ts
import { createTestRoom } from "@tikron/server/testing";
import { MyRoom } from "./my-room.js";

const h = await createTestRoom(MyRoom);
const a = await h.connect("a");
await a.send("move", { x: 1, y: 2 });
await h.flush();
expect(h.snapshot().players.a).toEqual({ x: 1, y: 2 });
// binary rooms: createTestRoom(MyRoom, { codec }) + a.binaryFrames() / a.lastState()
// time-based (reconnection windows/heartbeats): vi.useFakeTimers() + await h.advance(ms)
```

Full harness + network-simulator API: AGENTS.md → "Test your room".

**As the integration check**, smoke-test a room over a real WebSocket without a browser
(Node 22+ has a global `WebSocket`; no deps). Adjust the party (kebab-case binding) and
intent type:

```js
// smoke.mjs — node smoke.mjs   (run `dev` first)
import { randomUUID } from "node:crypto";
const party = "arena-room";                 // kebab-case of the DO binding
const url = `ws://127.0.0.1:8787/parties/${party}/smoke?_session=${randomUUID()}`;
const ws = new WebSocket(url);
ws.binaryType = "arraybuffer";              // required for binary state frames
ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ t: "c:msg", type: "move", seq: 1, payload: { x: 0.5, y: 0.5 } }));
});
ws.addEventListener("message", (e) => {
  if (typeof e.data === "string") console.log("recv", e.data);   // s:welcome, s:state, ...
  else console.log("recv binary", new Uint8Array(e.data)[0]);    // 0x01 full / 0x02 delta
});
setTimeout(() => { ws.close(); process.exit(0); }, 1500);
```

Expect an `s:welcome` frame, then `s:state` (JSON) or a binary state frame. No frame /
a 404 usually means the party name doesn't match the DO binding's kebab-case.

## 4. Deploy

```bash
pnpm exec wrangler login                    # once, opens a browser (free tier works)
pnpm --filter <project> deploy              # prints https://<name>.<account>.workers.dev
```

Rename the deploy target via `name` in the project's `wrangler.jsonc`. Open the URL on
two devices to confirm. Never benchmark multi-room capacity on local `wrangler dev`
(one process — see PERF.md); measure against the deploy.

Deploys restart Durable Objects, but rooms recover via the durable snapshot + the 30 s
reconnection window — players reland in the same seat/state. **Before committing a game
to Tikron**, read AGENTS.md → "Limits & roadmap": WebSocket-only transport (not for
twitch shooters), rooms fixed near their creator (matchmake by region), join-or-create
matchmaking only (no MMR/parties), no automatic state-shape migration across versions
yet, and the measured 20-players/room · 128-CCU scale envelope.

## Failure quick-reference

- 404 on connect → party name ≠ kebab-case of the DO binding, or wrong `/parties/<party>/` path.
- Binary state never decodes → `binaryType` not `"arraybuffer"`.
- Every input dropped → over `maxInputsPerSecond` (30), or client didn't send a `seq`.
- `room_full` (close 4002) → hit `maxClients`; route to another room id.
- `invalid_session` (4003) / `unauthorized` (4004) → bad `?_session=` / `?_auth=`; use matchmaking-issued ids.
- partyserver "Cannot determine the name…" → a global wrangler ran; use the pnpm scripts.

Full error tables and measured limits: [`AGENTS.md`](../../../AGENTS.md).
