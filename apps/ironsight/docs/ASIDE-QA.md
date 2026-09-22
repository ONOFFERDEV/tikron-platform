# Aside QA runner

Ironsight browser QA runs only through the installed Aside CLI. The runner never launches Chrome, Edge, CDP, Puppeteer, or a separate Playwright browser. It uses one interactive `aside repl` process so bindings, the owned tab, and download handles survive across actions.

Run from the repository root:

```text
node apps/ironsight/scripts/aside-qa.mjs --url http://localhost:8896 --scenario perf-input --output .omo/evidence/ww1/task-06/perf-input --viewport 1920x1080
```

Before a shared QA pass, audit the canonical manifest without opening a browser. Missing modules, missing exported handlers, and module-load errors return a nonzero exit and an exact scenario list:

```bash
node apps/ironsight/scripts/aside-qa.mjs --audit-handlers --output .omo/evidence/ww1/task-06/handler-audit.json
```

When the URL serves an immutable copy outside the runner checkout, pass its app root explicitly:

```text
--served-source-root D:/path/to/staging/ironsight
```

The report then records the served bundle, asset tree, selected client contract files, and complete served-source tree separately from the runner checkout. Omitting this option means the runner checkout is also the declared served source; do not use that default for a server started from another tree.

The canonical registry is `scripts/aside-scenarios/manifest.json`. It contains the 31 scenario IDs, four aliases, ownership, composition, exact case lists, and 33 root commands from `.omo/drafts/ironsight-bf1/qa-scenarios.json`. Unknown scenarios, unknown composition targets, cycles, duplicate IDs, and empty case lists fail before browser launch.

## Field module contract

Each registered module exports an object named `scenarioHandlers`, keyed by canonical scenario ID:

```js
export const scenarioHandlers = {
  'ui-primitives': async context => ({
    inputProvenance: 'Aside trusted locator/keyboard APIs',
    observations: {},
    cases: context.definition.cases.map(id => ({
      id,
      verdict: 'PASS',
      reasons: [],
      observations: {},
      artifacts: [],
    })),
  }),
};
```

The handler returns every case string in its manifest entry exactly once and no others. Each case has `reasons` as `{code, detail?}[]`, `observations` as an object or `null`, and `artifacts` as `{path, bytes?, sha256?}[]`. PASS requires an empty reasons array; FAIL and UNQUALIFIED require at least one reason. Valid verdicts are `PASS`, `FAIL`, and `UNQUALIFIED`. Missing modules and handlers become `UNQUALIFIED` with a nonzero exit; they are never replaced with screenshot fixtures or generated PASS results. Exceptions, malformed results, duplicate cases, missing cases, and extra cases are `FAIL`.

`context` contains:

| Field | Contract |
| --- | --- |
| `definition` | Validated canonical manifest entry. |
| `url` | Absolute HTTP(S) URL from `--url`. |
| `viewport` | Requested `[width, height]`; measure CSS and drawing-buffer sizes separately. |
| `outputDir` | Resolved task evidence directory. |
| `repl` | One live `PersistentAsideRepl`; `run(code, {timeoutMs, allowError})` serializes commands. Bindings persist, so use fresh identifiers. |
| `sessionDir` | Exact current Aside session directory reported at REPL startup. |
| `copySessionArtifact(sessionName, destinationName)` | Copies an exact file from the current Aside session's `artifacts` directory into task evidence. Paths cannot escape either owner directory. For Blob downloads, first use `download.path()` and same-session `fs.copyFile`; this installation's `download.saveAs()` returned without creating its target. |
| `writeArtifact(destinationName, value)` | Writes a string, bytes, or JSON value under the task output directory and returns its repository-relative path and byte count. |
| `recordCleanup(receipt)` | Records owned tab/session cleanup in `report.json`. |
| `inputStages` | Stable ordered telemetry names described below. |
| `validateStages(expected, observed, options?)` | Validates required names, freshness, and timestamp order. |

Composition expands dependencies once in manifest order. The runner uses the same REPL for all implemented handlers in an invocation, writes `report.json`, `commands.txt`, `console.json`, per-scenario traces, and screenshots, then exits with 0 for PASS, 1 for FAIL, or 2 for UNQUALIFIED.

## Stable input telemetry

The required ordered names are `input`, `handler`, `predicted_commit`, `send`, `server_receive`, `resolve`, `receipt`, `confirmed_paint`, and `audio_schedule`.

Each sample is `{name, at}` on one documented clock, with an optional receipt or shot ID. Missing stages, stale samples, or reversed timestamps fail. A local mouse or keyboard event without pointer lock, camera change, and the corresponding application/server receipt is not FPS input proof.

## Aside lifecycle and evidence

The adapter discovers `ASIDE_CLI` first, then the normal per-OS install path or `PATH`. Startup must report a `sessionDir`. Commands are serialized and framed by the next `repl >` prompt; ANSI output and split prompts are handled. A lost process, overlapping command, timeout, stale snapshot ref, or `[error | ...]` is explicit.

Handlers list existing tabs before `openTab`, record the one new target, and close only that owned tab. Use `snapshot()` as the primary DOM read. `annotatedScreenshot()` is the verified capture path on this host; raw `page.screenshot()` and `cua.getVisibleScreenshot()` timed out. Download verification stays inside the same persistent REPL: register `waitForEvent('download')`, click, inspect `download.path()` and size, then `fs.copyFile` the exact path into session artifacts for the host runner to copy and hash.

Aside Fetch interception can persist browser-wide after its originating tab and REPL close. Every owned scenario opens `about:blank`, sends `Fetch.disable` through that Aside page before navigation, and repeats `Fetch.disable` before closing its target. A failed recovery is an explicit scenario failure. Readiness uses the app's inert canvas and persistent performance marks, records stage transitions plus elapsed milliseconds, and allows 95 seconds. On this host a clean startup reached play-ready after about 59 seconds because Aside delivered the compositor's requestAnimationFrame waits near 1 Hz. That environment timing is recorded separately and is not game FPS.

The current Aside surface reports a focused, visible, top-level, unsandboxed loopback document and a trusted active click, but pointer lock still rejects with `WrongDocumentError`. The runner uses the visible control-required retry button when the UI presents it, otherwise a hit-tested canvas point; it records the exact native request receiver, connected/owner-document state, gesture trust and rejection instead of treating a locator click as proof that the input handler ran. `setViewportSize` is undefined. The runner separately probes Aside's own `page.cdp.send('Emulation.setDeviceMetricsOverride', ...)` route, then reads CSS viewport, drawing buffer, DPR, render scale, and captured PNG pixels. A successful override proves an emulated CSS/render viewport, not physical monitor dimensions. `perf-input` remains `UNQUALIFIED` whenever pointer lock, requested metrics, drawing buffer, or capture is unavailable. It does not assign `pointerLockElement`, dispatch synthetic DOM input, or count unlocked deltas as camera movement.

## Target-device qualification

Run from the repository root:

```text
node apps/ironsight/scripts/aside-capabilities.mjs --qualification-preflight --output .omo/evidence/ww1/task-06/qualification.json
```

A target manifest must include actual manufacturer/model, CPU, display adapters and drivers, RAM, OS, AC power, performance mode, Aside/browser versions, active WebGL adapter, CSS viewport, drawing buffer, render scale, source HEAD, dirty diff hash, and asset manifest hash. Missing fields, no named laptop, dGPU or SwiftShader-only rendering, or no accessible target-device session is `UNQUALIFIED` with exit code 2. The local MSI desktop with an RTX 5070 is not accepted as laptop iGPU evidence.
