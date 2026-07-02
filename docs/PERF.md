# Performance — measured, 2026-07-02

Load-test results for the PlayEdge room engine, measured with
[`tools/loadtest`](../tools/loadtest) (N simulated players, 20 Hz inputs,
30 s runs). Commit under test: P1/P1b hardened core (`34829a0`).

Two environments:

- **Local** — `wrangler dev` (workerd) on the dev machine. Useful for *relative*
  comparisons and server-CPU cost (network RTT ≈ 0). **Not representative for
  multi-room load**: local workerd runs every DO in one process, so parallel
  rooms contend for one CPU (see "horizontal scaling" below).
- **Deployed** — real Cloudflare Workers + Durable Objects
  (`playedge-gateway.workers.dev`), measured from a residential connection in
  Korea. Absolute numbers include ~80 ms network RTT to the assigned edge/DO
  location; server-side cost is the local column.

Metrics: **ack RTT** = client input → server `s:ack` round trip (the
"responsiveness" number a player feels on top of their base ping).
**Jitter** = |state-frame gap − expected 50 ms|. **Downlink** = per-client
received bytes/s.

## Scenario: `agar` — the realistic case (binary delta + AOI + acks, 20 Hz sim)

| players/room | env | ack RTT p50 | p95 | p99 | downlink/client | errors |
|---|---|---|---|---|---|---|
| 2 | local | 1.1 ms | 2.7 | 5.4 | 1.4 KiB/s | 0 |
| 8 | local | 2.5 ms | 5.6 | 21.7 | 2.8 KiB/s | 0 |
| 16 | local | 5.6 ms | 9.9 | 23.9 | 4.2 KiB/s | 0 |
| 20 (cap) | local | 8.6 ms | 16.4 | 320 | 5.2 KiB/s | 0 |
| 2 | deployed | 79.9 ms | 86.0 | 103.8 | 1.3 KiB/s | 0 |
| 8 | deployed | 80.8 ms | 102.1 | 112.0 | 2.0 KiB/s | 0 |
| 16 | deployed | 59.4 ms | 71.6 | 83.4 | 3.2 KiB/s | 0 |
| 20 (cap) | deployed | 84.9 ms | 97.6 | 114.5 | 3.8 KiB/s | 0 |

Takeaways:

- **Server processing is cheap.** Local ack RTT (pure server cost) stays under
  ~9 ms p50 up to the 20-player cap; deployed RTT is dominated by network
  distance (~80 ms from this client), i.e. the engine adds single-digit ms.
- **A full 20-player AOI room is comfortable** on real infrastructure:
  p99 ≈ 115 ms including the network, zero errors, tick jitter pinned at the
  50 ms cadence.
- **AOI keeps bandwidth flat-ish**: 1.3 → 3.8 KiB/s per client from 2 → 20
  players (each client only receives its view, not the whole room).

## Horizontal scaling: 8 rooms × 16 players (128 concurrent)

| env | ack RTT p50 | p95 | p99 | connects | errors |
|---|---|---|---|---|---|
| local | **645 ms** | 3586 | 4602 | 128/128 | 0 |
| deployed | **81.9 ms** | 96.5 | 134.0 | 128/128 | 1 transient close |

The single most important measurement of the sweep. Locally, 8 simultaneous
simulations share one workerd process and collapse (p50 645 ms). On real
Cloudflare, each room is its own Durable Object placed independently — 128
concurrent players across 8 rooms behave like one 16-player room (p50 82 ms
vs 59–85 ms). **Rooms scale horizontally on the edge; never benchmark
multi-room capacity against `wrangler dev`.**

## Capacity enforcement under load

Driving 32/64/128 connections at a 20-cap agar room rejects exactly
12/44/108 of them with `room_full` + close 4002 while the 20 seated players
keep playing cleanly — the P1 room-side cap holds under connection storms,
not just in unit tests.

## Scenario: `movement` — no AOI, unthrottled flush (the failure case)

| players/room | env | ack RTT p50 | p95 | downlink/client | unexpected closes |
|---|---|---|---|---|---|
| 32 | local | 11.5 ms | 3492 | 20.5 KiB/s | 0 |
| 64 | local | 85.8 ms | 160 | 34.6 KiB/s | 0 |
| 32 | deployed | 61.2 ms | 80.7 | 17.2 KiB/s | 0 |
| 64 | deployed | 82.2 ms | 594 | **0.6 KiB/s** | **58 / 64** |

Before the sync throttle, `markStateChanged()` coalesced flushes only per
microtask, so the broadcast rate tracked the *input* rate: 64 players × 20 Hz
inputs → hundreds of full-room delta broadcasts/sec × 64 recipients. On real
Cloudflare the Durable Object's output path saturates and **58 of 64 sockets
were force-closed mid-run**. This motivated the tick-aligned flush throttle
(`syncIntervalMs`, default 50 ms) in the room core.

### After the flush throttle

<!-- TODO(next commit): before/after re-measurement of movement 32/64 and an
agar regression check, filled in once the syncIntervalMs change lands. -->

## Baselines

- `ttt-json` (turn-based, JSON sync, no tick): 77 B/s per idle client — a
  turn-based room's cost is effectively the WebSocket keepalive.
- Load generator ceiling: single Node process drove 128 concurrent
  clients with ≤16 ms max event-loop lag (metrics not generator-bound).

## Method notes / caveats

- One client machine (Windows 11, residential fiber, Korea), 30 s runs, one
  run per configuration — treat small deltas (<20%) as noise. The 16-player
  deployed run (p50 59 ms) vs its neighbors (80–85 ms) illustrates
  run-to-run routing variance.
- Deployed RTTs include the client's distance to the edge and the DO's
  placement; players closer to their room's DO will see proportionally less.
- Raw JSON reports for every run live in `tools/loadtest/results/`
  (gitignored); re-run the sweep with the commands in `tools/loadtest/README.md`.
