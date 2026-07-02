# Performance — measured, 2026-07-02

Load-test results for the Tikron room engine, measured with
[`tools/loadtest`](../tools/loadtest) (N simulated players, 20 Hz inputs,
30 s runs). Commit under test: P1/P1b hardened core (`34829a0`).

> These are raw measurements. For what they mean for production decisions — the scale
> envelope, room placement, and transport trade-offs — see AGENTS.md → "Limits & roadmap".

Two environments:

- **Local** — `wrangler dev` (workerd) on the dev machine. Useful for *relative*
  comparisons and server-CPU cost (network RTT ≈ 0). **Not representative for
  multi-room load**: local workerd runs every DO in one process, so parallel
  rooms contend for one CPU (see "horizontal scaling" below).
- **Deployed** — real Cloudflare Workers + Durable Objects
  (`tikron-gateway.workers.dev`), measured from a residential connection in
  Korea. Absolute numbers include ~80 ms network RTT to the assigned edge/DO
  location; server-side cost is the local column.
  (These numbers were measured before the rename, when the worker was named
  `playedge-gateway`; the methodology and figures are unchanged.)

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

## Scenario: `movement` — no AOI (before the flush throttle: the failure case)

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

### After the flush throttle (`syncIntervalMs = 50`, same commit)

| players/room | env | ack RTT p50 | p95 | downlink/client | frames/s/client | unexpected closes |
|---|---|---|---|---|---|---|
| 64 | local | **6.0 ms** (was 85.8) | 11.2 | 26.0 KiB/s | **16.9** (was 741) | 0 |
| 32 | deployed | 80.2 ms | 93.3 | 14.6 KiB/s | ~21 | 0 |
| 64 | deployed | **83.3 ms** | 102.1 | 30.0 KiB/s | **~21** (was ~741) | **0 / 64** (was 58/64) |

The mechanism is the *event rate*, not raw bytes: coalescing flushes to a 50 ms
boundary cut broadcasts per client ~44× while each delta carries the same
information (bandwidth drops a more modest ~15–35%, since delta payloads grow
to cover the window). With the DO no longer drowning in per-input broadcast
work, local ack RTT at 64 players fell from 86 ms to 6 ms and the deployed
64-player room went from dropping 91% of its sockets to fully stable.

Regression check (agar, AOI): local 16-player p50 2.0 ms / 2.7 KiB/s (was
5.6 ms / 4.2 KiB/s); deployed 20-player p50 79.9 ms / 3.7 KiB/s and deployed
8×16 (128 CCU) p50 72.8 ms, p99 105.7, zero closes — strictly better across
the board. State cadence now locks to the 50 ms boundary (raw inter-arrival
p50 49.8 ms, jitter p50 ~1 ms).

### Protocol v2 / netcode-hardening addendum (2026-07-02, later same day)

Two semantics changed after the tables above were measured; the bandwidth and
stability numbers remain representative, but interpret ack RTT with this in mind:

- **Tick-aligned input queue** (IoArenaRoom): inputs now wait for the next
  simulation tick before being processed and acked, so input→ack includes up to
  one tick (50 ms) of queue wait *by design* — measured local agar 16-player ack
  p50 ~64 ms (was 5.6 ms with immediate dispatch). Client prediction masks this;
  the win is a consistent world per tick. Wall-clock responsiveness for players
  is governed by prediction, not ack RTT.
- **AOI is now grid-indexed** (uniform spatial hash, ~O(viewers + entities) per
  flush instead of O(viewers × entities)), with property tests asserting exact
  parity with the naive filter. Same-room numbers at ≤20 players are unchanged;
  the benefit grows with entity count.

## 100 players, one room — F1 hot-path pass (2026-07-02, local)

Target: FPS-grade server processing (<20 ms per tick+flush) at 100 CCU in a
single room. The F1 pass (shared TextEncoder/Decoder, global AOI change-guard,
one-pass `encodeDeltaOrNull`, codec-based baseline snapshots instead of
`structuredClone`, integer grid keys, incremental orb grid) plus a new in-room
`tk:stats` probe that reports real tick/flush durations from inside the DO.

