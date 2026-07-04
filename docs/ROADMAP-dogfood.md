# Roadmap from dogfooding — what building a real game exposed

Source: 냠냠대전 (nyam-duel, https://nyam.tikron.dev) — a webcam face-tracking 1v1
game built entirely on the self-hosted golden path (create-tikron scaffold,
CasualRealtimeRoom, own Cloudflare account) over 2026-07-02/03. Every item
below is a gap a paying customer building the same class of game would hit.
Cross-references point at the game's repo (D:\nyam-duel) as the reference
implementation / extraction seed.

## Cost principle (governs everything below)

**Data plane on the customer's account; the platform ships control plane +
code.** Video (TURN relay) and image storage scale in GB with customer usage —
a per-GB cost the platform must never absorb on a free tier. This is the same
philosophy that puts rooms on the customer's account. Concretely:

- WebRTC/TURN support ships as SDK helpers + a BYO-key recipe (customer's own
  Cloudflare TURN key, customer's own 1TB/mo free tier), NOT a platform-hosted
  ICE service.
- Result-card/image sharing ships as a template running on the customer's R2,
  NOT a hosted upload service.
- The only platform features with real marginal cost (leaderboards → D1 rows)
  ship behind per-plan caps using the existing enforcement infra
  (`cap_room_hours` et al.).
- Control-plane APIs (matchmaking, key auth, usage ingest) are per-request
  Workers/D1 costs — negligible, fine to host.

## P0 — debt (zero cost, do first)

1. **Publish current packages to npm.** npm still serves 0.1.0; the
   `joinOrCreate` full-room hang fix (`RoomJoinError`, commit 6500590 lineage)
   and `platformReporter` are unpublished. Every new npm customer starts with
   a known hang bug. Monorepo is at 0.3.0 — reconcile and publish.
2. **Rate-limit budget: document or split.** One `maxInputsPerSecond` budget
   covers ALL developer message types per connection. A realtime game sending
   20 Hz inputs plus WebRTC signaling on the same socket silently drops ICE
   candidates (no acks by default → invisible). Short term: AGENTS.md budget
   math + "override to 60 for signaling-carrying rooms" guidance. Longer term:
   per-type budgets or a separate system-channel lane + drop counters.
   Case study: nyam-duel arena-room.ts `maxInputsPerSecond = 60` + calibrate-
   phase mouth throttling.

## P1 — the "webcam game" category (SDK code, zero marginal cost)

3. **`@tikron/rtc` helper package (BYO TURN).** Extract from nyam-duel:
   - perfect negotiation (client/rtc.ts — collision/rollback, ICE-restart
     budget, signal queueing during async create; battle-tested),
   - `iceProvider` recipe: the game's `/api/ice` Worker route (Cloudflare
     Calls `generate-ice-servers` mint from the CUSTOMER's TURN key secrets,
     30-min cache, STUN-only graceful fallback — src/index.ts),
   - docs: 5-minute TURN key setup (dash → Realtime → TURN key →
     `wrangler secret put` ×2).
4. **Built-in opaque peer relay** (`room.relay()` or a preset intent): server
   `from`-stamping, byte cap, phase gating — every P2P-augmented game
   hand-writes this today (nyam-duel arena-room.ts "rtc" handler is the
   template). Rides the existing WebSocket; no new cost.
5. **Self-hosted matchmaking (M4).** `matchmake()` only reserves
   gateway-hosted rooms; self-hosted games fall back to join-probing
   (nyam-duel net.ts quick-1..5). Shape: external room registry + seat
   reservation, tk_live-authenticated like `/api/ingest/occupancy` (which
   already carries live occupancy). Control-plane cost only.

## P2 — polish / onboarding

6. **Result-card sharing as a recipe, not a service.** Research (2026-07-03)
   says the winning share UX for KR mobile is a link that unfurls into a photo
   card (plus Kakao Share SDK for KakaoTalk specifically). Ship as a
   create-tikron optional template / documented Worker route: customer R2
   bucket, `GET /s/:id` SSR OG page, 24h object lifecycle. Platform-hosted
   version only if/when a paid plan exists to carry storage cost.
7. **Leaderboard ingest for self-hosted games** — same auth pattern as
   occupancy ingest, WITH per-plan caps via the existing enforcement layer.
   - **Boards-per-project cap = DONE** (this sprint): `free_leaderboard_boards`
     (default 50, config-adjustable); a brand-new board past the cap →
     `403 cap_leaderboard_boards`. Ingest is `POST /api/ingest/score`, a
     `tk_live_` (secret) key only — a `tk_pub_` key → `403 key_scope_forbidden`.
     Wire it from a self-hosted room with `platformLeaderboard()` (see
     AGENTS.md → Hosted leaderboards).
   - **submissions/day = still P2.** The shipped rate guard is an
     **isolate-local** token bucket (30/s, burst 60 → `429 cap_leaderboard_rate`),
     which stops per-second floods but is **not** a hard cross-isolate daily
     quota. An exact daily quota needs a dedicated Submits DO and lands with
     billing.
8. **create-tikron upgrades:**
   - **vitest + a sample `createTestRoom` test in the scaffold = DONE** (this
     sprint): every generated project ships `vitest.config.ts` (with a
     `cloudflare:workers` stub so a room-importing spec runs under plain Node
     vitest), a green `arena-room.test.ts`, and a `test` script.
   - **Secrets / headless-deploy how-to = DONE** (this sprint): the bundled +
     root `AGENTS.md` carry the `CLOUDFLARE_API_TOKEN` headless-deploy recipe.
   - **`--template webcam` variant** (camera pipeline + MediaPipe + relay +
     BYO-TURN pre-wired — nyam-duel is the source material) = **still P2**.
9. **Engine-state persistence pattern.** Only `this.state` survives DO
   eviction; in-memory tick engines (nyam-duel RoundEngine) lose a round on
   hard eviction. Document an `onRestore` + periodic snapshot pattern with an
   example.
10. **Dashboard: self-hosted rooms view.** Usage from `ext:{project}:{room}`
    ids already accrues; surface a read-only per-project rooms/usage breakdown.
11. **Showcase**: list nyam-duel as the first real-game case study when the
    showcase feature (in progress on a parallel branch) ships.

## Already shipped from this dogfood cycle

- `RoomJoinError` rejection path + terminal-close reconnect stop
  (packages/client) — fixed the full-room infinite hang.
- `POST /api/ingest/occupancy` + `platformReporter()` (self-hosted usage →
  dashboard) — commit 6500590, deployed to production 2026-07-03.
- **Launch-blocker sprint (2026-07-04):** self-host leaderboard ingest
  (`POST /api/ingest/score` + `platformLeaderboard()`, boards cap), schema/
  protocol handshake (`RoomJoinError("schema_mismatch"|"protocol_mismatch")`),
  room observability (`Room.onError`, `tk:stats.drops/errors`), `forcePersist()`,
  live `client.auth` identity, and scaffold test/headless-deploy wiring. Packages
  staged at 0.6.0 (lockstep publish user-gated).
