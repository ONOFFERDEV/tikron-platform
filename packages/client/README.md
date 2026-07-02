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

## Key API

`GameClient(host, options)` → `joinOrCreate(room, params?)` · `Room`
(`send(type, payload?)`, `onStateChange`, `onMessage(type?, handler)`, `onAck`,
`connectionId`, `connected()`, `leave()`) · `InputPredictor` · `SnapshotBuffer` ·
`ClockSync` · `withNetworkConditions` · `createPartySocketTransport`.

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).
Licensed **FSL-1.1-ALv2** — converts to **Apache-2.0** two years after each release.
See LICENSE.
