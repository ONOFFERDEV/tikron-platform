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
