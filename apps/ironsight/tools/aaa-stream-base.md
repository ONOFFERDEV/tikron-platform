# Stream "base" — green-up of the WW1 checkpoint (one session)

Worktree `D:/wt-ironsight-ww1-recovery-20260912`, branch `recovery/ironsight-ww1-20260912`,
dev port **8800**, plan file `AAA-PLAN-BASE.md` (create it; never touch `AAA-PLAN.md`).

Your only job is to make every supervisor gate pass on this tree: `pnpm typecheck`,
`pnpm test`, `pnpm build:client`, `pnpm audit:assets`, the headless inspect
(`node scripts/inspect-map.mjs --url http://localhost:8800 --shots relay,practice-two`,
zero console errors) and the hitch probe
(`node scripts/hitch-probe.mjs http://localhost:8800 150000 .inspect/hitch.json --assert`).
The supervisor's status.md lists the failures already measured. You may edit any file under
`apps/ironsight` that a failing gate points at, and nothing else — no feature or visual work.
Fixes must be honest: no `test.skip`, no widened thresholds, no deleted tests, no audit
bypass; if an expectation guards behaviour the WW1 pivot intentionally changed, update it and
say why. When all gates pass, log `### Session 1 - <date>: Green-up` in `AAA-PLAN-BASE.md`
with failure → cause → fix per item and stop.
