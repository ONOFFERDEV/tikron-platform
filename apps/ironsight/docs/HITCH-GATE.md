# Headless hitch gate

Run from `apps/ironsight` against its local preview:

```sh
node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
```

Session74 deliberately changes the **headless presentation ceiling from 150 to
1500 ms**, using the owner's 2026-09-10 driver/compositor exception in
`tools/aaa-loop-brief.md`. This is a test-host allowance, **not a claim that a
one-second visible freeze is acceptable gameplay or that the driver is fixed**.
No browser flags, 500us CPU sampling, three-second shader warm-up, measured
frames, natural bot deaths or errors are removed.

The gate now independently fails on:

- Any presentation interval above **1500 ms**.
- A measured animation callback or browser main-thread long task above **150 ms**.
- The upper whole-millisecond **p99 frame interval above 25 ms**, counted from
  every measured frame. This catches sustained low frame rates the old maximum
  alone allowed; it is still separate from the 60fps/iGPU product requirement.
- More than **5% of measured time in >150ms presentation intervals**. Rare but
  repeated one-second freezes can escape a frame-count percentile, so this
  independent wall-time budget limits them too.
- Any shader-count/cache-key addition after the existing three-second warm-up,
  console error, fewer than two natural deaths, missing frame coverage, or an
  unfinished round when `--until-ended` was requested.

`summary.spikes` still contains **every interval above the original 150 ms**.
`summary.gate` prints the limits, all failure reasons, maximum presentation and
callback durations, p50/p95/p99 upper bounds, stalled-time share, and the number of >150ms frames,
including on PASS. No frame is automatically labelled a driver fault. New or
frequent presentation spikes require investigation even when this gate is green.

## Evidence behind the decision

Session65 had already reproduced stalls without CPU profiling and with the HUD
hidden. Session74 adds per-frame submitted draws/materials/transparent draws,
texture and buffer uploads, shader links, framebuffer allocations, shadow
requests and render-target draws. The recorded stalls did not have resource
creation, new game shaders, shadow re-bakes or an extra WebGL pass.

Local evidence (ignored `.inspect/` files, retained for the supervisor):

- `session74-trigger-2.json` and its `-trace-summary.json`: a **166.5ms**
  first-damage interval. The preceding game render took about **1 ms**, with
  **36 calls / 29 materials**. Chromium's raster worker took **177.164 ms**
  (**7.243 ms thread CPU**), waiting on an ANGLE pixel executable for
  **170.162 ms** (**2.878 ms CPU**). The full-screen blurred damage border was
  a plausible trigger; it is now an original baked PNG animated by opacity.
- `session74-death-trace-2.json` and its `-trace-summary.json`: the candidate
  still has a **738.5ms startup interval**, with about **1.1 ms** game render
  work, **104 calls / 65 materials**, and no resource/shader/pass churn.
  Chromium's `SkiaOutputSurfaceImpl::FinishPaintRenderPass` took **744.013 ms**
  (**3.121 ms CPU**), waiting for `GetVertexExecutableTask` for **742.739 ms**
  (**2.250 ms CPU**). The rolling trace demonstrably covers this interval.
- `session74-final-ffa-3.json`: the unchanged original gate correctly failed on
  **1002.6 ms** at first death and **212.1 ms** while dead. This failure stopped
  the first five-pair sequence; it is not overwritten or reclassified as a fix.
- Session65's retained GPU trace has approximately **1168 ms** in an ANGLE
  executable worker with only **2.608 ms CPU**. The new **1500 ms** ceiling is
  a round, bounded margin above this observed roughly 1.2-second host tail;
  application work retains its original 150ms bound.

These traces locate the waiting work in Chromium/ANGLE's compositor/raster
path. They do not identify a particular NVIDIA driver defect, prove every
untraced gap has that cause, or establish performance on another machine.
Short one-triangle controls cannot establish universal absence of that tail.
Representative iGPU, real browsers, sustained combat and thermal testing remain
required. Keep investigating owner-visible stalls; do not treat this ceiling as
headroom for more expensive rendering.

## Preparing the compositor (Session 80)

The loading phase now paints inert copies of the real combat HUD, four damage
directions, body/head hitmarkers, animated feed, elimination/streak messages,
death, team/solo results and honors, support silhouettes, deployment, map-event
and ping panels, pause and settings. The actual minimap canvas is also drawn
before play. No blur/backdrop-filter remains in the audited match CSS.

