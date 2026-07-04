# COSTS.md — what a Tikron room costs on your Cloudflare account

Tikron rooms run on **your** Cloudflare account, so **you** pay Cloudflare directly
for them — there is no Tikron markup on room compute (the only managed billing, if you
opt in, is the hosted dashboard/leaderboards). This doc is the honest per-room cost
model so you can size rooms and plans.

Every number here is derived from Cloudflare's published **Durable Objects pricing**
and is a **marginal (overage) rate** — the Workers Paid plan ($5/mo) includes a free
allowance (below) that a low-traffic game never exceeds. **Rates change; verify against
<https://developers.cloudflare.com/durable-objects/platform/pricing/> before quoting a
customer.** Verified-vs-estimated is called out per line at the bottom.

## What Cloudflare bills for a room

A room is one Durable Object. Cloudflare bills a DO on two axes:

1. **Duration (GB-s)** — wall-clock time the object is in memory *and unable to
   hibernate*. A Tikron room **cannot hibernate** (see "Hibernation" below), so a
   populated room is billed for duration **continuously**, message volume or not.
2. **Requests** — **1 request per WebSocket connection opened**, plus **inbound
   WebSocket messages counted 20:1** (20 client→server messages = 1 billable request).
   **Outbound messages are free** — your state fan-out and `broadcast()` to N clients
   cost **$0** in requests. Incoming WebSocket protocol pings are also free.

Free allowance on **Workers Paid** ($5/mo, per account, shared across all your DOs):
**400,000 GB-s/month** duration + **1,000,000 requests/month**. The per-unit rates
below apply only *past* that allowance.

| Axis | Free (Paid plan) | Marginal rate |
|---|---|---|
| Duration | 400,000 GB-s / mo | **$12.50 / million GB-s** |
| Requests | 1,000,000 / mo | **$0.15 / million** |

## Duration math (per room-hour)

A DO is billed for its allocated **128 MB = 0.125 GB** regardless of actual memory use.
Pinned continuously for one hour:

```
0.125 GB × 3600 s              = 450 GB-s per room-hour
450 GB-s × $12.50 / 1,000,000  = $0.005625 per room-hour
```

**Duration is independent of CCU** — one 128 MB object whether it holds 2 players or
100. The free allowance covers **≈ 888 room-hours/month** (400,000 ÷ 450) before any
duration overage.

## Request math (per client) — the load-bearing part

This is where the earlier "≈ $0.0058/room-hour, duration only" estimate **undercounted**
a realtime room: inbound messages bill on top of duration. For a client sending `R`
inbound messages per second:

```
R msg/s × 3600 s               = R × 3600 inbound messages / client-hour
(R × 3600) ÷ 20                = R × 180 billable requests / client-hour   (the 20:1 rule)
R × 180 × $0.15 / 1,000,000    = R × $0.000027 per client-hour
```

At a typical **20 Hz** input stream (`R = 20`, one `send()` per 50 ms): **$0.00054 per
client-hour**. Connection opens add **1 request each** — negligible for a stable room
(20–100 opens amortized over an hour), but a churny room that cycles players pays one
extra request per join.

## Preset examples (per room-hour, marginal)

A **20 Hz realtime room** (`CasualRealtimeRoom` cursor/party, or an `IoArenaRoom` client
sending ~20 inputs/s), each client at `R = 20` inbound msg/s:

| CCU | Duration | Requests (`CCU × $0.00054`) | **Total / room-hour** |
|---|---|---|---|
| 20  | $0.005625 | $0.0108 | **≈ $0.016** |
| 64  | $0.005625 | $0.0346 | **≈ $0.040** |
| 100 | $0.005625 | $0.0540 | **≈ $0.060** |

Notes:
- **Requests dominate at realtime CCU** — at 100 CCU the inbound stream is ~10× the
  duration cost. An `IoArenaRoom` at 30 Hz (`R = 30`, near `maxInputsPerSecond = 30`)
  scales the request column by 1.5× (100 CCU ≈ $0.086/room-hour).
- **A `TurnBasedRoom` is essentially duration-only** (`R ≈ 0`, a message per turn): ~
  $0.0056/room-hour while populated — and usually inside the free allowance entirely.
