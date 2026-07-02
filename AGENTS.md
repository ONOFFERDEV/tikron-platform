# AGENTS.md — building a game on Tikron

You are a coding agent shipping a multiplayer web game for a non-developer. Tikron
is a **source-available (FSL-1.1), server-authoritative multiplayer SDK for web games**. You write
room state + message handlers and deploy them to **your own Cloudflare account**
(Workers + Durable Objects) — each room is one Durable Object at the edge, placed near
players. Serverless (no VMs to run) and no lock-in: it's your account, your bill. The
only managed part is optional hosted services (leaderboards + a usage dashboard, keyed
by API key); the rooms themselves always run on your infrastructure.

This file is the operational brief; for measured performance read
[`docs/PERF.md`](docs/PERF.md). Cite real numbers from PERF.md — never invent
latency figures.

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
(`apps/gateway`, `AgarRoom`) extends `IoArenaRoom` with AOI; the FPS proof-of-concept
(`apps/gateway`, `ShooterRoom`) is the same `IoArenaRoom` with the full competitive
stack turned on — `lagCompensation` + AOI priority `tiers` + client `subtickTimestamps`
(see "Competitive FPS" below). A hitscan shooter still fits WebSocket transport because
projectiles never enter the state stream — shots resolve server-side (see the roadmap
note on transport before choosing this for a twitch shooter).

## Golden path — scaffold → run → deploy → play

```bash
# 1. Scaffold a standalone game (@tikron/* installs from npm; no monorepo)
npx create-tikron my-game
cd my-game
npm install             # Node >= 22 (pnpm / yarn / bun also fine)

# 2. Write your game: edit ONE file — the room's state shape + onMessage handlers.
#    (src/arena-room.ts)

# 3. Run locally (workerd via the local wrangler; open two tabs)
npm run dev             # http://127.0.0.1:8787

# 4. Deploy to YOUR Cloudflare account (free tier works)
npx wrangler login      # once, opens a browser
npm run deploy          # prints https://my-game.<account>.workers.dev
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
`onJoin(client)`, `onLeave(client)`, `onReconnect(client)`, `onDispose`, and
`onRestore` (a Durable Object cold-started after eviction and re-applied its persisted
`this.state` — rebuild any *derived* in-memory index that mirrors state but isn't itself
persisted, e.g. a spatial grid or an id→cell map seeded in setup). `onRestore` runs only
when a snapshot was actually restored, so `onCreate`/`onReady` alone won't rebuild those
indexes after an eviction.

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
| `queueInputs` | `false` | Buffer inputs and drain them (in arrival order) at the START of each tick, so `onTick` sees one consistent batch instead of interleaved handlers. Requires a simulation interval. `IoArenaRoom` turns this on. |
| `stateVersion` | `1` | Persisted-state SHAPE version. Bump it on an incompatible `TState` change and override `migrateState(from, old)` so a redeploy migrates old snapshots instead of silently restoring the old shape. |

Realtime modules (call from `onCreate`): `setSimulationInterval(fn, ms)` (fixed tick,
20–30 Hz; DO alarms are unsuitable < ~1 s), `enableAOI(config)` (per-viewer interest
management — a bandwidth win AND a security boundary; requires a `stateCodec`; grid-indexed,
~O(viewers + entities) per flush). `AOIConfig.tiers` adds a Tribes/Halo priority schedule:
concentric distance bands (ascending `radius`, integer `interval`) that refresh FAR entities
at a fraction of the tick rate — the single biggest downlink lever at high CCU. A throttled
far entity is never dropped (it rides through as "unchanged", so no flicker); first appearance
and removal always fire immediately. Reconnection: inside `onLeave`,
`await this.allowReconnection(client, 30)` resolves if the player returns within the window
(needs a `?_session=` key) and rejects on timeout. A room can poll its own recent tick/flush
timing at runtime by sending itself the core-reserved `tk:stats` developer message (the load
test uses this; the reply is a `{ tick, flush, windowMs }` timing summary).

## Competitive FPS: subtick timestamps + lag compensation + priority tiers

Reach for this when hit registration must survive real RTT (a hitscan shooter, a fast
racer with contact). It is `IoArenaRoom` with three opt-ins layered on; the
`ShooterRoom` demo (`apps/gateway`) is the end-to-end reference.

- **Quantize the state codec.** Snap continuous fields (position, angle, health) to a grid
  with `quant(min, max, step)` from `@tikron/schema`: it rides in 1–4 bytes instead of an
  `f32`'s 4, and sub-`step` jitter drops out of deltas entirely. This is the main bandwidth
  lever for a dense arena.
- **Server-side lag compensation.** Set `lagCompensation = true` and override `lagSnapshot()`
  to return the entities to track (id → `{x,y}`); the preset records positions after each tick.
  In a `shoot` handler, `this.rewind(client, input?.ts)` returns the world as that client saw it
  and you run the hitscan against it.
- **Subtick input timing.** The client opts in with `subtickTimestamps: true`; each `send()`
  is stamped with the input's estimated server-clock time. The server clamps it to a recent
  window (`[now-250ms, now]`, anti-backdate) and hands it to the handler as the 4th arg
  (`InputMeta.ts`). Passing it to `rewind` pins the rewind to the exact instant the shooter
  aimed, decoupled from the tick rate (the CS2 model). Requires client clock sync (on by
  default).
- **AOI priority tiers.** Set `aoi.tiers` so far players refresh at a fraction of the tick rate
  (see Room knobs). The demo uses `[{radius:300,interval:1},{radius:600,interval:4}]`.
- **Optional input batching.** The client `inputBatchMs` option (e.g. 33 ≈ one tick) coalesces
  a burst of inputs into one `c:mbatch` WebSocket frame, cutting the DO's inbound request rate.
  Only enable it against a matching `@tikron/server` (0.2+) — an older server that predates the
  batch frame drops any multi-input window.

```ts
// SERVER — a hitscan shooter room
class Shooter extends IoArenaRoom<ShooterState> {
  protected readonly codec = schema({
    players: mapOf(schema({ x: quant(0, 2000, 0.1), y: quant(0, 2000, 0.1),
      aim: quant(0, Math.PI * 2, 0.001), hp: "u8", alive: "bool" })),
  });
  protected override lagCompensation = true;
  protected override aoi = {
    viewRadius: 600, mapFields: ["players"],
    position: (e) => e as Vec2, viewer: (s, id) => s.players[id] ?? null,
    tiers: [{ radius: 300, interval: 1 }, { radius: 600, interval: 4 }],
  };
  protected override lagSnapshot() {
    return new Map(Object.entries(this.state.players)
      .filter(([, p]) => p.alive).map(([id, p]) => [id, { x: p.x, y: p.y }]));
  }
  protected override onReady() {
    this.setState({ players: {} });
    // 4th arg carries the clamped subtick ts when the client opts in.
    this.onMessage("shoot", (client, aim, _seq, input) => {
      const world = this.rewind(client, input?.ts);   // world as the shooter saw it
      // ...resolve the hitscan against `world`, apply damage...
    });
  }
}

