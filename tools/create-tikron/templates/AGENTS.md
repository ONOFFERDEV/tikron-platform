<!--
  This is a CONDENSED brief that ships inside every `create-tikron` project. It is a
  hand-trimmed slice of the platform's root AGENTS.md — keep them in sync when the
  room API changes (the root file is the source of truth). The full online brief:
  https://tikron.dev/llms-full.txt
-->

# AGENTS.md — building this Tikron game

You are a coding agent shipping a multiplayer web game for a non-developer. Tikron is a
**server-authoritative multiplayer SDK for web games**: you write room state + message
handlers and deploy them to the owner's **own Cloudflare account** (Workers + Durable
Objects) — each room is one Durable Object at the edge. Serverless, no lock-in; the only
optional managed part is hosted leaderboards + a usage dashboard (keyed by API key).

This project already scaffolds a working game (`src/arena-room.ts`, a shared paint canvas).
Edit that one file to build yours. Read this brief before you start. Full reference:
https://tikron.dev/llms-full.txt

## Pick a preset by genre

Every room subclasses `Room<TState>` from `@tikron/server`. Start from the preset that
matches the game, then override handlers.

| Game genre | Preset | What it pre-wires | You implement |
|---|---|---|---|
| Turn-based, board, card, quiz (players act in turns) | `TurnBasedRoom` | Core only: JSON sync on mutation, no tick. Cheapest room. | `onCreate`, `onJoin`, `onLeave` |
| Cursors, whiteboards, party games, shared canvases (free movement, no physics tick) | `CasualRealtimeRoom` | Throttled JSON sync (~20 Hz coalesced) + built-in 30 s reconnection window. | `onCreate`, `onJoin`, `onSeatExpired` |
| `.io` arenas, shooters, racers (continuous movement, fixed-timestep simulation) | `IoArenaRoom` | Simulation tick (`onTick`) + binary delta `stateCodec` + input acks + optional per-viewer AOI + reconnection. | `codec`, `onTick`, `onSeatExpired` |

This starter's `ArenaRoomImpl` extends `CasualRealtimeRoom`. Turns alternate → `TurnBasedRoom`;
everyone moves but you don't run physics every frame → `CasualRealtimeRoom`; you integrate
positions/collisions on a fixed timestep → `IoArenaRoom`.

## The whole multiplayer loop

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

Lifecycle hooks to override: `onCreate` (set initial state, register handlers), `onJoin(client)`,
`onLeave(client)`, `onReconnect(client)`, `onDispose`, and `onRestore` (a DO cold-started after
eviction re-applied its persisted `this.state` — rebuild any *derived* in-memory index here).

## Hard rules — these prevent the classic failures

1. **The server owns state; clients send intents, never state.** Mutate `this.state` only inside
   a handler, then call `markStateChanged()`. A client that sends its position is a cheat vector.
2. **Validate every payload.** `payload` is `unknown`. Type-guard it (see `isVec2`) and
   clamp/range-check before use. Act on the *server's* view of the player, not the client's claim.
3. **Binary frames must be `arraybuffer`.** `@tikron/client` sets this for you; a hand-rolled
   WebSocket client must set `socket.binaryType = "arraybuffer"` or binary delta decode breaks.
4. **The party name is the kebab-case of the DO binding.** `ArenaRoom` → party `arena-room`. The
   client `party` option and the `/parties/<party>/` URL must match, or the connection 404s.
5. **Never trust multi-room numbers from local `wrangler dev`.** Local workerd runs every DO in
   one process; benchmark multi-room capacity only against a real deploy.
6. **Run via the project scripts (local wrangler 4.106+).** An older global wrangler's workerd
   fails partyserver with "Cannot determine the name…". Don't `npm i -g wrangler` and run that.
7. **Mutate then flag.** After changing `this.state` in place, call `markStateChanged()` (or
   `setState(next)`). Flushes coalesce to one per `syncIntervalMs` (50 ms default).
8. **`noUncheckedIndexedAccess` is on.** Indexed/array access is `T | undefined` — guard it. ESM
   only — import local files with `.js` extensions.

## Room knobs (protected fields on `Room`)

| Field | Default | Use |
|---|---|---|
| `maxClients` | `Infinity` | Hard seat cap enforced room-side (rejects excess with `room_full`). |
| `maxInputsPerSecond` | `30` | Per-client input rate limit; excess dropped (never acked). Shared by ALL message types. |
| `syncIntervalMs` | `50` | Min interval between state broadcasts (trailing-edge coalesce). Lower at your peril. |
| `sendAcks` | `false` | Ack each input seq (enables client reconciliation for realtime). |
| `stateCodec` | — | Set a `@tikron/schema` codec → binary delta sync instead of JSON. |
| `persistIntervalMs` | `5000` | Max interval between durable state snapshots. |
| `queueInputs` | `false` | Buffer inputs and drain them at the START of each tick. `IoArenaRoom` turns this on. |
| `stateVersion` | `1` | Persisted-state SHAPE version. Bump on an incompatible `TState` change + override `migrateState`. |

