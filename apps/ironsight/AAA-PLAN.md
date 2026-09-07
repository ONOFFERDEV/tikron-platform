# IRONSIGHT / RELAY — rebuild plan

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
Relay; `arena2` becomes Undertow in milestone 2. Arena3/Crossyard remains available
as a legacy practice/FFA map until its replacement is accepted. Shared MapDef drives
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
| Relay structural kit | original procedural instanced geometry, shared colliders | zero external geometry bytes |
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
instanced structural kit, one static shadow atlas, no bloom/SSAO requirement in M1.
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

Animation: retain current state machine for this session; next add rifle hold
locomotion and additive aim only after retarget proof. First-person reload should
have magazine/bolt phases matched to server duration, with firing muzzle derived
from the visible barrel. Audio: positional fire/impact/steps, transient voice limits,
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
