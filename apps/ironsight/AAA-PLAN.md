# IRONSIGHT / RELAY — rebuild plan

## OWNER PLAYTEST GUIDE

**Preview:** https://ironsight-next.plain-wave-5d5b.workers.dev
Supervisor reports sessions 1-10 are deployed there, including the persisted-room
fix. Session 11 Switchyard presentation remains local until the supervisor
publishes it. Continue development using the standing brief's active defaults.
**Live fps.tikron.dev stays unchanged. This is not live acceptance.**

Try this in 10 minutes with headphones, mouse/keyboard and another player ready:

| Time | Try | Look for |
|---|---|---|
| 0-1 min | Open Settings using Tab/Enter; adjust sensitivity, rebind a key, close with Escape. Try volume and Reduced motion. | Clear focus, readable labels, saved choices; no unwanted movement while in a menu. |
| 1-3 min | Training / Relay: sprint all three lanes, climb both decks, crouch at cover. Watch arena preparation; fire, aim, reload and switch all five weapons (1-5), then throw G away from yourself. | Solid visible cover, readable enemies/exits, comfortable aim, no first-shot/blast freeze; stable grip and unobstructed sights. |
| 3-5 min | Return to deployment, choose Training / Undertow. Visit A/B/C and both control ledges; die and respawn once. | Distinct routes, no snagged ramps/invisible walls, readable health/ammo and safe respawn. |
| 5-10 min | Join a running Relay TDM with the other player. Fight across cover, open Escape/settings, return, then vote rematch if the round ends. | Correct team/result, hits that agree for both players, clear death/recovery, preserved controls after menus and rematch. |

A solo warmup or bots do **not** validate 6v6. If no round finishes within the ten
minutes, record rematch as untested. Report browser/GPU, map, weapon and the exact
trigger for any hitch, clipping, confusing UI or disagreeing hit; a short clip helps.

**Before switching live, still required:**

- Representative mid-laptop iGPU: 1920x1080, balanced/DPR 1, twelve real players,
  both maps, sustained shooting/blasts and a full-match/thermal soak. Confirm
  median <=16.7 ms / >=60 fps, record p95/p99, cold first-use stalls and recovery.
  RTX 5070 render fixtures do not establish this or network/room capacity.
- Owner/players: real 6v6 spawn/route fairness, hit feel across actual RTT, full
  round/results/rematch, audio comfort/direction, mouse controls and visual approval.
- Firefox and Safari/WebKit on supported real devices; pointer lock, audio gesture,
  reconnect, browser zoom and keyboard/screen-reader settings review. Local matrix
  covers only Windows Blink browsers. Controller support is not implemented;
  implement and test real hardware before claiming controller compatibility.
- Supervisor: publish this candidate to preview, exercise real deployed Durable
  Object cold eviction (expected NEW round), short reconnect and lost-seat timeout,
  then verify the reviewed private asset set is present. No deployment done here.
- Remaining animation acceptance: human finger/wrist contact and moving reload
  review on all five weapons. Session 7 moves the steep-upward weapon arc outside
  the neck and adds server-deadline remote reloads (magazine/cell, charge, support
  hand and lowered aim). Captures and transform tests are engineering evidence,
  not full M2 acceptance. Inspect another player's 1-5 swaps, reload interruption,
  crouch and steep aim. Listen for left/right shots, steps and blasts while turning;
  stereo direction is implemented, not HRTF elevation or cover occlusion.
- Session 7 changes the state fingerprint and snapshot version to 4. Supervisor
  must publish client and Worker together; old open tabs need a refresh. Older
  snapshots intentionally start a fresh round. Ammo counts remain owner-only.
- Cold-start qualification: session 7 also prepares shared remote reload-part
  buffers before controls attach. Final isolated Edge effects runs show 7.1 ms
  first-ready peaks, 260-472 ms preparation and 28-52 ms scene construction.
  This is moving initialization into a visible loading phase, not eliminating its
  cost. Browser/driver cold caches, weak GPUs and slow networks still need testing.
- Owner explicitly approves the final preview and these remaining gates before the
  supervisor changes the live worker. Defaults remain industrial daylight, 6v6 TDM,
  stylized sci-fi. No new owner decision is needed to continue development.


### OWNER FIRST-PLAY ISSUES

Remaining after session 8, ranked by player impact. These are observations and
follow-ups, not a claim of human playtest or laptop performance acceptance.

1. **Disconnect detection timing.** The local graceful-close drill took
   **30,535 ms** from requesting WebSocket close to the reconnect notice, then
   **711 ms** to recover the same seat (`session8-reconnect-timing-report.json`).
   This includes the browser/protocol closing handshake; it is not measured
   Wi-Fi-outage recovery or network latency. Test a real dropped connection and
   background-tab return. Do not claim immediate outage detection from the
   successful reconnect smoke; investigate heartbeat/transport notification if
   a real outage leaves gameplay apparently live for a similar interval.
2. **Sparse or uneven solo encounters.** Solo TDM starts with four operators,
   including bots; bots can take almost the same route (two sampled within 0.2 m
   early in the public preview round). Unrelated preview clients later replaced
   bots, and sampled scoring stayed at 8–16 until the next round. The menu now
   describes the four-operator solo start accurately. Review bot separation,
   route variety and inactive-seat behavior before tuning difficulty or filling
   twelve seats. Do not infer bot capacity from the shared preview run.
3. **Art continuity and first-person sleeves.** Session 11 replaces Crossyard's dark
   blockout presentation with Switchyard's industrial kit, baked lighting and
   generated substation machinery. Layout/FFA balance remain to be reviewed.
   Sniper reload captures show long,
   angular forearms across the lower screen. Review them in motion and at normal
   FOV before changing the authored grip or purchased derivative. Remote palm,
   finger and moving reload approval from the guide remains open.
4. **Training has no guided progression.** Undertow and Switchyard intentionally
   have no targets; menu and onboarding now say so and direct shooting practice
   to Relay. There is no completed-step checklist, route tour or target reset
   button. Relay's passive pose names are animation labels rather than lessons.
5. **Precise round-transition countdowns.** Warmup now says it starts automatically;
   results allow twenty seconds and R has a one-second grace against accidental
   reload-to-rematch votes. Neither screen displays a replicated transition
   deadline. A future countdown must use server time, including reconnect and
   late join, rather than a client timer pretending to be authoritative.

Audio mute/recovery is exercised mechanically; headphone mix, stereo comfort,
occlusion expectations, real mouse feel and the existing iGPU/6v6/browser gates
still require the owner and representative devices. No listening approval is
implied by a silent headless run. No new owner decision is required before the pause.

## Vision and pillars

A compact, confident science-fiction FPS about taking control of abandoned relay
infrastructure. Six against six, instant practice, five-minute encounters, clear
gunplay. Working subtitle: **RELAY**. The game remains a Tikron consumer, using
WebSocket rooms, authoritative movement validation and server-verified hits.

1. Read the fight: silhouettes, exits and cover heights are legible at a glance.
2. Own a place: spaces have a purpose, address and landmark, not scattered props.
3. Feel the weapon: authored grips, responsive audio and restrained camera motion.
4. Get into play: one prominent deployment action, useful practice, quick rematches.
5. Ship honestly: visible progress with repeatable captures and green server rules.

AAA-inspired means coherent composition, disciplined materials, deliberate encounter
design, animation continuity and immediate feedback. It does not mean photorealism,
huge downloads, cinematic blur during aiming or claims of competitive UDP latency.

## Art direction

