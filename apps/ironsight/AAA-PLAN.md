# IRONSIGHT / RELAY — rebuild plan

## OWNER PLAYTEST GUIDE

**Preview:** https://ironsight-next.plain-wave-5d5b.workers.dev
Supervisor reports sessions 1-42 are deployed there, including all three expanded maps,
threat audio, weapon handling, combat presentation and shared recoil/accuracy. Session 32
adds recent spawn-sightline memory. Session 33 adds Undertow orientation landmarks.
Session 34 adds Switchyard half/lane silhouettes. Session 35 adds a compact training
coach for movement, aiming and confirmed hits. Session 36 adds readable connection
delay feedback and three-seed Switchyard contact evidence. Session 37 moves two
Switchyard arrivals to screened northern courts with exit chevrons. Session 38
faces these arrivals toward inner exits and restores authoritative aim on respawn.
Session 39 adds Undertow objective rehearsal. Session 40 adds rebindable Q team
pings (aim, then mark; five-second snapshot). Session 41 adds a required own-mark
training lesson on every map, including unbound-key guidance. Session 42 adds
rebindable B / Need backup at your location. Session 43 adds hold-Q selection: mouse up for context, left for Go here, right for Need backup; release to send, centre/right-click to cancel. Session 44 adds Relay lane cover/courts, a solid central signal spine and tiled ground colour. Sessions 43-44 remain local until supervisor publication. Continue the standing brief defaults.
**Live fps.tikron.dev stays unchanged. This is not live acceptance.**

Try this in 10 minutes with headphones, mouse/keyboard and another player ready:

| Time | Try | Look for |
|---|---|---|
| 0-1 min | Open Settings using Tab/Enter; adjust sensitivity, rebind a key, close with Escape. Try volume and Reduced motion. | Clear focus, readable labels, saved choices; no unwanted movement while in a menu. |
| 1-3 min | Training / Relay: sprint all three lanes, climb both decks, crouch at cover. Watch arena preparation; fire, aim, reload and switch all five weapons (1-5), then throw G away from yourself. | Solid visible cover, readable enemies/exits, comfortable aim, no first-shot/blast freeze; stable grip and unobstructed sights. |
| 3-5 min | Return to deployment, choose Training / Undertow. Follow movement/aim lessons, find A on the minimap and hold for four seconds; then explore the control ledges. | The rehearsal resets if you leave A or pause, explains Domination, and awards no match score. Distinct routes and solid visible cover. |
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
2. **Sparse or uneven solo encounters.** Sessions 28-30 fill twelve seats on
   all expanded maps; Switchyard retains the FFA playlist. Natural bot rounds now produce
   heatmaps and contact samples, and DOM objective movement follows collision
   navigation. Contact medians still miss 20-30 s, and one round is insufficient
   to validate route variety, spawn fairness or side win rates. Human 6v6 remains open.
3. **Art continuity and first-person sleeves.** Session 11 replaces Crossyard's dark
   blockout presentation with Switchyard's industrial kit, baked lighting and
   generated substation machinery. Layout/FFA balance remain to be reviewed.
   Sniper reload captures show long,
   angular forearms across the lower screen. Review them in motion and at normal
   FOV before changing the authored grip or purchased derivative. Remote palm,
   finger and moving reload approval from the guide remains open.
4. **Training progression is basic.** Session35 recognizes four metres of movement,
   half a second at full ADS and a confirmed target hit in Relay, with a peripheral
   progress card. Session39 adds a four-second objective rehearsal at Undertow A,
   with minimap/radius guidance and Domination explanation. Switchyard now
   adds ping after movement/aim in Session41. Relay and Undertow also require a
   server-echoed own ping after their existing lessons. A route tour, a target reset
   button and an integrated first-match course remain absent. Rejoining restarts lessons.
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

Session30 supersedes the original compact-map plan below: all three maps now span
150 x 100 m. Switchyard keeps its FFA playlist and twelve-seat fill.
The shared wire envelope is 200 x 160 m; each map enforces its own movement bounds. `arena1` becomes
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

## Reference scorecard

Session 24 first canonical audit (reference restored), updated in Session 44. Met means the stated implemented
check, not owner/iGPU/6v6 acceptance. Static measurements: `.inspect/session44-reference-audit.json`;
reproduce with `tools/reference-audit.ts`. Original document targets remain authoritative;
short-map timing mismatches are recorded, not silently redefined as passes.

| Id | Status | Evidence |
|---|---|---|
| R-M01 | partial | Session30 adds North bus rifle route, four-ramp Switch deck and offset South service flank; all maps have named lanes. Human route quality remains open. |
| R-M02 | partial | Undertow B has two 4 m north doors, their sampled approaches visible within default 78-degree FOV from (75,97); standing-eye rays tested. All-objective/human visibility audit incomplete. |
| R-M03 | met | Session44: Relay 61 full/46 waist, no head-height cover; sampled cooling/service/freight routes have ground cover within 12 m. Undertow23/14 and Switchyard42/10 retained. Test measures proximity, not universal cover-to-cover path length. |
| R-M04 | met | Session44 Relay ground BFS sprint A-B/B-C14.44 s, A-C11.78 s; previous11.56 s. Undertow14.22/14.22/10.67 s, Switchyard14.44/14.44/11.11 s retained. All in10-15 s; human retakes unmeasured. |
| R-M05 | partial | Relay rifle decks, Undertow paired control shortcuts, Switchyard exposed four-ramp 3 m deck crossing both axes. Grounded traversal tested; player value unreviewed. |
| R-M06 | n.a. | No world power pickups implemented. |
| R-M07 | not yet | Session44 natural Relay6v6 seed0x28abc: initial median LOS/damage5.4/13.7 s; respawn4.4/11.55 s. Damage target20-30 s not met. Prior multi-seed Relay/Undertow/FFA samples retained; density is not a pacing pass. |
| R-M08 | partial | Session34 Switchyard west ribbed capacitor towers versus east broad amber crane, paired central-deck views and matched vista; Session33 Undertow half silhouettes. Human wayfinding remains open. |
| R-M09 | partial | Session38 faces both new northern courts along tested 9 m inner-exit aisles, normalizes spawn yaw for the binary codec, and restores client aim once on revival. Room/wire tests and real respawn drill pass. Safety scoring unchanged; all-exposed fallback and human camping/wayfinding remain open. |
| R-M10 | partial | Session44 adds close paired A/C cooling courts and B freight shoulders; all cap paths remain reachable. Inner combat shells now visible; exactly-two-entry/co-visibility and human defensive quality remain open. |
| R-M11 | partial | Collider-derived kits and ramps tested; all reachable viewpoints need player review. |
| R-M12 | partial | All three expanded maps now document distinct route beats and automated traversability; human action-block validation remains open. |
| R-M13 | partial | Session44 Relay cooling courts/rifle corridor, split-core service screens and amber freight beats plus central striped spine. Existing Undertow/Switchyard half landmarks retained; human callout learning open. |
| R-M14 | n.a. | No destruction/windows system promised; fixed openings remain authoritative. |
| R-M15 | partial | Undertow DOM-first, Relay TDM-first; majority-mode rule not universally met. |
| R-M16 | not yet | No timed central item-control loop. |
| R-M17 | partial | Session44 solid14 m central signal spine on6 m Relay core, receiver cassettes in collider envelope. Eye-to-spine rays clear from cooling, both service approaches and freight; final screenshots. Other maps and all reachable-viewpoint/human wayfinding remain open. |
| R-M18 | partial | Session44 retains ground/3 m decks/6 m roofs and four actual ramps.14 m solid spine is inaccessible from6 m roof, not an added traversable floor. Ground bot paths/ramps remain green; no sunken tier or human vantage acceptance. |
| R-M19 | met | All maps 150x100 m / 12 seats = 1,250 m2 per seat and tested 40 m rifle corridors. Switchyard FFA; this density check does not establish pacing or fairness. |
| R-M20 | partial | Session44 natural Relay6v6 round221.3 s,49:50 with life contact samples and5 m death heatmap. Prior three-seed samples retained. A small sample cannot establish side fairness. |
| R-G01 | not yet | No contested HP/ammo reward loop. |
| R-G02 | partial | Five weapon/falloff profiles and grenades; no melee and human balance unverified. |
| R-G03 | partial | Sniper tracer, slow cadence and Session26 400 ms ADS acquisition; hip fire remains immediate, glint absent. |
| R-G04 | met | Session31: stationary cone AR/SMG/shotgun/sniper/pistol 0/.0002/0/.0001/.0002 rad; movement .02/.03/.02/.12/.02 added. Grounded crouch reduces cone 25%; shared accuracy tests. Human burst feel open. |
| R-G05 | partial | Session31 fixed per-weapon authoritative offsets, four vertical automatic opening shots, later lateral drift; mouse probe and server-ray tests. Secure timed recovery replaces instant release reset; human learning/RTT acceptance open. |
| R-G06 | met | Session31 bounded center-biased deep-spray cone after 8/7/8/8/5 shots; ADS .65/.70/.80/.50/.65 and grounded crouch .75 multiply. Shared function on server/claims, distribution and authority tests; slow weapons settle between shots. |
| R-G07 | not yet | Cosmetic kick exists; no trauma-driven rotational shake. |
| R-G08 | partial | Session31 authoritative aim offset separated from cosmetic weapon kick. Reduced motion preserves the exact aim model; dedicated reduce-view-kick setting remains absent. |
| R-G09 | partial | Team tint and five held pose families; human silhouette/hold acceptance open. |
| R-G10 | partial | Bounded pooled muzzle VFX; per-weapon shape/duration reference acceptance open. |
| R-G11 | met | Shot events drive travelling tracers; sniper 1200 m/s, others 500-800; hits remain instant server hitscan. |
| R-G12 | partial | Session17 sleeves and reload phases; centre corridor/finger motion needs human review. |
| R-G13 | not yet | Hip FOV 78; no 90-100 default/110-capped slider. |
| R-G14 | partial | Session27 actual Web Audio graph: enemy/ally step and reload gain 1.4; concrete/metal surfaces, replicated remote reload phases. Numeric target met; headphone/identity acceptance open. |
| R-G15 | partial | Confirmed hit 900/1400 Hz at .28 gain; kill 660/990 Hz at .30. Bypasses voice cap; headphone mix unverified. |
| R-G16 | partial | Session27 collision-box segment occlusion: .32 gain / 1100 Hz cutoff, event-time only. No ramp-volume occlusion, diffraction, doorway routing or HRTF. |
| R-G17 | partial | Session20 cached crack/body/tails and limiter; distance filtering, no separately authored far recordings. |
| R-G18 | partial | Sway exists, ADS retains 12% (88% reduction); shared camera FOV, no separate weapon FOV. |
| R-G19 | met | Session26 shared ADS 250/200/225/400/165 ms and sprint recovery 120/100/130/150/90 ms, real-room boundary tests, five-weapon mouse probe and sprint/fire control check. Hip fire remains allowed; human/RTT acceptance open. |
| R-G20 | met | Session31 WeaponSpec includes fixed recoil/recovery/accuracy alongside ADS/sprint timers; shared sampling/jitter drives server rays, claims, local camera and HUD. Owner-only sequence replies repair rejected prediction; raw fire aim is atomic. Human RTT acceptance open. |
| R-L01 | partial | Streak notices at 3/5/8 reset on death; no tier rewards/catch-up. |
| R-L02 | partial | TDM 50 kills/300 s. Session39 DOM natural rounds 253.9/300/300 s, scores 87-201/153-177/174-165. Actual 4/8 s capture, 1 point/2 s/flag and no side swap remain below reference requirements; training rehearses the actual neutral duration without changing economy. |
| R-L03 | met | AR 25 body damage: four hits at close range, 300 ms from first shot at 100 ms cadence. |
| R-L04 | met | 3000 ms live respawn and dynamic scoring retained. Session38 restores authoritative arrival aim once, wraps yaw into codec range, and passes real death/revival with no probe aim correction. Human camping acceptance remains open. |
| R-L05 | partial | 10 s warmup and skippable 20 s results; replicated countdown/5-8 s freeze absent. |
| R-L06 | not yet | No replay capture or highlight sequence. |
| R-L07 | not yet | No objective/assist-aware MVP selection. |
| R-L08 | partial | Session40 rebindable Q resolves enemy/go-here from server aim, cover and live targets; allies only, 2 s cooldown, 5 s snapshot, max six markers. Authority tests and three real-input layouts pass. Session42 adds explicit rebindable B backup at a frozen server-derived caller location, sharing cooldown/lifetime/privacy; three layouts and real Settings rebind pass. Session43 adds a 250 ms hold wheel on the same rebindable ping key: context/go/backup, centre/right-click/pause cancellation, frozen aim and three browser layouts. Audio/acknowledgement and human muted-mic review remain open. |
| R-L09 | partial | Session41 requires an active own server-echoed ping after each map's existing lessons; key rebinding/unbound guidance, pause rejection and nine map/size layouts pass with ordinary inputs. Relay confirmed-hit and Undertow actual 4 m/4 s unscored objective rehearsal retained. A combined first-match course and human learning review remain open. |
| R-L10 | partial | All three expanded maps fill twelve seats (Switchyard FFA). Undertow training now rehearses an objective without targets or scoring; Switchyard remains empty traversal practice. No first-match progression. |
| R-L11 | partial | Normal bot HP/damage/reaction retained; collision navigation for DOM and patrol. Switchyard authored nine-point circuit omits spawn bays, staggered goal on every spawn. No difficulty progression. |
| R-L12 | partial | Baked illustrative palette/operator contrast; all lighting/player readability unverified. |
| R-L13 | partial | Team-colour mass on existing operator; torso value separation needs real-play review. |
| R-L14 | partial | Collider authority and bounded VFX; distance-amplified fresnel absent and iGPU acceptance open. |
| R-L15 | not yet | No skill-based HP/ammo reward. |
| R-L16 | partial | Shared movement/combat systems; no staged content progression. |
| R-L17 | partial | Explicit streak/kill feedback; no broader repeatable medal set. |
| R-L18 | partial | Session27 reserves four of twenty remote voices for unobstructed enemy foley; box-blocked sounds attenuate. Specific R-G14 1.4 gain takes precedence over generic 1.2-1.3; path reachability not modeled. |
| R-L19 | partial | Session36 RTT-based delay labels, two-second change hold/recovery margin, immediate known-disconnect state, quiet numeric RTT/FPS. Six responsive HUD fixtures and real training capture pass. RTT alone does not measure loss/jitter; actual RTT/escaper feel and outage-detection timing remain open. |
| R-L20 | partial | Five rows, killer/weapon/victim/HEADSHOT text; top-right, team coloured, objective feed absent. |
| R-L21 | met | Session24: confirmed victim-only bearing, four labelled sectors, 60 ms flash/edge vignette, 900 ms direction; nine HUD fixtures. Reduced motion omits flash; human comfort open. |
| R-L22 | partial | Session39 marks actual Undertow A and its 4 m radius during training using the existing 10 Hz minimap; no enemy positions exposed. Session42 adds caller backup snapshots with a teal B diamond alongside +/! contextual marks; no tracking, automatic gunfire reveal or human readability pass. |
| R-L23 | not yet | No enemy-highlight colour dropdown. |

## AAA gap list

Session 44: the supervisor's new density directive overrides the previous UI ranking.
All 63 reference rows retained. Relay density/ground scaling leads this session;
Undertow then Switchyard follow, with communication work after map density.

1. **Expanded-map density (R-M03, R-M07, R-M10, R-M13, R-M17, R-M18).**
   Session44 completes the first Relay density pass: cover proximity <=12 m on
   sampled lanes, objective courts, readable central core,
   ground detail at metre scale and >=12 px/m source AO; rebake collider-derived
   architecture, preserve 10-15 s rotations and 40 m rifle corridor. Measure natural
   contact/heatmap and renderer budget. Then apply the same audit to Undertow and
   Switchyard, one map per session. Human route/wayfinding acceptance stays open.
2. **First-play/flow/accessibility (R-L08-10, R-L19-23).** Add ping acknowledgement and communication audio; connect Relay shooting and Undertow
   objective rehearsal into a coherent first-match course. Review pings with
   muted microphones. Countdown and highlight colour choices remain absent;
   real outage timing and RTT comfort need review.
3. **Spawn fairness and solo encounters (R-M07, R-M09, R-M20).** Session37 FFA
   contact median remains 5.4 s versus 20-30 s. Session38 Relay natural respawn
   medians are 9.9/10.6/10.4 s. Session39 Undertow medians are 18.4/17.8/29.7 s;
   red wins 1/3 and blue 2/3 in each three-seed team baseline. Expand the sample
   before further policy/layout tuning; one in-band median is not a pacing pass.
   Current/recent LOS safety takes priority over route variety. Human camping
   and the all-exposed fallback remain open. New northern first-look views pass.
4. **Layout/mode pacing (R-M04, R-M07, R-M19, R-L02).** All maps expanded;
   DOM capture/economy/side-swap and five-minute soft caps differ from reference.
   Natural Relay rounds last 193.2-213 s. Gather real encounters before changing
   movement, TTK or economy together.
5. **Weapon comfort (R-G05, R-G08, R-G13, R-G18).** Human burst learning and high-RTT
   corrections; separate reduced cosmetic view kick and world/weapon FOV controls.
6. **Environment orientation review (R-M08, R-M13, R-M17).** Inner northern exits
   expose yard silhouettes; other spawn openings/all-lane landmarks still need
   review. Relay has only ~0.25 MiB stress texture headroom; reuse materials and
   instancing, with Meshy reserved for clear silhouette value.
7. **Audio routing and acceptance (R-G14, R-G16, R-L18).** Headphone mix/surface
   identity, ramp-volume occlusion and sound around doorways; direct box filtering
   is bounded and tested, not a reachability/diffraction model.
8. **Human/device acceptance.** Moving hands/holds, headphone mix, 6v6/RTT, iGPU,
   cold-driver/thermal and Firefox/Safari remain open; desktop fixtures cannot close them.

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


### Session 12 - 2026-09-08: Relay service detail and real ended-room recovery proof