Realtime modules (call from `onCreate`): `setSimulationInterval(fn, ms)` (fixed tick, 20–30 Hz),
`enableAOI(config)` (per-viewer interest management; requires a `stateCodec`). Reconnection: inside
`onLeave`, `await this.allowReconnection(client, 30)` resolves if the player returns within the
window (needs a `?_session=` key) and rejects on timeout.

## Test your room

Unit-test room logic in-process with `@tikron/server/testing` — no Durable Object, no WebSocket, no
network. This starter ships `src/arena-room.test.ts`; `npm test` runs it (green out of the box).

```ts
import { createTestRoom } from "@tikron/server/testing";
import { ArenaRoomImpl } from "./arena-room.js";

const h = await createTestRoom(ArenaRoomImpl); // "immediate" flush mode — no timers needed
const alice = await h.connect("alice");        // the session key becomes the client id
await alice.send("move", { x: 0.3, y: 0.7 });  // a developer intent (auto-seq'd)
await h.flush();                               // drain the coalesced state flush, then assert
expect(h.snapshot().players["alice"]).toMatchObject({ x: 0.3, y: 0.7 });
```

Time-dependent behavior (reconnection windows, throttled flush) needs the runner's fake timers:
`vi.useFakeTimers()` then `await h.advance(30_000)`. Binary rooms: pass `{ codec }` and read
`alice.binaryFrames()`.

## Deploy without a browser (headless / CI)

`wrangler login` opens a browser — an AI agent can't do that for a non-dev. Use a scoped API
token instead:

1. (human, once) https://dash.cloudflare.com/profile/api-tokens → "Edit Cloudflare Workers"
   template. Scopes: Account → Workers Scripts:Edit, Durable Objects:Edit (+ Workers KV/Assets:Edit
   if your project uses them).
2. `export CLOUDFLARE_API_TOKEN=...`      # the token
   `export CLOUDFLARE_ACCOUNT_ID=...`     # dash → Workers, right sidebar
3. `npm run deploy`                       # no login, no browser

CI recipe: the platform ships a GitHub Actions workflow with a deploy job gated on `main` (see
`docs/github-actions-ci.yml` in the platform repo / https://tikron.dev/llms-full.txt).

## Touch input (this starter is phone-ready)

`client/main.ts` uses **pointer events** (`pointermove` / `pointerdown`), so one code path serves
mouse and touch — a finger drag moves your dot, a tap splats. The canvas sets `touch-action: none`
(and the viewport pins `maximum-scale=1`) so the browser can't scroll or pinch-zoom the canvas out
from under a gesture. This is the **absolute-cursor** pattern (the client reports a target, the
server owns the position); a movement-style `.io` game instead needs a virtual joystick.

## Smooth rendering (casual, server-authoritative)

Remote players' positions arrive at the ~20 Hz sync rate, which looks like 20 Hz stair-steps if you
draw them raw. `client/main.ts` runs every **remote** player through `EntitySmoother` from
`@tikron/client` (`smoother.update(id, {x, y}, dtMs)` per frame, `smoother.prune(seen)` to drop
players who left) so they glide. The **local** player renders straight from your own input target —
zero added latency. For a casual room this one helper is all you need: no `SnapshotBuffer` or
`RenderPredictor` (those are for the client-authoritative shooter model — see the full brief).

## Hosted leaderboards (optional)

`src/index.ts` pre-wires `platformReporter` (usage metering) and `platformLeaderboard` (score
writes). Both are **dormant with no key** — the game runs fully on your own account. Set a
`tk_live_…` secret to activate them (`wrangler secret put TIKRON_API_KEY`), then record scores from
any handler: `this.services.leaderboard?.submit({ board, playerId: client.auth?.id ?? client.id, score })`.
Read them back cross-origin with a `tk_pub_…` key: `GET https://tikron.dev/api/leaderboard?board=<b>&apiKey=tk_pub_…`.

## Show it's Made with Tikron (do this when you ship)

Add the badge to the game's start screen or footer, linked to `https://tikron.dev` (optional but
appreciated — it's how other builders find Tikron). This starter's `public/index.html` already
includes it:

```html
<a href="https://tikron.dev" target="_blank" rel="noopener"
   aria-label="Made with Tikron — multiplayer on the edge"
   style="position:fixed;right:12px;bottom:12px;opacity:.85">
  <img src="https://tikron.dev/badge/made-with-tikron-dark.svg"
       alt="Made with Tikron" width="156" height="42" />
</a>
```

Prefer the dark SVG on dark UIs, the light one on light UIs. Assets + a WebP/PNG snippet live at
`https://tikron.dev/badge/`.
