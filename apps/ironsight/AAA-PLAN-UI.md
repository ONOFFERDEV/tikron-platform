# IRONSIGHT WW1 UI stream

## AAA gap list

1. Finish Session 6 acceptance: support/streak/death field skin is implemented provisionally, but Aside capture/readiness failures block the complete fresh visual matrix and both hardware gates. Repair the inspection environment and rerun unchanged gates before accepting the arc.
2. Shorter desktop and narrow combat layouts: extend the HUD skin beyond the desktop states proven in Session 2. Menu/settings/results mobile access is covered; mobile FPS gameplay is not qualified.
3. Live deployment camera-intro framing awaits look-stream integration; UI countdown/results/roster/honors/intermission skin is accepted in Session 4.
4. Deployment world vistas await world-stream WW1 artwork. Menu and live instruments already share the field palette.

## Reference scorecard

| Reference | Status | UI evidence / target |
| --- | --- | --- |
| R-L09 | partial | Menu/training, results/countdown and Session 5 settings/loading/recovery readability verified. Session 5 adds live menu/settings/practice/pause/resume checks; remaining combat notices are next. Existing settings focus containment is a separate flow referral. |
| R-L12, R-L13 | partial | Sessions 1–4 field menu/HUD/reports are retained. Session 5 completes settings/service framing with 74 fresh images, 26 unchanged-text pairs, repaired narrow Korean clauses and two independent PASS reviews. Session 6 support/casualty skin is provisional: one fresh1280 state is readable, but complete visual/hardware acceptance is blocked. |
| R-L14, R-L23 | partial | Menu/HUD preserve controls, information and enemy choices; no new combat effects. Final hardware acceptance is recorded below separately. |
| R-L20 | partial | Four retained kill-feed entries and server messages stay separated in Session 2 captures; complete match presentation still pending. |
| R-L05, R-L07, R-L17 | met (UI scope) | Session 4 countdown, outcomes, honors, rosters and next-round statuses preserve behavior and pass both independent reviews. No new claim about gameplay timing or MVP selection. |
| R-L06, R-L19, R-L21, R-L22 | partial | Existing function retained; remaining recovery/combat overlays and camera presentation are future arcs. |
| R-M01–R-M20, R-G01–R-G20, R-L01–R-L04, R-L08, R-L10–R-L11, R-L15–R-L16, R-L18 | n.a. | Gameplay, maps, weapon rendering and audio are outside the UI lane; no claim on other streams' acceptance. |

## Session 1 plan — 2026-09-22: Field orders, deployment skin

- Completed: eight baseline mode captures in Aside at 1920×1080 and 1280×720; existing shared primitives and canonical mode copy verified.
- Completed: shared palette, stencil wordmark, Korean hierarchy, field-order edge, reusable button states and collision-derived paper map diagrams. Existing controls, mode handlers, URL selection and gameplay rules retained.
- Completed: 35 fresh final captures, including both middle-scroll views and repaired hover midpoint; independent design and visual/CJK reviewers both PASS with high confidence.
- Completed: final evidence log, scope/diff checks and cleanup. Owned server tree and inspection browsers are stopped; port 8804 is no longer listening.
- Blocked: global green acceptance. Asset audit fails on unchanged kit-owned builder/metadata hashes. The unmodified hardware hitch probe exhausted its official 1,800,000ms shared GPU lease wait without launching a browser or producing a hitch result. Neither gate is waived or represented as passing.

## Cross-stream requests

- **Session 9 / supervisor, flow request:** while the `#deployment-flow` recovery panel is shown (reconnecting), `Hud.showConnection` still renders the legacy `#overlay[data-kind="connection"]` card behind it, and its edges show (`.inspect/ui-r3/screens/1280-reconnecting.png`). A CSS hide is blocked by the service-skin invariant, so a flow owner should skip the legacy card while the recovery flow is active.
- **Session 9 / Look (`client/vfx.ts`):** `TypeError: Cannot set properties of undefined (setting 'floor') at Vfx.spawnCasing` shows up in live TDM/DOM/FFA bot rooms while the local player fires. It appears on the unchanged baseline too (5 times before, 3 after).
- **Session 9 / Supervisor (`client/match-inspect.ts`):** the `?inspect=match` results fixtures throw before rendering. Their checks still expect the English strings `AUTOMATIC / STAND BY`, `IN 13s`, `shared capture second` and `AMBUSH`, which are now Korean. Because of this I captured results live instead.

- **Session 6 / supervisor: acceptance BLOCKED.** Current Aside automation fails readiness in both unchanged official map/hitch gates; native capture also times out across the required matrix. One fresh1280 mortar-ready fixture is readable, but root cause is unconfirmed. Restore a reliable Aside inspection path and rerun the complete14-state/two-size/zoom/font/motion/binding matrix plus unchanged gates on port8804. See `.inspect/ui-session-6/hardware-gates-acceptance.json`, `harness-triage.md` and `visual-verdict.md`. No owning-stream source, gate threshold, shared lease or other process was changed.


- **Session 5 / Look / supervisor:** final official map/hitch gates PASS. Preserve the post-ready/pre-measurement gaps of **180.2ms and 247.1ms** in `.inspect/ui-session-5/hitch-acceptance.json` and `summary.json`. First ready is 3,276.8ms; UI preparation 716.2ms. As in Sessions 2/4, the unchanged official gate excludes that startup window; no cause or hitch-free startup is claimed. No renderer/probe/threshold file was changed by UI.

- **Session 5 / supervisor, preexisting flow request:** independent review confirms `client/settings-ui.ts` has no Tab focus-trap branch (keydown handler near line188). This file and behavior are unchanged by this skin pass. The UI contract asks for dialog focus containment; route a separate authorized flow fix to trap first/last active controls while retaining capture cancellation and prior-focus restoration. Do not fold it into the visuals-only session.

- **Session 4 / Look / supervisor:** required map/hitch gates PASS. Preserve the separately observed post-ready/pre-measurement gaps of 234.7ms and 322.5ms (`.inspect/ui-session-4/hitch-summary.json`, original `hitch-acceptance.json`) alongside Session 2 startup diagnostics. No cause is established and no threshold/renderer/probe file was changed by UI. First-ready 3,598.7ms; UI preparation 596.7ms. This is a renderer/startup follow-up, not a waiver of a red gate.

Session 1 failures below remain historical receipts. Session 2 closes the weapon audit and required hitch acceptance requests; the existing soldier quarantine and world-vista request remain separate.

- **Session 2 / Look / supervisor, follow-up diagnostics (required gate passes):** preserve and correlate the 296.8ms/308.5ms first-ready gaps and earlier 156.2ms callback/231ms long-task failures in .inspect/ui-session-2/. Final locally quiet TDM gate passes without source/policy changes. Root cause and five-run TDM/FFA stability are not established by this UI session; trace that window in the owning renderer/probe lane.

- **Session 2 / Kit / supervisor: weapon blocker resolved externally.** Asset audit failed before UI changes and now passes after external admission/metadata edits. Raw and LF-normalized builder/metadata hashes are identical, ruling out Windows newlines. All candidate GLBs match, but both builders and five weapon/two soldier metadata files differ from admission receipts. See .inspect/ui-session-2/provenance.md and assets-before.log. The weapon request is closed by the passing unchanged audit. Soldier quarantine remains intact; UI did not change kit files.

