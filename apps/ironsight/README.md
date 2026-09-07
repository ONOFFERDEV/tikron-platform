# Ironsight

## Reviewing the rig pose (for humans and AI)

Start `pnpm --filter ironsight dev`, then open
`http://localhost:8787/?inspect=rig`. This bypasses matchmaking and WebSockets,
uses the normal map/lighting, and shows one remote rig at the arena centre without
HUD, pointer lock, or the first-person viewmodel. Asset HTTP requests still occur.
The mixer samples the selected clip at 0.75 seconds for repeatable comparisons.

Query options: `weapon=0..4` (default `0`), `pose=idle|walk|run|crouch` (default
`idle`), `yaw=30`, `pitch=10` (degrees), `dist=2.2` (metres, orbit around chest).
`blend=0..1` overrides `weaponVis.presentation.remote.holdBlend`; absent uses the
game setting. `arms=0` disables arm posing; `arms=1` (default) permits it.
Reach blend is capped at 0.9; wrists retain their animated local rotations.
The current default is **holdBlend=0**, the attachment-only fallback: the bounded
reach fixed crossed arms but these open-hand locomotion clips do not form a
convincing rifle grip. Use `&blend=0.85&arms=1` to review the experimental reach
against `&blend=0.85&arms=0`. A proper two-handed grip still needs an authored
weapon-hold animation. The inspector freezes after loaded assets render and sets
`window.__inspectReady = true`.

Capture with Node 22+ and Microsoft Edge, with no additional dependencies:

```sh
node apps/ironsight/scripts/inspect-rig.mjs --url http://localhost:8787
# Equivalent local convenience command:
pnpm --filter ironsight inspect:rig
# All weapons, or deployed client after deployment:
node apps/ironsight/scripts/inspect-rig.mjs --url https://fps.tikron.dev --weapons 0,1,2,3,4
```

Set `EDGE` to override the Windows Edge executable path. The script starts and
closes its own headless Edge, removes its temporary profile, and prints PNG paths
in `.inspect/` (ignored locally). It captures front, both sides, back, three-quarter,
top-down, and hands close-ups from both sides, for weapons 0 and 3 with arms on/off.
Use `--prefix before` or `--prefix after` to retain comparison sets. URL query
options such as `--url "http://localhost:8787/?pose=run&blend=0.85"` carry through.
Readiness has a 20-second timeout: fallback screenshots are saved with a warning
and a failing exit code. Gameplay network connections also fail the capture run.

Open the PNGs with an image viewer (AI agents can use `view_image`); inspect the
elbow bend, wrist roll, rear grip, and support-hand contact from several angles.
The `before-*` and `attempt-*` images record the original crossed-arm defect and
the bounded-reach attempt; `after-*` records the chosen attachment-only default.
This inspector does not review the first-person viewmodel.
