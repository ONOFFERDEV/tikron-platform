# create-tikron

Scaffold a standalone [Tikron](https://tikron.dev) multiplayer game — server-authoritative
game rooms on Cloudflare Workers + Durable Objects, deployed to your own Cloudflare account.

## Usage

```bash
npx create-tikron my-game
cd my-game
npm install     # or pnpm / yarn / bun
npm run dev     # http://127.0.0.1:8787 (open 2 tabs)
```

By default this generates a **standalone** project whose `@tikron/*` dependencies install
from npm — no monorepo, no clone. Then edit `src/arena-room.ts` (your game) and
`npm run deploy` to ship it to your Cloudflare account.

### What you get

```
src/index.ts        Worker entry: defineRoom(ArenaRoomImpl) + a router
src/arena-room.ts   the game — a CasualRealtimeRoom (state + onMessage handlers)
client/main.ts      browser client via @tikron/client
public/index.html   a canvas
wrangler.jsonc      Cloudflare config (DO binding + assets)
tsconfig(.client).json
package.json        @tikron/* deps at ^0.1.0, dev/deploy/build scripts (esbuild + wrangler)
```

### Options

| Flag | Meaning |
|---|---|
| `--into <dir>` | Parent directory for the new project (default: current dir). |
| `--clone` | Instead, shallow-clone the whole Tikron platform repo (SDK + demos) — for exploring internals or contributing. |
| `--repo <git-url>` | Repo URL for `--clone` (overrides `repository.url` in this package's `package.json`). |
| `-h`, `--help` | Show help. |

## How the templates ship

The generated project files live in this package's [`templates/`](templates) directory
and are listed in `files`, so they travel inside the published npm tarball — the
scaffolder needs nothing but Node and works entirely offline (beyond your `npm install`).
`package.json` is generated in code (project name + pinned dependency versions); the rest
are copied verbatim, with the project name substituted into `wrangler.jsonc`.

The scaffolder itself has **zero runtime dependencies** (Node ≥ 22 built-ins only) and
builds to `dist/index.js` with a `#!/usr/bin/env node` shebang.
