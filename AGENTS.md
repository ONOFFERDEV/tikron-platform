# AGENTS.md — building a game on Tikron

You are a coding agent shipping a multiplayer web game for a non-developer. Tikron
is a realtime multiplayer **BaaS for web games** — server-authoritative game rooms on
Cloudflare Workers + Durable Objects with a drop-in TypeScript SDK. You write room
state + message handlers; the platform runs them at the edge, one Durable Object per
room, placed near players. No servers to manage.

This file is the operational brief. For architecture read [`docs/HANDOFF.md`](docs/HANDOFF.md);
for measured performance read [`docs/PERF.md`](docs/PERF.md). Cite real numbers from
PERF.md — never invent latency figures.

## Pick a preset by genre

Every room subclasses `Room<TState>` from `@tikron/server`. Start from the preset
that matches the game, then override handlers. The core is genre-agnostic (knows
nothing about ticks/movement/AOI); presets pre-wire the opt-in modules.

| Game genre | Preset | What it pre-wires | You implement |
|---|---|---|---|
| Turn-based, board, card, quiz (players act in turns) | `TurnBasedRoom` | Core only: JSON sync on mutation, no tick. Cheapest room (idle ≈ WS keepalive). | `onCreate`, `onJoin`, `onLeave` |
| Cursors, whiteboards, party games, shared canvases (free movement, no physics tick) | `CasualRealtimeRoom` | Throttled JSON sync (~20 Hz coalesced) + built-in 30 s reconnection window. | `onCreate`, `onJoin`, `onSeatExpired` |
| `.io` arenas, shooters, racers (continuous movement, fixed-timestep simulation) | `IoArenaRoom` | Simulation tick (`onTick`) + binary delta `stateCodec` + input acks + optional per-viewer AOI + built-in reconnection. | `codec`, `onTick`, `onSeatExpired` |

Rule of thumb: turns alternate → `TurnBasedRoom`; everyone moves but you don't run
physics every frame → `CasualRealtimeRoom`; you integrate positions/collisions on a
fixed timestep → `IoArenaRoom`. A preset is a thin `Room` subclass — dropping back to
the raw core is always possible. The [`examples/starter`](examples/starter) template
(`ArenaRoomImpl`) extends `CasualRealtimeRoom`; the flagship `.io` demo
(`apps/gateway`, `AgarRoom`) extends `IoArenaRoom` with AOI.

## Golden path — scaffold → run → deploy → play

```bash
# 1. Scaffold (clones this repo; @tikron/* is not on npm yet — see tools/create-tikron)
npx create-tikron my-game
cd my-game
pnpm install            # Node >= 22, pnpm 10.x (corepack enable)

# 2. Write your game: edit ONE file — the room's state shape + onMessage handlers.
#    (starter: examples/starter/src/arena-room.ts)

# 3. Run locally (workerd via the LOCAL wrangler; open two tabs)
pnpm --filter tikron-starter dev        # http://127.0.0.1:8787

# 4. Deploy to Cloudflare's edge (free tier works)
pnpm exec wrangler login                  # once, opens a browser
pnpm --filter tikron-starter deploy     # prints https://tikron-starter.<account>.workers.dev
```

Rename the deploy target by editing `name` in the project's `wrangler.jsonc`. Every
distinct room id is its own isolated room: `wss://<host>/parties/<party>/<room-id>`.

### The whole multiplayer loop

```ts
// SERVER (room): clients send intents, the server owns the state and validates.
this.onMessage("move", (client, payload) => {
  const me = this.state.players[client.id];
  if (!me || !isVec2(payload)) return;   // validate EVERY payload
  me.x = clamp01(payload.x);
  this.markStateChanged();               // -> synced to every client (coalesced)
});

// CLIENT (@tikron/client)
room.send("move", { x, y });             // intent, auto-seq'd
room.onStateChange((state) => render(state));
```

Lifecycle hooks to override: `onCreate` (set initial state, register handlers),
`onJoin(client)`, `onLeave(client)`, `onReconnect(client)`, `onDispose`.

## Hard rules — these prevent the classic failures

1. **The server owns state; clients send intents, never state.** Mutate `this.state`
   only inside a handler, then call `markStateChanged()`. A client that sends its
   position is a bug and a cheat vector.
2. **Validate every payload.** `payload` is `unknown`. Type-guard it (see `isVec2`)
   and clamp/range-check before use. Act on the *server's* view of the player, not
   the client's claim (e.g. splat where the server says the player is).
3. **Binary frames must be `arraybuffer`.** `@tikron/client` sets
   `socket.binaryType = "arraybuffer"` for you. If you hand-roll a WebSocket client,
   set it yourself — the WS default `blob` silently breaks binary delta decode.
4. **The party name is the kebab-case of the DO binding.** partyserver maps binding
   `ArenaRoom` → party `arena-room`; `GameRoom` → `game-room`. The client `party`
   option and the `/parties/<party>/` URL must match, or the connection 404s.
5. **Never trust multi-room numbers from local `wrangler dev`.** Local workerd runs
   every Durable Object in one process, so parallel rooms contend for one CPU
   (PERF.md: 8×16 rooms local p50 **645 ms** vs deployed **82 ms**). Benchmark
   multi-room capacity only against a real deploy.
6. **Run via the pnpm scripts (local wrangler 4.106+).** An older global wrangler's
   workerd doesn't expose `ctx.id.name` and partyserver fails with "Cannot determine
   the name…". Never `npm i -g wrangler` and run that.
7. **Mutate then flag.** After changing `this.state` in place, call `markStateChanged()`
   (or use `setState(next)`). Flushes coalesce to one per `syncIntervalMs` (50 ms
   default) — do not lower it without reading the flush-throttle rationale below.
