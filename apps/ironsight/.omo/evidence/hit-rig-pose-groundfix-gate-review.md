# hit-rig-pose-groundfix gate review

recommendation: **APPROVE**

## blockers

None.

## originalIntent

Correct the inactive Stage33 hierarchical HIT evaluator so any positive-weight crouch source uses the actual mixed-foot grounding rule, preserve exact animation composition and generated geometry, remove TypeScript escape hatches, and prove full-rig transition/history parity.

## desiredOutcome

The evaluator produces required actor-local head/torso/radius/ground fields from ordered timeline samples and reactions, agrees with the current production candidate rig/Scene path within 5 mm, is history independent across cached calls and factions, and remains inactive pending integration.

## userOutcomeReview

APPROVE for the requested inactive source/evidence scope. The candidate evaluator uses the same any-positive-crouch test and mixed six-foot minimum as Scene. A 102-row actual full-rig witness covers both factions, stand¡êcrouch through fade completion, locomotion/weapon transitions, rapid reversal, and both reactions. Maximum error is 0.000000556 m. The generated geometry packet is unchanged. This review does not activate HIT calibration or admit models.

## checkedArtifacts

- `src/hit-rig-pose.ts` SHA-256 `922f03e5d2b4e7d6faf45655b2ba18445e52075c6f3b1459a59e2945b9c7c395`
- `src/hit-rig-pose-data.ts` SHA-256 `3dc90573c17a96f90a49469fdde607fa0c4620bf36bcce83d279a80056a646b2`
- generated data SHA-256 `cda33a7c6af7be058d38c664221a840d2d7d3efe2b63ede27fd01fa7d26a6009`
- Scene SHA-256 `43262a815f863614f17e24a60d262644b5a1914fd0bb9f1cce710c4c4ba12b9f`
- rig-loader SHA-256 `3e131b89a7ed2139a70092280c670cb5354424ff927887c43e65201e99a8e2ea`
- parity v2 JSON SHA-256 `4f43b272c565d9f48737873a59ed3a7ded85adb403642ed73d1c068f3fd11bd2`
- implementation report `D:/webgame-baas/.omo/evidence/ww1/task-09-20-post-deploy/staging33/hit-rig-pose-implementation/report-v2.json`

## directProgrammingAndSlopPass

Both production modules are below 250 pure LOC (236 and 45). Direct scan found no `as unknown`, mutable-array/type assertions, non-null assertions, `any`, or TypeScript suppressions. Concrete Three keyframe constructors replace JSON track casts, and bone/clip lookups narrow explicitly. Tests exercise observable geometry against an independently loaded full rig; they are not deletion-only, tautological, or implementation-mirroring. The data module is a necessary typed boundary for the private generated packet rather than a speculative parser/normalizer.

Focused verification: 3 files / 21 tests passed; server and client TypeScript graphs exit 0.

## exactEvidenceGaps

- Runtime/provider activation remains intentionally pending.
- Evidence binds only the frozen Stage33 model, component, and normalization identities.
- No browser, server, full build, deployment, or visual/model admission was requested or performed.
- The shared worktree is dirty with unrelated concurrent work; approval binds only the exact hashes above and HEAD `30979d1c5237c2c81d77ebd29daa3417a3e74208`.
