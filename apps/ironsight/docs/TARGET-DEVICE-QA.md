# Target device QA

Task 39 qualifies only an actual, named laptop running the game on its integrated GPU. A desktop result, an RTX 5070 result, SwiftShader, an emulated viewport, or a missing device manifest remains `UNQUALIFIED`.

The input report must identify the manufacturer, laptop model, CPU, RAM, OS, AC-power state, performance mode, all display adapters and driver versions, the active WebGL adapter, Aside and browser versions, CSS and drawing-buffer sizes, render scale, source HEAD, dirty-diff hash, and asset-manifest hash. The active adapter entry must explicitly carry `integrated: true`.

The measured run must contain 1080p render scale 1, three warm minutes, twenty thermal minutes with a final three-minute window, all three maps, five consecutive TDM/FFA pairs, DOM and practice flows, and acquired pointer lock. Both measured windows require median FPS at least 59, frame p95 at most 20 ms, frame p99 at most 25 ms, at most 0.1% gaps over 50 ms, and zero stalls over 150 ms.

Run from `apps/ironsight`:

```text
node scripts/target-device-report.mjs <perf-target-report.json>
```

The command writes `target-device-summary.json` beside the input. Exit 0 is `PASS`, exit 1 is a measured failure, and exit 2 is `UNQUALIFIED`. Raw input is never overwritten, so the first outlier remains available for diagnosis.
