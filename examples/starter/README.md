# Tikron starter — deploy a multiplayer game in 5 minutes

A complete server-authoritative multiplayer game in ~150 lines: every player is
a colored cursor dot on a shared canvas, clicks splat paint everyone sees, and
seats survive reconnects. It runs on Cloudflare's edge — no servers to manage,
rooms spin up on demand in ~275 cities.

## Deploy it (≈5 minutes)

```bash
# 1. clone + install (~2 min)
git clone <this-repo> && cd tikron-platform
pnpm install

# 2. log in to Cloudflare (free tier works; opens a browser)
pnpm exec wrangler login

# 3. ship it (~1 min)
pnpm --filter tikron-starter deploy
```

Wrangler prints your URL — something like
`https://tikron-starter.<your-account>.workers.dev`. Open it on two devices
(or a phone + laptop) and watch the cursors. Add `?room=anything` to the URL to
get a fresh, isolated room per name.

## Run it locally

```bash
pnpm --filter tikron-starter dev     # http://localhost:8787 (open 2 tabs)
```

## How it works

```
src/arena-room.ts   the game — authoritative state + message handlers (~100 lines)
src/index.ts        Cloudflare Worker entry: defineRoom(...) + a router (~20 lines)
client/main.ts      browser client via @tikron/client (~90 lines)
public/index.html   a canvas
```

The loop that makes it multiplayer, in full:

```ts
// server — clients send intents, the server owns the state
this.onMessage("move", (client, payload) => {
  this.state.players[client.id].x = clamp01(payload.x);
  this.markStateChanged();               // -> synced to every client
});

// client
room.send("move", { x, y });
room.onStateChange((state) => render(state));
```

Because the server owns the state and validates every message, cheating by
packet forgery simply isn't a thing you have to bolt on later.

## Make it yours

- **Change the game:** everything game-specific lives in `arena-room.ts` —
  swap the state shape and handlers for your rules. Turn-based games work
  as-is (state syncs on mutation; no tick needed).
- **Realtime movement/physics:** call `this.setSimulationInterval(fn, 50)`
  for a fixed 20 Hz authoritative tick.
- **Bandwidth:** set `this.stateCodec` (from `@tikron/schema`) to switch
  from JSON to binary delta sync.
- **Big worlds / anti-wallhack:** `this.enableAOI(...)` sends each client only
  what it can see.
- **Matchmaking, prediction, interpolation:** see the flagship .io demo in
  `apps/gateway` (`/agar.html`) which uses the full stack.

## Test it

Unit-test your room in-process (no server, no network) with the
`@tikron/server/testing` harness — connect fake clients, send intents, assert on state:

```ts
import { createTestRoom } from "@tikron/server/testing";
import { ArenaRoomImpl } from "./src/arena-room.js";

const h = await createTestRoom(ArenaRoomImpl);
const p = await h.connect("player-1");
await p.send("move", { x: 0.3, y: 0.7 });
await h.flush();
expect(h.snapshot().players["player-1"]).toMatchObject({ x: 0.3, y: 0.7 });
```

To feel it under a bad network, add `networkConditions` to the client:
`new GameClient(host, { networkConditions: { latencyMs: 120, jitterMs: 30, lossRate: 0.05 } })`.
See AGENTS.md → "Test your room" for the full API.

## Reconnection, for free

Close the tab mid-game and reopen it: your dot (and everything about your
seat) is still there. The client stores a session key per tab and the room
holds the seat for 30 seconds:

```ts
override async onLeave(client: Client) {
  try {
    await this.allowReconnection(client, 30);   // resolves if they return
  } catch {
    delete this.state.players[client.id];       // window expired — real leave
  }
}
```