| 100 players/room (local) | before F1 | after F1 |
|---|---|---|
| server tick processing p50 / max | (tick budget overrun) | **0 ms / 2 ms** |
| server flush processing p50 / max | — | **3 ms / 11 ms** |
| ack RTT p50 | 76.6 ms | 74.1 ms |
| ack RTT p95 / p99 / max | 271 / 893 / 1187 ms | **120 / 171 / 232 ms** |
| unexpected closes | 0 | 0 |

Readings:

- **Server processing is now 3–11 ms at 100 CCU** — the <20 ms FPS budget is
  met with 2× headroom before any structural (cell-sharing / priority) work.
- ack p50 barely moves because it is dominated by the *by-design* tick-queue
  wait (up to one 50 ms tick), not CPU; the tail (p95/p99) collapsing 2–5× is
  the CPU win.
- The ~62 ms local state cadence (vs the 50 ms `syncIntervalMs`) is a workerd
  timer artifact: it is identical at 20/50/100 players while flush cost is
  1–3 ms, and the deployed cadence measured 49.8 ms (above). Validate on real
  Cloudflare when the deployed 100-CCU gate runs.
- Sweep hygiene: back-to-back runs against one local workerd leave the previous
  room alive (reconnection windows + alarms), which fabricates stalls and mass
  closes in later runs. Trust solo runs (or long cooldowns) locally; deployed
  rooms are isolated DOs.

### Deployed 100 CCU, one room (same day, real Cloudflare DO)

Staging worker (`wrangler.staging.jsonc`: workers.dev, DEV_MODE, no D1),
measured from the same Korean residential connection:

| 100 players/room (deployed) | 3 s ramp | 10 s ramp |
|---|---|---|
| connect success / unexpected closes | 80/100 · 21 | **100/100 · 0** |
| ack RTT p50 / p99 / max | 90 / 137 / 296 ms | 97 / 144 / 319 ms |
| state cadence (raw gap p50) / jitter p50 | 48.8 ms / 3.5 ms | **48.4 ms / 6.0 ms** |
| server tick+flush (tk:stats) | 0 ms (all buckets) | 0 ms (all buckets) |
| ack spikes >1 s | 0 | 0 |

- **A single Durable Object holds 100 concurrent players cleanly**: 2,000
  incoming input msg/s + 2,000 outgoing state frames/s, sustained, with zero
  drops and the cadence locked at 50 ms. Production DO hardware is far faster
  than local workerd (tick+flush under the 1 ms measurement resolution).
- The 62 ms local cadence is confirmed as a workerd artifact (deployed locks
  at ~48.5 ms).
- The one real limit found: **connection admission**. 100 upgrades inside 3 s
  to one DO fails ~20% of connects and destabilizes early sockets; pacing
  joins over 10 s is fully clean. Mitigation (join pacing / client backoff)
  is an F3 work item — steady-state operation is not affected.

## 100 players, one room — F3 FPS stack (2026-07-02, deployed)

`fps` loadtest scenario against the deployed ShooterRoom (hitscan shooter:
20 Hz moves + 1 Hz subtick-timestamped shots resolved via lag-comp rewinds,
quant-coded state, AOI 600 with priority tiers `[{300,1},{600,4}]`,
AOI-filtered shot tracers). 100 players, one room, 45 s, 10 s ramp:

| metric | value |
|---|---|
| connect success / unexpected closes / spikes | **100/100 · 0 · 0** |
| server tick+flush (tk:stats) | 0 ms (all buckets) |
| ack RTT p50 / p99 / max | 136 / 213 / 483 ms |
| shot events delivered | ~3,200/s total (129,794 over the run) |
| downlink/client | 12.8 KiB/s (state + ~32 tracer events/s) |
| state frame gap p50 | 62 ms |

- **The full FPS feature stack holds at 100 CCU on one DO**: state fan-out +
  tiered AOI + per-field map deltas + subtick shot resolution, zero drops.
- The 62 ms frame gap (vs agar's 48.4 ms on the same infra) is the priority
  tiers working: viewers whose visible entities are all far-tier get their
  flush suppressed entirely that round (null delta → no send), so gaps mix
  50/100 ms. Near-tier updates stay at cadence.
- ack p50 136 ms (vs ~90 ms agar) includes shot/tick processing semantics of
  the shooter room; the tail (p99 213 ms, no spikes) is what matters for
  prediction-masked play.

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