Industrial near-future: ivory concrete, graphite machinery, oxidized steel, safety
amber (#edaa52), desaturated teal (#64c7cc). Sunlit haze and cool recesses. Warm key
light, cool sky fill, strong contact grounding. Large stencilled sector names and
painted circulation markings. Reference principles: the industrial legibility of
Titanfall, architectural massing of Control, clean objective hierarchy of Battlefield;
no copied layouts, logos or assets. Original name and signage within Ironsight.

Architecture has three scales: skyline relay infrastructure, room-sized machinery
blocks, and human-scale panels/doors/vents. All opaque playable cover comes from
the shared collision map. Decoration stays within those volumes or outside bounds;
floor decals never create invisible walls. Avoid uncollidable pipes across routes.

## Level design

All maps retain the current 60 x 40 m wire extent in this series. `arena1` becomes
Relay; `arena2` becomes Undertow in milestone 2. Session 11 presents arena3 as
Switchyard, retaining Crossyard's collision layout for practice/FFA. Shared MapDef drives
server, bots, physics, client geometry and minimap. Existing dressing bundles are
never applied to a changed collision layout.

### Relay / arena1 — communications transfer yard (M1)

Three interwoven lanes, mirrored east/west geometry, sheltered deployment pockets,
two raised side-lane decks and a central split around a relay machinery block.
First contact target: 3–5 s sprint; typical fights 10–25 m; one deliberately exposed
long route per flank, interrupted by offset cover. Central machinery blocks direct
spawn-to-spawn shooting. Crossovers must offer retreat without circling the whole map.

```
N / COOLING
+----------------------------------------------------------+
|    spawn  screen   cover    cooling deck   cover  screen  |
| R  ->    |       ->   /=====  A  =====\   <-       |  <- B |
|          |    service block         service block |       |
|    spawn    crossover    relay core    crossover   spawn  |
| R  ->      low cover    [ CORE ]    low cover        <- B |
|             crosswalk     B     crosswalk                |
|    spawn    crossover                crossover     spawn |
|          |    service block         service block |       |
| R  ->    |       ->   \=====  C  =====/   <-       |  <- B |
|    spawn  screen   cover     FREIGHT      cover  screen   |
+----------------------------------------------------------+
S / FREIGHT             west team / east team
```

| Route | Job | Cover / risk | Readable landmark |
|---|---|---|---|
| Cooling (north) | longer rifle duels, raised angle | deck exposes legs on ascent; cover before entry | cyan cooling fins / 01 |
| Relay (middle) | shortest contest, close rifle/SMG | split core interrupts the main axis | ivory core / amber RELAY sign |
| Freight (south) | flank and recovery route | lower crates, offset angle to center | amber freight panels / 03 |
| Deployment pockets | choose two exits before exposure | solid screen breaks enemy spawn LOS | team-coded service facades |

Spawns: four per team, mirrored, outside solids, two possible exits. Preserve server
spawn protection and add cover-aware enemy-distance selection. Add hard regression coverage for
spawn LOS and walkability; do not make the visual layer responsible for protection.
Practice showcase positions must remain on open ground. Cap anchors are also bot
patrol destinations; all must remain connected on foot. This milestone uses TDM
for live Relay, keeping existing DOM capture rules on arena2.

### Undertow / arena2 — water reclamation plant (M2)

Objective layout: home A / contested B / home C, diagonal crossovers, two opposing
control buildings. Palette shifts to wet blue concrete and pale green turbine housings.
No actual water simulation: shallow inaccessible basin, geometry/material illusion.

```
+----------------------------------------------------------+
| WEST SERVICE      upper pipe route       EAST SERVICE     |
| R R -> [A] -- cover --\       /-- cover -- [C] <- B B     |
| [control]            [ B ]              [control]         |
|       \-- pump route --| |-- pump route --/               |
| R R -> cover -- lower maintenance flank -- cover <- B B   |
+----------------------------------------------------------+
```

Home objective target 1–2 s walk; center 4–6 s walk from nearest spawn. B has four
approaches but only two long visibility axes. Raised control ledges at 1.2 m use
true ramps; every raised position has two ways off. Max uninterrupted central
sightline target 28 m. Spawns behind control buildings with no view across enemy
spawns; least-threat selection remains authoritative. Symmetric sorted cap arrival
times within 0.75 s, all objectives reachable, no overlapping capture radii.

## Asset pipeline and licensing

| Asset | Source / treatment | Target |
|---|---|---|
| Relay / Undertow structural kit | original procedural geometry from shared colliders; Blender Cycles AO, exact winding/normal audit | lazy original GLBs: 1.01 / 1.55 MB; 1024px R8 AO |
| Ground AO (Blender 4.5) | collision-only Cycles bake; Standard view transform, existing supervisor pipeline | 1024x683 per map; versioned original PNGs |
| Environment (Blender 4.5) | original linear radiance gradient + warm halo, one PMREM during preparation | shared 41,273-byte HDR; 1.5 MiB PMREM; no extra lights/passes |
| Material detail | tiling concrete/steel normal and roughness maps deferred | preserve ~1.08 MiB stress texture headroom; re-budget first |
| Hero props / skyline accents | purchased Synty sci-fi city, bake only after composition review | <= 6 MB per map |
| Operator | existing Synty derived player, improve rig/weapon holds | <= 3 MB incl. clips |
| Rifle / other weapons | existing Synty weapon bundle, recalibrate grip/muzzle | <= 2 MB shared |
| Weapon locomotion | available UAL locomotion + original authored rifle upper body (see inventory below) | in-place clips, no root motion |
| Audio | existing synthesis first; local CC0 Kenney selectively layered later | <= 2 MB |
| UI / signs | original HTML/CSS and generated canvas atlas | <= 1 MB |

Raw purchased sources NEVER enter this app. All derived purchased GLBs stay ignored,
with provenance and rebuild instructions under public/assets/README.md. Keep all
GLBs ignored by default, explicitly allowlist only documented CC0/original assets
if needed later. No new npm dependencies for M1; Three.js and built-in Node CDP
are sufficient. Any later dependency requires OSS license and rationale here.

Asset set target <= 40 MB total, <= 25 MiB every individual asset, lazy per map.
Current four GLBs total 2,986,272 bytes; obsolete Relay dressing is retained locally
for rollback but is not requested on the new map. Avoid re-embedding Synty's atlas
in every individual prop. Bundle/instance by material and map.

UAL inventory verified in session 1: the local Standard GLB has 43 clips, including
six pistol poses and **no rifle clips**. The existing operator has nine locomotion/
reaction clips. Default M2 pipeline: retain/retarget the available lower-body
locomotion and author rifle upper-body poses on the existing skeleton. Do not label
pistol clips as rifle clips or block on buying another pack.
Normalize armature object transforms, use child-head directions, preserve bind pose,
retarget body/arms then fingers deliberately. Bake idle/walk/strafe/run/crouch rifle
holds to the existing operator skeleton. Preserve attachment-only fallback until
front/side/back/hand-closeup captures prove grip and wrist roll. Do not treat IK
reach toward a guessed grip point as an authored animation. No git history restore
in this session (git commands forbidden); reuse local pipelines if available.

## Technical design and budgets

Keep Room preset, codec, lag compensation, hybrid claim plausibility gate, bot logic
and validated movement. No packages/** changes. Static map changes rebuild server
and client together. If persisted player coordinates become invalid after layout
changes, reset safely via game-level snapshot migration before preview rollout.

Renderer: Three.js forward pipeline, ACES, restrained warm sunlight/cool fill,
material-batched original baked structural kit, one static shadow atlas, per-map
AO and shared daylight PMREM; no bloom/SSAO postprocessing.
Floor markings and signage use one small atlas. No transparent full-screen layers
in gameplay. Balanced preset at device pixel ratio <= 1, 1080p; later optional
quality toggles can raise shadows/resolution. Balanced currently uses a 1024 shadow
atlas cached after environment load; operators use lightweight contact shadows so
moving actors cannot leave stale silhouettes. Menu uses a real map vista.

| Budget (1080p balanced, 12 players) | Target / acceptance |
|---|---|
| frame time on a mid laptop iGPU | <= 16.7 ms median, >= 60 fps; hardware validation required |
| draw calls, including shadow work | <= 180 typical view, <= 240 stress |
| submitted triangles | <= 350k typical, <= 500k stress |
| map structural calls | <= 45 |
| resident textures | <= 32 textures, estimated <= 64 MiB |
| texture sizes | shared atlas <= 2048; map signs <= 1024; shadow <= 2048 |
| downloaded game assets | <= 40 MB whole product, per-map loading |

Inspector will report calls/triangles/textures/programs, frame interval samples,
viewport and GPU identity. Software-rendered Edge screenshots prove boot/rendering,
NOT the 60 fps iGPU floor. Record hardware measurements separately and keep that
acceptance pending if this machine cannot provide representative GPU evidence.

Animation: retain the state machine with authored five-weapon hold families,
calibrated additive wrist aim and server-deadline remote reload presentation. First-person reload should
have magazine/bolt phases matched to server duration, with firing muzzle derived
from the visible barrel. Audio: directional stereo fire/blasts/steps, transient voice limits,
master volume; no autoplay before gesture. UI: cinematic deployment screen,
prominent play action, bilingual labels, small objective/score strip, bottom ammo
and health, map callout, clear pause/reconnect/death states, reduced clutter.

## Milestones and acceptance

- **M1 — Relay playable foundation (session 1, complete):** plan, new shared map, structural
  art kit and lighting, deployment screen, map/perf inspector, geometry safety tests.
  All existing server rule coverage retained. Inspect at least overview + two eye
  level angles + menu; headless network gameplay boots without console errors.
- **M2 — authored operator and combat feel:** authored rifle grip proof using available UAL locomotion, viewmodel hand
  setup/reload, muzzle alignment, audio mix, playtest firing/reload/respawn; retain
  verified hit rules. Undertow shared collision blockout + walk/LOS gates.
  **Session 2: AR hold/first-person/reload proof and Undertow blockout delivered.**
  **Session 3: AR finger wrap, calibrated full-range aim, directional steps and
  open ADS sight delivered and inspected.** Other-weapon hand fits and human
  animation/controller acceptance remain open; these are not claimed complete.
- **M3 — complete two-map art pass:** Undertow industrial kit, Relay hero prop and
  baked grounding, map callouts/minimap, map selection presentation. Measure both.
  **Session 3: two-map procedural art pass delivered**, including original hero
  detail, opaque baked grounding, named routes, training-site cards and map vistas.
  Further composition refinement remains possible during M4 playtests.
- **M4 — match experience:** redesigned HUD, end round, rematch and onboarding;
  reconnect and snapshot migration review; human controller/mouse playtest.
- **M5 — performance and release candidate:** representative iGPU 1080p 12-player
  test, effects stress, asset audit, browser matrix, accessibility settings. Preview
  deploy by supervisor only; owner approves live. No live release claims before this.
  **Session 5: local effects/resource gates, Blink matrix, settings accessibility and
  first-person alternate grips delivered. Laptop/real-match/cold-start and remaining
  animation acceptance stay pending; see owner guide and session 5 evidence.**

Every session: `pnpm --filter ironsight typecheck`, `test`, `build:client`, `build`;
headless boot zero console errors, inspect saved screenshots, close owned processes.
No git commands, no deploy commands beyond the required build's existing dry-run.
Only apps/ironsight/** edits; temporary artifacts under .inspect or OS temp.

## SDK requests

None blocking M1. Hardware perf tooling, map art, snapshot handling and animation
are game responsibilities. Do not request UDP or change SDK transport for this plan.

## Questions for the owner (defaults are active)

Session 3: no new blocking questions; the three defaults below remain active.

1. Visual tone: industrial daylight or neon night? **Default: industrial daylight.**
2. Primary match: 6v6 respawn or elimination? **Default: 6v6 TDM; DOM secondary.**
3. Character tone: military realism or stylized sci-fi? **Default: stylized sci-fi,
   coherent with purchased Synty art and a browser performance budget.**

## Session log

## AAA gap list

Re-ranked after Session 11. The Session 10 ended/empty-room fix was already
present and passed its existing real-restoration regression tests. This session
selected the next visual priority: Crossyard -> Switchyard, now a complete first
art pass with unchanged collision layout. Continue with the first item below.

1. **Environment richness and material detail.** All three sites now share the
   industrial direction, but long clean facades and broad empty floor areas still
   read simply. Add purposeful human-scale service detail, wear and composition;
   prioritize Relay, with its tighter texture budget. Meshy can supply a stronger
   hero silhouette where useful; the supervisor's cable drum remains rejected.
2. **Weapon/operator finish.** Review sleeves, moving five-weapon reload/grip contact,
   remote reactions and deaths; retain constant light count through hidden groups.
3. **Solo encounter quality.** Improve bot route variety/separation and examine
   inactive seats before increasing fill or difficulty.
4. **Switchyard encounter design.** Its art replaces the legacy blockout, but the
   original open FFA layout still needs owner route/spawn review. Preserve server
   cover and navigation authority; any future layout change needs migration/tests.
5. **First-play guidance and transitions.** Guided training, authoritative countdowns,
   and real dropped-network detection; preserve accessible menus and reconnect flow.
6. **Hardware/audio acceptance.** Mid-laptop iGPU, real 6v6/RTT, Firefox/Safari,
   thermal/cold-driver checks and headphone/owner approval remain unverified.
7. **Deployed lifecycle qualification.** Local ended-snapshot tests and repeat probes
   cover recovery; supervisor should still exercise actual preview DO eviction.

### Session 1 — 2026-09-07

Read root brief, game entry/renderer/maps/tests, asset provenance, rig capture tool,
asset index and Synty/UAL retarget lessons. Keeping combat and validation; replacing
arena1 layout and presentation first. No additional dependencies added.

Delivered:
- Relay shared 60 x 40 m layout: 21 cover/building volumes, four ramps, mirrored
  deployment screens, three distinct lanes and clear practice staging.
- Instanced architecture, directional signage, painted crosswalks, lighting,
  original relay mast and an eight-placement Synty industrial skyline. A Blender
  bake normalizes source transforms, deduplicates the atlas and exports a single
  ignored 1,167,268-byte GLB. Source hashes/envelopes accompany the local bake;
  provenance and reproducible command are in public/assets/README.md.
- Cinematic deployment menu with actual map vista, responsive mode selection,
  quieter HUD, ammo/health hierarchy and an allies-only tactical map/callout.
- Authoritative cover-aware spawn selection and cached ground navigation fields
  for Relay filler bots. Bots route around new buildings instead of pushing into
  them. Human collision, hybrid hit validation and existing mode rules retained.
- Snapshot version 2 intentionally discards old match state/seats on deployment
  through the existing migration behavior; incompatible old positions are not
  restored inside new solids. Navigator derives from the map on construction.
- Offline map/performance inspector; browser smoke tool exercises the actual
  menu, pointer lock, movement, firing and reload through the Worker. Map/menu
  inspection explicitly asserts no matchmaking or room sockets.

Validation: typecheck PASS; test PASS **260 passed + 3 existing opt-in skips**
(20 passed files + 1 skipped). All 246 original passing tests retained or
adapted to open corridors; added 14 spawn/layout/navigation tests, including a
seeded 60-second authoritative bot match. Client build PASS; Worker build/dry-run
PASS (230.55 KiB, gzip 68.44 KiB). No real deployment or git operation performed.

Measured at 1920 x 1080, balanced, RTX 5070 / Edge Direct3D11:

| View | Steady calls / triangles | Peak calls including shadow bake | Texture estimate |
|---|---|---|---|
| Relay overview | 24 / 20,686 | 42 | 16.35 MiB |
| Relay eye level | 21 / 20,668 | 39 | 16.35 MiB |
| Eleven remote operators | 55 / 70,920 | 84 | 59.08 MiB |

Stress rAF interval median 6.9 ms / p95 7.1 ms over 120 frames. These are frame
intervals on this desktop GPU, not GPU timing or proof of the laptop iGPU floor.
Texture accounting includes material, bone and shadow/renderbuffer storage estimates,
not driver overhead. Representative laptop hardware acceptance remains open for M5.
Asset audit: 4,279,652 asset bytes, 9,894,552 total public bytes including client
bundle/source map; largest file 3,911,972 bytes. All five purchased derivatives
ignored; no raw source files included. Old Relay dressing is never loaded by Relay.

Visual review opened overview, multiple ground lanes, skyline, menu, live practice,
and operator rig captures under .inspect. Rejected an initial skyline bake with
incorrect source atlas presentation, replaced it with verified Power/Warehouse
sources, fixed coplanar facade flicker, and reduced the shadow atlas to meet the
64 MiB texture budget. Final screenshots and browser report use session1-accepted-*
(local .inspect directory, intentionally not versioned). Rig capture:
session1-rig-w0-arms1-front.png. Control-only report: session1-controls-report.json
(2.4 m authoritative movement, one verified kill, magazine 26 -> 30 after reload,
zero browser errors). One combined capture overlapped builds and failed its kill
assertion; isolated control rerun passed. Run build and browser combat checks serially.
The final serial sweep also passed all 16 requested views/flows: all four modes,
three practice map variants, desktop/narrow menu, seven map/perf views, and the
menu-to-combat control path (2.1 m movement, one verified kill, 26 -> 30 reload).
Zero console/runtime/HTTP errors; zero forbidden offline network requests.
Final ground-lane, narrow-menu and control screenshots were opened and reviewed.
Owned preview Wrangler/workerd and inspection Edge processes were stopped; cleanup
was verified by process inspection. Other users' processes were left alone.

Remaining quality gaps: operator rifle hold/first-person hands and reload still
use the old presentation; the current rig inspection makes that visible. Undertow
and Crossyard retain legacy layouts/art. This is the playable architectural
foundation, not the finished visual/animation release. Existing rooms cap at 12;
current bot fill is four total combatants, not an automatic 12-player stress match.

Next session: M2 authored rifle hold and first-person weapon/hand alignment proof,
then reload/feedback and Undertow shared blockout. Keep the control smoke and all
server gates green; do not trade verified hit registration for visual plausibility.

### Session 2 — 2026-09-07

Continued M2 in apps/ironsight only. No git commands, real deployments or new
dependencies. Purchased source remained outside the repository; generated player
GLB and every purchased derivative remain ignored. Supervisor owns preview release.

Delivered:
- Original authoring tool appends six baked rifle upper-body clips over the nine
  intact original locomotion/reaction clips. AR selects the authored actions;
  other weapons and missing-clip assets retain the original fallback. Authored
  wrist/finger rotations and additive arm pitch replace guessed default IK.
  Crouch feet anchor visually to the authoritative floor after animation.
- Original procedural first-person gloves/forearms, adjusted AR scale and muzzle
  alignment, server-acknowledged reload presentation, intact removable drum and
  charging handle, and short synthesized magazine/bolt cues. Complete welded
  components are copied at runtime; cached purchased geometry stays immutable.
  Reload cancels on death; dead players hide the viewmodel and leave ADS.
- Undertow shared mirrored blockout: 22 solid volumes, four traversable ramps,
  eight spawn positions, two exits per deployment and three capture areas. Both
  server navigation and rendering use the same map. Procedural daylight blockout
  and callouts replace legacy dressing; full industrial art is M3 work.
- Standing sightline sweep through B (720 directions) has a longest chord of
  17.03 m, below the 28 m target. Symmetric home/center/opposing capture ETAs are
  2.67/5.33/8.33 s. Added diagonal baffles after an initial sweep found a long lane.
  Fixed a low ramp-to-floor seam in shared movement without changing high ledge
  exits or jumping. Snapshot version 3 intentionally resets incompatible matches.
- Offline first-person/reload inspector, rig pose/close-up controls, and stronger
  live control smoke covering reload phases, blocked firing, death and respawn.
  RTT fixture now disables filler bots and seeds spread; all hit assertions remain.

Final serial gates: typecheck PASS; test PASS **278 passed + 3 existing skips**
(23 passed files + 1 skipped; 18 more passing tests than session 1); build:client
PASS; build PASS (Worker dry-run 231.77 KiB, gzip 69.01 KiB). Server hit verification
and combat rules remain authoritative. Asset audit PASS: 4,558,998 asset bytes,
10,238,904 public bytes, largest file 3,952,174 bytes. Private rig audit verifies
8,988 unit quaternion samples and unchanged original mesh/skin/image/lower-body data.
Reproducible commands and source hash are in public/assets/README.md.

Headless acceptance: 21 views/flows, zero console/runtime/HTTP errors and zero
forbidden offline network requests. Live input moved 2.7 m, scored one verified
kill, reloaded 26 -> 30 through all phases, blocked firing during reload and saw
the target respawn. Self-grenade death during reload recovered to 100 HP with
reload idle. A final center-camera-only rerun also passed after visual review
found the old inspector viewpoint inside a newly added baffle.

Measured at 1920 x 1080 balanced, Edge/RTX 5070 (desktop, not iGPU acceptance):

| View | Steady calls / triangles | Peak calls | Texture estimate |
|---|---|---|---|
| Relay overview | 24 / 20,686 | 42 | 16.35 MiB |
| Eleven remote operators | 55 / 70,920 | 84 | 59.08 MiB |
| Undertow overview | 15 / 1,360 | 25 | 10.69 MiB |
| Undertow center | 12 / 1,348 | 22 | 10.69 MiB |

Stress frame intervals: median 6.9 ms / p95 7.1 ms over 120 samples. First-person
AR view is 31 calls / 23,002 triangles. M5 still requires actual mid-laptop iGPU
and 12-player effects stress; no 60 fps hardware acceptance claim is made here.

Opened and reviewed final screenshots in .inspect:
- session2-accepted-rig-w0-arms1-{front,hands,hands-right}.png
- session2-accepted-{crouch,walk,run}-w0-arms1-right.png
- session2-accepted-{weapon,weapon-ads,reload-out,self-death}.png
- session2-accepted-undertow-overview.png; session2-final-undertow-center.png

Reports: session2-accepted-report.json, session2-final-report.json and corresponding
rig reports. Rejected sliced-magazine geometry, several wrist/finger iterations,
floating crouch and the blocked inspector camera before these final captures.
Remaining: grip fingers are still bulky; directional strafe clips, full aim-range
contact, other weapon hands, ADS sight framing and refined reload timing are not
final animation acceptance. Undertow remains a deliberately simple blockout.

Next session: finish M2 animation acceptance (grip/ADS contact, directional strafes
and aim extremes), then start M3 Undertow industrial art and Relay hero grounding.
Keep the same three owner defaults. SDK requests: none.

Cleanup verified: owned preview pnpm/Wrangler, both workerd children and esbuild
services stopped; no inspection Edge processes or port 8796 listener remain.


### Session 3 — 2026-09-07

Continued in apps/ironsight only, with industrial daylight / 6v6 TDM / stylized
sci-fi defaults. No git commands, real deployments, dependencies or SDK changes.
The build uses its existing Worker dry-run. Supervisor retains deployment ownership.

Delivered:
- M2 AR polish: revised finger curls/opposing support thumb, a stable authored
  clavicle frame and a measured rear fore-end contact across all six base holds.
  Five additional directional variants supply left/right standing and crouched
  steps plus backpedal; planted lateral foot targets cannot cross the centreline.
  The source Standard pack contains neither rifle nor strafe clips; these are
  original authoring over the inherited pelvis cadence, not relabelled UAL clips.
- Runtime aim uses the baked wrist frame, a short shoulder arc and calibrated
  two-bone reach. It preserves wrist roll/contact through ±89° without rotating
  the head/hit volumes, and restores owned bones before the next mixer update.
  This solver is separate from baked authorship, not guessed-grip IK presented
  as animation. Neutral aim preserves the authored elbow plane without a snap.
- Original open AR reflex sight, seated on a riser above the receiver. The camera
  aims through the aperture; the dot is visible only in settled ADS, so it cannot
  float beside the rifle during reload. Existing muzzle, reload/audio and server
  shot verification remain intact. Other-weapon hand fits remain open.
- M3 Undertow art: pale turbine housings, control facades, service bays, clarifier
  tanks, pipework and a control-stack landmark. All playable solids still use
  the M2 shared map; decorative machinery faces are thin cladding. Basin and
  skyline remain outside bounds. No collision/layout/snapshot change this session.
- Relay core cassette cladding, dish feed braces, actuator and service cabinets.
  Both maps receive original opaque 512px floor atlases with footprint-based
  contact grime. No extra AO/bloom pass or transparent ground layer.
- Undertow deck/pipe/maintenance callouts and signs; HUD route names share one
  presentation module. Deployment switches actual map vistas and site plans;
  training has keyboard-accessible map cards, with legacy Crossyard clearly marked.
  Selecting Undertow through the menu persists arena2 into the real deployment.
- Inspectors now sweep poses, aim and sample times and report bone positions in
  the gun frame. Map inspection covers Undertow maintenance, vista and 11-actor
  stress. Browser assertion failures now preserve screenshots and diagnostics.

Validation: typecheck PASS; **283 passed + 3 existing opt-in skips** (24 passed
files + 1 skipped); build:client PASS; Worker build/dry-run PASS **231.77 KiB,
gzip 69.01 KiB**. Five new regression tests cover aim ownership/restoration,
full-range contact, neutral continuity and missing directional-clip fallback.
Private rig audit PASS: **19,768 unit quaternion samples**, nine unchanged original
clips, unchanged mesh/skin/image/source bytes, preserved lower-body tracks in the
six base holds. Ignored player GLB is **1,705,400 bytes**. Provenance/rebuild and
new original assets are documented in public/assets/README.md.

Final rig proof: 18 pose/aim views (idle/walk/run/sprint/crouch/crouch-walk at
−89/0/+89°), plus 10 directional views at two sample times. At the sampled base
poses the support frame varies by <1 mm across locomotion; per-pose aim drift is
<0.008 mm. These are transform/contact measurements, not finger-mesh penetration
or full animation/human-playtest acceptance. Original low-poly finger shapes
remain stylized. Alternate weapon fits and human animation acceptance remain open.

Rejected during inspection: crossed legs from rotating the forward gait, whole-arm
pitch putting the gun through the torso, unarmed clavicle swing pulling the support
hand off the running rifle, a floating reload reticle, coplanar skyline roof trim,
a stripe crossing Pump Hall signage and a mirrored ground-contact atlas. Corrected
and recaptured. A combined smoke timed out at the self-grenade death assertion;
that run was rejected and the unchanged assertion was rerun in isolation.

1920×1080 balanced, Edge / RTX 5070 desktop (not laptop iGPU acceptance):

| View | Calls / triangles | Peak including static shadows | Estimated textures |
|---|---|---|---|
| Relay overview | 26 / 21,480 | 45 | 17.35 MiB |
| Relay eye level | 23 / 21,462 | 42 | 17.35 MiB |
| Undertow overview | 31 / 15,908 | 46 | 14.69 MiB |
| Undertow centre | 24 / 15,888 | 39 | 14.69 MiB |
| Relay, eleven remote operators | 57 / 71,714 | 87 | 60.08 MiB |
| Undertow, eleven remote operators | 60 / 66,208 | 86 | 57.42 MiB |

Stress frame intervals: median 6.9 ms, p95 7.1 ms over 120 samples per map.
Actual mid-laptop iGPU, effects stress and browser/controller acceptance remain M5.

Opened final rig captures in .inspect (among the iteration reviews):
- session3-final-aim-idle-aim0-t0.75-w0-arms1-hands.png
- session3-final-aim-run-aim-89-t0.75-w0-arms1-hands.png
- session3-final-aim-crouch-aim89-t0.75-w0-arms1-hands.png
- session3-final-steps-strafe_left-aim0-t0.35-w0-arms1-front.png
- session3-final-steps-strafe_right-aim0-t1-w0-arms1-front.png
- session3-final-steps-crouch_right-aim0-t0.35-w0-arms1-front.png
Also opened session3-landmarks-vista.png, session3-presentation-menu-undertow.png,
session3-presentation-menu-training.png, session3-presentation-menu-training-mobile.png,
and session3-accepted-{relay,undertow-center,undertow-maintenance,reload-out}.png.
Reports: session3-final-aim-report.json, session3-final-steps-report.json,
session3-presentation-report.json and the final browser reports below.

Final browser acceptance: session3-final-report.json has 22 views/flows;
session3-self-final-report.json passes the unchanged self-death assertion (one
death, respawn at 100 HP, reload idle). Together with the 18 aim and 10 directional
views, all 51 final views/flows have zero console errors and zero forbidden network
requests. Combat flow: 2.7 m movement, one server-verified kill, magazine 26 to 30,
all six reload phases, fire blocked during reload and target respawn confirmed.
The earlier combined self-death timeout remains recorded above, not counted green.
Final asset audit PASS: 4,969,575 asset bytes, 10,704,607 public bytes, largest file
3,987,904 bytes. Purchased derivatives remain ignored; no source assets added.

Also opened the final captures: session3-final-weapon-ads.png,
session3-final-reload-out.png, session3-final-flow.png,
session3-final-flow-undertow.png, session3-final-undertow-overview.png,
session3-final-menu-training-mobile.png and session3-self-final-self-death.png.
Cleanup: stopped all eight verified descendants/root of this session's preview;
none remain. Inspectors exited and closed their browsers. Evidence is in
.inspect/session3-cleanup.json. No git commands or deployments were performed.

Next session: M4 match experience — HUD/objective hierarchy, end-round/rematch and
onboarding; review reconnect/snapshot flows. Carry forward alternate weapon hand
fits and human controller/animation review, plus any playtest-driven art refinement.
M2 AR requested polish and M3 first art pass are delivered; do not claim full
animation or hardware release acceptance. Owner questions: no new blockers; retain
industrial daylight, 6v6 TDM (DOM secondary), stylized sci-fi. SDK requests: none.

### Session 4 — 2026-09-07

Continued M4 under the same defaults, in apps/ironsight only. No git commands,
commits, deployments, SDK changes, dependencies, or purchased-asset edits.
The required Worker build ran only its existing dry-run. Supervisor retains
preview deployment ownership; live release still needs owner acceptance.

Delivered:
- Mode-specific objective briefing, server-clock round time with a final-30-second
  accent, explicit team affiliation and honest warmup/training labels. DOM gauges
  now sit below the objective and name ownership (RED / BLUE / OPEN / TAKING).
  FFA standings move below the tactical map instead of colliding with the clock.
  Narrow-screen rules separate these panels. No additional render passes or assets.
- End-round panel with team result, personal eliminations/deaths, clickable rematch
  vote and deployment actions, bilingual action labels, visible submitted state
  and server quorum. R remains a shortcut; typing into controls does not vote.
  Pointer lock releases on round end without opening the pause dialog. Overlay
  markup is cached so per-frame rendering no longer destroys focused buttons.
- Click-to-play onboarding explains the mode, cover, aim/fire, automatic respawn
  and Escape/settings; movement/reload hints continue to use actual keybindings.
- Read-only, seated-client `syncView` intent returns authoritative owner ammo,
  remaining reload duration, retained server round result and vote quorum. It
  never accepts client ammo/results. Initial subscription, respawn, new round
  and Welcome after reconnect request it. Initial state is ingested immediately.
  A late subscriber can recover an ended result without the original broadcast.
- Connection overlay with deployment exit; gameplay sends stop on disconnect and
  resume only after room Welcome. Reconnect clears remote interpolation history.
  Server onLeave clears held movement and retains the preset's 30-second seat.
  Existing authoritative movement, shot plausibility and hit verification remain.
- Snapshot review found that runtime ammo/respawn/protection/intermission maps do
  not persist alongside state. `onRestore` now deliberately starts a NEW round:
  safe human spawns, full loadouts, zero scores, removed stale bot records, rebuilt
  timers/PRNG, and warmup for competitive modes (practice remains live). Short
  transport reconnects keep the existing round. State shape/layout stays version 3;
  existing incompatible-version discard behavior remains. This is recovery by
  round reset, not durable continuation of a half-finished fight.
- Offline match UI fixtures and real WebSocket-interruption browser inspection.
  Alternate-weapon inspector accepts `weapon=1..4`; saved SMG/shotgun/sniper/pistol
  baselines explicitly show hands=false. No unproven hand poses were enabled.

Final gates: typecheck PASS; test PASS **290 passed + 3 existing opt-in skips**
(25 passed files + 1 skipped); build:client PASS; build/dry-run PASS **233.53 KiB,
gzip 69.43 KiB**. Seven additional tests cover briefing clock/modes, disconnect
movement/seat preservation, owner-only ammo/reload resync, late round-result
subscription and cold-restore reset. The restore test exercises the game hook;
a real deployed Durable Object eviction drill remains pending. The disconnect
test initially awaited close before reconnecting, deadlocking its own fake-timer
reconnection window; corrected to reconnect before awaiting close, then passed.

Browser evidence:
- `.inspect/session4-final-report.json`: 15 views/flows, zero console/runtime/HTTP
  errors and zero forbidden offline network requests. Includes UI result/draw/vote
  fixtures, narrow results, real same-seat WebSocket reconnect, all competitive
  modes, both menu-to-practice routes, AR ADS, Undertow and 11-operator stress.
- Combat flow: 2.4 m authoritative movement, one server-verified kill, magazine
  26 -> 30, all six reload phases, no ammo consumed during reload, target respawn.
- `.inspect/session4-death-report.json`: onboarding and self-grenade death during
  reload; respawn at 100 HP with reload idle, zero errors. The unlocked onboarding
  capture is `session4-death-onboarding-briefing.png`.
- `.inspect/session4-recovery-report.json`: real same-seat reconnect and four
  alternate-weapon baselines, plus result/onboarding views; zero errors. End/vote
  browser captures are offline presentation fixtures; authoritative result and
  quorum delivery are covered by server tests, not a full human match playtest.

Visual review opened final DOM/FFA HUD, vote feedback, narrow result screen,
reconnect-disconnected, onboarding and death captures, plus the alternate pistol
baseline. Rejected damaged Korean labels from the initial edit, corrected their
encoding and recaptured. No map-art changes were justified by this UI playtest.

1920 x 1080 balanced, Edge / RTX 5070 desktop: Relay eleven-remote-operator view
remains **57 calls / 71,714 triangles**, peak **87 calls**, estimated **60.08 MiB**
textures. Undertow centre remains **24 calls / 15,888 triangles**, peak **39**,
estimated **14.69 MiB**. Both sampled 120 frame intervals at median **6.9 ms** /
p95 **7.1 ms**. These desktop measurements do not establish the laptop iGPU floor.
Asset audit PASS: **4,969,575 asset bytes**, **10,729,478 public bytes**, largest
file **4,003,850 bytes**. Purchased GLBs and ignore rules were not changed.

Cleanup verified in `.inspect/session4-cleanup.json`: all **11** owned preview
root/descendant processes stopped, no port 8796 listener, no inspection Edge
processes. Reports and screenshots remain under the ignored .inspect directory.

Next session: finish alternate-weapon first/third-person hand fits with explicit
hip/ADS/reload and aim-range proof; human mouse/controller match and rematch review.
M4 core presentation/recovery pass is delivered, but human acceptance is open.
Then M5 representative laptop iGPU 1080p/12-player effects stress, browser matrix,
accessibility, and a deployed cold-eviction drill through the supervisor. Full
scoreboard/team roster polish and staged onboarding can follow human feedback.
Do not claim finished animation or hardware release acceptance. Defaults unchanged;
no new owner blockers or SDK requests.


### Session 5 - 2026-09-07

M5 local release-candidate work, same owner defaults and apps/ironsight-only scope.
No git commands, deployments, SDK changes, dependencies or purchased-asset writes.
The required Worker build uses its existing dry-run. The owner guide above explicitly
separates the supervisor's sessions 1-4 preview from this unpublished candidate.

Delivered:
- Repeatable 1080p renderer workload: eleven remote operators plus local AR/hands,
  twelve rifles targeting 10 shots/s, pooled flashes/casings/impacts/tracers and
  twelve simultaneous grenade explosions every two seconds, for 15 seconds.
  Three-second cooldown reports zero remaining explosions/tracers. This is an
  intentionally excessive render fixture, not twelve network clients or a room
  capacity benchmark. Production particle directions retain their randomness.
- Initial bursts exceeded the 240-call budget: Relay 401, Undertow 404 calls.
  Replaced eighteen individual debris meshes per grenade with one InstancedMesh;
  kept trajectories, fade and lifetime, and dispose instance buffers on expiry.
  Four fixed reusable blast lights replace changing light counts, avoiding new
  lit-material variants for each simultaneous blast count. All twelve rings and
  debris bursts still render; only the newest four supply point lighting.
- Inspector records actual shot rate, peak resource use, p95/p99/max frame intervals,
  first-ready-frame spikes and effect cleanup. `--assert-budgets` enforces 240 calls,
  500k triangles, 32 textures, estimated 64 MiB and expired transient cleanup.
  It deliberately does not grant laptop acceptance from desktop frame timing.
- Settings: named dialog and controls, initial focus, Tab/Shift-Tab wrapping,
  Escape capture cancellation/close, focus restoration, narrow-panel fit and focus
  outline. Persisted master volume and Reduced motion remove bob/sway/breathing/
  blast shake while retaining aim, recoil and reload cues. Master mute remains M;
  typing/rebinding in controls no longer also toggles mute. Two store tests cover
  persistence/reset, old settings and invalid volume. Keyboard smoke exercises
  both new controls plus sensitivity, focus wrapping and translated labels.
- First-person SMG/shotgun/sniper/pistol now use original gloves with per-weapon
  wrist fits. Pistol supports the firing grip; long guns support the fore-end.
  All four have inspected hip, settled ADS and reload-tilt views; sniper scope
  hides its model as before. Only AR has separated magazine/bolt choreography;
  alternatives keep their support hand attached through a simplified reload tilt.
  Inspector now waits for weapon swaps to finish before measuring ADS (early
  candidate captures exposed ads=0 despite the requested ADS view; rejected).
- Twelve alternate third-person aim captures (-89/0/+89 degrees, four weapons)
  confirm the unchanged attachment fallback is still visibly unarmed. It was not
  relabelled as a finished grip. Authored alternative holds/reloads remain work.

Final serial gates: typecheck PASS; test PASS **292 passed + 3 existing opt-in
skips** (25 passed files, one skipped); build:client PASS; Worker build/dry-run PASS
**233.53 KiB / gzip 69.43 KiB**. A tuple-spread type error during hand authoring was
fixed before these final gates. Server combat/movement/hit validation is unchanged.

Final Edge 152 / RTX 5070 Direct3D11, 1920x1080, balanced / DPR 1:

| 15-second effects fixture | Median / peak calls | Peak triangles | Peak textures / estimated MiB | Sampled median / p95 / p99 ms |
|---|---|---|---|---|
| Relay, 11 remote + local | 160 / 197 | 81,962 | 22 / 60.08 | 6.9 / 7.1 / 7.1 |
| Undertow, 11 remote + local | 163 / 200 | 76,456 | 21 / 57.42 | 6.9 / 7.1 / 7.1 |

`session5-budget-gate-report.json`: 2,108 / 2,128 steady samples; max 7.3 / 7.8 ms,
zero sampled intervals over 16.7 ms. Actual rates 9.60 / 9.67 volleys/s (all twelve
rifles per volley), 96 explosions/map. After cooldown: 68 / 71 calls, zero active
explosions/tracers. Peak counts include the initial static-shadow work. Both
resource gates pass. These are rAF intervals, not GPU timer-query measurements.

**Cold-start qualification is still open.** First thirty ready frames are reported
separately rather than hidden in the steady median: final runs max 347.2 / 83.3 ms;
prior same-build effects runs 305.6 / 215.3 ms. Chrome Undertow map boot max 652.8 ms.
Profile shader/material initialization and uploads, then prewarm during a deliberate
loading phase before release. No representative laptop or sustained thermal/network
6v6 acceptance was performed, and these steady measurements do not erase the spikes.

Browser matrix (all local, headless, Windows):

| Browser | Evidence | Result |
|---|---|---|
| Edge 152.0.4191.62 | session5-edge (9 flows), budget-gate (3), final-visual (16) | Zero console/runtime/HTTP errors; real combat and same-seat reconnect passed. |
| Chrome 151.0.7922.174 | session5-chrome (5 flows) | Zero errors; settings, real combat, Undertow render and pistol ADS passed. |
| Chromium 151.0.7922.34 | session5-chromium (4 flows) | Zero errors; settings, real Undertow deployment and AR ADS passed. |
| Cached Chromium 131.0.6778.33 | session5-chromium-legacy | Settings passed; headless pointer lock FAILED on gameplay click, zero console errors. Not accepted; distinguish old-engine/headless limitation with a real browser test. |
| Firefox / WebKit | Not installed in available browser cache/program paths | Untested; requires other environment/real devices. |

Edge and Chrome combat each moved 2.7 m, scored one server-verified kill, reloaded
26 -> 30 through all six phases, blocked fire during reload and confirmed target
respawn. Chromium's Undertow flow is a real deployment/boot, not a combat assertion.
All offline accepted inspections recorded zero forbidden gameplay-network requests.
The cached Chromium 131 pointer-lock failure is retained; it is not counted green.

Visual review opened final first-person fits/ADS/reload, the unchanged third-person
pistol fallback and narrow settings. Rejected damaged Korean settings labels from
shell encoding, corrected the source, then asserted/reviewed the correct labels in
Chrome and current Chromium. First-person grips are improved; alternate third-person
poses and full animation acceptance are not complete. No raw/derived mesh was edited.

Asset audit PASS: **4,969,991 asset bytes**, **10,755,939 public bytes**, largest file
**4,021,453 bytes**; only 416 provenance-text bytes added to assets, no raw source files, five documented private
GLBs under the unchanged ignore rule. Asset SHA-256 inventory is recorded locally in
`.inspect/session5-asset-hashes.json`. Private rifle audit PASS: 19,768 unit quaternion
samples, nine original and eleven rifle clips, source geometry/original clips and
base lower body preserved. Derived operator still 1,705,400 bytes. Rebuild provenance
is unchanged; runtime gloves/debris remain original code, no purchased export.

Next: profile/prewarm first-use stalls; author and inspect alternate third-person
holds and detailed reloads; arrange representative laptop, real 6v6 and owner visual/
controls acceptance. Controller input is absent in the current client; do not claim
it works from keyboard smoke. Supervisor owns preview publication and deployed
cold-eviction drill; owner owns live approval. No new SDK request or owner default
question. Full M2/M5 and live-release acceptance remain pending, as listed at top.

Final additional boot: `session5-death-report.json` passes self-grenade death during
reload and recovery to 100 HP / idle reload, with zero console/runtime/HTTP errors.
Local Wrangler logged a tick-backlog warning during this session; it is retained in
session5-preview-error.log. This local mixed workload is not deployed capacity
acceptance; no latency/capacity claim is derived from local workerd.

Cleanup verified in `.inspect/session5-cleanup.json`: all 12 owned preview root/
descendant processes stopped, no port 8796 listener and no inspection Chrome/Edge
processes remain. Inspection profiles were removed by their owning scripts. All
session temporary reports/screenshots remain in the ignored .inspect directory.


### Session 6 - 2026-09-07

Owner chose continued autonomous polish; the three defaults remain active.
Supervisor confirmed sessions 1-5 are on preview. This session stays local:
apps/ironsight only, no git commands, commits, deployments, SDK changes or new
dependencies. Required Worker build ran its existing dry-run only.

Delivered:
- Deliberate arena preparation before Input attaches: await map/operator/weapon
  loads, compileAsync on the actual renderer, render hidden pooled effects plus
  temporary operator/weapon/explosion/tracer fixtures to upload buffers/textures,
  then restore visibility/culling and bake the correct static shadows. Retain
  material references so disposing fixtures cannot evict the programs just warmed.
  Warm effects leave no live tracer/explosion or camera shake. Canvas is hidden
  during the pass; the HUD shows preparation. Report construction and preparation
  separately from the first-ready and steady frames. Reuse the production path
  in map/effects inspection. This shifts initialization into loading, not free work.
- Fixed operator disposal to release each cloned skeleton's bone texture. The
  warm fixture and departed players now relinquish their instance GPU texture.
- Four original alternate hold families on the existing operator: SMG, energy
  shotgun, sniper and two-handed pistol. All eleven locomotion variants per weapon
  are ordinary baked quaternion tracks; runtime aim preserves their measured
  wrist frames. Separate mount fits reflect the weapon grip origins. Old exports
  without a requested family retain attachment fallback. Death/respawn and weapon
  transitions select the right family; no changes to authoritative combat/hits.
- Detailed first-person alternate reloads: SMG/sniper complete welded magazines
  and charging handles; side-loading energy-shotgun cell; pistol original insert
  inside the integrated source grip plus moving slide. Support gloves follow
  extraction, insertion and charging. The shared server-acknowledged timeline
  still owns duration/cancellation; cosmetics never award ammo or allow firing.
  Remote reload state/choreography is not implemented in this session.
- Private operator rebuilt with 55 authored + nine original clips, **2,913,320
  bytes** (under the 3 MB target). AR remains 30 Hz; alternatives use 20 Hz with
  quaternion interpolation, constant finger tracks use two shared-time endpoints.
  Audit: **29,880 unit quaternion samples**, original mesh/skin/image/clip payload
  byte-identical and base lower-body samplers preserved. Provenance/rebuild updated
  in public/assets/README.md. The changed private GLB remains covered by the existing
  ignore rule; the supervisor must include it separately in the reviewed preview.

Final serial gates in `.inspect/session6-gates.log`: typecheck PASS; test PASS
**298 passed + 3 existing opt-in skips** (26 passed files + one skipped);
build:client PASS; Worker build/dry-run PASS **233.53 KiB / gzip 69.43 KiB**.
Six new tests cover alternate-family selection/legacy fallback and reload component
ownership/immutable cached geometry. Existing server verification tests remain green.

Final Windows headless browser evidence, 1920x1080 balanced / DPR 1, RTX 5070:

| Effects fixture | Construction / preparation ms | First 30 ready max ms | Steady median / p95 / p99 ms | Peak calls / triangles | Peak textures / estimated MiB |
|---|---|---|---|---|---|
| Edge Relay | 52.0 / 440.6 | 7.1 | 6.9 / 7.0 / 7.1 | 197 / 81,962 | 22 / 60.08 |
| Edge Undertow | 31.3 / 244.4 | 7.0 | 6.9 / 7.0 / 7.1 | 200 / 76,456 | 21 / 57.42 |
| Chrome Relay | 52.2 / 424.2 | 7.1 | 6.9 / 7.0 / 7.1 | 197 / 81,962 | 22 / 60.08 |
| Chrome Undertow | 30.8 / 252.5 | 7.0 | 6.9 / 7.0 / 7.1 | 200 / 76,456 | 21 / 57.42 |

Each fixture: 2,130 steady samples, 145 volleys of twelve rifles over 15 seconds
(9.67 volleys/s), 96 explosions; after three-second cooldown zero explosions/tracers.
Resource budget gates PASS. Steady max: Edge 7.3/7.2 ms, Chrome 7.4/7.6 ms.
Session 5 first-ready spikes were 83-347 ms (Chrome map boot 653 ms); these fresh
browser-profile results improve readiness, but do not flush the OS/driver shader
cache or establish representative iGPU, thermal, slow-network or real 6v6 acceptance.
The all-visible warm pass is deliberately outside gameplay draw-call sampling.

- `session6-final-report.json`: eight views/flows, zero console/runtime/HTTP errors
  and forbidden offline gameplay requests. Includes effects on both maps, real
  combat, same-seat reconnect, self-grenade death/respawn and alternate reload/ADS.
- `session6-chrome-report.json`: both effects gates plus real combat, zero errors.
  Both final combat boots retain the existing verified kill, movement, reload,
  reload-fire blocking and target-respawn assertions.
- `session6-reloads-report.json`: eight first-person alternate extraction/insertion/
  charging/ADS views, zero errors. Opened SMG extraction, energy-cell extraction,
  sniper extraction and pistol slide pull, plus final combat and SMG hold captures.
- `session6-aim-report.json`: 36 contact views, four alternatives, idle/run/crouch
  at -89/0/+89 degrees; zero errors or gameplay requests. Maximum support-wrist
  drift per pose over pitch < **0.008 mm**. Summary in session6-contact-summary.json.
  This measures transforms, not finger-mesh penetration or human acceptance.
- `session6-holds-report.json`: eight initial close/side views; rejected the SMG
  support hand at the muzzle and moved it back before the final aim sweep.
- `session6-extreme-report.json`: four side views make extreme upward crouch
  stock/neck crowding explicit, particularly shotgun. `session6-head-aim` was a
  rejected head-only correction; removed from the final source. Further authored
  torso/head/weapon clearance work is still needed; full M2 is not closed.

Other rejected iterations: overextended support frames were rejected by the bake's
reach guard; corrected the authored frames before export. The first warm inspector
hit a ReferenceError from an overbroad edit; fixed and rerun (`session6-warm-fixed`).
A tuple-spread type error in the new test was corrected before the final green gates.
Failed evidence is retained, not counted as acceptance. Local workerd logged tick
backlog warnings under this mixed workload (session6-preview-error.log); no deployed
capacity or latency claim is derived from it.

Asset audit PASS: **6,178,510 asset bytes**, **11,982,234 public bytes**, largest
file **4,033,414 bytes**. Five documented private GLBs under unchanged ignore rules;
only the operator derivative changed. No purchased source was copied into the app.

Next: fix extreme upward crouch stock/neck clearance with coherent torso/head and
arm authorship; complete remote reload replication/choreography and human finger/
pose review. Then representative laptop 1080p/12-player thermal effects test, real
6v6 round/rematch/RTT feel, cold driver-cache and supported-browser/device tests.
Supervisor owns preview/private-asset publication and deployed cold-eviction drill;
owner owns live approval. No new owner decisions or SDK request. M2/M5 remain open.

Cleanup verified in `.inspect/session6-cleanup.json`: all **12** owned preview
root/descendant processes stopped, no port 8796 listener, no inspection Edge/Chrome
processes. Inspectors closed their profiles; session temporary artifacts remain
under ignored .inspect only. No git commands or deployments were performed.


### Session 7 - 2026-09-07

Owner continued autonomous polish on the same defaults. Supervisor reports sessions
1-6 on preview; this session remains local. Apps/ironsight only; no git commands,
commits, deploys, new dependencies, SDK edits or purchased-asset writes. The required
Worker build executes its existing dry-run only.

Delivered:
- Remote reloads now travel as a server-owned `reloadEnd` deadline in the shared
  player codec. Ammo/reserves remain private. Start/completion/switch/death/respawn
  set or clear the deadline; clients cannot supply it. The discrete deadline passes
  through remote interpolation and uses the synchronized server clock, so AOI entry
  and reconnect resume the remaining phase instead of replaying a start event.
  Snapshot version 4 intentionally resets older snapshots. This changes the schema
  fingerprint: publish bundled client and Worker together; refresh old open tabs.
- All five remote weapons split the same runtime magazine/cell/charge parts as the
  first-person model. Original cached source geometry remains immutable. The firing
  hand lowers the weapon, the support hand reaches down for extraction/insertion and
  back for charging, then resumes the authored hold. Death/reaction/weapon changes
  release the override; locomotion remains owned by the mixer. Prepared templates retain immutable geometry beside the source GLB cache;
  instances own only moving transforms. All five part variants prewarm during
  arena preparation, avoiding per-operator geometry splitting on first visibility. This is cosmetic; server fire/reload/ammo gates remain.
- Reduced the upward firing-wrist shoulder arc and blended a small outward/forward
  clearance above steep aim. Both wrists follow the calibrated frame; the head and
  torso hit silhouettes remain unchanged. Front/side extreme-crouch captures now
  separate the shotgun stock from the neck. Full human finger/palm mesh acceptance
  and moving reload review remain open; transforms alone cannot establish those.
- Filled a missing remote gunshot audio path. Shots, explosions and remote steps
  now use camera-relative stereo pan, distance gain and low-pass rolloff. Remote
  transients share a 20-voice cap and release their audio nodes; local gun/confirm
  cues bypass that cap. A master compressor reduces accumulated firefight peaks.
  No new media assets. This is stereo bearing, not HRTF elevation, wall occlusion or
  headphone comfort acceptance. Hit/kill confirmation still requires server events.
- Combat bots acquire/track with bounded yaw/pitch speed (including DOM), retain
  their seeded aim error and reaction delay, and withhold fire while turning onto
  a target. They still use room movement/fire handlers and visibility checks.
  Practice dummies remain stationary. Route tactics, burst/reload cover decisions
  and human perceived difficulty remain further work.
- Inspector supports explicit remote reload phases and records the phase. Resource
  assertions now reject a request with no effects-stress workload; an accidental
  `effects` shot previously fell back to an overview without exercising the gate.

Final serial gates: typecheck PASS; test PASS **303 passed + 3 existing opt-in
skips** (27 passed files + one skipped); build:client PASS; Worker build/dry-run
PASS **234.36 KiB / gzip 69.64 KiB**. Evidence: `.inspect/session7-final-gates.log`.
Five added tests cover deadline-based late entry, stereo bearing/falloff, bot
acquisition and shared-buffer/per-instance reload-transform ownership. Existing room tests additionally assert deadline completion, rejection
of a forged restart and weapon-switch cancellation. Existing arm-contact/head
invariance, server hit verification, ammo and recovery tests remain green.
PowerShell wraps esbuild's ordinary stderr as NativeCommandError in the log; both
esbuild commands exit 0. Initial inspector-default expectation failed after adding
`reload: null`; updated the expected diagnostic shape and reran all gates.

Browser evidence:
- `session7-final-report.json`: both actual effects workloads, real combat, TDM boot,
  same-seat reconnect, self-grenade death/respawn and menu. Zero console/runtime/HTTP
  errors or forbidden offline gameplay requests. Combat: 2.7 m movement, one
  server-verified kill, reload 26 -> 30, all six phases, fire blocked during reload,
  target respawn. TDM boot is not a completed human 6v6 match.
- `session7-clearance-final-report.json`: ten front/side captures, all five weapons,
  crouch +89 degrees. `session7-reload-report.json`: ten extraction/hand views, all
  weapons at phase 0.4. Inspected shotgun clearance and shotgun/pistol reload hands,
  plus the real combat screenshot. Charge-phase and full aim evidence follows below.
- `session7-first-report.json` retains successful early combat/recovery plus two
  mislabeled overview shots; those are NOT effects evidence. `session7-aim` is a
  neutral-only 15-view run because `--aims=...` was not recognized; it is NOT a full
  pitch sweep. Corrected with explicit spaced arguments for `session7-sweep`.
- The first actual effects run overlapped software rig captures. Resource gates
  passed at 219/222 peak calls, but first-ready maxima were 27.8/41.6 ms and Relay
  had one 20.8 ms steady interval. Keep these observations; isolated timing follows.

Asset audit PASS: **6,178,510 asset bytes**, **12,005,899 public bytes**, largest
file **4,051,319 bytes**. Five existing private GLBs and their ignore rules unchanged;
no raw or derived purchased file was written. Audio is synthesis, animation changes
are runtime code. Local workerd logged tick backlog warnings under the mixed
inspection workload; no deployed capacity/latency claim is derived from this.

Next: human remote reload/palm/charging review, headphone direction/mix listening
and full real 6v6 round/rematch/RTT playtest. Movement acceleration/deceleration and
crouch camera transitions were reviewed but not changed: preserve the view/fire
origin agreement while designing any transition. Further bot cover/reload tactics
and UI iteration should follow playtest evidence. Representative laptop iGPU 1080p
thermal testing, cold driver caches, supported real-device browsers and supervisor
cold-eviction drill remain required. M2/M5 and live acceptance stay open. No new
owner decision or SDK request; supervisor owns publication, owner owns live approval.

Final correction evidence:
- `session7-sweep-report.json` caught a **44.789 mm** pistol support-wrist drift in
  upward run (6.11 mm crouched): rejected the universal clearance offset. The final
  correction applies only to stocked weapons; pistol keeps its prior calibrated
  arc. `session7-pistol-fixed-report.json` repeats all nine pistol idle/run/crouch
  -89/0/+89 poses. Combined accepted 45-pose set has maximum support-wrist drift
  **0.00805 mm**, zero errors; see `session7-contact-final.json`. This is contact
  transform continuity, not proof of finger mesh penetration.
- `session7-charge-report.json`: all five weapons at explicit phase 0.78, zero
  errors/network requests. Opened sniper charge and corrected upward-running pistol
  hand view. Support hand/bolt styling still needs human moving-pose acceptance.
- An isolated pre-cache effects run reproduced 34.6/27.8 ms first-ready peaks.
  That prompted preparing and retaining shared remote part buffers during loading.
  Its later combat respawn assertion failed while the client bundle was being
  rebuilt; do not count that incomplete run as accepted. The final post-build boot
  and timing report below replace it. A Record-vs-array type error during the
  preparation edit was fixed before the final green gates.

Final isolated Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced / DPR 1:

| Effects fixture | Construction / preparation ms | First 30 ready max ms | Steady median / p95 / p99 ms | Peak calls / triangles | Textures / estimated MiB |
|---|---|---|---|---|---|
| Relay | 51.6 / 471.6 | 7.1 | 6.9 / 7.1 / 7.1 | 219 / 81,962 | 22 / 60.08 |
| Undertow | 27.8 / 259.9 | 7.1 | 6.9 / 7.1 / 7.1 | 222 / 76,456 | 21 / 57.42 |

`session7-accepted-report.json`: 2,130 steady samples/map; max 7.8/7.6 ms and
zero steady intervals over 16.7 ms. Each map: 145 twelve-rifle volleys/15 seconds
(9.67 volleys/s), 96 explosions, zero live explosions/tracers after cooldown.
Moving remote parts cost 22 additional calls in this eleven-operator view; both
remain under the 240 stress gate. Shared part buffers reduce unique resident
geometries from 163/154 to 144/135 in the same fixture. These desktop rAF samples
are not GPU timer queries, representative iGPU acceptance, driver-cold-cache or
network/room capacity evidence. No parallel rig inspector ran during this sample.

Final post-build combat in `session7-accepted-report.json`: **2.4 m** authoritative
movement, one verified kill, reload **26 -> 30**, all six phases and reload-fire
blocking; the nonzero deadline arrived through the binary state and cleared to
zero at completion. Target respawn, same-seat reconnect and self-grenade recovery
to 100 HP/idle reload passed. Zero console/runtime/HTTP errors and forbidden offline
network requests across all five final flows. Earlier `session7-final` also includes
TDM boot and deployment-menu captures. Neither is human 6v6 acceptance.

Cleanup verified in `.inspect/session7-cleanup.json`: all **12** owned preview
root/descendant processes stopped, no port 8796 listener and no inspection browsers
remain. Browser scripts closed their own temporary profiles. All session inspection
artifacts remain under ignored .inspect. No git commands or deployments performed.

### Session 8 - 2026-09-07: first-play review

Supervisor reports sessions 1-7 on preview. Tested that deployed build first,
then made local fixes only. Defaults, authoritative movement/server-verified hits,
asset provenance and the iGPU budget remain unchanged. No SDK edits, dependencies,
purchased-source/derivative writes, git commands or deployment; the build uses its
existing Worker dry-run. Orca CLI was unavailable, so browser control used the
existing Node/CDP inspector with real mouse clicks, pointer lock and keyboard
events. The read-only state/camera diagnostics helped inspect the outcome;
look setters simulate mouse turns, never player-position writes.

First-play findings, ranked by player impact:

| Rank | Observed friction / evidence | Session 8 disposition |
|---|---|---|
| 1 | Disconnect in Settings: reconnect UI exists behind both Settings and the Escape menu (`session8-before-menus-report.json`). Results share that overlay precedence problem. Graceful-close detection also takes about thirty seconds before the notice. | Overlay fixed: connection/results close gameplay menus and listeners; settings changes persist. Detection delay remains ranked first in the owner list. |
| 2 | A reload R near round end becomes an immediate rematch vote; the original journey could skip results before its next poll. | Fixed: one-second grace for the keyboard vote after results appear; explicit button remains immediate. Inspector also stops reloading near the deadline. |
| 3 | Five seconds is too little to read results, compare stats and choose rematch. | Extended authoritative intermission to twenty seconds, preserving majority skip. Exact countdown remains open. |
| 4 | M persists mute with no visible status; volume controls do not expose that mute. Menu volume previously waited for gameplay's frame loop to apply. | Added HUD mute status, settings mute toggle/reset and immediate volume application, including saved volume before deployment. No audio asset or combat-mix changes. |
| 5 | Escape asks only in Korean whether to quit, gives no initial focus/trap, and does not explain the match continues. Menu-held movement can leak into Resume; a browser can reject fast relock. | Bilingual match-menu actions, continued-match notice, focus/trap, cleared input on unlock, ignored menu movement keys, and recoverable click-again prompt for rejected pointer lock. |
| 6 | Undertow training advertises passive targets but is empty. Onboarding omits G and weapon slots. | Map-specific training copy and target location; current grenade binding and 1-5 weapons included. Guided progression remains open. |
| 7 | TDM menu says 6v6/bots fill seats, but solo boot has four operators. | Corrected menu to up to 6v6 and four-operator solo start; no untested twelve-bot load increase. |
| 8 | Warmup says waiting for start without explaining whether another player/action is required. | Says starts automatically. Replicated countdown and clearer spawn-reset cue remain follow-ups. |
| 9 | Two bots initially follow nearly identical positions; shared preview roster changes lead to a long sampled scoring lull. | Recorded; isolated bot-room rerun separates bot behavior from shared-room population. No speculative AI/difficulty retuning. |
| 10 | FFA switches abruptly to bare/dark legacy art. Sniper reload exposes long angular sleeves in both training maps. | Recorded for owner visual review; no rushed collision, grip or purchased-asset rewrite. |

`scripts/first-play.mjs` extends `scripts/inspect-map.mjs` with `journey`,
`journey-match` and `menu-probe`. `--assert-first-play` checks menu focus wrapping,
mute visibility/settings, no movement from a menu key, uncovered reconnect,
recovery from a deliberately rejected pointer-lock promise, and a ten-second
results reading window. `--isolated-tdm` changes only the inspector's matchmaking
room ID to a unique TDM room; it preserves deployed server rules, bots and clocks.
It is supplementary controlled evidence, not the public menu's default routing.

Preview evidence: `session8-preview-report.json` covers deployment, real-click
Relay combat and Undertow training, TDM, DOM, FFA, onboarding, reconnect and
settings. Zero console/runtime/HTTP errors. `session8-journey-journey.json` records
**122,140 ms Relay** and **121,671 ms Undertow** training, walking/turning and trying
all five weapons, ADS and reloads. Screenshots were opened for menu, onboarding,
both training maps, DOM, FFA, TDM, sniper reloads and fixed mute/recovery UI.
This scripted route exploration is not proof of every route, human aim or listening.

Failures retained, excluded from acceptance: `session8-first-play` omitted browser
foregrounding before lock; fixed in the inspector. `session8-before-input` lost
focus during a backward-Tab probe and could not relock. `session8-journey` completed
practice but missed the public results/rematch boundary (R reload/vote timing and
other clients entering the shared room). `session8-final-round` overlapped builds
that restarted local workerd into a fresh round. These are replaced by the
post-build isolated round evidence below, not silently counted as passed.

Final application gates: **typecheck, test, build:client, build/dry-run PASS**;
**303 passed, 3 existing opt-in skips**, 27 passed test files + one skipped.
Worker **234.41 KiB / gzip 69.68 KiB**. `session8-final-gates.log` retains earlier
and final gate runs. PowerShell wraps esbuild's ordinary stderr in NativeCommandError
format; both build commands exit 0. An initial MapDef `id` type error was corrected
to use the existing practice-room map resolver before green gates.

`session8-final-report.json`: post-build real-click boot, both rebuilt maps,
server-verified practice kill, ammo/reload phases and fire-during-reload rejection,
mobile-width settings, menu-held key suppression, uncovered reconnect and rejected
pointer-lock recovery. Zero console/runtime/HTTP errors or forbidden offline
network requests. `session8-fixed-report.json` additionally covers all combat-mode
boots; `session8-final-boot-report.json` includes self-grenade death/respawn.

No representative iGPU, thermal, Firefox/Safari, headphone or human 6v6 acceptance
is claimed. Resource fixtures were not rerun for these UI/input/intermission changes;
session 7 budgets remain reference evidence, not a fresh hardware measurement.
Owner-first-play remaining work is ranked immediately under the guide above.

Completed natural round evidence (after the final gameplay build, no clock/score
mutation): `session8-preview-round-report.json` and
`session8-round-accepted-report.json`. Both use an isolated room on the actual
preview/local Worker respectively, start with the ordinary bot fill, reach the
five-minute server timeout, click Rematch, enter warmup then a fresh live round,
open/close Settings, resume pointer lock and reconnect to the same seat.
Preview result **RED 25 / BLUE 49**, local player **1 elimination / 22 deaths**;
candidate **RED 15 / BLUE 25**, local player **2 eliminations / 15 deaths**.
Candidate results remain visible after **10,000 ms** of reading before the vote.
Both end with **zero console/runtime/HTTP errors** and no forbidden offline
requests. Opened both result screenshots and candidate rematch warmup. These
scripted aim/route choices are not a fair measurement of human bot difficulty.

Asset audit: **6,178,510 asset bytes**, five existing ignored private GLBs;
no purchased asset changed. The final small settings layout adjustment groups
mute with volume above keybindings; it does not change the completed round flow.

Final layout gate/boot: `session8-final-layout-report.json` passes the same real
click, menu focus/input/mute, rejected-lock retry, settings layout and reconnect
checks with zero errors. The final timed reconnect drill also has zero errors;
its close-detection/recovery split is explicitly recorded in owner issue 1.
Final public bytes **12,016,340**, largest file **4,058,073 bytes**; asset audit
saved as `session8-assets.json`. Local workerd emitted tick-backlog warnings during
the mixed browser/build workload (`session8-server-error.log`); no local capacity
or sustained performance acceptance is inferred from these functional checks.

Cleanup verified in `session8-cleanup.json`: all **12** owned server root/descendant
processes stopped, **zero** listeners on 8796 and **zero** remaining inspection
browsers. Inspectors closed their own temporary profiles. All session artifacts
remain under app `.inspect` or the OS temporary directory. Ready for the owner's
playtest pause; supervisor publication and owner live approval remain separate.


### Session 9 - 2026-09-07: architecture AO and daylight material response

Art/lighting only, with owner playtesting still paused. Read supervisor commit
c2ee2a8 first and retained its ground AO pipeline. Supervisor reports sessions
1-8 deployed to preview; live remains the old build pending owner approval.
No gameplay, map/collision, server hit validation, SDK, purchased derivative or
npm dependency changes. No commit, push or actual deployment; `pnpm build` used
only the working agreement's existing Worker dry-run. Read-only Git inspection
was used for the requested commit, branch and diff/scope checks.

Delivered architecture AO before environment lighting. `dump-architecture.mjs`
imports the original runtime builders, including the shared ramp geometry helper,
with canvas/signs skipped. Blender bakes this exact kit into two original GLBs,
lazy per map, with 1024px AO atlases and unchanged material colours/roughness/
metalness. Ground, signs, emissive strips, purchased Relay skyline and its fallback
stay separate. No purchased input is ever opened by this pipeline. The two named
original GLBs are explicit allowlist exceptions; all five private GLBs remain
ignored and untouched. Rebuild commands and provenance are in assets/README.md.

Runtime uses the standard glTF AO slot at strength 0.75, converting its image to
R8 once during preparation (1.33 MiB including mips). It removes the original
procedural fallback only after success and retains shared geometry/materials still
used by other layers. Failed loads keep the original kit. The shared original
512x256 HDR adds cool sky/warm cloud radiance through a PMREM generated once during
loading, with temporary source/generator disposal. Environment intensity 0.85 and
hemisphere 0.65 retain the existing warm directional key, ACES and cached 1024
shadow map. Failed environment loads keep hemisphere 1.8. No extra real-time
lights, render passes, postprocessing or per-frame CPU bake/update loop. PBR AO/
environment sampling is part of the normal material shader and still needs iGPU
measurement. The resource estimator now includes R8 and the PMREM target.

Visual delta, inspected at the same cameras: Relay wall bases and panel edges now
have soft contact shading, the core cassette recesses have depth and the dish/
metal cladding receive cool sky reflection. Undertow fan surrounds, window panels,
tank bands and wall bases gain grounding; pale concrete stays readable beside dark
steel. Existing painted routes, solid boundaries and silhouettes remain intact.
The 1024 atlas gives broad grounding, not sub-centimetre grime; thin cladding can
show low-resolution AO. Do not increase atlas resolution without re-budgeting.
Material normal/roughness detail (priority 3) is deferred: Relay has only **1.08 MiB**
of estimated texture headroom under the current stress fixture.

Rejected intermediate evidence: `session9-after-*` used a Blender normal-recalc
path that inverted some thin boundary faces. Visual review caught missing surfaces;
that build is NOT accepted despite its green renderer resource assertions. The
pipeline now preserves authored winding/custom normals, discarding only 32
zero-area dish-centre triangles. An additional audit caught custom-normal drift
around those degenerate triangles and stopped the pipeline until corrected.
Initial TypeScript image-typing errors were also fixed before final gates.
`session9-fixed-*` is intermediate; `session9-final-*` is the accepted build.

`session9-geometry-audit.json`: all **7,420 Relay / 14,572 Undertow** nondegenerate
oriented triangles match the source at 0.1mm position quantization; maximum normal
component errors **0.000134 / 0.000301**, under 0.001. UVs are finite/in-range,
one AO image is embedded per map, and there are no skin/animation/node transforms.
The audit records source/output SHA-256 values and will reject inverted, added or
missing surfaces. This is render-surface equivalence, not a new collision system.

Before/after evidence: `.inspect/session9-before-report.json` (6 views) and
`session9-final-report.json` (11 views), corresponding PNGs and
`session9-delta.json`. Both reports have **zero console/runtime/HTTP errors** and
**zero forbidden matchmaking/WebSocket requests**. `undertow-pump` in the baseline
is an unrecognized shot alias and uses the overview camera; compare the matching
`undertow-vista` shots instead. Final views also cover Relay overview/cooling/
freight/spawn and Undertow home/centre/deck. Opened the final Relay/core/dish,
Undertow centre/fans and Undertow vista/tanks images against baseline captures.

Isolated Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1, each effects
fixture: eleven remote operators + local weapon, 145 twelve-rifle volleys and 96
explosions over 15 seconds, all transient tracers/explosions drained, 2,130 steady
samples/map. `--assert-budgets` passed.

| Metric | Relay before -> final | Undertow before -> final |
|---|---|---|
| Median / p95 / p99 frame interval ms | 6.9 / 7.1 / 7.1 -> 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 -> 6.9 / 7.1 / 7.1 |
| Maximum steady interval ms | 7.2 -> 7.3 | 7.2 -> 7.2 |
| Peak calls / submitted triangles | 219 / 81,962 -> 216 / 82,008 | 222 / 76,456 -> 216 / 76,454 |
| Estimated texture MiB / texture count | 60.08 / 22 -> 62.92 / 24 | 57.42 / 21 -> 60.25 / 23 |
| Effects-fixture preparation ms | 429.8 -> 496.0 | 230.8 -> 259.8 |
| First 30 ready frames maximum ms | 7.1 -> 7.1 | 7.1 -> 7.1 |

Median/p95/p99 delta **0.0 ms** at reported precision, zero steady intervals over
16.7ms; this is desktop rAF pacing, NOT GPU timer queries or mid-laptop iGPU proof.
Material batching changes culling granularity (Cooling submits 1,014 more triangles
while holding 16 calls); geometry is not added. First final map preparation was
1,405.6ms versus baseline first view 943.2ms; caches/order differ, so record this as
loading overhead, not a controlled cold-cache regression number. Real iGPU,
thermal soak, cold-driver startup and human 6v6 approval remain open.

Binary asset delta: **+2,605,509 bytes** (Relay 1,010,412; Undertow 1,553,824;
shared HDR 41,273). Total assets **6,552,354 -> 9,161,256 bytes**, including
**3,393 bytes** of new provenance documentation. Final public set **15,052,623
bytes**, largest file **4,090,381 bytes**; asset and per-file budgets pass.
Texture delta is **+2.83 MiB/map** (1.33 AO + 1.5 PMREM). Two extra resident
textures per map; no cross-map architecture request is introduced.

Final gates in `session9-final-gates.log`: **typecheck, pnpm test, build:client,
build/dry-run, pnpm audit:assets, geometry audit PASS**; **303 passed, 3 existing
opt-in skips**, 27 passing files + one skipped. Worker unchanged at **234.41 KiB /
gzip 69.68 KiB**. The PowerShell mixed-encoding log was normalized to UTF-8 without
rerunning gates; its `.raw` sibling preserves the original bytes. Final source-only
change after captures moved the existing wedge documentation to its helper; the
final build contains identical rendered behavior. No repeated gameplay testing
during the owner pause.

Cleanup confirmed in `session9-cleanup.json`: all **11** owned preview root/child
processes stopped, **zero** listeners on 8796, **zero** remaining inspection
browsers. Browser profiles were closed by the inspector. All evidence is ignored
under app `.inspect`; versionable outputs are original only.

Owner questions remain nonblocking: approve the softer industrial-daylight/contact
balance once playtesting resumes (default: keep AO 0.75 / environment 0.85), and
whether to spend further texture budget on detail (default: defer until measured
on the target iGPU). Retain stylized sci-fi, 6v6 TDM/secondary DOM and the existing
live-release approval gate. Supervisor should review the two original GLB
allowlist exceptions and include their bakes plus shared HDR when publishing
this local candidate to preview. No publication performed in this session.

### Session 10 - 2026-09-08: revive persisted and emptied arenas

Selected the supervisor's dead persisted TDM room ahead of art. Scope remained
apps/ironsight/** on ironsight-aaa; no commit, push or actual deployment. Read the
standing brief, supervisor status and plan in order. No Meshy credits spent;
the weak cable-drum example remains rejected. Re-ranked the AAA gap list above;
Crossyard continuity is the next visual priority.

Root cause: the core stops simulation when the final human seat expires, including
when an alarm expires a seat restored from an ended snapshot. The host retains the
room object. Its next onJoin adds a player, but onCreate is not called again, so
reconcileBots and tickWarmup never execute. The earlier hook-only restore test
missed the actual restore -> alarm -> empty instance -> new join sequence.

The arena now retains the preset's simulation callback and interval, marks itself
dormant on disposal, removes bot runtime data and in-flight grenades, and starts a
fresh round plus the same preset loop on the next join. This retains queued input,
lag-history recording and authoritative state flushes; no copied simulation loop,
SDK edit, codec/version change, client position authority or collider change.
The timer stays stopped while empty. Existing short reconnect behavior is retained.

Added test/arena-lifecycle.test.ts: a real serialized ended snapshot is loaded into
a NEW room through the core restoration path, both with immediate reconnection
and with alarm expiry before a new join. Assertions cover four-seat bot fill,
warmup -> live, moving bots and processed queued syncView input. A third test
reuses an emptied instance for three cycles and checks exactly ten ticks over ten
tick intervals and no ticks while empty. Before the fix, two of three tests failed:
the restored/expired case had only the new human, and warm reuse had frozen bots.
All three pass afterward. Baseline: .inspect/session10-before-tests.log.

Hardened scripts/hitch-probe.mjs to enforce the standing brief: console.error is
now collected, shader cache-key additions are checked even when program count
stays constant, and --assert requires two deaths. No gate thresholds relaxed.

Final gates: pnpm typecheck, pnpm test, pnpm build:client, pnpm audit:assets,
required relay/practice-two map inspection, and BOTH required 150000-ms maximum
TDM hitch probes PASS. Tests: **306 passed, 3 existing opt-in skips**, 28 passing
files plus one skipped. Logs: .inspect/session10-{typecheck,test,build-client,
audit-assets,inspector}.log. Additional local Worker dry-run passes at **235.23 KiB /
gzip 69.93 KiB** (.inspect/session10-worker-build.log); no upload/deployment occurred.

Both probes used the same server process and fixed arena-tdm room. The second
launched about 69 seconds after the first result was written, allowing the prior
seat to expire. No .wrangler/state clearing, room-ID isolation, or server restart
between runs. Reports: .inspect/session10-hitch-first.json,
session10-hitch-second.json; the latter is also .inspect/hitch.json. Summary and
resource deltas: .inspect/session10-delta.json.

| Observed behavior | First probe | After expiry / second probe |
|---|---|---|
| Initial seats | 1 human + 3 bots | 1 human + 3 bots |
| Live phase, seconds after probe measurement starts | 6.940 | 6.929 |
| Deaths / subsequent respawns | 2 / 2 | 2 / 2 |
| Death times, seconds | 19.551 / 59.834 | 14.874 / 22.839 |
| Maximum recorded frame, including startup, ms | 68.1 | 57.9 |
| Post-warmup shader recompiles / >150 ms spikes / errors | 0 / 0 / 0 | 0 / 0 / 0 |

Supervisor baseline files already present, repro2-hitch.json / repro3-hitch.json,
record one seat stuck in warmup and zero deaths over 30/45-second probes. The
status also reports its separate 150-second failure. These are supervisor baseline
evidence, not new Session 10 baseline browser runs. The new tests reproduce the
ended-snapshot cause; the two real-browser probes prove working repeated local
play. They do not claim a natural five-minute ended-match cold eviction on the
preview Worker; supervisor deployment/eviction verification remains pending.

Opened both .inspect/session10-final-{relay,practice-two}.png captures. The report
has zero console/runtime/HTTP errors and forbidden offline requests. Renderer/art
is unchanged: Relay camera **6.9 ms median, 7.1 ms p95/p99, 7.5 ms max**, 18 calls,
21,428 triangles, **20.1875 estimated texture MiB**. Original asset delta **0 bytes**;
texture allocation delta **0 MiB**, no added lights/passes. Assets remain
**9,161,256 bytes**, public **15,053,267 bytes**, largest **4,090,829 bytes**.
No controlled before/after frame-time improvement is claimed for this lifecycle
fix; the 10.2-ms difference between probe maxima reflects separate startup samples.
These are RTX 5070 / Edge desktop observations, not mid-laptop iGPU acceptance.

Rejected intermediates: two red lifecycle tests before the fix; an initial fixture
accessed the core's private ctx and failed typecheck, corrected by retaining its
public constructor context in the test subclass. No art intermediate was shipped.
Local workerd logged tick-backlog warnings while code/build work overlapped its
startup; final browser gates remained green. This is not local capacity evidence.

Cleanup: .inspect/session10-cleanup.json confirms all 12 owned server processes
stopped, zero remaining owned processes, zero port-8796 listeners and zero inspection
browsers. Persistent local state was preserved. All evidence is under ignored
.inspect. Only the plan, arena lifecycle, regression tests and hitch probe changed.

Open owner questions are nonblocking: whether Crossyard replacement or richer
Relay dressing should lead the next art session (default: replace Crossyard), and
whether the existing daylight/amber/teal tone is preferred (default: retain it).
Continue without waiting; representative hardware, human play/animation/audio and
supervisor preview verification remain open. No owner approval was requested.

### Session 11 - 2026-09-08: Crossyard becomes Switchyard

Read the standing brief, supervisor status and plan in order. The Session 10
ended/empty-room fix and three lifecycle tests were already present; reran them
before art work and retained the implementation. Selected the next ranked visual
gap: replace the dark Crossyard blockout presentation with **Switchyard**, a power
distribution depot. Scope apps/ironsight/** on ironsight-aaa; read-only branch/status
check at entry, no commit/push/deploy. The additional Worker build was dry-run only.

Delivered a complete first art pass, preserving all 11 collision boxes, four true
ramps, spawn positions, bot navigation and server-verified hits. Switchgear cabinet
doors, louvers, armoured cases, ground cable raceways and crossing marks explain
the playable volumes. Three paired electrical gantries with ceramic insulators
and connected busbars frame an exterior substation; service halls balance the
skyline. All exterior solids stay beyond movement bounds. The central deck stays
walkable; cladding stays within 2 cm of real cover. No collision or state-schema
change, no snapshot migration, no new dependencies or real-time lights/passes.
Switchyard uses the existing industrial-daylight setup and cached static shadows.

Added original Blender architecture/ground AO bakes, with the same winding/normal
preservation and single-channel runtime AO pipeline as Relay/Undertow. Architecture
is **22,712 triangles / 2,206,208 bytes**. Four new architecture tests verify exact
rendered solid envelopes, bounded cladding, exterior placement and no kit lights.
`session11-geometry-audit.json` matches every baked oriented triangle at 0.1 mm
quantization; max normal-component error **0.000100**, within 0.001. Existing two
map bakes were not regenerated. Generated props are excluded from this original
architecture bake and do not affect collision.

Meshy: one transformer, **30 credits** (1590 -> 1560), no retries. Strong rectangular
tank/radiator/three-insulator silhouette, approved at exterior distance after
opening its thumbnail and inspecting it in the production map. Raw **6,746,160**
bytes -> **243,392** bytes, **2,599 triangles**, three 512px WebP PBR images. Three
placements share the mesh and textures; measured source bounds normalize to a
grounded **7.00 x 5.00 x 3.43 m** envelope, centered at x=10/30/50, z=-8. The loader
checks bounds and rejects lights. This is a stylized distant prop, not a finished
close-interaction asset. The weak supervisor cable-drum example remains rejected.
Prompts/task IDs are versioned in its .meta.json; provenance/rebuild commands are
in assets/README.md. Both new GLBs are explicitly allowlisted, purchased derivatives
stay ignored, and raw generation remains under app .inspect.

Deployment/FFA/training now say Switchyard, show an actual map vista, and use
North Bus / Switch Deck / South Service callouts. arena3 room routing is unchanged.
Inspector now has reproducible Switchyard cameras, vista export, and per-map asset
request assertions. It verifies Switchyard never requests Relay/Undertow art and
the required Relay/Undertow views never request Switchyard assets.

Before/after: `.inspect/session11-before-report.json` and `session11-final-report.json`,
matching overview/center/service/north/vista/effects PNGs and `session11-delta.json`.
Opened the matching center, north, service and menu captures, plus final Relay and
Undertow training captures. Final report includes all required relay/practice-two
shots, new-map training and real FFA boot: **zero console/runtime/HTTP errors** and
**zero forbidden offline requests**. FFA boot had four players and authoritative
damage; it is not a human balance or full-match acceptance test.

Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Matched effects fixtures:
eleven remote operators plus local weapon, 145 twelve-rifle volleys and 96 blasts
over 15 seconds, 2,130 steady samples, zero expired effects remaining after drain.

| Switchyard metric | Before (legacy) | Final | Delta |
|---|---:|---:|---:|
| Eye-level center calls / triangles | 34 / 734 | 18 / 31,045 | -16 / +30,311 |
| Stress peak calls / triangles | 235 / 61,344 | 214 / 89,012 | -21 / +27,668 |
| Stress textures / estimated MiB | 18 / 42.77 | 26 / 61.58 | +8 / +18.81 |
| Stress median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0.0 / 0.0 / 0.0 |
| Stress max / first-ready max ms | 7.2 / 7.1 | 7.2 / 7.1 | 0.0 / 0.0 |

The increased texture allocation buys the ground/sign atlases, architecture AO,
existing daylight PMREM/static shadows and the generated PBR prop. Resource gate
passes with **2.42 MiB** estimated stress headroom. These are desktop rAF intervals
and allocation estimates, not GPU timer queries or mid-laptop iGPU/thermal proof.
The art remains deliberately simple in long facades and floor areas; environment
richness/material detail is now priority 1, with Relay first. No AAA completion
or owner visual approval is claimed.

New asset files **+2,710,145 bytes** including metadata/vista; provenance documentation
adds **3,442 bytes**. Assets **9,161,256 -> 11,874,843 bytes**; public set
**17,795,795 bytes**, largest file **4,110,491 bytes**, within 40 MiB/25 MiB limits.
Ground AO is 142,224 bytes, vista 117,060 bytes. No private asset changed.

Final code gates: **pnpm typecheck, pnpm test, pnpm build:client, pnpm audit:assets,
required map inspection and effects-budget assertions PASS**. Tests: **310 passed,
3 existing opt-in skips**, 29 passing files + one skipped. Worker dry-run passes
at **235.27 KiB / gzip 69.94 KiB**. Evidence logs: session11-{typecheck,test,
build-client,audit-assets,inspector,worker-build}.log; initial lifecycle test log
is session11-lifecycle.log. No gate thresholds were weakened.

Both requested TDM hitch probes PASS on fixed arena-tdm without clearing
.wrangler/state: one human plus three bots, warmup -> live in **6.749 / 6.673 s**
after measurement begins, two deaths and two respawns each, **zero recompiles,
over-threshold spikes or console errors**. Death times **19.596 / 26.423 s** and
**19.687 / 25.951 s**. The owned server was stopped 36.3 s after the first report,
then restarted with its existing durable state for a stronger cold-start check.
`session11-cold-restart.json` records process/state preservation. Reports:
`session11-hitch-first.json`, `session11-hitch-second.json` (also `hitch.json`),
and `session11-lifecycle-probes.json`. Existing tests specifically cold-restore an
ENDED snapshot through core restoration, with/without alarm expiry, assert bot
fill/live/movement/input drain, and check repeated empty reuse without duplicate
ticks. Browser probes do not claim a natural five-minute ended-match eviction on
the deployed Worker; supervisor qualification remains open.

Rejected intermediate: `session11-after-*` passed resource checks but hid too much
of the transformer behind the north wall, clipped a deck sign into its ramp, left
rear busbars dangling and retained legacy menu copy. Corrected/rebaked/reinspected
as `session11-final-*`; only the latter is final art evidence. No red final code or
browser gate was accepted. The smaller original sign and lower exterior north wall
change no playable collider. Remaining low-resolution AO and faceted transformer
fins are explicit distance/budget compromises for future art review.

Open owner questions, nonblocking: does Switchyard's open substation identity suit
FFA (default: keep it and collect route/spawn feedback), and should the next pass
prioritize materials or more machinery (default: improve Relay's service detail
and wear within its current budget). Continue without waiting. Human grip/audio,
real multiplayer, target hardware and supervisor preview publication remain open.

Additional new-map gameplay gate: `session11-hitch-ffa.json` / .log PASS with the
same 150000-ms maximum and unmodified assertions. Switchyard filled three bots,
entered live, recorded **three deaths / three respawns**, zero recompiles/spikes/
console errors. Maximum recorded frames across TDM first / TDM cold restart / FFA
were **54.7 / 54.4 / 59.0 ms**; no recorded frame exceeded 150 ms. The required
`.inspect/hitch.json` remains the second TDM report, not this supplementary FFA run.

Cleanup verified in `.inspect/session11-cleanup.json`: both owned server trees
stopped, **zero remaining owned processes, zero port-8796 listeners, zero inspection
browsers**. Persistent local state was preserved. All three probe commands and
final inspection exited successfully; generation and Blender processes completed.
Ready for supervisor review/publication; no commit, push or deployment performed.
