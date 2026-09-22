# Loopback capacity evidence

Capacity runs use a frozen server stage and a combined Wrangler stdout/stderr log. Run them only during the assigned quiet CPU window, with browsers, renders, and other load generators stopped. Never point the tool at a shared or deployed preview.

The frozen stage must have a `server-stage-manifest.json` created from its complete server module graph. Copy that exact manifest into the evidence directory before starting Wrangler. The load tool hashes it, creates a unique run ID, records UTC start and finish times, and captures the exact byte range appended to the server log. It also writes a `capacity-<scenario>.server.log` sidecar. The performance gate independently hashes that sidecar and recomputes the startup, health, matchmake, WebSocket, backlog, socket, traffic, timing, close, and server-drop checks.

PowerShell example for the required 180-second normal run:

```powershell
$stage = 'D:/wt-ironsight-ulw/apps/ironsight/.inspect/ulw/frozen-server-stage'
$evidence = 'D:/wt-ironsight-ulw/apps/ironsight/.inspect/ulw/capacity-rerun'
$serverLog = Join-Path $evidence 'wrangler-8805-combined.log'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
Copy-Item -LiteralPath (Join-Path $stage 'server-stage-manifest.json') -Destination (Join-Path $evidence 'server-stage-manifest.json')

$server = Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
  '/d', '/s', '/c',
  "cd /d `"$stage`" && pnpm exec wrangler dev --config wrangler.next.jsonc --port 8805 --local > `"$serverLog`" 2>&1"
)
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8805/api/health' | Out-Null
$processes = Get-CimInstance Win32_Process
$ownedPids = @($server.Id)
do {
  $children = @($processes | Where-Object { $ownedPids -contains $_.ParentProcessId } | Select-Object -ExpandProperty ProcessId)
  $newPids = @($children | Where-Object { $ownedPids -notcontains $_ })
  $ownedPids += $newPids
} while ($newPids.Count -gt 0)

node tools/ironsight-load.mjs `
  --url http://127.0.0.1:8805 `
  --clients 12 `
  --seconds 180 `
  --scenario normal `
  --server-log $serverLog `
  --source-manifest (Join-Path $evidence 'server-stage-manifest.json') `
  --out (Join-Path $evidence 'capacity-normal.json')

$ownedPids | Sort-Object -Descending | ForEach-Object { Stop-Process -Id $_ -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 8805 -ErrorAction SilentlyContinue
```

Keep the named launcher PID, any child workerd PID, the combined log, the generated server-log sidecar, the JSON report, and the source manifest in the evidence receipt. A missing sidecar, changed hash, stale timestamp, different source hash, unrelated log, replaced or truncated log, absent startup or health record, or insufficient request records makes the report `UNQUALIFIED`. A structurally valid run whose measured invariant fails is `FAIL`.

The normal scenario requires 12 joined and closed sockets, at least 180 requested seconds, real gameplay traffic, server stats, zero server drops, zero client errors, zero final socket backlog, clean close code 1000, and zero simulation backlog warnings. The old hot-reloaded 180-second run and frozen 12-by-10-second diagnostic remain invalid and must stay in their original evidence paths.

## Stats timing proof

`statsCoverage.timingModel` is `causal-request-reply-v1`. Server `measuredAtMs` / `measuredAtEpochMs` and collector `receivedAtMs` belong to independent clocks. Their absolute values are retained for audit and are never directly ordered against each other. A collector receipt 1–2 ms before the server's epoch reading is therefore not evidence of time travel.

The existing `tk:stats` handler samples while handling its request and sends that sample in its reply. The collector permits one outstanding stats request per socket, records its input `requestSeq`, `requestedAtMs` (collector wall clock), `requestedAtMonotonicMs` and `receivedAtMonotonicMs` (both collector `performance.now()`), and pairs the next reply with that request. The server protocol is unchanged. An attempted overlapping request is not transmitted and records `stats_request_pending`; an unsolicited/duplicate response records `unmatched_tk_stats`. These errors keep normal/impairment qualification false. The nominal one-second request schedule and gameplay traffic are unchanged.

If `s` is request-send time, `r` is reply-receipt time and `w` is the SDK's rolling-window duration in elapsed milliseconds, the measurement occurred in `[s, r]`. The guaranteed coverage interval is **`[r - w, s]`**. Coverage must span the complete active collector-monotonic interval with no holes. For tick-rate attribution, the entire possible outer interval **`[s - w, r]`** must lie inside the active interval. Using the inner interval for rate attribution would wrongly include an uncertain boundary window.

`maxRoundTripUncertaintyMs` reports the largest `r - s`; every raw bracket remains in the snapshots. No estimated midpoint, epoch offset clamp, or extra tolerance is used. Missing/nonfinite/reversed brackets, nonpositive or repeated request sequences, overlapping requests, nonadvancing/replayed server measurements, inconsistent server clock progress, and round trips at least as long as the stats window cannot qualify. Server monotonic-versus-epoch *duration* sanity and collector active-clock-span sanity retain their preexisting limits; neither compares independent absolute epochs. Elapsed window milliseconds follow the SDK monotonic-duration contract. A snapshot whose window erodes to nothing is insufficient proof.

Fresh reports expose `activeStartMonotonicMs`, `activeEndMonotonicMs` and `coveredUntilMonotonicMs`; the old `coveredUntilEpochMs` is not synthesized. Legacy reports lacking request brackets cannot gain a PASS through reclassification. Keep their original files, source archive and classifier receipt; generate a separate new report after the correction. Do not fill missing brackets from nominal tick numbers.

Tick/flush p99 limits remain **10 ms**, max limits remain **25 ms**, and each wholly active tick window must still be within **one sample of `windowMs / 50`**. This is the existing sampled tick-rate criterion; it is not a new measurement of pure CPU time or simulation-step count. Drops, client errors, cadence skips, backlog warnings, manifest checks and close checks remain binding. Corrected timing qualification does not fix server performance.

## Three-second disconnect proof

Each socket records collector-monotonic connection request, open, welcome, close request, unusable-transport boundary and close-event completion separately. `requestTransportClose` records the unusable boundary immediately after native `close()` returns with `CLOSING`/`CLOSED`; it does not pretend that a still-OPEN socket is unavailable. `closedAt` and `closedAtMonotonicMs` remain the actual close event, even when that handshake completes during or after rejoining.

The collector schedules reconnect from measured elapsed time, only once at least **3,000 ms** have passed since the unusable boundary. Qualification requires the reconnect **attempt** to be at least 3,000 ms later, with open after attempt and welcome after open, plus the same nonempty session ID. An early reconnect/open followed by a slow welcome fails. Missing boundary proof, impossible event ordering or a 2,999.999 ms outage fails; legacy close-event gaps do not substitute for the missing proof. This certifies a client transport outage, not when the remote server finished observing its close handshake.

After the normal run, the exact short collector rerun is the same command with `--scenario disconnect --seconds 8 --clients 12` and a fresh output such as `capacity-disconnect.json`. Both runs require the named quiet-window server/log/manifest owner and separate evidence; a rerun must not overwrite the original failed reports.
