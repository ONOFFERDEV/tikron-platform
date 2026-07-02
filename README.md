# PlayEdge (working name)

Realtime multiplayer **BaaS for web games** — the "Supabase for game netcode". Web-first,
server-authoritative game rooms delivered on the edge (Cloudflare Workers + Durable Objects),
with a drop-in TypeScript SDK. Built-in anti-cheat by construction (server authority + AOI
information hiding), honest defense-in-depth positioning.

> Status: **M0–M4 complete** — engine + flagship .io demo + matchmaking; 54 tests green.
>
> **Continuing on a new machine? Read [`docs/HANDOFF.md`](docs/HANDOFF.md) first.**
> Full design: [`docs/PLAN.md`](docs/PLAN.md) · Market & decisions: [`docs/RESEARCH.md`](docs/RESEARCH.md).

## Monorepo layout

```
packages/
  protocol/   @playedge/protocol — shared wire protocol (message tags, codec)
  client/     @playedge/client   — browser SDK (wraps PartySocket)
  server/     @playedge/server   — authoritative room framework (M1+)
  schema/     @playedge/schema   — binary delta state-sync (M2+)
  react/      @playedge/react    — React hooks (M2+)
  matchmaker/ registry + seat reservation (M4+)
apps/
  gateway/    Cloudflare Worker + GameRoom Durable Object (partyserver)
  demos/      reference games (flagship: realtime .io) (M3+)
examples/     "clone -> deploy in 5 min" starter templates (M6+)
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
pnpm --filter @playedge/gateway dev
```

## Node / toolchain

Node >= 22, pnpm 10.x, wrangler 4.x. See `.nvmrc`.