Copies sit at the viewport's real size, above the loading UI at **1% opacity**.
`opacity:0`, an offscreen location, or opaque occlusion can skip rasterization;
those are not useful warmup substitutes. Real animations are paused halfway
through, and each view gets three animation frames. Copies are inert and hidden
from accessibility, and are removed before the canvas accepts input. Live HUD
state, focus, settings, sounds and room state are not replayed or mutated.
There is no persistent compositor layer, extra WebGL pass or new game texture.

`--assert-first-use` adds a separate **150ms** check around the first natural
damage and death, from 250ms before the observed event through 1000ms after it.
The interval crossing either boundary is included. Missing/incomplete windows
fail this check. Fatal damage counts too. The ordinary whole-round policy above
is unchanged; every startup interval and every gameplay spike is retained.
The observer starts before navigation and retains hits during pointer-lock and
profiler setup; a live-join hit can therefore have a negative time relative to
the ordinary gameplay measurement origin. No initial two-second blind spot.

```sh
node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/first-fight.json --assert --assert-first-use --mode=ffa
```

Each invocation creates a fresh browser profile. This does **not** flush the
shared driver cache or prove performance on a laptop iGPU. The report includes
loading/first-ready intervals, per-view UI preparation measures and scene
preparation time. Run five sequential TDM/FFA pairs without other inspection
browsers, bakes, builds or tests competing with the probes.

To confirm that preparation really submits GPU raster work, start the trace
before navigation. This short diagnosis intentionally lacks the two deaths and
is separate from acceptance:

```sh
node scripts/hitch-probe.mjs http://localhost:8796 1000 .inspect/compositor-prepare.json --mode=ffa --trace-startup --trace-categories=toplevel,gpu,gpu.angle,cc,viz,blink.user_timing,disabled-by-default-gpu.service
node scripts/compositor-trace-summary.mjs .inspect/compositor-prepare
```

Session80's retained startup trace covers all 18 views: **134 GPU raster tasks**,
with **21 pixel and 21 vertex executable tasks** overlapping preparation.
Preparation took **433.9ms** under tracing. An earlier **283.3ms loading interval**
overlaps an ANGLE pixel executable taking **254.010ms wall / 247.476ms CPU**,
before UI preparation began. This is recorded cold first-use compilation during
loading, not a silently discarded gameplay frame or proof of a driver defect.
See `.inspect/session80-preparation-trace{,-trace,-summary}.json` and the Session80
log for the final repeated acceptance results.

A separate covered post-preparation repro remains in
`.inspect/session80-startup-3{,-trace,-trace-summary}.json`: **462.2ms** before
the ordinary profiler interval, overlapping a **461.675ms wall / 3.782ms CPU**
ANGLE pixel executable. Chromium's **BrowserRasterWorker** consumes465.782ms
wall/7.390ms CPU. Game render calls around it take1.1-1.6ms, with101-121 draws,
57-77 materials, no resource creation/shader links, no shadow request or extra
target pass. Existing skin/buffer updates continue. This is a remaining
**cold-GPU-cache presentation cost after warming**, not proof that every first
use is now free or that a particular driver is defective. The original untraced
292.4ms first-ready outlier is retained without assigning it this cause.

Use the full trace summarizer's startup option to include these early intervals:

```sh
node scripts/hitch-trace-summary.mjs .inspect/compositor-prepare.json --startup
```

Five consecutive TDM/FFA pairs (Session80 pairs3-7) pass both the ordinary gate
and the150ms first-damage/death checks, with pre-profiler events observed too.
No interval exceeds150ms in their ordinary gameplay measurement. The earlier
observation retains20 gaps above150ms, including8 after ready (156.6-599.2ms).
These include first entry before profiler setup; they must not be described as
universally smooth gameplay. Only the covered462.2ms diagnosis above is assigned
to the browser raster executable path. The other untraced intervals retain no
causal label. This residue does not justify changing the limits.

`--capture-first-fight` writes a 20-second still sequence starting at natural
damage. Screenshots perturb presentation, so the probe refuses to combine this
option with either acceptance assertion. Use a separate run for visual evidence.

## Capturing a new failure

```sh
node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/gpu.json --assert --mode=ffa --trace --gpu-diagnostics --diagnostic-timing --stop-on-spike --trace-categories=toplevel,gpu,gpu.angle,cc,viz,blink.user_timing,disabled-by-default-gpu.service
node scripts/hitch-trace-summary.mjs .inspect/gpu.json
```

`--stop-on-spike` exports at the **original 150ms** trigger before the rolling
trace loses an early stall. It may omit the required two deaths, so it is a
diagnostic, not acceptance. `--gpu-diagnostics` only instruments the inspector;
it is never bundled into the game. The trace summary reports wall time and
thread CPU separately and refuses coverage when the game renderer's retained
task range no longer spans the slow frame.
