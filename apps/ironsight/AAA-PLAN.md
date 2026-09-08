# IRONSIGHT / RELAY — rebuild plan

## OWNER PLAYTEST GUIDE

**Preview:** https://ironsight-next.plain-wave-5d5b.workers.dev
Supervisor reports sessions 1-26 are deployed there, including layered impacts,
grounded remote reactions/deaths, weapon handling, combat HUD and Relay weathering.
Session 27's threat audio remains local until publication. Continue using the standing
brief's active defaults.
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

## Reference scorecard

Session 24 first canonical audit (reference restored), updated in Session 27. Met means the stated implemented
check, not owner/iGPU/6v6 acceptance. Static measurements: `.inspect/session27-reference-audit.json`;
reproduce with `tools/reference-audit.ts`. Original document targets remain authoritative;
short-map timing mismatches are recorded, not silently redefined as passes.

| Id | Status | Evidence |
|---|---|---|
| R-M01 | partial | Relay lane purposes documented; other-map lane/defensive-angle acceptance incomplete. |
| R-M02 | not yet | No co-visible entrance count audit; Undertow B has four planned approaches. |
| R-M03 | met | Session24 reference audit: Relay 13 full/8 waist, Undertow 14/8, Switchyard 6/5; zero head-height boxes. |
| R-M04 | not yet | Ground BFS rotations 1.33-7.33 s walk, 0.89-4.89 s sprint; below 10-15 s. |
| R-M05 | partial | Relay decks and Undertow control ledges; Switchyard route-changing hook absent. |
| R-M06 | n.a. | No world power pickups implemented. |
| R-M07 | not yet | Spawn-to-cap proxy 2.33-10.67 s walk; one live Relay probe first-received-damage 11.062/9.548/1.611 s. Recontest/other maps unmeasured. |
| R-M08 | partial | Lane accents and hero silhouettes exist; half-to-half orientation needs player review. |
| R-M09 | partial | Session25: all maps/FFA prefer unoccupied, sampled-LOS-hidden spawns, then danger/support; 4,608 static decisions, zero avoidable exposure. No recent LOS history; all-exposed fallback remains. |
| R-M10 | partial | Objective cover exists; defensive rings/approach quality not audited. |
| R-M11 | partial | Collider-derived kits and ramps tested; all reachable viewpoints need player review. |
| R-M12 | partial | Relay/Undertow route beats documented; not all lanes validated as action blocks. |
| R-M13 | partial | Cooling/Relay/Freight themes and three map palettes; Undertow/Switchyard richness remains. |
| R-M14 | n.a. | No destruction/windows system promised; fixed openings remain authoritative. |
| R-M15 | partial | Undertow DOM-first, Relay TDM-first; majority-mode rule not universally met. |
| R-M16 | not yet | No timed central item-control loop. |
| R-M17 | partial | Relay core/uplinks and lane signs; all-lane central landmark visibility unverified. |
| R-M18 | partial | Ground plus 1.2/2.4 m structures, not reference 3/6 m tiers; traversal budget retained. |
| R-M19 | partial | All maps retain 60x40 m CQB; AR four body hits/300 ms at close range. Long-range distribution unverified. |
| R-M20 | partial | Opt-in map-metrics heatmap exists; no many-round side win-rate acceptance. |
| R-G01 | not yet | No contested HP/ammo reward loop. |
| R-G02 | partial | Five weapon/falloff profiles and grenades; no melee and human balance unverified. |
| R-G03 | partial | Sniper tracer, slow cadence and Session26 400 ms ADS acquisition; hip fire remains immediate, glint absent. |
| R-G04 | partial | AR still spread zero/moving .02 rad; SMG/sniper/pistol nonzero still; no crouch spread bonus. |
| R-G05 | not yet | No learnable authoritative recoil sequence. |
| R-G06 | not yet | No deep-spray hybrid or authoritative ADS/crouch multipliers. |
| R-G07 | not yet | Cosmetic kick exists; no trauma-driven rotational shake. |
| R-G08 | partial | Cosmetic recoil and reduced motion; no authoritative aim-kick model. |
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
| R-G20 | partial | Shared table now also owns ADS/sprint timers; same handling model in client/server. Authoritative learnable recoil, crouch/ADS accuracy multipliers remain absent. |
| R-L01 | partial | Streak notices at 3/5/8 reset on death; no tier rewards/catch-up. |
| R-L02 | partial | TDM 50 kills/300 s; DOM 4 s neutral/8 s enemy capture, 1 point/2 s/flag, target 200; no side swap. |
| R-L03 | met | AR 25 body damage: four hits at close range, 300 ms from first shot at 100 ms cadence. |
| R-L04 | met | 3000 ms live respawn retained; Session25 dynamic scoring on every map/FFA, real room join tests and live respawn hitch gate. Human/6v6 camping acceptance remains open. |
| R-L05 | partial | 10 s warmup and skippable 20 s results; replicated countdown/5-8 s freeze absent. |
| R-L06 | not yet | No replay capture or highlight sequence. |
| R-L07 | not yet | No objective/assist-aware MVP selection. |
| R-L08 | not yet | No contextual team ping system. |
| R-L09 | partial | Controls/onboarding and targets; no guided progression/objective/ping lesson. |
| R-L10 | partial | Solo auto-fill to four operators; no first-three-match difficulty progression/ranked. |
| R-L11 | partial | Bots use 200 ms reaction and ordinary damage/HP; difficulty progression/flank acceptance open. |
| R-L12 | partial | Baked illustrative palette/operator contrast; all lighting/player readability unverified. |
| R-L13 | partial | Team-colour mass on existing operator; torso value separation needs real-play review. |
| R-L14 | partial | Collider authority and bounded VFX; distance-amplified fresnel absent and iGPU acceptance open. |
| R-L15 | not yet | No skill-based HP/ammo reward. |
| R-L16 | partial | Shared movement/combat systems; no staged content progression. |
| R-L17 | partial | Explicit streak/kill feedback; no broader repeatable medal set. |
| R-L18 | partial | Session27 reserves four of twenty remote voices for unobstructed enemy foley; box-blocked sounds attenuate. Specific R-G14 1.4 gain takes precedence over generic 1.2-1.3; path reachability not modeled. |
| R-L19 | partial | Server rewind/plausibility checks and numeric ping; network quality label absent. |
| R-L20 | partial | Five rows, killer/weapon/victim/HEADSHOT text; top-right, team coloured, objective feed absent. |
| R-L21 | met | Session24: confirmed victim-only bearing, four labelled sectors, 60 ms flash/edge vignette, 900 ms direction; nine HUD fixtures. Reduced motion omits flash; human comfort open. |
| R-L22 | partial | Minimap exists; contextual pings absent. |
| R-L23 | not yet | No enemy-highlight colour dropdown. |

