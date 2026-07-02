# @tikron/server

The authoritative room framework for [Tikron](https://tikron.dev) — server-authoritative
multiplayer for web games on Cloudflare Workers + Durable Objects. You write room state
and message handlers; Tikron runs one Durable Object per room at the edge. The server owns
all state and validates every intent, so cheating by packet forgery isn't something you
bolt on later.

```bash
npm i @tikron/server partyserver
```

Most people start from a template instead: `npx create-tikron my-game`.

## A whole realtime room

Pick a preset by genre, then override handlers. `CasualRealtimeRoom` gives throttled JSON
sync plus a built-in 30-second reconnection window:

```ts
import { CasualRealtimeRoom, type Client } from "@tikron/server";

interface State {
  players: Record<string, { x: number; y: number }>;
}

export class Arena extends CasualRealtimeRoom<State> {
  override onCreate(): void {
    this.setState({ players: {} });
    this.onMessage("move", (client, payload) => {
      const me = this.state.players[client.id];
      const p = payload as { x?: unknown; y?: unknown };
      if (!me || typeof p.x !== "number" || typeof p.y !== "number") return;
      me.x = p.x; // the server owns the position — validate every field
      me.y = p.y;
      this.markStateChanged(); // synced to every client (coalesced)
    });
  }
  override onJoin(client: Client): void {
    this.state.players[client.id] = { x: 0, y: 0 };
    this.markStateChanged();
  }
  protected override onSeatExpired(client: Client): void {
    delete this.state.players[client.id]; // runs only if they never reconnect
    this.markStateChanged();
  }
}
```

Turn it into a Durable Object in your Worker with `defineRoom(Arena)` and bind it in
`wrangler.jsonc`. See [AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).

## Presets

- **`TurnBasedRoom`** — board/card/quiz. JSON sync on mutation, no tick.
- **`CasualRealtimeRoom`** — cursors/whiteboards/party games. Throttled ~20 Hz JSON +
  built-in reconnection.
- **`IoArenaRoom`** — `.io` arenas/shooters. Fixed-timestep `onTick`, binary delta
  `stateCodec`, input acks, and optional per-viewer interest management (AOI, anti-wallhack).

## Test your room — `@tikron/server/testing`

Unit-test room logic in-process — no Durable Object, no WebSocket, no network:

```ts
import { createTestRoom } from "@tikron/server/testing";

const h = await createTestRoom(Arena);
const alice = await h.connect("alice");
await alice.send("move", { x: 1, y: 2 });
await h.flush();
h.snapshot();          // deep copy of authoritative state
alice.lastState();     // what this client received
```

## Key API

`Room` (lifecycle: `onCreate` / `onJoin` / `onLeave` / `onReconnect` / `onDispose`;
`onMessage`, `setState` / `markStateChanged`, `broadcast`, `allowReconnection`,
`setSimulationInterval`, `enableAOI`; knobs `maxClients` / `maxInputsPerSecond` /
`syncIntervalMs` / `sendAcks` / `stateCodec`) · presets `TurnBasedRoom` /
`CasualRealtimeRoom` / `IoArenaRoom` · `defineRoom(RoomClass, options?)` ·
`validateMovement` · `createTestRoom` (from `@tikron/server/testing`).

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md) (operational brief).
Licensed **FSL-1.1-ALv2** (Functional Source License) — it converts to **Apache-2.0** two
years after each release. See LICENSE.
