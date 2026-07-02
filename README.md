# Tikron

**Source-available, server-authoritative multiplayer SDK for web games** (FSL-1.1 — free for any use except competing with Tikron, converts to Apache-2.0 after two years) — the "Supabase for
game netcode", but you self-host. You deploy game rooms to **your own Cloudflare account**
(Workers + Durable Objects) with a drop-in TypeScript SDK — your infrastructure, your bill,
no lock-in. Anti-cheat by construction (server authority + AOI information hiding). Optional
hosted services (leaderboards + a usage dashboard, keyed by API key) are the only managed
part — everything else runs on your account.

> **Live at [tikron.dev](https://tikron.dev)** — landing, playable [.io demo](https://tikron.dev/agar.html),
> [FPS demo](https://tikron.dev/shooter.html) (subtick lag compensation + AOI priority tiers),
> developer dashboard. Building a game with an AI agent? Start at [`AGENTS.md`](AGENTS.md).
> Measured: a single room holds **100 concurrent players cleanly on deployed Cloudflare**
> (0 drops, server tick+flush 0 ms) — see [`docs/PERF.md`](docs/PERF.md); never invent latency figures.

## Install (SDK v0.2.0)

```bash
npx create-tikron my-game        # scaffold a standalone game (recommended)
# or add the SDK to an existing project:
npm i @tikron/client @tikron/server @tikron/schema partyserver
```

The published `@tikron/*` packages are at **0.2.0**. Client and server share the wire
protocol — run the **same minor** on both sides (0.1.x and 0.2.x are not wire-compatible).

## Monorepo layout

```
packages/
  protocol/   @tikron/protocol — shared wire protocol (message tags, JSON + binary frames)
  client/     @tikron/client   — browser SDK (wraps PartySocket; prediction, clock sync, subtick)
  server/     @tikron/server   — authoritative room framework (presets, AOI, lag compensation)
  schema/     @tikron/schema   — binary delta state-sync (quant codec, per-field map deltas)
  sim/        @tikron/sim      — isomorphic movement math (shared client/server step + validation)
apps/
  gateway/    Cloudflare Worker + Durable Object rooms (agar / shooter / movement / tic-tac-toe)
              + matchmaker + platform API; serves the landing, demos, and dashboard
  dashboard/  developer dashboard (usage, API keys)
examples/
  starter/          "clone -> deploy in 5 min" cursor-arena template (see its README)
  discord-activity/ Discord Activity embed example
tools/
  create-tikron/    npx scaffolder for a standalone game (SDK from npm)
  loadtest/         WebSocket load-test harness (agar / movement / ttt / fps scenarios)
```

## Foundation

- **Runtime:** Cloudflare Workers + Durable Objects via [`partyserver`](https://github.com/cloudflare/partykit) (ISC).
- **Language:** TypeScript everywhere. **Package manager:** pnpm workspaces + Turborepo.
- **Tick model:** 20–30 Hz `setInterval` authoritative loop; 20 Hz state broadcast.

## Development

```bash
pnpm install
pnpm typecheck      # tsc across the workspace
pnpm test           # vitest (incl. workerd integration tests)
pnpm build          # turbo build

# run the edge gateway locally (workerd via wrangler)
pnpm --filter @tikron/gateway dev
```

## Node / toolchain

Node >= 22, pnpm 10.x, wrangler 4.x. See `.nvmrc`.

Licensed under the [Functional Source License 1.1](LICENSE.md) — free for any
purpose except offering a competing multiplayer-SDK/BaaS; each release converts to
Apache-2.0 after two years. Different terms (competing use, earlier Apache rights)?
Open an issue or contact the maintainers.