// CLIENT — opt into subtick timing (needs clock sync) + input batching
const gc = new GameClient(host, { stateCodec: ShooterSchema, subtickTimestamps: true, inputBatchMs: 33 });
```

**Wire compatibility:** client and server share `PROTOCOL_VERSION` and the binary state-frame
layout. Ship the SAME SDK minor on both sides — 0.1.x and 0.2.x are not wire-compatible (0.2
added the `c:mbatch` frame, the subtick `ts` field, and the state-frame `serverTime`). Upgrade
both together.

## Smooth rendering: RenderPredictor + EntitySmoother

For client-authoritative movement ("the client sends its position, the server validates the
speed" — the shooter model), use the `@tikron/client` render helpers instead of hand-rolling
the integration/correction/clamp plumbing. They exist to make rubber-banding structurally
impossible: every outgoing position passes through ONE budget clamp measured over the real
elapsed time between sends, so an honest client is never speed-rejected; if the server still
corrects (a rate-limit drop left it behind), the correction rebases the clamp so a rejection
can never cascade; and the server resolves an over-budget move by partial advance
(`resolveMovement`), never by freezing — the freeze is what used to amplify one rejection
into an RTT-long snapback burst.

```ts
// Shared module (imported by BOTH the room and the client bundle) — one budget, two sides.
export const PROFILE: MotionProfile =
  { maxSpeed: 500, tolerance: 1.15, stepMs: 50, world: 3000, sendHeadroom: 1.1 };

// CLIENT
const motion = RenderPredictor.fromProfile(spawnPlaceholder, PROFILE);
const smoother = new EntitySmoother();

room.onMessage("rejected", (p) => motion.correct(p as Vec2)); // one reject max: lastSent rebases
const ingest = (s: unknown) => { const me = (s as MyState).players[room.connectionId!];
  if (me) { motion.alive = me.alive; motion.reconcile(me); } };