- **Kit / supervisor, baseline gate blocker:** `pnpm audit:assets` fails before UI edits with `candidate_builder_hash` on `tools/build-ww1-production-weapons.py` and `candidate_meta_hash` on all five `assets/ww1/weapons/*.meta.json` files. Receipt: `.inspect/ui-session-1/assets-before.log`. Reconcile the authoritative builder/metadata bytes with the existing admission manifest in the owning stream. UI will not change these files or weaken the audit.
- **Kit / supervisor, additional provenance check:** the existing soldier quarantine integrity check also reports `soldier_builder_hash` for `tools/fit-ww1-soldiers.py` and `soldier_meta_hash` for the khaki/fieldgrey metadata. Weapon validation stops the full audit before this check. See `.inspect/ui-session-1/budget.json`; neither builder nor metadata was edited here. Quarantine is retained; the budget measurement conservatively includes those excluded files and does not certify admission.
- **Look / supervisor, required hardware gate:** rerun `EDGE='C:/Program Files/Aside/Application/Aside.exe' node scripts/hitch-probe.mjs http://localhost:8804 150000 .inspect/ui-session-1/hitch.json --assert` with this worktree's server running and the shared GPU available. The original attempt waited from approximately 10:50:53Z to 11:20:53Z on 2026-09-22 and failed at `scripts/inspection-lease.mjs:75` with `GPU inspection lease timed out after 1800000ms`. Receipt: `.inspect/ui-session-1/hitch.log`; no `hitch.json` exists. Other streams' leases/processes were left alone, no thresholds changed, and no software-rendered frame timing substitutes for the gate.
- **World:** Existing `relay-vista.webp`, `undertow-vista.webp` and `switchyard-vista.webp` show the earlier environment. Regenerate those existing menu vistas when the corresponding WW1 world is ready; keep their current URLs. This session changes menu framing only.
- **Supervisor (main.ts / flow), death opens the match menu (Session 14 #4):** `main.ts` calls `document.exitPointerLock()` when the local player dies. The unlock reaches `wireQuitConfirm`, which opens `#quitConfirm` over the casualty slip, and respawn then requires a click. This is confirmed in headed Edge (`.inspect/ui-r13/before/headed-tdm.json`). Request one of two fixes:
  - (a) keep pointer lock through death, with input already cleared by `input.clearFire("death")`;
  - (b) pass a "death" reason so `wireQuitConfirm` skips the menu and the respawn relocks without the control-required card.

  UI has no skin change pending on this.

## Session 6 plan — 2026-09-23: Field dispatch, support and casualty plates

- Completed: preserved initial source/bundle and the28 historical baseline captures.
- Completed: field support, dispatch, streak and casualty skin; detached ready-edge and mixed-pip preparation.
- Blocked: complete fresh visual/stress acceptance. One current1280 mortar-ready state is verified; both independent reviewers reject overall completion for missing coverage.
- Completed: final typecheck, full tests, client build and asset audit pass; byte/source receipts and session log recorded.
- Blocked: unchanged official Aside map and hitch gates fail browser readiness. No threshold or owning-stream source was changed.
- Completed: owned-process and lane cleanup, recorded in .inspect/ui-session-6/cleanup.json.

## Session log

### Session 14 - 2026-09-26: Calm HUD, 1918 field cards, redeploy vista

Scope: skin only. No new state, flow, binding or feature. Base: 74436d8 plus a merge of `recovery/ironsight-ww1-20260912`. No commit.

#### What changed

- **HUD weight (#5)**, `client/ui/hud-field-style.ts`:
  - The kill feed, shot-confirmation log, weapon bar and mode label share one quiet backing per group (`--ui-hud-quiet`, .7). Rows lose their plates and frames.
  - Local and victim feed rows keep their edge. Small text uses the secondary colour, so it holds 4.5:1 over bright sky.
  - The support card (관측기 정찰) drops its paper header and becomes a quiet instrument with the same words and pips.
  - `client/tactical-map.ts`: the Q/B key hints use the quiet backing and fade after 60s of each life. They restart on respawn because the hint is hidden while dead. Reduced motion makes the fade instant.
  - Health, ammo, scores and the objective brief are unchanged, so they now carry the visual weight.
- **Menu and results (#8)**, new `client/ui/field-paper-style.ts`, installed by the menu, the flow panel and the HUD:
  - CSS paper with fibre and aged edge, ruled paper, olive canvas weave, and a rust stamp token (`--ui-stamp`, 5.4:1 on paper).
  - A fictional regimental insignia (inline SVG mask) in the menu header, the hero and the results header.
  - Menu: the shade is lighter so the vista reads; the intel card is ruled paper; "작전 선택" is a stamp; the selected mode card is paper.
  - Results: the outcome is a stamp (rust on defeat) and the roster heads are paper.
  - New tokens and rules are recorded in `DESIGN.md`.
- **Redeploy screen (#3)**:
  - `#deployment-flow` shows the current site's vista under a bottom-weighted shade instead of a near-black scrim. `hud.setDeploymentSite` sets `:root[data-site]`.
  - `client/compositor-preparation.ts` decodes the vista at load, so first death adds no decode.
  - The casualty slip (killer and countdown) takes the paper and stamp edge.
- `test/field-paper-skin.test.mjs`: token-only colours, no motion/filter/shadow, never targets live instruments, and a vista rule with a shade layer per site.

#### Evidence (`.inspect/ui-r13/`)

- `before/`, `after/`: menus (3 sites at 1920 and 1280, plus relay at 200% zoom) and results (victory, DOM, FFA, defeat), from `screens.mjs`. Live TDM, DOM and FFA walks with firefights, death and respawn come from the audit-r16 walker (`walk-{mode}.png-*`).
- Overlap probe (`live.mjs`, 40s per run): **0 overlaps, 0 clipped at 1920 and 1280 in TDM, DOM and FFA, both before and after.** At 640x360@2x the known transient overlaps remain, as recorded in Session 9 (owner decision still open).
- A first-time player would say: "총, 체력, 목표가 먼저 보이고 메뉴는 야전 서류철 같다."

#### #4 finding (investigate only, no change)

A headed Edge run (`death-headed.mjs`, `before/headed-tdm.json`) shows that dying **does** release pointer lock and open the match menu in a real browser. The cause is code, not headless automation:
- `client/main.ts` calls `document.exitPointerLock()` on the alive→dead edge; the recorded stack is `ingest ← Room.applyBinaryState`.
- `pointerlockchange` then reaches `wireQuitConfirm`, which shows `#quitConfirm` because the phase is live and the client is online. The menu covers the casualty slip.
- On respawn the flow becomes `control-required`, so the player must click to deploy.

Suggested fix, as a flow request for supervisor routing (main.ts and the flow are outside this lane): keep lock through death, or suppress the quit menu when the unlock comes from death. See the cross-stream request below.

### Session 13 - 2026-09-23: Brick and sandbag surfaces

`MAP_SURFACES` gains `brick` and `sandbag`. This is client-only presentation: it is not sent over the wire and the server does not use it for hits. Relay (`arena1.ts`): masonry is tagged `brick`, and the signal-hut timber and low free-standing covers are tagged `wood`, as `relay-environment` renders them. Relay has no sandbag solid (its sandbags are perimeter-parapet art or lie flat) and no corrugated shed; its only `metal` is the two hut doors. Undertow (`arena2.ts`): west-yard walls, structures, the office, the lintel and the chimney are `brick`; the east-yard steel walls are `metal`; benches and low covers under 1.5 m are `sandbag`; revetted redoubts, crates and consoles are `wood`. No box, ramp or spawn changed. `combat-fx` IMPACT_PROFILES reuses look's brick and sandbag dust colours. Footsteps use the concrete values for brick and the mud values for sandbag. `scene-impact` already carried both kinds, so it is unchanged.

From the predecessor I kept `materials.ts`, `combat-fx.ts` and the `arena2.ts` finish function, which matches `undertow-environment` branch for branch. I refined `arena1.ts`, set the footstep values to exact copies, and reverted four test edits because the tests were outside the grants. The patch is kept at the scratchpad path given in the handoff.

| Gate | Result |
| --- | --- |
| `pnpm typecheck` (server + client) | PASS |
| `pnpm test` | FAIL 4 / 1700: the tests that pin the five-surface vocabulary (`combat-audio` distinct footsteps, `combat-fx` canonical surfaces, `spatial-audio` support identities, `ww1-relay` vocabulary). They need a supervisor-granted update; they were not edited. |
| `pnpm build:client`, `pnpm audit:assets`, 4 relay + 4 undertow audits | PASS |
| `inspect-map relay,practice-two --prefix ui-r12` | PASS, errors [] |
| `hitch-probe 150000 --assert` (once) | PASS, 0 recompiles, 0 frames > 150 ms |
| Live fire (`.inspect/audit-r12/live-fire.mjs`) | Relay: mud, brick, wood and metal. Undertow: mud, wood, sandbag, brick and metal. Each shot was accepted by the server, and the client cue material matched. Stills are `.inspect/audit-r12/{relay,undertow}-impact-*.png`. |

The Relay sandbag still cannot exist: no sandbag solid is authored there.

Follow-up (coordinator grant): the four vocabulary tests now expect the new list. Both the impact and footstep tables must have all seven keys and seven distinct profiles. The Relay and Undertow authored sets drop `concrete` because no solid on either map uses it now. Footsteps are distinct again:
- brick is concrete made harder, higher and grittier: `.9 / lowpass 420 Hz / q .9 / gain 1.04`
- sandbag is mud made duller and more muffled: `.64 / lowpass 190 Hz / q .4 / gain .86`

Rerun results: typecheck PASS, `pnpm test` 1691 passed, 0 failed, and the other gates are unchanged (see the reply).

### Session 12 - 2026-09-23: Last English core signs, Korean combatant names; surface kinds blocked

Scope: UI lane plus the round-11 grants. No commit. `git merge recovery/ironsight-ww1-20260912` reported "Already up to date" (68a1b3b).

#### Delivered

- **`client/signal-core.ts`** (sign text only): `SIGNAL POST` becomes 신호소 and `SLUICE POST` becomes 수문 초소, with a Hangul font fallback. Same canvas, mesh and position. Stills: `.inspect/audit-r11/signs/side-{relay,undertow-gallery-closed}.png`.
- **Korean combatant names, client presentation only.** Server role ids and labels are unchanged.
  - `combatantLabel()` in `client/ui/copy.ts` translates only the exact bot label shape (`RUSH 1` → 돌격 1, `ANCHOR` → 거점, `SCOUT` → 정찰) and the self name (`You` → 나). Any other player name passes through untouched.
  - Applied to the kill feed, kill confirm, streak, FFA leaderboard, death card, results roster and MVP.
  - The combat event log now shows `명중 확인: 거점 4` instead of the raw `bot-7`.
  - The 나 tag is no longer doubled when the killer is you.
  - `test/ui-copy.test.ts` has one assertion for this.
  - Live stills: `.inspect/audit-r11/labels.png` (first pass, which showed the doubled 나) and `labels-after.png`.

#### Blocked: brick/sandbag surface kinds (item 1)

- **Look's effects are not on the integration branch.** Look's per-surface impacts are commit 3de7053 on `ironsight-ww1-look`, which `recovery/ironsight-ww1-20260912` (68a1b3b) does not contain. On this tree there are no brick or sandbag impact effects to play.
- **Adding the kinds would reach outside the grant.** Adding `brick` and `sandbag` to `MAP_SURFACES` makes three exhaustive `Record<MapSurface, …>` tables fail the typecheck:
  - `client/combat-fx.ts` `IMPACT_PROFILES` (look)
  - `client/scene-impact.ts` (look)
  - `client/spatial-audio.ts` `FOOTSTEP_SURFACE_PROFILES` (supervisor)
  None of them is granted. Changing them would break the type contract or cross lanes, so no change was made to `src/map/**`.
- **Unblock by:**
  1. Merge 3de7053 into recovery.
  2. Grant the three tables, or let look add brick/sandbag entries to them (footsteps: brick ≈ concrete, sandbag ≈ mud).
  3. Then apply the planned bindings: Relay and Undertow `concrete` masonry becomes `brick`, sandbag courses become `sandbag`, and corrugated sheds become `metal`.

#### Gates

- typecheck, build:client, audit:assets: exit 0.
- test: Vitest 1,678 passed / 9 skipped, Node 92/92.
- inspect-map relay,practice-two: exit 0, `errors []`.
- hitch-probe (advisory, once): `hitchGate: PASS`, 0 recompiles, 0 errors.

### Session 11 - 2026-09-23: WW1 menu vista refresh and combat inspector feed cap

Scope: UI lane plus the round-5 grants: `public/assets/{relay,undertow}-vista.webp`, their README provenance, and `client/match-inspect.ts`. First I merged `recovery/ironsight-ww1-20260912` (merge commit 327147e, no conflicts). No commit, push or deploy. `switchyard-vista.webp` was not touched.

#### What changed

- **Vistas.** I re-rendered both from the merged tree through the existing path (`inspect-map.mjs` fixed vista camera, 1920x1080, WebP q88) and compared each with the shipped file.
  - **Relay:** the fresh render matches the shipped image (Signal Station brick, lattice mast, ruined gables), so the file is unchanged.
  - **Undertow:** the shipped image predated World Session 5: turbine and fan faces, stripes, pale concrete. It was refreshed with `--shots undertow-vista --write-vista`. The new file is 164,580 bytes (was 166,926; -2,346), same dimensions and framing.
  - The provenance is appended to `public/assets/README.md` in a `# ui` block.
- **Combat inspector.** `client/hud.ts` now exports `KILL_FEED_ROWS = 4` (the R-L20 cap) and uses it for the feed. `client/match-inspect.ts` `bounded` checks against that constant instead of the literal 5, with a comment explaining why. `match-combat` now reaches `__inspectReady`. The network page's `low`/`spikeIgnored` behaviour checks were left as they are.

#### Evidence (`.inspect/ui-r5/`)

- Source files: `before/*.webp` and `after/*.webp`.
- Fresh comparison renders: `../ui-r5-probe-{vista,undertow-vista}.png`.
- Menu cards (`cards.mjs`, real menu with the TDM/DOM card selected): `{before,after}/{1920,1280}-menu-{relay,undertow}.png`. The before set served the old Undertow file.
- Inspector: `inspector-after.json` (combat ready; network still fails only `low`, `spikeIgnored`).

#### Gates

- typecheck PASS; tests PASS (Vitest 202 files / 1671 passed, 9 preexisting skips, on the merged tree; Node 92/92); build:client PASS; audit:assets PASS.
- inspect-map relay + practice-two PASS, `errors: []`.
- hitch-probe (advisory, once): `hitchGate: PASS`, 2 deaths, 0 recompiles, 0 errors.
- Bytes: assetBytes 36,695,359 and publicBytes 48,725,929 after the merge. The UI share is the -2,346 on the Undertow vista plus a few hundred bytes of bundle.

#### Open questions

- The Undertow vista is dark at the vista camera because of its dusk grade (as it was before). Legibility on the card relies on the existing scrim; no change was made to it.

### Session 10 - 2026-09-23: Last English HUD labels and a working results inspector

Scope: UI lane plus `client/match-inspect.ts` (granted for this round only). No commit, push or deploy. Base: 98d8ac9.

#### What changed

- **HUD labels, Korean-first** (`client/ui/copy.ts` `FIELD_UI_COPY`, used by `client/hud.ts`):
  - Capture bars: `A / RED|BLUE|OPEN|TAKING` became `A / 적색|청색|미점령|점령 중`. The words come from the existing affiliation copy (적색/청색 진영) and objective copy (미점령, 점령 중).
  - Streak: `{who} · {count} KILL STREAK` became `{who} · {count}연속 처치`. The source `streakFmt` in `config/ironsight.config.ts` is not in this lane, so the HUD now reads the copy-module format; the config line still holds the old English string.
  - Damage marks: `FRONT/RIGHT/BACK/LEFT` became `전방/우측/후방/좌측`. 후방 matches the existing ambush wording.
  - The ping-panel states 연결 복구 중 / 연결 종료 and the ambush tag 기습 moved from hard-coded strings in `hud.ts` into the copy module (same text), so the inspector can reference them.
  - No label was left without a counterpart.
- **`client/match-inspect.ts`:** English expectations now come from the copy module (`intermissionStatusLabel`, `COPY.results`, `FIELD_UI_COPY`). Selectors follow the current result view (`.result-view`, `__outcome`, `__score`, `__local`, `__footer`, `.round-honors`, `tr[data-self]`) instead of the pre-Session-4 `.debrief`/`.roundHonors`/`h1` markup. No check was removed or loosened.
- **`client/ui/result-view.ts`:** two checks were catching real regressions, so I fixed the code rather than the checks.
  - The honors card is rebuilt only when the MVP changes; before, every countdown tick rebuilt it (`stableMvp`).
  - When the vote disables "다시 플레이", focus moves to "출격 화면으로" instead of being dropped (`voteFocus`).
  - No visible change.
- **`test/ui-copy.test.ts`:** one assertion for the capture, damage and streak copy.

#### Evidence (`.inspect/ui-r4/`)

- Inspector (`inspector.mjs`):
  - Before, at 1280 (`inspector-before.json`): every results shot threw (`TypeError ... reading 'textContent'`).
  - After: victory, defeat, draw, dom, ffa, standby (intermission), legacy and reconnect are all `__inspectReady` at 1280 (`inspector-after.json`). Victory, dom, ffa, standby and reconnect are also ready at 1920 and 640x360@2x (`inspector-after-sizes.json`).
  - Captures: `after/{1280,1920,zoom200}-match-*.png`.
- Live DOM/FFA bot rooms (`live.mjs`, `live-after.json`) at all three sizes:
  - Capture bars read `A / 미점령`, `A / 적색`, `B / 청색`, `C / 점령 중`. Streak reads `ANCHOR 9 · 3연속 처치`. Damage mark reads `후방`.
  - 0 overlaps and 0 clipping at 1920 and 1280. At 640x360 only the accepted transient overlaps remain, plus the accepted FFA leaderboard clip.

#### Gates

- typecheck PASS; tests PASS (Vitest 200 files / 1667 passed, 9 preexisting skips; Node 92/92); build:client PASS; audit:assets PASS.
- inspect-map relay + practice-two PASS, `errors: []`.
- hitch-probe (advisory, run once): `hitchGate: PASS`, 2 deaths, 0 recompiles, 0 errors.
- Asset bytes unchanged (35,363,446). Client bundle 4,107,823 to 4,109,090 (+1,267).

#### Open questions / limits

- **`match-network` and `match-combat` still throw, on non-copy checks.**
  - Network: `low`, `spikeIgnored`. The delay band does not settle to `low` in the fixture's timing.
  - Combat: `bounded` expects 5 kill-feed rows, but the HUD keeps 4.
  - These are behaviour expectations, not English text, so they are left for their owner rather than edited.
- **`config/ironsight.config.ts` `hud.streakFmt`** still holds the English format and is now unused by the HUD. Its owner can update or drop it.
- **Damage mark at 640x360 FFA:** a `후방` mark at the back position was clipped in 1 of 36 samples, as in Session 9.
- **`Vfx.spawnCasing` TypeError** still appears in live rooms (look lane, already routed).

### Session 9 - 2026-09-23: Live team-mode overlap pass and current screen captures

Scope: UI lane only; no commit, push or deploy. Base: 029f570. Layout only: position, width, padding, z-order. No text, panel, flow or state changed. No blur, shadow, filter or gradient is added, so `client/compositor-preparation.ts` needed no change.

#### What changed

- `client/signal-hud.ts`: the signal event card is capped at `min(350px, 50vw - 14.25rem - 96px)`, so at 1280 it ends left of the centred scores. It used to overlap them.
- `client/ui/hud-field-style.ts`:
  - The reload chip sits on the bottom row, left of the ammo panel. It used to overlap the support card at 1920 and 1280.
  - Results and connection overlays raise `#hud` to `--ui-z-hud`. The body-level tactical map had painted over the live results title at 1280x720.
  - The short-viewport block from Session 8 now covers team modes. Scores and mode share the top row, and the brief ends above the crosshair. Ping, telemetry and health are compact. DOM objectives and capture bars sit in the lower centre band, and the ping notice moves into the centre column.
- `client/ui/match-field-style.ts`: from 801px up, while the deployment banner is showing, DOM objectives and capture bars start below it. They used to overlap the banner at 1920.

#### Evidence (`.inspect/ui-r3/`)

- Live bot rooms on the dev server (`live.mjs`, which uses the r2 probe plus `#hud` grid children): TDM, DOM and FFA at 1920x1080, 1280x720 and 640x360@2x, 50s each. The harness walks, fires and presses Q/B/V, and samples every ~1.5s. Real states seen: team scores, capture bars and objectives, a kill feed with 3-4 live entries, the combat event log, the FFA leaderboard, the streak banner, the support banner (friendly recon flight), signal events on all three maps, the ping notice and hint, the reload chip and the deployment banner.
- Before (`live-before.json/.log`) had overlaps at desktop sizes: TDM 1920 reload/support; TDM 1280 scores/signal and reload/support; DOM 1920 objectives and capture bars under the deployment banner; DOM 1280 scores/signal and reload/support.
- After (`live-after.json/.log`): **0 overlaps, 0 clipped panels, 0 clipped text at 1920 and 1280 in TDM, DOM and FFA.** Practice is re-checked at all three sizes with 0 overlaps (`practice-practice-after.json`). Captures: `{before,after}/{mode}-{size}-{n}.png`.
- Current 1280 captures in `screens/`, all from real client states:
  - Results and intermission: a real TDM round played to its 5-minute end. `1280-results.png`, `1280-intermission.png` (countdown and vote), `1280-next-round.png`. The pre-fix frames with the map over the title are in `screens/before-fix/`.
  - Loading: `1280-loading-{connecting,preparing,control-required}.png`.
  - Reconnect: the dev server was stopped mid-match. `1280-reconnecting.png`, `1280-expired.png`.

A first-time player would say: "팀전에서도 점수, 통신 경보, 재장전 표시가 서로 겹치지 않는다."

#### Gates and measured cost

- typecheck PASS; tests PASS (Vitest 200 files / 1667 passed, 9 preexisting skips; Node 92/92); build:client PASS; audit:assets PASS.
- inspect-map relay + practice-two PASS, `errors: []`.
- hitch-probe `--assert` (advisory under the shared-host rule; run once): `hitchGate: PASS`, 2 deaths, 0 recompiles, 0 frames over 150ms, 0 errors, max frame 16ms.
- Asset bytes unchanged (35,363,446). Client bundle 4,106,187 to 4,107,823 (+1,636); publicBytes 47,368,450.

#### Open questions / limits

- **640x360@2x: transient panels still overlap.** The permanent panels no longer overlap each other in any mode. At this size the kill feed, combat event log, signal event, support banner, ping notice and reload chip still land on permanent panels while they show. Measured TDM panel area is about 345k px² against 208k px² usable (608x344), so they cannot all fit without removing or shrinking information. Owner decision needed, choosing between: (a) accept transient overlays at 640x360; (b) allow a smaller type scale at 500px height or less; (c) queue transient notices through one slot, which is a flow change.
- **640x360 FFA leaderboard** (`#lb`, 12 rows, about 294x267) sits below the viewport and was clipped in every sample. This predates this session. It cannot fit beside the other panels without scrolling or truncation, so it goes to the same owner decision.
- **Reconnect screen:** the legacy HUD connection card peeks out behind the smaller recovery panel (`screens/1280-reconnecting.png`). This predates this session. Hiding it needs `visibility:hidden`, which the service-skin invariant test forbids. I tried it, the test failed, and I reverted it. Referred as a flow request: do not render the legacy connection card while the deployment-flow recovery panel is active.
- **English still on the HUD:** capture labels `A / OPEN|RED|TAKING|BLUE`, the streak `N KILL STREAK`, and damage marks `FRONT/BACK`. These were not in this round's scope.
- **Squad radio and the elimination banner** did not appear in the live runs, so they were not probed live.

### Session 8 - 2026-09-23: Period kill feed and short-viewport HUD layout

Scope: UI lane only; no commit, push or deploy. No flow, state, binding or gameplay change. Base: supervisor commit 223adb0.

#### What changed

- Kill feed Korean-first with period names. `client/ui/copy.ts` adds `FIELD_UI_COPY.feed`. `client/hud.ts` uses it for the non-gun causes and tags: `drone` 복엽기 소사 (was SENTRY; the fixed-path attack biplane, same wording as the existing support copy), `mortar` 박격포 (was MORTAR), `blast` 수류탄 (was GRENADE; `config/ww1-assets.ts` weaponSupport `grenade`), `YOU` becomes 나 (the tactical-map "me" word), and `ASSIST /` becomes `지원 /` (the round-honors assist column). Every English token found had a WW1 counterpart, so no label was kept as-is. Player names are data and are unchanged.
- Short narrow HUD layout. `client/ui/hud-field-style.ts` adds one `@media(max-width:800px) and (max-height:500px)` block, which matches 1280x720 and 1366x768 at 200% zoom. Left column: map, connection, input latency, health. Centre: mode, brief, training coach. Right: support card, signal hint, ammo. A full-width weapon row sits along the bottom. Position, width and padding changes only. No font size, text or panel is removed; no blur, shadow, filter or gradient is added, so `client/compositor-preparation.ts` needed no change. 1280x720 and 1920x1080 match none of the new rules.
- `test/ui-copy.test.ts`: one assertion pins the five feed labels.

#### Evidence (`.inspect/ui-r2/`)

- Layout probe (`layout.mjs` + `layout-probe.js`) on the live practice HUD. It lists every visible positioned panel, checks pairwise intersection, viewport clipping and clipped text. Before (`layout-before.json`): 1280 0 overlaps, 1920 0; 640x360@2x 7 overlaps (hp/coach, mode/map, wbar/coach, wbar/hint, brief/map, brief/hint, coach/hint), with `#ping` and `#combatTelemetry` clipped below the viewport. After (`layout-after.json`): 0 overlaps, 0 clipped panels and 0 clipped text at all three sizes. The same 11 panels are present before and after; at 1280/1920 no panel moved.
- Captures: `{before,after}/{1920,1280,zoom200}-hud.png`, `{before,after}/{1920,1280,zoom200}-killfeed.png`. The kill-feed fixture (`feed-fixture.ts`, `feed.mjs`) drives the real `Hud.addKill` with drone/mortar/blast/head, local kill, local victim and assist; receipts are `feed-{before,after}.json`. Captures use headless Chrome in software mode (headless Aside still stalls, see Session 7).

A first-time player would say: "200%로 키워도 패널이 겹치지 않고, 킬 로그가 전부 한국어다."

#### Gates and measured cost

- typecheck PASS; tests PASS (Vitest 200 files / 1667 passed, 9 preexisting skips; Node 92/92); build:client PASS; audit:assets PASS.
- inspect-map relay + practice-two PASS, `errors: []`; relay median 6.9ms, p99 7.1ms.
- hitch-probe `--assert`: `hitchGate: PASS`, 2 deaths, 0 recompiles, 0 frames over 150ms, 0 errors, max frame 19.4ms.
- Asset bytes unchanged (35,363,446). Client bundle 4,104,203 to 4,106,187 (+1,984); publicBytes 47,365,090.

#### Open questions / limits

- At 640x360 the centre column (mode, brief, coach) necessarily covers the crosshair while the practice coach is shown. The side columns and the weapon row are full, and no panel was removed. Hiding or shrinking the coach there would be a flow/information change, so it is left for the owner.
- Transient and team-mode panels (scores, feed with kills, streak, capture bars, support banner, signal event, squad radio) were not probed at 640x360. Only the practice HUD was checked for overlap.
- Viewports narrower than about 560px with a height of 500px or less would overflow the single-row weapon strip; the existing 520px rules cover the narrow side, but that combination was not captured.

### Session 7 - 2026-09-23: WW1 service-weapon names in the HUD

Scope: UI lane only; no commit, push or deploy. No flow, state, binding, wire-index or gameplay change.

#### What changed

- `client/ui/copy.ts`: new `weaponLabel(key)` maps the five stable `WeaponKey`s (`src/weapon-contract.ts`, read only) to Korean WW1 service names: 1 자동소총, 2 참호 기관단총, 3 펌프 산탄총, 4 볼트 소총 (was "Sniper"), 5 제식 권총; unknown key reads 무기.
- `client/hud.ts`: weapon strip, ammo-panel weapon name (initial placeholder was "AR / AUTO") and kill-feed/elimination weapon cell now read `weaponLabel(WEAPONS[i].key)` instead of the modern `src/config.ts` `name` field. Slot order, key numbers and `setWeapon(index)` are unchanged.
- `test/ui-copy.test.ts`: one focused test pins the five labels to `WEAPON_KEYS` order.
- No CSS, blur, shadow, filter, gradient, font or asset added, so `client/compositor-preparation.ts` needed no change.

#### Task 2 finding (gap list re-checked, no second pass made)

Fresh before captures show menu/mode select, settings and pause already wear the Session 1/5 field skin; results/intermission (Session 4) and loading/reconnect (Session 5) are in the same system and were not re-captured. There is no Tab scoreboard: `#lb` is the FFA leaderboard only, and it already uses `hud-field-style.ts`. No remaining sci-fi screen was found in this pass, so no restyle was made.

#### Evidence

`.inspect/ui-r1/{before,after}/{1920,1280}-{menu,settings,hud,hud-slot4,pause}.png`, 200% zoom as 640x360 CSS at DPR2: `.inspect/ui-r1/{before-zoom,after}/zoom200-*.png`. Harness `capture.mjs`/`browser.mjs`, receipts `capture-*.json`. The strip fits in one row with no clipped slot at 1920, 1280 and 200% (`stripFits: true`). Captures use headless Chrome in software mode, because headless Aside stalls on `Runtime.evaluate` as in Session 6. Official gates use their own unmodified browser.

A first-time player would say: "4번이 저격총이 아니라 볼트 소총이구나."

#### Gates and measured cost

- typecheck PASS; tests PASS (Vitest 200 files / 1667 passed, 9 preexisting skips unchanged; Node 92/92); build:client PASS; audit:assets PASS.
- inspect-map relay + practice-two PASS, `errors: []` in `.inspect/ui-r1-report.json`; relay median 6.9ms, p99 7.1ms, 37 calls.
- hitch-probe `--assert`: `hitchGate: PASS`, 2 deaths, 0 recompiles, 0 frames over 24ms, 0 errors, max frame 17.6ms.
- Asset bytes: 0 change (assetBytes 35,363,446; publicBytes 47,360,820). Client bundle +376 bytes (4,103,827 to 4,104,203).

#### Open questions

- The kill feed still mixes English cause tokens (`SENTRY`, `MORTAR`, `GRENADE`, `YOU`, `ASSIST /`) with the new Korean weapon names. The WW1 name for the "drone" cause (biplane, recon plane?) is a content decision, so this pass left them.
- At 200% zoom the practice HUD overlaps (coach, brief, strip, minimap). The overlap is identical before and after this change; it is gap item 2 (narrow combat layout).

### Session 6 - 2026-09-23: Field dispatch, support and casualty plates (acceptance blocked)

The skin is provisional. This session is **not globally green or fully accepted**. Continuing from the retained partial Session 6 work, final code checks pass; complete browser evidence and hardware readiness remain blocked. No commit, push or deploy.

Reference: R-L12/R-L13 (value hierarchy and readability), R-L14/R-L23 (unchanged information and enemy choices), R-L01 presentation only (existing 3/5/7 tiers). The single inspected mortar-ready state meets its readability target; whole-arc acceptance stays partial.

#### Delivered source

- `client/ui/combat-field-style.ts` supplies paper/olive materials to the support meter, lower-center dispatch, streak stamp and casualty slip. Shared tokens and documented local geometry drive the skin. The seven-kill identity mark is a CSS biplane silhouette.
- `client/support-hud.ts` installs the skin and prepares recon/mortar/drone clones, including the mortar-ready edge and all seven pips with filled/unfilled colors. Live state, eligibility, timing, strings and callbacks are unchanged. `client/ui/hud-field-style.ts` composes death/streak styles; existing Hud clones already prepare those states.
- No new font, asset, texture, gradient, shadow, blur, animation, light, render pass, dependency or gameplay setting. `test/combat-field-skin.test.mjs` checks CSS token/effect/content-suppression policy; its regexes are not behavioral proof.
- Native runtime `prepaint-check.json` verifies the three real clone variants after a three-pip live state: seven visible pips, three filled/four empty, mortar-only readiness, unchanged live DOM and zero surviving preparation nodes. This tests construction, not GPU painting.

#### Wow check and evidence

**“박격포 알림이 목표와 조준점을 가리지 않아 한눈에 읽힌다.”** This describes the one verified state, not an accepted whole arc.

Fresh evidence: `.inspect/ui-session-6/current/1280-mortar-ready.png`, compared with the preserved `before/1280-mortar-ready.png`. Native Aside rendered production classes in an exact 1280×720 iframe. The 1440×900 host screenshot was cropped at 0,0 without rescaling. `current/1280-mortar-ready.json` records geometry and loaded Noto Sans KR. The fixture explicitly calls the existing announcement presentation helper. Pointer lock is false; no live gameplay acceptance is claimed.

Both independent reviewers opened the valid image and found no blocking product issue in that state. Dispatch clears elimination by approximately 24px and loadout by 9px; support clears ammo by 15px. Korean has no tofu, clipped baseline or orphaned final character. `current/mortar-diff.json` confirms dimensions and alpha; its 0.5564 changed-pixel ratio describes a redesign across capture paths, not a fidelity or performance score.

Overall reviews remain **REVISE** (design, `/root/ui6_design_review`) and **FAIL / HIGH** (visual, `/root/ui6_visual_review`) because coverage is missing and hardware gates are red. Reports: `review-design.md`, `review-visual.md`, `visual-verdict.md`. The complete 14-state × 2-size matrix, 200% zoom, font failure, reduced motion and long-binding cases are not accepted. Historical after PNGs predate the latest layout. Failed retries and viewport fallbacks are not substitutes.

#### Gates and measured cost

| Gate | Result | Receipt in .inspect/ui-session-6/ |
|---|---|---|
| Typecheck | PASS, exit 0 | typecheck-final.log, verification.json |
| Full tests | PASS: 1,619 Vitest + 92 Node; nine preexisting skips unchanged | test-final.log |
| Focused UI policy tests | PASS: 4 | focused-final.log |
| Client build / asset audit | PASS, exit 0 | build-final.log, assets-final.log |
| Official Aside map inspection, port 8804, relay/practice-two | FAIL: readiness timeout after shared-lease wait | inspect-map-acceptance.log |
| Official 150000ms-max hitch --assert | FAIL: live-player readiness timeout; no timing result | hitch-acceptance.log |
| Full visual/design acceptance | BLOCKED | visual-verdict.md |
| Lane/diff and owned-process cleanup | PASS | cleanup.json, lane-check.json |

Final shipping public bytes: **52,316,928**, under 60 MiB. New asset/texture bytes: **0**; Meshy spend: **0**. Client bundle: **4,097,961 bytes**, SHA-256 `2d59804151db5253d521a7ff8646eadbb1cd2317bd4660363f950b71599a5ff7`, identical to the captured build. The initial generated bundle was 4,017,088 bytes; the 80,873-byte increase includes preexisting source/bundle drift outside the UI delta and cannot be attributed wholly to this skin. Soldier quarantine and admission records are untouched. No fresh frame-time, texture-residency, first-ready or first-load performance result was obtained.

#### Rejected attempts and handoff

`harness-triage.md` records source, asset-transport and browser-lifecycle hypotheses and parallel read-only debugging advice. Isolated headless/normal Aside, software/leased hardware, preserved baseline fixtures, minimal button/font controls and native CLI were exercised. Some controls work; others time out on font readiness, CDP input or screenshots. Native iframe pointer lock rejects `WrongDocumentError`. Root cause is **unconfirmed**. No product workaround follows from these hypotheses. The lowercase-font 404 was an agent diagnostic, not a product URL.

An initial check-runner command failed before typecheck because Windows cmd received the Git Bash PATH; `typecheck-runner-error.log` retains it. The corrected runner uses absolute Git Bash, and all four final code gates exit 0. A long shell write also hit the Windows command-size limit; the incomplete evidence script was repaired before execution. Neither harness defect changed product code.

Supervisor action: restore a reliable Aside inspection path, then rerun the unchanged hardware gates and complete the fresh visual matrix before accepting Session 6. Defaults remain visual-only, skin-only, unchanged information/enemy choices, no browser/gate substitution and no changes to other streams. No owner answer is needed to preserve those defaults. Required work is explicitly blocked, not marked complete. Owned servers and browsers are stopped. Automatic approval review rejected removal of `aside-profile-luJcGr` and `aside-profile-se76My` with only “blocked by policy”; these two inert evidence profiles remain, as recorded in `cleanup.json`.



### Session 5 - 2026-09-22: Field service, settings and recovery (all required gates green)

Plan: all four steps completed: untouched baseline; field skin and preparation; fresh visual/interaction acceptance; required gates, measurements, log and cleanup. Initial product tree was clean. UI lane only; no commit, push or deploy.

Reference: R-L09 (read status and act), R-L12/R-L13 (value hierarchy and Korean readability), R-L14/R-L23 (unchanged information and enemy choices). The scoped service-screen targets are met; remaining combat presentation and the preexisting settings focus-trap request remain separate.

#### Delivered change

- `client/ui/service-field-style.ts` supplies one paper/olive field-card treatment to loading, control acquisition, preparation failure, reconnect/expired, pause and legacy HUD connection screens. Existing DOM, copy, callbacks and state/action conditions remain intact. Narrow titles use the existing 24px panel scale below 420px to keep complete Korean clauses together.
- `client/ui/settings-style.ts` retains the three tabs, native inputs, scrolling body and fixed actions. Paper headings/selected tabs, ruled rows, brass controls and framed tabular values align it with deployment and reports. Labels stack below 767px; long bindings wrap without losing their reset controls. No change to `client/settings-ui.ts` or the settings store.
- `client/ui/service-compositor.ts` varies detached, inert presentation copies for binding/audio tabs, checked/capture states and normal/error/ready service cards. The existing preparation path paints them during loading; HUD preparation now includes both connection states. Browser evidence confirms unchanged live settings/flow and zero surviving preparation nodes.
- Two new style-boundary invariants cover defined tokens, expensive effects and information suppression. No new asset, font, dependency, gradient, filter, shadow, animation, texture, light or render pass. Existing service gradients/shadows are removed; existing shared hover/focus behavior remains.

#### Wow check and browser evidence

**“설정부터 연결 복구까지 같은 야전 장비처럼 보여서, 어디를 눌러야 할지 바로 알겠다.”**

Evidence root `.inspect/ui-session-5/`: **26 before and 26 after** captures cover 13 states at 1920×1080 and 1280×720: settings controls/bindings/audio, pause, connecting/preparing/recovery/control/retry/reconnecting/expired and both legacy HUD connection states. **44 additional current checks and four live captures give 74 current images.** All 13 states also have 375×812 and 768×1024 evidence. The before fixture is an immutable bundle of unmodified production classes; both versions use the same Relay vista as background only. UI elements are real DOM/native controls.

`checks.json` exercises native invert/reduced-motion/enemy-color controls; F8 binding capture, Escape cancellation and default restoration; long binding strings; save failure/recovery; pause/settings/return/resume and recovery/menu callbacks; keyboard focus; failed font requests plus hover; reduced-motion 0s; and actual hover rest/paused 50ms/settled frames. All three dense settings tabs plus the wheel-scrolled lower bindings have equivalent 200% reflow evidence (960×540 CSS at DPR2), not native browser zoom.

`live.json` drives the shipping menu, persists/restores invert-Y, checks focus restoration, deploys practice with real pointer lock, moves with W, switches to SMG and matches HUD health to room state. It releases lock through the real browser API, opens audio settings from pause, closes and resumes with real pointer lock. No forged lock/state. Four captures document this flow; runtime/console errors are zero.

`evidence.json` and `capture-validation-final.json` bind all 74 PNG signatures/dimensions/freshness to ten exact source/bundle hashes. All **26 full-screen text pairs match** after whitespace normalization. All 26 image-diff receipts preserve dimensions/alpha; their ratios describe the redesign, not a clone-fidelity score. Sampled contrasts: ink/paper **11.416:1**, secondary/raised **8.229:1**, accent/raised **6.657:1**, primary hover **9.774:1**, control boundary **4.779:1**. Critical controls are at least 14px with 44px targets. The native-accent regression fails before (`auto`) and passes after (field brass); connection instructions increase from 14px to 16px.

The first independent visual review rejected two narrow Korean title breaks. `narrow-before.json` reproduces two lines at 28px in 309px content; `narrow-after.json` confirms one complete line at the existing 24px panel scale. Normal and failed-font recovery captures pass. All 74 current captures were refreshed after this final edit. Original review/hardware evidence and rejected frames are preserved in `iteration-1/`.

Both fresh final reviewers **PASS / HIGH**, no blockers: `review-design-final.md` (/root/ui5_design_final) and `review-visual-final.md` (/root/ui5_visual_final). Each directly opened all 74 current images and independently matched all ten hashes. Final bundle SHA-256: **65e28a334b90eda627b922185d3d86ab060a67cd6922aec3d390c088ff635e72**. `visual-verdict.md` reconciles the reviews.

Other rejected evidence: the owned server stopped during an earlier shell timeout; HTTP 000 distinguished this from a product exception/stale menu. A hidden Windows-native restart restored HTTP 200 without a product workaround; exact termination causation is unproven. Baselines were reshot from the immutable fixture to preserve the real dark native-control color scheme. One harness expectation incorrectly assumed ArrowUp was a default forward binding; source/runtime both use KeyW only, so the expectation was corrected. No product binding, skip or threshold changed. See `harness-triage.md`.

#### Gates and measured cost

| Gate | Result | Receipt |
| --- | --- | --- |
| Typecheck | PASS | `typecheck-final.log` |
| Full tests | PASS: 1,605 Vitest tests in 187 files + 92 Node tests; nine preexisting skipped cases in seven files unchanged | `test.log` |
| Client build / asset audit | PASS | `build.log`, `assets.log` |
| Official hardware Aside map inspection, port 8804, relay/practice-two | PASS; no console errors | `hardware-gates-acceptance.json`, `inspect-map-acceptance.log`, `../ui-session-5-acceptance-{relay,practice-two}.png` |
| Official 150000ms-max hitch probe with `--assert` | PASS; two deaths, maximum frame 15.7ms, zero shader changes/errors | `hitch-acceptance.json` |
| Independent design and visual/Korean review | PASS / HIGH, both | `review-*-final.md` |
| Lane/diff check and cleanup | PASS; own server tree stopped, port 8804 closed, zero owned browsers/profiles | `lane-check.json`, `cleanup.json` |

No new asset/texture bytes; **0 Meshy credits**. Asset audit counts **40,853,455 asset bytes unchanged** and **52,689,053 shipping public bytes**, up **12,734**. Bundle grows **5,362 bytes** to **4,017,088**; sourcemap grows **7,372**. Conservative disk total including quarantined soldiers is **61,091,095 bytes** across 94 files; largest file 8,025,108. Both current ceilings remain unchanged. `summary.json` records exact values.

Final Relay inspection on RTX 5070 at 1920×1080: median **6.9ms**, p99/max **7.1ms**, 38 calls, 230,200 triangles, 18 textures, estimated **33.681 MiB** texture residency; construction **196.3ms**, scene preparation **1,144.8ms**. Practice-two reports one player at 100 HP, 63 calls and 26 textures. No paired gameplay frame/texture/load delta was collected; these desktop results do not qualify the laptop iGPU target.

Final hitch lease acquired **14:25:10.951Z**, completed **14:27:07.025Z** after the shared GPU queue. Measurement covers **110,760ms / 15,946 frames**, stopping under the existing two-death rule before the 150000ms maximum. Maximum frame **15.7ms**, maximum animation callback **11.2ms**, p99 upper bound **8ms**. Two deaths; zero long tasks, frames above 24ms, shader recompiles and console errors. First-damage/death windows peak at **12.7ms / 8.3ms**, both PASS. The official scripts, lease and thresholds are unchanged.

Fresh-profile loopback first-ready time is **3,276.8ms**; scene preparation **1,150.7ms**, UI preparation **716.2ms**. UI-only software preparation is **948.1ms**; the separate live software practice run records **1,526.1ms**. These observations are not production/device cold-load qualification or paired improvement claims. The original-build hardware pass is retained separately; final acceptance uses the reviewed final hash.

Separate post-ready/pre-measurement gaps of **180.2ms and 247.1ms** remain recorded. The unchanged official gate excludes this startup window. This session does not establish hitch-free startup or its cause; the measurements are routed to Look/supervisor alongside Sessions 2/4.

#### Handoff and limits

Open owner questions: none. Defaults remain existing gameplay, text, controls, enemy choices and world vistas; remaining combat overlays are the next UI arc. Software screenshots prove appearance/interaction; equivalent reflow is not a native zoom observation and mobile screenshots do not qualify FPS gameplay. TypeScript LSP is unavailable (installation previously declined); both project `tsc` checks pass.

Reviewers identified a preexisting missing Tab focus-trap branch in unchanged `client/settings-ui.ts`. It is referred under Cross-stream requests for a separately authorized flow fix; no full-dialog accessibility compliance is claimed. Soldier quarantine/provenance remain unchanged in their owning lane.

Final cleanup stops owned Wrangler root **40324** and its six descendants; port 8804 is closed, with no owned browser/profile or gate runner remaining. No out-of-lane source was touched. `AAA-PLAN.md`, shared inspectors/probes, renderer/gameplay/settings-store files and other streams' assets remain unchanged. No commit, push or deploy occurred.

### Session 4 - 2026-09-22: Field reports (all required gates green)

Plan: all four steps completed: untouched baseline; token skin and preparation; fresh visual/interaction acceptance; required gates, log and cleanup. Session 3's interrupted preparation is completed by this session.

Reference: R-L05/R-L07/R-L17 (unchanged round timing, results and honors), R-L12/R-L13 (readable value hierarchy), R-L14/R-L23 (preserved information and enemy choices).

Continues the unfinished Session 3 field-report arc. Initial product worktree was clean; only the prior plan entry was modified. UI lane only, no asset generation, dependency, gameplay, copy, state-machine or flow changes, commit, push or deploy.

#### Delivered change

- `client/ui/match-field-style.ts` supplies the existing live result and deployment components with one field-report skin. The paper result header gives outcome and score a strong readable hierarchy; olive honors and a compact personal ledger align left. Roster names receive 64% of each table while kill/death columns stay aligned. The existing fixed header/action footer and body-only scrolling remain.
- Explicitly scoped button styles preserve the shared paper primary action and olive secondary action against older HUD rules. Before the change both buttons rendered the same saturated amber; the browser regression check fails before and passes after. Actions, vote state and content are unchanged.
- Deployment countdown/go/waiting/standby retain the same labels/timing/progress, using a paper count stamp, body-font Korean and shared olive/success tones. The connection flow panel is unchanged and remains in the next arc.
- Loading preparation includes the real result skin and additional inert defeat/voted/draw and go copies. No new blur, gradient, shadow, animation, texture, light, render pass or asset. Two skin-boundary invariants verify defined tokens and prohibit added effects/information suppression; existing presentation tests retain behavior coverage.

#### Wow check and browser evidence

**“전과 보고서처럼 승패와 내 활약이 한눈에 들어온다.”**

Evidence root `.inspect/ui-session-4/`: 20 untouched before and 20 after PNGs, covering countdown/go/waiting/standby plus TDM, domination, FFA, defeat, draw and empty results at 1920×1080 and 1280×720. `fixture-before.js` was bundled from unmodified production classes before implementation, then preserved; both fixtures use the same fixed Relay vista only as background. This is real production DOM, not a UI image substitute; it is not a recording of a completed server round.

An additional 18 current images cover 375/768px results, dense 200% equivalent reflow, long player names, actual wheel-scrolled lower rosters, vote-disabled state, keyboard focus, actual font-request failure plus hover, reduced motion, and hover rest/middle/end. `checks.json` proves actual restart/leave callbacks each fire once, disabled repeat does not fire, Tab reaches leave, reduced-motion transitions are 0s, and preparation leaves zero nodes. The 768px report naturally fits without scrolling; the harness was corrected to require wheel movement only when overflow exists.

`evidence.json` binds all 38 current PNG signatures/dimensions/freshness to eight exact source/bundle hashes. All 20 full-screen text comparisons match after normalizing layout whitespace. Controls are 16px/44px; honors labels are 14px. Neutral sampled contrast: ink/paper 11.416:1, secondary/raised 8.229:1, accent/raised 6.657:1, button ink/hover 9.774:1 and control boundary/plate 4.779:1. `diffs.json` contains all 20 before/after pixel analyses; changed-pixel ratios describe the redesign, not a clone-fidelity score.

The captures use isolated software Aside to avoid sharing the GPU with other streams. 200% is 960×540 CSS at DPR2, an equivalent reflow check, not an observed native browser zoom shortcut. Font failure is confirmed by Noto Sans KR `status:error`; fallback Hangul remains readable. Unbroken long names wrap and retain their existing compact-name policy. Mobile evidence establishes report access, not mobile FPS gameplay.

Rejected evidence: the first capture timed out while returning a FontFaceSet through CDP. Phase instrumentation showed navigation, injection, rendering and font loading complete; returning a primitive from the font-ready promise allowed the full run. No product workaround was added. The first responsive script wrongly required scrolling at 768px where all content fits; its assertion was corrected without touching product CSS.

#### Gates and measured cost

Typecheck, full test suite (1,603 Vitest passes across 186 files, nine pre-existing skipped cases in seven files unchanged; 92 Node passes), build and asset audit pass. Focused presentation tests and real-browser style regression pass. Official hardware map inspection passes with no console errors. The official `hitch-probe` with 150000ms maximum and `--assert` passes. Receipt: `hardware-gates-acceptance.json`, `hitch-acceptance.json`.

No added asset/texture bytes; 0 Meshy credits. Asset audit counts 40,853,455 asset bytes unchanged and 52,676,319 shipping public bytes. Conservative on-disk total including quarantined files is 61,078,361 bytes (94 files), largest 8,025,108 bytes. Public artifacts increased 27,342 bytes from the retained initial build: bundle +11,055 to 4,011,726 bytes, sourcemap +16,287. The initial bundle retained Session 2's hash; these are artifact deltas, not a controlled isolation of UI-only bundling from intervening source changes.

Required Relay inspection on RTX 5070 at 1920×1080: median 6.9ms, p99/max 7.1ms, 38 calls, 230,200 triangles, 18 textures, estimated 33.681MiB texture residency; construction 448.6ms, scene preparation 1,507.5ms. Practice-two has one live player at 100HP, 63 calls and 26 textures. No paired gameplay-frame/texture/load delta was collected; this desktop GPU does not establish the laptop iGPU target. Software UI-only preparation was 586ms, including the additional prepared states; final hardware startup timing remains separate.

Open owner questions: none. Defaults: retain gameplay/copy/controls, enemy choices and existing world vistas. Next coherent arc is settings/loading/connection overlays. Owned Wrangler root PID 17308 and its six descendants are stopped; port 8804 is closed. No session profile, browser, official inspection browser or gate runner remains (`cleanup.json`).

Final hardware hitch receipt: lease acquired 13:23:56Z; 131,307ms measured across 18,906 frames, two deaths/respawns; max frame 14.5ms, max animation callback 9.3ms, p99 upper 8ms, zero long tasks, frames above24ms, shader recompiles or console errors. First-damage/death windows max13.9ms/9.5ms. First-ready from navigation 3,598.7ms; scene preparation1,193.4ms, UI preparation596.7ms. These are fresh-profile loopback observations, not production cold-load or paired improvements.

Separate startup diagnostics retain post-ready/pre-measurement gaps of234.7ms and322.5ms. The unchanged official gate excludes this window. As in Session2, this does not establish hitch-free startup or identify a UI/renderer/driver root cause; measurements are routed to Look/supervisor. No threshold or official inspector file was changed.

#### Independent acceptance and handoff

Both independent reviews PASS with HIGH confidence and no blockers: `review-design.md` (/root/ui4_design_review, all 38 actual images, six baseline images, all hashes and source/interaction traces) and `review-visual.md` (/root/ui4_visual_review, all 38 actual plus all 20 baseline images). All eight source/bundle hashes independently match. The reviewed bundle SHA-256 is `d083673d1a0561ac20570f055034eff6621b5ca7c5455cbe0712f51c7cbbb8be`; hardware acceptance runs the same bundle.

| Gate | Result | Receipt |
| --- | --- | --- |
| Typecheck / full tests / build / assets | PASS | `typecheck.log`, `test.log`, `build.log`, `assets.log` |
| Official hardware Aside map inspection, relay/practice-two | PASS, no console errors | `inspect-map-acceptance.log`, `../ui-session-4-acceptance-{relay,practice-two}.png` |
| Official 150000ms-max hitch probe with --assert | PASS, two deaths, max frame 14.5ms, zero shader changes/errors | `hitch-acceptance.json`, `hardware-gates-acceptance.json` |
| Independent design and visual/Korean review | PASS / HIGH, both | `review-design.md`, `review-visual.md` |
| Lane/diff check and cleanup | PASS | `final-check.json`, `cleanup.json` |

No out-of-lane file was edited; `AAA-PLAN.md`, admission records, gameplay, other streams and official inspection scripts are unchanged. No commit, push or deploy. Software fixtures and a hardware bot-round gate provide the scoped evidence; native zoom, a completed live-server result screen, five-run TDM/FFA stability and the laptop iGPU remain outside the demonstrated acceptance of this session.

### Session 3 - 2026-09-22: Field reports (interrupted preparation; superseded by Session 4)

Reference: R-L05/R-L07/R-L17 (unchanged round rhythm, winner and honors), R-L12/R-L13 (readable value hierarchy), R-L14/R-L23 (unchanged information and enemy choices).

1. Superseded: capture untouched deployment/result baselines in Aside; verify the existing shared primitives and live integration.
2. Superseded: apply the field-report treatment to results, honors and deployment countdown; retain copy, state, actions and timing; cover paint preparation.
3. Superseded: before/after 1920×1080 and 1280×720, dense 200% reflow, narrow layouts, font failure, reduced motion and real interactions; independent visual reviews.
4. Superseded: typecheck, full tests, build, asset audit, required hardware map inspection and hitch probe; finish receipts, gap list and process cleanup.

Scope: UI-owned files only. No new asset, dependency, commit, push or deploy. The camera-intro view is look-owned; any requested skin integration there will be routed through Cross-stream requests.

### Session 2 - 2026-09-22: Field instruments (required gates green)

Branch `ironsight-ww1-ui`; app scope only. Retained uncommitted Session 1 work. No commit, push, deploy, new dependency, asset generation or gameplay/flow change.

Reference: R-L12/R-L13 (legible values and restrained palette), R-L20 (four readable kill-feed entries), R-L14/R-L23 (same information and enemy choices). Session 2 meets the scoped HUD presentation targets; remaining screens are listed in the gap list.

Plan:
1. Completed: reproduce and isolate the original kit provenance failure; build matching retained-style baselines.
2. Completed: shared field tokens on HUD instruments and feedback; loading preparation for new surfaces; UI invariants.
3. Completed: 29 final Aside captures, live practice interaction, and two independent PASS/HIGH design and visual/Korean reviews.
4. Completed: typecheck, full tests, build, audit, final-source map inspection and locally quiet hardware hitch acceptance all pass. Owned server/browser cleanup and final hash/lane checks pass.

#### Delivered change

- `client/ui/hud-field-style.ts` applies existing olive, paper and brass tokens to health, ammunition, loadout, scores, mode/objectives, connection/latency, leaderboard, feedback and radio plates. Critical labels are at least 14px. Intrinsic grid rows separate feed and server-event messages.
- `client/hud.ts` installs the skin and prepares detached objective, accepted-hit/kill, reload and directional combat fixtures during loading. `client/compositor-preparation.ts` also prepaints the ping hint. No new blur, filter, gradient, shadow, animation, WebGL texture, light or render pass.
- `client/tactical-map.ts` gives the existing hint readable backing and intrinsic width capped at 360px. `client/ui/field-copy.ts` preserves authored slash/bullet phrases and newlines. `client/training-coach.ts` clears the enlarged telemetry, keeps the final Korean phrase together, and compacts completion spacing. Text, actions, state and bindings are unchanged.
- `test/hud-field-skin.test.mjs` adds two presentation invariants for tokens, unchanged information and prepaint/effect boundaries. DESIGN.md records the geometry and copy treatment. User-selected enemy colors, reticle and damage effects remain unchanged.

#### Wow check and browser evidence

**“체력과 탄약, 명중 확인이 또렷해서 전투 중에도 바로 읽힌다.”**

Evidence root: `.inspect/ui-session-2/`. Final set: **43 PNGs**, comprising 14 before and 29 current captures. Primary before/after pairs cover TDM, FFA, domination, practice, combat and domination-combat at 1920×1080 and 1280×720. Completion-coach baselines add the other two pairs. Real Hud/TacticalMap/TrainingCoach classes render fixture DOM/canvas against a fixed Relay vista; the image supplies background only.

Before captures reconstruct the retained pre-session CSS through the fixture bundler; they are not an untouched earlier binary. `baseline-build.json` asserts all three transforms and different bundle hashes. The first comparison was rejected because a Windows path matcher had not applied its transform. The fixture clock was also corrected to settle throttled hints. Superseded evidence is not acceptance.

The 16 current check captures cover eight long FFA names, long confirmation, dense HUD/settings equivalent 200% reflow, 375/768px menus, font failure, reduced motion, long bindings, actual feed animation at 0/80/160ms, completed coach at both sizes, and completion plus long bindings/ready latency/mute at both sizes. Independent reviewers found two iterations of insufficient coach/hint clearance and awkward Korean wrapping; final intrinsic-width hint and phrase treatment repair both. Combined 1280 state: coach bottom 539.578px, hint top 548.406px, **8.828px gap**, two-line 58px hint.

All 14 text comparisons pass, with only nondeterministic FPS normalized. `evidence.json` verifies all PNG signatures/dimensions, seven exact source/bundle hashes, no geometry findings/errors, critical text at least 14px, and worst sampled neutral text contrast **6.3388:1** (primary 12.7821, secondary 9.3304, accent 7.5478, ink/paper 11.4164). Bundle SHA-256: `7054474923520af3e8eeae343fb051bf6a859d6aea4ece49fb490bafafe0ec65`, built at 12:23:16Z. All current captures follow this build.

The real Aside practice run (`live.json`, `checks/live-practice.png`) enters through the current deployment flow, obtains pointer lock, moves with W, switches to SMG with Digit2 and checks rendered HP against room state. It records movement, SMG/32 rounds, 100 HP matching state, no console errors and cleanup. No forged lock or state.

Visual harnesses use isolated Aside with software rendering to avoid competing for the shared GPU. They establish appearance/interaction only. The 200% case is equivalent 960×540 CSS reflow at DPR 2, not native browser zoom. Mobile evidence covers menus, not mobile combat. Preparation evidence confirms unchanged live text and zero remaining preparation nodes.

Final independent approvals: `review-design-final.md` (/root/signoff_design) and `review-visual-final.md` (/root/signoff_visual), both **PASS / HIGH**, all 29 current images directly opened and all seven hashes independently matched. Neither approval substitutes for hardware gates.

#### Gates and measured cost

| Gate | Result | Receipt |
| --- | --- | --- |
| `pnpm typecheck` | PASS | `typecheck-final.log` |
| `pnpm test` | PASS: 1,513 Vitest tests in 177 files and 83 Node tests; nine existing skips unchanged | `test-final.log` |
| `pnpm build:client` | PASS | `build-final.log` |
| `pnpm audit:assets` | PASS | `assets-final.log` |
| Required hardware Aside `inspect-map`, port 8804, `relay,practice-two` | PASS, zero console errors | `inspect-map-acceptance.log`, `../ui-session-2-acceptance-{relay,practice-two}.png` |
| Required 150000ms hitch probe with `--assert` | PASS: two deaths, max frame 21.3ms, max callback 6.3ms, p99 upper 13ms, zero shader changes/errors | `hitch-acceptance.json`, `hardware-gates-acceptance.json` |
| Independent design and visual/Korean review | PASS / HIGH | `review-*-final.md` |
| Final lane/diff check and cleanup | PASS; owned server tree stopped, no session browser/profile/runner, port 8804 closed | `cleanup.json` |

Shipping public bytes are **52,648,977** under the 60 MiB ceiling. Conservative disk sum including quarantined soldiers is 61,050,835 bytes; largest file 8,025,108 bytes. Session 2 adds no asset/texture bytes and spends 0 Meshy credits. Bundle grows **10,970 bytes** to 4,000,671; sourcemap grows **12,418 bytes** to 7,794,088. The raw public total changes with externally reconciled metadata, so it is not solely a UI delta.

Required Relay inspection on RTX 5070 at 1920×1080: median **6.9ms**, p99/max **7.1ms**, 38 draw calls, 230,200 triangles, 18 textures and **33.681 MiB** estimated texture residency. Scene preparation is **998.9ms**, construction 198.7ms. Practice-two reports one live player at 100 HP, 63 calls and 26 textures. No paired baseline gameplay frame/load delta was collected; these desktop results do not qualify the laptop iGPU target. Final local TDM first-ready time is **3,961.6ms** from navigation; scene preparation **1,251.6ms**, UI preparation **567.4ms**. These are fresh-profile local observations, not production load or paired before/after deltas.

Two earlier hardware attempts remain recorded: `hitch.json` fails with a 156.2ms maximum animation callback; `hitch-final.json` fails with a 231ms long task despite a 14ms maximum callback. Both have two deaths, zero shader changes/errors and passing first-damage/death windows. Own full-suite/software-browser work overlapped both measurements; the final queued acceptance follows completion of that work. This is a distinguishing control, not proof that concurrency caused either failure. See `hitch-triage.md`. No threshold, official script, gameplay or renderer source was changed.

#### Final hardware acceptance and limits

The exact required command, using hardware Aside and the official GPU lease, passes on the reviewed bundle. The probe acquired the lease at **12:33:00Z**, finished at **12:34:51Z**, and measured **104,012.9ms / 14,975 frames** (150000ms is the configured maximum; the existing probe stops after its second death/respawn). There are **two deaths, no long tasks, no shader recompiles, no console errors and no frames over 24ms**. Maximum frame **21.3ms**, maximum animation callback **6.3ms**, p99 upper bound **13ms**. First-damage/death windows are **19.3ms / 14.3ms**, both PASS.

All own full-suite/software capture work ended before this run. No code or gate policy changed between the preceding failed run and this control. It supports avoiding simultaneous local verification workloads but does **not** identify the failures’ root cause or establish the look stream’s five-run TDM/FFA stability target. Both failed receipts are retained.

Separate startup diagnostics record two post-ready/pre-measurement frame gaps, **296.8ms and 308.5ms**, before hitch measurement begins. The required gate excludes that window; this session does not claim hitch-free startup. Exact timestamps and preparation measures are retained in acceptance-summary.json and hitch-acceptance.json for the look stream. No UI effect or product workaround was added to conceal them.

#### Provenance and handoff

The starting asset audit failure was reproduced before source edits. Raw/LF hashes ruled out line endings; candidate GLBs matched but kit builder/metadata receipts did not (`provenance.md`). During this session, external edits reconciled the admission manifest and weapon/character metadata. The unchanged audit now passes. UI did not edit or revert those kit-owned files. Soldier assets remain quarantined and excluded by the existing audit; their builder mismatch is not represented as repaired/admitted.

During this session, the working tree retained Session 1 UI edits and showed external modifications to `config/ww1-authored-admission.json`, five weapon metadata files and two character metadata files. Session 2 changes HUD, tactical map, training coach, compositor preparation and field-copy, plus the new HUD style/test, DESIGN.md, AAA-PLAN-UI.md and evidence. `AAA-PLAN.md`, other lane source, test thresholds and shared inspection scripts are untouched by UI.

Open owner questions: none needed. Defaults: unchanged gameplay, copy, flows and enemy-color settings; retain prior world vistas pending the world stream; match presentation is the next coherent UI arc. Owned Wrangler root PID 46268 and its six descendants are stopped. No session browser, profile directory or gate runner remains; port 8804 is closed (cleanup.json). No commit, push or deploy occurred.

### Session 1 - 2026-09-22: Field orders, deployment skin (UI complete; global gates blocked)

Branch `ironsight-ww1-ui`; app scope only; no commit, push or deploy. Source inspection found that `client/ui/tokens.ts`, primitives and Korean fonts already exist, contrary to the supervisor's older note. Reuse them; do not add a second system. `AAA-PLAN.md` is untouched.

Reference: R-L09 (read objective/training and act), R-L12/R-L13 (value hierarchy and legibility), R-L14/R-L23 (unchanged information and enemy choices). The deployment-menu targets are met in the evidence below; the global hitch requirement is explicitly unverified.

Initial test gate found four missing-fixture failures in two weapon-contact test files. Restored the five local `.inspect/ww1-art/production-candidates-v3/*/candidate.glb` fixtures from the already-published public GLBs, verifying each against the existing admission SHA-256 first. No kit source, assets, expectations or thresholds were edited. `.inspect/ui-session-1/restored-fixtures.json` records this setup repair; full suite now passes (1,511 Vitest tests plus 83 Node tests; 9 pre-existing skipped cases unchanged).

Browser evidence uses isolated **Aside Browser** executable instances, exact device metrics and owned profiles, driven through CDP. Aside CLI selection/snapshot worked, but its screenshot calls timed out and it exposed no viewport API; no CLI screenshot success is claimed. The 200% evidence uses a 960×540 CSS viewport with DPR 2 for 1920×1080 pixel output, an equivalent reflow check, not an observed native browser zoom shortcut.

Rejected intermediates: the first narrow treatment broke “시간 제한 없음” across lines; existing slash/bullet-separated phrases now stay together without changing text. The first paper-map low-cover color measured 2.449:1; replaced it with the shared subtle-border tone (6.284:1 on paper), and gave ramps an ink outline (11.416:1). Final product captures were regenerated after those changes. No threshold was widened.

#### Delivered change and boundaries

- `client/ui/deployment-style.ts` contains the scoped field-order treatment, consuming the existing shared palette, spacing, type and button primitives. `client/mode-select.ts` retains the existing DOM shell, handlers, settings/focus restoration, URL selection and duplicate-deploy guard. Responsive grid placement separates the briefing, map and mode cards without changing the player flow.
- `client/ui/field-copy.ts` groups authored slash/bullet-separated phrases to avoid awkward Korean wrapping. Training cards use the existing canonical Korean site names. All four mode objectives remain authoritative.
- `client/map-presentation.ts` adds only SVG presentation classes; collision-derived shapes and fallback colors are unchanged. Menu-scoped paper/ink styles do not restyle other consumers. `test/deployment-skin.test.mjs` checks geometry preservation and shared-token/effect boundaries.
- The only new asset is the self-hosted Stardos Stencil bold wordmark font plus its SIL OFL license. Korean remains in the existing Hangul-capable body/system stack. Official google/fonts provenance and reproducible download commands are appended to `public/assets/README.md`; exact hashes are appended in the permitted `# ui` audit block and allowlisted in `.gitignore`. No existing audit was weakened.
- No new live HUD/combat effects, blur, filter, shadow, animation, WebGL texture, light, render pass or dependency was added. The menu's existing directional gradients are recolored; menu CSS is painted before deploy and removed on deploy, while direct mode entry does not install it. `client/compositor-preparation.ts` therefore needs no additional combat pre-render entry for this change. This reasoning does not waive the blocked hitch gate.

#### Wow check and browser evidence

Fixed-size before/after stills cover all four menu modes at 1920×1080 and 1280×720: `.inspect/ui-session-1/before/{1920,1280}-{tdm,ffa,dom,practice}.png` and the matching `after/` paths. The first-time-player sentence is: **“이제 출격 전에 야전 지도를 펴 놓고 작전을 고르는 느낌이다.”**

The current evidence set contains 35 final PNGs: eight primary after captures, 25 interaction/responsive/stress captures in `checks.json`, and two middle-scroll additions in `extra.json`. Coverage includes 375px/768px layouts, all three training sites, dense settings at equivalent 200% reflow, rest/mid/settled hover, keyboard focus, reduced motion, actual font-request failure with hover, long rebinding labels and the shared primitive showcase. Those supplemental screens were stress-checked, not migrated in this session. Browser assertions confirm native selection, footer reachability, critical text size, no horizontal overflow, no unexpected console errors and no matchmaking/WebSocket before deploy.

Final source changed at 11:01:44Z, build at 11:01:45Z; `refresh.json` binds seven exact source/bundle SHA-256 values to the complete refresh finished at 11:14:43Z. One screenshot-only defect was found independently: the initial hover midpoint had landed after the 100ms transition. `hover-middle.mjs` paused the five actual CSS transitions at 50ms and replaced that frame at 11:21:12Z, with intermediate background `rgb(232,209,161)`. `checks.json` records the method; both reviewers reopened the replacement. Product source did not change during this repair.

The final capture harness used the real isolated Aside executable with `--disable-gpu --disable-gpu-compositing`, allowing layout/interaction evidence while another session held the exclusive hardware lease. The baseline captures and required map inspection used hardware Aside. Software screenshots prove appearance only. `menu-diff.json` confirms matching dimensions and intact alpha; its 0.9959 changed-pixel ratio describes the intended reskin, not a clone-fidelity score.

- Final independent Pass A: `.inspect/ui-session-1/review-design-final.md`, PASS / HIGH, all 35 current captures directly opened and seven source hashes verified.
- Final independent Pass B: `.inspect/ui-session-1/review-visual-final.md`, PASS / HIGH, all 35 current captures plus eight baselines directly opened; PNG dimensions/bytes/freshness and rendered map colors independently verified.
- Contrast receipt: `.inspect/ui-session-1/contrast.json`. Low cover/paper 6.284:1; high cover and ramp outline/paper 11.416:1; secondary text/raised plate 10.038:1; deploy label/hover 9.774:1; selected border/plate 3.918:1.

#### Gates and measured cost

| Gate | Result | Receipt |
| --- | --- | --- |
| `pnpm typecheck` | PASS | `.inspect/ui-session-1/typecheck.log` |
| `pnpm test` | PASS: 1,511 Vitest tests in 176 files plus 83 Node tests; nine existing skipped cases in seven files unchanged | `.inspect/ui-session-1/test-final.log` |
| Final focused UI tests | PASS: 13/13 after final CSS change | `.inspect/ui-session-1/ui-tests-final.log` |
| `pnpm build:client` | PASS | `.inspect/ui-session-1/build.log` |
| `pnpm audit:assets` | FAIL: same pre-existing kit builder/five metadata hashes as before UI work | `.inspect/ui-session-1/assets-before.log`, `assets-final.log` |
| Required `inspect-map`, port 8804, `relay,practice-two` | PASS, zero console errors, hardware Aside | `.inspect/ui-session-1/inspect-map.log`, `.inspect/ui-session-1-{relay,practice-two}.png` |
| Required 150000ms hitch probe with `--assert` | BLOCKED: shared GPU lease timed out after 1800000ms, no probe result | `.inspect/ui-session-1/hitch.log` |
| Two independent visual reviews | PASS / HIGH | `review-design-final.md`, `review-visual-final.md` |
| `git diff --check` and lane audit | PASS | Final worktree check; only permitted app paths changed |
| Owned-process cleanup | PASS | `.inspect/ui-session-1/cleanup.json` |

`budget.json` measures 61,026,195 public bytes against the current 60 MiB (62,914,560 byte) limit, a 45,155-byte increase from 60,981,040. It conservatively includes quarantined soldier files and is not an asset-admission verdict. Largest file: 8,025,108 bytes, below 25 MiB. Font/license add 37,468 bytes; client bundle grows 3,415 bytes to 3,989,701 and sourcemap grows 4,272 bytes to 7,781,670. New WebGL texture bytes: 0; Meshy spend: 0 credits. The two UI asset hashes pass independently, although the full audit exits earlier on kit provenance.

First-load observation in `extra.json`: cache-disabled loopback menu navigation in the same isolated software Aside session after viewport captures gave FCP 168ms, load event 270.9ms and observed fonts-ready 279.8ms. Stencil font transferred 22,150 compressed bytes in 31.7ms. These are local navigation observations, not a fresh browser-process/production/device cold-start measurement; no comparable baseline load delta was collected.

Required Relay inspection at 1920×1080 on the RTX 5070 reports median frame 6.9ms, p99/max 7.1ms, 38 draw calls, 230,200 triangles, 18 textures and estimated 33.681 MiB texture residency; scene preparation 1,079.6ms. Practice-two reports one live player at 100 HP, 63 calls and 26 textures. No before/after gameplay frame delta was collected. These static desktop-GPU results do not prove the laptop iGPU target or first-fight hitch acceptance.

#### Handoff and defaults

Global green acceptance is **blocked**, not complete: the supervisor must reconcile kit provenance in its owning lane, then rerun the unchanged asset audit and exclusive hardware hitch gate. No prohibited file was changed to work around either issue. Other streams' processes and leases were left intact. Owned Wrangler PID 47016 and its descendants were cleaned up; no session-owned Aside browser remains and port 8804 is closed (`cleanup.json`). No commit, push or deploy occurred.

Open owner questions: none required for this session. Defaults remain active: retain the current gameplay/copy/URLs and selectable enemy colors; use existing shared tokens for the next HUD pass; accept the old menu vistas until the world stream supplies replacements; do not call this session globally green until both outstanding gates pass.
