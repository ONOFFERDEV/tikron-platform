# Loopback capacity evidence

Capacity runs use a frozen server stage and a combined Wrangler stdout/stderr log. Run them only during the assigned quiet CPU window, with browsers, renders, and other load generators stopped. Never point the tool at a shared or deployed preview.

The frozen stage must have a `server-stage-manifest.json` created from its complete server module graph. Copy that exact manifest into the evidence directory before starting Wrangler. The load tool hashes it, creates a unique run ID, records UTC start and finish times, and captures the exact byte range appended to the server log. It also writes a `capacity-<scenario>.server.log` sidecar. The performance gate independently hashes that sidecar and recomputes the startup, health, matchmake, WebSocket, backlog, socket, traffic, timing, close, and server-drop checks.

PowerShell example for the required 180-second normal run:

```powershell
$stage = 'D:/path/to/frozen-server-stage'
$evidence = 'D:/webgame-baas/.omo/evidence/ww1/task-38/final-capacity'
$serverLog = Join-Path $evidence 'wrangler-8896-combined.log'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
Copy-Item -LiteralPath (Join-Path $stage 'server-stage-manifest.json') -Destination (Join-Path $evidence 'server-stage-manifest.json')

$server = Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
  '/d', '/s', '/c',
  "cd /d `"$stage`" && pnpm exec wrangler dev --config wrangler.next.jsonc --port 8896 --local > `"$serverLog`" 2>&1"
)
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8896/api/health' | Out-Null
$processes = Get-CimInstance Win32_Process
$ownedPids = @($server.Id)
do {
  $children = @($processes | Where-Object { $ownedPids -contains $_.ParentProcessId } | Select-Object -ExpandProperty ProcessId)
  $newPids = @($children | Where-Object { $ownedPids -notcontains $_ })
  $ownedPids += $newPids
} while ($newPids.Count -gt 0)

node tools/ironsight-load.mjs `
  --url http://127.0.0.1:8896 `
  --clients 12 `
  --seconds 180 `
  --scenario normal `
  --server-log $serverLog `
  --source-manifest (Join-Path $evidence 'server-stage-manifest.json') `
  --out (Join-Path $evidence 'capacity-normal.json')

$ownedPids | Sort-Object -Descending | ForEach-Object { Stop-Process -Id $_ -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 8896 -ErrorAction SilentlyContinue
```

Keep the named launcher PID, any child workerd PID, the combined log, the generated server-log sidecar, the JSON report, and the source manifest in the evidence receipt. A missing sidecar, changed hash, stale timestamp, different source hash, unrelated log, replaced or truncated log, absent startup or health record, or insufficient request records makes the report `UNQUALIFIED`. A structurally valid run whose measured invariant fails is `FAIL`.

The normal scenario requires 12 joined and closed sockets, at least 180 requested seconds, real gameplay traffic, server stats, zero server drops, zero client errors, zero final socket backlog, clean close code 1000, and zero simulation backlog warnings. The old hot-reloaded 180-second run and frozen 12-by-10-second diagnostic remain invalid and must stay in their original evidence paths.