## AAA gap list

Re-ranked after Session 27: threat gain, surface foley and direct-path cover filtering
are delivered. Shared learnable recoil is the next finishable gap. Audio routing and
headphone acceptance remain partial; resolved lifecycle recovery stays closed.

1. **Learnable recoil and accuracy (R-G04-06, R-G08, R-G20).** Shared recoil patterns,
   authoritative ADS/crouch accuracy and predicted claim-ray parity; handling timers
   are implemented, but high-RTT/mouse comfort still requires player review.
2. **Spawn fairness and solo encounters (R-M09, R-M20).** All-map/FFA selection now
   avoids available unoccupied sampled-hidden alternatives. Measure real contact,
   recontest and side/route heatmaps; address all-exposed pools and recent enemy LOS.
3. **Environment orientation/richness (R-M08, R-M13, R-M17).** Undertow/Switchyard
   exteriors next; only ~0.25 MiB stress texture headroom. Meshy where silhouette helps.
4. **First-play/flow/accessibility (R-L08-10, R-L19-23).** Guided training, contextual
   pings, countdowns, network-quality label and highlight colour choices.
5. **Layout/mode pacing (R-M04, R-M07, R-M19, R-L02).** Current CQB map scale and
   five-minute rounds miss reference rotation/economy targets; measure real encounters
   before coordinated map/movement/economy changes. AR close-range 300 ms TTK supports
   the retained CQB footprint; sniper lanes must remain exceptional.
6. **Audio routing and acceptance (R-G14, R-G16, R-L18).** Headphone mix/surface identity,
   ramp-volume occlusion and sound around doorways; current direct box filtering is
   bounded and tested, not a reachability/diffraction model.
7. **Human/device acceptance.** Moving hands/holds, headphone mix, 6v6/RTT, iGPU,
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
