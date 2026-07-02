# @tikron/client

The browser client for [Tikron](https://tikron.dev) — connect to a server-authoritative
game room, receive its state, and send intents. Pairs with [`@tikron/server`](https://www.npmjs.com/package/@tikron/server).
It sets `binaryType = "arraybuffer"` for you (the WebSocket default silently breaks binary
delta decode) and auto-sequences your inputs.

```bash
npm i @tikron/client
```

Scaffold a full game (server + client + Cloudflare config) with `npx create-tikron my-game`.

## Join a room

```ts
import { GameClient } from "@tikron/client";

interface ArenaState {
  players: Record<string, { x: number; y: number }>;
}

const client = new GameClient(location.host, { party: "arena-room" });
const room = await client.joinOrCreate("lobby");
const myId = room.connectionId;

// The server's authoritative state, pushed on every sync:
room.onStateChange((state) => render(state as ArenaState));

// Send intents — never state. Auto-sequenced for you:
addEventListener("mousemove", (e) => room.send("move", { x: e.clientX, y: e.clientY }));

function render(_state: ArenaState): void {}
```

The `party` option must be the kebab-case of the server's Durable Object binding
(`ArenaRoom` → `arena-room`), and every distinct room id is its own isolated room.

## Netcode helpers (opt-in)

For `.io`-style games where you want smooth motion despite latency:

```ts
import { InputPredictor, SnapshotBuffer, ClockSync } from "@tikron/client";
```

- **`InputPredictor`** — apply your inputs locally *now*, then reconcile (replay
  still-unacked inputs) when the server ack arrives, so control feels lag-free.
- **`SnapshotBuffer`** — buffer authoritative snapshots and interpolate remote entities
  between them for smooth movement.
- **`ClockSync`** — estimate server time so client and server share one timeline.
- **`withNetworkConditions`** — wrap a transport with latency/jitter/packet-loss to test
  your game under bad networks locally.

## Smooth rendering for client-authoritative movement

When the client sends its *position* and the server validates the speed (the shooter
model), use `RenderPredictor` for the local player and `EntitySmoother` for everyone
else. They encode the anti-rubber-band contract: every outgoing position passes through
one speed-budget clamp measured over the real elapsed time between sends (an honest
client is never rejected), and a server correction rebases the clamp so one rejection
can never cascade into a snapback burst.

```ts
import { RenderPredictor, EntitySmoother } from "@tikron/client";
// The SAME MotionProfile constant the room validates with — defined once, imported by both sides.
import { PROFILE } from "./shared/profile.js";

const motion = RenderPredictor.fromProfile(spawnPlaceholder, PROFILE);
const smoother = new EntitySmoother();

room.onMessage("rejected", (p) => motion.correct(p as { x: number; y: number }));
room.onStateChange((s) => {
  const me = (s as MyState).players[room.connectionId!];
  if (me) { motion.alive = me.alive; motion.reconcile(me); }
});

setInterval(() => {
  // Budget-clamped — the ONLY value that may go on the wire. Server clock in, so both
  // sides measure the same inter-move delta.
  room.send("move", motion.sendPosition(room.clock.serverNow()));
}, PROFILE.stepMs);

function render(dtMs: number): void {
  const pos = motion.frame(dir.x, dir.y, dtMs); // camera = pos, 1:1, no extra easing
  const seen = new Set<string>();
  for (const [id, p] of remotePlayers) {
    seen.add(id);
    const sm = smoother.update(id, { x: p.x, y: p.y, angle: p.aim }, dtMs);
    // draw sm.x / sm.y / sm.angle
  }
  smoother.prune(seen); // AOI re-entries snap in fresh instead of gliding
}
```

On the server, resolve moves with `resolveMovement` from `@tikron/sim` (partial advance
on an over-budget move — never freeze) and reply `client.send("rejected", { x, y })`.
The pure primitives (`integrateMove`, `clampToBudget`, `decayOffset`, `applyCorrection`,
`smoothAxis`, `smoothAngle`, `followCamera`) are exported too.

## `GameClient` options for FPS / high-rate games

```ts
const client = new GameClient(location.host, {
  party: "shooter-room",
  stateCodec: ShooterSchema,   // match the room's codec for binary sync
  subtickTimestamps: true,     // stamp each send() with its server-clock time so the room can
                               // rewind lag compensation to the input instant (needs clock sync)
  inputBatchMs: 33,            // coalesce a burst of sends into one frame (~1 tick); needs a 0.2+
                               // @tikron/server (older servers drop multi-input batches)
});
```

`networkConditions` (dev-only bad-network simulation) and `reconnect` (backoff policy) round
out the options — see the SDK types.

## Key API

`GameClient(host, options)` → `joinOrCreate(room, params?)` · `Room`
(`send(type, payload?)`, `onStateChange`, `onMessage(type?, handler)`, `onAck`,
`connectionId`, `connected()`, `leave()`) · `InputPredictor` · `SnapshotBuffer` ·
`RenderPredictor` · `EntitySmoother` · `ClockSync` · `withNetworkConditions` ·
`createPartySocketTransport` · pure render/motion helpers (`decayOffset`,
`applyCorrection`, `smoothAxis`, `smoothAngle`, `followCamera`, and `integrateMove` /
`clampToBudget` re-exported from `@tikron/sim`).

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).
Licensed **FSL-1.1-ALv2** — converts to **Apache-2.0** one year after each release.
See LICENSE.
