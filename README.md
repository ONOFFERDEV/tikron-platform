# Tikron

Realtime multiplayer **BaaS for web games** — the "Supabase for game netcode". Web-first,
server-authoritative game rooms delivered on the edge (Cloudflare Workers + Durable Objects),
with a drop-in TypeScript SDK. Built-in anti-cheat by construction (server authority + AOI
information hiding), honest defense-in-depth positioning.

> **Live at [tikron.dev](https://tikron.dev)** — landing, playable .io demo, developer dashboard.
> Building a game with an AI agent? Start at [`AGENTS.md`](AGENTS.md).
> Measured performance: [`docs/PERF.md`](docs/PERF.md).

## Monorepo layout

```
packages/
  protocol/   @tikron/protocol — shared wire protocol (message tags, codec)
  client/     @tikron/client   — browser SDK (wraps PartySocket)
  server/     @tikron/server   — authoritative room framework (M1+)
  schema/     @tikron/schema   — binary delta state-sync (M2+)
  react/      @tikron/react    — React hooks (M2+)
  matchmaker/ registry + seat reservation (M4+)
apps/
  gateway/    Cloudflare Worker + GameRoom Durable Object (partyserver)
  demos/      reference games (flagship: realtime .io) (M3+)
examples/
  starter/    "clone -> deploy in 5 min" template (see its README)
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