Read the standing brief, Session 12 supervisor status and this plan in order.
The supervisor's ended-room concern outranked art: the Session 10 implementation
and three real-core-restoration lifecycle tests were already present, and all
three passed before visual work (`.inspect/session12-lifecycle.log`). Retained
that fix and added a stronger natural-match browser qualification below. No new
server, SDK, collision, state-codec or migration change was needed. Scope remained
apps/ironsight/** on ironsight-aaa. Entry branch/status checks were read-only;
no commit, push or deployment. The Worker build was the existing dry-run only.

Selected the next ranked visual gap: Relay's blank service facades and floor.
Delivered original sealed maintenance hatches, breaker cabinets with gauges and
conduits, louvers, caution plates, and armored-case hardware. Edge chips, fastener
runoff and scuffs are painted deterministically during scene creation. Hatches
say SEALED / ACCESS PANEL so they do not advertise a new playable entrance.
Existing solid faces determine every placement; 48 quads / 96 triangles sit
12 mm outside cover. One merged mesh and one 512x256 original canvas atlas add
one draw and **0.667 MiB**, with no new lights, rendering passes, animation or
per-frame baking. Existing baked architecture/AO remains unchanged. This is flat
service cladding, not close-range three-dimensional machinery or AAA completion.

Relay's existing 512px ground atlas now includes worn maintenance clearances,
flush drains and runoff, concrete repairs and paired freight tire wear. Other
maps retain their ground. No new binary assets or private derivatives were
written; provenance/reproduction is documented in public/assets/README.md. No
Meshy credits spent (balance remains **1560**): this pass needed surface graphics,
not another freestanding prop. The weak cable drum remains rejected. A stronger
machinery silhouette is an appropriate next Meshy use after resource re-budgeting.

Two new tests check every cladding face against the authoritative solid envelope,
its vertical/outside placement, finite atlas coordinates and the small triangle
budget. Final **pnpm typecheck, pnpm test, pnpm build:client, pnpm audit:assets,
Worker build/dry-run, required relay/practice-two inspection and effects-budget
assertions all PASS**. Tests: **312 passed, 3 existing opt-in skips**, 30 passing
files plus one skipped. Worker **235.27 KiB / gzip 69.94 KiB**, unchanged. Logs:
`.inspect/session12-{typecheck,test,build-client,worker-build,audit-assets}.log`.

Visual evidence: `.inspect/session12-before-report.json` and `session12-final-report.json`,
matching relay/cooling/freight/spawn/effects-stress PNGs, and `session12-delta.json`.
Final report also includes the required Undertow practice boot. All six final
views have **zero console/runtime/HTTP errors and zero forbidden offline requests**.
Opened the matching Relay before/after/final, freight intermediate, spawn baseline,
and final Undertow practice captures. Final inspection log: session12-final-inspector.log.

Edge 152.0.4191.66 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Matched effects
fixtures: eleven remote operators plus local rifle/hands, 145 twelve-rifle volleys
and 96 explosions in 15 seconds, 2,130 steady samples, zero residual tracers/blasts.

| Relay metric | Before | Final | Delta |
|---|---:|---:|---:|
| Eye-level relay calls / triangles | 18 / 21,428 | 19 / 21,524 | +1 / +96 |
| Stress peak calls / triangles | 216 / 82,008 | 217 / 82,104 | +1 / +96 |
| Stress textures / estimated MiB | 24 / 62.918 | 25 / 63.585 | +1 / +0.667 |
| Stress median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0.0 / 0.0 / 0.0 |
| Stress max / first-ready max ms | 7.2 / 7.2 | 7.3 / 7.1 | +0.1 / -0.1 |

Only **0.415 MiB** estimated stress texture headroom remains. These are desktop
rAF intervals and allocation estimates, not iGPU, GPU timer, cold-driver or
thermal acceptance. No controlled loading-time improvement is claimed. Relative
to Session 11's audited set, assets **11,874,843 -> 11,875,894 bytes** (provenance
text +1,051; binary asset delta **0**). Public **17,795,795 -> 17,823,585 bytes**,
including generated client/source-map growth; largest file **4,128,832 bytes**.
The 40 MiB total / 25 MiB individual-file limits pass.

Natural-ended-room proof, stronger than the prior hook/short-probe evidence:
- Added optional `--until-ended` to scripts/hitch-probe.mjs. With a 360000-ms
  ceiling it continues normal inputs beyond two deaths, waits 5.5 seconds after
  the natural end for persistence, captures results, and exits without voting.
  It asserts the final phase is ended. It never edits scores, clocks or state.
- `session12-natural-ended.json` / .log PASS: ordinary fixed arena-tdm reached
  its natural five-minute timeout, **RED 17 / BLUE 23**, **12 deaths**, zero shader
  recompiles, over-limit frames or console errors. Maximum recorded frame
  **47.6 ms**. Opened `session12-natural-ended-ended.png` showing the same result.
- Stopped the owned preview before intermission completed. Read SQLite strictly
  read-only and decoded the existing tk:room blob: **phase ended, 17 / 23, version 4,
  four players, one human seat, 861 bytes**. Evidence: session12-persisted-ended.json,
  session12-persistence-source.json and ignored raw snapshot; the report records
  the snapshot SHA-256. No durable bytes were replaced or cleared.
- Restarted the preview against that same .wrangler/state and ran the required
  150000-ms maximum TDM probe. After its seat expired, ran a second standard
  probe on the same process and fixed room, with no state clearing or restart
  between these two accepted runs. Final .inspect/hitch.json is the reuse run.

| Accepted standard probe | Cold start from ended snapshot | Reuse after seat expiry |
|---|---:|---:|
| Initial population | 1 human + 3 bots | 1 human + 3 bots |
| Warmup -> live, seconds after measurement starts | 6.891 | 6.915 |
| Deaths / respawns | 2 / 2 | 3 / 3 |
| Maximum recorded frame ms | 54.2 | 57.5 |
| Shader recompiles / >150 ms frames / console errors | 0 / 0 / 0 | 0 / 0 / 0 |

Reports/logs: session12-hitch-cold, session12-hitch-reuse, plus
session12-lifecycle-probes.json. The existing three tests continue to cover ended
snapshot restore with/without alarm expiry, bot fill/live/movement/queued inputs,
and repeated empty reuse without duplicate ticks. This establishes actual local
ended-snapshot recovery, not deployed Cloudflare eviction acceptance.

Also corrected the probe's old eight-second exclusion for >150 ms frames: it now
rejects ANY measured frame above that limit; preparation precedes measurement.
The three final browser probes above pass the stricter gate. Thresholds were not
relaxed. The initial session12-hitch-first also passed but a provenance edit
triggered Wrangler asset reload near its end; treat it as supplemental reload
recovery evidence, not one of the two isolated final acceptance runs.

Rejected intermediates: session12-after floor clearances were too bright/soft on
the low-resolution ground atlas; toned them down before final captures. Initial
typecheck failed because the geometry test imported a browser module using
document; split pure geometry from canvas painting and reran the gates. Existing
local workerd tick-backlog warnings occurred in the logs; the final browser gates
passed, and no capacity/latency claim is derived from this local single process.

Cleanup: session12-cleanup.json confirms all 12 restarted-server root/descendant
processes stopped, zero remaining owned processes, zero port-8796 listeners and
zero inspection browsers. The earlier 12-process server tree was stopped for the
cold drill; its root's brief termination lag was checked resolved before restart.
Persistent local state was preserved. All session evidence stays under .inspect.

Open owner questions remain nonblocking: does the sealed service-hardware look
fit Relay (default: retain it), and should the next environment pass prioritize
machinery or material depth (default: a better hero silhouette, first freeing
texture budget). Keep industrial daylight, amber/teal and stylized sci-fi. Human
animation/audio/route review, real 6v6/RTT, target hardware and deployed eviction
remain open. No owner approval requested; ready for supervisor review/publication.

### Session 13 - 2026-09-08: Relay uplinks within the existing texture budget

Read the standing brief, supervisor status and plan in order. The supervisor's
ended-room concern took precedence: retained the Session 10 fix and reran all three
real-core lifecycle tests, green (`.inspect/session13-lifecycle.log`). They restore
an ended serialized snapshot, exercise immediate reconnect and alarm-before-join,
assert four-seat bot fill, warmup -> live, bot movement and queued input, and reuse
an empty instance without duplicate ticks. Session 12's natural-ended snapshot
proof remains applicable. No new lifecycle defect was reproduced or speculative
server change made; preserved-state browser qualification is recorded below.
Branch confirmed by reading HEAD: ironsight-aaa. All writes apps/ironsight/** only;
no git commands, commit, push or deployment. Worker build is its existing dry-run.

Selected the top visual gap: Relay's machinery silhouette. Added two generated
paired-dish uplink assemblies below the original main antenna, visible along the
Cooling lane and in the refreshed deployment vista. They share one mesh/PBR set,
cast into the existing cached shadow map, and load only on Relay before renderer
preparation. No extra lights/passes, per-frame bakes, dependencies, state/schema,
collision, player movement or hit-validation changes. Runtime bounds reject empty/
flat/nonfinite sources and embedded lights, then ground the model from its actual
bounds. Tests cover transformed source origins, shared GPU resources and keeping
both instances outside playable space. Inspector asserts presence, per-instance
triangle/envelope limits, and no Relay prop request from other maps.

Meshy used **30 credits, 1560 -> 1530**, one generation, no retry. Raw **7,641,968**
bytes -> **279,624** bytes, **2,827 triangles**, three 512px WebP PBR images. The
result has side-by-side dishes and a tripod instead of the prompt's vertical
stack/cabinet. Inspected thumbnail, in-map silhouette and close view; accepted as
secondary exterior machinery, not as a close-interaction hero asset. Faceted
mechanical joints and uneven panel seams remain a distance/style compromise.
Two placements at x=25/37, z=-6 have actual **7.00 x 8.861 x 2.693 m** envelopes,
y=0..8.861 and z=-7.346..-4.654. No generated surface reaches playable bounds.
Exact prompt/task IDs and provenance/rebuild commands are versioned with explicit
GLB allowlisting. Raw output stays under .inspect/meshy; no purchased derivative
changed. The weak supervisor cable-drum remains rejected.

Re-budgeted the distant skyline palette in memory: 1024 -> 512px, once during
cached loading, preserving glTF color space/UV/sampler settings. This saves
**4 MiB** including mips and funds the new PBR set's **4 MiB**. Source skyline GLB
stays private and unchanged. Matched skyline captures retain its broad color
panels. Stress headroom remains **0.415 MiB**; future material work must re-budget.

Final code gates: **pnpm typecheck, pnpm test, pnpm build:client, pnpm build
(Worker dry-run), pnpm audit:assets PASS**. Tests **314 passed, 3 existing opt-in
skips**, 31 passing files plus one skipped. Worker unchanged: **235.27 KiB /
gzip 69.94 KiB**. Logs .inspect/session13-{typecheck,test,build-client,worker-build,
audit-assets}.log. Assets **11,875,894 -> 12,171,501 bytes (+295,607)**, including
new model/metadata, refreshed vista and provenance; public **17,823,585 ->
18,129,162 bytes (+305,577)**; largest file **4,135,464 bytes**. Both file caps pass.

Before/after evidence: .inspect/session13-before-report.json and
session13-accepted-report.json, matching relay/cooling/vista/effects-stress PNGs
and session13-delta.json. Accepted report also includes the uplink close view,
required Undertow practice boot and deployment menu: **seven views, zero console/
runtime/HTTP errors and zero forbidden offline requests**. Opened matching cooling
views, final relay/uplink/vista, accepted Undertow and menu. Refreshed vista is the
production renderer's screenshot. All final resource assertions pass unchanged.

Edge 152.0.4191.66 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Same effects
workload: eleven remote operators plus local rifle/hands, 145 twelve-rifle volleys,
96 blasts in 15 seconds, 2,130 steady samples, zero remaining blasts/tracers.

| Relay metric | Before | Accepted | Delta |
|---|---:|---:|---:|
| Eye-level calls / triangles | 19 / 21,524 | 21 / 27,178 | +2 / +5,654 |
| Stress peak calls / triangles | 217 / 82,104 | 219 / 87,758 | +2 / +5,654 |
| Stress textures / estimated MiB | 25 / 63.585 | 28 / 63.585 | +3 / 0.000 |
| Stress median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.2 | 0.0 / 0.0 / +0.1 |
| Stress max / first-ready max ms | 7.2 / 7.1 | 7.3 / 7.1 | +0.1 / 0.0 |

These are desktop rAF intervals and estimated texture allocations, not GPU timers,
laptop iGPU/thermal acceptance or real multiplayer capacity. No controlled loading
improvement or AAA completion is claimed. Broad floors/walls and exterior ground
continuity still need work; those lead the re-ranked environment gap above.

Rejected intermediates: initial x=22/40 placement obscured a dish behind a gantry
column; moved inward to x=25/37. An initial typecheck rejected inspector access to
SceneRig's private scene; replaced it with a read-only diagnostic method. The
session13-final inspection stopped at Undertow's reconnect overlay after the
vista asset write/reload; local workerd logged internal connection errors. It is
excluded from acceptance. Finished all asset writes/builds, stopped all twelve
owned server processes, preserved .wrangler/state and restarted; isolated
session13-accepted then passed. No assertion or threshold was relaxed. Local
tick-backlog warnings remain logged, not treated as capacity evidence.

Open owner questions are nonblocking: do the paired uplinks fit Relay (default:
retain as secondary exterior machinery), and should the next environment pass
favor surface materials or more props (default: material depth after a texture
budget review). Keep industrial daylight, amber/teal and stylized sci-fi. Human
grip/audio/route review, target hardware, real 6v6/RTT and deployed eviction
acceptance remain open. No owner approval requested.

Both required **150000-ms maximum TDM hitch probes PASS**, on the same fixed
arena-tdm room and same server process, with **107.889 seconds** between first
report and second launch to let the original human seat expire. No state clearing,
room isolation, build, asset write or server restart between these accepted runs.
The preflight server restart also retained its original .wrangler/state. This
rechecks local cold startup/empty reuse; the three existing tests specifically
cover ended snapshot restoration. It does not repeat Session 12's natural
five-minute match or establish deployed Cloudflare eviction acceptance.

| Accepted TDM probe | First | Reuse after expiry |
|---|---:|---:|
| Initial population | 1 human + 3 bots | 1 human + 3 bots |
| Warmup -> live after measurement starts | 7.378 s | 6.853 s |
| Deaths / respawns | 3 / 2 | 3 / 2 |
| Maximum recorded frame | 57.5 ms | 63.7 ms |
| Recompiles / >150 ms frames / console errors | 0 / 0 / 0 | 0 / 0 / 0 |

Reports/logs: .inspect/session13-hitch-{first,second}.{json,log},
session13-lifecycle-probes.json and session13-reuse-start.json. Required
.inspect/hitch.json is the second accepted run. Both probes encountered a third
death during the six-second post-second-death observation; two respawns were
observed, not three. No final gate is red or skipped beyond the three pre-existing
opt-in unit-test skips.

Cleanup verified in .inspect/session13-cleanup.json: all twelve restarted-server
root/descendant processes stopped, zero remaining owned processes, zero listeners
on 8796 and zero inspection browsers. The earlier twelve-process server tree was
also stopped at preflight restart. Durable state remains preserved; Meshy and
Blender completed, and inspection scripts closed their browsers. Evidence stays
under ignored .inspect. Ready for supervisor review; no commit/push/deploy.

### Session 14 - 2026-09-08: Relay concrete response within the texture budget

Read the standing brief, Session 14 supervisor status and plan in order. Branch
confirmed from HEAD as ironsight-aaa. All writes stay within apps/ironsight/**;
no git commands, commit, push, deployment, SDK edit or dependency added. Worker
build is the existing dry-run only. No Meshy credits spent (1530 remain): this
pass needs surface data rather than a new mesh; the weak cable drum stays rejected.

The supervisor's ended-room report took precedence. Reviewed the Session 10
simulation-retention/dormancy fix, onRestore, bot fill and lifecycle tests; all
three real-core restoration tests pass (.inspect/session14-lifecycle.log). They
already cold-restore an ended serialized snapshot with immediate reconnect or
alarm-before-join and assert four-seat fill, warmup -> live, bot movement and
queued authoritative input. Repeated warm empty reuse asserts no duplicate ticks.
Retained this covered fix; no new defect reproduced or speculative server change.
Session 12's natural-ended persisted-snapshot proof remains the stronger local
ended-match evidence; this session's two standard probes are recorded below.

Delivered the top visual gap: concrete material response on Relay's broad walls,
pale trim, ramps, floor and exterior apron. Two original deterministic 128px data
textures supply periodic aggregate normals and roughness; shared across eight
meshes, linear data color space, repeat wrapping, mipmaps and anisotropy 4. Normal
strength is 0.2 on concrete and 0.12 on trim/ramps/ground. Fine relief catches the
existing daylight while retaining flat steel and readable paint/signs. This is a
restrained surface pass, not finished environmental weathering or AAA acceptance.

The separate metric uv2 channel has a 0.8m repeat. Existing paint/AO UVs, vertex
positions/normals, triangle indices and original GLB bytes stay unchanged. Material
work runs after Relay architecture load, before production renderer preparation;
no extra light/pass, shader injection or per-frame generation. Standard Three.js
normal/roughness shader variants are warmed during preparation. Other maps and
the failed-load fallback allocate no detail textures. No collider, authority,
state/schema, movement, hit, bot difficulty or purchased-derivative change.

Two added tests verify transformed-face metric scale, preserved position/normal/
paint/AO data, shared texture ownership and the small mip-storage budget. Inspector
reports eight detailed meshes/two shared textures/valid UVs, checks presence and
rejects allocation on other maps. Provenance and repeatable build/inspection command
are in public/assets/README.md; there is no new downloaded bitmap to allowlist.

Final code gates: pnpm typecheck, pnpm test, pnpm build:client, pnpm build (Worker
dry-run), pnpm audit:assets PASS. Tests: 316 passed, 3 existing opt-in skips;
32 passing files plus one skipped. Worker unchanged: 235.27 KiB / gzip 69.94 KiB.
Logs: .inspect/session14-{typecheck,test,build-client,worker-build,audit-assets}.log.
Assets 12,171,501 -> 12,172,815 bytes (+1,314 provenance text; binary asset delta 0).
Public 18,129,162 -> 18,144,823 bytes (+15,661 including client/source map); largest
file 4,145,029 bytes. The 40 MiB public and 25 MiB per-file caps pass.

Before/after evidence: .inspect/session14-before-report.json and
session14-final-report.json, matching relay/cooling/freight/spawn/effects-stress
PNGs, plus session14-delta.json. Final includes the required Undertow practice boot
and Undertow effects stress: seven views, zero console/runtime/HTTP errors, zero
forbidden offline requests, both effects resource gates PASS. Opened baseline,
intermediate and final Relay, final Cooling/Freight and Undertow practice captures.

Edge 152.0.4191.66 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Each final effects
fixture: eleven remote operators plus local rifle/hands, 145 twelve-rifle volleys,
96 blasts in 15 seconds, 2,130 steady samples, zero residual blasts/tracers.

| Relay metric | Before | Final | Delta |
|---|---:|---:|---:|
| Eye-level calls / triangles | 21 / 27,178 | 21 / 27,178 | 0 / 0 |
| Stress peak calls / triangles | 219 / 87,758 | 219 / 87,758 | 0 / 0 |
| Stress textures / estimated MiB | 28 / 63.585 | 30 / 63.751 | +2 / +0.167 |
| Stress median / p95 / p99 ms | 6.9 / 7.1 / 7.2 | 6.9 / 7.1 / 7.1 | 0.0 / 0.0 / -0.1 |
| Stress max / first-ready max ms | 7.3 / 7.1 | 7.4 / 7.1 | +0.1 / 0.0 |

Texture headroom is now 0.249 MiB. These desktop rAF intervals and allocation
estimates do not establish GPU timing, laptop iGPU/thermal performance, cold-driver
behavior or multiplayer capacity. No controlled loading-time improvement claimed.
Next default: exterior ground continuity and larger-scale grounded wear using
existing atlases/geometry; re-budget before further texture additions.

Rejected intermediate: session14-detail used normal strength 0.55 everywhere;
near walls looked like coarse stucco and trim was over-textured. Reduced to the
surface-specific values above before final gates/captures. Typecheck initially
caught a nullable data array in the new test; added the explicit assertion/guard
and reran all code gates. No browser gate thresholds were relaxed. Local workerd
logged tick-backlog warnings, retained in session14-final-server-error.log; final
browser results are functional evidence, not local multi-room capacity evidence.

Open owner questions, nonblocking: does the restrained concrete finish suit the
stylized kit (default: retain it), and should environmental continuity precede
another prop (default: ground/exterior continuity within current textures). Keep
industrial daylight, amber/teal, stylized sci-fi and 6v6 TDM. Human grip/audio/route
review, representative hardware, real 6v6/RTT and deployed DO eviction acceptance
remain open. No approval requested; supervisor owns publication.

Both required 150000-ms maximum TDM hitch probes PASS on the same fixed arena-tdm
room/server. The second started 81.042 seconds after the first report, allowing
the first human seat to expire. No durable-state clearing, isolated room ID,
server restart, build or asset write between probes. The preflight restart after
final asset/build writes also retained the existing .wrangler/state. This tests
local cold startup and empty reuse; the existing tests cover ended snapshots.
It does not repeat Session 12's natural five-minute match or establish deployed
Cloudflare eviction acceptance.

| Accepted TDM probe | First | Reuse after expiry |
|---|---:|---:|
| Initial population | 1 human + 3 bots | 1 human + 3 bots |
| Warmup -> live after measurement starts | 7.103 s | 6.887 s |
| Deaths / respawns | 2 / 2 | 3 / 2 |
| Maximum recorded frame | 49.8 ms | 71.9 ms |
| Recompiles / >150 ms frames / console errors | 0 / 0 / 0 | 0 / 0 / 0 |

Reports/logs: .inspect/session14-hitch-{first,second}.{json,log},
session14-lifecycle-probes.json and session14-reuse-start.json. Required
.inspect/hitch.json is the second accepted run. Its third death occurred during
the six-second observation after the second death; only two respawns were seen.
All required checks remain green, with only the three pre-existing opt-in skips.

Cleanup verified in .inspect/session14-cleanup.json: all twelve final-server
root/descendant processes stopped, zero remaining owned processes, zero port-8796
listeners and zero inspection browsers. The eleven-process preflight tree also
remains stopped. Durable state is preserved. All temporary evidence is under
ignored .inspect; ready for supervisor review/publication, no commit/push/deploy.

### Session 15 - 2026-09-08: restore exterior ground and connect Relay to its surroundings

Read the standing brief, Session 15 status and plan in order. Branch confirmed
from HEAD as ironsight-aaa. Changes stay within apps/ironsight/**; no git commands,
commit, push, deployment, SDK edits or dependencies. Worker build was its existing
dry-run. No Meshy credits spent (1530 remain): this pass needed ground geometry,
not a generated prop. The weak cable drum remains rejected.

The supervisor's persisted-ended-room concern took precedence. Reviewed onRestore,
dormancy/simulation retention, bot fill and warmup; all three Session 10 lifecycle
regressions pass (.inspect/session15-lifecycle.log). They cold-restore serialized
ended state through the real core with immediate reconnect or alarm-before-join,
then assert four-seat bot fill, warmup -> live, bot movement and queued input.
Repeated empty reuse also checks no duplicate ticks. Retained the covered fix;
no new lifecycle defect was reproduced or speculative server change made.

Delivered the selected environment gap: exterior ground continuity. The first
before/after capture exposed why the site looked suspended in sky: architecture
replacement selected every untextured standard-material mesh, including the apron,
and disposed it even though bakeOnly never exports ground. All three maps now tag
site ground explicitly and exclude it from architecture selection. Their original
ground receives the existing cached shadows again. No baked GLB was changed.

Relay's restored apron is one original vertex-colored mesh: slab joints, flush
machinery pads under the uplinks/mast, a service road with center dashes, and four
broad skirt faces extending past the existing 145 m fog end. All 2,528 triangles
are flat at y=-0.03, outside the 60 x 40 m playable floor. Disjoint rectangles avoid
coplanar overlap; nothing creates cover, a curb or a new route. Undertow/Switchyard
keep their existing 180 x 160 m apron geometry/material. Relay extends to 480 x
440 m and shares its existing concrete detail pair. No added texture, light, pass,
per-frame bake, collision, movement, state/schema, bot or hit-validation change.

Subtle pour-to-pour aging is painted once into Relay's existing 512px floor atlas;
its resolution, AO mapping and paint remain intact. Refreshed the deployment vista
from the production renderer. Provenance/reproduction is in public/assets/README.md.
New tests check that ground survives architecture selection and that apron data
is finite, upward-facing, below ground, within triangle budget and covers the
exterior without entering playable space. Inspector now checks both ground meshes
after loading, their visibility, height, extent and triangle budget on every map.

Final gates: pnpm typecheck, pnpm test, pnpm build:client, pnpm build (Worker
dry-run), pnpm audit:assets, required relay/practice-two inspection and both
150000-ms maximum TDM hitch probes PASS. Tests: 318 passed, 3 existing opt-in skips;
33 passing files plus one skipped. Worker unchanged: 235.27 KiB / gzip 69.94 KiB.
Logs: .inspect/session15-{typecheck,test,build-client,worker-build,audit-assets,
final-inspector}.log. Assets 12,172,815 -> 12,175,155 bytes (+2,340, provenance and
refreshed vista); public 18,144,823 -> 18,160,264 (+15,441); largest file 4,154,030
bytes. No new downloaded GLB/bitmap textures. Both asset caps pass.

Before/after evidence: session15-before-report.json and session15-final-report.json,
matching relay/cooling/vista/effects-stress PNGs, session15-delta.json and
session15-evidence.json. The dedicated exterior baseline is
session15-before-exterior-{report.json,exterior.png}; compare final-exterior.png.
Final report has nine views, including real Undertow training, all three effects
workloads and the refreshed menu: zero console/runtime/HTTP errors or forbidden
offline requests. Opened matching exterior/vista images, final Relay, Undertow
training and menu. These are inspected engineering captures, not owner approval.

Edge 152.0.4191.66 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Each effects
fixture: eleven remote operators plus local hands/rifle, 145 twelve-rifle volleys,
96 blasts over 15 seconds, 2,130 steady samples, zero remaining blasts/tracers.

| Relay metric | Before | Final | Delta |
|---|---:|---:|---:|
| Eye-level calls / triangles | 21 / 27,178 | 22 / 29,706 | +1 / +2,528 |
| Stress peak calls / triangles | 219 / 87,758 | 220 / 90,286 | +1 / +2,528 |
| Stress textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Stress median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0.0 / 0.0 / 0.0 |
| Stress max / first-ready max ms | 7.7 / 7.1 | 7.5 / 7.1 | -0.2 / 0.0 |

Undertow/Switchyard restored aprons each add one draw and two triangles. Final
stress peaks: 217 / 215 calls, 76,456 / 89,014 triangles, 60.251 / 61.585 MiB;
all resource gates pass. Relay texture headroom remains 0.249 MiB. Desktop rAF
intervals and texture estimates do not establish GPU timings, mid-laptop iGPU,
thermal, cold-driver or real 6v6 acceptance; no controlled speedup is claimed.

Both standard TDM probes used fixed arena-tdm on the same server. The second
started 73.563 seconds after the first report, allowing the old human seat to
expire. No state clearing, room isolation, server restart, build or asset write
between them. Preflight restart after final asset writes preserved .wrangler/state.

| Accepted TDM probe | First | Reuse after expiry |
|---|---:|---:|
| Initial population | 1 human + 3 bots | 1 human + 3 bots |
| Warmup -> live after measurement starts | 7.132 s | 7.404 s |
| Deaths / respawns | 2 / 2 | 3 / 2 |
| Maximum recorded frame | 54.0 ms | 58.8 ms |
| Recompiles / >150 ms frames / console errors | 0 / 0 / 0 | 0 / 0 / 0 |

Reports/logs: session15-hitch-{first,second}.{json,log}, session15-reuse-start.json
and session15-lifecycle-probes.json. Required .inspect/hitch.json is the second
accepted run. Its third death occurred during the post-second-death observation;
two respawns were seen. This rechecks local startup/empty reuse. Session 12's
natural ended snapshot remains stronger ended-match evidence; real deployed DO
eviction is still a supervisor gate, not inferred from local workerd.

Rejected intermediates: session15-detail showed no exterior change because the
new apron was removed by architecture loading; fixed the selection. Then
session15-ground revealed a hard outer plane edge, so extended Relay's four skirt
faces beyond the fog horizon. Session15-horizon refreshed the vista; only the
post-restart session15-final is final browser acceptance. No assertion or threshold
was relaxed. Existing local workerd tick-backlog warnings are retained in the
server log; these browser checks are not local capacity/latency evidence.

Cleanup: session15-cleanup.json confirms all twelve final-server root/descendant
processes stopped, zero remaining owned processes/listeners/inspection browsers.
session15-preflight-cleanup.json records the earlier eleven-process tree stopped.
Durable state remains preserved. All temporary evidence is under ignored .inspect.

Re-ranked the gap list: next default is first-person sleeve/glove silhouette and
moving reload/contact review, followed by larger-scale environment wear. Open
owner questions remain nonblocking: does the grounded service-site treatment fit
Relay (default: retain it), and should weapon finish now precede more environment
detail (default: yes). Keep industrial daylight, amber/teal, stylized sci-fi and
6v6 TDM. Human play/audio/animation, target hardware, real RTT and deployed eviction
acceptance remain open. Ready for supervisor review/publication; no commit/push/deploy.


### Session 16 - 2026-09-08: close the join-during-disposal arena recovery gap

Read the standing brief, Session 16 supervisor status and plan in order. Branch
confirmed from HEAD as ironsight-aaa. Scope apps/ironsight/** only; no git commands,
commit, push, deployment, SDK edit or dependencies. Worker build is the existing
dry-run. No Meshy credits spent (1530 remain): the supervisor's persisted-room
failure explicitly outranks art. The rejected cable drum remains unused.

Reproduced a previously uncovered lifetime ordering: after an ended snapshot is
cold-restored, an alarm expires its last seat. The core stops simulation before
awaiting durable deletion and calling onDispose. A join during that await sees
dormant=false, so onJoin cannot restart the loop. The later onDispose then leaves
an occupied room dormant. Before the fix, the added real-core regression fails
with exactly one player instead of four; phase stays warmup and bots never fill.
Evidence: .inspect/session16-lifecycle-before.log. This demonstrates an ordering
gap in the current app fix; it does not establish that this exact ordering caused
the supervisor's older preview observation or bypasses Cloudflare input gates.

Extracted the existing guarded resume path into resumeArena. onJoin still uses
it; onDispose now also resumes when core clientCount shows a new seated human.
Bot/runtime cleanup and a fresh safe round remain the empty-room policy. An
actually empty room remains stopped. The retained preset callback preserves
queued input draining, lag-history recording and authoritative state flushes.
No extra polling/watchdog, competing loop, client state authority, collision,
codec/version, hit rule or renderer changes.

Expanded arena-lifecycle.test.ts with the delayed durable-delete scenario on a
serialized ended snapshot. The existing immediate reconnect and alarm-before-join
cases remain, and all three now assert exactly ten ticks over ten intervals in
addition to four-seat fill, warmup -> live, bot movement and queued ammo sync.
Repeated warm empty-instance reuse still checks dormancy and duplicate timers.
The new regression failed before the source change and passes after it; all four
lifecycle tests pass. The initial waitFor-based test synchronization advanced fake
time unnecessarily; replaced it with an explicit storage-entry promise before
final gates. No production timer or assertion threshold was relaxed.

Code gates PASS: pnpm typecheck, pnpm test (319 passed, 3 existing opt-in skips;
33 passing files and one skipped), pnpm build:client, pnpm build (dry-run),
pnpm audit:assets. Logs: .inspect/session16-{typecheck,test,build-client,build,
audit-assets}.log. Worker 235.27 -> 235.35 KiB (+0.08 KiB), gzip 69.94 -> 69.96 KiB.
Asset/public bytes unchanged: 12,175,155 / 18,160,264; largest file 4,154,030 bytes.
Both the 40 MiB public and 25 MiB per-file caps pass. No asset/texture additions.

Required Relay and real Undertow practice inspection plus Relay effects stress
PASS, zero console/runtime/HTTP errors and forbidden offline requests. Opened
.inspect/session16-final-{relay,practice-two}.png; report and log use the same
prefix. Compare Session 15 final captures for the unchanged art baseline;
.inspect/session16-delta.json records the measured comparison. The behavior
before/after evidence for this session is the failing/passing lifecycle regression
and persisted-round drill, not an art improvement claim.

Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Relay eye-level remains
22 calls / 29,706 triangles. Stress (11 remote operators + local rifle/hands,
145 twelve-rifle volleys, 96 blasts, 2,130 steady samples) remains 220 peak calls /
90,286 triangles / 30 textures / estimated 63.751 MiB. Median/p95/p99/max remain
6.9/7.1/7.1/7.5 ms; first-ready max remains 7.1 ms. Deltas at reported precision:
0 calls, 0 triangles, 0 MiB, 0.0 ms. Effects drain completely. These desktop rAF
intervals and allocation estimates are not iGPU, thermal, GPU-timer or real 6v6
acceptance. Existing local workerd tick-backlog warnings remain in the server log.

The natural TDM round used the fixed arena-tdm room and its existing local state.
The normal 300-second live interval ended at red 19 / blue 39; probe saw 21 deaths
and 21 respawns, max recorded frame 60.3 ms, zero recompiles / >150 ms frames /
console errors. It waited 5.5 seconds in ended phase before exiting without a vote.
Stopped the owned server promptly, then read the durable SQLite snapshot read-only:
874 bytes, phase ended, stateVersion 4, four players and one human seat, matching
19/39 score. SHA-256 and database path are in session16-persisted-ended.json and
session16-persistence-source.json; raw snapshot stays ignored. Opened the natural
ended screenshot. Reports: .inspect/session16-natural.{json,log},
session16-natural-ended.png. No durable bytes were injected, replaced or cleared.

Restarted against that same .wrangler/state, then ran the exact required command
twice: node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json
--assert. Both PASS. The second launched 85.599 seconds after the first report,
allowing its seat to expire. No server restart, state clearing, isolated room,
build or asset writes between these accepted probes. First cold-start population
included the prior disconnected human seat plus the new human and two bots; by
the end its expired seat had been replaced by a third bot. Reuse began and ended
with one human plus three bots. This verifies both restored-seat expiry and bot
backfill without miscounting the temporarily held seat as an active human.

| Accepted TDM probe | Cold start from ended snapshot | Empty reuse |
|---|---:|---:|
| Warmup -> live after measurement starts | 7.484 s | 6.750 s |
| Deaths / observed respawns | 3 / 2 | 3 / 2 |
| Maximum recorded frame | 56.3 ms | 56.4 ms |
| Recompiles / >150 ms frames / console errors | 0 / 0 / 0 | 0 / 0 / 0 |

Each third death occurred during the post-second-death observation; only two
respawns were observed. Reports/logs: session16-hitch-{first,second}.{json,log},
session16-reuse-start.json and session16-lifecycle-probes.json. Required
.inspect/hitch.json is the second accepted run. This is local workerd persistence
and reuse evidence, not real deployed Cloudflare eviction or concurrency proof.

Cleanup: session16-preflight-cleanup.json and session16-cleanup.json confirm both
owned twelve-process server trees stopped, zero remaining owned processes,
port-8796 listeners or inspection browsers. Durable state is preserved. All final
gates are green; evidence remains under ignored .inspect. No commit/push/deploy.

Re-ranked the AAA gap list around this session's lifecycle priority and its new
regression. Next visual default remains first-person sleeve/glove silhouettes and
moving five-weapon reload/contact, then larger-scale environment wear. Open owner
questions are nonblocking: should weapon finish precede more environment detail
(default yes), and retain a fresh round after empty reuse/cold restore (default
yes). Keep industrial daylight, amber/teal, stylized sci-fi and 6v6 TDM. Human
grip/audio/route review, representative hardware, real RTT and deployed eviction
qualification remain open. No owner approval requested; supervisor owns publication.

### Session 17 - 2026-09-08: tailored first-person sleeves and padded gloves

Read the standing brief, Session 17 status and plan in order; confirmed
ironsight-aaa from HEAD. Scope apps/ironsight/** only. No git commands, commit,
push, deployment, dependencies, SDK or purchased-derivative changes. The Worker
build used its existing dry-run. Supervisor explicitly resolves the lifecycle
issue; no additional persistence investigation or duplicate reuse drill performed.
No Meshy credits spent (1530 remain): fitted procedural hand geometry is the
appropriate tool for this gap, and avoids a new textured prop within ~0.25 MiB
remaining texture headroom.

Selected the top weapon/operator gap. Replaced the six-sided straight forearm
tubes with original tapered oval cloth sections, asymmetric compression folds
and vertex-coloured reinforced panels. Rounded closed glove shapes now have
separate padded knuckle silhouettes and back-hand panels. A dark cuff with a thin
amber seam replaces the solid gold bracelet. Sleeve ends now reach the cuff using
the measured wrist/elbow length, avoiding the old proportional endpoint gap.
All six existing mesh draws remain; geometry is built only during construction.
No new textures, lights, passes or per-frame bakes. Existing five weapon wrist
fits, reload contacts, muzzle origins, authoritative reload timing, collision and
server hit rules remain unchanged. Provenance/reproduction: public/assets/README.md.

Added five offline moving reload fixtures: weapon-{ar,smg,shotgun,sniper,pistol}-cycle.
Each samples 181 normalized reload positions plus idle through the production
presentation path; the inspector asserts reach, extraction, insertion, charging,
return and idle were observed. These are deterministic sequential render samples,
not a real-time server-duration or human moving-animation acceptance claim.
Six new tests check finite/outward geometry, the six-draw/no-texture/triangle
budget, five-weapon wrist continuity, unchanged firing-hand anchors, cancellation
to idle, and stable geometry buffers throughout updates.

Code gates PASS: pnpm typecheck, pnpm test (325 passed, 3 existing opt-in skips;
34 passing files plus one skipped), pnpm build:client, pnpm build (dry-run),
pnpm audit:assets. Worker remains 235.35 KiB / gzip 69.96 KiB. Logs use
.inspect/session17-{typecheck,test,build-client,build,audit-assets}.log.
Asset bytes 12,175,155 -> 12,175,826 (+671, provenance only); public bytes
18,160,264 -> 18,184,742 (+24,478 including bundle/source map); largest file
4,170,048 bytes. Both file caps pass. No binary asset changes or new downloads.

Before/after evidence: .inspect/session17-before-report.json (eight views),
session17-final-report.json (33 views), matching PNGs and session17-delta.json.
Final captures cover required Relay/real Undertow practice, Relay effects stress,
all five weapon holds/ADS/extraction/insertion/charging poses and all five cycles.
Zero console/runtime/HTTP errors and zero forbidden offline requests. Opened the
baseline and tailored sniper extraction, AR and pistol holds, final shotgun hold,
sniper charging, AR ADS and Undertow gameplay. The first tailored geometry was
retained after review; no rejected art intermediate or failed gate was hidden.
The tailored captures precede the inspector extension; final captures are the
post-build acceptance set. No gate threshold was relaxed.

Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Matched Relay effects
workload: eleven remote operators plus local rifle/hands, 145 twelve-rifle volleys,
96 blasts, 2,130 steady samples; transient effects drain completely.

| Relay stress metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 90,286 | 220 / 93,190 | 0 / +2,904 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0.0 / 0.0 / 0.0 |
| Max / first-ready max ms | 7.2 / 7.1 | 7.2 / 7.1 | 0.0 / 0.0 |

Relay eye-level environment remains 22 calls / 29,706 triangles. Resource gates
pass unchanged. These desktop rAF intervals and allocation estimates do not
establish GPU timing, target iGPU, thermal/cold-driver or real 6v6 acceptance.
Existing local workerd tick-backlog warnings remain in the server log; no local
capacity claim is made.

Re-ranked the gap list: next default is remote hit/death and impact feedback,
then layered audio, ahead of another environment pass. Open owner questions are
nonblocking: retain this tailored cloth/padded glove direction (default yes), and
prioritize combat impact readability next (default yes). Human finger/contact,
reload motion, headphone mix and real play review remain open. Industrial daylight,
amber/teal, stylized sci-fi and 6v6 TDM remain the active defaults.

Required TDM hitch gate PASS with the exact 150000-ms maximum command and fixed
arena-tdm room. One human plus three bots; warmup -> live at 6.853 seconds,
two deaths and two observed respawns. Zero post-warmup shader recompiles, frames
over 150 ms, console errors or long tasks. The only recorded frame above 24 ms
was 69.1 ms at startup. Evidence: .inspect/hitch.json, session17-hitch.json and
session17-hitch.log. Preserved .wrangler/state; no room isolation or state clearing.
The server restart occurred after final asset/build writes, before final browser
gates. No redundant ended-room investigation was performed.

Cleanup: .inspect/session17-cleanup.json confirms all twelve final-server
root/descendant processes stopped, zero remaining owned processes, zero port-8796
listeners and zero inspection browsers. The earlier server tree was stopped in
session17-preflight-cleanup.json. All required final gates are green and evidence
stays under ignored .inspect. Ready for supervisor review; no commit/push/deploy.

### Session 18 - 2026-09-08: layered ballistic impact feedback

Read the standing brief, Session 18 supervisor status and plan in order; confirmed
ironsight-aaa from HEAD. Scope apps/ironsight/** only. No commit, push, deployment,
SDK edits, dependencies or purchased derivative changes. No Meshy credits spent
(1530 remain): transient ballistic effects fit existing procedural geometry.
The resolved lifecycle issue was not reopened.

Selected the impact portion of the top combat finish gap. Surface hits now have a
65 ms contact core, three thin ballistic sparks, and three slower expanding dust
fragments lasting 480 ms. Player impacts use five dark elongated droplets. Reuses
the same 48 pooled meshes/materials and existing sphere buffers. No new textures,
lights, passes or per-frame allocation/bakes. Position is evaluated from birth
position, velocity and absolute effect age, avoiding frame-cadence-dependent
ballistic paths. This remains presentation of existing server shot events; no
collision, hit authority, state/schema or remote animation rules changed.

Added the paired offline impact capture through the production renderer, with
surface/player bursts sampled shortly after emission. Before/after positions and
camera match; particle scatter remains random and capture age is frame-based,
so these are visual comparisons, not identical seeded particle trajectories.
Opened both impact captures and final Undertow gameplay. Evidence:
.inspect/session18-{before,final}-report.json, matching impact/effects-stress PNGs,
final-relay.png and final-practice-two.png; session18-delta.json records metrics.
All four final inspection views pass with zero console/runtime/HTTP errors and
zero forbidden offline network requests.

Three new tests cover pool saturation/expiry and stable geometry/light membership,
frame-cadence-independent positions, and separated core/spark/dust lifetime stages.
Tests: 328 passed, 3 existing opt-in skips (35 passing files, one skipped).
Initial typecheck rejected the browser VFX test under the server-only library;
excluded it from tsconfig.json and included it in tsconfig.client.json, following
the existing browser test convention. Final typecheck passes. No art iteration was
rejected and no gate threshold was relaxed. The before capture shows the former
uniform particle bursts; the final retains the first layered implementation.

Matched Relay effects stress: eleven remote operators plus local rifle/hands,
145 twelve-rifle volleys and 96 blasts, 2,130 steady samples, drained explosions
and tracers. Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 93,190 | 220 / 93,190 | 0 / 0 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0 / 0 / 0 |
| Max / first-ready max ms | 7.2 / 7.2 | 7.6 / 7.1 | +0.4 / -0.1 |

Desktop rAF intervals and allocation estimates do not establish GPU timing,
mid-laptop iGPU performance, cold-driver/thermal behavior or real 6v6 acceptance.
No performance improvement is claimed. Asset audit: 12,175,826 -> 12,176,452
bytes (+626, provenance); total public 18,184,742 -> 18,189,111 (+4,369);
largest file 4,172,617 bytes. Both public/per-file caps pass. No binary additions.
Reproduction/provenance is in public/assets/README.md.

Re-ranked gaps: remote hit/death presentation next, then layered weapon audio,
ahead of more environment detail. Open owner questions are nonblocking: retain
restrained dust and thinner sparks (default yes); prioritize remote reactions
next (default yes). Human impact readability, finger/contact, moving reload and
headphone mix approval remain open. Industrial daylight, amber/teal, stylized
sci-fi and 6v6 TDM remain active defaults.

All standing gates PASS: pnpm typecheck, pnpm test, pnpm build:client,
pnpm audit:assets, the exact required relay,practice-two inspection command,
and node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json
--assert. Code logs use .inspect/session18-{typecheck,test,build-client,audit-assets}.log;
exact browser gate log is session18-required-inspector.log. The extended final
inspector separately includes impact and effects-stress with --assert-budgets.

TDM: one human plus three bots, warmup -> live at 6.880 s, three deaths and two
observed respawns (third death during post-second-death observation). Zero shader
recompiles, >150 ms spikes, console errors or long tasks. Reports are .inspect/hitch.json
and session18-hitch.json; log session18-hitch.log. Preserved .wrangler/state;
no room isolation, clearing or redundant lifecycle drill. Restarted owned preview
after final client writes before browser acceptance; no builds overlapped combat.

Cleanup: session18-preflight-cleanup.json and session18-cleanup.json record the
owned server trees stopped. Final twelve-process tree: zero remaining processes,
port-8796 listeners or inspection browsers. Evidence remains ignored under .inspect.
Ready for supervisor review/publication; no commit/push/deploy.


### Session 19 - 2026-09-08: layered remote reactions and grounded complete deaths

Read the standing brief, Session 19 supervisor status and plan in order; confirmed
ironsight-aaa from HEAD. Scope apps/ironsight/** only. No commit, push, deployment,
SDK edit, dependencies or purchased asset changes. The resolved lifecycle issue
was not reopened. No Meshy credits spent (1530 remain): this animation gap uses
the existing private clips and needs no new bitmap or model assets.

Selected the top remote combat presentation gap. Full-body hit clips previously
interrupted locomotion, pulled crouched operators upright and dropped the support
hand off the weapon. The client now constructs cached additive views containing
only spine/neck/head rotation tracks, relative to the source clip's opening pose.
Hits blend in over 35 ms at 70% strength and out over the final 90 ms; locomotion,
crouch, the current weapon hold, aim and reload continue underneath. Repeated hits
restart one layer instead of accumulating, and death/respawn cancel it. Server shot
events remain the sole hit-reaction trigger. No collision, hit validation, schema,
movement or room changes; private source clips/geometry/textures remain immutable.

The inherited death clip lasts 2.4 seconds but was hidden after 1.2 seconds. It now
finishes and holds the settled pose for 250 ms, bounded to 3 seconds and cancelled
by authoritative respawn. Review rejected the first complete fall because its source
root offset left the body floating: head joint Y was 0.901 m at 2.5 seconds. A fixed
set of existing support joints now anchors the death pose to the player's floor;
accepted head Y is 0.197 m and lowest support Y is 0.100 m (mesh clearance). The
anchor resets before each sample, preventing accumulated corrections. No ragdoll,
vertex scan, geometry bake, new textures, lights or rendering passes.

Evidence: .inspect/session19-before-report.json and paired reaction-{body,head,
crouch,death} PNGs; session19-review-*; session19-ungrounded-report.json and
session19-ungrounded-reaction-death.png preserve the rejected floating body.
Accepted .inspect/session19-final-report.json and matching PNGs cover all four
fixed-time production reaction samples, required Relay/real Undertow practice and
Relay effects stress. Opened baseline/body/crouch, layered body/crouch, rejected and
grounded death, and final Undertow gameplay captures. Hit samples are at 120 ms;
death sample is at 2500 ms, advanced in 10 ms steps through the production path.
These are reproducible pose samples, not human moving-animation acceptance. The
initial diagnostic iteration used wall-clock hit deadlines with a fixed sample
clock; corrected the fixture clock and recaptured the baseline before art edits.
Final fixture samples once after readiness, then renders the frozen result.

Six new tests cover crouch/root/hand preservation, changing locomotion during a
reaction and recovery to that current state, rapid-hit bounds, distinct headshots,
death/respawn cancellation, source immutability/instance isolation, full death hold,
and transformed support-joint sampling. Final pnpm typecheck, pnpm test (334 passed,
3 existing opt-in skips; 35 passing files and one skipped), pnpm build:client and
pnpm audit:assets PASS. Logs: .inspect/session19-{typecheck,test,build-client,
audit-assets}.log. No gate threshold was relaxed. Provenance and reproduction:
public/assets/README.md. No binary asset changes or additional downloads.

Matched Relay effects stress: eleven remote operators plus local rifle/hands,
145 twelve-rifle volleys, 96 blasts; effects drain completely. Edge 152 / RTX 5070
Direct3D11 at 1920x1080 balanced/DPR 1. .inspect/session19-delta.json records:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 93,190 | 220 / 93,190 | 0 / 0 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.0 / 7.1 | 0 / -0.1 / 0 |
| Max / first-ready max ms | 7.2 / 7.1 | 7.8 / 7.1 | +0.6 / 0 |

Relay eye-level remains 22 calls / 29,706 triangles. The corpse sample now submits
four existing actor/weapon draws that the old prematurely hidden sample omitted;
no new mesh resources are allocated. Desktop rAF intervals and allocation estimates
do not establish target iGPU, GPU timing, thermal/cold-driver or real 6v6 acceptance.
No performance improvement is claimed. Asset bytes 12,176,452 -> 12,177,465 (+1,013,
provenance); public bytes 18,189,111 -> 18,209,916 (+20,805); largest file 4,181,975
bytes. The 40 MiB total / 25 MiB per-file caps pass; texture headroom remains tight.

The exact required relay,practice-two inspector and the seven-view extended final
inspector with --assert-budgets PASS, zero console/runtime/HTTP errors and forbidden
offline network requests. Logs: session19-required-inspector.log and session19-final.log.
Restarted the owned server after final bundle/asset writes before browser acceptance;
preserved .wrangler/state and the fixed arena-tdm room. No lifecycle re-proving,
room isolation or state clearing. Preflight/review cleanup reports preserve owned
server process-tree shutdowns. A combined restart/gates shell call was rejected by
execution policy; separate cleanup, launch and gate calls succeeded without escalation.

Re-ranked gaps: layered weapon audio next, ahead of another environment pass.
Nonblocking owner questions: retain restrained upper-body reactions that preserve
stance/hold (default yes); prioritize weapon audio next (default yes). Human finger
contact, moving reload/reaction/death, headphone mix and real combat approval remain
open. Industrial daylight, amber/teal, stylized sci-fi and 6v6 TDM remain active defaults.


Required live gate PASS with the exact command:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human plus three bots; warmup -> live at 7.921 s, three deaths and three observed
respawns. Zero post-warmup shader recompiles, frames >150 ms, console errors or long
tasks. The sole frame above 24 ms was the initial 84.7 ms frame. Evidence:
.inspect/hitch.json, session19-hitch.json and session19-hitch.log. Existing local
workerd tick-backlog warnings remain in the server log; no capacity claim is made.

Cleanup: .inspect/session19-cleanup.json confirms all twelve final-server process
tree members stopped; zero remaining owned processes, port-8796 listeners or
inspection browsers. Final code, asset, required/extended inspection and live hitch
gates are green. Evidence stays ignored under .inspect. Ready for supervisor review;
no commit/push/deploy.


### Session 20 - 2026-09-08: layered five-weapon audio and bounded volley output

Read the standing brief, Session 20 status and plan in order; confirmed
ironsight-aaa from HEAD. Scope apps/ironsight/** only; no git commands, commit,
push, deployment, new dependencies, SDK or purchased-derivative edits. Worker
build uses its existing dry-run only. No Meshy credits spent (1530 remain):
this session's top gap is synthesized audio, so no model or bitmap asset is needed.
The resolved lifecycle issue was not reopened.

Added original cached synthesis in client/weapon-sound.ts. Each of the five guns
has a mechanical snap, ballistic crack/body and diffuse filtered outdoor decay,
with two quiet reflections and three deterministic variants. AR/SMG/shotgun/
sniper/pistol tails last 320/220/460/580/270 ms. Existing configured frequency,
body pitch, attack duration and gain still shape each gun. Samples are generated
once on AudioContext creation; firing chooses an existing buffer and allocates
one source instead of a source/filter/two gains/oscillator graph. Entire tails
share the existing spatial bus and release its remote voice on completion.
No gameplay events, hit authority, render resources, lights or passes changed.

The old master compressor overshot unity on twenty synchronized remote shots
(measured baseline peak 1.077747). The first layered candidate also failed this
new stress assertion, so it was rejected. Added one static master safety knee,
linear below 0.8, after the compressor; accepted stress peak is 0.920745.
Ordinary measured local peaks remain below 0.51, beneath the safety knee.
This is a peak bound, not a loudness/comfort certification. No standing gate
threshold was relaxed. The inspector's explicit --baseline option records old
over-range peaks; final acceptance ran without it. Initial endpoint tests also
rejected IEEE negative zero; corrected the assertion to compare absolute silence.
An initial inspector-authoring command hit a Windows text-encoding error and
was replaced with explicit UTF-8 file handling before baseline capture.

Audio evidence: .inspect/session20-audio-{before,final}-report.json and paired
local-{0,1,2,3,4}.wav captures. Final has eleven WAVs: all five weapons, remote
pan, 25 attempted remote voices (20 admitted), voice recovery (40 admitted across
two waves), local priority despite saturated remote voices, mute and volume zero.
Every transient source ends; only the intentional ambient loop remains. Mute and
volume-zero measured peak are zero. Remote right energy exceeds left as expected.
A/B playback page: .inspect/session20-audio-review.html. These capture the production
Web Audio graph in Edge OfflineAudioContext, including master processing/ambience.
Baseline noise and ambience are random, so WAVs are not identical seeded workloads.
The after shot buffers are deterministic. No human listening acceptance is claimed.

At 48 kHz cached AudioBuffer storage rises 864,000 -> 1,929,600 bytes (+1,065,600,
1.016 MiB) across noise, ambience and the fifteen shot variants. The safety curve
adds 8,196 bytes; transient synthesis scratch arrays are reclaimable. Offline
initialization plus scheduling measured about 2-4 ms before and 19-22 ms after;
this moves work to the first audio gesture, not a per-shot bake. Device output
latency and lower-end startup cost remain unqualified. The longer tails share
rather than raise the existing 20-remote-voice cap; dense matches can drop excess
remote cues, and local fire/confirmation remain independent. Keep this in the
real 6v6 listening review rather than claiming unlimited audible combat sources.

Three new tests cover finite/bounded waveforms and zero endpoints at 44.1/48/96 kHz,
distinct tail lengths and bounded late energy, reproducible independent variants,
and cached PCM/tail budgets. pnpm typecheck PASS; pnpm test PASS (337 passed,
3 existing opt-in skips; 36 passing files, one skipped); pnpm build:client PASS;
pnpm build PASS (dry-run 235.35 KiB / gzip 69.96 KiB); pnpm audit:assets PASS.
Logs: .inspect/session20-{typecheck,test,build-client,build,audit-assets}.log.
Provenance/reproduction: public/assets/README.md. No new binary downloads.
Asset bytes 12,177,465 -> 12,178,645 (+1,180, provenance); public bytes
18,209,916 -> 18,217,874 (+7,958); largest file 4,186,622 bytes. Public 40 MiB
and per-file 25 MiB caps pass.

Before/after visual evidence: .inspect/session20-{before,final}-report.json,
paired Relay/effects-stress PNGs and final-practice-two.png. Opened before/final
Relay and final real Undertow gameplay; presentation remains visually stable.
The exact required relay,practice-two inspector and extended final inspector
with --assert-budgets both PASS, zero console/runtime/HTTP errors or forbidden
offline network requests. Logs: session20-required-inspector.log, session20-final.log.
Delta artifact: .inspect/session20-delta.json, including audio and byte measurements.

Matched Relay effects workload: eleven remote operators plus local rifle/hands,
145 twelve-rifle volleys, 96 blasts, 2,130 steady samples; transient effects drain.
Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 93,190 | 220 / 93,190 | 0 / 0 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0 / 0 / 0 |
| Max / first-ready max ms | 7.2 / 7.1 | 7.3 / 7.0 | +0.1 / -0.1 |

This rendering fixture does not exercise the full audio workload. Offline audio
checks separately exercise the production sound graph; live TDM exercises normal
combat. Desktop rAF/allocation figures are not GPU timing, mid-laptop iGPU,
thermal/cold-driver or real 6v6 acceptance. No performance improvement is claimed.

Required live gate PASS with the exact command:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human plus three bots; warmup -> live at 7.031 s, three deaths and two observed
respawns (third death during post-second-death observation). Zero shader recompiles,
frames >150 ms, console errors or long tasks. Sole recorded frame above 24 ms:
69.6 ms at startup. Evidence: .inspect/hitch.json, session20-hitch.json and
session20-hitch.log. Restarted the owned server after final bundle/asset writes;
preserved .wrangler/state and fixed arena-tdm routing, without isolation or clearing.

Re-ranked the gap list: killfeed/confirmed elimination and combat presentation
next, then environment richness. Nonblocking owner questions: retain short outdoor
tails and restrained mechanical identities (default yes); prioritize combat HUD
next (default yes). Headphone mix, moving animation and real-play approval remain
open. Industrial daylight, amber/teal, stylized sci-fi and 6v6 TDM remain defaults.

Cleanup: .inspect/session20-preflight-cleanup.json and session20-cleanup.json
confirm owned preview trees stopped, zero remaining owned processes, port-8796
listeners or inspection browsers. All final code, asset, required/extended browser,
audio and live hitch checks are green. Evidence remains ignored under .inspect.
Ready for supervisor review/publication; no commit/push/deploy.


### Session 21 - 2026-09-08: attributed combat feed and confirmed elimination HUD

Read standing brief, Session 21 status and plan in order; confirmed ironsight-aaa
from .git/HEAD. Scope apps/ironsight/** only; no git commands, commit, push,
deployment, dependencies or purchased asset edits. No Meshy credits spent (1530
remain): this DOM presentation gap needs no generated model. Lifecycle recovery
was not reopened, and local .wrangler/state was preserved.

Completed the top killfeed/confirmed-elimination portion of the combat HUD gap.
Feed rows now align killer, weapon/cause and victim, retain assist attribution,
use the brighter existing team text palette and mark local involvement with YOU.
Amber highlights local kills; self deaths never award a confirmation. Newest rows
appear first; the five-row cap and five-second expiry remain. Fixed the inherited
feed container's missing absolute positioning so its intended margins apply.
Compact view constrains feed height above the aiming area. Names remain escaped
and visually truncate. A local confirmed kill displays the latest victim and
weapon below the crosshair for 1.8 seconds (last 300 ms fade), on a restrained dark
backing; one polite status region announces it. Repeated kills replace the notice.
Game reduced-motion and OS preference disable feed translation; no new lights,
textures, passes, geometry or runtime bakes.

The server kill event now includes the killing weapon's existing one-based slot
from damage resolution. The client resolves by slot, never by array index/current
equipment; grenade events use BLAST/GRENADE, and absent/unknown slots fall back to
WEAPON. Field is optional client-side for older room events. No state codec,
snapshot shape/version, damage, collision or input-validation changes. Two existing
room combat tests now assert authoritative AR and shotgun kill attribution.

Evidence: .inspect/session21-before-report.json and paired match-combat,
match-combat-mobile, relay and effects-stress PNGs. Review captures are preserved
under session21-review-*. Rejected the first compact layout crossing the aiming
area and the unbacked notice over bright concrete; final placement/backing accepted.
A Python edit initially failed on Windows default text encoding; another used the
wrong working-directory prefix. Both failed before writes and were rerun correctly.
No gate threshold relaxed. Final report/captures: session21-final-report.json and
session21-final-{match-combat,match-combat-mobile,match-combat-reduced,relay,
practice-two,effects-stress}.png. Opened baseline, first desktop/compact candidates,
final desktop/compact, and final real Undertow practice. UI fixtures freeze the
production HUD over an existing vista; they are not live human play captures.

Each final combat fixture checks pool bounds, HTML escaping, no remote/self-kill
confirmation, latest-kill replacement, confirmation/feed expiry and the in-game
reduced-motion animation disable. All checks pass with zero browser errors or
forbidden offline gameplay network requests. OS media-query support is implemented;
no separate OS accessibility or screen-reader acceptance is claimed.

Final pnpm typecheck, pnpm test (337 passed, 3 existing opt-in skips; 36 passing
files and one skipped), pnpm build:client and pnpm audit:assets PASS. Logs:
.inspect/session21-{typecheck,test,build-client,audit-assets}.log. Exact required
relay,practice-two inspector PASS (.inspect/session21-required-inspector.log).
Extended six-view inspector with --assert-budgets PASS (session21-final.log).
Owned preview was restarted after final public writes before final browser gates.

Matched effects workload: eleven remote operators plus local rifle/hands, 145
12-rifle volleys and 96 blasts; transient effects drain. Edge 152 / RTX 5070
Direct3D11, 1920x1080 balanced/DPR 1. .inspect/session21-delta.json records:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 93,190 | 220 / 93,190 | 0 / 0 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.2 | 6.9 / 7.1 / 7.1 | 0 / 0 / -0.1 |
| Max / first-ready max ms | 7.5 / 7.1 | 7.2 / 7.1 | -0.3 / 0 |

The rendering fixture measures the unchanged WebGL workload, not dense DOM feed
updates. Live TDM separately exercises combat HUD events. Desktop rAF/allocation
estimates do not establish GPU timing, target iGPU, thermal/cold-driver or real
6v6 acceptance. No performance improvement claimed. Asset bytes 12,178,645 ->
12,179,418 (+773 provenance); public bytes 18,217,874 -> 18,231,553 (+13,679);
largest file 4,194,488 bytes. Public 40 MiB/per-file 25 MiB caps pass. No binary
asset additions. Provenance and reproduction: public/assets/README.md.

Re-ranked gaps: environment richness next, then scoreboard/results. Nonblocking
owner questions: retain 1.8-second local confirmation and newest-first feed
(default yes); next improve wall wear/roof service detail within existing texture
budget (default yes). Human HUD distraction/readability, headphone mix, moving
animation and real-play acceptance remain open. Industrial daylight, amber/teal,
stylized sci-fi and 6v6 TDM remain active defaults.


Required live gate PASS with the exact command:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human plus three bots, two deaths. Zero post-warmup shader recompiles,
frames >150 ms, console errors or long tasks; sole recorded frame above 24 ms
was 58.1 ms at startup. Evidence: .inspect/hitch.json, session21-hitch.json and
session21-hitch.log. No room isolation, storage clearing or extra lifecycle drill.

Cleanup: .inspect/session21-review-cleanup.json records the first owned preview
tree stopped. session21-cleanup.json confirms all twelve final preview process-tree
members stopped, zero remaining owned processes, port-8796 listeners or inspection
browsers. All standing final gates green; evidence remains ignored under .inspect.
Ready for supervisor review/publication. No commit, push or deployment.


### Session 22 - 2026-09-08: baked Relay wall weathering and roof service plates

Read standing brief, Session 22 status and plan in order; confirmed ironsight-aaa
from .git/HEAD. Scope apps/ironsight/** only. No git commands, commit, push,
deployment, dependencies, SDK or purchased-derivative edits. Worker build uses
the existing dry-run. No Meshy credits spent (1530 remain): this pass is original
surface treatment on exact collider-derived architecture. The resolved lifecycle
issue was not reopened, and local .wrangler/state was preserved.

Completed the top finishable environment item: Relay's broad concrete walls now
have baked mineral runoff below the parapets, softer damp shoulders and foundation
grime. tools/weather-architecture.py processes only the original concrete primitive,
subdividing flat surfaces offline and exporting linear vertex colors. The AO image,
all other materials and original normals remain intact; UVs/normals interpolate
over the same surfaces. No displacement, texture additions, runtime weather bake,
new lights, rendering passes, collision, movement, combat or schema changes.

Sixteen sealed roof hatches/vent plates reuse the existing service atlas and draw.
All sit 12 mm above the four service-house solids, within their horizontal bounds;
they add 32 triangles and no overhang or new implied machinery cover. Updated the
existing cladding test to verify upward normals and each complete roof envelope.
Its local geometry cap expands from 100 to 132 triangles for those sixteen plates;
standing render, asset and hitch thresholds remain unchanged. Updated the original
deployment vista to include the roof detail. Provenance and reproducible commands:
public/assets/README.md. Existing original-asset allowlists already cover both files.

Rejected intermediates: the first unshared 0.42 m subdivision export was 15,925,420
bytes / 112,988 concrete triangles, needlessly expensive even though within the
per-file cap. Shared vertices and a 0.7 m maximum edge reduce the concrete to
40,428 triangles / 22,996 vertices. The first in-map treatment was too faint below
the colored cornices, so extended/strengthened its runoff before final acceptance.
The compact visual export was 2,265,524 bytes; retained original-triangle audit
references add 81,096 bytes, giving the accepted 2,346,620-byte GLB. These references
are not render attributes. The tool refuses already-colored input to prevent
accidental repeated subdivision/weather accumulation; rerun from the original bake.

Extended scripts/audit-architecture.py to verify every new triangle against its
retained source: containment, winding, summed area, interpolated UVs and normals.
It then runs the existing exact oriented-triangle/normal comparison against the
procedural MapDef kit. All three maps pass. Relay's concrete bounds are identical;
surface area is 2291.7017511888844 -> 2291.701751189482 square metres (floating-point
roundoff). Evidence: .inspect/session22-weather.json, session22-geometry-audit.json
and session22-geometry-audit.log. Source/output SHA-256 values are recorded there.
The initial export and its report remain session22-weather-review.{glb,json}.

Visual evidence: .inspect/session22-before-report.json and paired relay/cooling/
overview/effects-stress PNGs. The first compact candidate is session22-review-*;
stronger art and refreshed vista are session22-art-*. Accepted final report and
six captures: session22-final-{relay,cooling,overview,vista,practice-two,effects-stress}.
Opened baseline Relay/Cooling, both candidate Relay views, candidate Cooling and
overview, final overview and real Undertow practice. These are production-renderer
fixtures; they do not establish human visual or full-match acceptance.

Final pnpm typecheck PASS; pnpm test PASS (337 passed, 3 existing opt-in skips;
36 passing files, one skipped); pnpm build:client PASS; pnpm build PASS (dry-run
235.39 KiB / gzip 69.97 KiB); pnpm audit:assets PASS. Logs under .inspect use
session22-{typecheck,test,build-client,build,audit-assets}.log. Exact required
relay,practice-two inspector PASS (session22-required-inspector.log), and the
six-view extended inspector with --assert-budgets PASS (session22-final.log).
Zero console/runtime/HTTP errors or forbidden offline gameplay network requests.
Restarted the owned preview after final public writes before these browser gates.

Matched effects workload: eleven remote operators plus local rifle/hands, 145
twelve-rifle volleys, 96 blasts, 2,130 steady samples; transient effects drain.
Edge 152 / RTX 5070 Direct3D11 at 1920x1080 balanced/DPR 1. Delta artifact:
.inspect/session22-delta.json.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 93,190 | 220 / 133,302 | 0 / +40,112 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Median / p95 / p99 ms | 6.9 / 7.0 / 7.1 | 6.9 / 7.0 / 7.1 | 0 / 0 / 0 |
| Max / first-ready max ms | 7.6 / 7.1 | 7.2 / 7.1 | -0.4 / 0 |
| Prepared shader programs | 26 | 27 | +1 vertex-color variant |

Relay eye-level remains 22 calls, now 69,818 triangles (+40,112). Vertex buffers
and downloaded bytes increase in exchange for no added texture allocation. Desktop
rAF intervals and allocation estimates do not establish GPU timing, target iGPU,
thermal/cold-driver or real 6v6 acceptance. No performance improvement is claimed.
Asset bytes 12,179,418 -> 13,526,417 (+1,346,999); public bytes 18,231,553 ->
19,579,911 (+1,348,358); largest file 4,195,441 bytes. The 40 MiB public / 25 MiB
per-file caps pass. Stress texture headroom remains about 0.25 MiB.

Re-ranked gaps: scoreboard/results hierarchy next, then richer Undertow/Switchyard
exteriors. Nonblocking owner questions: retain this restrained mineral-weathered
Relay treatment (default yes); prioritize scoreboard/results next (default yes).
Industrial daylight, amber/teal, stylized sci-fi and 6v6 TDM remain defaults.
Human visual, animation, headphone mix, hardware and real-play acceptance stay open.

Required live gate PASS with the exact command:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human plus three bots, warmup -> live at 7.275 seconds, two deaths and two
observed respawns. Zero post-warmup shader recompiles, frames >150 ms, console
errors or long tasks. Sole recorded frame above 24 ms: 71.3 ms at startup.
Evidence: .inspect/hitch.json, session22-hitch.json and session22-hitch.log. No
room isolation, storage clearing or extra lifecycle drill. Existing local workerd
tick-backlog warnings remain recorded; no local capacity claim is made.

Final generator check reproduces the shipped GLB byte-for-byte and confirms that
already-weathered input is rejected without a partial output. Evidence:
.inspect/session22-generator-check.json and session22-reproduced.json.

Cleanup: .inspect/session22-review-cleanup.json records the earlier owned preview
shutdown; session22-cleanup.json confirms all twelve final preview process-tree
members stopped, zero remaining owned processes, port-8796 listeners or inspection
browsers. All standing final gates and the strengthened architecture audit are
green. Evidence remains ignored under .inspect. Ready for supervisor review;
no commit, push or deployment.


### Session 23 - 2026-09-08: round debrief and readable final rosters

Read standing brief, Session 23 supervisor status and plan in order; confirmed
ironsight-aaa through .git/HEAD. Scope apps/ironsight/** only. No git commands,
commit, push, deployment, dependencies or purchased-asset edits. No Meshy credits
spent (1530 remain): this DOM presentation item needs no generated bitmap/model.
Local .wrangler/state was preserved and the resolved lifecycle issue was not reopened.

Reference: unavailable. `AAA-DESIGN-REFERENCE.md` is missing in this checkout;
an app search including hidden/ignored files found no copy. Added the explicit
reference-scorecard limitation above rather than inventing R-xx mappings. Concrete
plan-derived target: distinguish outcome, team totals and local contribution;
render all 12 fixture operators with a local marker; preserve vote/leave controls;
no horizontal overflow, reachable heading and actions at four viewport sizes.
The final production-HUD fixtures meet those checks. Canonical source compliance
and owner visual approval remain unclaimed.

The final round panel uses industrial teal/amber, a large victory/defeat/draw
heading, separate final team scores, three personal stats and two aligned team
tables (one for FFA). Rankings sort kills descending, deaths ascending, then name;
the local row has a text YOU tag plus amber emphasis. Zero deaths displays a dash
for the undefined K/D ratio. Names/winner text are escaped, long names truncate,
and semantic tables label K/D columns. Results use the existing server winner,
score event and replicated player stats; no rule, codec, state version or combat
changes. Current AOI spans the whole small arena. The roster is explicitly the
operators still in the room, not a historical ledger of departed players. Production
names use the existing client resolver; authored fixture names are review samples.

The rematch control receives focus on entering results; vote broadcasts preserve
focus/scroll, and a focused button becoming disabled moves focus to deployment.
Existing one-second R grace, vote behavior and automatic intermission remain.
No new animation, lights, textures, passes, geometry, sounds or runtime bakes.
The results are an opaque DOM overlay; narrow views stack tables and scroll.

Rejected intermediates: the first candidate passed desktop but the compact fixture
caught content-box padding exceeding the viewport. Added border-box sizing. Visual
review then caught a clipped heading on the tallest narrow panel despite reachable
actions; changed flex alignment and added an explicit heading-reachability check.
No gate thresholds were relaxed. Intermediate reports/screens remain under
.inspect/session23-review-* and session23-results-*.

Before evidence: .inspect/session23-before-{match-end,match-end-mobile,relay,
effects-stress}.png and session23-before-report.json. Accepted results evidence:
session23-final-results-report.json and eight PNGs (end, mobile, narrow, short,
defeat, draw, FFA, vote). Checks cover escaping, sorting/ties, exactly one local
row, zero-death ratio, initial/vote focus, disabled vote, draw and FFA presentation,
12-row completeness and heading/action reachability. Final report has zero errors
or forbidden offline gameplay requests. Opened before/after desktop, compact and
narrow captures and final real Undertow practice. Fixtures are not human playtests.

Final pnpm typecheck, pnpm test (337 passed, 3 existing opt-in skips; 36 passing
files, one skipped), pnpm build:client and pnpm audit:assets PASS. Logs use
.inspect/session23-{typecheck,test,build-client,audit-assets}.log. Exact required
relay,practice-two inspector PASS (session23-required-inspector.log); extended
Relay/practice-two/effects-stress inspector with --assert-budgets PASS
(session23-final.log and session23-final-report.json). Zero console/runtime/HTTP
errors or forbidden offline gameplay network requests. Owned preview was restarted
after final public bundle writes before the final browser gates.

Matched effects workload: eleven remote operators plus local rifle/hands, 145
twelve-rifle volleys, 96 blasts, 2,130 steady samples; transient effects drain.
Edge 152 / RTX 5070 Direct3D11, 1920x1080 balanced/DPR 1. Measured deltas in
.inspect/session23-delta.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 133,302 | 220 / 133,302 | 0 / 0 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0.000 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0 / 0 / 0 |
| Max / first-ready max ms | 7.2 / 7.1 | 7.2 / 7.2 | 0 / +0.1 |
| Prepared shader programs | 27 | 27 | 0 |

The unchanged WebGL fixture does not measure dense results DOM updates. Desktop
rAF/allocation estimates do not establish GPU timing, target iGPU, cold-driver,
thermal or real 6v6 acceptance. No performance improvement is claimed. Asset bytes
remain 13,526,417; public bytes 19,579,911 -> 19,603,121 (+23,210, bundled code
and source map). Largest public file 4,209,115 bytes. Public 40 MiB / per-file
25 MiB caps pass. No binary asset/provenance or allowlist additions are required.

Re-ranked gaps: Undertow/Switchyard exterior richness next, then solo encounter
variety. Nonblocking owner questions: keep this restrained debrief and full seated
roster (default yes); prioritize other-map exterior richness next (default yes).
Industrial daylight, amber/teal, stylized sci-fi and 6v6 TDM remain active defaults.
Human visual/animation/audio, browser/device and real-match acceptance stay open.

Required live gate PASS with the exact command:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human plus three bots; warmup -> live at 6.927 seconds, two deaths and two
observed respawns. Zero post-warmup shader recompiles, frames >150 ms, console
errors or long tasks. Sole recorded frame above 24 ms was 64.2 ms at startup.
Evidence: .inspect/hitch.json, session23-hitch.json and session23-hitch.log.
No room isolation, storage clearing or extra lifecycle drill. The probe finishes
during live play; results behavior is covered by the separate production-HUD fixtures.

Cleanup: .inspect/session23-cleanup.json confirms all twelve final preview process
tree members stopped, zero remaining owned processes, port-8796 listeners or
inspection browsers. Earlier preview trees were also stopped (the first cleanup's
one immediately lingering process was verified gone on the subsequent process read).
All standing final gates are green. Evidence remains ignored under .inspect.
Ready for supervisor review/publication; no commit, push or deployment.


### Session 24 - 2026-09-08: reference audit and authoritative incoming-damage cues

Read standing brief, Session 24 supervisor status, plan and the now-restored
AAA-DESIGN-REFERENCE.md. Confirmed ironsight-aaa from .git/HEAD. Scope remained
apps/ironsight/**; no git commands, commit, push, deployment, dependencies, SDK or
purchased-derivative edits. No Meshy credits spent (1530 remain): this combat HUD
pass benefits from original DOM/CSS, not a generated asset. Existing local room
storage was preserved; the resolved ended-room/lifecycle bug was not reopened.

First completed the canonical 63-row reference scorecard above, replacing the
Session23 missing-document placeholder. Re-ranked gaps from partial/not-yet rows
and selected incoming-damage direction ahead of exterior decoration: immediately
useful combat feedback, bounded enough to finish green this session.
Reference: R-L21, R-G12, R-L14. Concrete target: a server-confirmed victim-only
bearing plus brief flash/edge cue; four readable direction labels outside the
central aiming rectangle, no overlap with elimination confirmation at 1920x1080,
720x900, 390x844 and 1280x600; reduced motion suppresses the full-screen flash.
These implementation/fixture checks now pass. Human comfort/readability and weak
GPU acceptance remain open. This does not close the broader reload corridor or
all-settings gameplay-clarity references.

Immediate numeric audit (tools/reference-audit.ts bundles with existing esbuild;
reproduction command in its header; .inspect/session24-reference-audit.json):

| Check | Actual | Reference result |
|---|---|---|
| R-M03 cover classes | Relay 13 full/8 waist; Undertow 14/8; Switchyard 6/5 | All boxes classified; zero 1.5-1.6 m head-height cover |
| R-M04 A-B / B-C / A-C, walk seconds | Relay 3.00 / 1.33 / 4.33; Undertow 3.00 / 3.00 / 6.00; Switchyard 3.67 / 3.67 / 7.33 | Below 10-15 s target |
| R-M04 same routes, sprint seconds | Relay 2.00 / .89 / 2.89; Undertow 2.00 / 2.00 / 4.00; Switchyard 2.44 / 2.44 / 4.89 | Below target |
| R-M07 spawn-to-cap walk proxy | Relay 4.33-8.67 s; Undertow 2.67-9.67 s; Switchyard 2.33-10.67 s | Travel proxy, not first-contact timing |
| R-G19 ADS / sprint-to-fire, all five weapons | No authoritative ADS timer; no sprint recovery gate (0 ms); shared exponential visual ADS reaches 95% in 214 ms | Per-weapon reference timers absent |
| R-L02 mode economy | TDM 50 kills/300 s; DOM neutral capture 4 s, enemy-to-owned 8 s, 1 point/2 s/flag, target 200, no side swap | TDM score/DOM target match; other numeric targets differ |
| R-L04 respawn/scoring | 3000 ms live, 0 in warmup; enemy-distance/LOS scoring only Relay team modes | Timer met; other maps/FFA still rotate |
| R-G15 hit confirm | Body 900 Hz/head 1400 Hz, .28 gain; kill 660/990 Hz, .30 peak; bypasses remote 20-voice cap | Implemented; mix comfort not measured |
| R-G14 enemy/ally footsteps | 1.0 equal-distance ratio; common filtered noise tap; remote reload sound absent | Below 1.3-1.5 target |
| R-L20 feed | Top-right, five entries, killer/weapon/HEADSHOT text/victim, team colours, no objective events | Partial: location/icons/objective feed differ |
| R-L21 damage | Before: edge vignette only. After: edge/60 ms low-alpha flash plus 900 ms direction | Implementation check met |

Map timing is the existing 1 m, four-neighbour ground BFS at 6 m/s walk and 9 m/s
sprint, using the first cap waypoint for platform centres. It ignores useful
vertical/diagonal paths and is not a player stopwatch. R-M09's current Relay
score uses +10000 occupied penalty, squared proximity inside 14 m, up to +100 LOS
penalty attenuating to zero at 50 m, and rotating ties; it does not guarantee a
hidden spawn when every candidate is exposed, use recent LOS, or favour teammates.
Those limitations now rank above more decoration. R-M19 default remains 60x40 m
CQB on every map: AR four close body hits/300 ms TTK, long sniper lanes exceptional.
The rotation/20-30 s contact and mode-economy mismatches remain explicit gaps;
this HUD session does not silently replace the reference with shorter targets.

Implementation: damage resolution sends an additive `hurt` event to the victim's
own connection after protection/cover checks. It contains only world bearing
(or null for an unknown/coincident source), no attacker identity, range or position.
Gunfire uses the authoritative shooter location; grenades explicitly use their
detonation position, including self-blasts. No new client intent, damage rule,
state codec, snapshot version, collision, lights, WebGL passes, geometry, textures
or runtime bakes. Older clients ignore the event; new clients still retain the
HP-delta vignette fallback against older servers. Current protocol stays compatible.
The direction is the latest impact bearing, not a tracker of a moving attacker.

Four labelled HUD sectors update relative to current camera yaw, hold 650 ms,
then fade for 250 ms. Unknown origins display the flash without guessing direction.
The brief 5.5%-alpha full-screen flash implements R-L21; it is a transient DOM
extension to the existing damage overlay (an explicit exception to the plan's
older blanket no-transparent-fullscreen-layer guideline), not a WebGL render pass.
In-game/OS reduced-motion preferences omit that flash and remove the vignette
transition while retaining the static direction/edge signal. Respawn, reconnect
notice and results clear stale cues. Sector text changes only when the sector
changes. No pulse, camera shake, added sound or bright opaque aiming obstruction.

Strengthened existing real room combat tests: one victim-only gunshot bearing,
no shooter echo, no cue during spawn protection, blast bearings measured from
the actual detonation for enemy/self, no cue behind blast-blocking cover. All
existing tests still pass. Production HUD fixtures check four sectors, yaw wrap,
camera-turn tracking, unknown origin, expiry, reset, reduced motion, viewport fit,
central aim clearance and separation from elimination confirmation, alongside
Session21 feed/lifetime/escaping checks.

Rejected intermediates: first rear label overlapped the elimination panel;
visual review caught it, then a new overlap assertion rejected the 1280x600
candidate. Final rear placement has both a viewport fraction and a minimum
184 px offset below centre. No gate thresholds relaxed. One apply_patch attempt
with an extra unmatched context line failed before writes and was corrected.
Early rejected captures/logs: .inspect/session24-review-* and
session24-short-rejected.log. Final nine-view evidence:
session24-final-hud-report.json and session24-final-hud-match-combat*.png.
Before captures/report: session24-before-{match-combat,match-combat-mobile,relay,
effects-stress}. Opened before desktop, candidate desktop/compact/rear, final
narrow/rear-short and real Undertow practice. Fixtures freeze the production HUD
over the existing map vista; they are not a human playtest.

Final pnpm typecheck, pnpm test (337 passed, 3 existing opt-in skips; 36 passing
files and one skipped), pnpm build:client and pnpm audit:assets PASS. Logs:
.inspect/session24-{typecheck,test,build-client,audit-assets}.log. Exact required
relay,practice-two inspector PASS (session24-required-inspector.log); extended
relay,practice-two,effects-stress inspector with --assert-budgets PASS
(session24-final.log/report.json). All nine HUD views also PASS; reports contain
zero console/runtime/HTTP errors or forbidden offline gameplay requests. Owned
preview restarted after final public writes before final browser gates.

Matched effects fixture: eleven remote operators and local rifle/hands, 145
12-rifle volleys, 96 blasts, transient effects drain; Edge152 / RTX5070 D3D11,
1920x1080 balanced/DPR1. .inspect/session24-delta.json records:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 133302 | 220 / 133302 | 0 / 0 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0 |
| Median / p95 / p99 ms | 6.9 / 7.2 / 7.2 | 6.9 / 7.0 / 7.1 | 0 / -.2 / -.1 |
| Max / first-ready max ms | 7.4 / 7.3 | 7.2 / 7.1 | -.2 / -.2 |
| Prepared shader programs | 27 | 27 | 0 |

This unchanged WebGL fixture does not measure DOM flash composition. Live TDM
is the separate browser frame-hitch check. Desktop rAF intervals/allocation
estimates do not establish GPU timing, target iGPU, cold-driver/thermal or real
6v6 acceptance; no performance improvement is claimed. Asset bytes remain
13,526,417; public bytes 19,603,121 -> 19,618,684 (+15,563 bundled code/source map).
Largest file 4,218,691 bytes; public 40 MiB/per-file 25 MiB caps pass. No binary
asset additions or new asset provenance/allowlists required.

Nonblocking owner questions/defaults: retain the 900 ms last-impact cue and
restrained flash (yes, tune after headphone/mouse play); prioritize threat-aware
spawns on the other maps next (yes). Industrial daylight, amber/teal, stylized
sci-fi and 6v6 TDM remain active defaults. No owner response needed to continue.


Required live gate PASS with the exact command:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human plus three bots, warmup -> live at 6.713 s, three deaths and three
observed respawns. Zero post-warmup shader recompiles, frames >150 ms, console
errors or long tasks. Sole frame above 24 ms was 56.3 ms at startup. Evidence:
.inspect/hitch.json, session24-hitch.json and session24-hitch.log. No room
isolation, storage clearing or additional lifecycle drill.

R-M07 live contact evidence: the existing probe records first received nonlethal
damage 11.062 s after live reset, then 9.548 s and 1.611 s after respawn; last
respawn is censored when the probe stops. Derived artifact:
.inspect/session24-contact-samples.json. This is one wandering human/three-bot
Relay TDM sample, not first visual contact, point recontest, a distribution or
6v6 fairness. All observed values are below 20-30 s. The 1.611 s sample reinforces
the next spawn-fairness review; it is not by itself proof of camping. No complete
natural round was observed, so actual round duration remains unmeasured; configured
TDM/DOM economy numbers above must not be presented as measured match lengths.

Cleanup: .inspect/session24-cleanup.json confirms all twelve final preview
process-tree members stopped; zero remaining owned processes, port8796 listeners
or inspection browsers. Earlier preview trees also stopped, with cleanup records
for the initial/review trees. All standing gates are green; evidence remains
ignored under .inspect. Ready for supervisor review/publication. No commit,
push or deployment.

### Session 25 - 2026-09-08: covered arrivals across every map and FFA

Read the standing brief, Session25 supervisor status, plan and design reference;
confirmed ironsight-aaa through .git/HEAD. Scope apps/ironsight/** only. No commit,
push, deployment, dependency, SDK, purchased derivative or collision-map change.
No Meshy credits spent (1530 remain): this top-ranked server gameplay gap needs
no generated asset. Local room storage was preserved; the resolved lifecycle issue
was not reopened. Worker packaging used only the existing build's dry-run.

Reference: R-M09, R-L04, R-M20. Concrete target: every map/mode routes joins and
respawns through authoritative threat selection; choose an unoccupied candidate
with no sampled enemy LOS whenever one exists; keep the 3000 ms live respawn and
existing protection, rotate ties, and treat all other FFA players as hostile.
R-L04's implementation target is met. R-M09 remains partial: current LOS only,
four body probes rather than exhaustive silhouette visibility, no recent enemy
sightline history, and no guarantee when every authored candidate is exposed.
R-M20 remains partial: the new static decision audit is not a bot-match heatmap,
side win rate, live encounter distribution or human spawn-camping acceptance.

The selector now applies to Undertow and Switchyard as well as Relay, and to FFA's
combined pool. It orders candidates by occupancy, hidden/exposed class, enemy
proximity/exposure danger, then teammate support. An unoccupied hidden point
cannot lose to a far exposed point because of additive distance penalties.
Nearby allies break safety ties without rewarding body stacking. LOS uses the
enemy's authoritative height/crouch eye and probes head, chest and both shoulders;
it does not assume the enemy must currently aim at the arriving player. When all
candidates are exposed, least danger wins and normal respawn/protection still run.
FFA arrivals face the arena centre instead of always inheriting red-team facing.
Practice showcase pins remain intact. No state shape, protocol or snapshot bump.
Selection runs on spawning, not every frame/tick; no new lights, textures, passes,
runtime bakes, VFX or sounds.

Added seven selector regressions and three real-room join tests (+10 total):
FFA hostility, hidden-near versus exposed-far, ally support, occupancy priority,
shoulder exposure, crouch/elevation, invalid pools, all three production map/mode
routes, protection/full health and FFA facing. Existing rotation, screen, corpse,
self and all-exposed tests remain. `tools/spawn-audit.ts` preserves the Session24
policy for comparison and samples 1/3/6/11 seeded ground occupants, 128 trials per
side/count; both policies are judged with the same new four-probe LOS criterion.
Reproduction commands are in its header. Evidence: .inspect/session25-spawn-audit.json.

| Static policy / map | Decisions | Unoccupied hidden option available | Avoidable exposed choice before -> after | Occupied choice before -> after |
|---|---:|---:|---:|---:|
| Relay teams | 1024 | 318 | 20 -> 0 | 0 -> 0 |
| Relay FFA policy | 512 | 192 | 112 -> 0 | 5 -> 0 |
| Undertow teams | 1024 | 472 | 39 -> 0 | 11 -> 0 |
| Undertow FFA policy | 512 | 301 | 119 -> 0 | 4 -> 0 |
| Switchyard team policy | 1024 | 351 | 226 -> 0 | 10 -> 0 |
| Switchyard FFA | 512 | 172 | 117 -> 0 | 5 -> 0 |

Totals: 4608 decisions, 1806 with an unoccupied sampled-hidden option; avoidable
exposure 633 -> 0 and occupancy 35 -> 0. Extra mode/map combinations exercise
the generic selector, not newly offered playlists. **2801 samples had every
candidate exposed**: selection alone cannot solve crowding or pinning in these
compact pools. Preserve this limitation for future map/telemetry work. Per-group
selection medians .0115-.1186 ms, p95 .0356-.2848 ms, worst .9808 ms on this Node
desktop run; these are not deployed Worker duration or browser frame measurements.

Paired production-renderer views use the audit's fixed threat and before/after
selected eye positions: .inspect/session25-{relay,undertow,switchyard}-{before,after}
PNGs/reports/logs. Opened all six: the fixed blue review operator is exposed before
and screened after. The cameras deliberately look toward that same threat to
compare cover; they are not a claim about the automatic spawn yaw or a live match.
Inspector-only --review-camera/--review-enemy arguments record those coordinates
in report.spawnReview for reproduction; they do not affect gameplay. Baseline
renderer evidence: session25-before-{spawn,relay,effects-stress}.png/report.json.

Rejected intermediates: typecheck caught an assumed min/max Bounds API (fixed to
width/depth); the initial room tests called a nonexistent harness dispose method
(removed, matching existing fake-timer tests). No production gate or threshold
was relaxed. The first grid audit never occupied odd-coordinate spawn points, so
the final seeded corpus also samples exact spawn positions and catches occupancy.

Final typecheck, test (347 passed, three existing skips; 37 passing files, one
skipped), build:client, asset audit and Worker dry-run PASS. Logs:
.inspect/session25-{typecheck,test,build-client,audit-assets,build-worker}.log.
Worker dry-run 236.78 KiB, gzip 70.38 KiB. Exact required relay,practice-two inspector
PASS (session25-required-inspector.log); final extended relay,practice-two,
effects-stress --assert-budgets PASS (session25-final.log/report.json). All paired
spawn views pass with zero console/runtime/HTTP errors and forbidden offline
gameplay requests; aggregate evidence session25-report-checks.json. Owned preview
restarted after final public writes before the final browser gates.

Matched effects fixture, Edge152 / RTX5070 D3D11 at 1920x1080 balanced/DPR1:
11 remote operators plus local rifle/hands, 145 twelve-rifle volleys, 96 blasts,
2130 steady samples; effects drain. .inspect/session25-delta.json records unchanged
peak calls/triangles 220/133302, textures 30 / 63.751 MiB, median/p95/p99
6.9/7.1/7.1 ms, max 7.2 ms, first-ready max 7.1 ms, prepared programs 27.
Zero measured deltas at this precision; no renderer performance gain claimed.
These are desktop frame intervals/texture estimates, not GPU timing, iGPU,
cold-driver, thermal or 6v6 acceptance. Asset bytes unchanged at 13,526,417;
public bytes 19,618,684 -> 19,621,683 (+2999, inspector code/source map), largest
file 4,220,697 bytes. Public 40 MiB / file 25 MiB caps pass. No asset allowlist
or provenance additions needed; stress texture headroom remains about .25 MiB.

Re-ranked gaps: shared authoritative weapon handling next, then threat audio;
spawn history/all-exposed pools and real side/contact telemetry remain explicit.
Open owner questions/defaults: retain safety before spawn variety (yes); proceed
to per-weapon handling timers next (yes). Industrial daylight, amber/teal,
stylized sci-fi and 6v6 TDM remain active defaults. No response is needed to continue.

Required live gate PASS with the exact command:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human/three bots, warmup -> live at 6.939 s, two deaths and two observed
respawns. Zero post-warmup shader recompiles, frames >150 ms, console errors or
long tasks. Sole recorded frame above 24 ms: 49.6 ms at startup. Evidence:
.inspect/hitch.json, session25-hitch.json/log. Existing gate/room rules unchanged;
no isolated matchmaking, storage clearing or lifecycle re-proof.

R-M07 live evidence from the same probe: first received nonlethal damage at
9.632 s after live reset, 4.687 s and 2.430 s after respawn. Derived artifact:
.inspect/session25-contact-samples.json. This single wandering-player/three-bot
Relay sample remains below the 20-30 s reference and does not establish an
improvement over Session24 or eliminate spawn camping. It does not measure visual
contact, recontest or many-round side balance. No full natural round was observed.

Cleanup: .inspect/session25-cleanup.json records the twelve stopped final preview
processes, zero remaining owned processes, port8796 listeners or inspection
browsers. Both earlier owned preview trees were also stopped. All standing gates
are green. Evidence remains ignored under .inspect; Session25 is ready for
supervisor review. No commit, push or deployment.


### Session 26 - 2026-09-08: deliberate weapon acquisition and sprint recovery

Read standing brief, Session26 supervisor status, plan and all 63 design references;
reviewed the existing canonical scorecard before selecting the top finishable gap.
Confirmed ironsight-aaa via .git/HEAD. Scope apps/ironsight/** only; no git commands,
commit, push, deployment, dependencies, SDK or purchased-derivative changes. No Meshy
credits spent (1530 remain): this handling change benefits from shared code and
existing weapon art. Preserved local room storage and left resolved lifecycle work closed.

Reference: R-G19, R-G20, R-G03. Concrete target: reference-range per-weapon ADS and
90-150 ms sprint-to-fire recovery; server rejects early shots before spending ammo,
removing protection or resolving hits. Sight positioning and FOV finish on the same
finite timer; scope appears only when the sniper finishes acquiring. Timer target
met in exact boundary tests and the real mouse/control fixture. R-G20 and R-G03
remain partial: no new recoil/accuracy model or glint; ordinary hip fire is allowed.
No balance claims about human duels or latency are made from a local browser probe.

| Weapon | ADS before -> final ms | Sprint recovery before -> final ms | Browser sights settled ms | First confirmed aimed shot ms |
|---|---|---|---:|---:|
| AR | no authority -> 250 | 0 -> 120 | 257.0 | 308.3 |
| SMG | no authority -> 200 | 0 -> 100 | 202.7 | 231.4 |
| Shotgun | no authority -> 225 | 0 -> 130 | 232.5 | 297.1 |
| Sniper | no authority -> 400 | 0 -> 150 | 406.4 | 428.8 |
| Pistol | no authority -> 165 | 0 -> 90 | 168.7 | 215.2 |

Browser values are measured from right-button arrival, with left-trigger arrival
0.4-2.5 ms later. Settled threshold is >=.9999 of visual interpolation; confirmed
shot includes local scheduling, server ticks and message delivery, not RTT. Previous
shared exponential ADS reached 95% at ~214 ms, .9999 at measured 656-659 ms for all
weapons, and did not gate shots (first confirmations ~31-47 ms). Do not compare the
old 95% number with new 100% completion as if they were identical thresholds.
Full samples and paired acquiring screenshots: .inspect/session26-before-controls-*
and session26-verified-controls-*. Baseline uses the original pre-build client;
its absent ADS intent is the unchanged hip-fire server path. It is animation/input
baseline evidence, not a separately restored pre-session Worker deployment.

WeaponSpec owns adsMs/sprintToFireMs, including the alternate theme, with finite,
positive config validation. src/handling.ts shares acquisition/recovery state and
sprint eligibility between client and server. move carries one optional validated
boolean ads, using the existing changed-intent/keepalive schedule. Forward grounded
sprint is incompatible with ADS; trigger/aim cancels sprint to walk on the client.
Server independently checks posture, grounded state and movement intent; a forged
ready flag, timer or backdate in the payload does nothing. Repeated ADS keepalives
preserve acquisition, while reload/swap resets it; spawn/round/seat cleanup clears
handling. No binary schema, snapshot version, collision, damage, TTK or cadence change.
Old clients omit ads and retain hip-fire rules; client and Worker should ship together
for intended presentation. A modified client can choose its own FOV, but gains no
server accuracy bonus by omitting ADS: this session introduces none.

Server acquisition uses server-recorded input receipt time (not client subtick ts)
to avoid tick-drain quantization extending the start. The fire check still uses server
now. A boundary rejection returns owner-only fireBlocked with remaining delay and
actual magazine; Net restores predicted ammo and lets a still-held trigger retry
after that delay instead of losing an entire sniper cadence. No queued autonomous
shot or firing after trigger release. Prediction can still briefly show a cosmetic
shot before a rejection under jitter; authoritative damage/impacts remain confirmed.
Recoil, ADS/crouch spread multipliers and high-RTT acceptance are explicit next work.

Added 24 regressions: five-weapon exact ADS/sprint boundaries, batching/clock rewind,
held keepalive, interruption/switch, malformed fields, no early ammo/protection spend,
reload reacquisition, production queued sprint-press/release/fire, and the actual Net
retry/ammo path. Browser-only Net test is included in the DOM tsconfig and excluded
from Worker typechecking, matching existing client-test organization. Full test suite:
371 passed, three existing skips; 39 passing files and one skipped.

The new scripts/handling-probe.mjs extends inspect-map's actual pointer/key path.
Final command: `node scripts/inspect-map.mjs --url http://localhost:8796 --shots handling --assert-handling --prefix session26-verified-controls`.
All five acquisition/first-shot checks pass; W+Shift then held fire confirms pistol
recovery (90 ms config; first received shot 123.9 ms). Assertions include an upper
bound on confirmation after both acquisition and actual trigger arrival. This is a
local input/network fixture, not physical mouse, headphone, iGPU or 6v6 acceptance.
Opened paired early sniper captures, final AR sights and actual Undertow practice.
No added light, texture, pass, geometry, audio asset or runtime bake.

Rejected intermediates: exact room tests initially disabled queueInputs as a field,
but the preset overwrote it in onCreate; the exact-time subclass now sets it after
super.onReady, and a separate regression retains production batching. Typecheck
caught the Net test's DOM globals in the Worker test set; split it into the client
configuration. First browser candidate rejected a dropped sniper boundary shot;
receipt-time acquisition plus the bounded retry/ammo correction fixed it. One later
repeat recorded a 1121.5 ms AR confirmation without recording trigger delivery time;
retained in session26-final-controls-report.json, not presented as normal handling.
Strengthened the probe to timestamp the left trigger and bound confirmation latency;
the final verified run above passes. No standing gate/threshold relaxed. Minor script
path/Windows decoding errors were corrected before their intended writes.

Final required typecheck, test, build:client and audit:assets PASS; logs under
.inspect/session26-{typecheck,test,build-client,audit-assets}.log. Exact required
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two`
PASS, zero console/runtime/HTTP errors (session26-required-inspector.log and copied
session26-required-report.json). Extended final weapon-ar-ads,weapon-sniper-ads,
relay,effects-stress --assert-budgets PASS (session26-final.log/report.json).
Owned preview restarted after final public writes, before final browser gates.

Matched effects fixture: Edge152 / RTX5070 D3D11, 1920x1080 balanced/DPR1, eleven
remote operators and local rifle/hands, 145 twelve-rifle volleys, 96 blasts, 2130
steady samples, effects drain. .inspect/session26-delta.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles | 220 / 133302 | 220 / 133302 | 0 / 0 |
| Textures / estimated MiB | 30 / 63.751 | 30 / 63.751 | 0 / 0 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.0 / 7.1 | 0 / -.1 / 0 |
| Max / first-ready max ms | 7.3 / 7.1 | 7.2 / 7.1 | -.1 / 0 |
| Prepared programs | 27 | 27 | 0 |

No performance improvement claimed: desktop frame intervals/texture estimates do
not establish weak-GPU, cold-driver, thermal or real-player acceptance. Assets stay
13,526,417 bytes; public 19,621,683 -> 19,632,950 (+11,267 bundled code/source map),
largest file 4,228,556 bytes. Total 40 MiB and file 25 MiB caps pass. No binary
provenance/allowlist additions needed; stress texture headroom stays ~.25 MiB.

Exact live gate PASS:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human/three bots, live at 7.812 s, three deaths/two observed respawns; zero
post-warmup shader recompiles, frames >150 ms, console errors or long tasks.
Only frame above 24 ms was startup 58.9 ms. Evidence: .inspect/hitch.json,
session26-hitch.json/log. No room isolation, storage clearing or lifecycle re-proof.
Same-run first received nonlethal damage: 8.305 s after live, 2.173/1.951 s after
respawns (session26-contact-samples.json). Still below R-M07's 20-30 s reference;
not proof of spawn fairness, first visual contact or a 6v6 distribution. No complete
natural round observed; existing mode economy numbers remain configuration only.

Re-ranked all scorecard gaps; threat audio next, followed by learnable recoil.
Open owner questions/defaults: keep these class-specific timers and sprint cancellation
(yes, tune after real mouse/high-RTT play); proceed to enemy/ally threat audio next
(yes). Industrial daylight, amber/teal, stylized sci-fi and 6v6 TDM stay active.
No owner response is needed to continue. Final cleanup evidence follows below.

Cleanup: .inspect/session26-cleanup.json confirms all eleven final preview process-tree
members stopped, no remaining owned process, port8796 listener or inspection browser.
Earlier preview trees were also stopped. A PID subsequently reused by an unrelated
Chrome renderer was verified by its later creation time and left untouched.
session26-report-checks.json records zero
errors/forbidden requests in required, effects and controls reports. All standing
final gates are green. Evidence remains ignored under .inspect. Ready for supervisor
review/publication; no commit, push or deployment.


### Session 27 - 2026-09-08: audible threats, grounded footsteps and cover muffling

Read standing brief, Session27 status, plan and all 63 reference principles in order;
reviewed the existing canonical scorecard first, then selected its top threat-audio gap.
Confirmed ironsight-aaa through .git/HEAD. Scope apps/ironsight/** only; no commit,
push, deploy, dependency, purchased derivative or collision change. No Meshy spend
(1530 credits remain): this audio gap needs no generated visual asset. Preserved local
room storage; resolved lifecycle work was not reopened. Supervisor reports Session26
is deployed; Session27 remains local pending supervisor publication.

Reference: R-G14, R-G16, R-L18, R-G15. Concrete targets: enemy/ally footstep and reload
gain 1.4 at equal distance; distinct concrete and metal footsteps; solid cover reduces
gain to .32 and caps cutoff at 1100 Hz; never exceed twenty concurrent remote voices;
hit/kill confirms bypass that cap. These implemented checks pass. R-G14 remains partial
for headphone/surface-identity acceptance, R-G16 for ramps and sound routing around
openings, and R-L18 for path reachability and broader enemy weapon priority. The more
specific R-G14 1.3-1.5 range takes precedence over R-L18's generic 1.2-1.3 boost.

Remote steps and mechanical reload phases now use enemy/ally team context, including
FFA hostility. Concrete retains the short 350 Hz low-pass tap; metal uses a 1900 Hz,
Q2.2 band-pass and 1.35 playback rate versus concrete .85. Surface selection uses box
tops and actual ramp slopes; airborne feet do not count as a surface. Remote steps
check shared supporting geometry. Reload cues follow replicated deadlines and the
same phase timeline as the visible operator; entry seeds its current phase, avoiding
a stale reload-start cue on AOI entry. Death/disappearance clears the tracker.

All spatial gunfire, explosions and foley now query the source-listener segment
against collision boxes when the sound starts. No visual prop becomes an acoustic
wall. Overlapping boxes do not multiply attenuation. Ordinary remote sounds admit up
to sixteen voices; four of the existing twenty slots remain available for clear enemy
foley. There is no voice stealing, pathfinding, per-frame acoustic raycast, new sound
buffer, texture, light, pass or runtime bake. Ramp volumes do not yet occlude audio;
this is direct-path muffling, not physical diffraction, doorway routing or HRTF.

Actual Web Audio graph fixture:
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots audio --prefix session27-audio`
PASS, running 48 kHz AudioContext after real browser click. At 10 m, ally/enemy bus
gains .286364/.400909 for both step and reload (ratio 1.4); covered enemy .128291
(ratio .32), cutoff 1100 Hz. Ordinary saturation 16, enemy saturation 20, drained 0;
hit and kill functions run while saturated. Evidence: .inspect/session27-audio-report.json,
PNG and log. The developer fixture restores map/listener in finally and changes no
gameplay state. Measurements are node parameters before the master compressor, not
perceived loudness; no headphone listening approval is claimed. Five new regressions
cover teams/FFA, solid/beyond/behind segments, open routes/elevated rays, overlapping
boxes, and deck/ramp/airborne classification. Existing panning regressions remain.

Reference re-audit: .inspect/session27-reference-audit.json, reproduced by the command
in tools/reference-audit.ts. All 63 scorecard rows retained and re-ranked. Unchanged
priority numeric checks: Relay 13 full/8 waist boxes, Undertow 14/8, Switchyard 6/5,
zero head-height boxes; A/B/C ground rotations 1.33-7.33 s walk, .89-4.89 s sprint;
spawn-to-cap proxy 2.33-10.67 s walk (not contact). ADS AR/SMG/shotgun/sniper/pistol
250/200/225/400/165 ms, sprint recovery 120/100/130/150/90 ms. TDM 50 kills/300 s;
DOM 4 s neutral/8 s enemy capture, one point per two seconds per flag, target 200,
no side swap. Live respawn 3000 ms with Session25 threat selection. Hit 900/1400 Hz
at .28 gain; kill 660/990 Hz at .30 peak. Existing victim flash plus direction remains;
killfeed still top-right/five rows/weapon and HEADSHOT text, no objective feed.
Reference pacing mismatches stay open; 60x40 m remains CQB with four-hit/300 ms AR.

Paired renderer evidence: .inspect/session27-{before,final}-{relay,effects-stress}.png,
reports and logs. Opened both Relay views: matching geometry/presentation as expected
for an audio session, not a claim of visual improvement. Edge152 / RTX5070 D3D11,
1920x1080 balanced/DPR1, eleven remote operators plus local hands/rifle, 145 twelve-rifle
volleys and 96 blasts, 2130 steady samples. Before -> after: peak calls 220 -> 220,
triangles 133302 -> 133302, textures 30 -> 30, estimated texture MiB 63.751 -> 63.751;
median/p95/p99 6.9/7.1/7.1 -> 6.9/7.1/7.1 ms; max 7.2 -> 7.2 ms; first-ready max
7.1 -> 7.1 ms; programs 27 -> 27. Effects drain. All measured deltas zero at this
precision (.inspect/session27-delta.json). This desktop fixture does not establish
iGPU, GPU timings, cold-driver, thermal, headphone or real 6v6 acceptance.

Asset bytes remain 13,526,417. Public 19,632,950 -> 19,646,775 (+13,825 bundled code
and source map); largest file 4,237,973 bytes. Forty MiB total/twenty-five MiB per-file
caps pass; no provenance/allowlist addition needed. Texture headroom remains ~.25 MiB.

Rejected intermediates: a PowerShell brace path search and the first Python edit's
Windows default decoding failed; reran with explicit UTF-8 before continuing edits.
An initial remote-grounding idea based on small vertical deltas was replaced before
final gates with actual box/ramp support, so climbing ramps still produces steps.
No gameplay gate, shader check, performance threshold or room rule was relaxed.

Final required pnpm typecheck, pnpm test (376 pass, three existing skips; 39 passing
files, one skipped), pnpm build:client and pnpm audit:assets PASS. Logs under
.inspect/session27-{typecheck,test,build-client,audit-assets}.log. Exact required
`node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two`
PASS; session27-required-inspector.log and copied session27-required-report.json.
Final relay,effects-stress --assert-budgets PASS. All before/audio/required/final
reports have zero console/runtime/HTTP errors and forbidden offline gameplay requests
(session27-report-checks.json). Owned preview restarted after final public writes.

Exact required live gate PASS:
`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`.
One human/three bots, live at 7.344 s, two deaths and two observed respawns; zero
post-warmup shader recompiles, frames >150 ms, console errors or long tasks. Only
recorded frame above 24 ms was 61.9 ms at startup. Evidence: .inspect/hitch.json,
session27-hitch.json/log. Same-run first received nonlethal damage after live/respawns
11.020/14.124/3.194 s (session27-contact-samples.json). These do not meet the 20-30 s
reference band and are not first visual contact, a distribution, a fairness improvement
or 6v6 acceptance. No full natural round observed; economy remains configured timing.

Cleanup: .inspect/session27-cleanup.json records twelve stopped final preview process
members, zero remaining owned processes, port8796 listeners or inspection browsers.
The first preview tree was also stopped before final gates. All standing gates green.
Re-ranked learnable recoil first; audio routing/headphone review remains explicit.
Open owner questions/defaults: retain 1.4 threat gain and direct cover muffling pending
headphone feedback (yes); proceed to shared recoil/accuracy next (yes). Industrial
daylight, amber/teal, stylized sci-fi and 6v6 TDM stay active. No answer needed to
continue. Ready for supervisor review; no commit, push or deployment.


### Session 28 - 2026-09-09: expanded Relay and repaired combat gate

Read standing brief, supervisor status, plan and all 63 reference principles. This
continues the uncommitted Session28 expansion after the supervisor rejected its
bot-battle test. Confirmed ironsight-aaa; scope apps/ironsight/** only. No commit,
push, deploy, new dependencies or Meshy spend (reported balance 1530 retained).
The inherited original geometry/bakes were preserved and audited; private skyline
remains ignored. Local room storage was preserved; resolved lifecycle work stayed closed.

Reference: R-M01, R-M03, R-M04, R-M05, R-M07, R-M09, R-M17, R-M18, R-M19, R-M20,
R-L10, R-L11. Targets: 10-15 s objective rotations at 9 m/s, 20-30 s contact,
1,250 m2 per seat, purposeful three lanes, waist/full cover, 3/6 m tiers, at least
one 30-40 m rifle lane, twelve-player fill, collider-authoritative cover and bot routes.
Density/rotation/cover/rifle-lane checks pass; contact and co-visible two-entry
objective acceptance remain incomplete. Owner expansion direction overrides the old
CQB default. All 63 scorecard rows retained, audited and re-ranked; Undertow next.

Relay grows from 60 x 40 to 150 x 100 m (2,400 -> 15,000 m2; 6.25x; 200 -> 1,250
m2 per twelve seats). Collision tile rows own spawns, caps and all cover: 23 full
volumes, 14 waist volumes at 1.1 m, zero head-height cover. The primary floor is
ground, north decks at +3 m reached by four extended ramps, service roofs at +6 m.
Waist cover tops are not counted as an architectural floor tier. Six spawns per
side are wall-backed behind mirrored screens. Existing tests cover opposing-spawn
LOS, open deployment exits, valid target positions, mirrored solids and connected
navigation. Snapshot version 5 intentionally resets older layouts; the expanded
200 x 160 wire envelope changes the fingerprint, so client and Worker must ship
together through the supervisor. Other maps retain their individual small bounds.

Cooling is the rifle route with paired ramp/deck elevation (the traversal hook);
center splits around the relay core, while Freight uses offset service blocks and
short approach gaps. Both spawn sides cross between lanes around screened service
blocks. The north connector at z=27 has a tested 40 m eye-height line, including
its 2.4 m strafe band. The north-axis dish/mast remains the main orientation landmark;
all-lane human visibility and exact objective two-entry coverage are still partial.
A/B/C are (25,15), (75,95), (125,15). Four-neighbour 1 m ground BFS:

| Rotation | Walk 6 m/s | Sprint 9 m/s | Target |
|---|---:|---:|---|
| A-B | 21.67 s | 14.44 s | met |
| B-C | 21.67 s | 14.44 s | met |
| A-C | 17.33 s | 11.56 s | met |

These are ground-route estimates, not measured player turns or vertical shortcuts.
Regression checks protect the full 10-15 s band and minimum area/seat. Ground,
apron, fog, sky/camera range, shadow extent, inspector framing, service details,
uplinks and private skyline now follow expanded bounds. Original architecture,
weathering and ground AO were rebaked; unchanged light count, one cached shadow
atlas, no extra pass, no per-frame bake. The private skyline keeps its single atlas.
Map-specific lazy loading remains. Tools accept Relay-only exports to avoid changing
other maps' bakes. Remaining 60/40 constants in the Relay apron/context code are
source-layout coordinates transformed into MapDef bounds; other-map authored
perimeters are deferred to their own expansion sessions.

Expanded Relay fills twelve seats, including an arriving human, using existing
ordinary bot HP/damage and input handlers. Bots keep navigating until a target is
within min(40 m, weapon range), then strafe around their current encounter rather
than sliding back toward legacy z=11. Two focused brain regressions guard travel
past distant visibility and local fight anchoring. Practice's five stationary
roles move to the sheltered west pocket. The rig inspector also uses map bounds.

The supervisor failure was the M0 transport-bot harness returning through obsolete
60x40 waypoint coordinates after respawn. ArenaBot now accepts collision-map route
steering; the test fights a 20 m north-connector duel and walks normal authoritative
spawn returns through GroundNavigator. No post-death teleport, artificial map,
aim-noise reduction, retries or lower threshold. Original >=20 hits, >=2 kills,
both teams scoring, respawn and score-accounting assertions pass. The older opt-in
map-metrics driver also receives map navigation/appropriate strafe anchors.

Natural production-bot evidence: `$env:RELAY_METRICS='1'; pnpm exec vitest run
 test/relay-metrics.tool.test.ts` (remove the env var afterwards). No shortened
round/respawn clocks, combat-stat overrides, teleports or scripted routes. Final
observed round: 206.1 s, red48/blue50, 98 kills; .inspect/session28-bot-round.json,
session28-bot-round.log and session28-bot-heatmap.svg. Initial lives: LOS 4.6/5.4/6.2 s
min/median/max; damage 10.6/12.2/30.4 s (12/12 observed). Respawns: LOS 2.6/4.0/7.6 s,
damage 3.1/10.85/21.7 s (94/95 observed; absent observation stays absent). LOS is a
100 m eye ray without FOV; damage sampled each 100 ms. R-M07 remains unmet. This
single local harness round does not establish 6v6 fairness, side win rates, real
RTT, first visual attention or deployed capacity. An earlier sample was 47-50 in
198.2 s; do not describe the seeded-spread tool as a fully deterministic replay.

Rejected intermediates: supervisor's red bot-battle run; stale candidate captures
with a dark clipped sky cap and old apron extents. Restarting the preview after
final public writes exposed the existing bounds-aware sky/far-plane correction;
opened .inspect/session28-repair-visual-relay.png and overview against the before
views to verify it. Old session28-final-* captures are superseded. An initial new
test assumed waist height 1.05; actual tilemap is 1.1, so the floor-tier check now
selects full structures and separately validates waist class limits. A UTF-16
PowerShell JSON redirect was normalized to UTF-8 for the reference audit. No standing
gate threshold or game rule was relaxed.

Architecture audit .inspect/session28-repair-architecture-audit.log PASS: 15,004
source triangles, 28,572 verified weathered triangles, no exported degenerates,
normal-component error <=0.0002642, source tolerance 0.1 mm, twelve material
primitives, 2,499,400 bytes. public/assets/README.md documents repeatable Relay-only
bakes, weathering, private skyline and vista capture. .inspect/session28-before-*
is the inherited pre-expansion baseline; final visual/performance evidence and
required gate results follow below.

The first exact live hitch gate failed with zero deaths: the legacy probe rotates
0.9 rad every 1.8 s walk burst and circles entirely inside the larger sheltered
spawn pocket. No recompiles, >150 ms frames, long tasks or console errors occurred;
this is still a rejected run (.inspect/session28-repair-hitch.json/log). Updated
scripts/hitch-probe.mjs to compile the existing collision-map navigator into its
Node driver and steer the same W/look controls around corners toward A/B/C on
expanded maps. It does not teleport, write gameplay state, choose an isolated room,
change bot stats, change clocks or weaken assertions. Small-map wandering remains.
Route samples are retained in the output so death/respawn coverage is reviewable.

A read-only CDP diagnosis on the second rejected run showed the authoritative
player still at x3/z43 and pointerLockElement=null (resume prompt visible). The
probe's new tab was not foregrounded. Added Page.bringToFront and an explicit
pointer-lock readiness assertion after the ordinary user click, matching the
existing first-play tool. This corrects the initial assumption: those two runs
proved no movement, not that the player actually circled. Neither no-death run
is accepted as gameplay evidence. Navigation remains necessary because the old
fixed turn pattern has bounded travel; the final route reports prove real movement.

Optional legacy map-metrics validation initially found no Relay kills: its test
clients acquired targets across the enlarged map, outside useful weapon range.
Added an optional 40 m encounter limit/local strafe anchor to the transport bot,
matching production patrol behavior; the unchanged M0 duel has no new range limit.
All three opt-in map-metrics scenarios now pass. Generated legacy report files were
restored byte-for-byte; current natural-round evidence is the Session28 JSON/SVG.
Final full typecheck/test rerun after these tool edits is recorded in repair logs.

Final required gates PASS: pnpm typecheck; pnpm test (379 passed, four opt-in
skips; 39 passing files/two skipped); pnpm build:client; pnpm audit:assets.
Logs: .inspect/session28-repair-{typecheck,test,build-client,audit-assets}.log.
Exact required inspector command `node scripts/inspect-map.mjs --url
http://localhost:8796 --shots relay,practice-two` PASS; evidence
session28-required-inspector.log / session28-required-report.json. Extended
`--shots overview,cooling,relay,freight,spawn,effects-stress --assert-budgets
--prefix session28-accepted` PASS. Opened accepted overview/Cooling/Freight and
repaired Relay captures; sky/apron clipping is absent, skyline detail is loaded.
All final report error/forbidden-network arrays empty (session28-report-checks.json).
The preview was restarted after the final public writes before browser gates.

Matched stress workload, Edge152 / RTX5070 D3D11, 1920x1080 balanced/DPR1,
eleven remote operators and local hands/rifle, 145 twelve-rifle volleys, 96 blasts,
2,130 steady samples, complete effects drain. .inspect/session28-delta.json:

| Metric | Before | Accepted | Delta |
|---|---:|---:|---:|
| Peak calls | 220 | 220 | 0 |
| Peak submitted triangles | 133302 | 128906 | -4396 |
| Resident textures | 30 | 30 | 0 |
| Estimated texture MiB | 63.7513 | 63.7513 | 0 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0 / 0 / 0 |
| Maximum / first-ready max ms | 7.2 / 7.2 | 7.6 / 7.1 | +0.4 / -0.1 |
| Prepared programs | 27 | 27 | 0 |

The fixture camera moves with the new layout, so submitted triangle differences
include visibility changes and are not a geometry optimization claim. Texture
headroom remains ~0.249 MiB. Desktop frame intervals do not establish the iGPU,
thermal, cold-driver or real 6v6 acceptance. No render light/pass added.
Asset bytes 13,526,417 -> 13,602,205 (+75,788); public 19,646,775 -> 19,736,916
(+90,141), including bundle/maps/provenance README. Largest file 4,246,711 bytes.
Forty MiB total/twenty-five MiB per-file caps pass. Architecture +152,780 bytes;
ground AO -52,216 bytes. Private skyline stays ignored; no new allowlist needed.

Final exact live command `node scripts/hitch-probe.mjs http://localhost:8796
150000 .inspect/hitch.json --assert` PASS. .inspect/hitch.json,
session28-final-hitch.json/log: twelve seats, two bot-caused deaths and two
respawns, zero post-warmup shader recompiles, >150 ms frames, console errors or
long tasks. Only recorded frame above 24 ms: startup 95.2 ms. Navigation samples
prove the client moved through normal server-owned coordinates. The run joined
an existing live room, observed its ordinary ended/warmup/live transition, then
completed its second death/respawn; no room isolation or storage reset. First
received damage 21.714 s after measurement began (not spawn-to-contact), then
14.708 s after the next live reset. These do not replace the natural bot-round
contact distribution or establish human pacing.

Cleanup: .inspect/session28-cleanup.json confirms the owned preview tree stopped,
zero remaining owned processes, port8796 listeners or inspection browsers. The
inherited and intermediate preview trees were also stopped. Read-only git diff
whitespace check passed; every changed path stays under apps/ironsight/**.
All standing gates are green. No commit, push or deployment.

Open owner questions/defaults: expand Undertow next, then Switchyard (yes, per
owner order); retain Relay's larger footprint while gathering human contact and
two-entry objective feedback (yes). Improve its sparse intermediate spaces with
collider-aligned dressing in a future art pass; do not shrink back to CQB. Keep
industrial daylight, amber/teal, stylized sci-fi, shared authority and 6v6 TDM.
No answer is required to continue. Supervisor owns publication of this candidate.


### Session 29 - 2026-09-09: expanded Undertow and navigable Domination

Read the standing brief, supervisor status, plan and all 63 reference principles.
Confirmed ironsight-aaa, clean starting worktree. Scope apps/ironsight/** only;
no commit/push/deploy, new dependencies, purchased derivatives or Meshy spend.
Reported Meshy balance remains 1530. Collider-derived reclamation architecture
serves this expansion; generated props remain available for a later richness pass.
All 63 scorecard rows retained/re-audited; Switchyard expansion ranks first next.

Reference: R-M01, R-M02, R-M03, R-M04, R-M05, R-M07, R-M09, R-M10, R-M15,
R-M17, R-M18, R-M19, R-M20, R-L02, R-L10, R-L11. Targets: 1,250 m2 per twelve
seats, 10-15 s sprint rotations, 20-30 s contact, three purposeful lanes, at least
one 30-40 m rifle sightline and a tight lane, waist/full cover, ground/3/6 m tiers,
wall-backed deployments, one traversal hook, co-visible objective approaches.
Density/rotation/cover/rifle-lane/ramp checks pass. Contact remains short; B has
paired visible approaches but all-objective and human visibility acceptance stays
partial. No reference mismatch was relabeled as success.

Undertow changes from 60x40 to 150x100 m: 2,400 -> 15,000 m2, 6.25x area,
200 -> 1,250 m2/seat. A 75x50 two-metre tile map replaces the hand-authored box
list and owns all cover, six spawns per side and objectives. Full cover: 23;
waist cover: 14 at 1.1 m; no head-height boxes. Ground, paired 3 m control decks,
6 m pump/service roofs are the architectural tiers. Four six-metre ramps climb
to the decks; the paired shortcuts are this map's traversal hook. Bot navigation
intentionally remains ground-only. Spawns sit at x3/147 behind mirrored screens,
with wall backing and two tested lateral exits; opposing spawn LOS is blocked.

Clarifier north route supports rifle duels: x55-95 at z27 remains clear across a
2.4 m strafe band. Middle controls offer raised shortcuts and split around the
pump core. South maintenance is a close approach through offset service buildings
to the B court. B's side/rear walls bound two 4 m north doors; standing-eye rays
from (75,97) see sampled approach centers within the existing 78-degree FOV.
This does not establish every edge/animation/FOV or all A/C defensive angles.
A/C are (27,15)/(123,15); B is (75,95). Four-neighbour 1 m ground BFS:

| Rotation | Walk 6 m/s | Sprint 9 m/s |
|---|---:|---:|
| A-B | 21.33 s | 14.22 s |
| B-C | 21.33 s | 14.22 s |
| A-C | 16.00 s | 10.67 s |

Ground estimates exclude vertical shortcuts, human turning and actual retakes.
Always-on tests guard the sprint band, cover classes, six spawns, blocked spawn
LOS, lateral exits, 40 m rifle lane, B rays and every deployment-to-cap bot route.
Existing all-map sorted arrival symmetry and reachability tests also pass.

A real ramp traversal regression found a downhill lip defect: a capsule stayed
supported by the deck after its center entered a steeper ramp, then lost one tick
of grounding. Physics now continues that descent only with verified prior box-top
support, nonascending velocity and a drop within stepUp; airborne jumps remain
ballistic. Both decks cross in both directions without jumping or an airborne tick;
existing physics ascent/jump/side-entry tests pass. No movement speed or collision
volume was changed to hide the defect.

The first natural DOM run ended 0-0 with zero kills: bots pressed directly into
spawn-screen corners. DOM objective steering bypassed GroundNavigator although
TDM patrol already used it. DOM now steers via the same cached collision flow
field while keeping the true objective for arrival/holding. A regression proves
it takes a westward corner toward a northward objective. Expanded maps use twelve
seats and a 40 m effective encounter ceiling bounded by weapon range; normal HP,
damage, reaction and firing handlers remain. Undertow training remains empty
traversal practice as advertised; Relay's five passive target roles are retained.
Snapshot version 6 resets prior layouts through the existing default migration;
client and Worker must ship together. No codec layout change this session.

Final natural production-bot DOM evidence: `$env:UNDERTOW_METRICS='1'; pnpm exec
vitest run test/undertow-metrics.tool.test.ts` (remove env afterwards). No shortened
clocks, bot stat overrides, teleports, scripted movement or retries inside the tool.
One round lasted 277.9 s, score 100-201, 88 kill/death positions. Evidence:
.inspect/session29-bot-round.json/log, session29-bot-heatmap.svg and
session29-contact-summary.json. Initial LOS min/median/max 6.0/7.6/9.3 s (12/12),
first damage 14.8/16.8/35.0 s (11/12). Respawn LOS 1.1/6.2/40.4 s (82/82),
first damage 1.5/16.8/77.5 s (75/82). Unobserved samples stay absent. LOS is a
100 m eye-segment opportunity without FOV, damage sampled every 100 ms; these are
not human attention or RTT measurements. One side's 100-201 win is no evidence of
balance; a side-win distribution/recontest/real 6v6 review remains required.

Static reference audit: .inspect/session29-reference-audit.json. Unchanged priority
checks: Switchyard six full/five waist boxes, 2.44-4.89 s sprint rotations; ADS
AR/SMG/shotgun/sniper/pistol 250/200/225/400/165 ms, sprint recovery
120/100/130/150/90 ms. TDM 50 kills/300 s; DOM 4 s neutral/8 s enemy capture,
one point/2 s/flag, 200 target, no side swap. Live respawn 3000 ms with existing
threat-aware scoring. Enemy/ally footstep/reload gain 1.4; hit 900/1400 Hz at .28,
kill 660/990 Hz at .30. Victim flash/direction remains; feed top-right/five rows,
weapon/HEADSHOT text with no objective feed. Reference economy mismatches stay open.

Art follows the new colliders: rebuilt original architecture and ground AO,
bounds-aware perimeter/apron/fog/cameras, translated exterior plant context,
a 24 m north-axis control stack, wide clarifier basin/bridge, new cap/deck signs
and HUD callout regions. Scene keeps the same lights, static shadow atlas, lazy
per-map architecture and existing AO/sign textures; no new light/pass/runtime bake.
Texture resolution is unchanged. The kit's base and roof cap now meet without
broad overlap: early expanded overview showed depth-fighting stripes on roofs,
so that geometry was rejected and rebaked before final acceptance. No render
geometry adds playable cover. Remaining 60/40 context constants are explicitly
source-layout anchors mapped to current bounds, not movement/render extents.

Rejected intermediates: a Python edit stopped on Windows default text decoding,
then resumed with explicit UTF-8; no partial failed edit was accepted. Old compact
layout timing/B-chord tests were replaced by owner-authorized expanded-map contracts.
The first B-door ray design clipped its center baffle; the court was revised and
passes the rays. Downhill traversal, zero-kill DOM and roof striping failures were
fixed as described above. No standing gate, bot damage or performance threshold
was weakened. Final gate/performance/cleanup evidence follows.


Final architecture audit .inspect/session29-architecture-audit.log PASS:
47,176 source/exported triangles, zero degenerates, maximum normal-component
error .00030063, ten material primitives, 3,783,288 bytes and 0.1 mm position
tolerance. Original provenance and exact commands in public/assets/README.md.

Matched before/accepted renderer workload, Edge152 / RTX5070 D3D11, 1920x1080,
balanced/DPR1, eleven remote operators plus local hands/rifle, 145 twelve-rifle
volleys and 96 blasts, 2,130 steady samples and complete effects drain:

| Metric | Before | Accepted | Delta |
|---|---:|---:|---:|
| Peak calls | 217 | 189 | -28 |
| Peak submitted triangles | 79,360 | 112,214 | +32,854 |
| Resident textures | 23 | 23 | 0 |
| Estimated texture MiB | 60.2513 | 60.2513 | 0 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0 / 0 / 0 |
| Maximum / first-ready max ms | 7.4 / 7.1 | 7.4 / 7.1 | 0 / 0 |
| Prepared programs | 19 | 19 | 0 |

Evidence: .inspect/session29-delta.json, session29-before/accepted-report.json,
corresponding inspector logs and PNGs. Camera/actor placement follows the changed
layout, so visibility changes contribute to call/triangle deltas; this is not an
optimization claim. Opened before/accepted overview, accepted vista, B/deck views
and required real Undertow practice. Accepted overview/vista supersede the earlier
session29-final-* roof-striping captures; those remain as rejected evidence.
Desktop intervals do not establish laptop iGPU, GPU timing, thermal, cold-driver
or real 6v6 acceptance. No light count/pass or resident texture increase.

Public bytes 19,736,916 -> 21,907,579 (+2,170,663); assets including provenance
13,602,205 -> 15,764,282 (+2,162,077). Architecture +2,229,464 bytes, ground AO
-76,749, vista +7,660, README +1,702. Largest file client.js.map 4,251,282 bytes.
Forty MiB public/twenty-five MiB per-file caps pass. The expanded kit remains lazy
per-map and adds zero texture MiB. No allowlist extension or private asset change.

Required pnpm typecheck, pnpm test (380 passed, five opt-in/existing skips;
39 passing files/three skipped), pnpm build:client, pnpm audit:assets PASS.
Evidence .inspect/session29-{typecheck,test,build-client,audit-assets}.log.
Exact required `node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two` PASS; session29-required-inspector.log and copied
session29-required-report.json. Extended Undertow effects fixture --assert-budgets
PASS. Before/intermediate/accepted/required reports all have empty error and
forbidden offline network arrays (.inspect/session29-report-checks.json). Preview
was restarted after the final public writes before the exact required gates.


Exact final live gate `node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert` PASS. Evidence .inspect/hitch.json,
session29-hitch.json/log: twelve seats, two bot-caused deaths and two observed
respawns, zero post-warmup shader recompiles, >150 ms frames, console errors or
long tasks. Only recorded frame above 24 ms: startup 63.4 ms. Ordinary W/look
navigation samples prove travel through server-owned positions. First received
damage was 21.125 s after live; after the next respawn it was 50.098 s. This Relay
probe is a hitch/respawn gate, not Undertow contact or a pacing distribution.
No storage reset, lifecycle rework, room isolation or probe assertion change.

Cleanup .inspect/session29-cleanup.json: twelve owned final preview processes
stopped; zero remaining owned processes, port8796 listeners or inspection browsers.
Earlier preview trees were also stopped on restart. Read-only git diff whitespace
check passes and every changed/untracked path is within apps/ironsight/**. All
standing gates green. No commit, push or deployment; supervisor owns publication.

Open owner questions/defaults: expand Switchyard next (yes, owner order); retain
both expanded maps while collecting real contact/route/side fairness evidence (yes).
Keep B's two-door court pending human defensive-visibility review (yes). Richer
collider-aligned detail across the now-sparse intermediate yards is a future art
pass; preserve dimensions and texture headroom. Industrial daylight, amber/teal,
stylized sci-fi, server-verified hits and 6v6 defaults remain active. No answer is
required to continue; human mouse/RTT, hands, headphones, iGPU and browsers stay open.


### Session 30 - 2026-09-09: expanded Switchyard and distributed FFA routes

Read the standing brief, Session30 supervisor status, plan and all 63 reference
principles. Branch ironsight-aaa; starting worktree clean. Scope apps/ironsight/**;
no commit, push, deployment, new dependency or purchased derivative. No Meshy
spend: reported balance stays 1530. Existing generated transformers fit the
substation; collider-derived geometry serves this expansion. All 63 scorecard
rows retained/re-audited; learnable recoil ranks first next, with contact/flow open.

Reference: R-M01, R-M02, R-M03, R-M04, R-M05, R-M07, R-M09, R-M10, R-M11,
R-M12, R-M13, R-M15, R-M17, R-M18, R-M19, R-M20, R-L10, R-L11. Checkable targets:
1,250 m2/seat; 10-15 s sprint rotations; 20-30 s first contact; three purposeful
lanes; 40 m rifle corridor; waist/full cover; ground/3/6 m tiers; wall-backed
landmark-facing spawns; collision navigation and a route-changing hook. Density,
rotations, cover, lane clearance and ramp traversal pass. Contact fails the target;
all-objective/human defensive visibility and 6v6/FFA fairness remain partial.

Switchyard grows 60x40 -> 150x100 m, 2,400 -> 15,000 m2 (6.25x), 200 -> 1,250
m2 per twelve seats. The 75x50 two-metre ASCII grid owns 38 full/10 waist boxes,
three ground-level objective anchors and twelve deployment positions. Six 6 m
switchgear halls, the 3 m four-way switching deck and 3 m screens define height;
waist cases remain 1.1 m. No render mesh creates/removes cover. Snapshot version
6 -> 7 resets old layouts through existing migration. No codec change; supervisor
must publish Worker/client together. No persisted-room/lifecycle investigation.

North bus provides a tested clear 40 m eye ray across x55-95 with a 2.4 m strafe
band, plus two-ended A/C courts. Middle Switch deck is the named hook: four
six-metre ramps climb to 3 m, linking east/west and north/south as an exposed
shortcut. Both axes cross both ways at normal walk speed without jumping or an
airborne tick. South service offsets full switchgear around a paired-door B
court. Its sampled north-door approaches fit the default 78-degree FOV from
(75,97); tests include standing-eye occlusion. All-objective full visibility is
not proven. No collision or physics rule was relaxed.

A/C=(25,13)/(125,13); B=(75,93). Four-neighbour one-metre ground BFS:

| Rotation | Walk 6 m/s | Sprint 9 m/s |
|---|---:|---:|
| A-B | 21.67 s | 14.44 s |
| B-C | 21.67 s | 14.44 s |
| A-C | 16.67 s | 11.11 s |

These estimates exclude vertical shortcuts, turning and real retakes. The
public mode remains FFA, with DOM-sized anchors per the reference; this session
does not add another playlist. Standard expanded-map fill supplies twelve bots
or human seats. Training remains an empty traversal map, as the menu promises.

The first natural round rejected a packed six-bay-per-side arrangement: all 288
logged deaths lay in east/west strips. A patrol-only intermediate still left
282/316 there. Both early counts included warmup events and are diagnostic, not
valid live-round totals. Added map-owned patrolWaypoints so Switchyard bots aim
for nine interior route anchors instead of sequential spawn points. Every bot
spawn distributes its first goal by bot id, including respawns (the brain resets
its cursor while dead). All goals use existing GroundNavigator, ordinary W/look
intents, unchanged damage/HP, aim and reaction. Other maps retain their circuits.

Geometry also needed repair: three widely spaced pockets per side plus north/
south pockets replace the shared spawn corridor. Every pair among the twelve
spawns is screened at standing-eye height; each has two lateral clear samples.
All spawn-to-cap and spawn-to-patrol routes pass continuous standing-capsule
clearance checks. Sorted team-pool cap arrival symmetry still passes, but FFA
has no teams and this is not a fairness claim. Natural movement is still too
quick into combat; static hidden spawns do not ensure safe exits.

Final natural production-bot evidence: `$env:SWITCHYARD_METRICS='1'; pnpm exec
vitest run test/switchyard-metrics.tool.test.ts` (remove env after). Normal warmup,
300-second match and respawn clocks; no teleports, bot stat overrides, observer,
scripted paths or repeated-round selection. Harness advances the real simulation;
this is not deployed workerd capacity. Collector clears warmup kills on live entry.
Final 300.0 s FFA: 200 live kills/deaths, highest score 22, timer-ended; 47 deaths
in x<18/x>132 strips, 153 elsewhere. Evidence .inspect/session30-bot-round.json,
session30-bot-round.log, session30-bot-heatmap.svg, session30-contact-summary.json.

| Contact sample | Observed | Min / median / max seconds |
|---|---:|---:|
| Initial eye LOS | 12/12 | 0.6 / 1.05 / 2.2 |
| Initial first damage | 12/12 | 1.6 / 3.75 / 24.9 |
| Respawn eye LOS | 198/199 | 0 / 0.95 / 6.5 |
| Respawn first damage | 193/199 | 0.7 / 4.4 / 36.3 |

LOS is a 100 m eye ray without FOV; zero means observed in the same 100 ms sample
as birth, not an invented missing value. Unobserved lives remain absent. Damage
samples are 100 ms resolution. This one FFA round demonstrates yard coverage,
not balance, human attention, RTT, side-win rates or the unmet 20-30 s rhythm.

Static reference audit .inspect/session30-reference-audit.json: all map cover
classes and rotations logged. Unchanged priority checks: ADS AR/SMG/shotgun/sniper/
pistol 250/200/225/400/165 ms; sprint recovery 120/100/130/150/90 ms. TDM 50 kills/
300 s; DOM neutral/enemy capture 4/8 s, one point/2 s/flag, 200 target, no side
swap. Respawn 3000 ms with existing threat scoring. Enemy/ally foley gain 1.4;
hit 900/1400 Hz at .28, kill 660/990 Hz at .30. Victim flash/direction present;
feed top-right/five rows/weapon and HEADSHOT text, no objective events. Reference
mismatches stay open. No economic, movement-speed or TTK changes this session.

Art now follows current bounds: original cabinet cladding, baked architecture
and ground AO, repositioned exterior halls/transformers/portals, a 26 m north-axis
switching mast, map-scale raceways, deck/court signs, HUD callouts, inspector
cameras and actual-renderer deployment vista. Exterior envelopes pass the existing
no-playable-cover tests. Same lights/static-shadow atlas, passes and resident
textures; lazy per-map GLB. Original commands/provenance in public/assets/README.md.
Final architecture audit: 66,092 source/exported triangles, zero degenerates,
max normal-component error .000300000001, ten material primitives, 5,016,936 bytes,
0.1 mm position tolerance. Evidence .inspect/session30-architecture-audit.log.

Other rejected intermediates: the FFA friendly-fire test still shot through the
new spawn screen, so its isolated open duel moved to the north rifle lane; practice
map-selection now tests that same screen as an intentionally blocked shot. Initial
metrics used nonexistent kills/deaths fields (typecheck caught it; fixed to k/d).
A grid-edit script briefly targeted the TypeScript array annotation; syntax check
caught it and the array was repaired. A north-spawn ray required a boundary-side
screen. Candidate shots and heatmaps predate the final spawn layout and are not
acceptance evidence. No gate assertion or performance threshold was weakened.

Final visual/performance, required gates and cleanup evidence follows below.


Final renderer evidence: .inspect/session30-before-report.json and
session30-accepted-report.json, with their inspector logs and PNGs. Opened before/
accepted overview and accepted vista, deck and route captures. The first service
camera sat inside newly placed cover; rejected that screenshot and moved the
inspector camera to open ground (57,87). Final opened
session30-service-repaired-switchyard-service.png/report.json supersedes the
accepted-prefix service PNG. This was an offline camera defect, not a reachable
player position or missing collision. Final required inspector uses the rebuilt
bundle after a preview restart, with no final public asset writes afterwards.

Matched effects workload, Edge152 / RTX5070 D3D11, 1920x1080 balanced/DPR1,
eleven remote operators plus local hands/rifle, 145 twelve-rifle volleys, 96
blasts and 2,130 steady samples, with full effect drain (.inspect/session30-delta.json):

| Metric | Before | Accepted | Delta |
|---|---:|---:|---:|
| Peak calls | 215 | 189 | -26 |
| Peak submitted triangles | 91,918 | 133,374 | +41,456 |
| Resident textures | 26 | 26 | 0 |
| Estimated texture MiB | 61.5846 | 61.5846 | 0 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0 / 0 / 0 |
| Maximum / first-ready max ms | 7.6 / 7.1 | 7.7 / 7.1 | +0.1 / 0 |
| Prepared programs | 19 | 19 | 0 |

Cameras/actors follow the expanded layout, so visibility changes contribute to
call/triangle deltas; this is not an optimization claim. No added light/pass or
texture MiB. Switchyard texture headroom is ~2.415 MiB; Relay's ~0.249 MiB remains
the global limiting fixture. Desktop intervals do not establish laptop iGPU,
thermal, cold-driver/GPU timing, twelve real players or network capacity.

Public bytes 21,907,579 -> 24,746,679 (+2,839,100); assets including provenance
15,764,282 -> 18,592,941 (+2,828,659). Architecture +2,810,728 bytes, ground AO
+3,546, vista +12,670, provenance +1,715; bundle/maps +10,441. Largest file is
Switchyard GLB 5,016,936 bytes. Forty MiB public/twenty-five MiB per-file caps
pass, with lazy per-map art. No new allowlist or private asset change.

Required pnpm typecheck; pnpm test (387 passed, six opt-in/existing skips;
40 passing files/four skipped); pnpm build:client; pnpm audit:assets PASS.
Evidence .inspect/session30-{typecheck,test,build-client,audit-assets}.log.
Exact `node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two` PASS; .inspect/session30-required-inspector.log and
session30-required-report.json. Extended Switchyard effects --assert-budgets
PASS. All before/intermediate/final reports have empty console error/forbidden
network arrays (.inspect/session30-report-checks.json).


Exact live command `node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert` PASS. Evidence .inspect/hitch.json,
session30-hitch.json/log: twelve seats, two bot-caused deaths and two respawns;
zero post-warmup shader recompiles, frames >150 ms, console errors or long tasks.
Two recorded frames >24 ms: startup 92.0 ms and 43.3 ms at 60.417 s. Ordinary
W/look navigation samples prove movement. This required Relay TDM probe is a
hitch/respawn check, not Switchyard FFA pacing or real 6v6 acceptance. Local
wrangler emitted a simulation-backlog warning; no client errors or hitch failure.
No room isolation, storage reset, assertion change or bot-stat adjustment.

Cleanup .inspect/session30-cleanup.json: twelve owned final preview processes
stopped; zero remaining owned processes, port8796 listeners or inspection browsers.
Earlier preview trees were stopped before restarts. Read-only git diff whitespace
check passes; all modified/untracked paths remain apps/ironsight/**. All standing
gates green. No commit, push or deployment; supervisor owns preview publication.

Open owner questions/defaults: retain all three larger footprints while improving
contact/retakes from actual play evidence (yes); retain twelve-seat Switchyard FFA
and its exposed four-way switching deck pending human review (yes). Next session:
learnable recoil/shared accuracy, then measured spawn-exit flow, with no combined
TTK/movement/economy retune by guesswork. Richer collider-aligned dressing remains
an art follow-up within the texture budget. Industrial daylight, amber/teal,
stylized sci-fi, server-verified hits and six-versus-six team defaults stay active.
Human hands/mouse/headphones, real RTT/players, iGPU and browser acceptance remain
open. No owner answer is needed to continue.

### Session 31 - 2026-09-09: learnable recoil and shared stance accuracy

Read the standing brief, Session31 supervisor status, complete plan structure and
all 63 design references. Branch ironsight-aaa; starting worktree clean. Scope
apps/ironsight/** only; no commit, push, deployment, dependency or purchased-source
change. No Meshy spend (reported balance 1530): aim behavior needs shared code,
not another prop. Scorecard re-audited above; spawn-exit/contact flow ranks first next.

Reference: R-G04, R-G05, R-G06, R-G08, R-G20. Checkable targets: near-zero still
opening cone; movement substantially larger than the 16-34% crouch bonus; four
vertical automatic opening shots followed by repeatable sideways drift; bounded
center-biased randomness only deeper in the spray; multiplicative ADS/crouch;
one shared data/model for server rays, honest claims and local aim. Implementation
checks pass; R-G05 remains partial because recovery is timed, not an instantaneous
release reset, and human learning/comfort is untested. R-G08 remains partial: no
separate reduce-view-kick setting. No human/iGPU/6v6 acceptance is implied.

WeaponSpec now owns a RecoilProfile (src/recoil.ts): absolute angular offsets from
raw mouse aim, capped at the end of a finite sequence. First shot is centered;
AR/SMG shots 1-4 are vertical, then drift right/left respectively. Peak vertical
hip offsets AR/SMG/shotgun/sniper/pistol are .030/.024/.018/.025/.016 radians
(about 1.72/1.38/1.03/1.43/.92 degrees). Slow shotgun/sniper settle between shots;
their second pattern entry provides immediate feedback after a shot, not a hidden
penalty on the next fully recovered trigger. Damage, pellet pattern, cadence,
movement, map geometry, capture economy and twelve-seat fill are unchanged.

| Weapon | Still cone rad (before -> now) | Added moving / air rad | ADS multiplier | Deep cone after N shots | Full recovery after last shot |
|---|---|---|---|---|---|
| AR | 0 -> 0 | .02 / .05 | .65 | .003 after 8 | 450 ms |
| SMG | .004 -> .0002 | .03 / .06 | .70 | .004 after 7 | 347.5 ms |
| Shotgun | 0 -> 0 | .02 / .05 | .80 | .002 after 8 (normally settles first) | 500 ms |
| Sniper | .0005 -> .0001 | .12 / .20 | .50 | .002 after 8 (normally settles first) | 550 ms |
| Pistol | .002 -> .0002 | .02 / .05 | .65 | .002 after 5 | 430 ms |

Grounded crouch multiplies the accuracy cone by .75, stacking with ADS; airborne
crouch receives no bonus. ADS also scales deterministic aim offset. Two independent
uniform draws produce triangular center-biased jitter with variance 1/6 of squared
half-angle (uniform was 1/3). The server and local claim call the same function
with independent RNG streams. Hybrid plausibility is centered on the server's
recoil-adjusted ray; its existing tolerance/occlusion/rewind policy is unchanged.
That tolerated claim channel does not prove cheat-proof randomness or pixel-exact
client/server correspondence. No widening of its acceptance gate was introduced.

Only accepted server shots advance the burst. Cadence, handling, reload, swap,
ammo and liveness rejection return owner-only recoilSync when a valid fireSeq is
present; the client's bounded queue replays only still-pending predicted shots.
Old acknowledgments cannot resurrect an earlier weapon/life after reset. Fire
messages include current validated raw yaw/pitch atomically so mouse compensation
does not wait for the throttled look stream. Clients never supply a trusted recoil
count, timestamp or offset. Legacy fire messages still work, with server recoil.
These additive developer messages do not alter the binary schema or snapshot
version, but client and Worker must publish together for correct visual prediction.

No explicit release-reset message: after min(150 ms, 1.5 fire intervals) of silence,
the offset decays linearly over the profile's recovery time. This is a deliberate
security exception to the literal immediate-release reference: a forged up/down
pair cannot earn centered shots at automatic cadence. Server arrival time drives
recovery; local prediction uses estimated server time. ADS/reload/death/switch
continue through their existing handling gates. Reduced motion keeps authoritative
aim exactly the same as ordinary rendering; no new light, pass or runtime bake.

Tests cover per-weapon cone and recovery boundaries, automatic vertical/lateral
ordering, center-biased variance, pending-shot/rejection reconciliation, stale
replies after reset, real-room accepted rays, forged reset/index fields, same-time
fire rejection, atomic mouse compensation, malformed angles, reload and swap.
Existing two-bot combat test initially failed (15 hits vs required 20): its external
ArenaBot client assumed zero recoil. That client now subtracts the public pattern
through ordinary look intents, retaining seeded aim error, movement, ammo and all
combat assertions. Production filler-bot HP/damage/aim/reaction were not changed;
they receive the same new server recoil as players. No test threshold was weakened.

Rejected intermediates: config validation initially widened an array element to
implicit any (typecheck caught it; fixed explicit unknown validation); one edit
used a root-relative path from the app cwd and wrote nothing. The first browser
spray held for one second and observed too few accepted shots to reach the
8-shot lateral assertion; the workload now holds for 1.8 s with the same required
shot count and records per-slot evidence even on failure. Subsequent recoil probes
passed, but a handling run during active development/reloads measured 403.3 ms
sprint recovery against its unchanged 300 ms upper bound. That run is rejected;
final isolated checks below supersede it. No hitch or standing gate assertion changed.

Final measured renderer, control, gates and cleanup evidence follows.

Final control evidence: .inspect/session31-final-report.json, final-inspector.log,
recoil-1..5.json and matching ready/held/recovered PNGs; compact measurements in
session31-recoil-summary.json. Command: `node scripts/inspect-map.mjs --url
http://localhost:8796 --shots recoil,handling,effects-stress --assert-handling
--assert-budgets --prefix session31-final`. All assertions PASS. Actual held-mouse
shots AR/SMG/shotgun/sniper/pistol: 13/16/3/2/9. Peak local pitch offsets reach
.030/.024/.018/.025/.016 rad; automatic yaw peaks .007/.009 rad. All five recover
to index zero and exactly zero angular offset. SMG briefly predicts index17 and
settles to authoritative count16, demonstrating a corrected in-flight difference.
Counts include the held capture interval; they are not weapon cadence benchmarks.

Final ADS fully-settled local times 252.7/207.1/234.6/408.5/170.4 ms;
first received self-shot 308.5/265.5/291.0/465.7/219.3 ms. Pistol sprint-to-fire
first received self-shot 124.4 ms (server setting 90 ms). These include browser,
tick and transport scheduling; they are not RTT measurements. Final stable-build
handling succeeds within every original bound, superseding the 403.3 ms rejected
run. Final source/build stayed unchanged throughout final inspector and live gates.

Before evidence: .inspect/session31-before-report.json, before-inspector.log and
before-* PNGs. Opened before ADS acquisition, final AR ready/held/recovered, final
sniper held, and required Undertow practice. AR's sightline rises against the roof
while firing, then returns to the ready alignment; central combat corridor stays
clear. Different ADS/hip frames are presentation evidence, not matched camera
pixel deltas. Five-weapon sampled offsets and server-ray tests establish the new
behavior. Human wrist/finger motion and mouse comfort remain unaccepted.

Matched renderer workload (before/final reports, session31-delta.json): Edge152,
RTX5070 D3D11, 1920x1080 balanced/DPR1; eleven remote operators and local rifle,
145 twelve-rifle volleys, 96 blasts, 2,130 steady samples, complete effects drain.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak draw calls | 220 | 220 | 0 |
| Peak submitted triangles | 128,906 | 128,906 | 0 |
| Resident textures | 30 | 30 | 0 |
| Estimated texture MiB | 63.7513 | 63.7513 | 0 |
| Median / p95 / p99 ms | 6.9 / 7.1 / 7.1 | 6.9 / 7.1 / 7.1 | 0 / 0 / 0 |
| Maximum / first-ready max ms | 7.2 / 7.1 | 7.8 / 7.1 | +0.6 / 0 |
| Browser-resident programs | 27 | 27 | 0 |

The effects fixture measures rendering cost, not competitive aim or true GPU time.
Program totals include shaders retained across earlier browser views. Same light
count/passes/assets; no added texture MiB. Remaining limiting fixture texture
headroom ~.249 MiB. Desktop intervals do not prove laptop iGPU, cold-driver,
thermal, browser portability, real twelve-player networking or mouse acceptance.

Session31 static reference audit reproduced with tools/reference-audit.ts;
.inspect/session31-reference-audit.json includes the new accuracy/recoil table.
Map heights/rotation timings are unchanged from Session30. ADS/sprint settings
remain 250/200/225/400/165 and 120/100/130/150/90 ms. TDM 50 kills/300 s; DOM
4/8 s neutral/enemy capture, 1 point/2 s/flag, 200 target, no side swap. Live
respawn remains 3000 ms with threat-aware scoring; enemy/ally foley gain1.4;
hit/kill two-tone confirmations, victim flash/direction, five-row top-right feed
remain. These unchanged reference mismatches are still marked partial/not yet.
No map pacing or side fairness acceptance is inferred from this gunplay session.

Public bytes 24,746,675 -> 24,762,596 (+15,921, generated client bundle/maps);
assets including provenance remain 18,592,941 (delta0). Largest file remains
Switchyard architecture 5,016,936 bytes. Evidence session31-bytes.json. Public
40 MiB and per-file25 MiB caps pass. No new art allowlist/provenance requirement.

Required pnpm typecheck, pnpm test (404 passed, six existing/opt-in skips; 41
passing files/four skipped), pnpm build:client and pnpm audit:assets PASS.
Evidence .inspect/session31-{typecheck,test,build-client,audit-assets}.log.
Exact required `node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two` PASS; session31-required-inspector.log and copied
session31-required-report.json. Before/final/required reports have zero console
errors and forbidden offline network requests (session31-report-checks.json).

Exact required live command `node scripts/hitch-probe.mjs http://localhost:8796
150000 .inspect/hitch.json --assert` PASS. Evidence .inspect/hitch.json,
session31-hitch.json/log: twelve seats, two bot-caused deaths, two respawns, zero
post-warmup shader recompiles, frames >150 ms, console errors or long tasks.
Only recorded frame >24 ms: startup59.1 ms. Live begins at7.914 s; first damage
at30.262 s (22.348 s after live), first death77.018 s, respawn80.086 s, second
death95.524 s and respawn98.593 s. The ordinary W/look route moved through
server-owned positions; no teleports, room isolation, storage reset, lifecycle
rework or bot-stat overrides. This is a hitch/respawn gate, not a new contact
pacing distribution or proof that production bots have mastered recoil.

Cleanup .inspect/session31-cleanup.json: twelve owned final preview processes
stopped; zero owned processes, port8796 listeners or inspection browsers remain.
Earlier preview trees were stopped before rebuild/restarts. Read-only git diff
whitespace and scope checks pass: every modified/untracked path is within
apps/ironsight/**. All standing gates green; no commit, push or deployment.

Open owner questions/defaults: retain modest fixed patterns and timed recovery
pending mouse review (yes); preserve server/claim parity while collecting real
RTT/comfort evidence (yes). Next session tackle spawn-exit/contact flow, especially
Switchyard FFA, using natural telemetry and collision-aligned routes. Do not
retune movement, TTK and economy together by guesswork. Keep industrial daylight,
amber/teal, stylized sci-fi and six-versus-six team defaults. Moving hands,
headphones, real players/RTT, iGPU and browser acceptance remain open. No owner
answer is needed to continue; supervisor owns publication.

### Session 32 - 2026-09-09: recent sightline memory for safer respawns

Read the standing brief, Session32 supervisor status, plan and all 63 references.
Branch ironsight-aaa, clean starting worktree, scope apps/ironsight/** only.
Reference: R-M09, R-M20, R-M07, R-L04. Checkable target: remember authoritative
spawn exposure for three seconds after an enemy leaves sight, sample at most
2 Hz, preserve unoccupied/currently hidden priority, and measure natural contact.
The memory/priority checks pass; R-M09 and R-M20 remain partial and the 20-30 s
R-M07 contact target remains not yet. No geometry or bot-stat retune by guesswork.
This session closes a bounded part of the highest-ranked spawn gap; its visible
evidence is encounter distribution, not a new art asset. Environment orientation
now ranks first for the next session's first-glance improvement.

SpawnSightHistory records four-body-sample visibility from authoritative player
positions against the existing collision boxes. Each enemy's remembered exposure
adds at most 60 danger points, fading linearly to zero over 3000 simulation ms.
This is a soft addition after occupancy/current exposure, alongside existing
proximity danger; no remembered risk can select a currently exposed candidate
when an equally unoccupied hidden one exists. Friendly/self/dead players do not
contribute enemy danger; FFA treats other seats as hostile. Current sightlines
are always checked at selection even between historical samples. There is no
claim that a 2 Hz sample catches every brief peek or predicts enemy movement.

History uses currentTick*TICK_MS, with sampling after movement and before due
respawns. Stable map spawn-point references bound the table to twelve anchors
by seated players. Death and seat expiry forget the enemy immediately, sample
pruning removes absent/dead ids, and resetMatch clears the old round. A fresh
room starts without stale history. No persisted state/codec/version changes,
client messages, shield/timer changes or lifecycle rework. No client-visible
positions are added. No new lights, passes, dependencies, assets or Meshy spend
(reported balance1530). Server-verified combat remains in place.

Four new regression tests cover a remembered lane after cover closes, expiry,
current-LOS precedence, FFA/friendly distinctions, clearing and sample cadence.
The existing real-room all-map spawn tests pass. Added tools/spawn-history-audit.ts
for repeatable local CPU cost. The Switchyard natural-round tool now accepts
METRICS_PREFIX (validated filename prefix), so later sessions preserve separate
reports instead of overwriting Session30 evidence.

Natural production-bot FFA, same tool seed0x30abc, twelve seats, full300 s rounds,
normal movement/reaction/HP/damage/respawn/recoil, no scripted routes or teleports:

| Contact sample | Before | Final |
|---|---|---|
| Total live kills | 207 | 212 |
| Initial first LOS min/median/max s (12/12 each) | .6/.8/3.2 | .6/.8/3.2 |
| Initial first damage min/median/max s (12/12 each) | 1.4/7.25/31 | 1.1/3.5/10.8 |
| Respawn first LOS min/median/max s | 0/.9/7 (204/205) | 0/1.1/6.2 (208/209) |
| Respawn first damage min/median/max s | .7/4.2/43.4 (200/205) | .7/4.8/22.4 (203/209) |

The small respawn median change is not general balance improvement: initial
damage contact shortened, outcomes diverge, and one round per policy cannot
establish fairness. LOS is an unobstructed100 m eye ray without FOV; 100 ms
sampling, absent contacts stay absent. Evidence .inspect/session32-{before,final}-
bot-round.json and bot-heatmap.svg, session32-contact-summary.json and opened
session32-contact-comparison.png. Death density still favors southern routes;
the memory does not solve Switchyard's fast FFA rhythm or all-exposed pools.
Reproduce final: SWITCHYARD_METRICS=1 METRICS_PREFIX=session32-final pnpm exec
vitest run test/switchyard-metrics.tool.test.ts (set env vars in the host shell).

CPU fixture .inspect/session32-spawn-history-audit.json, local Node, twelve
occupants cycling legal map spawn anchors,120 warmup/600 measured samples per map:

| Map | History observation median/p95/max ms | Spawn selection median/p95/max ms |
|---|---|---|
| Relay | .526/.619/1.408 | .524/.596/1.111 |
| Undertow | .541/.669/1.112 | .540/.697/1.097 |
| Switchyard | .982/1.385/3.150 | .979/1.411/3.458 |

Observation is at most twice per second; selection occurs on spawn. This fixture
keeps all anchors occupied and changes zero choices; it measures bounded cost,
not historical-policy benefit. Regression fixtures and the natural round exercise
policy differences. Local Node CPU is not deployed workerd capacity or latency.

Opened before/final Switchyard effects-stress PNGs: presentation is unchanged.
Reports .inspect/session32-{before,final}-report.json and render-delta.json:
Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1, eleven remote operators plus local
rifle,145 twelve-rifle volleys,96 blasts,2130 steady samples and full effect drain.
Peak calls189 ->189; triangles133374 ->133374; textures26 ->26; estimated texture
MiB61.5846 ->61.5846; programs19 ->19. Median/p95/p99 frame intervals6.9/7.1/7.1 ms
unchanged; max7.6 ->7.3 ms. Same geometry/lighting/assets; no optimization claim.
Desktop frame intervals do not establish iGPU60 fps, thermal/cold-driver or6v6 RTT.

Public bytes24,762,596 ->24,762,596 (delta0); assets including provenance18,592,941
(delta0), largest Switchyard architecture5,016,936 bytes. Forty MiB public and
25 MiB per-file caps pass. Evidence session32-bytes.json. Static reference audit
session32-reference-audit.json reproduces unchanged map heights/rotations,
ADS/sprint timers, mode economy, respawn and audio/HUD checks. Existing unmet
reference rows remain honest; no new art allowlist/provenance requirement.

Rejected intermediates: initial hidden-enemy unit fixture was still visible past
the wall endpoint; corrected its position and retained the false-LOS assertion.
An out-of-order multi-hunk patch failed atomically and was reapplied in source
order. Byte-summary reader first assumed UTF16 for a UTF8 file; corrected the
reader without changing evidence. No gameplay/gate assertion was weakened.

Required pnpm typecheck; pnpm test (408 passed,6 existing/opt-in skips;41 passing
files/4 skipped); pnpm build:client; pnpm audit:assets PASS. Logs:
.inspect/session32-{typecheck,test,build-client,audit-assets}.log. Before/final
Switchyard effects inspection with --assert-budgets PASS. Exact required command
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS; session32-required-inspector.log and required-report.json. All three reports
have empty console-error and forbidden-network arrays.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS. Evidence .inspect/hitch.json and
session32-hitch.json/log: twelve seats, two bot-caused deaths and two respawns;
zero post-warmup shader recompiles, frames >150 ms, browser console errors or
long tasks. One recorded frame >24 ms: startup60.5 ms. Live at6.755 s, first
damage27.058 s (20.303 s after live), deaths29.143/84.376 s, respawns32.211/
87.431 s. Ordinary W/look navigation through server positions, no teleport,
room isolation, storage reset, probe threshold or bot-stat change. This Relay
hitch run is not a Switchyard pacing distribution or real-player acceptance.
Local Wrangler logged a simulation-backlog warning and Network connection lost;
the browser gate passed with zero errors. Those server-log messages are retained
in session32-final-server-error.log; no attribution to a specific cause is claimed.

Cleanup .inspect/session32-cleanup.json: twelve owned final preview processes
stopped; root no longer alive, zero port8796 listeners and inspection browsers.
The earlier preview tree was stopped before final build/restart. Final code and
public assets stayed unchanged throughout final inspections and hitch gate.
Read-only whitespace/scope checks pass. No commit, push, deploy or external
publication; supervisor owns preview release. All standing gates green.

Open owner questions/defaults: retain three-second soft sightline memory pending
real spawn-camping review (yes); prioritize visible Undertow/Switchyard orientation
next rather than increasing the danger weight until telemetry looks better (yes).
Keep the larger footprints, industrial daylight, amber/teal, stylized sci-fi,
server-verified hits and six-versus-six team defaults. Human mouse/hands, headphones,
real players/RTT, iGPU/thermal and browser acceptance remain open. No owner answer
is needed to continue. Next session: first-glance landmark/lane orientation with
before/after views and the same resident-texture and performance budgets.


### Session 33 - 2026-09-09: Undertow silhouettes and half orientation

Read the standing brief, Session33 supervisor status, plan and all 63 design
references. Branch ironsight-aaa, clean starting worktree, apps/ironsight/** only.
Reference: R-M08, R-M13, R-M17. Checkable target: distinguish west/east by shape
as well as colour, distinguish north/south skyline, preserve every collision
volume, and add zero resident texture MiB. Those bounded implementation checks
pass. Reference rows remain partial: actual route learning, all-lane visibility
and Switchyard half distinction are not established by these captures.

Undertow now has three pale west filter vessels (21/26/21 m high), an amber east
service gantry (13 m top), a forked north intake crown (34 m top) and two unequal
south pump-service flues (18.2/14.2 m tops). Teal west/amber east accents break up
the repeated cover kit; the broad bands remain flush with existing solid faces.
West/east wall labels reuse the existing eight-row 1024px sign atlas. Removed the
old UNDERTOW label occupying the same north-wall face as CLARIFIER ROUTE. The
original production-renderer deployment vista is refreshed to match the map.

New opaque structures are exterior: west vessels/rails stay x <= -4.76 m; east
gantry/stripes stay x >= 154.15 m; crown stays z <= -16.5 m; south flues stay
z >= 104.5 m. None creates playable cover or masks an in-bounds opponent. No
map tiles, bounds, ramps, spawns, caps, bot navigation, server rules or combat
messages changed. The north crown remains a north-axis landmark outside the
arena, not a literal central weenie: R-M17 remains partial. Moving it into play
would require a collision/layout decision; this visual pass does not do that.

The original kit is rebaked through tools/dump-architecture.mjs and Blender4.5
Cycles, preserving authored normals and the existing 1024px AO image. Ground AO
is collision-derived and unchanged. Same lights, cached shadow pass and lazy
map loading; no new dependencies, texture, per-frame bake or paid generation.
Meshy not used: simple industrial silhouettes fit existing materials within the
tight texture budget. Reported balance1530 and session spend0 credits.
Provenance and exact reproduction commands added to public/assets/README.md.

Architecture audit .inspect/session33-architecture-audit.log: 48,928 source and
exported triangles, zero degenerates, max normal-component error .000301,
positions within .0001 m, finite UVs and one embedded AO image. Ten material
primitives, source dump session33-architecture.json, bake log session33-bake.log.
The previous bake was 47,176 triangles; delta +1,752. Reuses the material palette;
an existing colour on cylinders introduces a primitive, not a new texture.

Before/final matched production views: .inspect/session33-{before,final}-
undertow-{vista,home,maintenance,effects-stress}.png and corresponding report.json
and inspector.log files. Opened both vistas: west vessel bank and forked north
crown now give the skyline clear height variation; amber cladding identifies
the east half. Additional opened eye-level closeups session33-west-undertow-home,
session33-east-undertow-home and session33-south-undertow-center PNGs show the
actual new equipment above perimeter walls. These closeups aim upward and are
not proof of normal-forward or all-lane visibility; their labels crop at this
short distance. They are supplementary geometry checks, not matched before/after
or player wayfinding approval. Reports retain exact review-camera coordinates.

Matched effects fixture, session33-render-delta.json: Edge152/RTX5070 D3D11,
1920x1080 balanced/DPR1, eleven remote operators plus local rifle, 145 twelve-rifle
volleys,96 blasts,2130 steady samples, complete effect drain; --assert-budgets PASS.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls including shadow work | 189 | 189 | 0 |
| Peak submitted triangles | 112214 | 113966 | +1752 |
| Resident textures | 23 | 23 | 0 |
| Estimated texture MiB | 60.2513 | 60.2513 | 0 |
| Median/p95/p99 frame interval ms | 6.9/7.1/7.1 | 6.9/7.1/7.1 | 0 |
| Max / first-ready max ms | 7.6/7.1 | 7.6/7.1 | 0 |
| Browser-resident programs | 19 | 19 | 0 |

Static maintenance view adds one call (17 ->18); vista calls24 ->24, home21 ->21.
No performance improvement claimed. Desktop frame intervals do not prove iGPU
60 fps, cold-driver/thermal performance, real twelve-player networking or human
comfort. Reference audit .inspect/session33-reference-audit.json reproduces the
unchanged cover classes, 10-15 s ground sprint rotations, 1,250 m2/seat, handling
timers, mode economy, spawn timer, audio and HUD checks. Prior short-contact and
DOM economy mismatches remain open; no bot pacing rerun for unchanged gameplay.

Public bytes24,762,596 ->24,930,129 (+167,533); assets including provenance
18,592,941 ->18,755,619 (+162,678). Undertow GLB3,783,288 ->3,937,488 (+154,200),
vista121,214 ->128,178 (+6,964); remainder documentation/client bundle and source
map. Largest file remains Switchyard architecture5,016,936. Evidence
session33-bytes.json. Public40 MiB/per-file25 MiB caps pass.

Rejected intermediates: no generated model or art bake rejected. One early rg
search used a Windows wildcard path that rg did not expand; repeated against
the directory. Supplementary perimeter closeups are too close to read whole
wall labels, so they do not count as wayfinding acceptance. No gate threshold,
bot stats or gameplay rule weakened. Runtime source and geometry stayed fixed
through final inspections. The first hitch passed its assertions but contained a
local server reload at60.1 s after editing public/assets/README.md (server log
confirms Reloading). Retained session33-reloaded-hitch.json/log and reran on a
new preview process with all source/public files fixed; no runtime lifecycle
change or probe modification. This uninterrupted repeat is the accepted gate.

Required pnpm typecheck; pnpm test (408 passed,6 existing/opt-in skips;41 passing
files/four skipped); pnpm build:client; pnpm audit:assets PASS. Evidence
.inspect/session33-{typecheck,test,build-client,audit-assets}.log; asset audit
rerun after the refreshed vista and provenance. Exact required inspection:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS; session33-required-inspector.log and session33-required-report.json.
All six before/final/supplementary/required reports have zero console errors and
forbidden offline network requests; session33-report-checks.json.


Exact required `node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert` PASS on the stable repeat. Evidence .inspect/hitch.json,
session33-hitch.json/log and session33-stable-server.log. Twelve seats, two
bot-caused deaths and two respawns, zero post-warmup recompiles, frames >150 ms,
console errors or long tasks. Single warmup ->live transition at6.693 s, first
damage27.928 s (21.235 s after live), deaths30.277/96.878 s, respawns33.351/
99.939 s. Ordinary W/look movement and server-owned positions, unchanged probe,
no isolation/storage reset/teleports or bot-stat edits. This Relay gate does not
establish Undertow route learning or contact distribution. The earlier server
log retains backlog warnings; the final browser assertions remain green.

Cleanup .inspect/session33-cleanup.json: twelve owned stable preview processes
stopped, root no longer alive, zero port8796 listeners or inspection browsers.
Earlier preview trees also stopped (session33-before-stopped.json and
session33-first-final-cleanup.json). Read-only whitespace and scope checks pass:
all five changed paths are apps/ironsight/**. All standing gates green. No commit,
push, deployment or external publication; supervisor owns preview release.

Open owner questions/defaults: keep the west filter/east gantry contrast pending
human orientation review (yes); carry the same material-budget approach to
Switchyard next (yes). Keep industrial daylight, amber/teal, stylized sci-fi,
server-verified hits and 6v6 team defaults. All-lane landmark visibility, moving
hands, headphones, real players/RTT, iGPU/thermal and browser acceptance remain
open. No owner answer needed to continue. Next session: Switchyard half/lane
orientation, with matched views and no new texture budget assumed.

### Session 34 - 2026-09-09: Switchyard capacitor bank and crane orientation

Read the standing brief, Session34 supervisor status, plan and all 63 references.
Started clean on ironsight-aaa; scope apps/ironsight/** only. Reference: R-M08,
R-M13, R-M17. Target: distinguish west/east by silhouette as well as colour,
strengthen the south service identity, preserve collision and add zero resident
texture MiB. These bounded implementation checks pass. Rows remain partial:
human route learning, all-lane visibility and a literal central weenie are open.
All 63 scorecard rows retained; re-ranked unresolved natural contact first, then
first-play presentation. No owner feedback justified a gameplay retune this session.

West now has three ribbed ceramic capacitor towers, 24.2/31.2/24.2 m at the
terminal tips. East has a 49 m wide amber maintenance crane, 21.3 m at its rails,
with a suspended service block; east boundary accents reuse amber. South has
three broad ventilation monitors on the exterior service hall, 13.4 m tops.
The existing north bus mast remains the north-axis landmark. New west geometry
stays x <= -4.8 m, crane x >=153.9 m, roof monitors z >=105.3 m. No new opaque
geometry inside play, no changes to boxes, ramps, spawns, caps, bots, movement,
server-verified hits, room lifecycle or codec. Collision-derived ground AO stays
unchanged. Same lighting, cached shadow pass, lazy map assets and dependencies.

Original procedural geometry uses the existing kit palette and one 1024px AO
image, rebaked in Blender4.5 Cycles with Standard transform and authored normals.
No Meshy generation: these simple electrical silhouettes fit the existing texture
budget. Reported balance1530, session spend0 credits. Existing explicit original
asset allowlists apply; provenance/reproduction appended to public/assets/README.md.
Architecture audit .inspect/session34-architecture-audit.log: 68,588 triangles,
zero source/export degenerates, max normal-component error .000300000001,
positions within .0001 m, finite UVs and one AO image; ten material primitives.
Source dump session34-architecture.json and bake log session34-bake.log.

Matched .inspect/session34-{before,final}-switchyard-{vista,center,service,
effects-stress}.png and report.json/inspector.log files. Opened both vistas:
the west towers clearly break the former box silhouette; east amber wall panels
identify the opposite half. Refreshed production-renderer deployment vista.
Opened supplementary session34-{west,east}-switchyard-center.png: opposing views
from (75,4.65,50), standing on the authoritative 3 m deck, show the capacitor
bank versus the crane above cover. Both look slightly upward toward y10, so
they establish this viewpoint only. Opened session34-south-switchyard-service.png
shows the roof monitors above a foreground cabinet; much of the hall is occluded.
These are geometry/orientation checks, not all-lane or human callout acceptance.

Matched effects fixture, .inspect/session34-render-delta.json: Edge152/RTX5070
D3D11,1920x1080 balanced/DPR1, eleven remote operators plus local rifle,145
twelve-rifle volleys,96 blasts,2130 steady samples and complete effect drain.
Both --assert-budgets runs pass.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls including shadow work | 189 | 189 | 0 |
| Peak submitted triangles | 133374 | 135870 | +2496 |
| Resident textures | 26 | 26 | 0 |
| Estimated texture MiB | 61.5846 | 61.5846 | 0 |
| Median/p95/p99 frame interval ms | 6.9/7.1/7.1 | 6.9/7.1/7.1 | 0 |
| Max frame interval ms | 7.4 | 7.2 | -.2 |
| First-ready max ms | 7.0 | 7.1 | +.1 |
| Browser-resident programs | 19 | 19 | 0 |

No performance improvement claimed; desktop intervals do not establish iGPU
60 fps, thermal/cold-driver performance, networking or human comfort.
Public bytes24,930,129 ->25,155,144 (+225,015); Switchyard architecture5,016,936
->5,229,544 (+212,608), vista129,730 ->136,488 (+6,758). Remaining bytes are
provenance/client bundle and source map. Largest file5,229,544; public40 MiB and
per-file25 MiB caps pass. Evidence session34-{before,final}-bytes.json.
Static .inspect/session34-reference-audit.json reproduces unchanged map cover
classes, ground sprint rotations,1,250 m2/seat, weapon handling, mode economy,
respawn, audio and HUD checks. No new pacing distribution for unchanged gameplay;
prior natural-contact and DOM-economy mismatches remain open.

Rejected intermediates: no art bake/model rejected. Initial byte query used
assets/maps/switchyard-vista.webp instead of assets/switchyard-vista.webp; corrected
the recorded baseline before comparison. No test/probe threshold or gameplay rule
weakened. Art preview was stopped after writing vista/provenance, before the stable
required gates, to avoid counting a file-triggered reload as an uninterrupted run.

Required pnpm typecheck; pnpm test (408 passed,6 existing/opt-in skips;41 passing
files/four skipped); pnpm build:client; pnpm audit:assets PASS. Evidence
.inspect/session34-{typecheck,test,build-client,audit-assets}.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS; session34-required-inspector.log and required-report.json. All six inspection
reports have zero console errors/forbidden network requests; report-checks.json.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS. Evidence .inspect/hitch.json and
session34-hitch.json/log: twelve seats, two bot-caused deaths, two respawns,
zero post-warmup recompiles, frames >150 ms, console errors or long tasks.
Only frame >24 ms was startup64.3 ms. Single live transition8.054 s, first damage
28.754 s (20.700 s after live), deaths32.782/92.600 s, respawns35.712/95.641 s.
Ordinary probe movement through server-owned positions; no teleport, isolation,
storage reset, bot-stat edit or lifecycle rework. Stable server log has no reload;
server-error.log retains simulation-backlog warnings. Browser assertions pass;
this Relay hitch run does not establish Switchyard pacing or deployed capacity.

Cleanup .inspect/session34-cleanup.json: twelve owned stable preview processes
stopped, zero remaining owned processes, port8796 listeners or inspection browsers.
Earlier preview trees stopped as recorded in before-cleanup.json/art-cleanup.json.
Read-only whitespace and scope checks pass: all five changed paths are inside
apps/ironsight/**. A post-gate inline Node summary command lost quotes in the
Windows shell; used PowerShell JSON parsing instead, without altering evidence.
All standing gates green. No commit, push, deploy or external publication.

Open owner questions/defaults: retain west capacitor/east crane contrast pending
human route-learning review (yes); next prioritize natural spawn-exit/contact
evidence or a bounded first-play presentation improvement (yes). Keep industrial
daylight, amber/teal, stylized sci-fi, six-versus-six team defaults and twelve-seat
Switchyard FFA. Hands, headphones, real players/RTT, iGPU/thermal and browser
acceptance remain open. No owner answer needed; supervisor owns publication.

### Session 35 - 2026-09-09: guided first steps in training

Read standing brief, Session35 status, plan and all 63 references. Started clean
on ironsight-aaa; scope apps/ironsight/** only. Reference: R-L09. Target: one
peripheral lesson at a time; recognize 4 m actual movement, 500 ms fully acquired
ADS, and a server-confirmed target hit. Never assign shooting on empty maps.
These bounded checks pass. R-L09 remains partial: objective/ping lessons and
human learning review remain open. All 63 scorecard rows retained, static audit
reproduced and gap list re-ranked. Spawn fairness remains first overall; selected
the next bounded first-play item without another evidence-free gameplay retune.

TrainingCoach adds an amber/teal card below the minimap with a current instruction
and completed-step count. Relay teaches movement/aim/hit; Undertow/Switchyard
teach movement/aim then direct shooting practice to Relay. Completion suggests
five weapon slots, reload and deployment, clearing after twelve seconds. Already
demonstrated aim/hit counts even if movement is still the current lesson.
Movement samples authoritative x/z displacement, ignores jumps >=2 m and resets
its reference when inactive. Holding a key at a wall cannot advance it. Aim
requires full WeaponHandling acquisition plus 500 ms uninterrupted hold. Hits
consume only Net.onHit confirmation; lesson progress grants no gameplay reward.

Card hides without pointer lock, liveness or connection. Completed steps survive
an in-page pause/reconnect; rejoining starts a fresh lesson. Movement/reload labels
follow current binds. A polite atomic status region uses textContent and updates
text only on step/settings changes. No input interception, animation, audio,
lights, geometry, GPU textures, passes, dependencies or new assets. No collision,
room, bot, wire, lifecycle or hit-rule changes. Meshy spend0, reported balance1530;
no new asset provenance/allowlist needed.

Before .inspect/session35-before-onboarding.png and matched after
session35-training-onboarding-move.png were both opened: unchanged camera/target
line, card in the left margin, clear combat corridor. Also opened Relay completion
and Undertow exploration images. Additional session35-training-onboarding-
{aim,hit,complete}.png and session35-training-practice-two-{move,aim,exploration}.png
show real progression. Completion closeup is an interaction capture, not a
matched before/after view.

New optional inspector --assert-training runs scripts/training-probe.mjs with
normal W movement, right-mouse ADS, look steering and left-mouse fire. Relay
reaches3/3 after a confirmed hit; Undertow reaches2/2 with one seat/no targets.
Both cards fit1920x1080, end left of40% viewport width, have role=status and hide
on pointer unlock. Evidence session35-training-report.json/log and step PNGs.
No lesson-state mutation, teleport or replacement hit message. Screen-reader
speech, narrow-screen ergonomics, rebind interaction and novice learning remain
human review items; no broad accessibility acceptance claim.

Matched before/final Relay effects: session35-{before,final}-perf-report.json,
PNG/log and session35-render-delta.json. Edge152/RTX5070 D3D11,1920x1080 balanced,
eleven remote operators plus local rifle,145 twelve-rifle volleys,96 blasts,
2130 steady samples and complete effect drain. Both --assert-budgets pass.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls including shadow work | 220 | 220 | 0 |
| Peak submitted triangles | 128906 | 128906 | 0 |
| Resident textures | 30 | 30 | 0 |
| Estimated texture MiB | 63.7513 | 63.7513 | 0 |
| Median/p95/p99 frame interval ms | 6.9/7.1/7.1 | 6.9/7.1/7.1 | 0 |
| Max frame interval ms | 7.7 | 8.2 | +.5 |
| First-ready max ms | 7.1 | 7.1 | 0 |
| Browser-resident programs | 27 | 27 | 0 |

Offline effects fixtures do not mount training DOM; the separate real-input
drill verifies its presentation. No performance improvement claimed. Desktop
intervals do not prove iGPU60 fps, thermal/cold-driver or real6v6/RTT acceptance.
Public25,167,281 bytes, +12,137 versus Session34's recorded25,155,144 baseline;
assets18,976,213 unchanged. Bundle1,908,493/source map4,281,967 bytes. Largest
file remains Switchyard architecture5,229,544. session35-bytes.json records the
comparison; public40 MiB/per-file25 MiB caps pass.

session35-reference-audit.json reproduces cover classes, ground sprint rotations,
1,250 m2/seat, ADS/sprint timers, mode economy, respawn, audio and HUD checks.
No new natural pacing distribution for unchanged gameplay. Short FFA contact,
DOM economy and objective/ping learning remain open.

Rejected intermediates: first coach draft formatted instructions every frame;
final caches by step/settings snapshot. No model/visual candidate rejected.
A Windows wildcard rg query, two nonnumeric Select-Object limits and an exact-
context log patch failed; corrected without app/evidence loss. No gate assertion,
threshold or hitch script changed. Final source/public stayed fixed through
required inspection, effects and hitch; stable server log has no reload.
Server-error.log retains simulation-backlog and friendly-hit rejection warnings;
browser gate passed. No attribution of server warnings to an unmeasured cause.

Required pnpm typecheck; pnpm test (408 passed,6 existing/opt-in skips;41 files
passed/four skipped); pnpm build:client; pnpm audit:assets PASS. Evidence
.inspect/session35-{typecheck,test,build-client,audit-assets}.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS; session35-required-inspector.log and required-report.json. Five reports
have zero console errors/forbidden offline network requests; report-checks.json.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS. Evidence hitch.json, session35-hitch.json/log:
twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames >150 ms, console errors or long tasks. Only frame >24 ms was startup62 ms.
Live7.202 s, first damage28.249 s (21.047 s after live), deaths28.855/101.512 s,
respawns31.812/104.566 s. Ordinary probe movement; no isolation, storage reset,
teleport or bot-stat edit. This is Relay stability evidence, not an all-map
natural-contact distribution.

session35-cleanup.json: eleven owned stable-preview processes stopped; zero
remaining owned processes, port8796 listeners or inspection browsers. Earlier
tree stopped in session35-before-cleanup.json. Whitespace/scope checks pass.
All standing gates green. No commit, push, deploy or external publication;
supervisor owns preview release.

Open owner questions/defaults: retain three-step Relay/two-step exploration
coach (yes); restart on rejoin instead of adding account progression (yes);
prioritize spawn/contact evidence and objective/ping learning next (yes).
Industrial daylight, amber/teal, stylized sci-fi, server-verified hits and6v6
team defaults remain. Human hands, headphones, novice learning, real players/RTT,
iGPU/thermal and browser acceptance remain open. No owner answer needed.

### Session 36 - 2026-09-09: readable connection delay and repeated FFA contact evidence

Read the standing brief, Session36 supervisor status, plan and all 63 references.
Started clean on ironsight-aaa; scope apps/ironsight/** only. Reference: R-M07,
R-M09, R-M20, R-L19. Targets: reproduce natural contact across three distinct
seeds against the 20-30 s reference; replace unexplained numeric ping with a
stable, readable delay label without adding render resources. The presentation
implementation checks pass. Contact target remains unmet; all four reference
rows retain their partial/not-yet qualifications. Static reference audit reproduced,
all 63 scorecard rows retained, gap list re-ranked toward southern spawn exits.

Connection panel now reads MEASURING DELAY, LOW DELAY, NETWORK DELAY or HIGH
NETWORK DELAY, with numeric RTT/FPS underneath. Known transport loss immediately
shows RECONNECTING, then CONNECTION LOST on the existing expired-seat signal.
This consumes existing Net.online/connectionExpired; no heartbeat, protocol,
reconnection or room lifecycle change. It does not fix the previously documented
slow detection of some actual outages. RTT estimates alone cannot establish
packet loss, jitter, server health or competitive hit fairness.

Presentation defaults: below80 ms low, >=80 ms delayed, >=160 ms high; recovery
below65/140 ms and two seconds of sustained band change prevent boundary flicker.
These are authored UX bands, not numbers claimed from R-L19. Invalid/nonpositive
RTT remains measuring; known disconnect overrides a retained estimate. Only the
status label enters a polite live region; numeric values update at most2 Hz and
only when text changes. Text plus teal/amber accents avoid colour-only status.
The small-screen training card and minimap leave room for the two-line panel.

No lights, passes, GPU textures, geometry, assets or npm dependencies added. No
collision, bot policy/stats, movement, damage, server-verified hit, codec or room
change. Meshy spend0, reported balance1530; no asset generation/provenance change
needed for this DOM/tooling session. Existing purchased derivatives stay ignored.

Opened matched .inspect/session36-before-onboarding.png and
session36-final-onboarding.png: same camera and target line, clear central combat
corridor, legible delay label under the minimap. Six offline production-HUD
fixtures (normal/delayed/high/offline, high at390x844 and1280x600) check measurement,
spike rejection, sustained high delay, disconnect/expiry, announcement separation,
viewport fit and aim clearance. All pass in session36-final-report.json; opened
high-narrow.png. These synthetic estimates test UI, not real adverse networking.

Real-input training probes retain ordinary W movement, right-mouse ADS and
server-confirmed hits. Relay completes3/3; Undertow2/2 without targets; cards hide
on pointer unlock. Extended scripts/training-probe.mjs checks actual connection,
minimap and coach rectangles at1920x1080,1280x600,720x900. Panel-to-card gaps6/9/9px,
map-to-panel9/9.25/9.25px on both maps; all fit. Evidence session36-layout-report.json,
layout-inspector.log and six connection-size PNGs; opened the1280px Relay capture.
Earlier session36-training-report.json/log retain the original progression drill.
Screen-reader speech, translated labels, real outage/RTT and human comfort remain
unverified; no broad accessibility or browser support claim.

Switchyard telemetry now accepts validated METRICS_SEED/METRICS_PREFIX and records
sampled life-start x/z and death time. New-life damage compares against fresh100HP
instead of the previous dead player's0HP. No shortened clocks, scripted routes,
teleports, human observer slot, altered bot stats or policy. Three full300 s rounds
use production twelve-bot FFA in createTestRoom with fake time and seeded aim/spread.

| Seed | Kills | Observed respawn contacts | Unobserved | Median first damage s |
|---|---:|---:|---:|---:|
| 224001 | 214 | 206 | 7 | 4.8 |
| 224002 | 224 | 219 | 3 | 4.5 |
| 224003 | 215 | 211 | 3 | 4.5 |

Pooled636 observed/649 respawn lives: first-damage p10/median/p90=2.1/4.6/11.4 s;
340 observed contacts under5 s,11 in20-30 s. Initial36 contacts median3.7 s.
LOS opportunity median1.2 s (647 observed/two absent). Southern sampled birth
sectors contain451/649 respawn lives and443/636 observed contacts; west/east
southern first-damage medians4.1/4.5 s, north6.3/5.8 s. This concentration makes
southern exits a concrete next review target; it does not establish why the
spawn selector favours them or justify a policy retune by itself.

Evidence .inspect/session36-seed-{224001,224002,224003}-bot-{round,debug}.json,
-bot-heatmap.svg and individual test logs. Aggregate session36-contact-summary.json,
.svg and.log. Reproduce each with SWITCHYARD_METRICS=1, METRICS_SEED=<seed>,
METRICS_PREFIX=session36-seed-<seed>, pnpm exec vitest run
 test/switchyard-metrics.tool.test.ts; then node scripts/summarize-contact.mjs
session36 session36-seed-224001 session36-seed-224002 session36-seed-224003.
The summary rejects repeated seeds and reports unobserved contacts separately.

Limits:100ms samples,100m eye-segment LOS without FOV, life-start positions can
already include motion, quantiles use observed contacts only. Instant lethal
hits between samples can leave damage unobserved; these are never assigned zero.
Final active lives have no recorded death. This is repeated bot evidence, not a
controlled before/after gameplay change, deployed capacity or human pacing pass.
FFA has no spawn-side win rate; team-mode multi-round fairness stays open.

Matched effects stress, session36-render-delta.json: Edge152/RTX5070 D3D11,
1920x1080 balanced/DPR1, eleven remote operators plus local rifle,145 twelve-rifle
volleys,96 blasts,2130 samples and complete effect drain. Both --assert-budgets pass.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls including shadow work | 220 | 220 | 0 |
| Peak submitted triangles | 128906 | 128906 | 0 |
| Resident textures | 30 | 30 | 0 |
| Estimated texture MiB | 63.7513 | 63.7513 | 0 |
| Median/p95/p99 frame interval ms | 6.9/7.1/7.1 | 6.9/7.1/7.1 | 0 |
| Max / first-ready max ms | 7.2/7.0 | 8.0/7.1 | +.8/+.1 |
| Browser-resident programs | 27 | 27 | 0 |

Offline effects do not mount the HUD; separate real-input captures validate its
layout and the full-game hitch gate covers runtime use. No performance improvement
claimed. Desktop intervals do not establish iGPU60 fps, thermal/cold-driver or
real6v6/RTT acceptance. Public25,167,281 ->25,179,491 bytes (+12,210); assets
18,976,213 unchanged. Bundle1,912,974, source map4,289,696; largest remains
Switchyard architecture5,229,544. Evidence session36-{before-bytes,bytes}.json.
Public40 MiB and per-file25 MiB caps pass; no new resident texture allocation.

Required pnpm typecheck; pnpm test (411 passed,6 existing/opt-in skips;42 files
passed/four skipped); pnpm build:client; pnpm audit:assets PASS. Evidence
.inspect/session36-{typecheck,test,build-client,audit-assets}.log. Three optional
natural-round runs pass separately. Static session36-reference-audit.json keeps
cover classes, ground sprint rotations,1,250 m2/seat, handling timers, economy,
respawn, audio and damage/feed checks; DOM economy mismatches remain open.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS; session36-required-inspector.log and required-report.json.
All five before/final/training/required/layout reports have zero console errors
and forbidden offline network requests; session36-report-checks.json.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS; hitch.json and session36-hitch.json/log.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames >150 ms, console errors or long tasks. Only frame >24 ms was startup59.7 ms.
Live6.944 s, first damage30.625 s (23.681 s after live), deaths33.729/88.360 s,
respawns36.693/92.018 s. Ordinary probe movement, no isolation/storage reset,
teleport, bot-stat edit or hitch script/threshold change. Stable server log has
no reload; server-error.log retains simulation-backlog and friendly-hit rejection
warnings. No unmeasured explanation assigned to those warnings. Relay browser
stability is separate from Switchyard in-process contact evidence.

Rejected intermediates: no visual asset/model rejected. Baseline retained before
runtime edits; only documentation/inspection tooling changed during final gates.
Initial searches named two nonexistent test/tool files and used Windows wildcard
paths unsupported by rg; corrected using directory searches. No gate assertion
weakened. Supplemental layout probe added after the green hitch, passed with
runtime files unchanged. No required test failures or gate reruns were needed.

Cleanup session36-cleanup.json: twelve owned stable-preview processes stopped;
zero remaining owned processes, port8796 listeners or inspection browsers.
Earlier preview tree stopped in session36-before-cleanup.json. Whitespace and
scope checks pass; all changed paths are apps/ironsight/**. No commit, push,
deployment or publication; supervisor owns preview release.

Open owner questions/defaults: keep concise delay bands and quiet numeric detail
(yes; calibrate labels after real RTT review); review southern Switchyard exits
against these three heatmaps before a controlled cover/spawn candidate (yes).
Keep industrial daylight, amber/teal, stylized sci-fi, server-verified hits and
six-versus-six team defaults/twelve-seat FFA. Objective/ping teaching, real outage
detection, moving hands, headphones, novice learning, real players/RTT, iGPU/thermal
and browser acceptance remain open. No owner answer needed to continue.


### Session 37 - 2026-09-09: screened northern arrivals and balanced Switchyard respawns

Read the standing brief, Session37 supervisor status, plan and all63 references.
Started clean on ironsight-aaa; scope apps/ironsight/** only. Reference: R-M03,
R-M04, R-M07, R-M09, R-M20. Targets: preserve waist/full cover, 10-15s rotations,
twelve seats and the40m rifle lane; provide two grounded exits from each new bay;
compare natural respawn contact against20-30s using three matched seeds. Geometry
checks pass. Contact improves in all three seeds but remains far below target;
R-M07 stays not yet, R-M09/M20 partial. All63 scorecard rows retained and the
ranked gap list updated. No new owner answer required.

The baseline's two inner southern arrivals (57,97)/(93,97) sit next to B's
compact service court. Move them to (57,3)/(93,3), with two20x2x3m switchgear
screens and two2x6x3m dividers separating the new northern courts from adjacent
arrivals. This redistributes existing seats; it adds no seats or spawn-policy
weights. The southern geometry stays useful as a covered route, with no spawn
anchor immediately beside B's paired-door exits. Shared ASCII tiles own the
four new colliders, spawn pools and bot navigation. New bay paths go around
both screen ends; existing six-per-half roster, objectives, ramps, boundary,
40m rifle corridor and 150x100m footprint remain intact.

Added amber double chevrons on arrival-facing northern screens, including the
existing outer northern bays. The strips reuse the kit material and are baked
inside its2cm cladding envelope. Rebuilt original Switchyard architecture,
collision-derived ground AO and production deployment vista. No new lights,
passes, textures, npm dependencies or per-frame baking. No movement, weapon,
bot stats/policy, scoring, respawn/shield, hit validation or codec change. Existing
fresh-round restore behavior is retained; no lifecycle rework or persisted-state
shape change. Client and Worker must publish together for changed geometry.
Meshy spend0, reported balance1530: these structures must match colliders exactly,
so the procedural kit is appropriate. Purchased derivatives remain ignored;
existing original allowlists apply and public/assets/README.md documents rebuilds.

Matched before/after .inspect/session37-{before,final}-switchyard-vista.png and
session37-{before,final}-north-switchyard-review.png were opened. Same camera
positions show the new screened courts and visible exit chevrons. The arrival
review at(57,1.62,3) intentionally faces the screen, proving visible cover rather
than a decorative gap; it does not prove a landmark-facing opening view. Human
first-turn/wayfinding acceptance remains open. Matched stress captures retain
the production rendering path; required Relay and Undertow captures also pass.

New physics regression traverses BOTH ends of each new screen with a standing
capsule and checks head/chest/shoulder spawn exposure against every other anchor.
Existing tests retain all-pairs spawn-eye separation, capsule clearance, all
spawn-to-cap/patrol navigation, four-ramp grounded traversal, B entrance visibility
and the40m rifle line. Twelve targeted map/architecture tests pass in
session37-map-tests.log; the required suite includes the final chevron geometry.

Source .inspect/session37-architecture.json, bake-architecture.log and
architecture-audit.json: 74,972 oriented triangles (+6,384), ten material
primitives, one1024px AO image,5,858,908 bytes (+629,364). Source/export normals
and winding match; zero degenerate triangles. Ground AO156,996 bytes (+11,226),
source session37-maps.json and bake-ground.log. No hidden collision is introduced
by dressing. All new boxes are3m full cover; Switchyard now42 full/10 waist.

Six natural production-bot FFA rounds rerun the three baseline seeds and the
same three candidate seeds,300s each, twelve bots, no observer seat. Existing
metrics tool,100ms sampling, fake-time createTestRoom; no shortened clocks,
teleports, room isolation, altered HP/damage, scripted routes or policy edits.
Fresh baseline results reproduce Session36 exactly for the reported metrics.

| Seed | Before/after kills | Before/after observed respawn contacts | Before/after median first damage s |
|---|---:|---:|---:|
|224001|214/204|206/196|4.8/5.8|
|224002|224/208|219/202|4.5/4.9|
|224003|215/196|211/193|4.5/5.9|

Pooled respawn first damage:4.6 ->5.4s median,2.1 ->2.1s p10,11.4 ->12.5s p90.
636/649 contacts observed before;591/604 after;13 unobserved in each. Under5s
contacts340/636 (53.5%) ->272/591 (46.0%). Contacts in20-30s11 ->18. Southern
sampled births451/649 (69.5%) ->270/604 (44.7%); north now280/604, middle54/604.
LOS opportunity median1.2 ->1.3s. Observed life-duration median11.2 ->13.0s;
32 lives have no observed death in each variant. These are bounded improvements,
not a20-30s pacing pass or a claim that fewer total kills is inherently better.

Evidence session37-{baseline,candidate}-{224001,224002,224003}-bot-{round,debug}.json,
-bot-heatmap.svg and per-seed.log. Reproduce each with SWITCHYARD_METRICS=1,
METRICS_SEED=<seed>, METRICS_PREFIX=session37-candidate-<seed>, then
pnpm exec vitest run test/switchyard-metrics.tool.test.ts. Baseline source is
retained at .inspect/session37-baseline-arena3.ts for controlled local comparison;
copying it back requires restoring the candidate before building/inspecting.
No baseline geometry is shipped. New scripts/compare-contact.mjs compares the
matched files, validates distinct u32 seeds, matching footprints,300s and twelve
standings, and writes session37-contact-comparison.json/log and paired-heatmaps.svg:
node scripts/compare-contact.mjs session37 session37-baseline session37-candidate
224001 224002 224003. Each heatmap retains its own collider drawing. Generic
summarize-contact.mjs now labels the actual round count and removes its obsolete
"no gameplay retune" SVG label; both per-variant summaries are retained.

Limits: identical seeds do not pair individual lives after trajectories diverge;
layout plus anchors change together, so this does not isolate either effect.
100ms sampled births can include motion, LOS omits FOV and uses a100m eye ray,
instant lethal damage can go unobserved, and final active lives are censored.
Three bot seeds are not human fairness, camping acceptance or deployed capacity;
FFA has no spawn-side win statistic. Team-mode multi-round evidence stays open.

Static session37-reference-audit.json reproduces all-map reference measurements:
Switchyard sprint A/B14.44s, B/C14.44s, A/C11.11s; Relay14.44/11.56s and
Undertow14.22/10.67s remain. Every map1,250m2/seat. ADS/sprint timers, mode economy,
respawn, audio ratio, damage cues and feed stay as audited in prior sessions;
DOM4/8s capture and1 point/2s/flag remain below reference requirements.

Matched Switchyard effects stress: .inspect/session37-{before,final}-report.json,
-inspector.log, PNGs and session37-render-delta.json. Edge152/RTX5070 D3D11,
1920x1080 balanced/DPR1, eleven remote operators plus local rifle,145 twelve-rifle
volleys,96 blasts,2130 steady samples and full effect drain. Both budget assertions pass.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|189|0|
|Peak submitted triangles|135870|142254|6384|
|Resident textures|26|26|0|
|Estimated texture MiB|61.5846|61.5846|0|
|Median/p95/p99 frame interval ms|6.9/7.1/7.1|6.9/7.1/7.1|0|
|Max frame interval ms|7.4|7.5|.1|
|First-ready max ms|7.1|7.6|.5|
|Browser-resident programs|19|19|0|

No performance improvement claimed. Desktop intervals do not prove iGPU60fps,
thermal/cold-driver or real6v6/RTT acceptance. Public25,179,491 ->25,826,929 bytes
(+647,438); final assets19,621,558. Client bundle1,913,622 and source map4,291,141.
Largest file is Switchyard architecture5,858,908. session37-{before-bytes,bytes}.json;
public40MiB/per-file25MiB caps pass, lazy per-map loading retained.

Rejected intermediates: first baked court had unmarked repeated cabinet faces;
final adds exit chevrons without new materials/textures. No map candidate rejected
or threshold weakened; the first controlled layout candidate is retained with its
unmet pacing target explicit. Baseline code was restored temporarily only to
rerun matched baseline metrics, then candidate restored before final baking/gates.
A Python read used Windows default cp949 and failed on UTF-8 text; corrected to
explicit UTF-8. Two searches named nonexistent map files and one passed a shell
flag to rg; corrected. A pre-gate indentation-only cleanup regenerated the bundle.


Required pnpm typecheck; pnpm test (412 passed,6 existing/opt-in skips;42 files
passed/four skipped); pnpm build:client; pnpm audit:assets PASS. Evidence
.inspect/session37-{typecheck,test,build-client,audit-assets}.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS; required-inspector.log and session37-required-report.json. Six before/final/
art/required reports have zero console errors or forbidden offline requests;
session37-report-checks.json. Final runtime/public files stayed fixed through
required inspection, stress and both combat probes.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS; hitch.json and session37-hitch.json/log.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Only frame>24ms was startup73.8ms.
Live7.168s, first damage24.756s (17.588s after live), deaths25.619/78.541s,
respawns28.681/81.622s. This stability run does not establish the pacing target.

Additional changed-map probe: node scripts/hitch-probe.mjs http://localhost:8796
150000 .inspect/session37-hitch-ffa.json --mode=ffa --assert PASS, with its.log.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Only frame>24ms was startup87.5ms.
Warmup damage3.456s, live7.118s, first sampled live damage9.255s; deaths10.466/
29.026s, respawns13.414/32.094s. Quick real-probe contact reinforces that pacing
remains open. Both probes use ordinary routed W input and server-owned positions;
no teleport, isolation, storage reset, bot-stat edit, lifecycle rework or gate
threshold/script change. Stable server log has one early reload notice before
inspection, with none later; server-error.log retains simulation-backlog warnings.
No unmeasured cause or deployed-capacity conclusion assigned to those warnings.

Opened session37-paired-heatmaps.png, rendered from the comparison SVG after
both combat probes. All three before/after pairs show southern concentrated death
cells becoming more distributed, with new northern concentrations. This is visual
support for the sector counts, not a human spawn-fairness pass. The screenshot
browser exited successfully; no browser ran alongside a measured combat probe.

Cleanup session37-cleanup.json: twelve owned stable-preview processes stopped;
zero remaining owned processes, port8796 listeners or inspection browsers. Earlier
preview tree stopped in session37-art-cleanup.json. One process was still exiting
at the first cleanup sample; the final sample is zero. Automatic tool approval
blocked optional deletion of .inspect/session37-heatmap-profile with "blocked by
policy" and no further reason. Retained the ignored data folder; its browser is
stopped, no permission requested and no alternate deletion attempted. Read-only
whitespace/scope checks pass; all ten changed paths are apps/ironsight/**.
All standing gates green. No commit, push, deploy or external publication.

Open owner questions/defaults: keep this small controlled spawn redistribution
and directional screen chevrons (yes, pending human review); continue matched
multi-seed exit/contact review and add team-mode side-win evidence before further
spawn-policy tuning (yes). Retain industrial daylight, amber/teal, stylized sci-fi,
server-verified hits,6v6 team defaults and twelve-seat Switchyard FFA. Objective/
ping teaching, moving hands, headphones, first-turn wayfinding, real players/RTT,
iGPU/thermal and browser acceptance remain open. Supervisor owns publication.


### Session 38 - 2026-09-09: exit-facing arrivals and reliable respawn orientation

Read the standing brief, Session38 supervisor status, plan and all63 references
in order. Started clean on ironsight-aaa. Scope apps/ironsight/**; no commit,
push or deployment. Reference: R-M09, R-M20, R-L04, R-M08. Concrete targets:
new northern Switchyard arrivals see a navigable exit aisle rather than a cabinet
face; a standing capsule reaches that exit with ordinary movement; fresh yaw
survives the binary codec; revival discards death-time look exactly once. These
checks pass. Full landmark-facing spawn coverage and human camping/wayfinding
remain partial. R-M07's20-30s contact target remains unmet. All63 scorecard rows
retained; next finishable first-play work ranks above further spawn-policy tuning.

Added optional map-authored spawnViews, consumed only after authoritative spawn
selection. Switchyard (57,3) looks east to(66,3); (93,3) looks west to(84,3).
Both inner aisles provide9m clear standing-eye/capsule travel before the turn
into the yard, retaining the two tested exits per court. Existing switchgear
chevrons, broad opening and contrasting yard silhouettes now appear in the
opening composition. No geometry, collider, anchor, cover, ramp, cap, navigation,
spawn safety weight, bot stat, protection timer or seat-count change. No bake or
new asset needed; Meshy spend0, reported balance1530. Asset/render budgets retained.

Two orientation defects were found in the end-to-end path. Client revival kept
the corpse's yaw/pitch and sent them back over the server's new arrival view.
It now adopts authoritative yaw/pitch only on the dead-to-alive edge; normal live
aim remains mouse-owned. In addition, Math.atan2 can return a negative spawn yaw,
but ArenaSchema quantizes yaw in[0,2pi], clamping negative values to0 on the wire.
All spawn-facing results now wrap into[0,2pi). This also repairs existing
centre-facing FFA/practice arrivals in western-facing quadrants. No wire layout,
state version or snapshot lifecycle change; schema range already required this.
No new light, pass, texture, dependency or per-frame bake.

Regression tests: all twelve FFA arrival anchors pass through the real room,
with threat occupancy isolated in the test. Both authored yaws and every fallback
are checked, including received binary state after the normal100ms coalesced
flush. Northern eye rays and standing capsules traverse9m to the authored target;
existing tests still traverse BOTH exits and assert whole-body spawn screening.
Thirteen targeted tests pass: session38-spawn-tests.log. The full suite passes
414 tests with6 existing/opt-in skips,42 files passed/four skipped.

The real self-respawn inspector previously manually repaired look after revival.
Removed that correction and added assertions for level pitch and the expected
Relay practice centre-facing yaw after300ms of ordinary look sync. It passes:
1 death,100HP,idle reload,pitch0.000204rad,yaw4.864rad versus expected
-1.419191rad (equivalent modulo2pi). Evidence session38-respawn-report.json,
-inspector.log, self-death.png and self-respawn.png; opened the final capture.
This is grenade-caused training death using normal controls, separate from the
required bot-caused combat hitch gate. No teleport or authoritative state edit.

Before/after arrival captures: session38-before-west-switchyard-arrival.png,
session38-before-east-wire-switchyard-arrival.png and
session38-final-{west,east}-switchyard-arrival.png, with matching report JSON.
Positions, height1.62m,78-degree FOV, lighting and geometry are fixed; ONLY facing
changes deliberately. The eastern baseline reconstructs the old decoded yaw0,
not the negative unencoded atan2 intent. Earlier before-east retains the latter
for diagnosis and is not the actual wire baseline. Opened both final views and
both accepted baselines. Inner-facing view retained after comparing outer-facing
and inner-facing candidates; this is an authored first-look improvement, not a
new landmark, geometry change or human orientation pass.

Extended the existing optional Relay natural-round tool with validated u32 seed
and output prefix, preserving its production12-bot TDM rules. Three independent
seeds record full natural rounds, per-life contact samples and heatmaps:

| Seed | Red / blue score | Duration s | Observed respawn contacts / lives | Median first damage s |
|---|---:|---:|---:|---:|
|238001|48 / 50|213.0|93 / 96|9.9|
|238002|42 / 50|193.2|85 / 87|10.6|
|238003|50 / 48|195.9|90 / 95|10.4|

Red wins1/3, blue2/3; zero ties. This is a small team-mode baseline, not evidence
of a side advantage or a controlled before/after comparison. All medians miss
R-M07. Reproduce with RELAY_METRICS=1, METRICS_SEED=<seed>,
METRICS_PREFIX=session38-relay-<seed>, pnpm exec vitest run
 test/relay-metrics.tool.test.ts. Evidence session38-relay-{238001,238002,238003}
-bot-round.json,-bot-heatmap.svg and.log; aggregate session38-team-summary.json.
No observer slot, shortened match, modified HP/damage, scripted route or teleport.
100ms sampling, LOS without FOV, unobserved contacts and final active lives limit
interpretation. More seeds, Undertow team-mode evidence and real6v6 remain open.

Static session38-reference-audit.json repeats all-map cover classes and sprint
rotations: Relay23 full/14 waist, Undertow23/14, Switchyard42/10; no head-height
cover. Relay14.44/11.56s, Undertow14.22/14.22/10.67s, Switchyard14.44/14.44/11.11s;
all150x100m/12=1,250m2 per seat. Shared ADS/sprint timers,3s respawn,1.4 enemy/ally
foley gain, hit pip, damage cues and feed remain as audited. DOM4/8s capture,
1 point/2s/flag and no side swap remain below reference requirements. No reference
target redefined to claim a pass.

Matched Switchyard effects stress: session38-{before,final}-report.json,
final-inspector.log and PNGs; session38-render-delta.json. Edge152/RTX5070 D3D11,
1920x1080 balanced/DPR1, eleven remote operators plus local rifle,145 twelve-rifle
volleys,96 blasts,2130 samples and full effect drain. Both budget assertions pass.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|189|0|
|Peak submitted triangles|142254|142254|0|
|Resident textures|26|26|0|
|Estimated texture MiB|61.5846|61.5846|0|
|Median/p95/p99 frame interval ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame interval ms|7.4|7.7|+.3|
|First-ready max ms|7.0|7.1|+.1|
|Browser-resident programs|19|19|0|

No performance improvement claimed; desktop intervals do not establish iGPU60fps,
thermal/cold-driver or real6v6/RTT acceptance. Public25,826,929 ->25,828,061bytes
(+1,132); assets19,621,558 unchanged. Largest file Switchyard architecture
5,858,908bytes. Evidence session38-{before-bytes,bytes}.json.40MiB public and
25MiB per-file caps pass. Purchased derivatives remain ignored; no new provenance
entry or allowlist needed because no asset was added or changed.

Rejected intermediates: outer15m versus inner9m aisle comparison favored the broader
inner opening and yard silhouettes. Initial targeted view command named the shot
north-switchyard-review, which selected default Relay; corrected to switchyard-
prefix and excluded that report from accepted art evidence. First respawn assertion
incorrectly assumed team-facing yaw in non-team practice; corrected to the actual
centre-facing rule, exposing the negative-yaw codec issue, then fixed runtime
normalization. Initial received-state unit assertion ran before a throttled flush;
added normal100ms harness advance. No assertion or gate threshold weakened.
Several searches used nonexistent paths/PowerShell wildcard arguments unsupported
by rg; corrected. Final runtime build remained fixed through required browser gates.

Required pnpm typecheck, pnpm test, pnpm build:client, pnpm audit:assets PASS:
session38-{typecheck,test,build-client,audit-assets}.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS; session38-required-inspector.log and session38-required-report.json.
All nine accepted before/final/respawn/required reports contain zero console errors
and forbidden offline requests; session38-report-checks.json.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS; hitch.json and session38-hitch.json/log.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Only frame>24ms was startup64.9ms.
Live6.744s, first damage29.277s (22.533s after live); deaths32.195/128.470s,
respawns35.367/131.532s. Ordinary routed W input; no room isolation, storage reset,
teleport, bot-stat edit, lifecycle rework or hitch-script/threshold change. This
stability run is separate from the natural bot-round pacing measurements.

Additional changed-map gate: node scripts/hitch-probe.mjs http://localhost:8796
150000 .inspect/session38-hitch-ffa.json --mode=ffa --assert PASS, with its.log.
Twelve seats, two bot-caused deaths and two respawns, zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Two startup frames>24ms:89.6/88.8ms
at94/322ms. Live7.017s; first live sampled damage11.197s; deaths61.705/68.766s,
respawns64.759/71.696s. Fast contact still reinforces that pacing remains open.
Required TDM and additional FFA probes use unchanged normal navigation/controls.
Server-error.log retains simulation-backlog and friendly-hit rejection warnings;
no unmeasured cause or deployed-capacity conclusion assigned to them. Development
reloads happened during implementation, before final measured browser gates.

Cleanup session38-cleanup.json: twelve owned preview processes stopped; final
sample zero remaining owned processes, port8796 listeners and inspection browsers.
The first sample caught the root cmd process still exiting; final sample is zero.
All ten changed paths are apps/ironsight/**; whitespace check passes. No git
commit, push, deploy or publication. Supervisor owns preview release.

Open owner questions/defaults: keep inner-exit first looks and authoritative
revival orientation (yes); add objective/ping teaching next while expanding
team-mode fairness evidence before more spawn-policy tuning (yes). Retain
industrial daylight, amber/teal, stylized sci-fi, server-verified hits,6v6 team
modes and twelve-seat Switchyard FFA. Moving hands, headphone mix, human
wayfinding/camping, actual6v6/RTT, iGPU/thermal and other browsers remain open.
No owner answer needed to continue. All standing gates green.


### Session 39 - 2026-09-09: Undertow objective rehearsal and team-mode evidence

Read the standing brief, Session39 supervisor status, plan and all63 design
references in order. Started clean on ironsight-aaa. Scope apps/ironsight/**;
no commit, push, deploy or publication. Reference: R-L09, R-L22, R-L02, R-M20.
Concrete teaching target: after movement/aim, find the real Undertow A, remain
inside its actual4m capture radius for the actual neutral-capture duration4s,
reset an unfinished hold on exit/pause, and explain Domination without awarding
a fake score or claiming a real capture. These checks pass. R-L09 stays partial:
shooting and objective teaching are on separate training sites, pings and an
integrated first-match course remain absent, and human learning is unreviewed.
R-L02 stays partial: the current4s neutral/8s enemy capture economy differs from
the reference10s target. Teaching reflects the running game; no target redefined.
All63 scorecard rows retained and gaps re-ranked; contextual team pings rank next.

Undertow's peripheral coach now advances from movement and steady ADS to
HOLD OBJECTIVE A. The existing10Hz minimap labels A and draws its real radius;
the card supplies cardinal direction, distance and a4s hold meter. Coordinates
come from the authoritative local-player state, radius/duration from MODES.dom.
Distance/hold text updates at most4Hz with live announcements disabled for that
changing region; step changes retain the polite status announcement. It hides
while paused, disconnected or dead. Unfinished holds reset on leaving/pausing
and a discontinuous position sample cannot contribute hold time. Completed
lessons remain learned within the session; rejoining starts fresh, as before.

This is explicitly a rehearsal with no score, never a new client capture
authority. Completion explains that enemies contest a held zone and owned
sites continue scoring after departure, then directs the player to Domination.
Training-site selection and the opening briefing advertise the lesson honestly.
Relay keeps its confirmed-hit course; Switchyard keeps movement/aim exploration.
The minimap adds no enemy positions or live team communication. Geometry,
collision, spawns, caps, bot policy, weapon/bot stats, network schema, persistent
state and match lifecycle are unchanged. No new light, render pass, texture,
asset, dependency or per-frame bake. Meshy spend0; reported balance1530 retained.

Three new progression regression tests exercise prerequisite ordering, the
actual duration boundary, radius exit, inactive pause/death state, discontinuous
arrival, a stalled-frame cap, completed-lesson retention and the existing Relay/
Switchyard branches. Full suite417 passed,6 existing/opt-in skips;43 files passed,
four skipped. Evidence .inspect/session39-training-tests.log and session39-test.log.

The optional real-input training probe walks W through the actual northern
spawn exit and A court: (3,39), (3,25), (17,25), (17,15), (27,15). It uses ordinary
look/movement, never teleports or changes lesson/game state. It holds, pauses,
uses the actual Resume button, leaves to(33,15), re-enters, and completes. Final
accepted drill16.864s from route start through completion including both resets;
this is scripted teaching evidence, not human route or spawn-to-contact timing.
Mode3, capA100 and scores0:0 remain identical before/after. The inspected radius
and meter are4m/4000ms. Relay still requires a confirmed passive-operator hit.

Before/after evidence: session39-baseline-practice-two-exploration.png versus
session39-accepted-practice-two-objective.png, after the same W/ADS lesson inputs.
Geometry/FOV are fixed; ordinary network sampling means camera positions are
near-matched, not pixel-identical. The old lesson ends at2/2; the new lesson
shows A, direction/distance and the next task. Additional accepted
practice-two-{objective-hold,objective-left,objective-complete}.png captures
document the actual walk/hold. session39-accepted-report.json and its inspector
log retain the route, score/gauge checks and both reset assertions. Earlier
session39-teaching-report.json also passes, before the narrow-layout correction.
Opened baseline, objective, hold, completion and narrow captures during review.

At1920x1080,1280x600,720x900 the accepted Relay/Undertow coach fits, remains
outside the aiming corridor and has6/9/9px clearance below the connection
panel. All six layouts assert no coach/briefing overlap. The first720px capture
revealed the longer card covering part of the static training briefing; the
final training-only narrow layout moves that briefing above/right. Opened
session39-accepted-practice-two-connection-720.png to confirm the correction.
Step announcements and meter semantics are implemented, not real screen-reader
or browser-matrix acceptance. Distance is direct distance, not path length;
the player chooses a clear route using the minimap and north-aisle instruction.

Extended the existing optional Undertow natural-round tool with validated u32
METRICS_SEED and safe METRICS_PREFIX, matching Session38's Relay tool. No normal
game rule or bot policy changed. Three independent production twelve-bot DOM
rounds retain the real match clocks, HP, damage, capture economy and navigation:

| Seed | Red / blue score | Duration s | Observed respawn contacts / lives | Median first damage s |
|---|---:|---:|---:|---:|
|239001|87 / 201|253.9|58 / 70|18.4|
|239002|153 / 177|300.0|96 / 103|17.8|
|239003|174 / 165|300.0|62 / 71|29.7|

Red wins1/3, blue2/3, no ties. Two rounds reach the real300s time cap; the first
ends on points. One observed-contact median reaches20-30s; this does not establish
general pacing or a side advantage. This is an added baseline, not a controlled
before/after comparison. Evidence session39-undertow-{239001,239002,239003}
-bot-round.json, -bot-debug.json, -bot-heatmap.svg and .log; aggregate
session39-team-summary.json. Reproduce each with UNDERTOW_METRICS=1,
METRICS_SEED=<seed>, METRICS_PREFIX=session39-undertow-<seed>, then
pnpm exec vitest run test/undertow-metrics.tool.test.ts. No observer seat,
shortened clock, teleport, scripted bot route or bot-stat edit.100ms sampling,
LOS without FOV, unobserved damage and final active lives limit interpretation.
Many-round side evidence, human6v6 and actual RTT remain open.

Static session39-reference-audit.json reproduces all-map checks: Relay and
Undertow23 full/14 waist cover; Switchyard42/10; no head-height boxes. Sprint
rotations Relay14.44/11.56s, Undertow14.22/14.22/10.67s, Switchyard14.44/14.44/
11.11s; all150x100m/12=1,250m2 per seat. ADS AR/SMG/shotgun/sniper/pistol
250/200/225/400/165ms and sprint recovery120/100/130/150/90ms unchanged.3s
respawn,1.4 enemy/ally foley gain, confirmed hit pip, two damage cues and existing
five-row top-right feed retained. DOM4/8s capture,1 point/2s/flag and no side
swap remain below reference requirements. Natural-round contact is distinguished
from static travel proxies. Reproduce with tools/reference-audit.ts.

Matched Undertow effects stress: session39-baseline-report.json versus
session39-accepted-report.json, inspector logs and PNGs; session39-render-delta.json.
Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1, eleven remote operators plus local
rifle,145 twelve-rifle volleys,96 blasts,2130 steady samples and full effect
drain. Both budget assertions pass. No browser/CPU bot tool runs alongside the
accepted measured stress or required combat probe.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|189|0|
|Peak submitted triangles|113966|113966|0|
|Resident textures|23|23|0|
|Estimated texture MiB|60.2513|60.2513|0|
|Median/p95/p99 frame interval ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame interval ms|7.3|7.2|-.1|
|First-ready max ms|7.2|7.1|-.1|
|Browser-resident programs|19|19|0|

No performance improvement claimed; these desktop intervals do not establish
mid-laptop iGPU60fps, thermal/cold-driver or real6v6/RTT acceptance. Offline
effects fixtures do not mount the coach; separate real-input/layout captures
exercise its DOM/minimap path. Public25,828,061 ->25,838,923bytes (+10,862),
assets19,621,558 unchanged. Final client1,917,984; source map4,298,773bytes.
Largest file Switchyard architecture5,858,908. session39-{before-bytes,bytes}.json;
40MiB public/25MiB per-file caps pass. No asset provenance/allowlist change needed.

Rejected intermediates: baseline optional training inspection reached the clock
label before its first sample and failed MEASURING DELAY. Added readiness wait,
retaining the low-delay/geometry assertions; rerun baseline passed. First route
probe crossed the northern spawn screen at(9,30.4); routed around the actual
west end instead. Second probe clicked the canvas behind the pause modal and
timed out; corrected to Resume. The earlier failed inspector was still exiting
briefly when the next functional inspector launched; neither was a measured
stress/combat run. Longer card/briefing overlap at720px was found visually,
fixed and asserted. No gate threshold, hitch script or gameplay collision was
weakened. Some exploratory reads named nonexistent paths, and an initial plan
patch had an invalid context; corrected without changing unrelated files.

Required pnpm typecheck, pnpm test, pnpm build:client and pnpm audit:assets PASS:
session39-{typecheck,test,build-client,audit-assets}.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS; session39-required-inspector.log and session39-required-report.json.
The baseline/teaching/final-stress/accepted/required reports all have zero console
errors and forbidden offline requests; session39-report-checks.json. Final
runtime/public files stayed fixed through accepted inspection/stress and the
required inspector/combat gates; only plan/evidence writes followed.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS; hitch.json and session39-hitch.json/log.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Only frame>24ms was startup55.8ms.
Live7.152s; first damage29.450s (22.298s after live), deaths32.874/84.081s,
respawns35.839/87.289s. Ordinary routed W input, no isolation, teleport, storage
reset, bot-stat edit, lifecycle rework or hitch-script/threshold change. This
stability run does not establish the general pacing target. Server-error.log
retains simulation-backlog and friendly-hit rejection warnings; no unmeasured
cause or deployed-capacity conclusion assigned to them.

Cleanup session39-cleanup.json: twelve owned preview processes stopped; zero
remaining owned processes, port8796 listeners or inspection browsers. Ten changed
paths all stay in apps/ironsight/**; whitespace check passes. No commit, push,
deploy or publication; supervisor owns preview release. All standing gates green.

Open owner questions/defaults: keep the explicitly unscored Undertow objective
rehearsal (yes); implement contextual team pings next and teach them before
joining the separate lessons into a first-match course (yes); expand team-mode
samples before more spawn-policy changes (yes). Retain industrial daylight,
amber/teal, stylized sci-fi, server-verified hits,6v6 team modes and twelve-seat
Switchyard FFA. Human learning/wayfinding, hands, headphone mix, actual6v6/RTT,
iGPU/thermal and other browsers remain open. No owner answer needed to continue.


### Session 40 - 2026-09-09: Contextual team pings and private training rehearsal

Read standing brief, Session40 supervisor status, plan and all63 design references.
Started clean on ironsight-aaa; scope apps/ironsight/**. Reference: R-L08, R-L09,
R-L22, R-L14. Concrete target: one rebindable aim-then-mark key, server-derived
GO HERE / ENEMY SEEN classification, same-team-only delivery, no wall reveal or
tracking, bounded five-second markers and two-second sender cooldown. These
checks pass. R-L08 advances not yet -> partial: explicit backup/wheel selection,
acknowledgement/audio and human muted-microphone communication remain open.
R-L09 stays partial: the hint enables rehearsal but is not a progression lesson
or an integrated first-match course. All63 scorecard rows retained; first-play
communication/teaching stays first, followed by evidence-driven spawn fairness.

Q is the new rebindable default. Existing saved Q bindings retain priority and
leave ping unbound until the player assigns it; settings display Team ping.
Only an alive, online, pointer-locked player in a live team/practice room sends
an aim intent. The server validates finite yaw/pitch, normalizes/clamps aim,
resolves from authoritative eye height against the existing box/ramp occluders
and current live enemy hit volumes, and stamps sender and expiration. No client
position, sender, enemy id or ping-kind claim is trusted. Max ray80m, bounded by
floor/map edges/cover. Enemy is a frozen ray-hit location, never a tracked actor;
no target id travels. Team messages go only to seated same-team clients; practice
echoes only to self and FFA rejects pings despite shared team numbers. No broadcast
or opaque relay is used for this information. Last-send time lives on the seat's
server-only client data; no synced/persisted schema change.

The existing10Hz minimap displays at most six pings, one newest per sender, with
+ for location and ! for enemy as well as amber/coral contrast. A peripheral
status card names YOU/ALLY, action and map callout, explicitly saying last marked
location. Expiration uses server time. Pause, disconnect, death and non-live
phase clear markers; late joins/reconnects receive no historical ping replay.
The quiet key hint reads current bindings and says REHEARSE PING in training.
Polite status updates use fixed text, with no per-frame distance announcements.
No world-space marker, tracking, automatic enemy reveal or bot response added.

Four new regression cases (three ping, one settings) cover collision/enemy/ally
classification, floor/bounds, forged sender/position, team privacy, spam, malformed
input, dead/ended rejection, FFA/private practice and old-Q migration/rebinding.
Full suite421 passed,6 existing/opt-in skips;44 files passed,4 skipped. Evidence
session40-test.log and session40-typecheck.log. First full run found two existing
exact-default snapshots missing the new Q action; updated expected defaults,
retaining all original assertions. Earlier targeted four-case run also passed;
settings case then moved to the existing DOM-aware settings test file after
server-only typecheck correctly rejected its window dependency.

Real-input inspection uses normal Q, normal room echo and server expiry; no
teleport, gameplay-state writes, altered HP/damage or fake client ping events.
Three sizes1920x1080,1280x600,720x900 pass card fit and no overlap with minimap,
connection panel, training coach, weapon bar and vitals. Each ping expires after
its five-second server deadline; pause clears it and Q while paused sends none.
Evidence session40-final-report.json, final-inspector.log and final-ping-
{1920,1280,720}.png. Opened all final views, plus earlier layouts and baseline.
Before session40-before-practice-two.png and after final-ping-1920.png share the
same training spawn/facing; a new temporary minimap diamond and peripheral notice
show the result. This is scripted visual/functional evidence, not human learning,
real two-player network latency or screen-reader acceptance. Team privacy is
proven in the real-room test harness, not by this solo browser drill.

Rejected intermediates: appending a fixed notice beneath the transformed minimap
made narrow layouts place it over the map. Moved notice/hint to separate body
siblings, then found narrow weapon-bar overlap and raised them at<=800px. Added
both overlap checks; final captures are clear. First helper edit read the inspector
with Windows cp949 and failed; corrected to explicit UTF-8. A broad punctuation
replacement briefly changed ternary operators; restored them before successful
build/typecheck. No broken intermediate is accepted. The first --assert-ping
invocation preceded insertion of its optional probe and supplied no ping evidence;
only the final real-input report is used. No gate threshold weakened.

Static session40-reference-audit.json repeats all-map measurements with the
existing tools/reference-audit.ts: Relay/Undertow23 full/14 waist, Switchyard42/10,
no head-height cover; sprint rotations14.44/11.56s,14.22/14.22/10.67s and14.44/
14.44/11.11s respectively. All150x100m/12=1,250m2 per seat. ADS250/200/225/400/
165ms and sprint recovery120/100/130/150/90ms,3s respawn,1.4 enemy/ally foley gain,
confirmed hit pip, two damage cues and five-row feed unchanged. DOM4/8s capture,
1 point/2s/flag and no side swap still differ from the reference. No new natural
bot-round pacing/fairness sample this session; previous team medians remain open.

Matched Undertow stress: session40-before-report.json versus session40-measured-
report.json and corresponding inspector logs/PNGs; session40-render-delta.json.
Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1, eleven remote operators plus local
rifle,145 twelve-rifle volleys,96 blasts,2130 steady samples and complete drain.
Both budget assertions pass. Final combined fixture also passed, but a later
required inspector started before its shell completion had been confirmed;
repeated the final measured stress in isolation to remove that concurrency doubt.
No other browser or CPU test ran alongside the accepted measured fixture.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|189|0|
|Peak submitted triangles|113966|113966|0|
|Resident textures|23|23|0|
|Estimated texture MiB|60.2513|60.2513|0|
|Median/p95/p99 frame interval ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame interval ms|7.7|7.5|-.2|
|First-ready max ms|7.1|7.1|0|
|Browser-resident programs|19|19|0|

No performance improvement claimed; desktop results do not prove mid-laptop
iGPU60fps, thermal/cold-driver or real6v6/RTT acceptance. Offline stress does not
mount ping UI; the independent real-input captures exercise its DOM/minimap path.
Public25,838,923 ->25,851,617bytes (+12,694); assets19,621,558 unchanged. Largest
file Switchyard architecture5,858,908bytes. Evidence session40-before-bytes.json
and session40-bytes.json.40MiB public/25MiB per-file limits pass. No new assets,
Meshy spend0 (reported balance1530), light, shader, render pass, texture, dependency
or per-frame bake. No purchased derivative/provenance/allowlist change needed.

Required pnpm typecheck, pnpm test, pnpm build:client and pnpm audit:assets PASS:
session40-{typecheck,test,build-client,audit-assets}.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS, zero console errors; session40-required-inspector.log and session40-required-
report.json. All four accepted before/final/measured/required reports have zero
console errors and forbidden offline requests: session40-report-checks.json.
Final runtime/public files remained fixed through accepted browser/hitch gates;
only plan/evidence changed afterward.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS: hitch.json, session40-hitch.json and.log.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Only frame>24ms was startup70.5ms.
Live7.140s; first damage29.534s (22.394s after live); deaths30.252/86.229s and
respawns33.242/89.192s. Ordinary routed W; no room isolation, storage reset,
teleport, bot-stat edit, lifecycle rework or hitch-script/threshold change. This
stability sample does not establish general20-30s pacing. Server log retains
simulation-backlog warnings; no invented latency/capacity conclusion assigned.

Cleanup session40-cleanup.json: stopped twelve owned preview processes; zero
remaining owned processes, port8796 listeners or inspection browsers. Thirteen
changed/untracked paths all remain apps/ironsight/**, whitespace check passes.
No git commit, push, deploy or publication. Supervisor owns preview release.
All standing gates green.

Open owner questions/defaults: keep the bounded team-only contextual ping (yes);
add explicit backup/selection, a required ping lesson and muted-mic human review
next (yes), before integrating the separate training lessons. Keep the existing
spawn policy until broader team-mode evidence warrants changes. Industrial
daylight, amber/teal, stylized sci-fi, server-verified hits,6v6 team modes and
12-seat FFA remain defaults. Human wayfinding/communication, hands, headphones,
actual6v6/RTT, iGPU/thermal and other browsers remain open. No answer needed to
continue.


### Session 41 - 2026-09-09: Teach server-confirmed team marking on every training map

Read the standing brief, Session41 supervisor status, plan and all63 design
references. Started clean on ironsight-aaa; scope apps/ironsight/**. Reference:
R-L08, R-L09, R-L22. Concrete target: after the existing map lessons, require
one active own server-echoed mark, show the current binding or directions to
assign it, and keep the lesson clear of the aim corridor at three viewport
sizes. All checks pass. R-L09 remains partial: this closes the required ping
lesson, not the integrated move/aim/shoot/objective/ping first-match course or
human learning acceptance. R-L08 remains partial: explicit backup/selection,
acknowledgement/audio and muted-microphone team review are next. All63 scorecard
rows retained, static audit rerun, first-play communication/course stays first.

Relay now has four steps: move, aim, confirmed hit, mark. Undertow has move,
aim, unscored objective hold, mark. Switchyard has move, aim, mark. The card
explains the minimap + and YOU / GO HERE notice, five-second team visibility and
private training echo. Either valid contextual mark can satisfy the lesson;
route marking is the taught example. The completion card retains each site's
next-mode guidance. Completion persists across pause/death, resets on rejoin,
and hides after the existing twelve-second completion window.

Only a validated teamPing received from the room can credit the new step, and
only for the local sender while online, alive, live and pointer-locked. Key-down
never completes it. Early/ally/inactive echoes do not credit progression. Existing
minimap payload validation supplies the accepted ping; no second validation path.
Unbound players get Esc > Settings > Team ping instructions. Saved binding changes
update the visible lesson immediately. No forced binding, skip or score reward.
No change to room logic, hit validation, collision, bot stats/navigation, spawn
policy, match clocks, persisted state or wire schema. No new asset, light, shader,
render pass, texture, dependency or bake. Meshy spend0; reported balance1530.

One new regression test covers early, ally and inactive echoes, own completion,
pause retention and new-session reset; existing objective/Relay/Switchyard tests
now assert the extra prerequisite. Full suite422 passed,6 existing/opt-in skips;
44 files passed,4 skipped. Required typecheck and client build pass. Evidence
.inspect/session41-{typecheck,test,build-client}.log.

The optional training inspector now covers all three sites and uses ordinary
movement/look/fire/keys plus real Settings clicks. It completes each original
lesson, checks the new card at1920x1080,1280x600,720x900, pauses and presses Q,
gives Q to reload to exercise unbound guidance, rebinds ping to V, restores
reload to R, resumes, verifies old Q cannot complete, and completes through V
and the actual own server echo. All nine lesson layouts fit, avoid HUD overlap,
and remain outside the aiming corridor. Three completion layouts per map also
retain the existing connection/briefing separation assertions. Evidence:
session41-final-report.json, final-inspector.log and final-{onboarding,
practice-two,practice-three}-{ping-lesson-1920,ping-lesson-1280,ping-lesson-720,
ping-unbound,ping-rebound,ping-complete}.png. Reproduce with inspect-map.mjs
--url http://localhost:8796 --shots onboarding,practice-two,practice-three
--assert-training --prefix session41-final.

Undertow still walks the actual north exit/court, holds four seconds, pauses,
leaves and re-enters A.17.463s route-through-hold drill including resets;
mode3,capA100,scores0:0 unchanged before/after. No teleport, lesson-state write,
fake room message, HP edit or collision shortcut. Switchyard completion view
faces a nearby wall following the probe's normal look input; it is UI evidence,
not a new map composition. Browser settings are isolated to its temporary profile.
No two-human communication, screen-reader, actual RTT or learning claim.

Before/after: session41-before-practice-two-objective-complete.png versus
session41-final-practice-two-ping-lesson-1920.png. Both finish the same objective
route facing the court; small ordinary movement/network differences prevent
pixel-identical camera matching. Before ends3/3; after asks for a mark at3/4.
Opened these, the Relay720 lesson and unbound state, Undertow1280 lesson and
completion, Switchyard completion, and the rejected inspector failure capture.

Matched Undertow effects stress: session41-before-report.json versus
session41-measured-report.json and associated PNGs/logs;
session41-render-delta.json. Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
eleven remotes plus local rifle,145 twelve-rifle volleys,96 blasts,2130 samples
and complete effect drain. Both budget assertions pass. Each measured browser
ran alone, without CPU tests or another inspector/combat browser.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|189|0|
|Peak submitted triangles|113966|113966|0|
|Resident textures|23|23|0|
|Estimated texture MiB|60.2513|60.2513|0|
|Median/p95/p99 frame interval ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame interval ms|7.7|7.4|-.3|
|First-ready max ms|7.1|7.0|-.1|
|Browser-resident programs|19|19|0|

Preparation269->860ms; construction44.8->60.5ms. No improvement or cause claimed
from these two runs. Offline stress does not mount the coach; separate ordinary
input drills exercise it. Desktop intervals do not establish mid-laptop iGPU60fps,
thermal/cold-driver or human6v6/RTT acceptance. Public25,851,617->25,854,100bytes
(+2,483), assets19,621,558 unchanged. Client1,922,965; source map4,308,969bytes.
Largest file Switchyard architecture5,858,908. session41-{before-bytes,bytes}.json.
Required asset audit passes40MiB total/25MiB per-file caps: audit-assets.log.
No new provenance/allowlist entry needed.

Static session41-reference-audit.json reproduces tools/reference-audit.ts:
Relay/Undertow23 full/14 waist, Switchyard42/10; no head-height cover. Sprint
rotations14.44/11.56s,14.22/14.22/10.67s,14.44/14.44/11.11s respectively;
all150x100m/12=1,250m2 per seat. ADS250/200/225/400/165ms, sprint recovery
120/100/130/150/90ms;3s respawn,1.4 enemy/ally foley gain, confirmed hit pip,
two damage cues and five-row top-right feed retained. DOM4/8s capture,
1point/2s/flag and no side swap still differ from the reference. No new natural
round pacing/fairness sample; prior three-seed team baselines remain open.

Rejected intermediates: first optional teaching run reached the actual Settings
panel, then failed because the probe searched for English Reload while the
configured label is Korean. Corrected the selector, added a missing-target
error, and reran all three sites successfully. Some exploratory PowerShell reads
used unsupported rg glob paths or a nonexistent settings-panel.ts; corrected
to file filters/settings-ui.ts. No runtime workaround, gate relaxation, hitch
script change or threshold change. The baseline and final functional/stress
reports and exact required inspector report have zero console errors and
forbidden offline requests: session41-report-checks.json.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS: session41-required-inspector.log and required-report.json.
Runtime/public files remained fixed through final functional/stress/required
inspection and combat gates; subsequent writes only affect plan/evidence.

Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS: hitch.json, session41-hitch.json and.log.
Twelve seats, two bot-caused deaths/two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Only frame>24ms was startup56.2ms.
Live6.954s; first damage29.912s (22.958s after live), deaths32.385/103.028s,
respawns35.343/106.003s. Ordinary routed W, no isolation, storage reset,
teleport, bot-stat edit, lifecycle change or hitch-script/threshold change.
This stability sample does not establish general20-30s pacing. Server-error.log
retains simulation-backlog and friendly-hit rejection warnings; no unmeasured
cause or capacity conclusion assigned.

Cleanup session41-cleanup.json: twelve owned preview processes stopped; zero
remaining owned processes, port8796 listeners or inspection browsers. Nine
changed/untracked paths remain within apps/ironsight/**; whitespace check passes.
No commit, push or deploy. Supervisor owns preview publication. All standing
gates green; this session's candidate remains local.

Open owner questions/defaults: keep the required ping step and automatic credit
only after a valid own room echo (yes); implement explicit backup/selection and
acknowledgement next (yes), then combine shooting/objective/communication into a
single first-match course. Keep spawn policy until broader evidence warrants
changes (yes). Industrial daylight, amber/teal, stylized sci-fi, server-verified
hits,6v6 team modes and twelve-seat FFA remain defaults. Human wayfinding/learning,
muted-mic communication, hands, headphones,6v6/RTT, iGPU/thermal and other browsers
remain open. No owner answer needed to continue.


### Session 42 - 2026-09-09: Explicit team backup at the caller's location

Read standing brief, Session42 supervisor status, plan and all63 design references.
Started clean on ironsight-aaa; scope apps/ironsight/**. Reference: R-L08, R-L22,
R-L09, R-L14. Concrete target: an explicit rebindable backup request, server-derived
caller position, same-team-only delivery, shared2s cooldown/5s lifetime, no moving
tracking, and three viewport sizes with no HUD overlap. Implemented and verified.
All63 scorecard rows retained; static audit reproduced and gap list re-ranked:
acknowledgement/selection wheel and the combined first-match course lead, followed
by broader spawn evidence. R-L08 remains partial; a dedicated shortcut closes
explicit backup, not the reference wheel or muted-microphone human acceptance.

B defaults to Need backup in Settings, alongside Q's contextual aim-and-mark.
Existing saved B bindings retain priority and leave backup unbound; normal
conflict-removing rebinding applies. Input sends only intent plus finite aim.
The room accepts absent/context/backup intent, rejects unknown selections, stamps
sender and deadline, and takes backup x/z from its own player state. Client-supplied
position/kind/sender cannot forge the mark. Both actions consume the same cooldown;
FFA rejects both, training echoes privately, and team modes send only to seated
allies. Dead/ended requests are rejected. Backup is a frozen location at send time,
never tracking; it neither reveals enemies nor changes bot behaviour. No persisted
state/codec shape change; client and Worker should still publish together to support
the new transient message kind. Old clients will ignore unknown backup messages.

A teal B diamond distinguishes backup from amber + and coral ! marks. The peripheral
notice says NEED BACKUP and caller location when sent, and the two-line hint shows
both current bindings. Notice rises20px to clear the extra hint line. Caller arrow
is drawn before marks so it cannot cover the backup symbol at the same position.
Existing five-second expiry, six-marker bound, one mark per sender and active-state
clearing remain. An active own backup echo can satisfy the existing own-mark lesson;
the course still teaches contextual Q as its primary example. No lesson-state writes,
teleports, fabricated network events or artificial damage in browser evidence.

Two new regression cases plus expanded mode/inactive checks cover authoritative
origin despite forged coordinates/sender, frozen location after movement, malformed
intent, privacy, shared cooldown in both directions, dead/ended rejection, FFA/private
training, existing-B migration and reassignment. Full suite424 passed,6 existing/opt-in
skips;44 files passed,4 skipped. Final pnpm typecheck, pnpm test, pnpm build:client,
pnpm audit:assets PASS: .inspect/session42-{typecheck,test,build-client,audit-assets}.log.

Real-input backup captures: session42-final-backup-{1920,1280,720}.png and final-report.json.
Each confirms own room echo, expiry and pause clearing at1920x1080,1280x600,720x900.
The additional session42-bindings report/captures use actual Settings clicks, rebind
to V, prove old B does not send, and verify the new hint and server echo. Reproduce:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots practice-two
--assert-backup --prefix session42-bindings. Opened before-ping-1920, final-backup-1920,
final-backup-720 and bindings-backup-rebound. Before/after share the unchanged
Undertow spawn/facing: contextual mark on the wall versus backup at the caller;
this is presentation/functional evidence, not a human communication playtest.

Matched Undertow effects stress: session42-before-report.json versus final-report.json,
associated inspector logs/captures, and session42-render-delta.json. Edge152/RTX5070
D3D11,1920x1080 balanced/DPR1, eleven remotes plus local rifle,145 twelve-rifle
volleys,96 explosions,2130 steady samples and complete effect drain. Both budget
assertions pass. Each stress browser ran alone without CPU tests/other inspectors.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|189|0|
|Peak submitted triangles|113966|113966|0|
|Resident textures|23|23|0|
|Estimated texture MiB|60.2513|60.2513|0|
|Median/p95/p99 frame interval ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame interval ms|7.2|7.7|+.5|
|First-ready max ms|7.4|7.1|-.3|
|Browser-resident programs|19|19|0|

Preparation272.3->281.3ms; construction43.6->50.1ms. No performance improvement
claimed. Offline stress does not mount communication UI; separate normal-input
captures exercise that path. Desktop intervals do not establish mid-laptop iGPU60fps,
thermal/cold-driver or human6v6/RTT acceptance. Public25,854,100->25,856,006bytes
(+1,906); assets19,621,558 unchanged. Largest Switchyard architecture5,858,908bytes.
Evidence session42-{before-bytes,bytes}.json.40MiB total/25MiB per-file limits pass.
No new asset, light, shader, render pass, texture, dependency or per-frame bake.
Meshy spend0; reported balance1530. No provenance/allowlist change required.

Static session42-reference-audit.json reproduces tools/reference-audit.ts:
Relay/Undertow23 full/14 waist, Switchyard42/10; no head-height cover. Sprint
rotations14.44/11.56s,14.22/14.22/10.67s,14.44/14.44/11.11s respectively;
all150x100m/12=1,250m2 per seat. ADS250/200/225/400/165ms and sprint recovery
120/100/130/150/90ms,3s respawn,1.4 enemy/ally foley gain, confirmed hit pip,
two damage cues and five-row top-right feed retained. DOM4/8s capture,
1point/2s/flag and no side swap still differ from reference. No new natural
multi-seed pacing/fairness sample; prior team medians remain open.

Rejected intermediates: Shift+ping was considered, then rejected before coding
because sprint could accidentally change intent; a separately rebindable B avoids
that ambiguity. Initial typecheck caught the missing backup configuration-label
union member; corrected before final green checks. The first binding browser probe
clicked a Settings row below its scroll viewport, leaving B unchanged; added explicit
scrollIntoView and a visible V-hint assertion, then reran successfully. No game
workaround, weakened gate, hitch threshold change or lifecycle rework.


All three normal-input training drills also PASS with the expanded hint:
session42-training-report.json, training-inspector.log and per-map lesson/unbound/
rebound/completion PNGs. Nine map/viewport lesson layouts remain inside bounds,
outside the aim corridor and clear of HUD, including the two-line communication hint.
Opened Undertow1280 lesson as an additional visual review. Reproduce with --shots
onboarding,practice-two,practice-three --assert-training --prefix session42-training.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS: session42-required-inspector.log and required-report.json.
All five accepted before/final/bindings/training/required reports have zero console
errors and forbidden offline requests: session42-report-checks.json. The first report
aggregation read hit Windows cp949 decoding; rerun with explicit UTF-8 succeeded.
Runtime/public files remained fixed through final functional/training/required and
combat inspection; later writes only affect plan/evidence.


Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS: hitch.json, session42-hitch.json and hitch.log.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Only frame>24ms was startup97.8ms.
Live8.165s, first damage29.039s (20.874s after live); deaths30.762/82.920s,
respawns33.816/85.975s. Ordinary routed W; no room isolation,
storage reset, teleport, bot-stat edit, lifecycle change or hitch-script/threshold
change. This single stability sample does not establish general20-30s pacing.
Server log retains friendly-hit rejection warnings; no capacity/latency conclusion
is assigned to them.

Cleanup session42-cleanup.json: twelve owned preview processes stopped; zero
remaining owned processes, port8796 listeners or inspection browsers. Thirteen
changed paths are all apps/ironsight/**; whitespace check passes. No git commit,
push, deploy or publication. Supervisor owns preview publication. All standing
gates green; Session42 candidate remains local.

Open owner questions/defaults: keep B as a separate rebindable backup action
(yes); add acknowledgement/selection wheel next, then integrate move/aim/shoot/
objective/communication into a first-match course (yes). Keep spawn policy until
broader evidence warrants changes (yes). Industrial daylight, amber/teal, stylized
sci-fi, server-verified hits,6v6 team modes and twelve-seat FFA remain defaults.
Human wayfinding/learning, muted-mic communication, hands, headphones,6v6/RTT,
iGPU/thermal and other browsers remain open. No answer needed to continue.


### Session 43 - 2026-09-09: Hold-to-select contextual team communication

Read the standing brief, Session43 supervisor status, plan and all63 design
references. Started clean on ironsight-aaa, scope apps/ironsight/**. Reference:
R-L08, R-L22, R-L14. Concrete target: keep one rebindable contextual ping key,
open explicit context/go/backup selection after250ms, send only on deliberate
release, cancel safely, freeze aim while selecting, and fit1920x1080,
1280x600 and720x900 without overlapping existing HUD. Functional checks pass.
All63 reference rows retained and static audit rerun. R-L08 remains partial:
the wheel is implemented; acknowledgement/audio and muted-microphone human
team review remain open. Re-ranked first-play gap toward those and the combined
move/aim/shoot/objective/ping first-match course; broader spawn evidence next.

Tap Q now sends the contextual mark on key release (under250ms). Hold Q opens
three radial choices: up=context, left=Go here, right=Need backup.24px central
dead zone cancels; right-click, blur, lost pointer lock, death/offline/inactive
state cancel pending selection. Keyboard repeat cannot reopen a cancelled hold.
Mouse motion while open selects without turning aim; shooting/ADS are suppressed
while open and require a fresh press afterwards. Movement continues. B retains
its direct backup shortcut. Both keys retain normal Settings conflict removal;
the wheel follows a rebound ping key. The peripheral hint teaches tap/hold.
Selection uses bounded mouse offsets and a small DOM overlay, updated only when
its visible selection changes. No timers, scene lights or render passes added.

Server accepts explicit go intent alongside context/backup, resolves its location
through the existing authoritative aim/cover/bounds calculation, and forces the
route label. Client position/sender/kind claims remain ignored. All kinds share
the existing2s cooldown,5s lifetime, team-only privacy and private training echo;
FFA rejects communication. No state codec, persistence shape, bot, map/collision,
hit resolution or lifecycle change. Publish client and Worker together for the
new intent; older servers reject explicit go. No asset/provenance/allowlist change,
new dependency, bake or Meshy use. Spend0; reported balance1530.

Three new tests cover tap/hold boundaries (including delayed rendering), rebound
release, repeated/cancelled gestures, radial selection and server route privacy/
authority/shared cooldown. Final full suite427 passed,6 existing/opt-in skips,
45 files passed/4 skipped. Typecheck, client build and asset audit pass; evidence
.inspect/session43-{typecheck,test,build-client,audit-assets}.log.

Real-input wheel probe passes all three layouts, own server backup and route
echoes, frozen server-observed aim, centre/right-click/pause cancellation, Q->V
Settings rebinding, old-key rejection, and fast tap after rebinding. Evidence:
session43-final-report.json, final-inspector.log and final-wheel-{1920,1280,720,
backup-selected,backup-sent,go-sent,rebound}.png. Reproduce inspect-map.mjs
--url http://localhost:8796 --shots practice-two,undertow-effects-stress
--assert-ping-wheel --assert-budgets --prefix session43-final. No teleports,
lesson writes, fabricated room events, HP edits or bot changes. Before image:
session43-before-ping-1920.png; final wheel-backup-selected shares the unchanged
Undertow arrival. Opened both plus720 wheel; selected amber border/underline,
labels and centre sight gap are readable. Narrow viewport has no HUD overlap.
This is solo functional evidence, not two-human muted-mic acceptance.

Matched Undertow stress before/final reports: Edge/RTX5070 D3D11,1920x1080,
balanced/DPR1, eleven remotes plus local rifle,145 twelve-rifle volleys,96 blasts,
2130 samples with full effect drain. Browsers ran individually without concurrent
CPU tests. Both budget assertions pass. session43-render-delta.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak draw calls including shadow work|189|189|0|
|Peak submitted triangles|113966|113966|0|
|Resident textures|23|23|0|
|Estimated texture MiB|60.2513|60.2513|0|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame ms|7.6|7.6|0|
|First-ready max ms|7.2|7.1|-.1|
|Browser programs|19|19|0|

Preparation273.8->273.7ms, construction46.1->46.0ms; no improvement claimed.
Offline stress does not mount the wheel; ordinary-input probe covers it separately.
Desktop figures do not establish mid-laptop iGPU60fps, human6v6/RTT or thermal/
cold-driver acceptance. Public25,856,006->25,868,353bytes (+12,347); assets remain
19,621,558bytes. Client1,928,118 and source map4,318,069bytes. Largest file:
Switchyard architecture5,858,908bytes. session43-{before-bytes,bytes}.json.
40MiB total/25MiB per-file asset gates pass. Final stress preceded only an input
indentation fix; runtime content is unchanged by that final rebuild.

Static session43-reference-audit.json reproduces tools/reference-audit.ts:
Relay/Undertow23 full/14 waist, Switchyard42/10; no head-height cover. Sprint
rotations14.44/11.56s,14.22/14.22/10.67s,14.44/14.44/11.11s; all maps150x100m,
1,250m2/seat. ADS250/200/225/400/165ms, sprint recovery120/100/130/150/90ms,
3s respawn, enemy/ally foley1.4, confirmed hit pip, two damage cues and five-row
top-right feed retained. DOM4/8s capture,1point/2s/flag and no side swap still
differ from reference. No new many-round pacing or side-fairness claim.

Rejected intermediates: typecheck rejected importing DOM wheel code into the
server test compilation; extracted the pure gesture state machine into its own
module and kept DOM rendering client-only. Initial shell reads used unsupported
PowerShell brace paths/nonexistent minimap/backup-probe names; corrected to actual
files. Selected a radial three-choice hold with direct B retained; acknowledgement
is a separate next task. No gate thresholds or hitch script changed.


The optional training probe initially failed its first movement prerequisite:
950ms of W left the actual four-metre lesson incomplete, with no console error.
Failure retained as session43-training-report.json/failure.png/inspector.log.
Changed only the probe to walk back through the same space for up to3s while
checking actual lesson completion, always releasing S. No fixed key duration is
accepted as movement; no threshold or gameplay change. The complete rerun passes
Relay/Undertow/Switchyard: session43-training-final-report.json and inspector.log,
per-map lesson/unbound/rebound/completion captures. Nine map/viewport lesson
layouts fit and avoid HUD/aim overlap. Undertow17.457s route/hold/reset drill,
4s actual unscored rehearsal, mode3/A100/score0:0 unchanged. Opened its1280 ping
lesson. Original movement/aim/hit/objective/mark requirements remain intact.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS: session43-required-inspector.log and required-report.json.
All four accepted before/final/training-final/required reports have zero console
errors or forbidden offline requests: session43-report-checks.json. Runtime/public
files fixed through final training, required inspection and combat probe; only
plan/evidence writes afterwards.


### Session 44 - 2026-09-09: Relay density and ground scale for the expanded yard

Read the standing brief, Session44 supervisor status, plan and all63 design
references. Started clean on ironsight-aaa; scope apps/ironsight/** only. The new
10:50 supervisor density directive overrides the older communication-first gap
list. Reference: R-M03, R-M04, R-M07, R-M10, R-M13, R-M17, R-M18, R-M19, R-M20.
Targets: waist/full cover at8-12 m beats, inner objective courts, central landmark
visible from each lane, ground detail at metre scale, >=12 px/m baked source AO,
10-15 s rotations and a40 m rifle route. Contact target remains20-30 s.
All63 scorecard rows retained and audited; affected evidence updated above.

Relay boxes37->107: full23->61, waist14->46. The literal2 m tile map now adds
cooling screens/courts, offset service bays and freight barriers; these same
boxes drive client geometry, server movement/shot occlusion, minimap and ground
bot navigation. The6 m core supports a solid14 m signal spine (2x6 m footprint,
y6..14), with receiver cassettes within the12 mm cladding envelope. Its top is
8 m above the roof and inaccessible by the normal jump; traversable floor tiers
remain ground/3/6 m. Four original3 m ramps, spawns, cap anchors, practice roster,
150x100 m bounds,6v6 fill and authoritative gameplay rules remain intact.

Two added regression tests check cover proximity <=12 m at2 m samples on cooling,
both service approaches and freight, and clear eye-to-spine segments from all
three lanes (both sides of service), including authoritative spine hit occlusion.
Existing tests prove mirror symmetry, spawn exits/opposing-spawn screening,
practice target standing/navigation, cap reachability and the40 m rifle corridor
at z25.8/27/28.2. These are sampled geometry checks, not proof every possible route
has8-12 m cover-to-cover travel. A/C courts and B shoulders are a first inner-ring
pass; exactly-two co-visible entrances/human defensive quality remain partial.
The direct-path navigator test moved from the now-covered z11 court to the
preserved55->95 m rifle corridor; it still asserts a straight unobstructed path.

Ground: the512px low-frequency colour atlas remains for broad stains/paint and
contact multiplication. Its existing128px/0.8 m seamless roughness tile now also
modulates diffuse colour in the loading-time material shader (160 px/m detail).
The same tiled normal and roughness textures are reused; no new texture/pass or
per-frame bake. Original tire/patch coordinates now scale to map bounds. Ground
AO rebaked2048x1365,13.65 px/m source,122,886->769,103bytes. It is still downsampled
into the colour atlas at load: source resolution is not a runtime AO-resolution
claim. Broad markings remain atlas-limited; the visible improvement uses the
supervisor's tiled-detail alternative to a large resident colour atlas.

Fresh architecture AO plus original vertex weathering, no purchased/generated
input. Architecture2,499,400->3,388,284bytes. Concrete weathering uses the tool's
supported2 m edge spacing:30,420 concrete triangles, unchanged45,000 cap.
Audit proves original oriented surfaces/authored normals, finite UVs and unchanged
weathered bounds/area; source27,844 triangles and30,420 weathered concrete children.
Evidence session44-{maps,architecture,weather,architecture-audit}.json and bake logs;
reproduction commands/provenance in public/assets/README.md. Existing allowlists
already name both assets. Meshy spend0; reported balance1530. Collider-specific
cover and shared-material detail were the useful work within63.75MiB residency.
No new dependency, light, dynamic lighting change, render pass or asset path.

Before/after captures: .inspect/session44-{before,final}-{overview,cooling,relay,
freight,effects-stress}.png; final also captures vista. Opened before/final core
views, both overview images, cooling and final core receiver detail. The first
candidate's blank spine was refined with inset cassettes; its unweathered kit was
not accepted as final. Final uses the complete weathering pipeline. Reproduce:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots
 overview,cooling,relay,freight,vista,effects-stress --assert-budgets --prefix session44-final
(with the shot list on one line). No forced gameplay outcomes in this offline fixture.

Matched renderer stress, Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
11 remotes plus local rifle,145 twelve-rifle volleys,96 blasts,2130 samples and
full effect drain. Browsers ran alone without concurrent CPU tests/bakes.
Both resource assertions pass; session44-render-delta.json and before/final reports:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|220|220|0|
|Peak submitted triangles|128906|144050|+15144|
|Resident textures|30|30|0|
|Estimated texture MiB|63.7513|63.7513|0|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame ms|7.2|7.3|+.1|
|First-ready max ms|7.1|7.0|-.1|
|Browser-resident programs|27|27|0|

Construction32.6->36.8ms; preparation522.5->531ms. Geometry/occlusion changed;
no performance improvement claimed. Desktop intervals do not establish laptop
iGPU60fps, thermal/cold-driver or human6v6/RTT acceptance. Public25,868,353->
27,409,577bytes (+1,541,224); assets19,621,558->21,159,144 (+1,537,586).
Largest file remains Switchyard architecture5,858,908bytes.40MiB public/25MiB
per-file limits pass; session44-{before-bytes,bytes}.json.

Static session44-reference-audit.json: Relay A-B/B-C14.44 s unchanged, A-C
11.56->11.78 s, all10-15 s. All maps remain1,250m2/seat. Other maps unchanged.
ADS250/200/225/400/165ms; sprint recovery120/100/130/150/90ms;3s respawn;
foley enemy/ally1.4; confirmed hit pip, two damage cues and five-row top-right
feed retained. DOM4/8s capture,1point/2s/flag and no side swap still differ
from reference. No weapon/mode/respawn/spawn-policy/lifecycle retune this session.

Natural production-bot Relay6v6 seed0x28abc:221.3s,red49/blue50. Median initial
LOS/damage contact5.4/13.7s; respawn4.4/11.55s. LOS is an unobstructed100 m
segment opportunity without FOV; damage sampled every100ms; unobserved contacts
are absent, never zero. Target20-30s remains NOT MET. This was one in-process
round, not workerd capacity or a matched before/after pacing experiment.
Evidence session44-bot-{round.json,heatmap.svg}, bot-metrics.log. Reproduce with
RELAY_METRICS=1, METRICS_PREFIX=session44 and pnpm exec vitest run
 test/relay-metrics.tool.test.ts. No accelerated gameplay constants, teleport,
HP changes, forced kills, isolated live room or scripted bot route.

Rejected intermediates: initial tile drafting overlapped an existing service
house and stopped before writing. One navigator test used a now-covered path;
updated its unobstructed fixture to the tested rifle corridor. New broad waist
barriers initially received equipment-case decals, exceeding the existing132
triangle service-detail cap; limited case labels to compact<=2m crates and kept
the cap. Weather spacing0.7/1.2 m exceeded45,000 concrete triangles;2 m passed.
No threshold, gate script, shader-recompile allowance or gameplay workaround.

Final pnpm typecheck, pnpm test, pnpm build:client, pnpm audit:assets PASS.
429 passed,6 existing/opt-in skips;45 files passed,4 skipped. Evidence
session44-{typecheck,test,build-client,audit-assets}.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS: required-inspector.log/required-report.json. Accepted before/final/required
reports have zero console errors or forbidden offline requests:
session44-report-checks.json. Runtime code/assets fixed through final render,
required inspection and live hitch gate; only documentation/evidence afterwards.

Open owner questions/defaults: keep this first Relay density pass (yes), proceed
to Undertow then Switchyard density/ground scale (yes), and retain contact pacing
as unresolved rather than change movement/TTK/spawn rules without broader evidence
(yes). Review actual cover rhythm/court entrances/landmark recognition in6v6;
keep industrial daylight, amber/teal, stylized sci-fi and server-verified hits.
Human wayfinding, hands, headphones,6v6/RTT, iGPU/thermal and other browsers remain
open. No owner answer is required to continue. Supervisor owns publication.


Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS: session44-hitch.log/json and hitch.json.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup recompiles,
frames>150ms, console errors or long tasks. Two frames>24ms:80.2ms at startup
and50.7ms at7.570s. Live17.874s; first damage40.652s (22.778s after live);
deaths42.375/98.991s, respawns45.312/101.951s. Ordinary collision-routed W,
unchanged hitch script/thresholds, no room isolation, forced death, teleport,
HP edits or storage reset. This single live stability sample does not override
the natural-round pacing miss. No lifecycle debugging or capacity claim.

Cleanup session44-cleanup.json: ten owned preview processes stopped, zero
remaining owned processes, port8796 listeners or inspection browsers. Final
asset audit rerun after provenance update; git diff --check passes. All standing
gates green. No commit, push or deploy. All changes remain apps/ironsight/**;
Session44 is local and ready for supervisor review/publication.
