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
- **M3 — complete two-map art pass:** Undertow industrial kit, Relay hero prop and
  baked grounding, map callouts/minimap, map selection presentation. Measure both.
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
