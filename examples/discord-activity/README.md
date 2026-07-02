# PlayEdge — Discord Activity template

A multiplayer **Discord Activity** in ~200 lines: everyone in a voice channel is a
colored, name-labeled cursor on a shared canvas. Built on PlayEdge (server-authoritative
rooms on Cloudflare Workers + Durable Objects). One voice channel = one room, created on
demand at the edge.

The room extends the **`CasualRealtimeRoom`** preset from `@playedge/server`: everyone
moves freely, state syncs on change (throttled JSON, no physics tick), and a dropped
player's seat is held for 30 s so a blip inside Discord doesn't wipe them.

## Run it in a plain browser first (dev fallback)

Discord Activities can't fully run outside Discord, so this template has a `?dev=1`
fallback that skips the Discord SDK and behaves like the plain starter:

```bash
pnpm install
pnpm --filter playedge-discord-activity dev      # http://127.0.0.1:8787
# open http://127.0.0.1:8787/?dev=1 in two tabs
```

Everything Discord-specific is isolated in [`client/discord.ts`](client/discord.ts); the
game and render code in `client/main.ts` is identical in both modes.

## Ship it as a Discord Activity (~15 minutes)

### 1. Create the Discord app

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New
   Application**.
2. Copy the **Application ID** (this is your public *client id*).
3. **OAuth2** → copy the **Client Secret** (keep it secret — server only).

### 2. Enable Activities + URL mapping

4. Your app → **Activities** → **Settings** → toggle **Enable Activities**.
5. **Activities → URL Mappings** → add: **PREFIX** `/` → **TARGET** your deployed host,
   e.g. `playedge-discord-activity.<your-account>.workers.dev` (host only, no `https://`).
   This is what lets the sandboxed iframe reach your worker through the Discord proxy.

### 3. Configure the client id + secret

6. Set the client id in **two** places (they must match the portal Application ID):
   - Browser: edit [`public/config.js`](public/config.js) →
     `globalThis.__DISCORD_CLIENT_ID__ = "<your-application-id>"`.
   - Worker (for the token exchange): set `DISCORD_CLIENT_ID` in
     [`wrangler.jsonc`](wrangler.jsonc) `vars`.
7. Set the secret on the worker (never commit it):
   ```bash
   pnpm --filter playedge-discord-activity exec wrangler secret put DISCORD_CLIENT_SECRET
   ```

### 4. Deploy

```bash
pnpm exec wrangler login                          # once
pnpm --filter playedge-discord-activity deploy    # -> https://<name>.<account>.workers.dev
```

Make sure the deployed host matches the URL Mapping target from step 5. Rename the
deployment via `name` in `wrangler.jsonc`.

### 5. Launch in a voice channel

8. Discord (desktop) → **User Settings → Advanced** → enable **Developer Mode** and
   **Application Test Mode** (paste your Application ID, click Activate). This makes your
   unpublished Activity visible to you.
9. Join any **voice channel** → click the **Rocket** button (Activity shelf) → pick your
   app. It launches inside Discord and runs the handshake below.

## How the handshake + proxy-aware URLs work

- **Handshake** (`client/discord.ts`): `new DiscordSDK(clientId)` → `ready()` →
  `commands.authorize({ scope: ["identify", "guilds"] })` returns a `code` → the worker's
  `POST /api/token` exchanges that code for an `access_token` (using the client secret,
  which never touches the browser) → `commands.authenticate({ access_token })` returns the
  user. We use `discordSdk.channelId` as the room id and the user's `global_name` as the
  display name (the server re-validates length/charset — see `cursor-room.ts`).
- **Proxy-aware base URL** (`partyPrefix` / `httpBase` in `client/discord.ts`): inside
  Discord the app runs in a sandboxed iframe on `<clientId>.discordsays.com`, and every
  request is routed through the Discord proxy. The template prefixes its WebSocket path
  with `.proxy/parties/…` and its token fetch with `/.proxy/api/token`; with the URL
  Mapping from step 5 the proxy forwards those to `<your-host>/parties/…` and
  `<your-host>/api/token`. In the `?dev=1` fallback there is no proxy, so it uses the
  plain `parties` prefix and hits the local worker directly. (Discord made the `.proxy/`
  prefix optional in July 2025, but it still works on every client, so this template keeps
  it for maximum compatibility.)

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank iframe / Activity never loads | URL Mapping wrong | Portal → Activities → URL Mappings: PREFIX `/` → TARGET must be your exact deployed host (no `https://`, no trailing slash), and the app must actually be deployed there. |
| Auth loop / `authorize` fails | Client id mismatch | The Application ID must be identical in `public/config.js`, `wrangler.jsonc` `vars.DISCORD_CLIENT_ID`, and the portal. Also confirm Activities is enabled. |
| `POST /api/token` → 500 `discord_not_configured` | Missing server credentials | Set `DISCORD_CLIENT_ID` (var) and `DISCORD_CLIENT_SECRET` (`wrangler secret put`) on the worker, then redeploy. |
| 404 on the WebSocket connect | Party name mapping | The DO binding `CursorRoom` maps to party `cursor-room`; the client's `party` option must be exactly `"cursor-room"`. |
| Works with `?dev=1` but not in Discord | Proxy/mapping, not game logic | The dev fallback bypasses the proxy — a Discord-only failure points at the URL Mapping, client id, or secret, not the room code. |

## Files

```
src/index.ts        worker: defineRoom(CursorRoomImpl) + POST /api/token (OAuth2 exchange)
src/cursor-room.ts  the game — a CasualRealtimeRoom (onCreate / onJoin / onSeatExpired)
src/palette.ts      shared player palette (server assigns an index, client renders it)
client/discord.ts   ALL Discord-specific code: handshake + proxy-aware transport/URLs
client/main.ts      boot (Discord vs ?dev=1 fallback) + canvas render
public/index.html    canvas + relative script tags (proxy-safe)
public/config.js     the (public) Discord client id, injected before the bundle
```