room.onStateChange(ingest);
if (room.state !== undefined) ingest(room.state); // fold the frame that predates the handler

setInterval(() => {
  const sent = motion.sendPosition(room.clock.serverNow()); // budget-clamped: never over-speed
  room.send("move", sent);                                  // send EXACTLY this value
}, PROFILE.stepMs);

function render(dtMs: number) {
  const pos = motion.frame(dir.x, dir.y, dtMs);  // camera = pos, 1:1, NO extra easing
  const seen = new Set<string>();
  for (const [id, p] of others) { seen.add(id);
    const sm = smoother.update(id, { x: p.x, y: p.y, angle: p.aim }, dtMs); /* draw sm */ }
  smoother.prune(seen); // so an AOI re-entry snaps in fresh instead of gliding
}

// SERVER — in the move handler. Measure the SAME budget window the client clamps
// to ("one budget, two sides"): per-client inter-move delta from the clamped
// subtick ts, bounded to [stepMs/2, stepMs*2], reference kept monotonic:
//   const now = input?.ts ?? Date.now();
//   const last = lastMoveAt.get(client.id);
//   const deltaMs = last === undefined ? PROFILE.stepMs
//     : Math.min(Math.max(now - last, PROFILE.stepMs / 2), PROFILE.stepMs * 2);
//   lastMoveAt.set(client.id, last === undefined ? now : Math.max(last, now));
//   const res = resolveMovement(prev, target, PROFILE, deltaMs);
//   p.x = res.position.x; p.y = res.position.y;               // partial advance, no freeze
//   if (res.rejected) client.send("rejected", { x: p.x, y: p.y });
```

Rules of thumb:
- Render = continuous integration + a decaying correction offset. Bind the local camera to
  `frame()`'s output 1:1 — extra easing only adds a trail and input lag.
- `sendPosition(room.clock.serverNow())` is the single choke point: never send any other
  position value (that reopens the rubber-band path). Pass the server clock — the same clock
  the SDK stamps into the input `ts` — so both sides measure the same inter-move delta.
- `correct()` is for an explicit server correction message; `reconcile()` is for the state
  echo of the local player (small gaps are RTT lag and are ignored; only the first frame,
  a respawn — set `motion.alive` from authoritative liveness — and ≥ `snapDistance` snap).
  `snapDistance` tuning: below the game's minimum respawn displacement, above
  `maxSpeed × (RTT + stepMs) / 1000`.
- Share ONE `MotionProfile` constant between room and client (a structural subtype of
  `MovementConfig` — pass it straight to `resolveMovement`). Keep `sendHeadroom` strictly
  between 1 and `tolerance`.
- Message budget: keep `1000/stepMs × message-types-per-tick` under the room's
  `maxInputsPerSecond` (default 30), or moves get silently dropped — the shooter room raises
  it to 60 for a 20 Hz move stream plus shots.
- `RenderPredictor` is a different model from `InputPredictor` (input replay for
  server-integrated movement); the shooter demo uses both — RenderPredictor for the view,
  InputPredictor for ack bookkeeping. `apps/gateway/demo/shooter-client.ts` is the reference.

## Test your room

Unit-test room logic in-process with the `@tikron/server/testing` harness — no Durable
Object, no WebSocket, no network. Connect fake clients, send intents, advance time, assert.

```ts
import { createTestRoom } from "@tikron/server/testing";
import { MyRoom } from "./my-room.js";

const h = await createTestRoom(MyRoom);   // "immediate" flush mode — no timers needed
const alice = await h.connect("alice");    // a session-keyed fake client
const bob = await h.connect("bob");
await alice.send("move", { x: 1, y: 2 });  // a developer intent (auto-seq'd)
await h.flush();                           // drain the coalesced state flush, then assert