- These are **marginal** rates. A game under ~888 populated room-hours *and* ~1M
  inbound-÷-20 requests per month pays **$0** beyond the $5 Paid plan.

## Levers that actually move the bill

- **`inputBatchMs` (client)** coalesces a burst of `send()`s into one `c:mbatch` frame,
  cutting the DO's **inbound request rate** — the thing you're billed on. A client that
  generates 60 raw input events/s but batches at ~33 ms (~30 Hz frames) halves its
  request cost versus unbatched. (The 20:1 divisor already gives a 20× cushion, so
  requests only bite at high send-rate × high CCU.)
- **Fan-out is free.** Broadcasting state to every client is an *outbound* cost, which
  Cloudflare doesn't bill as requests — so high-CCU cost is driven by **inbound** client
  sends, not by the room's fan-out. Don't fear `broadcast()`; watch client send cadence.
- **`syncIntervalMs` / `tickMs` change outbound cadence only** — they don't change the
  bill. Do **not** raise them hoping to save money; it's the client's *inbound* send rate
  (`R`) that's billed. Lower `R` (batch inputs, throttle non-gameplay phases) instead.
- **Fewer, fuller rooms** cut duration (one object's $0.0056/hr amortized over more
  players); **shorter sessions** cut both axes. Room size vs count is otherwise a
  latency/scale decision (see AGENTS.md "Scale envelope"), not a cost one — duration is
  per-object-hour regardless of occupancy.

## Hibernation: does it help a Tikron room? No.

Cloudflare's **WebSocket Hibernation API** lets an idle DO evict from memory and stop
duration billing. A Tikron room is disqualified from hibernating on **two independent
grounds**, so hibernation would save **$0**:

1. Realtime presets run a `setInterval` tick — a scheduled callback blocks hibernation
   ("no way to recreate the callback after hibernating").
2. Tikron uses the **standard** WebSocket API (`server.accept()`), which is *itself* a
   disqualifying condition regardless of the tick.

Because of (2), **even a `TurnBasedRoom` with no tick is duration-billed the whole time
at least one client is connected** — "idle ≈ WS keepalive" in the preset table means the
object stays pinned, not free. When the last client leaves, the object goes idle and the
runtime evicts it after ~1–2 minutes; duration billing stops then. Net: **a room costs
while it's populated, plus a short idle tail before eviction** — it does not accrue cost
sitting empty. Switching *only* the WebSocket layer to the Hibernation API while a tick
runs changes nothing; hibernation's benefit is for connections that genuinely idle for
10s+ stretches, which a live realtime room never does.

## Verified vs estimated

| Claim | Status | Basis |
|---|---|---|
| Duration $12.50/M GB-s, $0.005625/room-hour @ 128 MB | **Verified** | CF DO pricing page (rate + footnote 5: billed for 128 MB regardless of use) + arithmetic |
| Requests $0.15/M; 1 req per WS open; outbound & pings free | **Verified** | CF DO pricing page, Requests row + footnote 2 |
| **20:1 applies to the standard (non-hibernation) WS**, not just the Hibernation API | **Verified by inference** | CF footnote 2 is unqualified; pricing "Example 3" applies ÷20 to a continuously-active non-hibernating WS. No single explicit sentence — proven by the worked example vs the hibernating "Example 4" |
| Hibernation saves $0 with an always-on tick + standard WS | **Verified** | CF "Lifecycle of a Durable Object" — two independent disqualifying conditions listed |
| Free allowance 400,000 GB-s + 1M requests/mo (Paid) | **Verified** | CF DO pricing page, per-axis free tiers |
| Preset totals (20/64/100 CCU) | **Estimated** | Verified rates × an assumed `R = 20` msg/s client send rate — your game's real inbound rate drives the request column |

**Sources** (fetched 2026-07-04, `dateModified` 2026-06-19 / 2026-07-03):
Durable Objects Pricing <https://developers.cloudflare.com/durable-objects/platform/pricing/> ·
Lifecycle of a Durable Object <https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/> ·
Use WebSockets <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>.
Re-verify before quoting — Cloudflare revises pricing pages.