8. **`noUncheckedIndexedAccess` is on.** Indexed/array access is `T | undefined`;
   guard it. ESM only — import local files with `.js` extensions.

## Room knobs (protected fields on `Room`)

| Field | Default | Use |
|---|---|---|
| `maxClients` | `Infinity` | Hard seat cap enforced room-side (rejects excess with `room_full`). Set for capped rooms — the matchmaker cap alone is advisory. |
| `maxInputsPerSecond` | `30` | Per-client input rate limit; excess dropped (never acked). |
| `syncIntervalMs` | `50` | Min interval between state broadcasts (trailing-edge coalesce). `0` = immediate microtask flush (unbounded — only if another cadence bounds mutations). |
| `sendAcks` | `false` | Ack each input seq (enables client reconciliation for realtime). |
| `stateCodec` | — | Set a `@tikron/schema` codec → binary delta sync instead of JSON. |
| `persistIntervalMs` | `5000` | Max interval between durable state snapshots. |

Realtime modules (call from `onCreate`): `setSimulationInterval(fn, ms)` (fixed tick,
20–30 Hz; DO alarms are unsuitable < ~1 s), `enableAOI(config)` (per-viewer interest
management — a bandwidth win AND a security boundary; requires a `stateCodec`).
Reconnection: inside `onLeave`, `await this.allowReconnection(client, 30)` resolves if
the player returns within the window (needs a `?_session=` key) and rejects on timeout.

## Command reference

| Command | What it does |
|---|---|
| `pnpm install` | Install the workspace (Node ≥ 22, pnpm 10.x). |
| `pnpm --filter tikron-starter dev` | Local edge server + demo, `http://127.0.0.1:8787`. |
| `pnpm --filter tikron-starter deploy` | Deploy to Cloudflare (needs `wrangler login`). |
| `pnpm exec wrangler login` | One-time Cloudflare auth (opens a browser). |
| `pnpm build` | Turborepo build; gateway does `wrangler deploy --dry-run`. |
| `pnpm typecheck` | `tsc --noEmit` across all packages. |
| `pnpm test` | vitest everywhere (incl. workerd integration). |
| `pnpm --filter @tikron/gateway dev` | Full-stack demos: `/agar.html` (.io), `/api/rooms` (lobby). |

Swap `tikron-starter` for your project's package name (the `name` in its `package.json`).

## Error codes

WebSocket **close codes** (the socket is closed; the reason precedes the close):

| Close | Code (frame) | Meaning | Fix |
|---|---|---|---|
| `4001` | — | Session taken over by a newer connection (duplicate tab / zombie socket). | Expected on reconnect/duplicate. Don't auto-reconnect the superseded socket (the SDK stops on 4001). |
| `4002` | `room_full` | New seat would exceed `maxClients`. | Route players to another room id, or raise `maxClients`. Reattach/takeover of an existing seat is never capped. |
| `4003` | `invalid_session` | `?_session=` key failed `validateSession`. | Use a session id issued by matchmaking (`/api/matchmake`); don't fabricate keys. |
| `4004` | `unauthorized` | Player-token `onAuth` rejected. | Pass a valid `?_auth=` JWT (SDK `authToken` option) for projects with `require_player_auth`. |

Error **frames** (`{ t: "s:error", code, message }`) — HTTP or in-band, socket may stay open:

| Code | Where | Fix |
|---|---|---|
| `bad_message` | room, in-band | Malformed wire message. Send well-formed protocol frames (use `@tikron/client`, don't hand-roll). |
| `missing_api_key` | HTTP 401 on `/parties/*` | No `apiKey` on a metered connect. Pass the project API key (`GameClient({ apiKey })`). |
| `invalid_api_key` | HTTP 401 on `/parties/*` | API key not recognized. Use a key from the dashboard for this project. |
| `cap_concurrent_rooms` | HTTP 403 on `/api/matchmake` | Project hit its concurrent-rooms cap. Free rooms as players leave, or upgrade the plan. |
| `cap_room_hours` | HTTP 403 on `/api/matchmake` | Project hit its monthly room-hours cap. Wait for reset or upgrade. |

(API-key enforcement + caps apply only when the gateway runs with a platform DB; local
dev with `DEV_MODE=1` skips them.)

## Measured limits (from docs/PERF.md — real numbers, one client in Korea)

- **A full 20-player AOI room is comfortable deployed:** ack RTT p50 **~85 ms**
  (84.9 ms), p99 ~115 ms, zero errors — the ~80 ms is network distance; the engine
  itself adds single-digit ms (local p50 8.6 ms at the 20 cap).
- **Rooms scale horizontally:** 8 rooms × 16 players = **128 concurrent** deployed
  p50 **~82 ms** (81.9 ms), p99 134 ms, 128/128 connected. Each room is its own
  Durable Object placed independently — 128 across 8 rooms behaves like one
  16-player room.
- **AOI keeps bandwidth flat:** 1.3 → 3.8 KiB/s per client from 2 → 20 players (each
  client receives only its view).
- **Turn-based is nearly free:** idle JSON room ~77 B/s per client (WS keepalive).
- **Flush-throttle rationale (`syncIntervalMs = 50`):** the cost driver is the *event
  rate*, not bytes. Before throttling, `markStateChanged()` broadcast per input, so a
  64-player 20 Hz room fired hundreds of full-room deltas/sec × 64 recipients and the
  Durable Object's output path saturated — **58 of 64 sockets force-closed** deployed.
  Coalescing flushes to a 50 ms boundary cut broadcasts per client ~44× (each delta
  carries the same info); the same room then held **0/64 closed**, deployed p50 83 ms.
  Lower `syncIntervalMs` at your peril.

Deployed numbers include ~80 ms network RTT from the test client; players nearer their
room's DO see less. Treat deltas < 20% as noise (single runs).