h.snapshot();            // deep copy of the authoritative state
alice.lastState();       // the last state THIS client received (AOI-filtered if enabled)
alice.frames();          // JSON frames this client got; h.broadcastsOf("s:msg") for broadcasts
h.reports;               // occupancy reports (join / final leave / heartbeat)
```

Time-dependent behavior (reconnection windows, heartbeats, throttled flush) needs the
runner's fake timers:

```ts
vi.useFakeTimers();
const drop = alice.close();   // runs onLeave — a preset opens a 30s reconnection window
await h.advance(30_000);      // elapse it; then `await drop` — the seat is finalized
```

- **Binary rooms:** pass `{ codec }` to `createTestRoom`, then read `alice.binaryFrames()`
  (decoded) and `alice.lastState()`.
- **Real throttling:** `createTestRoom(MyRoom, { sync: "throttled" })` + `h.advance(50)`.
- **Persistence:** assert on `h.storage.kv` and `h.storage.alarm`.

### Feel the game under a bad network

Wrap the client transport to simulate latency/jitter/loss (dev only):

```ts
const client = new GameClient(host, {
  networkConditions: { latencyMs: 120, jitterMs: 30, lossRate: 0.05, seed: 1 },
});
```

Loss drops only binary **state frames** by default (the netcode recovers from a lost
delta); outbound intents/acks are never dropped, and a fixed `seed` makes runs
reproducible. Remove it for production. For an end-to-end check against real workerd,
keep a WebSocket smoke test (see the skill).

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
- **One room holds 100 players, deployed and clean:** with a 10 s join ramp, 100/100
  connected, **0** unexpected closes, ack p50 97 ms / p99 144 ms, cadence locked at
  ~48 ms, and server tick+flush processing **0 ms** across all `tk:stats` buckets (the
  F1 hot-path pass keeps a single DO's per-tick cost well under the 20 ms FPS budget).
  The full FPS stack (subtick shots + tiered AOI + per-field map deltas) also holds at
  100 CCU on one DO with zero drops. **One caveat — connection admission:** 100 upgrades
  crammed into 3 s to one DO fails ~20% of connects and destabilizes early sockets;
  pace joins over ~10 s (the client's built-in reconnect backoff already spreads retries)
  and steady-state is unaffected.
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

## Limits & roadmap (read this before you commit)

Tikron states its envelope up front. Here is what it does and doesn't do today, and
what is in progress — pick your genre and architecture accordingly.

- **Transport: WebSocket only (TCP).** Every connection is a WebSocket, so lost packets
  cause head-of-line blocking (a dropped frame stalls everything behind it). That's fine
  for the supported genres — turn-based, cursors/casual, and moderate `.io` — but it is
  **not** a fit for competitive twitch shooters that need unreliable/unordered datagrams.
  WebTransport (UDP-like) is on the roadmap, but Cloudflare Workers do **not** terminate
  WebTransport server-side today, so there is no date — don't design around it yet.
- **Deploys & live rooms.** `wrangler deploy` restarts your Durable Objects. Tikron rooms
  survive it: the durable snapshot (`this.state` + seats) plus the 30 s session-reconnection
  window mean players reconnect into the same seat and state. **State-shape changes across
  versions:** bump `stateVersion` and override `migrateState(fromVersion, oldState)` to
  transform an old snapshot into the new shape on restore. Returning `null` (the default)
  discards the snapshot — the room starts fresh and its persisted seats are dropped — with a
  dev-visible warning, so a redeploy that changes the shape never silently restores the old
  one. Snapshots written before versioning are treated as version 1.
- **Room placement.** A Durable Object is created near whoever opens the room and **stays
  there** for its life. A group spread across regions sees asymmetric latency (players far
  from the creator pay the distance). Pass a `region` hint to matchmaking
  (`/api/matchmake?...&region=weur`; one of `wnam, enam, weur, eeur, apac, oc, afr, me`) to
  place the room's Durable Object near a chosen geography on first contact — the hint is
  recorded at reservation and applied when the first client connects. Still **matchmake by
  region** (bucket players with the matchmaker `mode`/`filterBy`) so a room's members are near
  each other and near its placement.
- **Matchmaking scope.** What exists: `joinOrCreate` + reservation + `filterBy` + a live
  lobby list. What does **not** exist yet: skill/MMR rating, parties/pre-made groups, and
  reconnect-into-queue. Build ranked matching or party grouping in your own app layer on top
  of the primitives.
- **Scale envelope.** Measured comfortable at **20 players/room**, **100 players in one room**
  (deployed, clean — server tick+flush 0 ms), and **128 CCU across 8 rooms** (see the measured
  limits above and PERF.md). Rooms scale horizontally — each is its own DO — so total CCU grows
  with room count. AOI is now grid-indexed (uniform spatial hash, ~O(viewers + entities) per
  flush, property-tested for exact parity with the naive filter), so per-room cost no longer
  blows up quadratically with room size; priority `tiers` shed far-entity downlink on top of
  that. The remaining per-room ceiling at very high CCU is connection admission and raw fan-out,
  not the filter — still shard very large worlds into multiple rooms.

None of these are hidden — they're the honest edges of a v1 SDK. If your game fits the
supported genres and you size rooms within the measured envelope, you're on solid ground.
