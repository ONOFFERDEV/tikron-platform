# @tikron/sim

Isomorphic movement math for [Tikron](https://tikron.dev) — the deterministic step and
validation model shared by the server room and the client predictor. Run the *same*
function in both places and they agree, which is what makes client-side prediction
reconcile cleanly against a server-authoritative room. Zero dependencies.

```bash
npm i @tikron/sim
```

## Shared step, authoritative check

```ts
import { stepToward, validateMovement, type Vec2 } from "@tikron/sim";

// Move `pos` toward `target`, capped by maxSpeed (px/s) over dt (ms).
// Call this on the client to predict AND on the server to advance — same result.
const pos: Vec2 = { x: 0, y: 0 };
const target: Vec2 = { x: 100, y: 0 };
const moved = stepToward(pos, target, 200, 16); // ≈ { x: 3.2, y: 0 }

// Server-side: reject a client-claimed position it could not have reached this frame.
const check = validateMovement(pos, { x: 999, y: 0 }, { maxSpeed: 200 }, 16);
// check.rejected === true; check.position is the clamped authoritative point
```

Because `stepToward` and `validateMovement` share one speed budget, a client that
predicts with `stepToward` will never be corrected for legitimate movement — only for
teleport-style cheating.

## Key API

`stepToward(pos, target, maxSpeed, dtMs)` → `Vec2` ·
`validateMovement(prev, requested, config, deltaMs, tolerance?)` → `{ position, rejected }` ·
types `Vec2`, `MovementConfig`, `MovementResult`.

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).
Licensed **FSL-1.1-ALv2** — converts to **Apache-2.0** two years after each release.
See LICENSE.
