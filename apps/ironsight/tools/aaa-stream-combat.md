# Stream "combat" — bots, weapon feel and the sound of a firefight

You are one of three astra streams working on ironsight at the same time, each in its own
git worktree on its own branch. Your worktree is `D:/wt-ironsight-combat`, your branch is
`ironsight-aaa-combat`, your dev-server port is **8798**, and you log every session to
`apps/ironsight/AAA-PLAN-COMBAT.md` (create it; never touch `AAA-PLAN.md`).

Read `tools/aaa-loop-brief.md`, `ART-CONCEPT.md` and `AAA-DESIGN-REFERENCE.md` as usual.
This file defines your lane.

## Your job

Make a firefight feel like a Battlefield firefight, on the server and in the mix. Nothing
you do may change map layout or collision.

1. **Bots with personality and competence** (R-L11, backlog item 7). Archetypes — rusher,
   anchor, marksman, support — with different reaction delays, engagement ranges, cover
   preferences, and look-ahead. Difficulty by reaction delay (600 ms easy to 150 ms hard)
   and decision depth, never by hidden health or damage multipliers. Bots should use the
   new interiors, stairs and roofs the map stream is adding, take flanks, suppress, retreat
   to cover to reload, and call out on the ping channel with barks.
2. **Weapon feel to the reference numbers** (R-G02 to R-G08, R-G19, R-G20). Verify and tune
   the shared per-weapon table: TTK per class, deterministic early recoil then bounded
   spread, first-shot accuracy, movement penalty dominating stance, ADS and sprint-to-fire
   timings, trauma-based camera kick. Every value in one table read by both client
   prediction and server authority; all juice stays a client layer on server-confirmed
   events.
3. **Layered audio** (R-G14 to R-G17). Per-weapon shared crack plus a unique identity
   transient plus a tail, distance variants, enemy footstep gain above ally, occlusion and
   low-pass behind geometry, one mix-piercing hit-confirm and a distinct kill variant,
   reload foley phases, explosion sub and debris, ricochet and concrete-spall.
4. **Impact and damage feedback**: dust puffs and spall by surface, blood-free hit
   confirmation that still reads, tracers, brass, muzzle blast dust at the shooter's feet,
   suppression cue when rounds pass close.
5. Keep the hitch gate green — VFX and audio are the easiest way to introduce a stall.

## Files you own (only these)

`src/bots.ts`, `src/rooms/**`, `src/weapons.ts`, `src/config.ts` (weapon/bot values only),
`client/audio.ts`, `client/spatial-audio.ts`, `client/vfx.ts`, `client/hud.ts`,
`client/predict.ts`, `test/**`, `AAA-PLAN-COMBAT.md`, and new files under `.inspect/`.

## Files other streams own — do not edit

- Stream **main** (level design): `src/map/**`, `client/*-environment.ts`,
  `client/site-*.ts`, `client/relay-*.ts`, `tools/bake-*.py`, `tools/dump-*.mjs`,
  `AAA-PLAN.md`, `client/scene.ts`, `client/main.ts`.
- Stream **assets**: `tools/meshy-*.mjs`, `tools/shrink-glb.py`, `client/prop-library.ts`,
  `public/assets/props/**`, `public/assets/README.md`, `scripts/audit-assets.mjs`.

`client/scene.ts` and `client/main.ts` belong to main because every stream would otherwise
collide there. If your work needs a hook in them, write the exact request in your plan file
under `## Cross-stream requests` and the supervisor will route it; meanwhile implement your
side behind a function the hook will call.

## Budget

Spend no Meshy credits — the assets stream owns that budget. Use procedural audio and VFX
as the codebase already does.
