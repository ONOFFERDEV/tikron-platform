# @playedge/loadtest

A WebSocket load-testing harness for the PlayEdge gateway. It drives N simulated
players against a running gateway and reports latency, bandwidth, and stability
metrics — both as a human-readable table and a JSON report for later comparison.

## Quick start

Start the gateway first (in a separate terminal), and wait for it to print
`Ready on http://127.0.0.1:8787`:

```powershell
pnpm --filter @playedge/gateway dev
```

> Use `127.0.0.1`, not `localhost` — the harness defaults to `ws://127.0.0.1:8787`.

Then run a load:

```powershell
pnpm --filter @playedge/loadtest start -- --scenario agar --rooms 4 --players 32 --duration 30
```

Everything after `--` is passed to the harness.

## Scenarios

| `--scenario` | Room (party) | Wire | What it measures |
|---|---|---|---|
| `agar` (default) | `agar-room` | binary delta + AOI + acks | the flagship realtime target: input→ack RTT, 50 ms frame jitter, per-client bandwidth, decode + own-player sanity |
| `movement` | `movement-room` | binary delta, no AOI | same shape without interest management |
| `ttt-json` | `tic-tac-toe` | JSON state on mutation | turn-based baseline: JSON state fan-out (no fixed cadence, no acks) |

For `agar`/`movement`, each player runs a random walk. Per-input displacement is
capped under the room's speed budget (`maxSpeed × stepMs / 1000`, ×0.9 headroom)
so the server's `validateMovement` does not reject and snap the player back.

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--scenario <name>` | `agar` | `agar` \| `movement` \| `ttt-json` |
| `--url <base>` | `ws://127.0.0.1:8787` | gateway base URL (no path) |
| `--rooms <n>` | `1` | parallel rooms |
| `--players <n>` | `8` | players per room |
| `--duration <s>` | `30` | steady-state duration (seconds) |
| `--hz <n>` | `20` | input rate per client (room caps inputs at 30/s) |
| `--ramp <s>` | `3` | connection ramp-up window (seconds) |
| `--workers <n\|auto>` | `auto` | worker_threads shards (see Sharding) |
| `--room-prefix <s>` | unique per run | room id prefix (rooms are `<prefix>-r0`, `-r1`, …) |
| `--out <path>` | `results/<ts>-<scenario>.json` | JSON report path |
| `--help` | | print usage |

## Metrics

- **Input→ack RTT** (p50/p95/p99/max): time from sending an input `seq` to the
  matching `s:ack`. Only `agar`/`movement` set `sendAcks`.
- **State-frame jitter** (p50/p95/p99/max): `|gap − expected|` where `expected`
  is the 50 ms simulation cadence. Raw inter-arrival gaps are reported too.
- **Bandwidth**: downlink/uplink bytes per second (total and per client),
  counting raw frame sizes. Averaged over the steady-state window (ramp-phase
  bytes are excluded).
- **Stability**: connect success/failure, unexpected closes, protocol errors
  (bad JSON / `s:error`), and binary decode errors.
- **Sanity** (`agar`/`movement`): counts of decoded frames in which this client's
  own player is present. (The very first full snapshot arrives before the server
  runs `onJoin`, so its own-player absence is expected and not counted.)

The JSON report contains the full run config plus every percentile block, so
sweeps can be diffed and later written into `docs/PERF.md`.

## Sharding

A single Node event loop comfortably drives ~512 WebSocket clients at 20 Hz, so
`--workers auto` stays **single-threaded up to 512 connections** and reports the
max observed event-loop lag as a self-check (a low value confirms the loop was
not saturated). Above 512 it shards clients round-robin across
`worker_threads` (capped at CPU count); each worker drives its slice and posts a
metrics bundle back to the main thread, which merges raw samples before computing
percentiles (so merged percentiles stay exact). Force a specific shard count with
`--workers <n>`.

## How it runs

TypeScript is executed directly with [`tsx`](https://tsx.is) (no build step) —
one approach that works the same on Windows PowerShell and POSIX shells. The tool
depends on the `@playedge/schema` codec package and **re-declares** the Agar and
Movement state schemas locally (`src/schemas.ts`) so it does not import Durable
Object source from `apps/gateway`. Those local schemas must stay in lock-step with
the server codecs — the binary layout is positional.

Typecheck (also run by `pnpm typecheck` at the repo root):

```powershell
pnpm --filter @playedge/loadtest typecheck
```
