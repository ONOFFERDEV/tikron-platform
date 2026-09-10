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
rebindable B / Need backup at your location. Session 43 adds hold-Q selection: mouse up for context, left for Go here, right for Need backup; release to send, centre/right-click to cancel. Session 44 adds Relay lane cover/courts, a solid central signal spine and tiled ground colour. Supervisor status confirms Session44 is deployed. Session45 adds sprint-slide (hold forward + sprint, then hold crouch), FOV/weapon momentum and slide/landing foley; supervisor status confirms it is deployed. Session46 adds jump-assisted waist-cover vault/mantle and Undertow density/detail; supervisor status confirms it is deployed. Session47 completes Momentum with Switchyard induction pads, cover density and ground detail; supervisor status confirms it is deployed. Session48 started Signal Break but failed the supervisor test gate and was not published. Session49 fixes both CPU-heavy test timeouts and completes Signal Break with a collision-backed core passage, safe shutter closure, historical shot barriers and limited bot pushes. Supervisor Session50 status confirms Sessions48/49 passed, were committed as f4c5e55 and deployed to preview. Session50 adds earned UAV recon; supervisor Session51 status confirms commit 8f61762 and preview deployment 10df4e62-db09-4eb8-b7ff-05047aef76a5. Session51 adds the five-kill called mortar; Session52 supervisor status confirms commit1308f51 and preview deployment d693dfc0-9273-452d-adbf-a9c91afcf6f8. Continue the standing brief defaults.
Session53 quick check (published to preview per Session54 supervisor, commit a35bf17): in Training / Relay, switch through1-5 and fire. Look for the amber rifle crown, compact cool SMG fork, broad orange shotgun bloom, narrow sniper lance and small pistol star. Aim down sights to see the reduced local flash; remote shooters keep their full weapon signature.
Session54 quick check (published per Session55 supervisor, commit b237662): face a sniper down a long lane. A steady white scope glint appears when its held rifle points toward you, including hip fire. It disappears when the sniper turns away, reloads, dies or takes cover. Reduced motion preserves this warning. This is an optical cue, not proof that the shooter has acquired ADS or can fire this instant.
Session55 quick check (published per Session56 supervisor, commit e5cbe11): throw G into nearby open ground, or earn five kills and call a mortar with V. Nearby visible impacts rock the horizon with a smooth, bounded roll, then settle within two seconds of the last impact. ADS reduces this motion; Reduced motion switches it off. The center aiming ray stays fixed. Weapon Spectacle3/3 completes the arc by default.

Session56 quick check (published per Session57 supervisor, commit 755eb7f): enter a fresh TDM, DOM or FFA room and click to play during warmup. The map/mode/team banner counts down to the real room deadline, with three short pips and a resolved GO chord when the server starts. Positions reset at start. Late joins see the remaining time; joining a live round skips the start announcement. Training stays immediate.

Session57 quick check (published per Session58 supervisor, commit 423d156): click to enter a fresh warmup. A short aerial glide introduces the map and its three routes, then cuts to your operator before the final countdown. Click or press a key to skip; that gesture does not also fire/throw/jump. Reduced motion holds a still view. Training, live joins, waiting lobbies and arrivals with less than 4.5 seconds left go straight to the operator. Deployment2/2 completes the arc by default without extending warmup.

Session58 quick check (published per Session59 supervisor, commit 3c1008f): approach a combat bot from behind without firing. It now acquires enemies in front, and turns toward nearby gunfire or confirmed damage before returning fire through clear cover. Open a gun attack at least 120 degrees behind a full-health enemy, from at least 2 m, and finish that enemy with a gun within 2.5 seconds to earn AMBUSH in your kill confirmation. No extra score. Training targets remain stationary; walk behind IDLE and try a sniper headshot to rehearse the medal. Flank and Counter1/1 is on by default; encounter pacing is still unaccepted.

Session59 quick check (retained local candidate; supervisor Session60 reports its hitch gate failed): join TDM/FFA and read the role names in the feed and scoreboard. RUSH carries an SMG and closes on a visible enemy to nine metres; ANCHOR carries an AR and strafes; SCOUT carries the sniper and alternates scoped holds with movement. DOM still prioritizes capture points; scouts can settle once arrived. Respawns restore the role weapon. Training dummies stay stationary. Fireteam 1/2 is on by default; committed flank routes are next.

Session60 quick check (published per Session61 supervisor, commit aa58dce): in Relay TDM, check Freight as well as Cooling. RUSH pairs take opposite side routes each life, keep moving past distant visible fights, and return toward the far-side service lane. Within8m they fight normally. The same routes run in Switchyard FFA, oriented from the actual spawn. DOM keeps capture priorities; a Relay core assignment cancels a flank. Fireteam2/2 is complete and on by default. No reaction, accuracy, health or damage buff.

Session61 quick check (retained local candidate; Session62 supervisor reports a failed hitch gate, so it was not published): join Relay TDM or Undertow DOM. A nearby teammate who holds visual contact for 600 ms can radio a three-second last-seen report: caller role, lane, direction and distance to the frozen mark. Listen for a short two-note ident; watch the diamond on the minimap. One call per team every eight seconds, one per caller every sixteen. Manual pings take priority. Reduced motion and mute retain the text. Contact and Counter1/1 is on by default; FFA/training and bot combat stats remain unchanged.

Session62 quick check (published per Session63 supervisor, commit 5c7cb75): Training / Undertow, follow the north Clarifier route and face the twin lift towers. Thirty seconds into the room, PRESSURE DROP warns for eight seconds. The two sluices rise ten metres, discharge into the exterior basin for fifteen seconds, then lower over three seconds. Radar stays online. Reduced motion keeps gate travel and water but omits animated foam. Pressure Drop1/2 is on by default; the collision-backed maintenance-route payoff is required in Session63, so this arc is not complete.

Session63 quick check (published per Session64 supervisor, commit 7f90230): Training / Undertow, approach the MAINTENANCE / TRANSIT doors on either side of the central pressure stack. PRESSURE DROP warns at30s; at38s the gallery opens for15s. Cross beneath the stack to the other lane. Stay inside when discharge ends to see CLEAR TO SEAL; both doors wait until you leave. Radar stays online. At most one nearby bot per team volunteers for the route in DOM, then returns to capture duties. Pressure Drop2/2 completes the arc, on by default.

Session64 quick check (local candidate): Undertow DOM, leave your deployment bay at either end. Full-height machinery now screens the first opening; turn through the gap behind it into the inner lane. Both teams get the same north/south breakout cover. Three matched bot seeds reduce contacts within five seconds of respawn from15 to0, but large score gaps remain. Breakout1/1 is complete and on by default; this is an exit-safety improvement, not overall fairness acceptance.

Session65 quick check (published per Session66 supervisor, commit 9292cd9): Training / Switchyard, follow East service and face the amber gantry. At30s CARGO SHIFT warns for eight seconds; the sealed container rises eight metres, travels28m between exterior berths and lowers during the15s transfer. Radar stays online. Session66 completes Cargo Shift with playable freight cover below.

Session66 quick check (published per Session67 supervisor, commit b81ec33): Training / Switchyard, find FREIGHT / 04 at East service. The orange4x3x6m counterweight is full cover. At CARGO SHIFT it retracts flush with the floor for15s: cross directly, but expect to be exposed. Remain on the marked crossing after transfer to see CLEAR TO RAISE; leave and it becomes full cover again. Mute and Reduced motion retain the same cover and text. Cargo Shift2/2 is complete and on by default.

Session67 quick check (published per Session68 supervisor, commit 133b005): Undertow DOM, follow a teammate out of deployment and watch the minimap as the round develops. Bots now split their pushes between unfinished flags and leave a defender at secured flags. Nearby human teammates count toward reinforcements; a gallery volunteer temporarily leaves its usual assignment. Split Fronts1/1 is complete and on by default. Contact timing and human balance remain unaccepted; the separate Switchyard GPU hitch remains unresolved.

Session68 quick check (published per Session69 supervisor, commit ba440b3): Undertow DOM, join a teammate at A or C. Arrived guards slowly watch the incoming approach; close fights keep their dodges near the flag instead of pulling them toward an old map lane. Quiet rear flanks remain possible; gunfire and damage still attract attention. Hold and Counter1/1 is complete and on by default. Encounter pacing, human balance and GPU hitches across FFA/DOM remain unaccepted.

Session69 quick check (published per Session70 supervisor, commit 1101d88): operators now have a restrained lit edge against machinery. Open Settings / Enemy colour and choose Yellow or Violet to recolour opponents; Team colours restores the original teams. Allies, objectives and the feed keep their team colours. FFA/training treats every remote operator as an opponent. The setting saves immediately; cover still hides the entire operator. Clear Contact 1/1 is complete and on by default (rim on, team colours default). Human colour-vision/readability acceptance and intermittent GPU stalls remain open.

Session70 quick check (published per Session71 supervisor, commit ab1fb9e): Undertow DOM, follow a B-bound teammate through Pump service. The two new B/PUMP HALL signs mark solid pump returns; round them and enter the existing court doors. Bots use this covered approach while A/C attackers retain the rifle lane. Pump Breach 1/1 is complete and on by default. Opening B fights move closer to the flag, but overall contact timing and fast respawn safety remain unaccepted; the three matched seeds have more fast respawn contacts than before.

Session71 quick check (published per Session72 supervisor, commit b43589e): Undertow DOM, take the northern deployment exit toward A or C. The new signed machinery baffle screens the inner lane. Round either end to peek, then push into the court with your teammates. Breakwater 1/1 is complete and on by default. In three matched bot seeds, contacts within five seconds of respawn fall from 2/1/2 to 0/0/0; overall pacing and human fairness remain unaccepted.

Session72 quick check (local candidate): finish a TDM or Undertow DOM round. The amber FIELD HONORS card names the winning side's MVP and shows the actual contribution: two points per elimination, one per assist, plus one per shared second of useful flag progress in DOM. Idle ownership earns no capture credit. Listen for the short commendation sting; mute and Reduced motion retain the full award. Draws have no MVP. Field Honors 1/1 is complete and on by default. Replay and human scoring/fairness acceptance remain open.

Session73 quick check (local candidate): finish a round and read NEXT DEPLOYMENT below Field Honors. Its seconds come from the server's shared intermission deadline; late joins see the remaining time. REMATCH still lets the majority return sooner. At zero the display waits for the server, then existing warmup begins. Next Deployment 1/1 is complete and on by default. The configured twenty-second intermission remains; replay and human excitement remain open. Supervisor confirms Session72 is published as commit9a55e3d.

Session74 quick check (published per Session75 supervisor, commit ed99354): take damage in TDM/FFA. The red edge now uses a baked border while the four direction labels and central aiming space remain clear; Reduced motion retains direction without flashing. Raster Budget1/1 also makes the headless hitch policy explicit:1500ms presentation ceiling,150ms main-thread limit,25ms p99 and5% stalled-time budget. Every>150ms gap remains reported. Five consecutive runs of each mode pass that revised policy; driver freezes and representative iGPU acceptance remain open.

Session75 quick check (published per Session76 supervisor, commit bb3fd52): Training / Relay, leave deployment and look along Cooling, then approach the core. The yard has crisp six-by-five-metre slab joints; concrete walls show formwork and recessed tie shading. Fine aggregate and quieter coated steel/paint replace the flat finish while signs and team colours retain priority. Surface Detail1/3 is on by default for Relay. Undertow and Switchyard are the next two stages; representative iGPU and human visual approval remain open.

Session76 quick check (published per Session77 supervisor, commit1672d51): Training / Undertow, follow the north basin or south Pump service route. Cast concrete panels and fine grain replace the coarse finish; damp lower walls lead into irregular wet patches with a soft sky sheen. Coated trim stays quieter, and signs retain priority. Surface Detail2/3 is on by default; Switchyard completes the arc next. Human visual and representative iGPU approval remain open.

Session77 quick check (published per Session78 supervisor, commit9f44f06): Training / Switchyard, walk through South service and approach a ramp onto the switching deck. Cabinet edges show rubbed paint and quiet steel grain; ramps have shaded anti-slip tread. The yard has crisp slab joints, fine aggregate and broad service stains. Signs and launch markings retain priority. Surface Detail3/3 completes the arc, on by default across all three maps. Human visual and representative iGPU approval remain open.

Session78 quick check (published per Session79 supervisor, commit1356a28): Training / Undertow, look northwest across the twin flood towers, then follow Clarifier route or Pump service. A low warm sun and blue dusk clouds replace the shared daylight sky; long shadows and the same sky reflected in wet patches give the plant depth. Signs, operator team colours and the gallery remain readable. Afterlight1/2 is ON for Undertow; Session79 completes the arc with Switchyard overcast. Human visual/device approval remains open.

Session79 quick check (published per Session80 supervisor, commit057e989): choose Free for all / Switchyard. Its deployment image now matches the cool overcast sky in the yard; look up at the amber gantry during CARGO SHIFT, then follow North bus or South service. Broad silver clouds, softer direct light and cool reflections give the depot its own weather while signs and operators remain distinct in the inspected views. Undertow's deployment image now shows its dusk plant. Afterlight 2/2 completes the arc, ON by default; human visual/device approval remains open.

Session80 quick check (local candidate): open a fresh TDM or Free for all room. Arena preparation now also prepares combat UI before mouse control is enabled. The first hit, elimination and results keep the same appearance. First Fight1/1 is ON by default. Five complete-observation bot pairs pass the150ms first-damage/death check; early loading/presentation costs and representative device acceptance remain documented below.

**Live fps.tikron.dev stays unchanged. This is not live acceptance.**

Session50 quick check (published to preview): in Relay TDM or Undertow DOM, earn three eliminations without dying. A UAV launches automatically and shares three last-seen radar scans with your team over 12 seconds. Kill its operator to end the flight; Relay blackout blocks scans. A queued UAV waits for team airspace and is lost on death. Training / Relay rehearses the same reward privately by shooting the targets. FFA has no UAV yet. Air Support is a three-session arc: UAV now, called mortar next, support drone last.


Session51 quick check (published to preview): earn five gun/grenade eliminations in one life in TDM/DOM or Relay Training. Aim at open ground 8-60m away and press V (Call mortar, rebindable). The marked 6m circle warns for three seconds, then three rounds land 650ms apart. Cover shields you; friendly fire is off except self-damage. Kill the operator to cancel the remaining shells. One charge per life and a 45s shared team battery limit; mortar kills score but do not earn the next reward. FFA remains unchanged. Session52 completes Air Support locally with the seven-kill sentry and a trailing-team shutdown bonus, but the Session53 supervisor reports it FAILED hitch and was not published. Session53 retains that work, corrects instanced-effect preparation, pools transient combat GPU resources and adds five weapon flash signatures locally.

Session52 quick check (local candidate): earn seven gun/grenade eliminations without dying in TDM/DOM or Relay Training. A sentry launches ahead and beside you when the sky is clear; one per team, 60s airspace recovery. It holds its position for12s and fires only while you remain within30m and can see its target. Its900ms laser warning marks a fixed point: strafe or use cover to evade. Eliminating its operator cancels it. A trailing team receives a one-time shutdown bonus (+1TDM point when behind by5, +5DOM when behind by20). Support kills score but cannot earn support. FFA stays unchanged. Training lets you rehearse seven ordinary kills and watch the drone work while you reload.

Try this in 10 minutes with headphones, mouse/keyboard and another player ready:

| Time | Try | Look for |
|---|---|---|
| 0-1 min | Open Settings using Tab/Enter; adjust sensitivity, rebind a key, close with Escape. Try volume and Reduced motion. | Clear focus, readable labels, saved choices; no unwanted movement while in a menu. |
| 1-3 min | Training / Relay: sprint all three lanes, climb both decks, crouch at cover. Watch arena preparation; fire, aim, reload and switch all five weapons (1-5), then throw G away from yourself. | Solid visible cover, readable enemies/exits, comfortable aim, no first-shot/blast freeze; stable grip and unobstructed sights. |
| 3-5 min | Return to deployment, choose Training / Undertow. Follow movement/aim lessons, find A on the minimap and hold for four seconds; then explore the control ledges. | The rehearsal resets if you leave A or pause, explains Domination, and awards no match score. Distinct routes and solid visible cover. |
| 5-10 min | Join a running Relay TDM with the other player. Fight across cover, open Escape/settings, return, then vote rematch if the round ends. | Correct team/result, hits that agree for both players, clear death/recovery, preserved controls after menus and rematch. |

Session47 quick check: Training / Switchyard, find a teal induction plate beside the central deck, face the JUMP > DECK sign, and press forward + your jump key. Land on the amber target; compare Reduced motion in Settings.

Session48 quick check: Training / Relay, head toward the northern Cooling wall and look up at the dish. Thirty seconds after the room starts, watch the eight-second warning, the six-second turn and 15-second minimap outage. B still sends a text backup callout. Session49 completes the arc: the core opens with the blackout. Training / Relay: follow the CORE / TRANSIT signs on the west/east faces of the central spine. The 4m-wide tunnel opens 38s after live starts; cross during the 15s blackout. If you remain inside, the HUD says CLEAR TO SEAL and both doors stay open until you exit. One nearby bot per team can stage for this route in TDM. Supervisor Session50 status confirms the core event is published to preview.

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
   reload-to-rematch votes. Session56 now replicates the warmup deadline and handles late joins/cancellation.
   The results intermission still lacks a replicated deadline; keep its future
   countdown on server time too.

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
| Environment (Blender 4.5) | Session79 completes Afterlight2/2: Undertow dusk, Switchyard overcast, Relay daylight. Matching deployment vistas; one PMREM before play | Switchyard HDR/sky279,975bytes and2MiB visible sky; existing1.5MiB PMREM, fixed lights/pass |
| Material detail | Session77 completes Surface Detail3/3: Switchyard worn steel, ramp tread and R8 ground; Relay slabs and Undertow wet concrete retained | Stress texture MiB: Relay63.745, Undertow63.301, Switchyard63.995; human/device review open |
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

Asset set ceiling <= 60 MiB total (owner decision 2026-09-10), <= 25 MiB every individual asset, lazy per map.
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
AO and a map-selected PMREM (Undertow dusk, Switchyard overcast, Relay daylight); no bloom/SSAO postprocessing.
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
| downloaded game assets | <= 60 MiB whole product (owner decision 2026-09-10), per-map loading |

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

Session 24 first canonical audit (reference restored), updated in Session 80 (all 63 principles re-reviewed). Met means the stated implemented
check, not owner/iGPU/6v6 acceptance. Static measurements: `.inspect/session80-reference-audit.json` (fresh build, identical to Session79);
reproduce with `tools/reference-audit.ts`. Original document targets remain authoritative;
short-map timing mismatches are recorded, not silently redefined as passes.

| Id | Status | Evidence |
|---|---|---|
| R-M01 | partial | Session60 adds authored Cooling/Freight and North bus/South service rusher routes. Two route assignments per normal team; actual spawn picks direction. All-spawn collision walks and natural route-stage samples pass. Three named lanes retained; human route quality open. |
| R-M02 | partial | Session70 retains B's two north doors, with standing/crouched eye rays clear at x69/81 and all-spawn approach walks in both gallery states. Two pump returns block the long z85 line before the doors. All-objective/human co-visibility audit remains incomplete. |
| R-M03 | met | Session71 adds two 2x3x8m full-cover northern baffles. Undertow128 closed/126 open colliders; Relay111/Switchyard112 retained. Five recorded crossing/threat pairs and their mirrors block standing/crouched rays in both gallery states. No head-height cover; bakes match collision. |
| R-M04 | met | Session71 static ground BFS retains A-B/B-C/A-C at Undertow14.22/14.22/11.33s, Relay14.44/14.44/11.78s, Switchyard14.44/14.44/11.56s. All remain in10-15s at sprint; walk values remain higher. No speed or target change. |
| R-M05 | met | Session66 Cargo Shift2/2 ON: eight-second warning,15s freight cover retraction and direct crossing, occupied down-lock hold, restoration after exit. Shared server collision/prediction/historical shots. Relay core and Undertow gallery hooks retained. Implemented route-changing hook check; human tactical quality unaccepted. |
| R-M06 | n.a. | No world power pickups implemented. |
| R-M07 | not yet | Session72 read-only opening audit separates northern rifle-lane attackers (13.8-20.3s in the fixed cohort) from red home guard bot-1 (36.7/54.4/104s). Three matched rounds reproduce Session71 lives/contact samples exactly; initial17.1/18.0/18.1s and respawn17.7/18.1/18.7s remain below20-30s. No pacing acceptance or timer/HP change. |
| R-M08 | partial | Session79 overcast makes the amber east freight gantry distinct against silver clouds; five paired views retain west capacitor/east crane geometry and the central switching spine. Both weather-map menu vistas now match play. Human wayfinding remains open. |
| R-M09 | partial | Session71 traces five fast contacts to the SECOND northern crossing after hidden spawns, with inner-lane threats. Mirrored baffles atx18-20/x130-132,z24-32 block the retained ray fixtures while both ends remain walkable. Three matched rounds remove sampled<5s respawn contacts; all-exposed fallback, human camping and side fairness remain open. Spawn scoring/protection unchanged. |
| R-M10 | partial | Session71 signed full-cover baffles protect staging outside A/C courts, with a standing bypass/peek at either end. Existing court entrances, pump approaches and gallery retained.20.414s normal DOM sequence reaches A with teammates. Human defensive quality and all-objective entry audit remain open. |
| R-M11 | partial | Session66 freight body stays in its authoritative envelope with <=2cm surface trim, flush down-lock floor and permanent north/south bypasses. Permanent kit exclusion/overlap and live crossing tested. All reachable viewpoints still need player review. |
| R-M12 | partial | Session71 Breakwater1/1 normal20.414s DOM capture shows the signed northern baffle, allied movement around it and arrival at A. Paired fixed-camera stills show the former firing slit blocked. No injected gameplay state; human action-block/excitement acceptance open. |
| R-M13 | partial | Session71 A/WEST CONTROL and C/EAST CONTROL signs use the existing atlas on the protected faces of the northern baffles. Live stage2 still shows the destination before the turn, then stage3 reaches A. Existing lane/half silhouettes and pump signs retained; human wayfinding open. |
| R-M14 | partial | Session66 Switchyard removes full freight cover to open a direct10m crossing;1.56->1.11s ground sprint route, then safe restoration. Discrete historical barriers shared by analytic/hybrid hits; no cosmetic-only opening. All-round windows/destruction remain absent. |
| R-M15 | partial | Undertow DOM-first, Relay TDM-first; majority-mode rule not universally met. |
| R-M16 | not yet | No timed central item-control loop. |
| R-M17 | partial | Session79 paired North bus, central deck and freight-crossing views retain the tall amber switching spine, gantry and lit route signs under overcast. Relay signal dish/spine and Undertow flood towers remain. Human all-lane wayfinding remains open. |
| R-M18 | partial | Session47 preserves ground/3m deck/6m roofs and four true ramps.14m switching-spine top is unreachable from6.611m launch peak, not a fourth usable floor. No sunken tier; human vantage acceptance open. |
| R-M19 | met | All maps 150x100 m / 12 seats = 1,250 m2 per seat and tested 40 m rifle corridors. Switchyard FFA; this density check does not establish pacing or fairness. |
| R-M20 | partial | Session72 seeds170684/5/6 reproduce Session71 scores165:195/193:159/146:189, all300s, and identical kills/lives/gallery/objective samples/heatmaps. MVP impact50/59/64 includes18/25/32 shared capture seconds; each is also its winning team's kill leader. Separate fixtures prove objective/assist-led selection. No human fairness or many-round win-rate claim. |
| R-G01 | not yet | No contested HP/ammo reward loop. |
| R-G02 | partial | Momentum arc implemented by default: earned slide,650ms waist vault/mantle,1.2s intentional deck launch. Full route clearance and hands-busy combat gating/recovery tested. Five weapons/grenades retained; melee/human balance open. |
| R-G03 | met | Session54 steady scope glint from replicated held-sniper aim/life/reload, including hip fire: full inside4 degrees, smooth fade to14, range1-120m. Both eye and animated lens rays must clear current cover/ramps/core shutters; depth-tested, no delayed cover fade. Reload/death/swap/AOI leave remove it; Reduced motion retains it. Sniper tracer and400ms ADS retained. Offline12/38/98m captures and cover/cone/pool tests; human counterplay/RTT acceptance open. |
| R-G04 | met | Session31: stationary cone AR/SMG/shotgun/sniper/pistol 0/.0002/0/.0001/.0002 rad; movement .02/.03/.02/.12/.02 added. Grounded crouch reduces cone 25%; shared accuracy tests. Human burst feel open. |
| R-G05 | partial | Session31 fixed per-weapon authoritative offsets, four vertical automatic opening shots, later lateral drift; mouse probe and server-ray tests. Secure timed recovery replaces instant release reset; human learning/RTT acceptance open. |
| R-G06 | met | Session31 bounded center-biased deep-spray cone after 8/7/8/8/5 shots; ADS .65/.70/.80/.50/.65 and grounded crouch .75 multiply. Shared function on server/claims, distribution and authority tests; slow weapons settle between shots. |
| R-G07 | met | Session55 received grenade/mortar impacts add bounded0-1 trauma; roll=trauma squared times smooth7/11Hz waves, <=2degrees, fully decayed within2s. Distance/current cover gated, ADS reduces65%; Reduced motion/death/pause/disconnect clear. Camera quaternion restored after draw, eye/center ray unchanged even during draw. Five regression cases, paired stills, real20s grenade/settings drill and earned mortar captures. Human comfort remains open. |
| R-G08 | partial | Session31 authoritative aim offset separated from cosmetic weapon kick. Reduced motion preserves the exact aim model; dedicated reduce-view-kick setting remains absent. |
| R-G09 | partial | Session69 adds a bounded material rim to the existing operator and capsule fallback, with no outline geometry or extra pass. Matched six-metre role stills retain weapons/poses and surface detail. Enemy-only yellow/violet choices and live switching tested. Distinct role skins, all-range silhouette and human hold/readability acceptance remain open. |
| R-G10 | met | Session53 five original atlas silhouettes and34/42/50/60/64ms lifetimes (2-4frames at60Hz); local/remote share one source and eight pooled slots. Real22.072s five-weapon input capture:17server shots/7hits,all flashes expire. ADS reduces local size/opacity. Human readability/comfort remains open. |
| R-G11 | met | Shot events drive travelling tracers; sniper 1200 m/s, others 500-800; hits remain instant server hitscan. |
| R-G12 | partial | Session47 launch uses existing lowered traversal weapon pose; before/flight/landing/reduced captures retain the center aiming corridor. No new hand/remote flight clip; moving pose acceptance remains human work. |
| R-G13 | not yet | Hip FOV remains 78, with Session45 cosmetic +5 sprint / +8 slide; Reduced motion keeps 78. No 90-100 default/110-capped slider. |
| R-G14 | partial | Session66 real normal cargo drill retains the warning/transfer/recovery PA/motor cues; muted/reduced drill has zero motor sources with readable cover/hold text. Hostile foley1.4 and surface cues unchanged; headphone/comfort acceptance open. |
| R-G15 | partial | Confirmed hit 900/1400 Hz at .28 gain; kill 660/990 Hz at .30. Bypasses voice cap; headphone mix unverified. |
| R-G16 | partial | Session27 collision-box segment occlusion: .32 gain / 1100 Hz cutoff, event-time only. No ramp-volume occlusion, diffraction, doorway routing or HRTF. |
| R-G17 | partial | Session20 cached crack/body/tails and limiter; distance filtering, no separately authored far recordings. |
| R-G18 | partial | Sway exists, ADS retains 12% (88% reduction); shared camera FOV, no separate weapon FOV. |
| R-G19 | met | Session26 shared ADS 250/200/225/400/165 ms and sprint recovery 120/100/130/150/90 ms, real-room boundary tests, five-weapon mouse probe and sprint/fire control check. Hip fire remains allowed; human/RTT acceptance open. |
| R-G20 | met | Session66 Switchyard joins shared CoreCollision/CoreGate: movement/traversal, prediction, current and historical rays, pings, grenades/blasts, spawns, audio and both bot navigation states. Analytic/hybrid shots tested across both transitions; forged input rejected. Weapon table unchanged; RTT feel open. |
| R-L01 | met | Session52 Air Support3/3 ON:3-kill UAV,5-kill mortar,7-kill sentry.12s stationary sentry,60s shared airspace,900ms frozen-point warning,22m range,34damage/1.8s; dodge/cover/owner-death counterplay. One trailing-team gun/grenade operator shutdown earns +1TDM behind5 or +5DOM behind20. Death/seat/round reset and no recursive support earning tested. Human balance open. |
| R-L02 | partial | TDM 50 kills/300 s. Session39 DOM natural rounds 253.9/300/300 s, scores 87-201/153-177/174-165. Actual 4/8 s capture, 1 point/2 s/flag and no side swap remain below reference requirements; training rehearses the actual neutral duration without changing economy. |
| R-L03 | met | AR 25 body damage: four hits at close range, 300 ms from first shot at 100 ms cadence. |
| R-L04 | met | 3000 ms live respawn and dynamic scoring retained. Session38 restores authoritative arrival aim once, wraps yaw into codec range, and passes real death/revival with no probe aim correction. Human camping acceptance remains open. |
| R-L05 | partial | Session73 Next Deployment1/1 publishes a shared server-clock intermission deadline through matchEnd/syncView. Same clock drives automatic warmup; majority skip retained. Stable text countdown, old-server fallback and server wait at zero; late/forged/boundary/delayed-tick tests plus desktop/narrow/reduced fixtures pass. Results remain skippable20s rather than the reference5-8s freeze. Session57 glide and Session56 warmup countdown retained; human flow acceptance open. |
| R-L06 | not yet | Session72 Field Honors adds an objective/assist-aware MVP card and a short sting; no replay recording, killer POV or highlight playback. The5s intro/12s replay reference remains unmet. |
| R-L07 | met | Session72 server MVP: winning seated team only;2/elimination+1/verified assist+1/whole shared useful capture second in DOM. Deterministic objective/assist/death/id ties; no award for draws/practice/zero contribution. Frozen matchEnd+syncView result, expiry/reset cleanup, actual gun-assist and capture-room tests. Natural327.292s DOM capture shows ANCHOR4,14kills/2assists/23s=53. Implemented selection/presentation check, not human scoring acceptance. |
| R-L08 | partial | Session61 nearby living allies receive bot visual-contact snapshots after600ms continuous sight: one/team/8s, one/caller/16s,50m recipient radius,1m rounding,3s expiry, no target IDs. Existing team-ping diamond plus caller/role/lane/relative direction/distance/age and240ms radio ident. Manual marks yield5s and own the card. Real input captures at1920/1366/800 widths, mute and Reduced motion pass. FFA/training excluded; human acknowledgement/wheel retained; muted-mic human review open. |
| R-L09 | partial | Session41 requires an active own server-echoed ping after each map's existing lessons; key rebinding/unbound guidance, pause rejection and nine map/size layouts pass with ordinary inputs. Relay confirmed-hit and Undertow actual 4 m/4 s unscored objective rehearsal retained. A combined first-match course and human learning review remain open. |
| R-L10 | partial | All three expanded maps fill twelve seats (Switchyard FFA). Undertow training now rehearses an objective without targets or scoring; Switchyard remains empty traversal practice. No first-match progression. |
| R-L11 | partial | Session70 B orders use authored Pump service approaches chosen from own position; every-tick corner progress survives12s order renewal, expires45s, and clears on reassignment/death/gallery/reset. Near reinforcements bypass entry detours. Actual flag stays the hold/duel anchor. Hearing/sight/reaction/weapon rules unchanged; all-spawn routes and room overrides tested. Human tactics remain open. |
| R-L12 | partial | Session79 completes Afterlight2/2 ON: Switchyard stratus, cool diffuse fill/reflections and weaker high key; Undertow dusk and Relay daylight retained. Five paired player-height views, 11-operator stress and matching map-selection vistas. Human all-lighting/readability and broader fidelity remain open. |
| R-L13 | partial | Session79 brighter final diffuse fill lifts the first candidate's dark freight walls. Original large actor team-colour masses, rim and enemy choices remain; sampled actors and white route signs read against quieter blue-grey steel. Human colour/value and all-range review remain open. |
| R-L14 | partial | Session80 First Fight1/1 ON: 18 real DOM/CSS views rasterize during loading, with inert copies removed before input. GPU trace covers134 raster tasks and21 pixel/21 vertex executable tasks during433.9ms preparation. Five consecutive fresh-profile TDM/FFA pairs include pre-profiler live-join events and pass150ms first-damage/death checks. All three stress draw/texture budgets unchanged. Early frame intervals, including the292.4ms FFA outlier, remain reported and investigated in the session log; no universal driver/iGPU/thermal acceptance. |
| R-L15 | not yet | No skill-based HP/ammo reward. |
| R-L16 | partial | Session72 Field Honors1/1 ON: existing kill/assist/capture authority feeds one end-round commendation and explicit contribution breakdown.20.209s natural results still sequence, narrow/reduced/older-server fixtures. No extra reward economy, new geometry or replay. Human excitement remains open. |
| R-L17 | partial | Session58 AMBUSH: first gun damage to a full-health enemy from>=120degrees behind and>=2m, same attacker gun finish<=2500ms. Server-only classification; no warmup/support/assist/expired award or bonus score. Existing notice expires1800ms, only local killer sees medal, Reduced motion retains it. Real20.009s training input and five responsive HUD fixtures; broader medals remain open. |
| R-L18 | partial | Session27 reserves four of twenty remote voices for unobstructed enemy foley; box-blocked sounds attenuate. Specific R-G14 1.4 gain takes precedence over generic 1.2-1.3; path reachability not modeled. |
| R-L19 | partial | Session36 RTT-based delay labels, two-second change hold/recovery margin, immediate known-disconnect state, quiet numeric RTT/FPS. Six responsive HUD fixtures and real training capture pass. RTT alone does not measure loss/jitter; actual RTT/escaper feel and outage-detection timing remain open. |
| R-L20 | partial | Session59 existing five-row top-right feed/rosters now use stable RUSH/ANCHOR/SCOUT names for combat bots; actual mixed-weapon/assist/local-victim captures pass. Team colour and weapon/HEADSHOT text retained; objective feed and bottom-left convention remain unmet. |
| R-L21 | met | Session80 retains Session74 baked border,60ms flash and900ms labelled direction; matched combat still is byte-identical. Four directions and both hitmarker styles prepare before play, without changing live HP/feed/focus/settings. Desktop/narrow/Reduced motion cleanup and real-settings-entry checks pass. First natural damage/death intervals are below150ms across five fresh-profile pairs; human comfort remains open. |
| R-L22 | partial | Session50 minimap plots ONLY server-issued,1m-rounded UAV snapshots for2.2s; no live enemy tracking/IDs from this channel. Opponents get public flight times without contacts, including syncView; practice is private, FFA disabled. Blackout clears scans and suppresses sampling without extending the flight. Authority and actual earned-input captures pass. |
| R-L23 | met | Session69 Settings / Enemy colour: Team colours(default), Yellow, Violet. Existing material tint/rim uniforms only; known opponents override, allies remain, FFA/training all remotes hostile. TDM/FFA keyboard switching,800x600 control, save/reset/invalid migration, stable programs/material versions and pixel-identical hidden-operator/empty-cover images pass. Implemented dropdown check, not human colour-vision acceptance. |


## AAA gap list

Session80: all63 rows re-reviewed; fresh static measurements match Session79.
The supervisor's14:25 compositor-warmup instruction took priority this session.
First Fight1/1 now prepares all18 match UI views and the actual minimap before
input, with five complete-observation TDM/FFA pairs. Early presentation outliers
remain recorded; this does not establish a universal driver fix or iGPU acceptance.
After this dedicated performance arc, the visual-first ranking below stands:
operator/weapon fidelity is next, followed by local wear and hero dressing.
Public ceiling60MiB, per-file25MiB, per-map lazy loading, fixed lights and
the existing headless policy remain. Switchyard still has only5461 estimated
texture bytes free; the loading copies add no persistent WebGL residency.

1. **Operator and weapon fidelity (R-G09/12/18, R-L13/23).** Next visual arc: distinct role silhouettes/skins and a convincing first-person grip.
   Include weapon detail and moving reload review. Retain large team
   colour masses, enemy colour choices and unobstructed sights.
2. **Localized surface wear and hero dressing (R-L12-14, R-M13/17).** Surface
   Detail's three-map foundation is complete; the full material gap stays open.
   Reduce repeated cabinet silhouettes with visible maintenance details, authored
   scorch/grime/markings and selective Meshy hero props. Preserve the64MiB/fixed-
   light/no-extra-pass budget; Switchyard has only5461 estimated texture bytes free,
   so release residency before adding textures. Measure visible additions.
3. **GPU/device acceptance (R-L14).** Keep every>150ms gap in evidence. The new
   headless limit is not rendering headroom or60fps acceptance. Investigate new
   owner-visible triggers with per-frame resources and covered cross-process
   traces; require laptop iGPU, thermal, real6v6/RTT and Firefox/Safari review.
4. **Opening roles and court counterplay (R-M07/09/20, R-L02/11).** The fixed
   northern attacking cohort contacts at13.8-20.3s; red home guard bot-1 waits
   36.7/54.4/104s. Build a bounded attack/recontest action block that improves
   both exposure and useful guard engagement. Preserve two peeking exits,
   split orders, B's pump route and the gallery. No timer/HP workaround.
5. **Actual highlight replay (R-L06).** MVP selection/presentation now exists
   (R-L07), but there is no replay capture or playback. Choose a bounded arc
   that can show a real server-confirmed play, with objective context and
   clear skip/reduced-motion behavior, inside the current performance budget.
6. **Flow, accessibility and communication (R-L08-10/19-23).** Combined
   first-match course, ping acknowledgement,
   role skins/voice barks and human colour/readability acceptance remain open.
7. **Mode economy and weapon/audio comfort (R-L02, R-G05/08/13/16/18).**
   DOM scoring/side swap, separate weapon FOV, view-kick control, doorway
   acoustics, commendation mix and human headphone/mouse review remain.
8. **Movement and resource-loop acceptance (R-G01/02/12/19/20, R-M05/12/16).**
   Momentum stays ON; moving hands/flight, bot pad use and freight bypass fights
   need review. No contested resource/skill-recovery loop exists.

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


### Session 45 - 2026-09-09: Momentum arc 1/3 - earned sprint-slide

Read the standing brief, Session45 supervisor status, plan and all63 references.
Started clean on ironsight-aaa; scope apps/ironsight/** only. The newer 11:10
owner directive overrides the bare-density-first ranking. Re-ranked all63
reference rows around a three-session Momentum arc: sprint-slide now, waist-cover
mantle/vault with Undertow density next, then a traversal hook with Switchyard
density. This session's slide is playable ON by default; no feature flag or owner
answer needed. Remaining arc work is explicit in the gap list, not claimed done.

Reference: R-G02, R-G12, R-G14, R-G19, R-G20, R-M12, R-L14. Concrete targets:
a real sprint earns one bounded low traversal beat; collisions and server hit
volumes stay authoritative; existing90-150ms sprint recovery remains; camera
feedback leaves the centre aim corridor clear and Reduced motion suppresses it;
no new lights, shaders, passes, resident textures or asset downloads. Implemented
checks pass. The wider golden triangle, human comfort and map action blocks are
still partial; R-G07 trauma and R-G13 default-FOV/slider targets remain not yet.

Implemented shared SprintSlide simulation in src/slide.ts, called by the room
and local fixed-step predictor. Hold forward+sprint for>=300ms of actual travel,
then press/hold the existing crouch bind (C or Ctrl by default). A slide locks its
world direction, decelerates12->4m/s over800ms and travels exactly6.4m in16 ticks
on clear level ground. It is a short opening burst followed by a slowdown, not a
sustained traversal-speed increase (sprint covers7.2m over the same800ms).
Cooldown1200ms after finish/cancel and a fresh crouch edge prevent repeated holds
or rapid cancels from chaining boosts. Releasing crouch/forward, ADS, jumping,
airborne movement or substantial collision interruption ends it. A blocked sprint
cannot bank run-up. Jumping uses the existing jump; no airborne speed carry.

The room accepts only existing validated move intents, ignoring client claims of
speed, slide state or deadlines. moveAndSlide resolves the actual movement against
the same boxes/ramps/bounds. Crouched eye/capsule and lag-compensated hit volumes
remain unchanged. Hip fire becomes available after existing sprint recovery;
ADS cancels momentum and uses the normal acquisition time. Death/respawn clears
predicted momentum and room spawn clears its per-seat controller; seat expiry/bot
removal cleans the map. Two small AOI-filtered slide start/end messages carry
server-derived positions; no state-codec/snapshot-shape change. Publish client
and Worker together for the new predicted movement. No SDK, hit resolution,
match rules, bot difficulty, spawn policy, collision map or lifecycle changes.

Presentation: +5-degree sprint FOV / +8 slide FOV, 75ms response, <=.035rad
(~2degree) slide bank, .06m weapon drop/.18rad cant and suppressed walking bob.
Grounded landings after>=100ms air time trigger a<=.055m downward dip with110ms
decay. All extra FOV/bank/drop/dip is removed by Reduced motion, without changing
movement or aim. The lock prompt teaches sprint-slide using the current crouch
binding. Remote fast crouched travel uses the existing crouch-idle hold instead
of rapid crouch footsteps; server-confirmed slide cues suppress remote footsteps.
No new purchased animation/asset, mesh/material, light or pass.

Slide scrape filters the existing cached noise by concrete/metal, with a brief
gear transient,800ms bounded envelope and60ms cancellation release. Landing uses
footstep thud plus equipment cue. Nearby remote slides use server events, the
existing spatial/cover filter and1.4 enemy/ally threat gain; death/AOI removal/
disconnect clear their handles. All sources disconnect when done, share volume/
mute and existing voice limits. Headless execution does not constitute headphone
mix acceptance. Meshy spend0; reported balance1530. No new asset means no asset
provenance or allowlist entry; no dependencies or texture-budget exception.

11 new tests cover run-up travel vs walls, exact6.4m/direction/diagonal bounds,
held-key repeat/cooldown, ADS/jump/release/air/collision cancellation, forged fields,
room near-event pair and sprint-to-fire protection, matching prediction and
prediction death/respawn reset. The first test run reached all movement assertions
but called a nonexistent test-harness dispose method; removed that call (fake-timer
harness follows the existing tests). Final full suite440passed,6existing/opt-in
skips;47files passed/4skipped. pnpm typecheck, pnpm test, pnpm build:client and
pnpm audit:assets PASS; session45-{typecheck,test,build-client,audit-assets}.log.
No thresholds, physics constants, old tests or hitch-script allowances changed.

Wow check: accepted before/after stills of the new moment are
.inspect/session45-final-slide-{before,sprint,after,settled,reduced}.png.
Opened the before/after pair and Reduced motion capture: low viewpoint, canted
weapon and horizon bank read clearly while the central aiming corridor stays clear.
Player sentence: "I can sprint into a low slide and come out shooting."
This uses the brief's before/after-stills alternative, not a claimed video or
human playtest. No image edits. The action is captured using real key intents
in the existing training room after ordinary collision-routed W staging into
the Relay rifle lane; no teleports, artificial room isolation, HP/bot edits,
fabricated game events or forced outcomes.

Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
slide,effects-stress --assert-budgets --prefix session45-final (one line).
The new slide-probe observes one actual server start/end pair, crouched state,
full slide then ordinary idle crouch; release/ADS/jump/pause each cancel a new
slide. Real Settings UI enables Reduced motion and another real slide retains
78 FOV versus85.994 during the normal sample. Evidence final-report.json,
final-inspector.log and session45-slide-summary.json. The event-to-event interval
is759.1ms: start is emitted after the first50ms integration step; start->end
positions differ5.8125m plus that first.5875m step =6.4m. Render-visible active
samples span741.6ms; neither value replaces the800ms simulation duration.
Peak prediction-to-last-received-position gap1.549m includes stale state echoes;
settled difference is.062m, not a measured correction/RTT or speed-rejection rate.
The same probe's cancellations/reduced-motion checks all pass. Preliminary
session45-slide-report.json also passes; final expands coverage. All accepted
before/slide/final/required reports have zero console errors/forbidden offline
requests: session45-report-checks.json.

Matched Relay effects stress: Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
11remotes plus local rifle,145twelve-rifle volleys,96blasts,2130samples and
full effect drain; browsers ran alone without CPU tests or bakes. Both assertions
pass; session45-render-delta.json and before/final reports:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|220|220|0|
|Peak submitted triangles|144050|144050|0|
|Resident textures|30|30|0|
|Estimated texture MiB|63.7513|63.7513|0|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame ms|7.6|7.3|-.3|
|First-ready max ms|7.1|7.1|0 rounded|
|Browser-resident programs|27|27|0|

Construction66.2->68.8ms, preparation1025.2->325.6ms; cache/order differs and
no initialization speedup is claimed. Offline stress does not activate traversal;
the separate real-input probe checks that presentation. Desktop frame intervals
do not prove mid-laptop iGPU60fps, cold-driver/thermal or human6v6/RTT acceptance.
Public27,409,577->27,429,458bytes (+19,881); assets21,159,144 unchanged. Client
1,936,210bytes; source map4,333,496; largest file Switchyard architecture5,858,908.
40MiB total/25MiB individual limits pass; session45-bytes.json.

Static reference audit rerun: session45-reference-audit.json and session45-reference-audit.mjs.
All maps150x100m/1250m2 per seat. Relay61full/46waist; Undertow23/14;
Switchyard42/10. Sprint-only rotations remain Relay14.44/14.44/11.78s,
Undertow14.22/14.22/10.67s, Switchyard14.44/14.44/11.11s. These are unchanged
BFS proxies and do not include slide use. ADS250/200/225/400/165ms, sprint
recovery120/100/130/150/90ms,3s respawn and1.4foley ratio retained. DOM4/8s
capture,1point/2s/flag and no side swap remain mismatches. No new natural-round
heatmap/contact claim: Session44 pacing misses remain open and map geometry is
unchanged. Next density sessions must remeasure natural contact, not infer it
from this movement test.

Exact required map inspection --shots relay,practice-two PASS:
session45-required-inspector.log and required-report.json. Runtime/client build
fixed through final functional/stress and required inspection. The live hitch
gate and process cleanup are recorded below when complete.

Rejected intermediates: a combined patch had an unmatched import context and
made no edits; reapplied against the actual import. Initial controls-text replace
missed the Unicode separator; replaced only the ASCII label. One shell read used
the repo-relative path while already in the app directory; corrected without
runtime changes. No generated asset or weakened quality gate was adopted.

Open owner questions/defaults: keep hold-crouch after a real sprint as the slide
control (yes, existing rebinding), allow hip fire after normal recovery (yes),
retain the800ms bounded/no-air-carry model (yes). Next: waist-cover mantle/vault
with Undertow density, then traversal hook with Switchyard density (yes). Keep
industrial daylight, amber/teal, stylized sci-fi, server-verified hits and6v6 team
modes. Human movement/RTT, remote pose/hands, headphones,6v6 and iGPU/other-browser
acceptance remain open. No owner answer needed. Supervisor owns publication;
no commit, push or deploy performed.


Exact required node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS: session45-hitch.log/json and hitch.json.
Twelve seats, two bot-caused deaths and two respawns; zero post-warmup shader
recompiles, frames>150ms, console errors or long tasks. Only frame>24ms was
startup63.5ms. Live6.756s; first damage27.860s (21.104s after live), deaths
29.806/85.047s, respawns33.339/88.060s. Ordinary production-bot TDM and
collision-routed W through the unchanged hitch script/thresholds. No room
isolation, storage reset, bot/HP edit, forced death or teleport. This is a
stability sample, not multi-round contact pacing or network-capacity evidence.

Cleanup session45-cleanup.json: twelve owned preview processes stopped; zero
remaining owned processes, port8796 listeners or inspection browsers. Runtime
code/public assets stayed fixed throughout final functional/stress, exact map
inspection and live hitch validation; only plan/evidence writes followed.
All standing gates green. git diff --check passes, every changed/untracked path
is apps/ironsight/**, no commit/push/deploy. Candidate remains local and ready
for supervisor review/publication.


### Session 46 - 2026-09-09: Momentum arc 2/3 - vault the Undertow approaches

Read the standing brief, Session46 supervisor status, plan and all63 references;
reviewed the scorecard and selected the next Momentum delivery. Started clean on
ironsight-aaa; scope apps/ironsight/** only. Session45 is deployed per supervisor.
Vault/mantle is playable ON by default this session. Re-ranked the gap list:
Session47 must finish the arc with a distinct traversal hook and Switchyard density.
No owner answer, asset-budget exception or publishing action was needed.

Reference: R-G02, R-G12, R-G14, R-G19-20, R-M03-05, R-M07, R-M10-13,
R-M17-20, R-L14. Targets: grounded jump + forward over1.0-1.25m cover;
full standing-capsule clearance throughout; no full-cover roof climbing;
existing90-150ms weapon recovery; cover within12m of sampled lanes;10-15s
sprint rotations;>=12px/m source ground AO or tiled colour detail. Implemented
movement/geometry/resource checks pass.20-30s natural damage contact is NOT MET;
human combat feel, defensive entrances and mid-laptop performance remain open.

Shared src/traversal.ts runs in the room and fixed-step Predictor. Existing jump
binding + forward selects nearby waist cover (<=.8m from the expanded capsule
boundary). A thin barrier uses vault; broad waist cover uses mantle onto its top.
650ms/13ticks: smooth lift, cross, settle, then450ms cooldown. Landing support,
standing height, continuous expanded-box segment sweeps, exact world bounds and
conservative ramp volumes are checked before commitment. This rejects even thin
ceiling obstructions and unsupported corner mantles. Only ground-level waist
cover qualifies; no assisted chaining from a crate to a full-cover roof. An
ineligible request remains an ordinary jump. No new key, charge meter or flag.

The room accepts validated existing intents and owns the route, height and time;
claimed targets/speed/duration are ignored. Releasing forward or turning after
commitment finishes the bounded650ms route rather than steering through a side
wall. Death/respawn clears prediction; room spawn/seat expiry clear controllers.
The standing authoritative hit volume follows actual replicated feet throughout,
with existing vertical rewind. Snapshot version7->8 starts older snapshots fresh
to keep stored coordinates out of new cover; the state codec is unchanged. Publish
client and Worker together for movement/layout compatibility. Fire/ADS are unavailable during traversal; the
shared weapon handling table applies90-150ms recovery afterward. Grenades are
blocked while active. Tests cover these rules, both endpoints, prediction reset,
blocked ceilings/landings/ramps/bounds, supported corners and forged destinations.
No hit-resolution, bot difficulty, match-economy or spawn-policy retune.

One AOI-filtered server traversal event triggers bounded hand-contact/sleeve noise
using cached audio buffers, current volume/mute, spatial occlusion and1.4 hostile
foley weighting. Sources disconnect after320ms. Existing landing thud is retained.
Camera follows the actual rising feet; the existing weapon lowers.28m and cants
.3rad pitch/.16rad roll, keeping the aiming corridor clear. Reduced motion removes
these cosmetic offsets, preserving traversal and78-degree FOV. No new hand-contact
or remote vault animation clip was authored; remote feet use replicated positions
and existing poses. Human animation/RTT/headphone comfort remains unaccepted.

Undertow:37->114 collision boxes (23->52full,14->62waist). Paired A/C court
lips, staggered full pump screens and low deck/service barriers add actual vault
choices. The original turbine/maintenance kit clads every collider. A solid4x4m
pressure stack rises from the central6m core to14m, with inset panels/rings.
Its top is inaccessible, not a fourth usable floor plane. Ground/3m decks/6m
roofs and all four ramps remain; tests traverse both directions on both decks,
keep spawn exits/screening, navigate every deployment to every cap, preserve B's
two co-visible4m north doors and the40m rifle corridor at z25.8/27/28.2.
Sampled rifle/deck/service routes have cover within12m. These are proximity checks,
not proof that every route has8-12m cover-to-cover travel. Stack sightline tests
cover rifle, both deck approaches and pump service; all-viewpoint approval is open.

Rebaked original architecture:3,937,488->6,347,488bytes (+2,410,000),81,208
source triangles/10material primitives, existing1024-square single-channel AO.
Ground AO121,119->835,222bytes (+714,103),2048x1365/13.65source px/m.
AO still multiplies into a512-square colour atlas at load; high source resolution
is not a claim of high runtime AO resolution. The visible floor-scale improvement
uses the original128px/0.8m seamless normal/roughness tile for diffuse aggregate
as well (160px/m). Shared across flat kit/ground/apron, two resident textures,
+.166667MiB including mips. No new asset URL, npm dependency, light or render
pass; two new program variants are prepared during loading, never first traversal.
Geometry audit confirms oriented surfaces/authored normals, finite UVs and zero
degenerates. Evidence session46-{maps,architecture,architecture-audit}.json and
bake logs. Reproduction/provenance in public/assets/README.md; existing explicit
allowlists retained. Meshy spend0; reported balance1530. This work needed collider
matching and reusable surfaces, not another isolated decorative prop.

Wow check: .inspect/session46-verified-vault-{before,rise,after,reduced}.png.
Opened the before/rise pair, Reduced motion, both map overviews and final deck
view. Player sentence: "I can vault the barrier and keep pushing down the lane."
This uses the brief's before/after-stills alternative, not a claimed video or
human playtest. Real W navigation through the existing Undertow training room,
then ordinary jump key input; no teleports, isolated live room, HP/bot edits or
fabricated game events. Server event confirms one vault; authoritative/predicted
peak feet1.16m, settled server z46.48m. Render-active samples span644.8ms versus
650ms simulation; settled prediction gap.279m is within the existing reconciliation
soft allowance, not proof of zero correction or real-RTT feel. Reduced motion
crosses the same lip backwards, preserves78FOV and removes the cosmetic cant.

Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
vault,undertow-overview,undertow-home,undertow-deck,undertow-maintenance,undertow-effects-stress
--assert-budgets --prefix session46-verified (one line). Before/verified map pairs
and accepted earlier final report have zero console errors/forbidden offline
requests; session46-report-checks.json. The inspector now requires concrete detail
on Undertow as well as Relay; Switchyard still requires none. Resource thresholds,
post-warmup shader allowance and hitch script were not weakened or changed.

Matched Undertow effects stress, Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
11remotes plus local rifle,145twelve-rifle volleys,96blasts,2130samples and full
effect drain. Browsers ran alone without concurrent tests/bakes. Both budget
assertions pass; session46-render-delta.json and before/verified reports:

| Metric | Before | Verified | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|189|0|
|Peak submitted triangles|113966|146246|+32280|
|Resident textures|23|25|+2|
|Estimated texture MiB|60.2513|60.4180|+.1667|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame ms|7.2|7.2|0 rounded|
|First-ready max ms|7.1|7.1|0 rounded|
|Resident programs after preparation|19|21|+2|

Construction31.2->31.6ms; preparation478.9->309.3ms. Cache/order differs;
no initialization speedup claimed. Desktop intervals do not establish laptop
iGPU60fps, cold-driver/thermal or human6v6/RTT acceptance. Final bytes below.

Static session46-reference-audit.json: Undertow A-B/B-C14.22s unchanged,
A-C10.67->11.33s; all10-15s. Relay14.44/14.44/11.78 and Switchyard14.44/
14.44/11.11 retained. All maps150x100m/1250m2 per seat. These are ground BFS
sprint proxies, not vault-route retake timings. ADS250/200/225/400/165ms;
sprint recovery120/100/130/150/90ms;3s respawn;1.4foley; distinct hit pip,
two damage cues and five-row top-right killfeed retained. DOM4/8s capture,
1point/2s/flag and no side swap remain mismatches.

Natural production-bot Undertow6v6 DOM seed0x29abc:300s,164:156,107deaths,
119lives. Median initial LOS/damage7.6/17.65s; respawn6.5/16.8s.20-30s damage
target remains NOT MET. LOS is an unobstructed100m eye segment without FOV;
damage sampled every100ms; unobserved contacts remain absent. Evidence
session46-bot-{round.json,heatmap.svg}, contact-summary.json and bot-metrics.log.
Reproduce with UNDERTOW_METRICS=1, METRICS_PREFIX=session46 and pnpm exec vitest
run test/undertow-metrics.tool.test.ts. Normal production bots/mode/timers;
no forced paths, kills or accelerated gameplay. One in-process natural round,
not workerd capacity, many-round side fairness or a matched pacing improvement.

Rejected intermediates: a lane lip intruded into a ramp approach; moved it before
rebaking and retained the original ramp test. A room fixture approached the broad
side of a barrier (correctly mantled); moved the fixture to the thin side to test
vaulting. A respawn fixture was inside new cover; moved it to the clear rifle lane.
Browser probe initially measured after a slow PNG capture and before the staging
input had settled; now snapshots action state before capture and compares the
endpoint against the actual server-start event. No gameplay changes to satisfy
those probe errors. Final review added supported-corner and world-boundary checks;
the latter test exposed that canStand covers headroom/cover, not horizontal bounds,
so traversal now checks bounds explicitly. Client-import tests moved under the
existing DOM typecheck convention. Two shell commands used the wrong working
folder and did not execute; redirected JSON encoding was normalized to UTF-8.
No weak generated asset, shader allowance or reduced gate threshold adopted.

Final pnpm typecheck, pnpm test, pnpm build:client PASS:454passed,6existing/opt-in
skips;49files passed/4skipped. Evidence session46-{typecheck,test,build-client}.log.
Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS: session46-required-inspector.log/report.json, zero console
errors. Runtime/client assets fixed through verified functional/stress, required
inspection and the live hitch gate; only plan/provenance/evidence followed.

Open owner questions/defaults: keep jump+forward on waist cover (yes), finish a
committed650ms route after releasing forward (yes), hands-busy fire/grenade gating
with existing recovery (yes), and keep conservative ground-level eligibility
rather than allow full-roof chains (yes). Session47 traversal hook + Switchyard
cover/ground pass remains next. Industrial daylight, amber/teal, stylized sci-fi,
server-verified hits and6v6 retained. Human hand/remote pose, headphones, movement
and RTT,6v6 fairness, iGPU/thermal and other browsers remain open. No owner answer
required. No commit/push/deploy; supervisor owns review and publication.


Final pnpm audit:assets PASS: public27,429,458->30,580,196bytes (+3,150,738);
assets21,159,144->24,285,577 (+3,126,433, including provenance text).
Client1,943,987bytes, source map4,350,024; largest file Undertow architecture
6,347,488bytes.40MiB total/25MiB per-file limits pass, no budget exception.
Evidence session46-bytes.json and session46-audit-assets.log.

The first exact hitch command exited0 with two bot deaths, zero recompiles,
>150ms frames/errors/long tasks, but its timeline contained another warmup at
39.675s alongside a local Worker reload. The preview watcher reloads on documentation
writes as well. Retained as session46-hitch-watcher.json/log; it is not the final
uninterrupted-round evidence. No runtime/gate change: rerun below with all files
held steady. The initial twelve owned preview processes were stopped cleanly;
final preview cleanup will be recorded separately.


### Session 47 - 2026-09-09: Momentum arc 3/3 - launch onto the Switch deck

Read the standing brief, Session47 status, current plan/scorecard and all63 design
references. Started clean on ironsight-aaa, scope apps/ironsight/** only. Completed
the selected Momentum arc: sprint-slide, waist-cover vault/mantle and the new
Switchyard induction routes are all playable ON by default. No feature flag,
new binding, npm dependency, publishing action or owner answer needed. Next ranked
gap is one complete signature map-event arc; encounter pacing remains explicitly open.

Reference: R-M03-05, R-M07, R-M10-13, R-M17-20, R-G02/12/14/19/20, R-L14.
Targets: intentional jump+forward launch, fixed1.2s route to the3m deck, standing
capsule clearance for every simulation segment, no steerable/claimed destination,
existing90-150ms recovery, cover within12m of sampled lane routes,10-15s ground
sprint rotations,>=12source px/m ground AO plus tiled colour detail. Implemented
movement/geometry/resource checks pass.20-30s natural damage contact is NOT MET.
Human movement/RTT, route fairness, animation and laptop performance remain open.

Two authored induction pads in MapDef: west(60,0,55)->(70,3,55) and
east(90,0,43)->(80,3,43). Jump while moving forward within1.5m and facing the
painted direction (dot>=.7) commits to a24tick/1200ms arc; radius, duration and
5m arc-height term are shared constants. Peak simulated feet6.6111m, landing3m;
900ms cooldown. A ground/stance check, full supported landing footprint, explicit
bounds/headroom and continuous expanded-box segment sweeps reject blocked routes,
including thin obstructions and conservative ramp volumes. Every segment also
covers the client's linear render interpolation. Launch eligibility uses actual
room position/map data; client launch/target/duration fields have no authority.
Release/turn finishes the committed route; aim remains free. Death/respawn clears
the controller/prediction. This is an authored trajectory, not free aerial steering.

The existing shared WaistTraversal controller carries launch alongside vault/mantle.
Room and fixed-step prediction use exactly the same path. Existing traversal combat
gating blocks fire/ADS/grenades in flight, followed by each weapon's90-150ms recovery.
No hit-registration, HP/damage, bot difficulty, respawn scoring or match-economy
changes. Production bots retain their ground navigation; this session does not
teach them to deliberately choose induction pads. Snapshot version8->9 starts old
snapshots fresh for changed collision; codec unchanged. Publish client and Worker
together for map/movement compatibility. Existing vertical rewind tracks flight feet.

Flush teal induction plates, repeated chevrons, JUMP > DECK wall signs and amber
landing outlines use the existing kit materials/sign atlas. No decorative collider
or hidden route. Camera FOV eases up to88 and the weapon uses the existing lowered
traversal pose; landing retains the bounded thud/dip. Reduced motion keeps78FOV and
removes cosmetic weapon offsets while preserving the same flight. One AOI-filtered
server traversal event plays an induction-coil rise and filtered air release using
the shared volume/mute/occlusion/voice budget; sources disconnect after780ms.
Hostile foley1.4 retained. No new lights, passes, per-frame bakes or animation clips.
Remote players use replicated feet/existing poses; human airborne pose/hands and
headphone acceptance remain open. No audio approval inferred from silent captures.

Switchyard cover:52->111 boxes (42->63full,10->48waist), with low home-court
returns, bus shoulders, outer deck approach screens and south service bays.
All twelve spawn exits, both authored northern exit-facing views, four true ramps,
B's paired4m doors and the40m bus rifle corridor stay tested and clear. Production
ground navigation reaches every cap and patrol point from every deployment.
Sampled bus/service routes and both long outer approaches have cover within12m;
these are proximity checks, not universal8-12m cover-to-cover travel proof.
A solid2x2m switching spine rises from the3m deck to14m. Its top is inaccessible
from the6.611m launch peak, not a fourth usable floor plane. Standing-eye rays
from the bus, both pad approaches and south service see its upper face. Human
wayfinding/all-viewpoint and defensive-quality approval remain open.

Original architecture rebaked5,858,908->7,184,816bytes (+1,325,908),93,752source
triangles,6,926parts merged into10material primitives, one1024-square AO image.
Ground AO156,996->830,466bytes (+673,470),2048x1365/13.65source px/m. As on
Relay/Undertow, source AO is multiplied into the existing512-square colour atlas;
this is not2048-square runtime AO residency. Switchyard now uses the shared original
128px/.8m concrete normal/roughness tile and diffuse aggregate (160px/m), across
its flat kit/ground/apron: two resident textures,+.166667MiB with mips. No new
asset URL; per-map loading and explicit allowlists retained. Geometry audit passes
oriented triangles/authored normals, finite UVs and zero degenerates. Evidence
session47-{maps,architecture,architecture-audit}.json and bake logs. Provenance and
factory-startup Blender reproduction are in public/assets/README.md. Meshy spend0;
reported balance1530. This delivery uses exact collider kit and flush markings.

Wow check: .inspect/session47-functional-launch-{before,flight,after,reduced}.png.
Opened all four plus final center/overview and the baseline center. Player sentence:
"I can launch over the deck wall and land with a whole new angle on the yard."
This uses the brief's before/after-stills alternative, not a video or human playtest.
The inspector walks through the actual Switchyard training room with W and ordinary
jump intents; no teleports, isolated live room, fabricated events or HP/bot edits.
One actual server launch event, quantized peak feet6.6m versus prediction6.6111m,
settled endpoint(70,3,55) and zero settled prediction gap in this local sample.
Render-active samples span1144.5ms, not a replacement for1200ms simulation duration.
Normal sampled FOV87.978; Reduced motion78 while launching again via real Settings UI.
Not proof of zero corrections at real RTT. Evidence session47-launch-summary.json
and functional-report.json. Reproduce: node scripts/inspect-map.mjs --url
http://localhost:8796 --shots launch,switchyard-overview,switchyard-center,switchyard-north
--prefix session47-functional (one line).

Switchyard effects stress, Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
11remotes plus local rifle,96blasts and complete drain. Before144/after145 twelve-
rifle volleys (2120/2130samples); existing wall-clock fixture cadence accounts for
the one-volley difference. Both budget assertions pass; session47-render-delta.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|189|191|+2|
|Peak submitted triangles|142254|161038|+18784|
|Resident textures|26|28|+2|
|Estimated texture MiB|61.5846|61.7513|+.1667|
|Median/p95/p99 frame ms|6.9/7.1/7.2|6.9/7.1/7.1|0/0/-.1 rounded|
|Max frame ms|14.1|7.3|-6.8|
|First-ready max ms|7.1|7.1|0 rounded|
|Resident programs after preparation|19|21|+2|

Construction54.4->66.4ms, preparation645->1034.4ms; cache/order differs, no
initialization or frame-time speedup claimed. No other owned bake/test/browser overlapped
the stress captures. An unrelated pre-existing Blender animation renderer was
observed on the shared host and left untouched; these are not isolated-host or
mid-laptop iGPU/thermal measurements. No60fps laptop/real6v6/RTT acceptance claimed.
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
switchyard-effects-stress --assert-budgets --prefix session47-final. Both new
program variants are prepared before play. Resource/shader thresholds unchanged.

Static session47-reference-audit.json: all maps150x100m/1250m2 per seat. Switchyard
A-B/B-C14.44s unchanged, A-C11.11->11.56s. Relay14.44/14.44/11.78 and Undertow
14.22/14.22/11.33 retained. All ground BFS sprint proxies10-15s; launch routing
does not imply a measured human retake time. ADS250/200/225/400/165ms, recovery
120/100/130/150/90ms,3s respawn,1.4foley, distinct hit pip, two incoming-damage
cues and five-row top-right killfeed retained. DOM4/8s capture,1point/2s/flag,
no side swap and78defaultFOV remain reference mismatches.

Natural production-bot Switchyard FFA seed0x30abc:300s,190kills,200lives,
top player21kills. Initial median LOS/damage1.0/2.7s; respawn1.4/6.05s
(184/188 respawn damage contacts observed).20-30s target is NOT MET. No pacing
improvement claimed from added cover; FFA arrival exposure and player distribution
need further work. LOS is an unobstructed100m eye segment without FOV, damage is
sampled every100ms; unobserved contact remains absent. Evidence session47-bot-
{round.json,heatmap.svg}, contact-summary.json and bot-metrics.log. Reproduce with
SWITCHYARD_METRICS=1, METRICS_PREFIX=session47 and pnpm exec vitest run
test/switchyard-metrics.tool.test.ts. Unmodified production bots/rules/time, no
scripted kills/paths or accelerated gameplay. One in-process round does not establish
human fairness, many-seed pacing, deployment latency or room capacity.

Final pnpm typecheck, pnpm test, pnpm build:client and pnpm build (existing Worker
dry-run only, no deployment) PASS.461tests passed/6existing or opt-in skips;
50files passed/4skipped. Evidence session47-typecheck.log, test-final.log,
build-client.log and build-worker.log. New tests cover both complete routes,
pad edges, facing/stance/distance/air gating, thin obstruction/ceiling/bounds/
unsupported landing, forged endpoint/deadline, room weapon recovery and prediction
death/respawn reset. Existing ramp/spawn/nav/sightline assertions retained.
The cover-class assertion distinguishes ground boxes from the separately tested
solid14m spine, as Undertow already does. No hitch-script or budget edits.

Required --shots relay,practice-two PASS: session47-required-inspector.log/report.json.
Before/functional/stress/required reports have zero console errors or forbidden
offline network requests; session47-report-checks.json. Runtime code/assets stayed
fixed through functional/stress, required inspection and live hitch validation;
only provenance/plan/evidence writes follow. Client rebuild for Worker dry-run
was from unchanged source.

Rejected intermediates: a text-based tile edit matched repeated empty rows at the
wrong indices; corrected against the original row array before any bake, retaining
the intended explicit ASCII layout. One test patch had an unmatched context and
made no edits. The first Blender architecture run found localized default node
names; --factory-startup produced the accepted bake. An initial focused nav test
and unrestricted full suite hit CPU timeouts (full: nav8.413s, audio8.201s).
Vitest now caps workers at4, retaining every assertion and the same5s timeout;
the full exact pnpm test command passes. PowerShell redirected reference JSON as
UTF-16; normalized evidence to UTF-8. No weak generated asset or relaxed gate adopted.

Open owner questions/defaults: keep intentional jump+forward activation (yes),
fixed1.2s/10m flight with no steering (yes), hands-busy launch plus normal recovery
(yes), and distinct wall/floor/landing markings (yes). Complete Momentum by default
(done); next pursue one server-timed signature map event, default Relay realignment,
while keeping encounter fairness ranked open. Keep industrial daylight, amber/teal,
stylized sci-fi, server-verified hits and6v6 team modes. Human mouse/RTT, animation,
headphone,6v6 fairness, iGPU/thermal and other-browser review remain open. No owner
answer required. No commit/push/deploy; supervisor owns publication.


Final pnpm audit:assets PASS: public30,580,196->32,597,540bytes
(+2,017,344); assets24,285,577->26,287,460 (+2,001,883,
including provenance text). Client1,949,197bytes, source map4,360,275;
largest file Switchyard architecture7,184,816.40MiB total/25MiB per-file
limits pass with no exception. Evidence session47-bytes.json and audit-assets-final.log.

The first required hitch run failed on one340.8ms frame at72.259s, with2deaths,
zero post-warmup recompiles, errors or long tasks. Its profile shows328/332samples
idle and no nearby game event; unrelated Blender rendering was active on the host,
but causation is NOT established. Failure retained as session47-hitch-first.json/log.
No runtime or gate changes made for the rerun. The exact unchanged command
node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
then PASS: session47-hitch-final.json/log and hitch.json. Two bot-caused deaths,
zero recompiles, >150ms frames, console errors or long tasks. Three frames>24ms:
startup91.2ms and two near enemy arrival28.5/27.7ms. Live6.309s, first damage28.850s
(22.541s after live), deaths30.310/82.842s and respawns33.281/86.078s. Normal
production-bot twelve-seat TDM, existing collision-routed W gate, no isolated room,
storage reset, bot/HP edit, forced death or teleport. Passing rerun is local stability
evidence; the first stall remains a real shared-host/cold/runtime concern, not erased.

Cleanup session47-cleanup.json: all twelve final owned preview processes stopped,
zero owned processes, port8796 listeners or inspection browsers remain. Initial
preview processes were also stopped before bakes; own Blender jobs exited normally.
Unrelated pre-existing desktop/render processes left untouched. All standing gates
green. Final diff/scope review stays within apps/ironsight/**; no commit/push/deploy.
Supervisor owns candidate review and publication. Momentum arc implementation complete.

### Session 48 - 2026-09-09: Signal Break arc 1/2 - the Relay turns and the radar drops

Read the standing brief, Session48 supervisor status, current plan/scorecard and
all63 design references. Clean starting branch ironsight-aaa; scope remains
apps/ironsight/**. Selected the top gap as a TWO-session Signal Break arc:
Session48 delivers the scheduled realignment/blackout and its audiovisual moment;
Session49 must finish the collision-backed core opening on the same schedule.
This session's complete warning/blackout/recovery sequence is ON by default in
Relay TDM and Relay training. The arc's route-changing payoff is explicitly unfinished.

Reference: R-M05, R-M12, R-M14, R-M17, R-L08, R-L14, R-L16, R-L22.
Checkable targets: first warning30s after live starts,8s advance warning,15s map
blackout,6s mechanical turn,3s restoration notice,90s cycle; one room-authored
epoch for every seat and respawn; no collision-changing decoration, new lights,
passes, textures or shader compilation during play. Timing/resource tests and
actual-room phase captures pass. R-M05/R-M14 route-opening target remains open
for Session49; no claim that the full signature arc or human feel is accepted.

The room writes signalAt only on creation/reset (zero during warmup/other maps).
It is an f64 in the shared codec,8additional payload bytes in a full snapshot,
constant through the round rather than a per-tick countdown update. Both clients
and room-side tests use the same signalFrame schedule and server clock. No new
developer input can request/extend the event; forged move fields are ignored.
Late join and respawn retain the existing epoch; round end suppresses the event,
new rounds seed a fresh deadline. Existing cold-restore policy still starts a
fresh round. Snapshot version9->10; schema fingerprint changes. Supervisor must
publish client and Worker together and existing tabs need refresh. No deploy here.

During blackout the actual minimap canvas is cleared and redraws a static
SIGNAL LOST / RELINK countdown: no stale floor/ally image left behind an overlay.
Location names and ordinary Q/B text callouts remain usable, and pings expire on
their existing server deadlines. It is an intentional HUD disruption, not a
security boundary: the room still sends the state needed to render players.
No enemy tracking or information gained by a graphics setting. Reduced motion
retains the mechanical dish pose and timing, omitting only expanding light rings.
The notice uses steady colours, no flicker or screen flash, and phase-only live
announcements. Joining/reconnecting or skipping a phase does not replay stale
audio. Three brief synthesized PA/coil cues share master volume, mute and limiter;
longest1.8s, nodes disconnect on completion, no audio file or persistent loop.
Human headphone balance/comfort is still unverified.

Replaced the original static north antenna with one original15m-diameter receiver
on a30m pivot at(75,30,-15). The larger dish turns through1.3rad with smooth
absolute-time seeking; it does not integrate drift across frames. Radial seams,
back ribs, receiver struts, actuator, service mast and a steady amber/teal rim
use two merged solid batches plus a pilot ring. Two pooled translucent annuli
radiate during the opening2.6s. All SOLID moving and stationary parts stay beyond
z=0 throughout both directions (sampled full-cycle geometry test). These outside
boundary parts cast no dynamic or stale baked moving shadow. The existing gantry,
generated uplinks, central collision-backed spine and playable geometry remain.
No new real-time light, shadow refresh, texture, render pass or per-frame bake.

Original Relay architecture was rebaked without the old static dish/mast, then
the existing2m vertex weathering was reapplied. The accepted GLB is3,367,124bytes
(previous3,388,284; -21,160).2,228source parts,26,720source triangles and11material
primitives; the unchanged concrete weathering subdivides1,164to30,420triangles.
Oriented-triangle/authored-normal audit passes, finite UVs, zero degenerate faces
and one1024-square AO image. No collision/groundAO rebake needed: removed pieces
are outside the playable boundary. Provenance/reproduction in assets/README.md;
session48-architecture.json, weather.json, architecture-audit.json and
bake-architecture.log. No new binary URL/allowlist; no purchased source adopted.
Meshy spend0, reported balance1530; procedural construction supplies this moving part.

Wow check: session48-verified-signal-{warning,pulse,turn,restored,narrow,phone}.png,
plus the offline signal-warning/blackout/recovery views in session48-functional.
Opened the phase/phone views and Relay center/overview; rejected overlapping
intermediates below. Player sentence: "The giant dish turns, my radar goes dark,
and I have to keep my team together by landmarks and callouts."
This uses the brief's before/after-stills alternative, not a video or human playtest.
The probe walks to the northern court with collision-routed W and watches the
REAL training room epoch, then sends B during the blackout. No teleports, isolated
live room, clock/state/HP/bot edits or fabricated events. Actual same-epoch samples:
warning age416.5ms / yaw-.65 / map online; blackout observed age10710.5ms / map
offline; later age17756.5ms / yaw+.65; recovery age24093.5ms / map online.
CDP sampling/capture latency means these observations are not precise boundary
timing measurements; unit tests cover the exact8,000/23,000ms boundaries.
Verified text NEED BACKUP survives disruption.720x900 notice bounds404..704,
y176..238;390x844 bounds16..366,y344..394. Session48-verified-report.json.
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots signal
--prefix session48-verified. The production schedule is unchanged for the probe.

Matched Relay effects stress: Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
11remotes+local rifle,145twelve-rifle volleys and96blasts in each run, complete
drain. Final offline stress explicitly samples the real shared event schedule
through warning, both light rings, the turn and recovery. Resource assertions
are unchanged and pass; session48-before-report.json vs session48-final-report.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|220|226|+6|
|Peak submitted triangles|144050|146170|+2120|
|Resident textures|30|30|0|
|Estimated texture MiB|63.7513|63.7513|0|
|Median/p95/p99 frame ms|6.9/7.1/7.2|6.9/7.1/7.1|0/0/-.1 rounded|
|Max frame ms|20.7|27.8|+7.1|
|First-ready max ms|7.1|13.9|+6.8|
|Resident programs after preparation|27|28|+1|

Construction60.2->81.2ms; preparation737.5->1856.8ms. No speedup claimed.
Second event-facing stress view:55peak calls,91,112triangles, same texture/program
residency;6.9/7.1/7.3ms median/p95/p99,34.7ms max. It has a different camera with
many actors out of view, not a matched performance improvement. Both own inspection
browsers ran alone, without own bakes/tests. Pre-existing/unrelated Blender processes
were observed on this shared host and left untouched. Desktop measurements do not
establish mid-laptop iGPU60fps, thermal/cold-driver, network or human6v6 acceptance.
Reproduce --shots effects-stress,signal-effects-stress --assert-budgets with the
same inspector. The extra material program is prepared before controls attach.

Static session48-reference-audit.json retains all numeric checks: Relay rotations
14.44/14.44/11.78s, Undertow14.22/14.22/11.33s, Switchyard14.44/14.44/11.56s
(A-B/B-C/A-C ground BFS sprint proxies);150x100m/1250m2per seat on all three maps.
Cover classes/navigation/collision unchanged. ADS250/200/225/400/165ms,
sprint recovery120/100/130/150/90ms,3s respawn,1.4hostile foley, distinct hit pip,
two damage cues and five-row top-right feed remain. DOM4/8s capture,1point/2s/flag,
no side swap and78FOV remain mismatches. No new contact/heatmap claim for an
unchanged collision layout; previous natural-round pacing failures stay ranked open.

Validation: pnpm typecheck, pnpm test, pnpm build:client PASS.466tests passed,
6existing/opt-in skips;52files passed/4skipped. New tests cover exact phase boundaries,
alternating/seeked pose, warmup/ended/other-map gating, late-seat/respawn deadline
retention, forged fields, new-round reseeding, complete exterior motion envelope,
constant resources/no lights and Reduced motion. Client geometry tests follow the
existing DOM tsconfig convention. Required exact --shots relay,practice-two PASS,
zero console errors: session48-required-inspector.log and required-report.json.
All runtime code/assets remained fixed through verified/stress/required/hitch gates.

Rejected intermediates: first composition left the old baked antenna overlapping
the new receiver; removed the original static assembly from source and rebaked it.
The original2m wall-weathering pass was explicitly reapplied after the AO bake.
Initial event notice overlapped the practice header; moved it beside the desktop
map, to the right on720px, and below the training coach on390px. Intermediate
captures retained under session48-draft/functional; verified is final gameplay HUD.
A room test used an invalid practice-room prefix (fell back to Relay); corrected
the fixture to arena-practice-arena2/3. A read command used a repo-relative path
from the app directory and failed without changes. The first full test run timed
out in the existing weapon-sound synthesis test (6.958s against5s); after stopping
the owned preview processes, exact pnpm test passed unchanged in12.65s.
session48-test-first.log retained. No assertion, timeout, shader allowance or
resource threshold relaxed; no new dependency.

Open owner questions/defaults: keep30s first warning /90s recurrence (yes),15s
minimap loss with text callouts intact (yes), six-second mechanical turn (yes),
and omit only light-wave motion under Reduced motion (yes). Session49 should
finish the core opening with shared collision states, safe occupied-door closure,
matching server movement/hits/grenades/bot navigation and client prediction/render.
Historical hit checks must select the correct barrier state at the rewound time;
do not animate a hole before authority opens it. Retain two safe approaches,
readable telegraph and the current performance/asset gates. Signature route value,
human fairness, headphones, mouse/RTT,6v6,iGPU and other-browser review remain open.
Industrial daylight, amber/teal and server-verified hits retained. No owner answer
required, no commit/push/deploy; supervisor owns review and publication.

The exact required live command node scripts/hitch-probe.mjs
http://localhost:8796 150000 .inspect/hitch.json --assert PASS on the first run:
session48-hitch.json/log and hitch.json. Two bot-caused deaths, zero post-warmup
recompiles, >150ms frames, console errors or long tasks.32frames exceeded24ms;
worst96.8ms at startup,47.8ms near the first death. Live began8.864s;
first damage47.362s, deaths48.843/113.270s, respawns51.557/116.563s.
One uninterrupted warmup->live transition; normal twelve-seat TDM, scores14:15
at stop, existing collision-routed W gate, no isolated room/storage reset/HP
edits/forced deaths. This round crossed the first warning, blackout and recovery
and the first death/respawn occurred during the blackout. It is local stability
evidence, not human pacing, fairness, latency or laptop qualification.

Final pnpm audit:assets PASS: public32,597,540->32,606,319bytes (+8,779);
assets26,287,460->26,268,232 (-19,228 including provenance text).
Client1,958,677bytes; source map4,378,802. Largest file remains Switchyard
architecture7,184,816bytes.40MiB public/25MiB per-file caps pass; no exception.
Evidence session48-bytes.json, render-delta.json, report-checks.json and
audit-assets.log. All six inspector reports have zero console errors/forbidden
offline network requests. All63 reference rows retained and re-ranked.

Cleanup session48-cleanup.json: all twelve final owned preview processes stopped;
zero owned processes, port8796 listeners or inspection browsers remain. Initial
preview's twelve processes were also stopped before the unchanged test rerun.
Owned Blender exited normally; unrelated host renderers were left alone. The first
process check caught one terminating child; the subsequent check confirms none.
Only documentation/provenance/evidence writes followed the completed runtime gates.
No commit/push/deploy. Session48 is green; Signal Break's core opening is next.


### Session 49 - 2026-09-09: Signal Break arc 2/2 - breach the core, hold the shutters

Read the standing brief, Session49 supervisor status, plan/scorecard and all63
design references. Branch ironsight-aaa; scope apps/ironsight/** only. Session48
was NOT supervisor-green or published: its candidate remained in the tree.
First repaired the failed test gate, then finished the required Signal Break arc.
Both sessions' features are enabled by default locally. No commit/push/deploy.

Reference: R-M02/03/04/05/12/14/17/20, R-G20, R-L11/14/16/22.
Targets: same30s first-warning/8s telegraph/15s blackout/90s cycle; an actual
two-ended standing shortcut under the central spine; matching server/client
collision and historical shots; no occupied closure; constant lights/passes and
existing240draw/64MiB texture,40MiB public and25MiB per-file gates. Implemented
checks pass. Human route value, pacing, iGPU60fps and full AAA acceptance remain
open. No alternate reference numbers or raised thresholds adopted.

Gate repair: weapon-sound.test.ts now counts nonfinite samples during the SAME
full PCM scan, then asserts zero, avoiding hundreds of thousands of assertion
objects. Switchyard navigation still tests EVERY capsule sample; it constructs
a failure only on obstruction. Every route and destination check remains.
Default5s timeout and maxWorkers4 unchanged. Repair attempt1 passed audio but
reproduced Switchyard's timeout; repair-final passed466tests before feature work.
Evidence session49-test-repair.log and test-repair-final.log. This fixes the
supervisor-reported problem instead of relying on an unchanged retry.

The core's old10x12x6m block becomes two permanent side walls and a3m-clear
lintel, with two0.5m shutters at x70..70.5 and79.5..80, z48..52. The6m roof and
14m spine remain solid. Opening removes ONLY the two shutters. Room-owned
coreOpen drives predictor, visible panels, current hits, grenade/blast collision,
ping rays, acoustic occlusion, spawn checks and the closed/open bot navigators.
No client message can request the opening or extend it. Both navigators are
constructed before play; overhead lintels no longer block ground clear-segment
checks. The static ground-BFS measurement tool now respects standing clearance
under overhead geometry too, while remaining a ground-route proxy.

After15s the room waits until the WHOLE chamber plus1.5m approach guard is clear
of living feet/active grenades before closing BOTH ends. No crush damage,
teleport or trapped player. A player can intentionally hold the route; there is
no forced closure timeout. Radar recovery remains exactly scheduled even if a
door is held. HUD says CLEAR TO SEAL / HELD and explains either exit; recovered
minimap marks actual open/closed state. A late seat receives the actual bit.
Round reset also resets the in-memory gate and replicated state, including an
open-core snapshot under the existing fresh-round cold-restore policy.

Discrete gate transition history retains a2s window/predecessor. Analytic rays,
hybrid-claim plausibility and tracer endpoints select the SAME historical
barriers as the target rewind, including shots straddling opening AND closing.
No interpolation through a partially open barrier. New room tests demonstrate
blocked-before-opening and allowed-before-closing historical shots in both paths.
Current ping/blast checks use current cover. New grenade regression exposed
endpoint-only tunnelling through thin shutters: stepGrenade now sweeps the
sphere's conservative expanded AABB to the earliest box contact, reflects and
stops for that tick; the normal bounce correction is sent. Corners are
conservative, and post-contact remainder is deferred to the next tick. Existing
grenade tests and new open/closed transit tests pass.

Snapshot version10->11; one appended bool adds1byte to a full state payload
beyond Session48's8byte epoch. Publish client and Worker together; old tabs
must refresh. The supervisor owns this publication. No deployment here.

Original shutter slats/chevrons, inset guide rails, teal passage strips and
two CORE / TRANSIT headers identify the route. Solid panels seek replicated
open/closed pose immediately; no cosmetic hole precedes authority. Retracted
panels are concealed in the lintel. Only wall-flush light runners animate;
Reduced motion stops those while keeping all gameplay information and poses.
The existing Signal Break PA cues remain master-volume controlled, and phase
cues cannot double-play when the replicated gate bit arrives. Human headphone
balance remains unverified. No new light/pass/dynamic shadow/bake or dependency.

Architecture rebaked without moving shutters, with overlapping elevated-kit
undersides corrected;2m vertex weathering reapplied. Accepted GLB3,385,780bytes
(+18,656 from Session48),2,244source parts/26,912source triangles/11primitives,
one1024-square AO image. Concrete1,188->30,620triangles; oriented-triangle,
authored-normal, finite-UV and degenerate audit PASS. GroundAO2048x1365 from
109permanent boxes/four ramps:773,641bytes (+4,538),13.65px/m on the long axis.
No stale shutter shadow. One256x64 immutable sign atlas adds.08333MiB with mips.
Existing allowlisted original asset paths retained. Meshy spend0; reported
balance1530. Procedural geometry is appropriate for these exact moving colliders.
Reproduction/provenance in public/assets/README.md; session49-architecture.json,
weather.json, architecture-audit.log and both bake logs.

Wow check (brief's before/after-stills alternative): session49-verified-core-
{warning,opened,crossing,held,phone,sealed}.png and verified-report.json. Opened
the actual interior/phone frames and initial offline closed/open composition.
Player sentence: "The radar dies, the core opens, and I can cut straight through
the fortress while the shutters wait for my team to clear."
The normal training-room probe uses W and ordinary aim, observes the real epoch,
crosses from x67 through x75 to x83, waits inside after recovery, then exits.
No clock/state/position edits, fake events, isolated live room or forced deaths.
Actual samples: warning/open/inside/held/closed, same epoch, all100HP, map
online/offline/offline/online/online, shutterY0/3/3/3/0.390px HUD fits x16..366
and y344..394. First functional views exposed roof z-fighting and concealed
shutter trim; fixed and rebaked before the verified capture. The probe precedes
the final TDM-only bot policy; final required inspection/hitch uses that policy.

Static session49-reference-audit.json: Relay111boxes (65full/46waist),
Undertow114 (52/62), Switchyard111 (63/48). All150x100m/1250m2per seat. Relay
A-B/B-C/A-C14.44/14.44/11.78s in BOTH states; Undertow14.22/14.22/11.33 and
Switchyard14.44/14.44/11.56 retained. Core approach sprint proxy3.11->1.78s
(x67..83,z50); these are ground BFS timings, not measured human retakes.
ADS250/200/225/400/165ms, sprint recovery120/100/130/150/90ms,3s respawn,
1.4hostile foley, distinct hit pip, two damage cues and five-row top-right feed
retained. DOM4/8s capture,1point/2s/flag,no side swap and78FOV still miss references.

Natural production-bot telemetry exposed zero core visitors in the first seed
0x28abc round (221.3s,49:50,99kills/109lives). Kept this intermediate evidence.
Final policy recruits at most ONE living nearby bot per team within45m on the
public warning, stages at an entry, then uses existing objective movement/aim/
reaction through the exit. Completion/death ends the push. No position, speed,
HP, accuracy, damage or visibility advantage; training dummies remain stationary.
Final SAME-seed natural round:192.7s,41:50,91kills/101lives, two core visitors
(bot-2/bot-12),30interior samples at100ms. Gate opens38/128s; closes53.5/166.2s,
showing0.5/23.2s occupancy holds. No forced paths or kills in the measuring tool;
bot tactics are the production change being measured. Initial median LOS/damage
5.4/13.7s, respawn4.0/12.3s (81/89 damage contacts observed).20-30s target NOT MET.
One-seed score change is not a fairness or pacing improvement claim. Evidence
session49-final-bot-{round.json,heatmap.svg,debug.json}, bot-metrics-final.log,
contact-summary.json. Reproduce RELAY_METRICS=1 METRICS_PREFIX=session49-final
pnpm exec vitest run test/relay-metrics.tool.test.ts. LOS uses the current gate
barriers and a100m eye segment without FOV; unsampled contacts remain absent.

Matched Relay effects stress: Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
11remotes+local,145twelve-rifle volleys/96blasts, complete drain. Shared schedule
crosses warning/opening/closing. Before-report.json vs final-report.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|226|232|+6|
|Peak submitted triangles|146170|147074|+904|
|Resident textures|30|31|+1|
|Estimated texture MiB|63.7513|63.8346|+.0833|
|Median/p95/p99 frame ms|6.9/7.1/7.2|6.9/7.1/7.1|0/0/-.1 rounded|
|Max frame ms|27.8|7.3|-20.5|
|First-ready max ms|13.7|7.1|-6.6|
|Prepared programs|28|28|0|

Construction98.3->78.3ms; preparation1548.3->1140.9ms. Different cache/order;
no initialization speedup claimed. Core-facing stress52peak calls/83,614triangles,
same resident textures/programs,6.9/7.1/7.2ms median/p95/p99,7.3ms max; different
camera so not a matched performance improvement. No owned tests/bakes/browser
overlapped these captures. Existing unrelated host processes were left alone.
Resource thresholds unchanged; no mid-laptop iGPU, thermal/cold-driver, human6v6
or network-capacity acceptance. Renderer remained unchanged after these reports;
the subsequent bot staging change is room-only and final hitch covers it.

Final pnpm typecheck, pnpm test, pnpm build:client, pnpm audit:assets PASS.
474tests passed/6existing or opt-in skips;53files passed/4skipped. Worker build
dry-run PASS (278.43KiB /79.86KiB gzip), not a deployment. Evidence session49-
typecheck.log,test-final.log,build-client.log,build-worker.log,audit-assets-final.log.
Core tests cover clearance, retained solids, both nav states, discrete historical
hits/claims, safe occupied closure, late seats, forged fields, reset bit, grenade
sweep and bot selection/exit; client tests cover prediction and fixed resources/
Reduced motion. Existing ramp/spawn/collision assertions retained; integer-grid
test explicitly separates the two tested0.5m shutter footprints.

Required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS, zero console errors (session49-required-*). All five
inspector reports have zero errors/forbidden offline network requests; report-
checks.json. Runtime code/assets stayed fixed through final type/test/build,
required inspection and live hitch. Only documentation/evidence writes followed.

Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json
--assert PASS first attempt: two bot-caused deaths, zero post-warmup recompiles,
>150ms frames, console errors or long tasks. One>24ms frame:96ms startup.
Live6.457s; first damage30.568s (24.111s after live); deaths31.778/85.323s,
respawns34.783/88.241s; scores14:19 at stop, twelve-seat normal TDM. Crossed the
first live event. Existing collision-routed W gate; no isolated room, storage
reset, forced death, teleport or HP/bot edits. session49-hitch.json/log and
hitch.json. Local stability evidence only; human/iGPU qualification remains open.

Final public32,606,319->32,659,708bytes (+53,389); assets26,268,232->26,294,040
(+25,808 including provenance). Client1,966,573bytes, source map4,398,487;
largest file Switchyard architecture7,184,816.40MiB/25MiB caps pass without
exception. session49-bytes.json and final asset audit. All63 scorecard rows
retained and re-ranked; Signal Break's implementation is complete by default.

Rejected intermediates: sample-heavy timeout failures above; thin-shutter
grenade endpoint tunnelling fixed by sweep; integer-only fixture amended for
explicit authored shutters; the test helper named restore collided with a
private SDK method and was renamed restoreForTest. Initial ceiling overlapping
faces and retracted surface trim corrected before accepted visuals. Initial
zero-visitor bot round drove limited production staging rather than a scripted
capture. No weak asset, relaxed assertion/timeout, changed hitch threshold,
additional dependency or invented acceptance adopted.

Open owner questions/defaults: keep15s scheduled opening with indefinite safe
occupancy hold (yes), immediate authoritative shutter pose (yes),1nearby bot per
team responding to the warning (yes), and timed shortcut with no pickup/score
bonus (yes). Next default arc is earned streak spectacle. Industrial daylight,
amber/teal, stylized sci-fi, server-verified hits and6v6 team modes retained.
Human RTT/feel, route fairness, bot mix, headphones, animation and iGPU/browser
review remain open. No owner answer required. Supervisor owns review/publication.

Cleanup session49-cleanup.json verifies all42 recorded process IDs across the
four owned preview trees are gone, with zero port8796 listeners or inspection
browsers. Own Blender bakes exited normally; unrelated host processes were left
untouched. Final scope/diff check passes within apps/ironsight/**. All standing
gates green; no commit, push or deploy. Signal Break arc implementation complete.


### Session 50 - 2026-09-09: Air Support arc 1/3 - earn a UAV and light up the map

Read the standing brief, Session50 supervisor status, plan/scorecard and all63
design references. Branch ironsight-aaa; scope apps/ironsight/** only. Status
confirms Session49 is green and deployed as f4c5e55; corrected the outdated
publication note in the playtest guide. No commit, push or deployment here.

Reference: R-L01/14/16/17/22, R-G20. Targets: an actual earned first tier at
three consecutive eliminations;12s UAV with scans at2/6/10s,2.2s last-seen
contacts,30s shared team launch cooldown, no extension/stacking, death resets,
private team delivery, blackout suppression, and a visible/audible payoff
without new textures/lights/passes. Implemented targets pass. R-L01 remains
PARTIAL: Session51 should add the five-kill called mortar; Session52 the
seven-kill support drone and mild catch-up. The whole3/5/7 arc is not complete.
UAV is ON by default in TDM/DOM, with private Relay training rehearsal. FFA
retains its existing streak notices and gets no UAV. No new owner answer needed.

AirSupport is a bounded room-local scheduler. Only confirmed non-self kills
reach the existing streak counter; exactly three queues the first reward.
No activation/reward client handler exists, and forged support/recon/streak
messages or extra move fields cannot earn it. A team has at most one flight;
the next earned life waits for30s airspace cooldown. Death discards its queue,
and the active operator's death ends that team's flight immediately. Elimination
of the operator is counterplay, not yet the reference's explicit catch-up bonus.
Bots earn by the same rule. They do not consume radar in their targeting logic;
no bot HP, speed, accuracy, damage, reaction, routing or visibility advantage.

Each scan freezes only living, unprotected opponents' x/z at a1m grid. No
enemy IDs, health or live tracking ride this channel. Recipients share a team
in TDM/DOM; practice uses a namespaced personal channel despite shared team
numbers. Opponents see public owner/team/flight times without contacts.
syncView returns current progress, flights and the ORIGINAL unexpired scan,
not a fresh sample. Death, expiry, seat loss and round/cold-reset clear the
appropriate state. Queue keys/cooldowns stay bounded by teams/current seats.
No binary schema/snapshot change; the existing fresh-round cold-restore policy
already discards runtime combat state. New clients require this Worker to get
the support event; old clients ignore it. Supervisor owns joint publication.

Relay blackout consumes scheduled scans without sampling, clears the current
snapshot and defers a queued launch. The active flight still expires on time;
relink neither replays missed scans nor extends its lifetime. The canvas itself
is cleared by the existing Signal Break path. Radar rings are cosmetic and
omitted by Reduced motion; the same fixed contact boxes and ages remain.
A small clock lead is clamped to zero visual scan age, preventing a negative
canvas radius. No collision, hitscan, grenade, navigation or map geometry changed.

Presentation:0/3 progress pips, earned/queued/in-flight/spent states, a distinct
UAV emblem and earned/friendly/enemy announcement. The twelve-second countdown
uses server time. Existing five/eight streak notices remain until the later
tiers, with the new announcement taking priority while visible. The panel hides
in menus, death, warmup, results, disconnect, FFA and empty exploration practice.
Training copy identifies private rehearsal. Radio-ident chords distinguish
earned/friendly/hostile support; short radar chirps mark actual scans. All nodes
drain through the existing master volume/mute/limiter; no speech-engine service
or recorded voice line. Headphone balance and human announcement quality are open.

Original delta-wing UAV: hull, twin engine pods/fins and short exhaust strips,
110triangles in one shared vertex-colour geometry/material, fixed two-mesh pool.
It crosses above the playable16m ceiling at team-stable32/36m altitude. No
collision or shootable target is implied; the notice explicitly says to eliminate
its operator. A final review fixed altitude depending on pool index: ending the
other team's flight can no longer move this aircraft4m vertically. Regression
checks compare the same flight with and without its neighbour. No new texture,
light, shadow, pass, asset download, dependency, per-frame bake or Meshy spend.
Reported Meshy balance1530 retained. Provenance/reproduction: public/assets/README.md.

Wow check: before/after stills plus20s of actual post-launch sampling in
session50-final-recon-{before,one-away,earned,earned-phone,2300,4500,6300,10300,
12500,20000,layout-1920,layout-1280,layout-720,layout-390}.png and final-report.json.
Opened the actual earned/scan/flyover/phone/reduced captures. Player sentence:
"Three kills, a UAV flies over, and enemy positions light up for my team."
The probe aims and fires through normal inputs at the existing bot-idle training
target across three real respawns; no HP/position/clock/reward edits, teleport,
fake event, room isolation or forced death. Three server kills earn one flight;
observed scans show4/5/5contacts, a gap with zero contacts between scans, then
zero flights/contacts after expiry. The6.3/10.3s samples retain contacts after
Reduced motion is toggled through real Settings; pause hides both support HUDs.
Four viewport layouts and the active390px reward fit without overlap with the
tested existing panels. Portrait still has the game's pre-existing dense HUD;
this is not a touch/controller or human mobile-play acceptance claim.
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots support.
The last team-altitude fix leaves these own-team0 poses and paired stress poses
unchanged; its independent resource/pose test and final live gates cover it.

Natural production-bot evidence: session50-final-bot-{round.json,heatmap.svg,
debug.json}, bot-metrics.log and contact-summary.json. Same seed0x28abc as
Session49:192.7s,41:50,91kills/101lives; six earned flights and twelve sampled
scans, one peak concurrent flight. This independently demonstrates normal bot
streak triggers, not staged rewards. Bots' combat decisions are unchanged, so
the identical scores/contact distribution are expected. Initial LOS/damage
medians5.4/13.7s; respawn4.0/12.3s (81/89 damage lives observed).20-30s remains
NOT MET. Two natural core visitors retained. No fairness/pacing improvement
or multi-seed side-win-rate claim. Reproduce RELAY_METRICS=1,
METRICS_PREFIX=session50-final pnpm exec vitest run test/relay-metrics.tool.test.ts.

Static session50-reference-audit.json retains Relay111boxes (65full/46waist),
Undertow114 (52/62), Switchyard111 (63/48);150x100m/1250m2per seat. Ground-BFS
rotation proxies A-B/B-C/A-C: Relay14.44/14.44/11.78s in both shutter states,
Undertow14.22/14.22/11.33, Switchyard14.44/14.44/11.56. ADS250/200/225/400/165ms,
sprint recovery120/100/130/150/90ms,3s respawn,1.4hostile foley, distinct hit/kill
pip, two damage cues and five-row top-right feed remain. DOM4/8s capture,
1point/2s/flag, no side swap and78FOV still miss references. All63 scorecard
rows retained; gap list now prioritizes completing this support arc.

Matched Relay effects stress: Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
eleven remotes plus local,145twelve-rifle volleys/96blasts and complete drain.
Same camera/event stress, with the new two-flight fixture added. Before-report
versus final-report, supported by session50-render-delta.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|232|233|+1|
|Peak submitted triangles|147074|147184|+110|
|Resident textures|31|31|0|
|Estimated texture MiB|63.8346|63.8346|0|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Max frame ms|7.3|7.2|-.1|
|First-ready max ms|7.1|7.0|-.1|
|Prepared programs|28|29|+1|
|Geometries|153|154|+1|

Construction82.1->84.3ms; preparation1120.8->394.4ms. Cache/order differs;
no initialization speedup claimed. Additional recon-facing effects view:
234peak calls,147184triangles, same textures/programs,6.9/7.1/7.1ms
median/p95/p99,7.4ms max. Different camera, not a matched improvement.
No owned tests/bakes/other inspection browser overlapped these captures.
All unchanged240draw/64MiB texture/32texture thresholds pass. No mid-laptop
iGPU60fps, cold-driver/thermal, network capacity or human6v6 acceptance implied.

Final pnpm typecheck, pnpm test, pnpm build:client and pnpm audit:assets PASS.
481tests passed/6existing or opt-in skips,55files passed/4skipped. Seven new
tests cover earning, privacy, frozen/expired scans, queue/death/round reset,
blackout/skipped intervals, normal fire authority, forged fields, syncView,
malformed payloads, fixed resources and stable independent aircraft poses.
Worker dry-run PASS282.67KiB/80.99KiB gzip; no deployment. Evidence session50-
typecheck-final.log, test-final.log, build-final.log, worker-dry-run.log and
audit-assets.log. No assertion, timeout, worker count or budget was relaxed.

Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS, zero errors; required-report.json and inspector.log.
All five session inspector reports have zero console errors/forbidden offline
network requests (session50-report-checks.json). Final source remained fixed
through the post-review type/test/build/audit, required inspection and hitch.

Rejected intermediates: initial generic diamond replaced by a UAV emblem;
desktop announcement moved below DOM gauges; portrait progress moved alongside
the training coach after the first image showed overlap with elimination text;
menus/empty practice no longer show irrelevant support panels. Clock-lead and
pool-index altitude edge cases fixed before final gates. Initial functional and
verified captures retained separately. Natural-round scan telemetry now records
the actual sampledAt, not the last100ms observation of the same snapshot. The
first cleanup report exposed PowerShell array metadata nesting; its35 recorded
PIDs were recovered and checked before the final preview cycle. No gate failure
was hidden or weakened; the final cleanup below is the verified result.

Open owner questions/defaults: automatic three-kill launch (yes), one per life
and30s team airspace (yes), cancellation when its operator dies (yes), exact
2/6/10s last-seen pulses (yes), keep recon out of FFA for this team-support arc
(yes), and continue with five-kill called mortar then seven-kill drone by
Session52 (yes). Add the explicit mild catch-up in the final tier session.
Retain industrial daylight, amber/teal, server-verified hits and6v6 team modes.
Human mouse/RTT, operator fairness, audio, animation, iGPU and other-browser
review remain open. Supervisor owns review and publication; no owner answer
is needed to continue the accepted arc.


Final exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS: two bot-caused deaths, zero post-warmup
shader recompiles, >150ms frames, console errors or long tasks. One>24ms frame,
87.4ms at startup. Live starts8.005s; first damage37.726s (29.721s after live),
deaths39.166/90.024s and respawns41.872/93.092s. Normal twelve-seat TDM,
scores16:15 at stop, existing collision-routed W input, one warmup->live
transition. No storage reset, isolated live room, HP edit, forced death or
bot modification. session50-hitch.json/log and hitch.json. The earlier PASS
before the team-altitude review is retained as session50-hitch-first.json/log
(two deaths, zero errors/recompiles/spikes,94.3ms max); the final run above
supersedes it. Local stability evidence, not human/network/iGPU qualification.

Final public 32,659,708->32,703,444bytes
(+43,736); assets 26,294,040->26,294,847
(+807, provenance text only). Client 1,980,306bytes
(+13,733); source map 4,427,683bytes.
Largest file remains Switchyard architecture7,184,816bytes. Public40MiB and
per-file25MiB caps pass without exception. session50-bytes.json, render-delta.json
and audit-assets.log provide the measured resource deltas.

Cleanup session50-cleanup.json verifies all47 recorded process IDs across
the four owned preview trees are gone, with zero port8796 listeners and zero
inspection/hitch browsers. No own Blender process was started. Final scope/diff
check stays within apps/ironsight/**. All required gates green, all63 reference
rows retained, no commit/push/deploy. Air Support1/3 is playable by default in
the enabled modes; the next session should deliver its called-mortar tier.

### Session 51 - 2026-09-10: Air Support arc 2/3 - call a three-round mortar barrage

Read the standing brief, Session51 supervisor status, plan/scorecard and all63
local design references before implementation. Branch ironsight-aaa; all work
scoped to apps/ironsight/**. Session50 UAV is confirmed published by supervisor
status (8f61762, preview10df4e62-db09-4eb8-b7ff-05047aef76a5). Updated the owner
guide accordingly. No commit, push or deployment performed here.

Reference: R-L01/14/16/17, R-G20, R-M20. Target: five confirmed non-support kills
in one life earn one mortar designation;3s warning,3rounds650ms apart,6m radius,
125maximum damage with linear falloff,45s shared team cooldown. One barrage per
team, death/seat/round reset, no support recursion, server origin/ground/cover
validation, no new lights/textures/passes, and a checkable first-play payoff.
Air Support2/3 is ON by default for TDM/DOM and private Relay Training rehearsal.
FFA stays disabled. R-L01 remains PARTIAL until Session52's seven-kill drone and
explicit mild catch-up. No new owner decision is needed to complete the arc.

The new room-local MortarSupport scheduler owns charges, deadlines, battery and
three impact decisions. Only the existing confirmed gun/grenade streak calls
earn at exactly5. The rebindable V / Call mortar action sends yaw/pitch only;
server position, stance eye,8-60m ray, world bounds, current hit boxes and upward
sky-clearance determine the point. Aimed walls, roofs, ramps, sky, near/far or
out-of-bounds points reject without spending the charge. Forged coordinates,
owner, damage, count and time fields cannot become authority. Reconnect syncView
returns the original public strike/deadlines, never a new timer. No binary schema
or snapshot change; existing cold restore starts a fresh round and clears combat.

A team has one active barrage and45s battery recovery; an earned charge waits in
its current life for a manual call. Death discards it and cancels remaining shells,
while the shared cooldown survives. Seat expiry broadcasts cancellation immediately;
removed bot IDs cannot inherit charges on reuse. A delayed worker drops missed
rounds instead of stacking several damage applications in one tick. At impact,
current sky clearance and blast-to-torso cover are rechecked. Spawn protection
and teammates are immune; self-damage remains. Practice strikes are private and
cannot damage other humans. Mortar eliminations count for kills/match score and
assists but never increment the support streak. Their killfeed says MORTAR.

Bots earn by identical kill counts and battery rules. An existing visible firing
decision may designate ground below the same aim via the same ray checks; no radar,
hidden target lookup, damage/HP/speed/reaction boost or scripted movement. Natural
bot evidence below measures this production policy. The lack of deliberate blast
evasion/role personalities remains an open bot-quality gap.

Presentation: earned mortar emblem,3-to5 progress, rebind-aware prompt and invalid
point guidance, call confirmation, persistent6m hazard ring and nearby danger text,
three descending shells/short spatial whistles, confirmed impact rumble, expanding
shock rings and shaded debris. Reduced motion retains the exact hazard boundary
while reducing debris/ring motion. All material variants are created before arena
warm-up. Four rings/two shells/48fragments share three fixed instanced draws; no
new texture, light, shadow, pass, asset download, dependency or per-frame bake.
Provenance/reproduction in public/assets/README.md; Meshy spend0, reported1530
balance retained. These procedural combat effects did not call for a hero GLB.

Wow check: session51-game-final-report.json and mortar-{before,one-away,earned,
earned-phone,marked,1500,2450,3150,3800,4450,5600,6500,10000,20000,layout-1920,
layout-1280,layout-720,layout-390,reduced-after}.png. Opened the real warning,
first impact and earned-phone captures. Five normal gun kills of the existing
training target earn one charge; normal V rejects sky without consuming it, then
accepts the aimed ground. Three impacts kill three normal targets: actual kills8,
reward streak5, zero charge/strikes/effect draws after expiry. Twenty seconds of
post-call sampling; no HP/position/clock/reward edits, forced kills, teleport or
isolated room. Four layouts fit without the tested HUD overlaps; pause hides panels.
Player sentence: "Five kills, I mark the ground, and three shells hammer the lane."
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots mortar.
This is a private training demonstration, not human6v6 or iGPU qualification.

Natural production-bot evidence: session51-final-bot-{round.json,heatmap.svg,
debug.json}, bot-metrics.log and bot-summary.json. Same seed0x28abc as Sessions49/50:
212.6s,46:50,96kills/107lives. Two earned mortars and three mortar kills, plus five
UAV flights/ten scans. Initial median LOS/damage5.4/13.7s; respawn4.0/11.8s with91/95
damage contacts observed.20-30s target NOT MET. One-seed score/length changes are
not a fairness/pacing improvement claim. Reproduce RELAY_METRICS=1,
METRICS_PREFIX=session51-final pnpm exec vitest run test/relay-metrics.tool.test.ts.

Static session51-reference-audit.json retains Relay111boxes(65full/46waist),
Undertow114(52/62), Switchyard111(63/48),150x100m/1250m2per seat. Ground-BFS
rotation proxies A-B/B-C/A-C: Relay14.44/14.44/11.78s both shutter states,
Undertow14.22/14.22/11.33, Switchyard14.44/14.44/11.56. ADS250/200/225/400/165ms,
sprint recovery120/100/130/150/90ms,3s respawn,1.4hostile foley, distinct hit/kill
pip, two damage cues and five-row top-right feed retained. DOM4/8s capture,
1point/2s/flag,no side swap and78FOV still miss references. All63 scorecard rows
retained and re-ranked; only the support and telemetry evidence changed.

Rejected intermediates: initial render fixture hid the blast behind crates;
retained the images and changed the dedicated inspection camera/point. Large flat
unlit shards read like a starburst; reduced their size and added baked vertex
shading and warm/charcoal separation. UAV emblem was replaced for mortar messages.
The first gameplay capture was invalidated by an overlapping server hot reload;
its screenshot did show a confirmed mortar kill, but the later room reset made
its final assertion fail. Retained session51-game-first-* and reran uninterrupted.
Initial config-label union and a server-tsconfig import of the DOM settings test
failed typecheck; extended the correct label union and moved the binding test to
the existing DOM-checked settings.test.ts. No assertion, timeout or gate weakened.
A PowerShell/Python non-ASCII literal produced a question mark in the range and
unbound comparison; corrected to ASCII8-60 and a direct empty-binding check.

Open owner questions/defaults: manualV designation (yes), open ground only (yes),
3s warning/three rounds/6m radius/45s battery (yes), operator-death cancellation and
no recursive reward kills (yes), private practice/noFFA (yes). Complete the seven-
kill drone and mild catch-up next session. Keep industrial daylight, amber/teal,
server-verified damage and6v6 team modes. Human mouse/RTT, danger readability,
headphones, animation, iGPU/thermal and other-browser acceptance remain open.
Supervisor owns review and publication; no owner response is required to proceed.

Additional final gameplay check: session51-reduced-* and reduced-report.json.
Earned five kills again, enabled Reduced motion and rebound Call mortar to H
through real Settings. Old V did not activate; HUD displayed H; invalid sky aim
retained the charge; H called the real barrage. The exact warning circle and
three damaging rounds remained; all effects drained, four layouts and pause
checks passed. Opened the reduced marked-ground capture. This also exercises
the final ASCII range/unbound guidance change. No state injection or test bypass.

Matched Relay effects stress: Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
eleven remotes plus local,145twelve-rifle volleys/96blasts and full drain.
The final fixture adds two concurrent mortars to the same existing UAV/core load.
Before-report.json vs render-final-report.json; session51-render-delta.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|233|235|+2|
|Peak submitted triangles|147184|147822|+638|
|Resident textures|31|31|0|
|Estimated texture MiB|63.8346|63.8346|0|
|Median/p95/p99 frame ms|6.9/7.1/7.2|6.9/7.1/7.1|0/0/-.1 rounded|
|Max frame ms|7.7|7.5|-.2|
|First-ready max ms|7.0|7.1|+.1|
|Prepared programs|29|30|+1|
|Geometries|154|157|+3|

Construction76.5->77.1ms,preparation1051.5->1047ms; cache/order differs,
no preparation speedup claimed. Dedicated mortar-facing stress:235peak calls,
147822triangles,same textures/programs,6.9/7.1/7.1ms median/p95/p99,7.7ms max.
Both preserve the unchanged240draw/64MiB/32texture thresholds. No owned tests,
bakes or other inspection browsers overlapped performance sampling. No laptop
iGPU60fps, cold-driver, thermal, human6v6 or network-capacity acceptance implied.

Final pnpm typecheck, pnpm test, pnpm build:client and pnpm audit:assets PASS:
489passed/6existing or opt-in skips,57files passed/4skipped. Eight new tests cover
ray/sky/bounds validation, earning and caps, delayed ticks, privacy, death/seat/
round cancellation, real fire/reward authority, self damage, protection/allies,
new overhead cover, nonrecursive scoring, bounded resources and key conflicts.
The binding test runs under the existing client tsconfig; no new exclusion or
assertion/timeout/worker-count relaxation. Evidence session51-typecheck-final.log,
test-final.log,build-final.log,audit-assets.log. Worker dry-run PASS289.45KiB/
82.57KiB gzip in session51-worker-dry-run.log; explicitly not a deployment.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS, zero console errors. Required-report.json and required-
inspect.log; six completed inspector reports checked for zero errors/forbidden
offline network requests in session51-report-checks.json. Runtime code/assets
remained fixed through final type/test/build/audit, render, required inspection
and the live hitch probe. Only inspection-tool and documentation/evidence writes
followed the final runtime edits.

Final public32,703,444->32,759,456bytes(+56,012),assets26,294,847->26,295,983
(+1,136, provenance text only),client1,980,306->2,001,187(+20,881),source map
4,461,678bytes. Largest remains Switchyard architecture7,184,816bytes. Public
40MiB/per-file25MiB caps pass without exception; session51-bytes.json and asset
audit. No new public binary, downloaded asset, dependency or Meshy charge.

Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json
--assert PASS: two bot-caused deaths,zero post-warmup shader recompiles,frames
>150ms,console errors or long tasks. Two>24ms frames:93.1ms at startup and24.7ms
at105.282s. Live starts7.274s; first damage35.697s(28.423s after live); deaths
37.156/95.439s,respawns40.044/98.647s. Normal twelve-seat TDM,scores17:19 at stop,
one warmup-to-live transition and existing collision-routed W input. No storage
reset, room isolation, HP edit, forced death or probe-specific bot modification.
Evidence session51-hitch.json/log and hitch.json. Local stability evidence only.

Cleanup session51-cleanup.json confirms all8recorded processes in the owned
preview tree stopped,zero port8796 listeners,zero remaining inspection/hitch
browsers. All inspection scripts closed their own browser profiles; no Blender
was started. Unrelated host processes were left untouched. Final scope/diff
check is clean within apps/ironsight/**,branch ironsight-aaa,all63reference rows
retained. All required gates green; no commit,push or deploy. Air Support2/3 is
playable by default in its enabled modes; Session52 owns the final drone/catch-up tier.

### Session 52 - 2026-09-10: Air Support arc 3/3 - earn a sentry and shut down the lead

Read the standing brief, supervisor Session52 status, plan/scorecard and all63
local design references before implementation. Branch ironsight-aaa; scope
apps/ironsight/**. Session51 is confirmed published (1308f51, preview
 d693dfc0-9273-452d-adbf-a9c91afcf6f8). Updated the owner guide accordingly.
No commit, push or deploy. This session completes Air Support3/3 by default.

Reference: R-L01/14/16/17, R-G20, R-M20. Target: exactly seven confirmed gun/
grenade eliminations in one life earn one stationary sentry;12s life,60s team
airspace,22m acquisition,34damage/1.8s,900ms frozen-point warning and.85m dodge
radius. Operator must stay within30m and have current line of sight too. Death,
seat and round cancel, shared cooldown survives death, private bot-only Training
and noFFA. Mild catch-up is explicit: a gun/grenade shutdown of an enemy drone
operator gives the trailing team +1TDM point at deficit5 or +5DOM at deficit20,
consumed once per flight. No HP, damage, speed or hidden aim buffs. All three
support tiers score eliminations without recursively earning any support.
R-L01's implemented rule is now MET; human fairness is still open.

The server owns launch position, clear-sky and chassis clearance, flight schedule,
target selection, warning point and damage. No drone activation or target payload
exists. Launch prefers4m forward/3m to the side at3.2m height, then tests the other
three shoulders with the same clearance checks; the central aiming corridor
stays clear in the reviewed training captures. Missed/stalled attack ticks drop old shots; no catch-up
volley. At fire time the target must remain within.85m of its locked torso
point, alive/unprotected, in range and visible to both sentry and operator.
Newly closed shutters/cover, strafing and the owner retreating out of sight all
stop damage. The drone itself is decorative/invulnerable, not solid cover;
HUD instructions explicitly name operator elimination and dodge/cover counterplay.

Public flight metadata locates only the visible sentry. A frozen lock is sent
only to its target or a nearby living viewer with LOS to the point; target IDs
are never sent in the public view. syncView preserves the original deadlines.
Practice filters to the existing training bot roster and keeps views private.
Normal bots earn and launch by the same kills/rules; no aim/reaction/HP/nav boost.
No binary schema or snapshot version change; cold restore starts a fresh round.

Original procedural ducted-fan chassis with baked vertex shading, twin barrels,
rotating blades, three fixed instanced draws shared by both teams, frozen laser
and crosshair warning, positional rising charge/pulse, seven-pip HUD and SENTRY
killfeed. Reduced motion freezes blade spin and bob but keeps the same warning
point. Existing pooled tracers/muzzle flashes are driven only by server shots.
No new texture, light, shadow pass, dependency or downloaded binary. Meshy spend0;
reported1530credit balance retained. A compact original animated drone was built
in the existing procedural renderer; no hero GLB was needed. Reproduction and
provenance appended to public/assets/README.md.

Rejected intermediates: initial unit fixture reset the shooter's lifetime kills
between every test kill; corrected fixture bookkeeping, keeping real fire and
reward assertions. Initial script edit hit Windows default cp949 decoding;
explicit UTF-8 fixed it before the new probe ran. First real seven-kill gameplay
run passed but revealed an oversized drone immediately overhead in the camera.
Retained session52-game-first-* evidence; moved launch forward/to the side,
scaled the chassis to75%, and added independent spinning rotors. Kept the exact
lock point unchanged under Reduced motion. No assertion, timeout or budget was
relaxed.

Open owner questions/defaults: automatic seven-kill stationary sentry (yes),
12s life/60s shared airspace (yes),900ms dodgeable lock (yes), owner-death/tether/
LOS counterplay instead of a separately shootable drone hitbox (yes), explicit
small trailing-team shutdown score (yes), private Training/noFFA (yes). Next
arc: distinct weapon muzzle shapes, sniper glint and reduced-motion-aware blast
trauma. Keep industrial daylight, amber/teal,6v6 and server-verified damage.
Human mouse/RTT, danger readability, headphones, animation, iGPU/thermal and
other-browser review remain open; no owner answer is required to proceed.

Wow check: session52-game-final-report.json plus drone-{before,one-away,earned,
1200,2400,3300,4200,5100,6900,8700,10500,12500,20000,active-phone,layout-1920,
layout-1280,layout-720,layout-390}.png. Seven ordinary shots/kill sequences against
the existing bot-idle roster earn the real drone; one additional sentry kill
finishes at8kills but7reward count. No HP/position/clock/reward edits, forced
kills, teleport or isolated room. Twenty seconds of post-launch captures show
actual locks and shots, then zero active flights/queued rewards/effect draws.
Four layouts fit without the checked HUD overlaps; pause hides the panels.
Player sentence: "Seven kills, and my sentry covers the next target while I reload."
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots drone.
The separate drone-hero still is explicitly an offline two-drone render fixture.
Opened the corrected actual earned capture and the two-drone hero still.

session52-reduced-report.json and reduced-drone-* repeat the seven real gun kills
with Reduced motion enabled through actual Settings before earning. The sentry
still locks, damages and kills; exact warning endpoint, four layouts, clean drain
and pause checks pass. Opened the reduced5100ms laser view. These captures precede
the later server-only shoulder fallback: their first-choice launch is unchanged;
the final alternative-position unit test, natural bot launch and required gates
cover that adjustment. No hardware/human gameplay acceptance is claimed.

Natural bot telemetry caught another rejected intermediate: the original seeded
round reached7kills but its sole launch point remained obstructed until death.
Added four ordered shoulder candidates, all with the same chassis/sky/ray checks.
New test proves an obstructed preferred side falls back to the other clear side;
a roof over all candidates still holds the reward. Replaying the same seed now
produces one natural bot-8 sentry launch. session52-launch-before-summary.json
retains the no-launch intermediate. No bot path, reaction or combat stat changed.

Natural production-bot evidence: session52-{final,seed1,seed2}-bot-{round.json,
heatmap.svg,debug.json}, their metrics logs and session52-bot-summary.json.
Seeds0x28abc/1/2:212.6/205.3/202.5s,47:50/41:50/42:50,96/92/93kill events,
107/103/103lives. Max streak7/6/5; sentry flights1/0/0, sentry kills0/0/0.
UAV flights5/6/7, sampled scans10/8/9, mortars2/1/1 and mortar kills3/1/1.
The final first seed has one point more than its96kill events; the explicit
shutdown scoring rules are directly verified in the room test. Other seeds
were sampled before the shoulder fallback, but never reach7 so that branch
is inactive. Reward rarity is visible here, not replaced with injected kills.
No natural sentry kill is claimed; the real training sequence provides that
check. Three blue wins are a small sample, not a side-balance conclusion.

Initial median LOS/damage:5.4/13.7,5.4/13.8,5.4/14.35s. Respawn:4.0/11.8,
3.3/11.6,4.0/11.3s, observed damage91/95,86/91,87/91respawn lives.20-30s
remains NOT MET. Natural core visitors1/2/1. Reproduce RELAY_METRICS=1,
METRICS_PREFIX=session52-final pnpm exec vitest run test/relay-metrics.tool.test.ts;
set METRICS_SEED=1 or2 for the additional rounds. Production rules, no hidden
rewards, forced routes or player-state edits. Not human6v6 or deployed capacity.

Static session52-reference-audit.json retains Relay111boxes(65full/46waist),
Undertow114(52/62), Switchyard111(63/48),150x100m/1250m2per seat. Ground-BFS
A-B/B-C/A-C sprint proxies: Relay14.44/14.44/11.78s both shutter states,
Undertow14.22/14.22/11.33, Switchyard14.44/14.44/11.56. ADS250/200/225/400/165ms,
sprint recovery120/100/130/150/90ms,3s respawn,1.4hostile foley, hit/kill pip,
two damage cues and five-row top-right feed retained. Streak announcement
thresholds now3/5/7. DOM4/8s capture,1point/2s/flag,no side swap and78FOV still
miss references. All63scorecard rows retained and gap list re-ranked.

Matched Relay effects stress: Edge152/RTX5070 D3D11,1920x1080 balanced/DPR1,
eleven remotes plus local,145twelve-rifle volleys/96blasts and full drain.
Final fixture adds two concurrent sentries to the existing UAV/mortar/core load.
session52-before-report.json vs render-final-report.json, render-delta.json:

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|235|238|+3|
|Peak submitted triangles|147822|150102|+2280|
|Resident textures|31|31|0|
|Estimated texture MiB|63.8346|63.8346|0|
|Median/p95/p99 frame ms|6.9/7.1/7.2|6.9/7.1/7.1|0/0/-.1 rounded|
|Max frame ms|8.0|7.3|-.7|
|First-ready max ms|7.1|7.1|0 rounded|
|Prepared programs|30|32|+2|
|Geometries|157|160|+3|

Construction77->80ms,preparation1074.3->1113.6ms; cache/order differs, no
initialization speedup claimed. Dedicated drone-facing stress:238calls,
150100triangles,same textures/programs,6.9/7.1/7.1ms median/p95/p99,7.3ms max.
All existing240draw/64MiB/32texture thresholds pass. No tests/bakes/other
inspection browser overlapped these performance captures. No iGPU60fps,
cold-driver/thermal,human6v6 or network-capacity acceptance implied.

Final pnpm typecheck, pnpm test, pnpm build:client and pnpm audit:assets PASS:
498passed/6existing or opt-in skips,59files passed/4skipped. Nine new tests
cover server earning, invalid messages, frozen-point dodging, current cover,
protection, owner tether/LOS, shared cooldown, late-tick drops, privacy, training/
FFA, death/seat/round cleanup, alternate clear launch, real nonrecursive scoring,
shutdown bonus and fixed render resources/Reduced motion. No assertion, timeout,
worker count or asset budget weakened. Evidence session52-typecheck-final.log,
test-final.log,build-final.log,audit-assets.log and drone-test-final.log.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS with zero console errors; session52-required-report.json
and required-inspect.log. All six completed session52 inspector reports have
zero errors/forbidden offline network requests (session52-report-checks.json).
Final runtime source remained fixed through final type/test/build/audit,
render stress, required inspection and the following live hitch probe.

Final public32,759,456->32,803,821bytes(+44,365),assets26,295,983->26,296,867
(+884,provenance text),client2,001,187->2,013,663(+12,476),source map4,492,683.
Largest remains Switchyard architecture7,184,816bytes. Public40MiB and per-file
25MiB caps pass without exception. session52-bytes.json and asset audit provide
exact resource evidence. No new public binary, dependency or Meshy charge.

Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json
--assert PASS: two bot-caused deaths,zero post-warmup shader recompiles,frames
>150ms,console errors or long tasks. One>24ms frame:90.7ms at startup. Live
starts6.889s; first damage33.597s(26.708s after live); deaths33.723/88.443s,
respawns36.618/91.353s. Normal twelve-seat TDM,scores11:19 at stop,one warmup-to-
live transition, existing collision-routed W input. No storage reset, isolated
room, HP edit, forced death or probe-specific bot policy. Evidence session52-
hitch.json/log and hitch.json. Local stability evidence, not laptop/human acceptance.

Cleanup session52-cleanup.json confirms all10recorded preview-tree processes
stopped,zero port8796 listeners and zero inspection/hitch browsers. The immediate
post-stop query briefly retained two exiting process handles; the follow-up
confirmed both gone. No own Blender process was started. Unrelated host processes
were left untouched. Final scope is apps/ironsight/**,branch ironsight-aaa,all63
reference rows retained and all required gates green. No commit,push or deploy.
Air Support3/3 is complete and enabled in its intended modes. Supervisor owns
review/publication; weapon spectacle is the next ranked feature arc.

### Session 53 - 2026-09-10: Weapon Spectacle arc 1/3 - five weapons, five flash signatures

Read standing brief, supervisor Session53 status, plan and all63 local design
references in order. Branch ironsight-aaa, scope apps/ironsight/**; no commit,
push or deploy. Supervisor rejected Session52 on hitch, so the sentry remains
an unpublished local candidate despite its own session's passing report.

Reference: R-G10/11/12/20, R-L14. Target: five visibly distinct local/remote
muzzle signatures, 2-4 frames at60Hz (34-64ms), eight pooled remote slots,
constant lights/program variants, no extra render pass, same64MiB/32texture/
240draw budgets. Remote identity comes from the server shot's weapon slot;
local feedback keeps the existing immediate predicted-fire path. Authority,
accuracy, hit registration and cadence remain unchanged.

Hitch investigation starts with retained supervisor loop52-hitch.json:236.8ms
at76.976s,214/216CPU samples idle,zero recompiles/errors, no nearby gameplay
event. The unchanged built client reproduced a573.9ms frame at23.078s in
session53-hitch-baseline.json (534/550samples idle,zero long tasks/recompiles).
Different moments and idle profiles do not establish a sentry/game-code cause.
Tried opt-in browser scheduling/GPU tracing: first export timed out on IO.read,
second export never completed. The second run retained its CPU/frame report
(session53-hitch-diagnostic.json:280.2ms startup frame with192/205idle samples;
later maximum76.7ms). Stopped only that owned process tree, retained both logs,
and REJECTED/removed the tracing experiment. scripts/hitch-probe.mjs is byte-
identical to HEAD; no threshold, measurement-window, bot-route or assertion edit.
No usable GPU trace was produced and no external-host cause is asserted.

Feature arc plan:1/3 all five flash signatures now;2/3 sniper scope glint with
cover/aim/readability checks;3/3 rotational-only blast trauma and Reduced motion.
No owner decision is needed. The reference target is time-based at60Hz; faster
displays show more frames of the same duration, not a shorter gameplay cue.


Implemented one original256x128RGBA8 atlas with five64px flame cells, baked
once on construction. Immutable UV views share one Source and identical sampler
parameters; first-person and eight remote slots reuse it. Explicit preparation
uploads every view, including unselected weapons. The texture estimate now also
includes Sprite maps and counts this demonstrably shared source once; thresholds
remain64MiB/32textures/240draws. Shape/colour and34-64ms envelope distinguish
weapons without changing any gameplay table, shot timing, aim or hit authority.

Corrected a concrete preparation gap: SceneRig previously set the sentry
InstancedMeshes visible while their count remained0. compileAsync alone did not
submit those draws. Hidden preparation now temporarily enables every allocated
instance slot, draws with the existing materials, then restores each exact count,
visibility and culling flag before showing the canvas. Inspector records270
prepared slots. No light is added/removed, and inactive sentry draws remain0.
This addresses a first-use path; the earlier idle-profile stalls are not proven
to originate there and are not relabelled as shader compilations.

Rejected intermediates: oversized first-person shotgun bloom crossed too much
of the aiming corridor; reduced its dimensions/scale. Long narrow flashes looked
like vertical sticks; angled the SMG/sniper silhouettes. Kept unchanged remote
identity while ADS reduces local size65% and opacity55%. The initial flash still
fixture repeatedly triggered recoil; changed it to one exact12ms sample at the
last frame. Weapon inspector also now waits for production prepare(), avoiding
partially loaded ground/architecture/shadows in stills. Retained session53-flashes-*
and session53-final-* as intermediate evidence.

The first typecheck caught the new pooled-VFX test importing DOM audio through
the server-only test project; moved that case into the existing DOM-checked
impact-vfx.test.ts. The pure atlas/lifetime tests remain in weapon-flash.test.ts.
Corrected the Three Source generic/image type annotations. No tsconfig exclusion,
assertion, timeout, worker-count or budget was relaxed.

Wow check: session53-final-report.json, flash-{1..5}-{before,firing,after}.png
and final-flash-play.png.22.072s of ordinary Training inputs across five weapons
yielded17server-confirmed shots/7hits;176sampled frames showed active flashes,
all five slots were seen and every post-release sample had zero flash opacity.
No HP/position/clock/reward/effect injection, teleport or room isolation.
The exact12ms offline weapon stills/lineup are explicitly presentation fixtures.
Player sentence: "The shotgun blooms, the sniper cracks blue, and every gun has its own punch."
Reproduce gameplay with node scripts/inspect-map.mjs --url http://localhost:8796
--shots flash-play --prefix session53-game.

Static session53-reference-audit.json retains all three150x100m/1250m2per-seat
layouts and111/114/111boxes. Relay65full/46waist,Undertow52/62,Switchyard63/48;
no head-height cover. Sprint rotation proxies14.44/14.44/11.78s Relay(open and
closed),14.22/14.22/11.33Undertow,14.44/14.44/11.56Switchyard. ADS250/200/225/
400/165ms, sprint recovery120/100/130/150/90ms,3s respawn,1.4hostile foley,
hit/kill pip,two damage cues,five-row top-right feed retained. DOM4/8s capture,
1point/2s/flag,no side swap and78FOV still miss references. Session52's natural
contact/heatmaps remain the evidence; no map/bot change or new pacing claim.
All63 scorecard rows retained and ranked; R-G10's implemented rule now met.

Open owner questions/defaults: short differentiated flashes(yes), smaller/dimmer
local ADS flash while remote threat signatures stay intact(yes), keep existing
reduced-motion behavior and no additional camera shake in1/3(yes). Continue
sniper glint in2/3 and rotational blast trauma in3/3. Industrial daylight,6v6,
server-verified damage and no new dependencies. Meshy spend0; reported balance
1530 unchanged. An original code-native transient is appropriate here. Human
mouse/RTT, flashes/headphone comfort, animation, laptopiGPU/thermal and other-
browser acceptance remain open. No owner response required to continue.

Matched render budget: session53-before-report.json versus session53-render-
report.json, deltas in session53-render-delta.json. Edge152/RTX5070 D3D11,
1920x1080 balanced/DPR1,eleven remotes plus local,145twelve-rifle volleys and
96blasts,existing two-team support effects,full3s drain.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|238|238|0|
|Peak submitted triangles|150102|150102|0|
|Resident textures|31|30|-1|
|Estimated texture MiB|63.8346|63.9388|+.1042|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.1|0 rounded|
|Maximum frame ms|13.9|13.9|0 rounded|
|First-ready maximum ms|7.1|7.1|0|
|Prepared programs/geometries|32/160|32/160|0|

Construction92.2->88.9ms;preparation1407.4->1655ms(+247.6),including270
instance slots now submitted. Cache/order varies; no preparation speedup claimed.
The additional mixed-weapon fixture uses the same twelve-shot volley rate across
five remote flash/loadout types (its legacy report counter label still says
rifles):236calls/142950triangles,same textures/programs,6.9/7.1/7.1ms,14ms max.
Both preserve the unchanged240draw/64MiB/32texture limits. No tests/bakes or other
owned inspection browser overlapped performance sampling. These are localRTX
measurements, not laptopiGPU60fps,thermal,cold-driver,human6v6 or network capacity.

Final prepared weapon stills: session53-ready-report.json and ready-weapon-*
images include all five flashes, AR/shotgun before frames and ADS flash frames.
Opened the final AR/sniper views and the actual Training shotgun firing capture;
reviewed the corrected shotgun/ADS stills too. All six completed session53
inspector reports have zero console errors and forbidden offline requests;
session53-report-checks.json. No new public binary, dependency or Meshy charge.

Required pnpm typecheck, pnpm test, pnpm build:client and pnpm audit:assets PASS:
501passed/6existing or opt-in skips,60files passed/4skipped. Three new cases
cover distinct nonbleeding atlas cells/shared allocation,2-4frame expiry and
8slot saturation/constant lights. Typecheck/build/audit reran after the final
inspector-readiness adjustment; all gameplay/authority code remained unchanged
through final tests and captures. Logs session53-typecheck-final.log,test-final.log,
build-final.log,audit-assets.log. Worker dry-run PASS297.09KiB/84.48KiB gzip
(session53-worker-dry-run.log); explicitly no deployment.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS,zero console errors. session53-required-report.json,
required-inspect.log and required-{relay,practice-two}.png preserve results.

Final public32,803,821->32,819,942bytes(+16,121),assets26,296,867->26,297,574
(+707,provenance text),client2,013,663->2,018,566(+4,903),source map4,503,194.
Largest remains Switchyard architecture7,184,816bytes. Public40MiB/per-file25MiB
caps pass without exception. session53-bytes.json and asset audit provide exact
resource evidence. All runtime edits remain within apps/ironsight/**.

The first final-build exact hitch run (session53-hitch-first-final.json/log)
FAILED only coverage: one bot-caused death within150s. Zero>150ms frames,zero
shader recompiles/errors/long tasks; largest106ms,100/102CPU samples idle.
It was a normal fresh12seat warmup/live round,not an inherited-room failure.
Damage at29.430s,death35.952s,respawn39.777s; later damage left26HP and the
normal cap route did not produce a second death before the limit. Retained the
failed result and reran the exact command for required coverage,without changing
the script,HP,bot policy,room routing,storage or runtime.

The second final-build run reached two bot deaths but FAILED a393.2ms frame
at64.509s (368/375CPU samples idle),zero recompiles/errors and no nearby game
event. Retained session53-hitch-second-final.json/log. This disproves any claim
that the instance-preparation correction alone solved the intermittent stall.
A separate ignored .inspect/session53-diagnostic.mjs now adds10ms timer samples
and browser-target CDP tracing to diagnose frame delivery; the required probe
and runtime remain unchanged.

Scheduler diagnosis: session53-scheduler.json records two deaths,zero>150ms
frames/recompiles/errors/long tasks. Its140.6ms frame at19.324s had NO10ms-timer
gap>24ms within one second: the renderer thread continued serving timers while
rAF delivery stalled. Browser-target tracing also timed out on export; its
separate script closed its owned browser,retained the frame/timer data and log,
and no GPU trace is claimed. The evidence points toward frame/GPU presentation
starvation,but does not distinguish the driver,compositor or external contention.

Code inspection exposed avoidable GPU-resource churn: every shot allocated a
new tracer box/material; each grenade and blast allocated/disposed more geometry,
materials and instance buffers,even after preparation. Added CombatFx fixed
pools:96tracers,32grenades,12simultaneous650ms blasts,only four shared geometries.
All material/instance buffers exist before hidden warm-up. Spawn/bounce/boom
and expiry reuse slots; saturation replaces the oldest cosmetic effect,never
authoritative damage/collision. Kept existing tracer endpoints/speeds/fade,
grenade integration,blast rings/debris and constant four-light budget. No new
asset/texture/light/pass. This concrete correction removes in-combat resource
creation/disposal; it is not proof of the unexplained idle stalls' sole cause.

Three additional tests exercise2000saturated shot/blast cycles with identical
objects/materials/geometries and zero disposals,exact tracer growth/arrival,and
grenade id reuse/stale bounce/boom safety. Typecheck and all nine targeted VFX
cases pass. Earlier501-test/resource/byte totals above describe the pre-pool
candidate and are superseded by the final pool gates/measurements below.

Final pooled candidate verification (supersedes pre-pool totals): all504tests
PASS,6existing/opt-in skips;61files pass/4skipped. pnpm typecheck, pnpm test,
pnpm build:client and pnpm audit:assets are green in the final-named logs.

Matched baseline -> final pooled stress (session53-pooled-render-report.json,
pooled-delta.json):238->238peak calls,150102->150102triangles,31->30textures,
63.8346->63.9388MiB,32->32programs,160->164resident geometries (four retained
shared geometries replace transient allocations). Median/p95/p99 remains
6.9/7.1/7.1ms;max13.9->7.8ms;first-ready7.1->7.1ms. Construction92.2->86.6ms,
preparation1407.4->1051.5ms,468instance slots now warmed; cache/order varies,
no cold-start speedup claimed. Mixed-weapon stress236calls/142950triangles,
6.9/7.1/7.1ms,max7.2ms;all effects drain. Same unchanged budgets/GPU caveats.

Final wow check: session53-pooled-game-report.json and pooled-game-flash-
{1..5}-{before,firing,after}.png.20.045s ordinary Training input,15confirmed
shots/7hits,all five correct flash identities,clean expiry. Opened the actual
shotgun firing capture. Same player sentence and reproduction command as above.
The same run also exercises real G grenades, self-elimination, reload cancellation
and100HP revival with authoritative aim restored (self-death/self-respawn.png);
this is separate from the hitch gate's required bot-caused deaths. No injected
state or forced death beyond ordinary self-thrown grenades in that named drill.

Exact required relay,practice-two inspection reran after pooling and passed
with zero errors; final session53-required-report.json/log/images updated.
Final public32,803,821->32,823,791bytes(+19,970),assets26,296,867->26,297,938
(+1,071provenance text),client2,013,663->2,020,163(+6,500),source map4,505,082.
Largest7,184,816bytes;40MiB total/25MiB per-file caps pass. Exact values in
session53-pooled-bytes.json. No new dependency/binary/download/paid generation.

Hitch follow-through: the first pooled exact run PASSED with two bot deaths,
zero spikes/recompiles/errors/long tasks (session53-hitch-pooled-first.json/log).
Its only >24ms frame was92.1ms at startup. The confirmation run FAILED solely
on its first measured frame288.9ms; no later gameplay frame exceeded24ms,
two bot deaths and zero recompiles/errors (pooled-second.json/log retained).

Measured the probe itself using ignored session53-profiler-start.mjs: starting
V8 CPU sampling took86.0ms and exactly coincided with its85.9ms first frame,
1.1ms after measurement began (session53-profiler-start.json/log). This is
probe initialization counted as gameplay. Moved Profiler.setSamplingInterval /
Profiler.start before installing the frame clock, and report profilerSetupMs
separately. This supersedes the earlier byte-identical probe statement. No
threshold, bot route, game input, warm-up delay, death requirement or150000ms
maximum window changed; the existing six seconds after the second death also
remain unchanged. No mid-game frames are discarded. node --check passes.
The earlier mid-game idle stalls remain distinct, without a proven single cause;
pooling removes known GPU allocation churn, while this calibration removes
only the demonstrated profiling setup artifact.

Final exact hitch command PASS (session53-hitch.json,session53-hitch.log and
.inspect/hitch.json): two bot-caused deaths,zero frames>24ms,zero>150ms spikes,
zero shader recompiles,zero console errors and zero long tasks. Profiler setup
95.2ms is explicitly reported separately. All unchanged gameplay assertions pass.
The final probe-only setup edit also passes node --check; runtime is identical
to the already verified504-test build and required map captures above.

End state: all six required gates green. Branch ironsight-aaa; git diff --check
clean; all working-tree paths remain inside apps/ironsight/**,including retained
Session52 work. No commit,push or deploy. Owned preview process identities were
checked against creation timestamps before stopping; port8796 has no listener,
no owned preview process remains and no inspection browser remains. Cleanup
record: session53-cleanup.json (the parent CLI exited with its child). Trace
experiment cleanup is recorded separately in session53-trace-cleanup.json.
Next session: Weapon Spectacle2/3, sniper scope glint; retain the measured GPU
pooling and profile-setup ordering. No new owner question blocks continuation.

### Session 54 - 2026-09-10: Weapon Spectacle arc 2/3 - read the sniper before the shot

Read the standing brief, supervisor Session54 status, plan and all63 design
references. Supervisor confirms Session53 passed and was published (a35bf17,
deployment04978736-2d15-443b-85b6-c7946290aafc). Retained its pooled effects and
profiler setup ordering. Branch ironsight-aaa; scope apps/ironsight/** only.
No commit, push or deploy. Re-ranked all63 reference rows: complete Weapon
Spectacle2/3 now, bounded rotational blast trauma with Reduced motion next.

Reference: R-G03, R-G11, R-G12, R-G20, R-L14. Target: an identifiable sniper
scope glint before firing, driven by replicated held weapon/aim/life/reload;
never reveal an actor through current cover, never suppress the cue through
Reduced motion, no additional light/pass/download, <=240draws/64MiB/32textures.
R-G03's implemented telegraph rule is now met; human reaction/RTT acceptance
remains open. Existing sniper tracer, cadence and400ms ADS acquisition retained.

Implemented one fixed16-slot instanced plane pool. An original optical cross
occupies the previously unused sixth cell of the existing256x128RGBA8 flash
atlas: same Source, sampler and131,072-byte GPU allocation. The lens follows
the remote weapon mount through aim, crouch, reload and async model replacement.
White centre/cross has a small bright core; angular scaling caps the cosmetic
plane at2m. Full strength inside4degrees, smooth fade to14degrees, near fade
1-3m and far fade100-120m. Both pitch and yaw participate. No flashing pulse,
lingering occlusion fade, extra lighting or per-frame bake. One new material
variant and plane geometry are prepared before play; no runtime GPU allocation.

This is deliberately a held-sniper optical reflection, including hip fire,
NOT an ADS-ready indicator. ADS is not replicated; no new wire field or guessed
ADS timer was introduced. A held rifle can still be in its existing switch/fire
recovery. All remote teams use the same optical rule, with existing team-colour
silhouettes; FFA uses it too. Self is excluded. The renderer only consumes actors
already present in its interpolated network poses. Death, reload, another weapon
or disappearance removes the draw on the next pose sync. The observer-to-lens
AND observer-to-authoritative-eye rays must clear current hit boxes, including
ramp occluders and Relay shutters. Depth testing additionally clips the plane
against rendered cover. Aim/collision/hits/scoring/network protocol unchanged.

Rejected intermediates: the initial1.1m-capped flare was too faint in the38m
lane capture; increased the optical cross to a2m maximum with1.6 intensity,
retaining a small centre. session54-glints-* preserves the initial tuning.
The first eleven-sniper stress fixture put three lenses behind existing cover:
its assertion correctly reported8/11 active (session54-render-report.json).
Moved only the offline stress actors/camera into the clear Cooling lane; the
same assertion now requires all11. No visibility rule, performance budget or
test threshold was relaxed. Initial typecheck caught a ramp helper taking one
ramp and readonly inspector tuple fields; corrected both before final gates.

Wow check: paired offline before/after moment stills
session54-final-glint-before.png (sniper reloading) and glint-ready.png (rifle
raised toward the viewer), plus near12m/far98m, turn-away, closed-core cover,
reload, death and Reduced-motion captures. The main pair is at38m. These are
explicit production-renderer fixtures, not claimed human input or bot encounters.
Opened and reviewed the revised38m and12m images. All nine named states have
asserted active counts and zero browser errors. Player sentence:
"That white glint down the lane means a sniper is looking right at me."
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
glint-before,glint-ready,glint-near,glint-far,glint-away,glint-cover,glint-reload,glint-dead,glint-reduced
--prefix session54-review. No Meshy spend or new dependency; original procedural
optics are appropriate for this transient. Reported balance1530 unchanged.

All required source gates PASS: pnpm typecheck, pnpm test (510passed,6existing/
opt-in skips;62files passed/4skipped), pnpm build:client and pnpm audit:assets.
Six new tests cover cone/range/vertical aim, life/reload/swap, both occlusion
rays, real map cover/ramps/Relay shutters,1000pool saturation/reset cycles with
identical GPU resources, and lens attachment through swaps/crouch/pitch. Existing
flash-cell/lifetime and weapon-hold tests also pass. Final-named gate logs in
.inspect/session54-{typecheck,test,build,audit}-final.log.

Matched render evidence: session54-before-report.json -> session54-final-report.json,
same1920x1080 balanced/DPR1 Edge152/RTX5070 D3D11,11remotes plus local,145
twelve-rifle volleys,96blasts, two-team support fixtures and3s effect drain.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak submitted calls|238|238|0|
|Peak submitted triangles|150102|150102|0|
|Resident textures|30|30|0|
|Estimated texture MiB|63.9388|63.9388|0|
|Median/p95/p99 frame ms|6.9/7.1/7.2|6.9/7.1/7.1|0/0/-.1|
|Maximum frame ms|7.2|7.5|+.3|
|First-ready maximum ms|7.1|7.1|0|
|Prepared programs/geometries|32/164|33/165|+1/+1|

Construction86->84.8ms; preparation1047.8->1074ms; prepared instance slots
468->484. Cache/order varies; no startup speedup claim. The additional all11-
sniper clear-lane stress is239draws/153842triangles,30textures/63.9388MiB,
33programs,6.9/7.1/7.1ms median/p95/p99,7.5ms maximum. Its changed lane/weapon
geometry means triangles are not a matched delta. The pool contributes one draw
and22triangles for11scopes. All same240draw/64MiB/32texture limits pass; combat
effects drain completely. No owned test/bake/other inspection browser overlapped
timing samples. These are localRTX measurements, not laptopiGPU60fps/thermal,
cold-driver, real6v6 or network-capacity acceptance. session54-render-summary.json.

Static reference audit refreshed: session54-reference-audit.json (build/run
tools/reference-audit.ts). Maps remain150x100m/1250m2per seat; Relay65full/46waist,
Undertow52/62, Switchyard63/48. Sprint A-B/B-C/A-C proxies14.44/14.44/11.78,
14.22/14.22/11.33,14.44/14.44/11.56s; open-core rotations retained. ADS250/200/
225/400/165ms and sprint recovery120/100/130/150/90ms;3s respawn,1.4hostile
foley, hit/kill pip, two damage cues and five-row top-right feed retained. Existing
DOM4/8s capture,1point/2s/flag, no side swap and78FOV still miss references.
Session52 contact/heatmaps remain the pacing evidence; no map/bot change or new
contact/fairness claim this session.

Required relay,practice-two inspection PASS with zero console errors and zero
forbidden offline requests: session54-required-report.json/log/images. Public
32,823,791->32,843,238bytes(+19,447), assets26,297,938->26,298,891(+953,
provenance text), client2,020,163->2,026,049(+5,886), source map4,517,690.
Largest remains Switchyard architecture7,184,816bytes.40MiB total/25MiB per-file
caps pass, no exception. Exact before/after/deltas: session54-bytes.json.

Open owner questions/defaults: steady glint rather than a pulsing cue(yes),
warn on held-sniper hip fire as well as ADS(yes), same cue in Reduced motion(yes),
keep scope glint out of hip/ADS local aiming UI(yes). Continue rotational-only
blast trauma in Weapon Spectacle3/3; no answer needed to proceed. Human visibility,
counterplay, colour/comfort, RTT, iGPU and cross-browser review remain open.

Final exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on its first Session54 run. Two bot-caused
deaths, zero frames>24ms (therefore zero>150ms), zero post-warmup shader
recompiles, zero console errors and zero long tasks. Profiler setup89.5ms is
reported separately by the unchanged Session53 probe. Normal12-seat TDM,
19:21 at stop; no room isolation, HP/clock edits, forced death, route changes or
storage reset. Evidence session54-hitch.json/log, hitch.json and extracted
session54-hitch-summary.json. Runtime unchanged since the final source gates.

Cleanup verified all12 recorded preview-tree processes stopped, zero listeners
on8796, zero remaining inspection/hitch browsers; session54-cleanup.json.
Saved process start time had millisecond precision, so the first exact-tick
identity comparison safely stopped cleanup; checked equal Unix milliseconds
and the expected preview command before terminating that owned tree. No other
processes stopped. All six required gates green, git diff --check clean, all
working paths within apps/ironsight/**. No commit, push or deploy. Session54
completes Weapon Spectacle2/3 by default; proceed to rotational blast trauma3/3.

### Session 55 - 2026-09-10: Weapon Spectacle arc 3/3 - feel the blast, keep the shot

Read the standing brief, Session55 supervisor status, plan and all63 design
references. Supervisor confirms Session54 passed, committed b237662 and preview
deployment b034bb2d-49b9-40ef-9d65-2ffce9bdeb82. Selected the top remaining arc
item and completed Weapon Spectacle3/3 by default. Re-ranked the63 reference
rows and gap list: deployment/match-start presentation next, then encounter
fairness. Branch ironsight-aaa; apps/ironsight/** only; no commit/push/deploy.

Reference: R-G07, R-G08, R-G12, R-G20, R-L14. Target: server-confirmed grenade
and mortar impacts add0-1 trauma; rotation proportional to trauma squared,
<=2degrees, fully settled within2s of the last impact, render-only. Reduced
motion disables it, ADS reduces amplitude65%, existing warnings stay visible,
and the central aim ray/eye/authoritative recoil do not change. Implemented
targets met; human comfort/competitive feel remain open.

Replaced the old grenade camera x/y jitter with a smooth7/11Hz roll envelope.
Each visible grenade adds.85 trauma, mortar1, stacking capped at1. Full response
inside4m, linear falloff to zero at30m; current hit boxes include ramps and
Relay shutters and suppress responses behind cover. The same received nadeBoom
and mortarImpact events feed the effect; scheduled mortar warnings never do.
No wire/schema/state/scoring/physics/bot changes. Existing explosion rings,
debris, light pool, positional audio, mortar telegraphs and damage cues remain.

Used roll alone deliberately: it preserves the center aiming ray even DURING
the draw, unlike pitch/yaw displacement. A saved quaternion is restored in
finally after the render, including its matrices, so gameplay rays, local
muzzle queries and subsequent frames see the original pose. No positional
blast motion, random-per-frame jitter, new light/pass/texture/geometry or GPU
allocation. Existing traversal landing dip/slide bank remain independent.
Reduced motion, death, ended match, disconnect and unlocked controls clear
trauma; disabled periods cannot store a burst for resume. Absolute monotonic
expiry removes timestep dependence and fully clears after background gaps.

Five new tests cover saturated bounds/squared response/exact expiry,
frame-rate independence/ADS/clock rollback, range/invalid input/real core
shutters, eye/forward-ray/center projection and quaternion restoration even
on a thrown renderer error, plus production SceneRig disable/resume routing.
All515 tests pass,6existing/opt-in skips;63files pass/4skip. New DOM-importing
test is typechecked by tsconfig.client.json, following the existing split.

Rejected intermediates: the first test import lacked the browser location
stub; the first typecheck correctly rejected importing SceneRig from the
Worker-only lib. Fixed fixture initialization and client test inclusion, not
production globals. Repeated subtraction left5.46e-14 trauma at the exact2s
endpoint; replaced it with an absolute expiry, retaining the exact-zero test.
The first stress run accidentally passed rAF's earlier timestamp to render
while effects were born at performance.now, omitting first-frame flashes.
Preserved initial-render-report/summary; restricted explicit time sampling
to the six offline blast stills and repeated the normal production-clock
stress. No budget, effect lifetime or gate threshold was relaxed.

Wow check: .inspect/session55-wow-blast-{quiet,before,impact,ads,reduced,settled}.png
and session55-wow-report.json. These are paired production-renderer fixtures:
before disables only camera response to the SAME explosion; impact samples
30ms, settled2100ms. Opened the impact and reviewed the actual Training impact
too. The camera remains at the same eye; the nearby blast banks the horizon.
Player sentence: "That blast rocked the whole yard, but I could keep my shot lined up."
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
blast-quiet,blast-before,blast-impact,blast-ads,blast-reduced,blast-settled
--prefix session55-wow.

Additional real-input wow evidence: session55-game-report.json and
game-blast-play-{before,impact,settled,reduced}.png, via --shots blast-play
--prefix session55-game.20.029s Training sequence, two received nadeBoom events,
maximum observed1.30124degrees;912normal and1965Reduced-motion frame samples.
Second throw follows a real Settings checkbox click; every Reduced-motion
sample has exactly zero trauma/roll. Ordinary G and movement input, no injected
state/event/HP/effect, no claimed bot-TDM encounter. Self-damage is real and
does not drive this cosmetic response; received blast positions do.

Earned mortar integration: --shots mortar --prefix session55-mortar, existing
five-kill/V drill and20s post-call sequence. session55-mortar-report.json now
also records read-only blast diagnostics: zero trauma at1500/2450ms warning,
.67258/.82845/.93135 at3150/3800/4450ms after the three confirmed impacts,
zero by6500ms. Normal authoritative target damage and nonrecursive support
checks pass; final warnings/effects drain. This is Training, not human6v6.

Static reference audit refreshed in session55-reference-audit.json using the
existing tool. Maps remain150x100m/1250m2 per seat; Relay65full/46waist,
Undertow52/62, Switchyard63/48. Sprint rotation proxies14.44/14.44/11.78,
14.22/14.22/11.33,14.44/14.44/11.56s. ADS250/200/225/400/165ms and sprint
recovery120/100/130/150/90ms;3s respawn,1.4hostile foley, hit/kill pip, two
damage cues and five-row top-right feed unchanged. DOM4/8s capture,
1point/2s/flag, no side swap and78FOV still miss their references. Session52
contact/heatmaps remain pacing evidence; no new fairness claim this session.

Open owner questions/defaults: two-degree roll ceiling(yes),65% ADS reduction
(yes), complete suppression with Reduced motion(yes), no through-cover shock
(yes). Defaults active; no answer blocks continuation. Meshy balance1530
unchanged, zero credits spent: this effect needs no new bitmap or hero asset.
No new dependency or public asset. Human comfort, moving weapon/hand review,
RTT/6v6,iGPU,cold-driver/thermal and cross-browser acceptance remain open.

Final source gates PASS: pnpm typecheck, pnpm test(515/6skip), pnpm build:client,
pnpm audit:assets. Logs .inspect/session55-{typecheck,test,audit}-final.log and
session55-build-client-final.log. pnpm build also PASS, including Worker dry-run
297.09KiB/84.48KiB gzip; session55-build-final.log. Explicitly no deployment.
Only offline timestamp sampling changed after the full test run; final typecheck,
bundle, audit and inspection reran after that correction.

Matched production-clock render evidence: session55-before-report.json ->
session55-final-report.json, summary session55-render-summary.json. Same
1920x1080 balanced/DPR1 Edge152/RTX5070 D3D11,11remotes+local,145twelve-rifle
volleys,96blasts, existing two-team support fixtures and3s effects drain.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|238|238|0|
|Peak submitted triangles|150102|150102|0|
|Resident textures|30|30|0|
|Estimated texture MiB|63.9388|63.9388|0|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.2|0/0/+.1|
|Maximum frame ms|7.2|7.5|+.3|
|First-ready maximum ms|7.1|7.1|0|
|Prepared programs/geometries|33/165|33/165|0/0|

Construction88.3->89.3ms; preparation1323->1054.7ms, same484prepared
instance slots. Cache/order varies; no startup speedup claimed. The additional
eleven-sniper stress is239calls/153842triangles,6.9/7.1/7.2ms,7.3ms max,
same texture/program budgets and11visible glints. Peak measured blast roll
1.83286/1.83316degrees, fully zero after drain. No owned test/bake/inspection
browser overlapped the performance samples. Same240draw/64MiB/32texture
limits pass. These are localRTX observations, not representative laptopiGPU
60fps,thermal,cold-driver,human6v6 or network-capacity acceptance.

Exact required node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS with zero console errors and forbidden offline requests.
Saved session55-required-report.json/log and required-{relay,practice-two}.png.
All Session55 completed inspector reports are error-free; report-checks.json.
Public32,843,238->32,853,088bytes(+9,850), assets26,298,891unchanged,
client2,026,049->2,029,431(+3,382), source map4,524,158(+6,468).
Largest remains Switchyard architecture7,184,816bytes.40MiB total and25MiB
per-file caps pass without exception. Exact bytes: session55-bytes.json.

Final exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first Session55 run. Two bot-caused
deaths, zero frames>24ms (therefore zero>150ms), zero shader recompiles,
zero console errors and zero long tasks. Profiler setup87.8ms reported
separately by the unchanged Session53 probe. Normal12-seat TDM,12:15 at stop;
no HP/clock/route edits, room isolation, forced deaths or storage reset.
Evidence: session55-hitch.json/log and hitch.json. No runtime edits after
final source gates and required map captures.

All six required gates green. Cleanup verified all12 recorded preview-tree
processes stopped, zero8796listeners and zero remaining inspection/hitch
browsers; session55-cleanup.json and preview-tree.json. Preview root identity
checked by creation time and command before stopping its owned descendants.
git diff --check clean; every working-tree path is inside apps/ironsight/**.
No commit, push or deploy. Weapon Spectacle3/3 is complete by default.

### Session 56 - 2026-09-10: Deployment arc 1/2 - count in the squad

Read the standing brief, Session56 supervisor status, plan and all63 design
references. Supervisor confirms Session55 passed, committed e5cbe11 and preview
deployment c6a8a19a-a22f-4ddb-8d4b-b266b2e6703f. Selected the top presentation
gap and re-ranked the scorecard/gap list. Deployment1/2 is ON by default: the
countdown, objective callout and start sound. Session57 completes the arc with
a short skippable map introduction. Scope apps/ironsight/**, branch ironsight-aaa.
No commit, push, deploy, dependency, public asset or Meshy spend.

Reference: R-L05, R-L16, R-L14, R-G12. Targets: one replicated deadline for the
existing10s warmup; actual remaining seconds for late joiners; cancellation below
the seat threshold; GO only on received LIVE. No extra waiting, input/camera
lock or central20% aiming-corridor obstruction at1920x1080,1280x600,390x844.
Three pips at3/2/1; one start chord under500ms; GO clears after2200ms of monotonic
render time. Reduced motion keeps identical information with no animation.
Implemented checks pass. R-L05 remains partial: results still20s with majority
skip, no replicated intermission deadline/5-8s freeze; fly-through and human
flow/listening acceptance remain open.

Added warmupEndMs (f64) to ArenaState/ArenaSchema. The room arms it once when
the seat threshold is met and uses this SAME epoch for its actual tick-side
start check, replacing the private tick-count timer. Delayed ticks start on the
next execution after that deadline, rather than extending warmup by missing
tick count. Expiry never grants client authority: before LIVE arrives, the HUD
says STAND BY. Seat expiry clears the deadline; replacement seats arm a fresh
duration. End/reset/rematch clear it too. Existing scores, spawn reset, combat
gates, bots, collision and room lifecycle policy remain intact. Changes ride
the existing tick's markStateChanged. The appended scalar has an8-byte payload;
no per-tick countdown messages. Snapshot version11->12 intentionally starts
older snapshots fresh through the existing null migration. Schema fingerprint
changes: supervisor must publish Worker/client together; old tabs need a refresh.

The peripheral amber banner identifies map/mode/team, explains the objective,
and warns that positions reset at start. Ten segments fill as seconds pass.
Confirmed start changes to teal GO / TAKE THE FIELD, then restores the compact
brief. Duplicate briefing text is hidden only while the expanded version is
visible. Narrow layouts place it below connection info and keep capture/FFA
panels beneath it. Static DOM textContent, polite atomic status region, no
focus/mouse interception. Training stays immediate; initial LIVE joins skip GO.
Pause/disconnect/background/death suppress the banner and consume missed edges.
Resuming cannot replay them. Clock corrections cannot replay pips, and a small
clock-sync error cannot override confirmed LIVE. Monotonic render time bounds
GO even if the network clock moves backward.

Audio uses the existing gesture-resumed context, master volume/mute and limiter.
Pips:740Hz triangle,85ms envelope/100ms scheduled life. Start chord:164.81,
246.94,329.63Hz together,480ms envelope/495ms life. Oscillator/gain nodes disconnect
on ended. No future number/GO queue or loop. No light, pass, texture, geometry,
per-frame bake or audio download. Meshy would not improve this UI/audio beat;
zero credits spent, reported balance1530 unchanged.

Five new tests cover real-room arm/late join/forged fields/boundary; seat-expiry
cancellation/rearm/delayed tick/rematch;3/2/1/standby/confirmed GO; missed beats,
clock rewind/pause/reconnect/initial LIVE/practice/invalid values; and monotonic
GO expiry despite clock correction. Full pnpm typecheck and pnpm test PASS:
520passed,6existing/opt-in skips,64files passed/4skipped. pnpm build:client and
pnpm audit:assets PASS. Final logs: .inspect/session56-{typecheck,test,build,audit}-final.log.
No source or production-inspector edits after these final gates.

Rejected intermediates: awaiting a reconnectable close before advancing fake
time deadlocked the new expiry test. Kept its promise, advanced the reconnection
window, then awaited it; no timeout relaxation. Initial narrow still overlapped
the duplicate brief/connection box; repositioned it and added overlap checks.
Initial audio observation read AudioParam.value before its scheduled set applied
and found no matching tones. The inspector now records setValueAtTime's actual
argument; production audio/assertions were not weakened. Initial evidence remains
in session56-targeted/game/wow files; final fixtures/game-verified supersede them.

Wow check:20.011s normal12-seat bot TDM sequence in
.inspect/session56-game-verified-report.json, with deployment-{arrival,three,one,
go,clear}.png under that prefix. Only matchmaking room identity is isolated with
the existing --isolated-tdm flag; no phase/deadline/HP/position edits or injected
gameplay events. One constant deadline through07->01, STAND BY while still warmup,
then exactly one LIVE/GO edge. GO clears2200.5ms later on the next render frame.
All three740Hz pips fire once; three chord oscillators fire together once; all
six end. Observed callbacks92.7-98.5ms after pips,494.0-494.1ms after chord nodes.
This is audio-graph evidence, not listening approval. Opened/reviewed real GO
with a teammate leaving spawn. Player sentence:
"Three, two, one—the squad launches together and I know what we're fighting for."
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
deployment-play --isolated-tdm --prefix session56-game-review.

Paired absence/new-countdown stills and ten production-HUD fixtures:
session56-wow-final-report.json and match-deployment-*.png (before,countdown,
go,dom,ffa,waiting,standby,reduced,short,narrow). Existing static vista background;
not a claimed fly-through/bot encounter. All check sets pass: fit, outside aim,
no overlap with connection/duplicate brief, status semantics and no animation.
Reviewed countdown/narrow plus actual game GO. Zero console errors or forbidden
offline requests. Required exact node scripts/inspect-map.mjs --url
http://localhost:8796 --shots relay,practice-two PASS with zero errors/forbidden
requests. Saved session56-required-report.json/log and required-{relay,practice-two}.png.

Matched render evidence: session56-before-report.json -> session56-final-report.json;
summary session56-render-summary.json. Same1920x1080 balanced/DPR1 Edge152,
RTX5070/D3D11,11remotes+local,145twelve-rifle volleys,96blasts, support fixtures
and3s drain. This fixture measures the retained combat renderer; actual DOM
countdown/start is separately exercised by game-verified and the hitch gate.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
|Peak calls including shadow work|238|238|0|
|Peak submitted triangles|150102|150102|0|
|Resident textures|30|30|0|
|Estimated texture MiB|63.9388|63.9388|0|
|Median/p95/p99 frame ms|6.9/7.1/7.1|6.9/7.1/7.2|0/0/+.1|
|Maximum frame ms|7.6|7.7|+.1|
|First-ready maximum ms|7.1|7.1|0|
|Prepared programs/geometries|33/165|33/165|0/0|

Construction60.8->61.7ms; preparation643.5->630.9ms;484slots unchanged. Cache/
order varies; no startup speedup claim. Same240draw/64MiB/32texture limits pass;
effects drain. No owned test/bake/other browser overlapped timing captures.
LocalRTX observations do not establish laptopiGPU60fps, thermal/cold-driver,
real6v6/RTT, or cross-browser acceptance.

Public32,853,088->32,882,326bytes(+29,238); assets26,298,891 unchanged;
client2,029,431->2,040,035(+10,604); source map4,524,158->4,542,792(+18,634).
Largest remains Switchyard architecture7,184,816bytes.40MiB total/25MiB per-file
budgets pass without exception. Exact bytes: session56-bytes.json.

Static references refreshed in session56-reference-audit.json via the existing
tools/reference-audit.ts. Maps150x100m/1250m2per seat; Relay65full/46waist,
Undertow52/62, Switchyard63/48. Sprint A-B/B-C/A-C proxies14.44/14.44/11.78,
14.22/14.22/11.33,14.44/14.44/11.56s. ADS250/200/225/400/165ms; sprint recovery
120/100/130/150/90ms;3s respawn/scoring,1.4hostile foley,hit/kill pip,two damage
cues,five-row top-right feed retained. DOM4/8s capture,1point/2s/flag,no side swap
and78FOV still miss references. Session52 contact/heatmaps remain pacing evidence;
no new contact/fairness claim or map/bot change here.

Open owner questions/defaults: retain10s warmup with no extra intro wait(yes);
restrained synthesized chord(yes); suppress missed pause/reconnect cues(yes);
short skippable fly-through next, static in Reduced motion(yes). Defaults active;
no answer blocks continuation. Human excitement/listening,moving hands,6v6/RTT,
iGPU and browser/device acceptance remain open.

Final exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first Session56 run. Two bot-caused
deaths; zero frames>24ms (thus zero>150ms), shader recompiles, long tasks or
console errors. Standard bot TDM without room isolation, forced death, HP/clock
edits, route changes or storage reset. Evidence: session56-hitch.json/log and
hitch.json. All six required gates green.

Cleanup verified all12 owned preview-tree processes stopped, zero8796listeners,
zero remaining owned processes and zero inspection/hitch browsers. Root start
time and each descendant's creation time/command were checked before stopping.
Evidence: session56-preview-tree.json and session56-cleanup.json. git diff --check
clean; every working-tree path is within apps/ironsight/**. No commit, push or
deploy. Deployment1/2 is complete by default; next session finishes the arc's
short skippable map introduction.

### Session 57 - 2026-09-10: Deployment arc 2/2 - survey the battlefield

Read the standing brief, Session 57 supervisor status, plan and all 63 design
references. Supervisor confirms Session 56 passed, committed 755eb7f and preview
deployment 945f9160-84cb-4529-b96a-aea3c9733e34. Completed the top gap,
Deployment 2/2, ON by default. Re-ranked the scorecard/gap list: encounter
fairness and signature-route value are next. Branch ironsight-aaa; scope
apps/ironsight/**. No commit, push, deployment, dependency or purchased-asset edit.

Reference: R-L05, R-L16, R-M13, R-M17, R-L14, R-G12. Targets: at most 4.5 seconds
of skippable introduction inside the existing 10-second warmup; yield before
the final three-second countdown using a 3.5-second reserve. No added wait or
running-round interruption. Same map, three route names and objective in Reduced
motion, with a still camera. No additional lights, passes, textures or geometry.
Implemented targets pass; human excitement, orientation and comfort remain open.
R-L05 stays partial because results still use the existing 20-second majority-skip
intermission without a replicated deadline or the reference's 5-8-second freeze.

The existing renderer now shows a smooth aerial glide over Relay, Undertow or
Switchyard, with an area-of-operations title, the map's existing three route
names and the authoritative objective/team countdown. The glide stays inside
the yard at 22-30 m, above the collision roofs. It cuts back to the actual
operator instead of descending through cover. A 68-degree cinematic FOV is
temporary; the operator's FOV and eye/aim return unchanged. The map title is
below the scene, the countdown moves aside during the flight, and the combat
reticle/weapon and player-location minimap return with the operator view.

Click, wheel or a key skips the intro; the captured gesture cannot also reach
the input handlers for firing, grenade, reload, swap or jump. Mouse movement
during the flight does not turn the operator. Escape retains the normal menu
flow. The controller consumes the introduction permanently on completion,
skip, pause, death, disconnect, backgrounding, deadline cancellation/change or
LIVE. Rematches on the same connection do not replay it. Training, live joins,
waiting lobbies and arrivals with less than 4.5 seconds remaining bypass it.
An operator exploring a waiting lobby cannot have the view taken later when
new seats arm the timer. Reduced motion freezes a fixed composition; enabling
it mid-flight freezes the current pose and cannot restart motion.

Only the render call borrows the camera. A pooled saved position/quaternion,
projection update and finally block restore it even if drawing throws, along
with the weapon's prior visibility. The muzzle light is a separate camera
child and remains present, as do all other lights. Gameplay camera queries,
network look, prediction, collision, claims, server state/schema/version 12,
combat rules, bots and scoring are unchanged. No new animation pass or bake.
Meshy spend 0; reported balance 1530 unchanged. Existing assets are the subject
of this introduction, so a new hero asset would not serve this session's gap.

Six new tests cover warmup/late-arrival boundaries, lobby/live/training/rematch
bypass, cancellation/rearm, monotonic bounds despite clock corrections and
background gaps, Reduced motion/toggle/skip, all three collision-clear flight
paths, and camera/weapon/light preservation including renderer failure.
Final pnpm typecheck and pnpm test PASS: 526 passed, 6 existing/opt-in skips,
65 files passed/4 skipped. pnpm build:client and pnpm audit:assets PASS.
Logs: .inspect/session57-{typecheck,test,build,audit}-final.log. No production
source changes after these gates; only recording fixes in the browser probe
and this plan followed.

Wow check: .inspect/session57-wow-final-report.json and its
deployment-arrival, intro-glide, intro-return, deployment-three/one/go/clear
PNGs. A 20.029-second normal 12-seat bot TDM sequence, with only matchmaking
room identity isolated. No phase/deadline/HP/position edits or injected events.
The flight lasted 3523.1 ms including the unsampled initial portion, returning
while still in warmup with 3493 ms remaining (the 3500 ms cutoff on the next
render frame). 461 recorded moving poses, one operator aim, unchanged 33
programs/30 textures. Real mouse input could not rotate the operator. All three
740 Hz pips and all three GO chord oscillators fired and ended once. Opened
and reviewed the actual arrival/glide/return and the all-map fixtures.
Player sentence: "I sweep over the whole yard, spot the core, and drop into the countdown ready to fight."
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
deployment-play --isolated-tdm --intro-check flight --prefix session57-wow-final.

Reduced-motion real-input sequence: session57-reduced-final-report.json,
20.028 seconds, 459 samples of exactly one camera pose, same map/route/objective
information and bounded audio. Returned after 3509.5 ms with 3495 ms remaining.
Add --intro-reduced to the above command. Skip sequence:
session57-skip-verified-report.json, 20.004 seconds, --intro-check skip.
G exits in 676 ms from intro start, retains grenades and sends no nade intent
among 80 observed outgoing frames. This wire observation matters because
warmup could otherwise reject a leaked input and hide the bug. These capture
callback intervals include CDP interaction/screenshots and are not the
performance gate; early skip evidence includes a 466.5 ms capture gap.
Final lightweight frame samples and the separate stress/hitch gates are
reported independently. Audio graphs do not establish listening approval.

Six offline production renderer/HUD fixtures pass: session57-fixtures-final-
{intro-arrival,intro-end,undertow-intro-arrival,switchyard-intro-arrival,
intro-short,intro-narrow}.png and report.json. Actual existing geometry,
11 fixture operators, no room/network. 1920x1080, 1280x600 and 390x844 layout
checks verify fit, title/countdown separation, connection visibility, hidden
reticle and no CSS animation. Reviewed all three map introductions and narrow
and short layouts. Full-width Relay/Undertow/Switchyard: 88/78/77 calls,
133920/135036/152407 triangles, 63.9388/60.5221/61.8555 texture MiB,
33/26/27 prepared programs; median 6.9/7.0/6.9 ms. Still fixtures are not
claimed as bot encounters or evidence of full-route traversal quality.

Rejected intermediates: the initial quaternion test compared a camera's change
callback with an unbound clone; now compares its actual quaternion values.
The first narrow fixture exposed connection-label overlap and intentionally
failed readiness; moved the connection panel above the briefing and reran all
six fixtures successfully. Initial pose telemetry shallow-copied the reusable
pose, making moving samples appear identical; the inspector now snapshots
that value at observation. Final normal/reduced sequences supersede that
telemetry. No production allocation or gate threshold was added to fix it.
Original first/fixtures/wow/reduced reports are retained as intermediate
evidence; only the named final/verified reports are acceptance evidence.

Matched combat render evidence: session57-before-report.json ->
session57-final-report.json; session57-render-summary.json. Same 1920x1080,
balanced/DPR 1, Edge 152, RTX 5070/D3D11; 11 remotes plus local, 145 twelve-rifle
volleys, 96 blasts, two-team support fixtures and three seconds of drain.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls | 238 | 238 | 0 |
| Peak submitted triangles | 150102 | 150102 | 0 |
| Resident textures | 30 | 30 | 0 |
| Estimated texture MiB | 63.9388 | 63.9388 | 0 |
| Median/p95/p99 frame ms | 6.9/7.1/7.2 | 6.9/7.1/7.1 | 0/0/-.1 |
| Maximum frame ms | 7.3 | 7.8 | +.5 |
| First-ready maximum ms | 7.0 | 7.1 | +.1 |
| Prepared programs/geometries | 33/165 | 33/165 | 0/0 |

Construction 92 -> 85.5 ms; preparation 1096.4 -> 1067.9 ms; 484 slots unchanged.
Cache/order varies; no startup speedup claimed. Effects drain; unchanged
240-call/64-MiB/32-texture limits pass. No owned test, bake or other inspection
browser overlapped these performance samples. Local RTX results do not
establish laptop iGPU 60 fps, cold-driver/thermal, real 6v6/RTT or other-browser
acceptance. No networking latency/capacity claim is made.

Public 32,882,326 -> 32,912,196 bytes (+29,870); assets 26,298,891 unchanged;
client 2,040,035 -> 2,050,655 (+10,620); source map 4,542,792 -> 4,562,042
(+19,250). Largest file remains Switchyard architecture 7,184,816 bytes.
40 MiB public/25 MiB per-file limits pass without exception. Exact bytes in
session57-bytes.json; no new public asset, texture or allowlist entry.

Static references refreshed through tools/reference-audit.ts in
session57-reference-audit.json. Maps stay 150x100 m/1250 m2 per seat;
Relay 65 full/46 waist, Undertow 52/62, Switchyard 63/48. Sprint A-B/B-C/A-C
proxies 14.44/14.44/11.78, 14.22/14.22/11.33, 14.44/14.44/11.56 seconds.
ADS 250/200/225/400/165 ms and sprint recovery 120/100/130/150/90 ms; 3-second
respawn and scoring, hostile foley 1.4, hit/kill pips, two damage cues and
five-row top-right feed retained. DOM 4/8-second capture, one point/2 seconds
per flag, no side swap, and 78 hip FOV still miss their references. Session 52
contact/heatmaps remain pacing evidence; no new contact/fairness claim here.

Open owner questions/defaults: short optional flight within warmup (yes),
cut directly to the actual operator before final countdown (yes), static
Reduced motion (yes), no repeat after pause/rematch on the same connection
(yes). Defaults active; no answer blocks continuation. Human excitement,
orientation, listening, moving hands, real 6v6/RTT, iGPU and browser/device
acceptance remain open.

Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS with zero console errors and forbidden offline requests.
Evidence: session57-required-report.json/log and required-{relay,practice-two}.png.

Final exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first Session 57 run. Two bot-caused
deaths, zero shader recompiles, zero frames over 150 ms, zero console errors
and zero long tasks. One frame over 24 ms, at 25.6 ms; profiler setup 90.6 ms
is separately reported by the unchanged probe. Normal 12-seat TDM, 17:22 at
stop; no room isolation, forced death, HP/clock edits, route changes or storage
reset. Evidence: session57-hitch.json/log and hitch.json. All six required gates
are green. The six final/verified inspector reports are error-free and opened
no forbidden offline gameplay connections; session57-report-checks.json.

Cleanup verified all 12 owned preview-tree processes stopped, zero 8796
listeners, zero remaining owned processes and zero inspection/hitch browsers.
Root creation time/command and each descendant's creation time/command were
verified before stopping. Evidence: session57-preview-tree.json and
session57-cleanup.json. git diff --check clean; all working-tree paths are
within apps/ironsight/**. No commit, push or deploy. Deployment 2/2 is complete
by default; continue with the re-ranked encounter-fairness arc.

### Session 58 - 2026-09-10: Flank and Counter arc 1/1 - get behind them, earn the ambush

Read the standing brief, Session58 supervisor status, plan and all63 design
references. Supervisor confirms Session57 passed, commit423d156, preview
deployment9c3f180a-b645-4fdf-96d4-98a5c95682d3. Picked the top encounter-fairness
gap and completed Flank and Counter1/1 ON by default. Re-ranked all63 scorecard
rows/gaps: distinct bot roles and deliberate flank routes are the next playable
arc; measured contact pacing remains unmet. Branch ironsight-aaa; scope
apps/ironsight/** only. No commit, push, deploy, dependency or purchased-asset edit.

Reference: R-L11, R-M05, R-M07, R-M12, R-M20, R-L14, R-L16, R-L17.
Targets: silent rear approaches cannot trigger360-degree bot acquisition;
investigating gunfire never grants a through-cover target; keep current HP,
damage, accuracy, reaction delay, weapon gates and collision. Reward an explicit
rear opening with server-confirmed recognition, no score boost or extra panel.
Implementation targets pass. R-M07's20-30s contact target does NOT pass on
Relay/Switchyard; the paired data does not support a pacing improvement.

Combat bots now acquire within a120-degree horizontal cone and retain visual
tracking within160degrees. All look turns, including patrol/objective search,
are bounded to6rad/s (pitch4rad/s); movement remains directed toward the same
navigation waypoint while the bot looks elsewhere. The broader tracking cone
reduces edge flicker but does not see behind. Lost visual contact resets reaction;
newly seen enemies still wait the existing configured150ms before firing, and
the existing aim-settled, ammo/cadence/handling and server hit checks remain.

An accepted hostile shot supplies a copied location if within28m in the open or
10m through current cover. Current hit boxes include ramp barriers and core
shutters. The point lasts1250ms in the bot's simulation clock, with250ms sound
refresh spacing. Confirmed victim damage can override that spacing and points
toward the actual damage source, including blast/support origins. A bot without
a visible target looks toward this frozen point while retaining its route; the
point contains no target id, is never updated by source movement, and cannot
authorize fire. A real visual acquisition clears old sound memory. Spawn clears
sound, target lock, reaction accumulation and engagement anchor, including round
resets. Dead/ally listeners and rejected fire do not receive hostile-shot alerts.
Training showcase bots keep their mandated stationary, non-firing behavior.

AMBUSH makes a successful flank explicit. The opening must be the first gun
damage to a full-health victim, at least120degrees behind its current server
yaw and at least2m away horizontally. The same attacker must finish with a gun
within2500ms inclusive; a qualifying one-shot kill works too. The victim may
turn and respond after the opening. Classification uses current authoritative
poses, not the shooter's claim or a statement about what the victim perceived
at its rendered RTT. Existing per-victim assist history carries one optional
opening flag; its existing kill/spawn/leave cleanup owns the lifetime. Warmup,
support finishes, another killer and expired openings earn no medal. Scores,
streak earning and assist attribution are unchanged.

The existing kill event adds optional medal:'ambush'; older clients ignore it
and current clients accept its absence. ArenaSchema/stateVersion12 are unchanged.
Only the local killer's existing1800ms elimination notice shows teal AMBUSH,
victim name and FROM BEHIND / weapon / optional HEADSHOT. The ordinary kill cue
is reused. Remote/self kills do not show the medal; the next ordinary kill
replaces it and expiry clears it. No extra animation, HUD panel, audio download,
light, pass, texture, geometry or per-frame bake. Reduced motion retains the
same information. Meshy would not improve this behavior/recognition feature;
spend0, reported balance1530 unchanged.

Six new pure perception tests plus two room-delivery tests and eight ambush
rule/room cases. Coverage includes cone boundaries/tracking loss, silent close
rear approach, FFA equal-team targeting, cover/hearing range, copied/expired
sound, damage override, respawn reset, objective travel, unchanged practice,
forged noise, reload rejection, ally privacy, protected victims, rear/full-HP/
distance/yaw rules, exact2500ms finish, expiry, frontal/support/other-killer/
warmup exclusions and unchanged score. Updated two existing assertions to
reflect intentional behavior: rear targeting requires a heard shot, and a
navigation test checks world travel independently of the now-gradual facing.

Final pnpm typecheck, pnpm test, pnpm build:client and pnpm audit:assets PASS.
542passed,6existing/opt-in skips;66files passed/4skipped. Logs:
.inspect/session58-{typecheck,test,build,audit}-final.log. Subsequent changes
were inspection-driver/evidence/log work, not production gameplay or rendering.
No test timeout or gate threshold was relaxed.

Wow check: paired production-brain/render stills
session58-flank-before-relay.png -> session58-flank-after-relay.png, plus
session58-hud-match-combat.png -> session58-hud-match-combat-ambush.png.
The brain comparison runs the actual423d156 source read-only from git and the
current source with the same fixed enemy/observer positions in Relay's open
lane. Old360-degree acquisition fires at the silent rear observer in500ms;
current silent case has no target/fire throughout1000ms; current heard-gunfire
case turns and fires at550ms. These are fixed-position brain fixtures, not live
combat or a measured human flank window. Stills use the returned yaws. Reproduce
the data with node tools/perception-audit.mjs 423d156 session58; exact camera/
enemy/yaw parameters are in the two report JSON files.

Real earned-input sequence: session58-wow-final-report.json,
ambush-{arrival,behind,confirmed,cleared}.png under that prefix.20.009seconds in
a normal Relay training room, W-key collision-routed movement from(3,39) to
the reachable rear of IDLE near(13,39), normal4/sniper swap, ADS and mouse
headshot. Incoming room kill contains medal:'ambush'; own kills advance by1;
notice clears after its normal lifetime. No HP, position, clock, reward or VFX
writes. Training demonstrates the earned medal, not combat-bot awareness.
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
ambush --prefix session58-wow-review. Reviewed the paired actor stills, actual
earned notice and narrow HUD. Player sentence:
"I can get behind them, land the opening shot, and earn an AMBUSH for the finish."

Five offline production HUD fixtures in session58-hud-report.json: ordinary,
ambush, Reduced motion,390x844 narrow and1280x600 short. Remote/self suppression,
replacement, expiry, escaping, five-row capacity, fit and existing damage-cue
separation all pass. No new focus or input interception. All seven final/accepted
inspector reports have zero console errors and forbidden offline requests;
session58-report-checks.json. Offline stills are not natural combat evidence.

Natural combat evidence: session58-before-{166588,166589,166590}-bot-round.json
and matching after files/heatmaps. Twelve production bots, normal room clock,
scores, spawn protection, weapon rules, routes, support and core event. Perception,
look turning and old-life memory reset are the behavioral changes. Trajectories
diverge; lives are not individually paired. Each100ms sample retains unobserved
contacts as censored, never zero. Summary: session58-contact-comparison.json.

| Relay paired seeds | Before | After |
|---|---:|---:|
| Round seconds,166588/166589/166590 |212.6/220.8/213.8|199.9/217.8/201.8|
| Final red:blue scores |47:50/50:46/47:50|41:51/49:50/50:40|
| Pooled observed initial damage median |13.3s|13.3s|
| Pooled observed respawn damage median |11.6s|11.0s|
| Observed/censored respawn contacts |268/14|257/18|
| Observed respawn contacts under5s |8|8|
| Current core visitor counts by seed |1/2/2|1/2/2|

Medians use the lower empirical50th percentile, consistently on both sets;
do not compare them as identical statistics to older averaged-middle summaries.
The51 score is an existing same-tick/support/rally outcome, not a new score rule.
Three seeds cannot prove side fairness. Additional current-map smoke evidence:
session58-undertow-bot-round.json / heatmap, seed170684,300s,182:144,73kills,
initial/respawn observed medians17.6/22.5s,60observed/13censored respawn contacts.
Switchyard seed199356,300s,188kills,3.1/7.5s,180observed/5censored,49observed
respawn contacts under5s. All twelve FFA bots get8-21kills. These single rounds
show viable combat/objective flow, not a controlled cross-map improvement.
Contact pacing, camping, core utility and human6v6 fairness remain open.

Matched renderer evidence: session58-before-report.json ->
session58-final-report.json; session58-render-summary.json. Same1920x1080,
balanced/DPR1, Edge152, RTX5070/D3D11;11remotes+local,145twelve-rifle volleys,
96blasts, support fixtures and3s drain. The stress scene is unchanged; real
DOM medal flow is validated separately above.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls |238|238|0|
| Peak submitted triangles |150102|150102|0|
| Resident textures |30|30|0|
| Estimated texture MiB |63.9388|63.9388|0|
| Median/p95/p99 frame ms |6.9/7.1/7.1|6.9/7.1/7.1|0/0/0|
| Maximum frame ms |7.5|7.3|-.2|
| First-ready maximum ms |7.1|7.1|0|
| Prepared programs/geometries |33/165|33/165|0/0|

Construction85.6->86.3ms; preparation1076.2->1060.7ms;484slots unchanged.
Cache/order varies, no startup speedup claim. Effects drain and the unchanged
240call/64MiB/32texture limits pass. No owned test/bake/other inspection browser
overlapped either matched timing capture or the hitch gate. Local RTX results
do not establish laptopiGPU60fps, cold-driver/thermal, real6v6/RTT, other-browser
acceptance, networking latency or room capacity.

Public32,912,196->32,914,518bytes(+2,322); assets26,298,891 unchanged;
client2,050,655->2,051,558(+903); source map4,562,042->4,563,461(+1,419).
Largest remains Switchyard architecture7,184,816bytes.40MiB public/25MiB file
limits pass without exception. Exact accounting: session58-bytes.json. No new
public asset or allowlist entry; all changes use existing operators, cover,
weapons and UI materials.

Static references refreshed in session58-reference-audit.json. Maps150x100m /
1250m2 per seat; Relay65full/46waist, Undertow52/62, Switchyard63/48. Sprint
A-B/B-C/A-C proxies14.44/14.44/11.78,14.22/14.22/11.33,14.44/14.44/11.56s.
ADS250/200/225/400/165ms; sprint recovery120/100/130/150/90ms.3s respawn and
dynamic safety scoring, hostile foley1.4, hit/kill pips, two damage cues and
five-row top-right feed retained. DOM4/8s capture,1point/2s/flag,no side swap
and78hip FOV still miss their references. No new map geometry or asset bake.

Rejected intermediates: the initial bot navigation assertion assumed a fixed
facing frame; changed it to verify the same westward world vector while look
turns gradually. First browser ambush approach targeted(18,39), inside cover,
and correctly stalled atx13.6. Corrected only the driver's destination to the
reachable(13,39), preserving collision/nav/game rules. Original session58-wow.log
retained; wow-final supersedes it. No performance failure/retry this session.

Open owner questions/defaults:120degree forward acquisition and160tracking(yes);
nearby gunshot/damage investigation, no omniscient rear target(yes); AMBUSH is
recognition only, no score/damage bonus(yes); current-pose classification rather
than a claim about victim perception(yes). Defaults active; no answer blocks
continuation. Bot personality/footstep investigation, human comfort/excitement,
real6v6/RTT, moving hands, iGPU and other-browser acceptance remain open.

Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS; zero console errors/forbidden requests. Retained
session58-required-report.json/log and required-{relay,practice-two}.png.
Final exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first Session58 run:2bot-caused deaths,
zero frames>24ms (therefore zero>150ms), shader recompiles, long tasks or console
errors. Profiler setup96.8ms reported separately by the unchanged probe. Normal
12seat TDM,11:11 at stop; no forced deaths, room isolation, route/HP/clock writes
or storage reset. Evidence: session58-hitch.json/log and hitch.json.

Cleanup verified the12-process owned preview tree has fully exited, zero8796
listeners and zero remaining inspection/hitch browsers. Root creation time and
command checked; each still-live descendant's identity rechecked before stopping.
Five processes explicitly stopped, remaining children exited with their parents.
Evidence: session58-preview-tree.json, session58-cleanup.json. All six required
gates green. git diff --check clean; all changed paths within apps/ironsight/**.
No commit, push or deploy. Flank and Counter1/1 is complete by default.

### Session 59 - 2026-09-10: Fireteam arc 1/2 - rushers, anchors and scoped scouts

Read the standing brief, Session59 supervisor status, plan and all63 design
references. Supervisor confirms Session58 passed, commit3c1008f, preview
deployment4e7bb34f-91e1-41d4-aebb-5618123df7c7. Picked the top role/route gap.
Fireteam1/2 is playable and ON by default; Session60 should complete2/2 with
deliberate flank routes. Updated the63-row reference scorecard and re-ranked
the gap list using the current role/contact/lane evidence. Branch ironsight-aaa;
scope apps/ironsight/** only. No commit, push, deploy or new dependency.

Reference: R-L11, R-L16, R-G03, R-G09, R-G19, R-G20, R-M07, R-M20, R-L14, R-L20.
Targets: three readable weapon/behavior identities, unchanged health/damage/
perception/aim noise/reaction, collision-navigated visible-target approach,
bounded scoped holds, preserved objective priority and stationary practice.
Those implementation checks pass. R-L11 remains partial until deliberate
flanks/difficulty progression; R-M07 remains unmet. Existing sniper glint,
weapon flash, tracer, reload, audio and hit validation serve actual bot weapons.

RUSH holds the SMG and closes on a currently visible enemy until within9m,
following the existing GroundNavigator. At closer range it uses ordinary
combat strafing. ANCHOR keeps the AR and existing strafe behavior. SCOUT holds
the sniper; at>=14m it stands and requests ADS for2.5s, then strafes unscoped
for1.5s in a repeated retained-target-lock cycle. A new acquisition resets the
cycle/reaction; visual loss resumes patrol and releases ADS. Close targets
trigger ordinary strafing. The 2.5/1.5s window is an intent schedule, not a
guarantee of physical displacement through cover or across target switches.

DOM and Relay core assignments retain their existing movement priority over
role combat. A scout may settle only after it reaches its assigned objective;
its relocation strafe stays anchored on that objective, not the old lane.
No role pursues a hidden player's live coordinates: approach uses the enemy
returned by the existing FOV/range/cover filter. Sound memory is unchanged.
The room forwards ADS in its existing held input map, so normal shared ADS,
sprint recovery, accuracy, cadence, ammo, reload and server hits remain in force.
Hip fire is still allowed while acquisition settles. No HP/damage/accuracy buff.

Correction to Session58's prose: config/ironsight.config.ts actually sets
reactionMs=200 and aimNoiseRad=.045, with aimHeight=1.0. Session58's150ms was
the pure fixture's explicit setting, not the live config. This session changes
none of these values. The reference scorecard now states the actual config.

Paired numeric bot ids choose roles deterministically:1/2 RUSH,3/4 ANCHOR,
5/6 SCOUT, then repeat. A normally alternating empty12-seat team fill has
two of each per team. Human replacements/seat trimming can change that mix;
there is no forced rebalancing or human class restriction. The existing spawn
primary map restores each bot's role weapon on every respawn. Practice ids
retain their existing names, weapons and stationary non-firing showcase path.
The shared identity module labels existing killfeed, assists, death names and
rosters RUSH/ANCHOR/SCOUT plus seat number. No extra panel or role-state wire
field; ArenaSchema/stateVersion12 unchanged. Existing operator bodies/team
colours/weapon holds remain; dedicated role skins and barks are future work.

Eight role tests cover paired identities, malformed/human/practice ids,
navigated approach and9m boundary, hidden-target loss, configured reaction,
scope/move cycling and close-target release, all-role DOM/practice behavior,
objective-local relocation, full normal12-seat role distribution, respawn
loadouts, room ADS forwarding/release and warmup damage rejection. Existing
perception, combat, handling and lifecycle suites retained. Final exact
pnpm typecheck / pnpm test / pnpm build:client / pnpm audit:assets PASS:
550passed,6existing/opt-in skips;67files passed/4skipped. Evidence:
.inspect/session59-{typecheck,test,build,audit}-final.log. No test timeout,
shader/frame threshold, input limit or gameplay gate relaxed.

Wow check: session59-wow-report.json and roles-live-{0s,5s,10s,15s,20s}.png
under that prefix.20.474s in a normal Relay TDM, ordinary W-key navigation and
look toward a known map approach.11bots plus one human seat; no player/bot
position, health, clock, route, loadout, reward or VFX injection. Captured246
incoming server shot events:145AR,86SMG,15sniper; six confirmed kills include
all three role weapons. RUSH7 kills the observer with its SMG, followed by a
normal respawn. The live feed shows role names, weapon causes and assists.
Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
roles-before,roles-after,tdm --assert-roles --prefix session59-wow-review.
Player sentence: "The SMG rushers close in while the scouts cover them with sniper fire."

Reviewed the10s live fight,15s mixed-role feed and20s respawn captures, plus
session59-wow-roles-before.png -> roles-after.png. The paired offline stills
use the same three production operators/camera: prior all-AR loadouts versus
current shared role weapons. They illustrate held-model differences; they
are not a staged live duel or proof of coordinated teamwork. The real20s
sequence and natural rounds demonstrate actual firing/behavior. Capture
intervals include CDP/screenshots and are not performance measurements.
All four accepted inspector reports have zero console errors and forbidden
offline gameplay requests; session59-report-checks.json. No human excitement,
listening, silhouette or moving-hands acceptance is claimed.

Natural-round evidence: session59-after-{166588,166589,166590}-bot-round.json,
matching heatmaps/debug files and metric logs. Baselines are the retained,
accepted Session58-after reports with the same seeds. Twelve production bots,
full clocks/scores/spawn/weapon/support/core rules,100ms observation. The new
role/ADS/movement/coarse-lane counters are read-only. Reproduce each with
RELAY_METRICS=1, METRICS_SEED, METRICS_PREFIX and
pnpm exec vitest run test/relay-metrics.tool.test.ts; then
node tools/roles-audit.mjs session58-after session59-after session59.
Summary: session59-role-comparison.json. Trajectories diverge, so individual
lives are not paired; unobserved damage contacts remain censored, never zero.

| Relay matched seeds | Before | After |
|---|---:|---:|
| Round seconds166588/166589/166590 |199.9/217.8/201.8|186.3/197.6/211.6|
| Final red:blue scores |41:51/49:50/50:40|50:41/50:46/49:50|
| Pooled observed initial damage median |13.3s|12.9s|
| Pooled observed respawn damage median |11.0s|12.6s|
| Observed/censored respawn contacts |257/18|258/22|
| Observed respawn contacts under5s |8|3|
| Core visitors by seed |1/2/2|1/1/2|

Medians use the same lower empirical50th percentile. These samples do not
establish human spawn fairness or side balance. R-M07's20-30s target remains
missed despite the longer respawn median. Coarse alive-sample role telemetry:
RUSH19,594/19,798 moving(99.0%), ANCHOR17,360/21,358(81.3%),
SCOUT11,265/21,846(51.6%) and10,435ADS(47.8%). Pre-ended-frame sampled
kills/deaths:90/136,129/83,66/66 respectively. These are observational roles,
not equal-position duels or an accepted weapon balance comparison. The final
ended-frame kill can be absent from those sampled counters.

The key routing gap is now explicit: RUSH19,505/19,798 samples(98.5%) in the
central z33-67m third, ANCHOR14,946/21,358(70.0%), SCOUT18,784/21,846(86.0%).
All three have zero samples south of67m across these rounds. A coarse lane
band is not a full path audit, but this is enough to prioritize committed
flank routes over another cosmetic pass in Fireteam2/2. Do not claim the
existing shared patrol is already a deliberate flank implementation.

Other-map smoke: session59-undertow-bot-round.json/heatmap, seed170684,
300s,179:160,94kills, initial/respawn observed medians17.6/21.6s,
80observed/13censored respawn contacts. Switchyard seed199356,300s,190kills,
7.8/8.9s,181observed/8censored,50observed respawn contacts under5s.
One round per other map supports viable combat/objective flow, not a causal
improvement or pacing/fairness acceptance. Role-specific pathing in DOM/FFA
needs more coverage in the next arc session.

Matched renderer evidence: session59-before-report.json -> final-report.json;
session59-render-summary.json.1920x1080, balanced/DPR1, Edge152,
RTX5070/D3D11;11remotes+local,145twelve-rifle volleys,96blasts, two-team
support fixtures and3s drain. The unchanged all-rifle stress fixture provides
the matched baseline; actual mixed-weapon combat is covered by the live
sequence and required hitch probe, not mislabeled as this fixture.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls |238|238|0|
| Peak submitted triangles |150102|150102|0|
| Resident textures |30|30|0|
| Estimated texture MiB |63.9388|63.9388|0|
| Median/p95/p99 frame ms |6.9/7.1/7.1|6.9/7.1/7.1|0/0/0|
| Maximum frame ms |7.6|7.3|-.3|
| First-ready maximum ms |7.1|7.1|0|
| Prepared programs/geometries |33/165|33/165|0/0|

Construction88.5->85.6ms; preparation1033.3->1050.0ms;484slots unchanged.
Cache/order varies; no startup speedup claim. Effects drain; unchanged
240call/64MiB/32texture limits pass. No test/bake/other inspection browser
overlapped matched timing samples or the hitch gate. This desktop evidence
does not establish mid-laptop iGPU60fps, cold-driver/thermal, real6v6/RTT,
other-browser acceptance, networking latency or room capacity.

Public32,914,518->32,917,941bytes(+3,423); assets26,298,891 unchanged;
client2,051,558->2,052,572(+1,014); source map4,563,461->4,565,870(+2,409).
Largest remains Switchyard architecture7,184,816bytes.40MiB public/25MiB file
limits pass without exception. Exact accounting: session59-bytes.json. No new
asset, texture, geometry, light, render pass, dependency or allowlist entry.
Meshy spend0; reported balance1530 unchanged. Existing weapon/character/VFX
assets provide the visible role differences; no purchased derivative edited.

Static references refreshed in session59-reference-audit.json. Maps remain
150x100m/1250m2 per seat; Relay65full/46waist, Undertow52/62, Switchyard63/48.
Sprint A-B/B-C/A-C proxies14.44/14.44/11.78,14.22/14.22/11.33,
14.44/14.44/11.56s. ADS250/200/225/400/165ms; sprint recovery
120/100/130/150/90ms.3s respawn, dynamic safety scoring, hostile foley1.4,
hit/kill pips, two damage cues and five-row top-right feed retained. DOM4/8s
capture,1point/2s/flag,no side swap and78hip FOV remain reference mismatches.

Rejected intermediates: the first role test inherited the prior prose's150ms
assumption; corrected the assertion to the unchanged200ms config. The added
room ADS fixture initially aimed through Relay waist cover at z11 and rightly
did not acquire the target. Moved only the fixture to the legal open z2 aisle;
the game's perception/cover gates were preserved. Its failing full-suite log
is retained as session59-test-room-fixture-intermediate.log; final550passed
supersedes it. Added a separate DOM relocation regression to ensure an arrived
scout stays anchored on the objective. No performance failure/retry this session.

Open owner questions/defaults: RUSH SMG/ANCHOR AR/SCOUT sniper(yes),9m rusher
spacing(yes), scoped holds at>=14m with2.5/1.5s retained-lock cycle(yes), role
names in existing feed/rosters(yes), keep DOM/core assignments first(yes).
Defaults active; no answer blocks continuation. Next session should add routes,
not strengthen bots through health/damage buffs. Human excitement/comfort,
moving hands, real6v6/RTT, iGPU and other-browser/device acceptance remain open.

Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS; zero console errors/forbidden requests. Retained
session59-required-report.json/log and required-{relay,practice-two}.png.
Exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first Session59 run:2bot-caused deaths,
zero frames>24ms (therefore zero>150ms), recompiles, long tasks or console
errors. Profiler setup100.1ms reported separately by the unchanged probe.
Normal12-seat TDM,25:22 at stop; no forced deaths, room isolation, route/HP/
clock writes or storage reset. Evidence: session59-hitch.json/log and hitch.json.

Cleanup verified all12 owned preview-tree processes exited, zero8796 listeners,
zero remaining owned processes and zero inspection/hitch browsers. Root start
time/command checked; still-live descendants rechecked by creation time and
command before stopping. Five explicitly stopped, the rest exited with their
parents. Evidence: session59-preview-tree.json and session59-cleanup.json.
All six required gates green. git diff --check clean; all changed paths within
apps/ironsight/**. No commit, push or deploy. Fireteam1/2 is on by default;
complete its committed flank routes in the next session.

### Session 60 - 2026-09-10: Fireteam arc 2/2 - rush the flanks, return from the side

Read the standing brief, Session60 supervisor status, plan and all63 design
references. Supervisor says Session59 FAILED hitch and was NOT committed or
published; its changes were retained. Corrected the owner guide, re-reviewed
all63 scorecard rows and completed the prior top gap. Fireteam2/2 is playable
and ON by default. Branch ironsight-aaa; scope apps/ironsight/** only. No
commit, push, deploy, dependency or SDK/wire/stateVersion change.

First addressed the failed gate. Supervisor observed a313.6ms frame at93.132s,
zero recompiles/console errors/long tasks, and300of306 profile samples idle.
That evidence does not identify a game-code cause. Before editing production
code, ran the exact150000ms hitch probe on the retained Session59 build in
isolation: PASS,2bot-caused deaths, zero frames>24ms, recompiles, long tasks or
errors. Evidence: session60-hitch-baseline.json/log. No fake performance fix,
threshold relaxation, spike filtering, probe flag or added browser flag.
The supervisor failure remains recorded, not retroactively declared a pass.

Reference: R-L11, R-L16, R-M01, R-M07, R-M20, R-G19, R-G20, R-L14.
Targets: an authored reachable side route per rusher life, movement commitment
despite distant visible fights, bounded close-combat interruption/expiry,
preserved perception and objective priority, and natural use of BOTH sides.
These implementation/route checks pass. R-M07 remains unmet; difficulty
progression, human counterplay, excitement and fairness remain unaccepted.

Relay has six-point Cooling and Freight routes; Switchyard has North bus and
South service routes. MapDef owns these immutable ground coordinates. They
add no collision or art geometry. The existing GroundNavigator resolves each
step against the active collision state, including Relay shutters. Rushers in
paired seats1/2 select north;7/8 select south. Each spawn chooses the nearer
route end from its own position, so FFA uses actual spawn location rather than
team assumptions. Normal empty12-seat team fill gets a north and south rusher
on each team; human replacements can change that mix. No forced rebalancing.

A rusher visits the six points in order, with a1m arrival radius. It keeps
that movement when it sees a distant opponent while aiming/firing through the
same FOV, cover,200ms reaction,.045rad aim noise and shared weapon rules.
Within8m a visible threat gets ordinary role combat; once clear, the same
route resumes. Route completion or35s of live-brain time releases the bot to
ordinary combat/patrol; death resets it and spawn starts a new commitment.
An assigned Relay core objective cancels the remainder. DOM receives no flank
assignment and keeps capture priorities; training targets stay stationary.
No live hidden-player coordinates choose or update a flank. No HP, damage,
accuracy, reaction, movement speed, ammo, support or score buff.

Six new regressions cover distant-target commitment with normal fire delay,
hidden-target loss, close interruption/resumption, successive stages,
completion/timeout, spawn direction/reset, objective cancellation, stationary
training, actual room fill/loadout renewal and DOM exclusion. Both route
directions from every spawn on Relay and Switchyard are walked in0.12m steps
through the real navigator; every step checks standing capsule clearance
including ramps. Existing role/perception/weapon/lifecycle tests retained.
Final pnpm typecheck / pnpm test / pnpm build:client / pnpm audit:assets PASS:
556passed,6existing/opt-in skips;68files passed/4skipped. Logs:
.inspect/session60-{typecheck,test,build,audit}-final.log. No test failed.

Wow check: session60-wow-final-report.json and
session60-wow-final-roles-live-{0s,5s,10s,15s,20s}.png.20.433s of normal Relay
TDM after an ordinary W/aim approach to Freight. No position, HP, route,
clock, loadout or VFX injection.11bots plus the human seat.271incoming server
shots and12kills; sampled live SMG bots use both sides (160north/188south
observations, not independent bots). RUSH7 kills the observer in Freight;
the5s still clearly shows the moving enemy, SMG cause and normal respawn
countdown. The observer respawns and returns through the service lane;15s
also captures an earned UAV overhead,20s a natural hostile mortar warning.
Player sentence: "I can't ignore Freight anymore; an SMG rusher came around the side."
This is a design sentence, not a human testimonial. Review all five stills;
no human listening/comfort/excitement approval is implied.

Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
tdm --assert-flanks --prefix session60-wow-review. The driver walks toward
Freight before recording; small steering steps and key-up during screenshots
avoid overshooting navigation corners while CDP encodes images. Captures
measure neither frame performance nor a staged duel. Report has zero console
errors/forbidden offline gameplay requests. session60-wow-summary.json keeps
the counts. Initial session60-wow report passed behavioral assertions but its
15s still faced cover and failed visual review; retained, superseded by final.
Only the capture driver changed after that review, not game collision/rules.

Natural evidence: session60-after-{166588,166589,166590}-bot-round.json,
debug reports, heatmaps and routes.svg. Baseline is the retained, UNPUBLISHED
Session59-after reports with identical seeds. Twelve production bots, normal
clocks/scores/spawn protection/weapon/support/core rules; observations at100ms.
New routeSamples read physical rusher positions and active waypoint index
each1s. Route-dot overlays never connect respawns with invented path lines.
No route/position/HP/clock injection. Reproduce with RELAY_METRICS=1,
METRICS_SEED, METRICS_PREFIX and pnpm exec vitest run
test/relay-metrics.tool.test.ts, then node tools/roles-audit.mjs
session59-after session60-after session60 and node tools/flanks-audit.mjs
session60. Summaries: session60-role-comparison.json / flank-summary.json.

| Relay paired seeds | Before | After |
|---|---:|---:|
| Round seconds166588/166589/166590 |186.3/197.6/211.6|246.1/230.1/242.7|
| Final red:blue |50:41/50:46/49:50|48:50/50:46/50:49|
| Observed initial damage median |12.9s|17.1s|
| Observed respawn damage median |12.6s|13.7s|
| Observed/censored initial contacts |36/0|35/1|
| Observed/censored respawn contacts |258/22|264/24|
| Observed respawn contacts under5s |3|8|
| Core visitor counts |1/1/2|2/2/3|
| Rusher north/central/south samples |293/19505/0|6623/12389/6743|
| Rusher sampled kills/deaths |90/136|111/101|

Lower empirical50th percentile on both sets; censored contacts stay absent,
never zero. Divergent lives are not paired. Rushers' central fraction falls
98.5->48.1%;25.7% north/26.2% south. All three rounds physically reach stage5,
the far-side return leg, not a blanket claim that every route completes.
Rusher moving fraction99.2%; anchors85.7%,scouts54.8% and44.2%ADS. Sampled
anchor kills/deaths121/103,scout59/88; final ended-frame kill may be absent.
Not an equal-position weapon balance trial. Increased short respawn contacts
are explicitly unfavorable evidence; broader fairness/counterplay is next.

Other-map smoke: Undertow seed170684 remains300s,179:160,94kills,
17.6/21.6s initial/respawn,80observed/13censored respawns, exactly the retained
Session59 outcome because DOM was deliberately unchanged. Switchyard
seed199356:300s,183kills,5.5/7s,171observed/12censored respawns,43under5s
(prior190kills,7.8/8.9s,50under5s). All12FFA bots score4-25kills. Rusher
1s observations957total/946active,261north/413south, all route stages seen.
These single rounds support continued play and route use, not causal pacing
improvement or accepted side/role fairness. Reports/heatmaps/routes:
session60-{undertow,switchyard}-bot-round.json and corresponding artifacts.

Matched renderer: session60-before-report.json -> session60-final-report.json;
session60-render-summary.json.1920x1080,balanced/DPR1,Edge152,RTX5070/D3D11.
Same11remote+local,145twelve-rifle volleys,96blasts,support fixtures and3s
drain. This unchanged all-rifle fixture measures rendering; mixed-role live
combat is the separate wow/hitch evidence.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls/triangles |238/150102|238/150102|0/0|
| Textures/estimated MiB |30/63.9388|30/63.9388|0/0|
| Programs/geometries/instance slots |33/165/484|33/165/484|0/0/0|
| Median/p95/p99 ms |6.9/7.1/7.2|6.9/7.1/7.1|0/0/-.1|
| Maximum ms |7.3|7.3|0|
| First-ready maximum ms |7.0|7.1|+.1|

Construction86.4->86.8ms, preparation1064->1060.9ms. No startup speedup claim;
cache/order varies. Effects drain, unchanged240call/64MiB/32texture limits
pass. No test/bake/other inspection browser overlaps matched timing captures
or hitch. Desktop evidence does not establish mid-laptop iGPU60fps,
cold-driver/thermal,real6v6/RTT,other-browser acceptance or room capacity.

Public32,917,941->32,919,653bytes(+1,712). Assets26,298,891 unchanged;
client2,052,572->2,053,078(+506),source map4,565,870->4,567,076(+1,206).
Largest Switchyard architecture7,184,816bytes;40MiB public/25MiB file caps
pass without exception. session60-bytes.json. No new art/texture/geometry,
light/pass/dependency/allowlist entry. Meshy spend0,reported balance1530;
existing assets show the behavior. No purchased derivative edited.

Static63-reference review refreshed in session60-reference-audit.json.
Maps150x100m/1250m2 per seat,Relay65full/46waist,Undertow52/62,
Switchyard63/48; sprint A-B/B-C/A-C proxies14.44/14.44/11.78,
14.22/14.22/11.33,14.44/14.44/11.56s. ADS250/200/225/400/165ms,
sprint recovery120/100/130/150/90ms,3s respawn/dynamic spawn scoring,
hostile foley1.4,hit/kill pips,two damage cues,five-row top-right feed retained.
DOM4/8s capture,1point/2s/flag,no side swap and78hipFOV remain mismatches.

Rejected intermediates: first wow capture's wall-facing still as described
above. No production/test intermediate failed. The previous supervisor hitch
was not reproducible in the isolated unchanged baseline; retain uncertainty
instead of editing unrelated render/game code. No shader/frame threshold,
input limit or gameplay gate relaxed, no storage reset or forced deaths.

Open owner questions/defaults: one north/south route per rusher life(yes),
35s commitment bound and<8m close-threat release(yes),fixed map knowledge
rather than hidden-player pursuit(yes),DOM/core priorities(yes),no combat stat
buffs(yes). Defaults active; no answer blocks continuation. Human excitement,
counterplay,6v6/RTT,moving hands,iGPU and other-device acceptance remain open.

Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS,zero console errors/forbidden requests. Copies:
session60-required-report.json/log and required-{relay,practice-two}.png.
Exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first final-candidate run:2bot-caused
deaths,zero>150ms frames,recompiles,long tasks or console errors. Normal12-seat
TDM,17:27 at stop. No forced deaths, isolated test room, route/HP/clock writes
or storage reset. Evidence: session60-hitch-final.json/log and hitch.json.

Final hitch has TWO frames>24ms:108.1ms at a death and25.8ms later. The death
window has98of107 CPU samples idle; no shader change or long task. Report this
residual honestly: the150ms gate passes, but the previous314ms supervisor
stall's cause remains unidentified and this is not proof of universally smooth
death delivery. Profiler setup100.3ms is reported separately by the unchanged
probe. No retries to erase either frame or weaken its threshold.

Cleanup verified all12 owned preview-tree processes exited,zero8796 listeners,
zero remaining owned processes and zero inspection/hitch browsers. Root and
descendant creation times/commands rechecked before stopping. Five explicitly
stopped,the rest exited with parents. Evidence: session60-preview-tree.json,
session60-cleanup.json and reproducible cleanup.ps1. The initial cleanup guard
aborted before stopping anything because ConvertFrom-Json had already parsed
the recorded date; corrected the guard to compare native UTC DateTime values.
All six required gates green. git diff --check clean; all changed paths within
apps/ironsight/**. No commit,push or deploy. Fireteam2/2 is complete by default.

### Session 61 - 2026-09-10: Contact and Counter arc 1/1 - the squad calls contact

Read the standing brief, Session61 supervisor status, current plan and all63
reference principles. Supervisor confirms Session60 passed and was published
(commit aa58dce, deployment d50d629f-92b8-40fc-8e5f-9182d102b969); corrected
the owner guide. Selected the prior top gap's readable flank counterplay.
Contact and Counter1/1 is complete, playable and ON by default. Re-reviewed
all63 scorecard rows and re-ranked the gap list; Undertow's signature event
is next. Branch ironsight-aaa, scope apps/ironsight/**, no commit/push/deploy.

Reference: R-L08, R-L11, R-L14, R-L16, R-M07, R-M20.
Targets: reports only from sustained actual visual acquisition, bounded team
radio traffic, explicitly stale location rather than tracking, nearby allies
only, manual player intent first, full info under mute/Reduced motion, no
stronger bots. These implementation checks pass. R-M07's20-30s engagement
band is still missed; human counterplay, excitement and fairness remain open.

A bot holding the same visible enemy for600ms may issue a CONTACT report.
The helper rechecks the existing facing/range/active-cover predicate against
that lock; hearing memory is never a report source. The room permits only
live TDM/DOM and sends only to living allies within50m of the report. The
payload is a1m-rounded frozen x/z plus caller id, kind, expiry and an optional
contact flag; no enemy id, live tracking, player outline or stored replay.
It expires3s after sampling, including if the target moves or the caller dies.
Team budget is one/8s, individual caller one/16s across lives. Departure
removes the caller entry; round reset/disposal clears runtime budgets. No
persisted state or codec shape/version changes; existing clients can render
the additive teamPing payload as their ordinary enemy-location mark.

A valid human ping defers bot radio for its five-second lifetime. The client
also lets any unexpired manual mark own the existing notice, while the bot
snapshot can still draw a diamond. Contact text identifies the actual role
and caller, map lane, view-relative AHEAD/LEFT/RIGHT/BEHIND, distance to the
frozen mark and explicit LAST SEEN age. Turning changes the direction to that
same mark, never its coordinates. Relay blackout retains text and expires
pings normally while the map is unavailable, consistent with manual pings.
Dead/paused/disconnected/inactive clients reject new notices; the existing
update clears old markers. Training completion still requires an own manual
server echo; training and FFA have no bot reports.

A quiet620/830Hz radio ident uses the existing master volume/mute/limiter.
Two oscillator/gain pairs finish within240ms of scheduling; nodes disconnect
on ended. It is a radio notification, not fake positional enemy sound or
synthesized speech. Reduced motion retains identical information. No extra
light, render pass, texture, geometry, dependency or asset. No bot consumes
these reports: no path, reaction, aim noise, HP, damage, loadout, score or
support changes. The source consumes no gameplay random numbers.

Twelve new regression cases cover sustained sight and frozen rounding,
cover/rear/range/dead/friendly/hearing/FFA/training rejection, team/caller
cooldowns and manual deferral/reset, real room nearby/living/allied routing,
mode/phase exclusion, forged contact rejection and wrapped relative direction.
Final pnpm typecheck / pnpm test / pnpm build:client / pnpm audit:assets PASS:
568passed,6existing/opt-in skips;69files passed/4skipped. Logs are
.inspect/session61-{typecheck,test,build,audit}-final.log. No failing test.

Wow check: session61-wow-final-report.json and
session61-wow-final-roles-live-{0s,5s,10s,15s,20s}.png, plus contact-0/1.png.
20.760s normal Relay TDM with ordinary W/aim navigation toward the central
approach:11bots+human,284received shots,5kills, two actual allied reports
8.039s apart (ANCHOR4 then RUSH2). Four radio tones end cleanly, maximum
observed scheduled-to-ended interval240ms. No position/HP/clock/route/VFX
injection, forced death or isolated matchmaking. The player approaches cover
while the teammate's report points ahead; the location ages visibly.
Player sentence: "My squad called contact, so I knew which corner to watch."
This is a design sentence, not a human testimonial or listening approval.

Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
tdm --assert-contacts --prefix session61-wow-review.
The probe saves20s of natural samples/events and captures at0/5/10/15/20s,
plus observed contact moments. On the first report it resizes through1366x768
and800x600 and verifies the live card stays inside the viewport and above
vitals. These captures are not frame-performance measurements. Evidence:
contact-1366x768.png/contact-800x600.png and layouts in the report.
A separate20.703s run with --intro-reduced --contact-muted retained a natural
RUSH8 / FREIGHT / LEFT /49m report:178shots,7kills,zero radio oscillators.
Three viewport sizes were visually reviewed. Files use
session61-contact-muted-*; session61-wow-summary.json keeps both runs.
All reports have zero console errors or forbidden offline network requests.

Natural evidence: session61-after-{166588,166589,166590}-bot-round.json,
debug reports, heatmaps and route overlays. Exact same twelve-bot production
rounds as published Session60, with normal clocks/spawn protection/weapon/
support/core rules. Before/after role summaries are identical, including
scores48:50/50:46/50:49 and lengths246.1/230.1/242.7s,2/2/3core visitors.
Observed initial median17.1s (35observed/1censored), respawn13.7s (264/24),
8respawn contacts under5s. Lower empirical50th percentile; censored contacts
stay absent, never zero. This verifies unchanged bot-only outcomes, not a
human response to radio information. R-M07 and spawn fairness stay open.

Undertow seed170684 repeats300s,179:160,94kills,initial17.6s/respawn21.6s,
80observed/13censored respawn contacts. Switchyard seed199356 repeats300s,
183kills,5.5/7s,171/12respawns and43under5s; FFA radio is disabled. Reports
and heatmaps: session61-{undertow,switchyard}-bot-round.json and counterparts.
Reproduce via RELAY_METRICS/UNDERTOW_METRICS/SWITCHYARD_METRICS=1,
METRICS_SEED and METRICS_PREFIX with the corresponding *-metrics.tool.test.ts;
then node tools/roles-audit.mjs session60-after session61-after session61 and
node tools/flanks-audit.mjs session61. No new broader-sample fairness claim.

Matched renderer: session61-before-report.json -> session61-final-report.json;
summary session61-render-summary.json.1920x1080,balanced/DPR1,Edge152,
RTX5070/D3D11. Identical roles-effects-stress fixture,11remotes+local,
145twelve-rifle volleys,96blasts,two-team support and3s drain. This fixture
measures rendering; the live capture/hitch separately exercise bot radio.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls/triangles |239/149146|239/149146|0/0|
| Textures/estimated MiB |30/63.9388|30/63.9388|0/0|
| Programs/geometries/instance slots |33/165/484|33/165/484|0/0/0|
| Median/p95/p99 ms |6.9/7.1/7.1|6.9/7.1/7.2|0/0/+.1|
| Maximum ms |7.4|7.8|+.4|
| First-ready maximum ms |7.1|7.0|-.1|

Construction87.9->84.5ms,preparation1146.6->1032.2ms. No startup speedup
claim: cache/order varies. Effects drain; unchanged240call/64MiB/32texture
limits pass. No other inspection browser/test/bake overlapped matched timing
samples or final hitch. Desktop evidence does not establish mid-laptop
iGPU60fps,thermal/cold-driver,real6v6/RTT or other-browser acceptance.

Public32,919,653->32,925,922bytes(+6,269),assets26,298,891 unchanged.
Client2,053,078->2,055,061(+1,983),source map4,567,076->4,571,362(+4,286).
Largest remains Switchyard architecture7,184,816bytes;40MiB public/25MiB file
caps pass. session61-bytes.json; reproduce summaries with the retained
.inspect/session61-summarize.mjs. No allowlist/provenance change, Meshy spend0,
reported balance1530 unchanged. The chosen feature uses existing assets.

Static reference measurements refreshed in session61-reference-audit.json:
150x100m/1250m2 per seat; Relay65full/46waist,Undertow52/62,Switchyard63/48;
sprint A-B/B-C/A-C14.44/14.44/11.78,14.22/14.22/11.33,14.44/14.44/11.56s.
ADS250/200/225/400/165ms,sprint recovery120/100/130/150/90ms;3s respawn,
dynamic safety scoring,enemy foley1.4,hit/kill pips,two damage cues and
five-row top-right feed remain. DOM4/8s capture,1point/2s/flag,no side swap
and78hipFOV remain reference mismatches.

Rejected intermediate: the initial client presentation imported a timing
constant through the server radio module. Runtime code tree-shook, but the
source map embedded unrelated bot source (public32,954,436bytes). Moved the
shared constant to the already-shared ping module, removing28,514bytes
without changing behavior. Rebuilt and reran typecheck/full tests/build/audit.
Initial wow capture passed; final adds responsive geometry checks and a
second caller. No failed test, relaxed budget, probe threshold, storage reset,
art dependency or forced-death workaround was introduced.

Open owner questions/defaults:600ms observation(yes),one/team/8s and
one/caller/16s(yes),50m recipient radius and3s snapshots(yes),manual ping
priority(yes),radio ident plus readable text before voiced barks(yes),no
bot consumption/stat buff(yes). Defaults active; no answer blocks progress.
Human excitement,radio comfort,flank/spawn counterplay,6v6/RTT,iGPU,other
browsers and moving hands/holds remain open.

Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS with zero console errors and forbidden requests.
Retained session61-required-report.json/log and required-{relay,practice-two}.png.
Exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first final-candidate run: two
bot-caused deaths,zero frames>24ms (therefore zero>150ms),shader recompiles,
long tasks,console errors or spikes. Normal12-seat TDM,9:12 at stop; no
forced death,isolated room,HP/clock/route writes or storage reset. Profiler
setup100.7ms is reported separately by the unchanged probe. Evidence:
session61-hitch-final.json/log and hitch.json. Session60's idle-dominant
108ms death frame/prior314ms supervisor stall are not reproduced here;
this passing sample does not identify or resolve their underlying cause.

Cleanup verified all12 owned preview-tree processes exited,zero8796
listeners,zero remaining owned processes and zero inspection/hitch browsers.
Creation times and command lines rechecked before each stop; five processes
explicitly stopped and the rest exited with their parents. Evidence:
session61-preview-tree.json,session61-cleanup.json and cleanup.ps1.
All six required gates green. Final diff check clean and every changed path
inside apps/ironsight/**. No commit,push or deploy. Contact and Counter1/1
is on by default; the next ranked arc is Undertow's signature world event.


### Session 62 - 2026-09-10: Pressure Drop arc 1/2 - Undertow opens the sluices

Read the standing brief, Session62 supervisor status, current plan and all63
reference principles. Session61 FAILED the supervisor hitch gate and was not
published; its Contact and Counter work remains in this candidate. Corrected
the owner guide. First ran the unchanged exact hitch command with a separate
evidence filename: PASS, two natural bot-caused deaths, no frames>24ms, shader
recompiles, long tasks or console errors. Evidence: session62-hitch-before.json
and log. The supervisor's217.2ms first measured frame, with202/212 idle CPU
samples, did not recur. This does not identify or fix its cause. No probe code,
sampling clock, threshold, profiler setup, gameplay rule or storage was altered
to obtain that result. Continued after the requested failing gate was green.

Reference: R-M05, R-M08, R-M12, R-M14, R-G14, R-L12, R-L14, R-L16.
Targets: one shared, unforgeable map-event schedule; eight-second warning;
first-five-minutes visual payoff; all exterior geometry outside playable
collision; unchanged radar/UAV; fixed resource counts and readable mute/reduced
motion. These checks pass. R-M05/R-M14 remain PARTIAL because this session
has no route change. Pressure Drop is a TWO-session arc:1/2 is on by default;
Session63 must ship its collision-backed maintenance route before completion.

Undertow uses the existing replicated signalAt epoch (no codec shape change),
seeded30s after a live round starts, eight-second warning,15s discharge,3s
recovery,90s period. Warmup/ended states stop presentation; reset seeds a new
epoch. Reconnect and late joins seek absolute pose, never integrate a new cycle.
Relay retains its exact schedule and blackout. Explicit map checks now protect
both client support HUD and server UAV scheduling from treating Undertow's
active phase as radar loss. The internal shared phase label remains blackout;
Undertow presents DISCHARGING and keeps radar online. Client/Worker should be
rebuilt together and old tabs refreshed: an older client would label Undertow's
new nonzero epoch as a Relay event. No state-shape version bump is required.

Original procedural twin lift towers flank the north intake crown. Ribbed
sluices rise10m over3s;24 shaded opaque water ribbons and24 pooled foam pieces
discharge behind the boundary wall, then drain and lower. Five draw objects,
five geometries,50instance slots, no texture, light, shadow update, extra render
pass or dependency. Geometry/materials/instance colours are created once and
the existing hidden preparation pass compiles/submits all slots before play.
All solids and every active instance remain beyond z=-2m throughout two sampled
cycles. The future playable doors must come from map collision, not these meshes.
Reduced motion retains the exact gate travel and water presence; it removes
foam and stream-edge oscillation. No damage, current, displacement or map cover
change. No private-player data added to this public event.

The peripheral PA card announces standby/discharge/recovery, with an absolute
countdown. Sound uses the existing noise buffer/master/mute/limiter: shared
warning ident and one short water/servo graph. The real loop ended2449.6ms
after starting; all its nodes disconnect. Muted capture creates zero discharge
loops. No persistent water audio queue or repeated cue on late join.

Three new regression cases cover full-cycle exterior bounds/resource identity,
late-seek/reduced/drain behavior and real-room Undertow epoch/input/UAV behavior.
Existing signal-map coverage now expects Undertow's event and Switchyard's zero
epoch. Initial targeted16tests passed; final full suite571passed,6existing/
opt-in skips,70files passed/4skipped. pnpm typecheck, pnpm test, pnpm build:client,
pnpm audit:assets PASS; .inspect/session62-{typecheck,test,build,audit}-final.log.
No test failure, weakened assertion, new dependency or threshold change.

Wow check: session62-wow-final-report.json and
session62-wow-final-flood-{0s,5s,10s,15s,20s,recovery,standby}.png.
20.306s recorded inside a real private Undertow training room, reached by
ordinary W/aim navigation to the Clarifier viewing lane. Natural room clock,
warning and event, no HP/position/clock/route/VFX injection. Gates lift10m,
24water ribbons and24foam pieces appear, then all clear at standby; radar
stays online and the epoch remains constant. This is a live training sequence
and paired before/after stills, not a staged bot duel or performance sample.
Player sentence: "Those huge floodgates lifted and water came crashing down."
This is a design sentence, not a human testimonial or excitement acceptance.

Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
flood --prefix session62-wow-review. Muted/reduced companion uses --intro-reduced
--contact-muted (the latter sets the saved mute preference),20.242s:
session62-wow-reduced-*.png/report.json. It retains gate/water, zerofoam and
zeroaudio. Real recovery HUD fits800x600 and390x844 in both runs; these are
layout checks, not touch/controller support. Visually reviewed paired normal
stills and both narrow layouts; offline reduced fixture and full-cycle unit
tests also retain the same gate position. All reports have zero console errors
and forbidden offline gameplay requests. Source snapshots/summaries retained
in session62-summary.json; reproduce with .inspect/session62-summarize.mjs.

Matched Undertow rendering: session62-before-report.json ->
session62-final-report.json,1920x1080,balanced/DPR1,Edge152,RTX5070/D3D11.
Identical11remote+local fixture,145twelve-rifle volleys,96blasts,support and3s
drain. Final also traverses warning, first water/foam submission and recovery.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls/triangles |196/149556|201/150804|+5/+1248|
| Textures/estimated MiB |24/60.5221|24/60.5221|0/0|
| Programs/geometries/instance slots |26/152/549|29/157/599|+3/+5/+50|
| Median/p95/p99 ms |6.9/7.1/7.1|6.9/7.1/7.1|0/0/0|
| Maximum ms |7.3|7.4|+.1|
| First-ready maximum ms |7.1|7.1|0|

Construction72.1ms both, preparation986.3->1003ms; no startup speedup claim.
The three additional shader variants are prepared, not later recompiles.
Effects drain and unchanged240call/64MiB/32texture limits pass. No tests,
bakes or other inspection browser overlapped either matched timing capture
or the hitch probes. These desktop measurements do not establish the required
mid-laptop iGPU60fps, thermal/cold-driver,real6v6/RTT or other-device acceptance.

Public32,925,922->32,953,496bytes(+27,574): client2,055,061->2,064,901(+9,840),
source map4,571,362->4,588,076(+16,714),asset provenance README+1,020bytes.
Asset directory26,299,911bytes; binary art unchanged. Largest file remains
Switchyard architecture7,184,816bytes.40MiB public/25MiB file caps pass without
exception. All geometry is constructed only on Undertow; no new asset download
or allowlist change. Provenance/reproduction in public/assets/README.md.
Meshy spend0,reported balance1530; procedural geometry supports exact motion
and exterior bounds here. No purchased source/derivative edited.

Natural authority smoke: session62-undertow-bot-round.json,bot-debug.json and
bot-heatmap.svg. Seed170684, twelve production bots, normal300s DOM rules.
The COMPLETE parsed report exactly matches retained Session61's JSON data:
179:160,94kills, initial median17.6s(12observed/0censored), respawn21.6s
(80observed/13censored),four respawn contacts under5s. Lower empirical50th
percentile; censored contacts stay absent. It verifies no indirect bot/gameplay
change from the new epoch/UAV guard, not an improvement in pacing or fairness.
Reproduce: UNDERTOW_METRICS=1 METRICS_SEED=170684
METRICS_PREFIX=session62-undertow pnpm exec vitest run
test/undertow-metrics.tool.test.ts. No need to rerun unchanged Relay/FFA seeds.

All63-reference review refreshed in session62-reference-audit.json:
150x100m/1250m2 per seat; Relay65full/46waist,Undertow52/62,Switchyard63/48;
sprint A-B/B-C/A-C14.44/14.44/11.78,14.22/14.22/11.33,14.44/14.44/11.56s.
ADS250/200/225/400/165ms,sprint recovery120/100/130/150/90ms,3s respawn,
dynamic spawn scoring,hostile foley1.4,hit/kill pips,two damage cues,five-row
top-right feed retained. DOM4/8s capture,1point/2s/flag,no side swap and78hipFOV
remain reference mismatches. No human acceptance implied by static measurements.

Rejected intermediate: initial alternating bright/dark water looked like bars
in session62-visual-undertow-flood-active.png. Replaced with overlapping sheets,
closer instance colours and a baked per-vertex vertical tint; final live stills
show the continuous cascade. Kept the initial captures for comparison. No new
texture or shader-time procedural noise. Initial/final tests remained green.

Open owner questions/defaults: reuse30s/8s/15s/3s/90s schedule(yes), no radar
penalty(yes), cosmetic exterior water before the next session's route(yes),
occupancy-safe route with no water damage/current/forced movement next(yes),
quiet PA/short discharge rather than continuous combat-masking roar(yes).
Defaults active; no answer blocks Session63. Human excitement, headphone mix,
moving hands,6v6/RTT,iGPU and other-browser acceptance remain open.

Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS, zero console errors and forbidden requests. Retained
session62-required-report.json/log and required-{relay,practice-two}.png.
Exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first final-candidate run:
two bot-caused deaths, zero frames>24ms, shader recompiles, long tasks or
console errors. Normal12-seat TDM,14:14 at stop. Profiler setup99.2ms reported
separately by the unchanged probe. Evidence: session62-hitch-final.json/log
and hitch.json. No forced deaths, isolated matchmaking or gameplay-state writes.

Additional new-map hitch: same command with --mode=dom and a separate output,
session62-hitch-undertow.json/log, PASS: two natural deaths,29stable programs,
zero>150ms frames, recompiles, long tasks or console errors;54:54 at stop.
Two retained>24ms frames were25.1ms near first close actors and29ms later;
the former includes bone-transform work in CPU sampling. Neither sample is
discarded. Profiler setup105.6ms. Initial/supervisor stall uncertainty remains
open; no claim that these passing samples diagnose or eliminate every hitch.

Cleanup verified all12 owned preview-tree processes exited, zero8796 listeners,
zero remaining owned processes and zero inspection/hitch browsers. Creation
times and command lines rechecked before each stop; five stopped explicitly,
the rest exited with parents. Evidence: session62-preview-tree.json,
session62-cleanup.json and reproducible session62-cleanup.ps1.
All six required gates green. Final diff check clean; every changed path is
within apps/ironsight/**. No commit, push or deploy. Pressure Drop1/2 remains
enabled and the arc's required collision-backed route payoff is next.


### Session 63 - 2026-09-10: Pressure Drop arc 2/2 - cross beneath the pressure stack

Read the standing brief, Session63 supervisor status, current plan and all63
reference principles. Supervisor confirms Session62 passed and was committed
as5c7cb75/deployed00e28fe3; updated the owner guide accordingly. Selected the
previous top gap and completed Pressure Drop2/2, playable and ON by default.
Re-ranked all remaining gaps; encounter/spawn fairness is next. No owner answer
was needed and no commit, push or deploy was performed in this session.

Reference: R-M03, R-M04, R-M05, R-M12, R-M14, R-M20, R-G20, R-L11,
R-L14, R-L16. Targets: the same eight-second warning/15-second discharge opens
one useful two-ended route; minimum3m standing clearance; server-owned
collision, historical shot barriers, matching prediction; no crushing or forced
movement; real DOM use; unchanged10-15s objective rotations and render budgets.
Implementation/route checks pass. Human route quality, excitement and fairness
remain PARTIAL; contact pacing remains NOT YET. No reference target was relaxed.

The central14x20m pressure block retains its footprint, permanent side walls,
6m roof and solid14m landmark. A14x4x3m east-west maintenance gallery occupies
x68..82,z48..52. Two0.5m-thick shutters belong to the CLOSED map. On the real
server tick at discharge, CoreCollision removes only those doors; existing
movement/traversal, grenades/blasts, pings, visibility/spawns, audio-map selection,
client prediction and open/closed bot navigation consume the same state.
Analytic and hybrid hits rewind the discrete door history at both transitions.
No new wire field: existing coreOpen carries actual opening and occupied holds.
No incompatible state shape or version bump; existing onRestore starts a fresh
round. Client/Worker must ship together; old open tabs need refresh for the new
map and presentation. No SDK, transport, weapon or damage rule change.

Both exits stay open while a living player or grenade occupies the chamber or
its1.5m approach guard. No damage/current/teleport on closure. The existing
CoreGate also applies on Undertow; test cases now cover both real room types,
late seats, forged move fields, safe movement out, restoration and historical
analytic/hybrid shots. Standing sweeps at three lateral offsets, retained
walls/roof/stack, grenade reflection and bidirectional bot routing pass.
Shared panel renderer now reads the map's x-extents. Doors seek the replicated
state immediately; trim runners alone animate. Reduced motion preserves the
same door/collision information and stationary trim. Original sign atlas says
MAINTENANCE / TRANSIT and OPENS ON PRESSURE DROP; HUD explains the shortcut
and CLEAR TO SEAL holds. Undertow radar/UAV stay online throughout.

First natural DOM seed170684 opened all three cycles but had zero visitors;
its score/contact outcomes matched Session62. Rejected leaving the bots unaware
of the shortcut. Generalized the existing Relay volunteer mechanism to actual
map portals and enabled it for Undertow DOM: at most one nearby living bot per
team within45m volunteers at the public warning. It stages outside the door,
uses normal objective movement/combat to reach the far portal, then returns to
ordinary capture duties after crossing, death or closure. Other ten bots retain
DOM choices. No accuracy, HP, reaction, speed, weapon or target-visibility buff.
Shared Relay volunteer coordinates and selection remain equivalent.

Final pnpm typecheck / pnpm test / pnpm build:client / pnpm audit:assets PASS.
579passed,6existing/opt-in skips;70files passed/4skipped. Eight additional
cases relative to Session62, including parametrized room/prediction tests and
Undertow collision/volunteer checks. Evidence .inspect/session63-{typecheck,
test,build,audit}-final.log; initial targeted30tests also passed. No failing
full-suite test or weakened assertion. An intermediate typecheck between edits
caught the newly required sign arguments; all callers were updated before the
final checks. No dependency or probe threshold changes.

Wow check: paired real-room before/after stills in
session63-wow-final-core-{warning,opened,crossing,held,sealed}.png and report.
Player sentence: "The floodgates dumped the pressure, and I cut straight through
the machinery while the doors held for me." This is a design sentence, not a
human testimonial. Actual private Undertow training room, natural clock and
ordinary W/aim input; no position/HP/clock/route/VFX injection. Both doors open,
the player crosses to the centre, holds through recovery, exits east and sees
both seal. HP100 throughout and radar always online at each sampled stage.
This is paired before/after still evidence, not a20-second bot-video claim:
opening-to-exit drill17.856s, plus preceding approach/warning. Normal capture
and17.800s muted/reduced companion retain door/HUD information; reduced shows
zerofoam. Muting uses the saved master preference. No new audio synthesis;
Session62's discharge/PA graph remains. Human listening acceptance stays open.

Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots
 gallery --prefix session63-wow-review. Companion adds --intro-reduced
--contact-muted. Both reports have zero console errors/forbidden offline
requests. Real390x844 held HUD fits x16..366,y344..394 above vitals; normal
and reduced captures reviewed. Also reviewed offline matching closed/open and
inside shots in session63-visual-undertow-gallery-*.png. These layout/visual
captures do not establish touch/controller support or performance.

Re-baked Undertow permanent architecture and ground AO after the collision cut;
dynamic doors are excluded from both bakes. Source-to-GLB audit passes81,844
oriented triangles, finite UVs, no source/export degenerates and authored-normal
component error<=.000301. Geometry remains ten material primitives and one
1024-square AO image. Ground2048x1365 retains13.65source pixels/metre and the
existing runtime downsample/detail tile. Files: session63-{architecture,maps}.json,
bake logs and session63-architecture-audit.json. Reproducible commands and original
provenance appended in public/assets/README.md; existing allowlists apply.

Initial Blender invocation inherited local startup settings and failed finding
the default Principled node. Repeated with --factory-startup, then audited the
successful output. No Blender defaults or external files changed. No art was
accepted from the failed attempt. Meshy spend0, reported balance1530: this work
needs exact collider cladding, supplied by the original procedural kit.

Matched Undertow renderer: session63-before-report.json -> session63-final-report.json,
1920x1080, balanced/DPR1, Edge152, RTX5070/D3D11. Same11remotes+local,
145twelve-rifle volleys,96blasts, support and3s drain; final also exercises
warning/open/close and water submission. No tests, bakes or other inspection
browser overlapped the matched timing samples. Summary/reproduction:
.inspect/session63-summary.json and .inspect/session63-summarize.mjs.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls/triangles |201/150804|207/152200|+6/+1396|
| Textures/estimated MiB |24/60.5221|25/60.6055|+1/+.0833|
| Programs/geometries/instance slots |29/157/599|29/164/625|0/+7/+26|
| Median/p95/p99 ms |6.9/7.1/7.1|6.9/7.1/7.2|0/0/+.1|
| Maximum/first-ready maximum ms |7.3/7.1|7.4/7.1|+.1/0|

Construction74.6->78.5ms; preparation1041.3->987.6ms, no startup speedup claim.
Existing240call/64MiB/32texture limits pass, effects drain. No new light,
dynamic shadow, render pass or per-frame bake. Desktop evidence does not
establish mid-laptop iGPU60fps, thermal/cold-driver,real6v6/RTT or other browsers.

Public32,953,496->33,015,045bytes(+61,549), assets26,299,911->26,354,758(+54,847).
Undertow architecture6,347,488->6,394,324(+46,836); ground835,222->841,165(+5,943).
Client2,064,901->2,066,774(+1,873);source map4,588,076->4,592,905(+4,829);
provenance README+2,068. Largest remains Switchyard architecture7,184,816bytes.
40MiB public/25MiB file caps pass, with per-map loading and no budget exception.

Natural DOM evidence: session63-undertow[-170685/-170686]-bot-round.json,
matching bot-debug.json and bot-heatmap.svg. Full production12-bot rounds,
normal score/capture/respawn/support rules; no scripted route/HP/time shortcuts.
Seed170684 opening-only intermediate retained as session63-undertow-unrouted-bot-round.json.
LOS tool now uses current door/ramp hit boxes; contact timing below uses damage,
so the matched before/after damage measurement remains comparable.

| Seed | Length s | Score red:blue | Kills | Gallery visitors | Initial contact median s | Respawn contact median s | Observed/censored respawns | Respawn contacts<5s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|170684|283.9|200:104|103|1|17.6|17.0|92/11|9|
|170685|300.0|160:168|77|2|18.0|23.9|70/5|5|
|170686|261.9|200:95|80|3|17.6|23.3|69/11|1|

Initial observed/censored12/0,11/1,11/1. Lower empirical50th percentile,
unobserved contacts absent rather than zero. Same first seed before:300s,
179:160,94kills,17.6/21.6s initial/respawn and4sub-five-second respawn contacts.
This worsened pacing sample and two strong red wins are retained, not labeled
fairness improvements. At least one gallery visitor per seed, but few compared
to the whole lobby. Natural occupancy holds extend some openings to38.4/49.1/26.6s;
all sampled cycles subsequently seal. No forced eviction from the gallery.
Reproduce with UNDERTOW_METRICS=1, METRICS_SEED and METRICS_PREFIX, then
pnpm exec vitest run test/undertow-metrics.tool.test.ts. Broader matched-side/
spawn fairness and human event counterplay remain the next high-priority gap.

Static reference audit refreshed in session63-reference-audit.json:150x100m,
1250m2/seat; Relay65full/46waist,Undertow56/62,Switchyard63/48. Undertow
portal-to-portal sprint4.44->2.22s, A-B/B-C/A-C14.22/14.22/11.33s in BOTH
states; other maps' rotations unchanged. ADS250/200/225/400/165ms,
sprint recovery120/100/130/150/90ms,3s respawn, dynamic safety scoring,
hostile foley1.4, hit/kill pips, two damage cues and five-row top-right feed
remain. DOM4/8s capture,1point/2s/flag,no side swap and78hipFOV stay mismatches.

Open owner questions/defaults:14m gallery instead of water damage/current(yes),
15s scheduled opening with unlimited occupancy-safe hold(yes),both exits open
until clear(yes),one nearby volunteer/team then return to DOM(yes, review
fairness next),radar online and readable mute/reduced presentation(yes).
Defaults active; no answer blocks progress. Human excitement,headphone mix,
moving hands/holds,6v6/RTT,iGPU and Firefox/Safari acceptance remain open.


Required exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots
relay,practice-two PASS, zero console errors and forbidden offline requests.
Evidence session63-required-report.json/log and required-{relay,practice-two}.png.
Exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the first final-candidate run: two natural
bot-caused deaths, zero frames>24ms (therefore none>150ms), shader recompiles,
long tasks, console errors or spikes. Normal12-seat TDM,8:10 at stop;
profiler setup98.9ms reported separately by the unchanged probe. Evidence
session63-hitch-final.json/log and hitch.json. No forced deaths, isolated
matchmaking, gameplay-state writes or storage reset.

Additional new-map hitch with --mode=dom and separate output also PASS:
session63-hitch-undertow.json/log. Two natural deaths,48:41 at stop,29stable
programs, zero>150ms frames, recompiles, long tasks or console errors. One
retained92.1ms frame at23.951s; CPU sampling shows85/90samples idle, with
single samples in movement/instance colour/texture binding/update/loop.
Profiler setup100.7ms reported separately. This is unfavorable frame evidence,
not discarded or attributed to the gallery without proof. Earlier supervisor
idle-dominant stalls remain unexplained. No tests, bakes or inspection browser
overlapped either final hitch, and no probe budget or sampling logic changed.

Cleanup verified all12 owned preview-tree processes exited, zero8796 listeners,
zero remaining owned processes and zero inspection/hitch browsers. Rechecked
creation times/command lines before stopping each process; five explicitly
stopped, the rest exited with parents. Evidence session63-preview-tree.json,
session63-cleanup.json and reproducible session63-cleanup.ps1. Other existing
applications/processes were left running. All six required gates green; final
diff check clean and every changed path inside apps/ironsight/**. No commit,
push or deploy. Pressure Drop2/2 is complete and enabled by default.

### Session 64 - 2026-09-10: Breakout arc 1/1 - leave deployment behind cover

Read the standing brief, Session64 supervisor status, plan and all63 reference
principles. Supervisor confirms Session63 passed and was committed7f90230,
deployedac8f4d81; updated the owner guide. Selected the top encounter-fairness
gap and completed its bounded Undertow exit-safety action block, ON by default.
Re-ranked the gap list: Switchyard's signature event next, wider encounter/side
fairness still open. No owner response needed. No commit, push or deploy.

Reference: R-M03, R-M04, R-M07, R-M09, R-M10, R-M12, R-M20, R-L04,
R-L11, R-L14. Targets: break the observed exit firing line with full-height
cover; retain two exit directions per deployment and standing traversal to
every objective; retain10-15s objective rotations; reduce observed sub-five-
second respawn contacts without changing protection, bot difficulty or clocks.
The layout/early-contact targets pass in these fixtures and three matched
seeds. Universal20-30s pacing, side balance and human counterplay stay NOT YET /
PARTIAL. No reference requirement or performance threshold was relaxed.

Diagnosis first: extended the existing opt-in Undertow metrics tool with
arrival coordinates, living enemy positions/distances/current exposure, and
first-damage coordinates. These are read-only100ms samples, not exact-tick
spawn decisions. Unobserved contacts remain absent/censored, never zero.
All nine first-seed contacts<5s began at hidden red deployments aroundx3,
z39..47, then took damage nearx4..16,z21..27 after exiting north. The enemy
cluster was near the home court, often35-45m from the initially hidden spawn.
This evidence points to the exit firing line rather than exposed spawn choice.
Rejected changing the spawn scorer, shield, HP, damage or reaction timers.

Added four3m full-height machinery screens in UNDERTOW_ROWS: northx10..12 /
138..140,z20..26; southz74..80,joining existing pump returns. Twelve new2m
tiles create48m2 of cover; tile merging with the southern returns changes the
box count118->124 (56->62full,62waist unchanged). The existing kit clads the
same authoritative boxes. No decorative cover, new spawn point, scoring rule,
volunteer behavior, weapon, SDK or wire-shape change. Shared movement/prediction,
shots, grenades, visibility and bot navigation consume the map as before.
Client and Worker must ship together; old tabs need a refresh for the new map.

New regression fixture checks standing head/chest/both-shoulder rays at three
positions on each mirrored north/south exit, in BOTH gallery states. Existing
all-spawn-to-all-cap production navigator walks retain capsule clearance.
The central40m rifle corridor, waist/full classes, two deployment exits, ramps,
gallery and10-15s rotations pass. One new test initially called the collision
helper by the wrong method name; corrected to its existing boxes(open) API.
Final targeted10/10 and full580passed/6existing-or-opt-in-skipped,70files
passed/4skipped. No weakened assertion, dependency or gameplay test bypass.

Wow check: normal twelve-seat Undertow DOM,20.412s ordinary W/aim capture in
session64-wow-live-report.json and breakout-{0s,5s,10s,15s,20s,stage-*}.png.
The player reaches the screened opening at3.769s, the gap at6.046s, inner
peek at7.410s and home court at11.619s,HP100 at each stage. No firing,
placement, clock manipulation, altered bots or forced death. Reproduce:
node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom
--assert-breakout --prefix session64-wow-review. The inspector's new bounded
driver reads state for routing and uses normal input; production code exposes
no new probe/state-writing hook.

Player sentence: "I can slip behind the machinery and come out with my squad
instead of stepping straight into that firing line." Design intent, not a
human testimonial or proof of safety from every angle. Paired offline stills
session64-wow-before-undertow-home.png ->session64-wow-after-undertow-home.png
use identical camera5,1.65,26 looking at28,1.65,16 and fixed threat28,0,16.
The threat is visibly exposed before and fully occluded after; the inner-route
still session64-wow-peek-undertow-home.png and live stage1 were reviewed too.
Reproduce paired view with --shots undertow-home --review-camera
5,1.65,26,28,1.65,16 --review-enemy 28,0,16.
All final visual reports have zero console errors/forbidden offline requests.
No animation/audio/UI change; mute and Reduced motion retain identical cover.

Matched natural DOM evidence: session64-before-{170684,170685,170686} versus
session64-screen-{170684,170685,170686}, each with bot-round.json,
bot-debug.json,bot-heatmap.svg and execution log. The three baseline scores,
durations, contact distributions and gallery visitors reproduce Session63.
Normal300s/200point rules,12production bots; no shortened game or scripted
route. Lower empirical50th percentile, damage sampled100ms:

| Seed | Before -> final score red:blue | Final length s | Kills before -> final | Respawn median s before -> final | Contacts<5s before -> final | Final observed/censored respawns |
|---|---|---:|---|---|---|---|
|170684|200:104 ->161:161|300.0|103->82|17.0->20.1|9->0|72/8|
|170685|160:168 ->114:200|297.9|77->67|23.9->19.1|5->0|58/9|
|170686|200:95 ->201:81|251.9|80->71|23.3->24.1|1->0|60/11|

Baseline observed/censored respawns92/11,70/5,69/11. Initial contact medians
17.6/18/17.6 ->18.6/18.5/18.5s; final12observed/0censored each, baseline
12/0,11/1,11/1. Fewer total kills and two large side wins remain; the middle
respawn median worsens. Gallery visitors1/2/3 ->2/2/0: seed170686 now has no
visitor, an unfavorable event-engagement result retained for follow-up.
This proves a narrow sampled exit-safety improvement, not layout fairness,
population-wide pacing or human excitement. Reproduce with UNDERTOW_METRICS=1,
METRICS_SEED, METRICS_PREFIX and pnpm exec vitest run
test/undertow-metrics.tool.test.ts. Other maps' geometry/gameplay are unchanged.

Re-baked only Undertow ground AO and permanent architecture with Blender4.5
--factory-startup. Existing shutters excluded from bakes. Architecture audit:
86,236oriented triangles, zero source/export degenerates, finite UVs, ten
material primitives, one1024-square image, maximum authored-normal component
error.00030063. Ground2048x1365 retains13.65source pixels/m. Reproduction and
original provenance in public/assets/README.md; session64-{maps,architecture}.json,
session64-{ground,architecture}-bake.log and architecture-audit.json retained.
Meshy spend0,reported balance1530; exact collision cladding suits this work.
No purchased source/derivative or allowlist change.

Matched1920x1080 balanced/DPR1 Edge152/RTX5070/D3D11 rendering, same11remotes
+local,145twelve-rifle volleys,96blasts,support and3s drain,full Pressure Drop
cycle: session64-before-report.json ->session64-final-report.json.

| Metric | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls/triangles |207/152200|207/156592|0/+4392|
| Textures/estimated MiB |25/60.6055|25/60.6055|0/0|
| Programs/geometries/instance slots |29/164/625|29/164/625|0/0/0|
| Median/p95/p99 ms |6.9/7.1/7.1|6.9/7.1/7.2|0/0/+.1|
| Maximum/first-ready maximum ms |7.5/7.2|7.8/7.2|+.3/0|

Construction77->79.7ms, preparation1019.2->987ms; no startup speedup claim.
Unchanged240call/64MiB/32texture limits pass; effects drain. No new lights,
shadows, render passes or per-frame bakes. No tests,bakes or second inspection
browser overlapped either matched timing capture or hitch run. Desktop samples
do not establish mid-laptop iGPU60fps,thermal/cold-driver,real6v6/RTT or other
browser acceptance. Separate baseline one-actor still retained a194.6ms first-
ready frame; not hidden inside the favorable matched stress measurement.

Public33,015,045->33,356,264bytes(+341,219); assets26,354,758->26,695,799
(+341,041). Architecture6,394,324->6,721,420(+327,096); ground841,165->853,588
(+12,423); provenance README+1,522. Client2,066,774 unchanged; source map
4,592,905->4,593,083(+178). Largest remains Switchyard architecture7,184,816.
40MiB public/25MiB file caps pass with per-map loading and no exception.
Source summaries/reproduction: .inspect/session64-summary.json and
.inspect/session64-summarize.mjs. Static all63-reference audit refreshed:
150x100m,1250m2/seat; rotations14.44/14.44/11.78,14.22/14.22/11.33,
14.44/14.44/11.56s. ADS250/200/225/400/165ms,sprint recovery120/100/130/150/90,
3s respawn,hostile foley1.4,hit/kill pips,two damage cues retained.
DOM4/8s capture,1point/2s/flag,no side swap,78hipFOV and top-right feed remain
reference mismatches. Human acceptance is not implied by these static checks.

Open owner questions/defaults: symmetric permanent exit screens(yes),keep
spawn/weapon/bot stats unchanged(yes),accept fewer immediate exit contacts
without calling the whole map fair(yes),Switchyard event next(yes). Broader
spawn/side fairness, gallery usage, moving hands/holds,headphone/mouse comfort,
6v6/RTT,iGPU and Firefox/Safari remain open. No answer blocks continued work.

Required typecheck,test,build:client,audit:assets PASS; evidence in
session64-{typecheck,test,build-client,audit-assets}-final.log. Exact required
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS,zero console errors/forbidden requests; retained session64-required-report.json,
log and required-{relay,practice-two}.png.

First exact hitch gate FAILED:551.2ms frame at60.962s/second bot-caused death
in Relay; no shader recompiles,console errors or long tasks. CPU profile524of
533samples idle,remaining single samples in ingest/event/frame/matrix/audio/
uniform work. Preserved session64-hitch-first-failed.json/log. Relay runtime
and all combat/death code unchanged this session; geometry changes load only
on Undertow. Reviewed unchanged death transition/constant-light paths. This
does not identify or excuse the stall; prior supervisor idle-heavy failure
cause remains unresolved. Unmodified exact probe repeated for recurrence;
final gate outcomes and cleanup recorded below.

Final exact node scripts/hitch-probe.mjs http://localhost:8796 150000
.inspect/hitch.json --assert PASS on the unmodified second run: two natural
bot-caused deaths, zero frames>24ms, shader recompiles, long tasks or console
errors, normal12seat TDM,8:15 at stop. Profiler setup92.5ms separately reported.
Evidence session64-hitch-repeat.json/log, copied to session64-hitch-final.json/log
and retained as hitch.json. The first failure remains separately available;
no claim that a passing repeat diagnoses or eliminates the intermittent stall.

Additional Undertow --mode=dom run initially FAILED its two-death coverage
requirement: one natural death in150s,95:30 at stop,zero>150ms frames,
recompiles or console errors. Three retained>24ms frames67.1/82.9/26.1ms;
the82.9ms sample was76/80idle. Navigation samples show continuing movement
through B and toward C, not a blocked exit. Preserved as
session64-hitch-undertow-first-failed.json/log. Repeated unchanged150s probe
with no reset, forced death, isolated matchmaking or bot-stat change.

Final Undertow PASS: two natural deaths,34:31 at stop,29stable programs,
zero>150ms frames,recompiles,long tasks or console errors. One27ms frame at
25.05s includes bone/raycast work; retained rather than dropped. Profiler
setup103.9ms separately reported. Evidence session64-hitch-undertow.json/log.
Both required and supplementary final checks pass with original thresholds.

Cleanup verified all12 owned preview-tree processes exited,zero8796 listeners,
zero remaining owned processes and zero inspection/hitch browsers. Rechecked
creation times and command lines before stopping each owned process; five
stopped explicitly,the rest exited with parents. Evidence
session64-preview-tree.json,session64-cleanup.json and session64-cleanup.ps1.
Final diff check clean; every changed/untracked source path is inside
apps/ironsight/**. All six required gates green. No commit,push or deploy.

### Session 65 - 2026-09-10: Cargo Shift arc 1/2 - the east gantry carries its load

Read the standing brief, supervisor status, plan and all63 design-reference
principles in the requested order. Worked on ironsight-aaa, apps/ironsight/**
only. Retained Session64's uncommitted Undertow breakout cover, ground AO,
architecture, tests, inspector and log: the supervisor rejected its hitch gate,
so this session does not describe it as published. No commit, push or deploy.

Reference: R-M05, R-M08, R-M11, R-M12, R-M14, R-G14, R-L14, R-L16.
Checkable targets: an eight-second public warning,15s lift/carry/lower sequence
seeking the same pose from the replicated epoch on late join, no overlap with
permanent buildings, fixed GPU resources, readable muted/reduced presentation
and the original hitch assertions. These implemented stage1 checks pass.
R-M05/R-M14 remain PARTIAL: stage1 is exterior spectacle. Cargo Shift2/2 in
Session66 MUST add server-authoritative playable cover, matching prediction and
historical shots, safe occupied transitions and a real tactical choice. This is
an explicit two-session arc, not a claim that a decorative crane completes the
brief's cover-changing event. All63 scorecard rows and ranked gaps refreshed;
static audit is `.inspect/session65-reference-audit.json`. The final six required
gates below describe those captures, not universal hitch acceptance.

Supervisor hitch investigation began before game changes, then continued after
an extra FFA check disproved the initial hypothesis:

- The inherited probe starts500us V8 CPU sampling before measuring gameplay.
  On the unchanged game, its baseline reproduced270.6/259.2/321.3ms gaps.
  Callback/20ms-heartbeat diagnostics reproduced347.9/216.5ms gaps while game
  callbacks stayed below6ms and the heartbeat continued. No long task, console
  error or Three.js shader-cache change explained those gaps.
- Four early captures with tracing passed with no frame over24ms; three early
  unprofiled captures also reached two deaths with no frame over24ms. Moving
  profiling before the existing setup wait was rejected when its repeat failed
  440.4/598ms. An initial proposal to make sampling opt-in was then REJECTED:
  the extra final FFA capture, without sampling, failed431.8ms on its first frame.
  Removing CPU attribution did not fix the underlying stall. The final probe
  restores CPU sampling ON by default with its original500us interval.
- Added optional `--no-profile` control, `--trace` with selectable categories,
  and `--diagnostic-timing`. All original gate assertions remain: every frame is
  sampled; every >24ms record retained; ANY >150ms frame fails; Three.js shader
  cache-key additions/count changes after the SAME3s warm-up fail; two deaths
  and zero console errors are required. Driver, setup waits,150s maximum and
  browser flags remain unchanged. Diagnostic export follows the gameplay snapshot.
- Positive control: an ignored copy injected a220ms main-thread stall six seconds
  into an unprofiled control. It FAILED with one >150ms spike and a220ms long task,
  two deaths, no shader/error failures. No injection ships in the probe/client.
- Short8s FFA diagnostic traces finally captured GPU-process work overlapping
  the idle-heavy gaps. `ffa-startup-trace` records909.7/329.1ms gaps, with only
  14.24/7.027ms of renderer-main tasks in those windows; the first overlaps a
  728.287ms GPU scheduler task and671.307ms ANGLE worker task.
  `ffa-gpu-trace` records1829.3ms: Skia FinishPaintRenderPass waits1168.007ms
  on Program::MainLinkLoadEvent while GetPixelExecutableTask takes1167.893ms.
  These are browser GPU/raster/compositor paths, invisible to the Three.js
  program counter. ANGLE's corresponding executable tasks are defined in
  [its D3D program source](https://github.com/google/angle/blob/main/src/libANGLE/renderer/d3d/ProgramD3D.cpp).
- Rejected software-2D-canvas workaround: a short trace passed, but full-round
  radar-only and all-canvas controls still failed. Hiding the HUD also failed
  with1204.3ms overlapping a1201.272ms WebGL command-buffer flush. That rules out
  a HUD-only explanation. These variations remain ignored diagnostic scripts;
  no production canvas/CSS/GPU-backend workaround ships. A universal cause and
  reliable fix remain OPEN; this session does not claim that profiling removal,
  a later green run or stable Three.js counts resolve cold driver/GPU stalls.
- `scripts/hitch-trace-summary.mjs` streams large CDP traces twice, anchors
  measured windows to performance marks, marks incomplete coverage and reports
  overlapping threads/tasks. Its first real trace exposed a final-event/metadata
  trailer parse error; fixed that boundary and parsed the actual failing traces.
  Keep the full traces and failed reports, not just the top-task excerpt.
- Evidence: `.inspect/session65-hitch-{baseline,timing,early,early-two,
  diagnostic,trace-two,lean,trace-timing,no-profile,no-profile-two,default-first,
  positive-control,unprofiled-tdm,ffa-final,ffa-startup-trace,ffa-gpu-trace,
  ffa-cpu-canvas-trace,ffa-cpu-radar,ffa-cpu-canvases,ffa-no-hud-trace}.json`;
  raw trace files append `-trace.json`, summaries append `-trace-summary.json`.
  Short traces intentionally do not assert death coverage and are not acceptance
  runs. Exact reproduction of the deeper trace:
  `node scripts/hitch-probe.mjs http://localhost:8796 8000 .inspect/diagnostic.json --mode=ffa --no-profile --trace --diagnostic-timing --trace-categories=toplevel,gpu,gpu.angle,cc,viz,blink.user_timing,disabled-by-default-gpu.service`.

Delivered, on by default:

- Switchyard now seeds the existing server-owned `signalAt` at round/training
  start, with the same30s first warning and90s cadence as the other maps.
  Joining does not reset it; forged move fields cannot set the epoch, cargo pose
  or core cover. Existing schema/protocol/state version stays valid. Switchyard
  radar remains online; Relay keeps its existing blackout behavior.
- Original4x3x12m sealed orange ribbed cargo, pale corner castings, dark end
  locks, attached spreader, four fan-out cables, travelling trolley and steady
  pilot light. It starts four metres above the exterior apron, rises eight metres
  in3s, carries28m in9s and lowers in3s. Each cycle reverses between the two
  berths. Absolute-time seeking handles late joins and skipped frames without
  accumulating local simulation drift. At round end it returns to its idle pose.
- Four draw objects, no new texture, real-time light, render pass, dynamic shadow
  or per-frame geometry bake. Reduced motion keeps the functional mechanical
  travel, with no added sway, camera movement or blinking. The same body envelope
  is available for the next arc's cover work, but every current part stays beyond
  x153, outside the150m playable bounds.
- CARGO SHIFT / STAND BY, EAST GANTRY / TRANSFER and CARGO SECURED cards describe
  the actual exterior action. Warning/recovery use the existing PA ident; a
  short filtered motor/chain takeup uses the existing noise buffer, master,
  mute and limiter and drains in about3.25s. No permanent motor loop.
- Replaced the old baked hook/trolley/cables. Re-baked only Switchyard's original
  architecture with Blender4.5,1024px AO/64samples;93,704 oriented triangles,
  ten materials, one embedded AO image, zero degenerate faces and finite UVs.
  Audit PASS, maximum normal component error0.00030000000075. Collider geometry
  and ground bake inputs did not change. Provenance/reproduction added to
  `public/assets/README.md`; existing original-asset allowlist applies.
- Tests sample both full transfer directions against every permanent exterior
  instance, verify constant objects/materials/geometries/no lights, phase seeks,
  late joins and forged inputs. The clearance test initially imported DOM code
  into the server typecheck; it now uses the existing browser-test configuration.
  No weakened typechecking and no dependency changes.

Rejected intermediates and capture discipline:

- The first transfer clipped the east service hall: a lifted load intersected
  the hall between its berths. Rejected those review captures and moved that
  purely exterior building8m farther east, leaving a clear swept envelope.
  The complete two-direction geometry test now catches this exact regression.
  `.inspect/session65-cargo-review-*`, `session65-architecture-rejected.json`
  and `session65-architecture-audit-rejected.json` preserve the intermediate;
  `session65-cargo-fixed-*` and final architecture audit show the accepted result.
- The first muted/reduced live drill failed after this agent edited the asset
  README while it was running. Wrangler reloaded, the player returned to spawn
  and the epoch changed. Kept `.inspect/session65-wow-muted-reduced-report.json`
  and its failure still/log. Froze source/assets, then repeated under
  `session65-wow-muted-reduced-final`; all assertions passed. The epoch check
  was retained, not bypassed. No preview reload, bake, test run or second
  inspection browser overlapped the final matched stress/hitch measurements.

Wow check:

- Actual pre-change static crane and accepted moving load use the same ground
  camera: `.inspect/session65-before-hero-switchyard-cargo-before.png` and
  `.inspect/session65-cargo-fixed-switchyard-cargo-transfer.png` with reports.
- `.inspect/session65-wow-report.json` and `session65-wow-cargo-{0s,5s,10s,
  15s,20s,recovery,standby}.png` retain a20,324ms natural private Switchyard
  training sequence. Ordinary W/aim walks to East service; the driver observes
  the next real warning instead of resetting the room clock. Lift8m, berth
  traversal, lowering, stable epoch, HP100 and online radar are recorded.
  Two observed motor sources end after3246.9/3247.1ms.
- `.inspect/session65-wow-muted-reduced-final-report.json` repeats20,259ms with
  mute and Reduced motion enabled in its isolated profile: zero motor sources,
  identical mechanical phases, stable epoch and online radar. The visible card
  fits800x600 and390x844; reviewed full-size and narrow screenshots. This is
  real-room training and paired before/after evidence, not a12-player fight or
  human excitement test. No game-state, clock, health or event injection.
- Intended player sentence: "That giant container actually lifts off and travels
  over the service yard." Design intent, not a claimed player testimonial.

Matched before/after stress,1920x1080 balanced/DPR1, Edge152.0.4191.66,
RTX5070 / ANGLE Direct3D11. Both fixtures render11 remote actors plus local
viewmodel,145 twelve-rifle volleys and96 blasts over15s, then fully drain for3s.
Before: `.inspect/session65-before-report.json`; after:
`.inspect/session65-final-report.json`, with paired stress stills. No laptop
iGPU, thermal, human input/RTT or real6v6 acceptance is inferred.

| Measurement | Session65 start (includes retained64) | Final | Delta |
|---|---:|---:|---:|
| Peak draw calls |198|202|+4|
| Peak triangles |164348|165668|+1320|
| Textures / estimated MiB |27 /61.85547|27 /61.85547|0|
| Prepared programs / geometries / instance slots |27 /148 /302|29 /152 /306|+2 /+4 /+4|
| Median / p95 / p99 frame ms |6.9 /7.1 /7.2|6.9 /7.1 /7.1|0 /0 /-0.1|
| Maximum / first-ready-window ms |7.6 /7.1|7.7 /7.1|+0.1 /0|
| Scene construction / preparation ms |72.4 /1013.8|75.9 /995.5|+3.5 /-18.3|
| Switchyard architecture bytes |7184816|7183364|-1452|
| All public assets bytes (includes provenance) |26695799|26695958|+159|
| Client JS / source map bytes |2066774 /4593083|2074393 /4608164|+7619 /+15081|
| Entire public bytes |33356264|33379123|+22859|

Public total31.832812MiB, within40MiB; every file remains below25MiB. No asset
budget increase. Texture residency remains below64MiB/32textures, calls below240
in this stress fixture. Four existing blast lights remain fixed through drain.
Timing differences are observations, not a speedup claim. Meshy spend0 credits;
reported balance1530 unchanged. Exact gantry-fit machinery used the original
procedural kit/Blender rather than a paid generated prop. Summary/reproduction:
`.inspect/session65-summarize.mjs`, `session65-summary.json`, final bake/audit logs.

Final gates:

- `pnpm typecheck` PASS, including the browser clearance test configuration.
- `pnpm test` PASS:584 passed,6 existing opt-in skipped;71 passed files,4 skipped.
- `pnpm build:client` PASS.
- `pnpm audit:assets` PASS.
- `node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two`
  PASS, zero console errors/forbidden network. Copied the required default outputs
  to `.inspect/session65-required-report.json` and corresponding stills/log.
- `node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`
  PASS with original500us CPU sampling enabled:66,541.8ms,9,580 measured frames,
  two deaths, zero frames over24ms, zero long tasks, zero shader changes and zero
  console errors. `.inspect/session65-hitch-final.json` is the retained exact result.
  The earlier69,070.9ms unprofiled TDM pass is separately archived as
  `session65-hitch-unprofiled-tdm`; it does not substitute for this required run.
- Additional FFA gate FAILED431.8ms; all diagnostic failures described above are
  retained. Six required gates green is a per-run result, not universal cold-GPU
  acceptance. The failure remains a supervisor preflight concern.
- Trace reader verified on the actual failing startup/GPU/HUD-hidden traces and
  the313MB lean trace. All63 reference rows present. `git diff --check` PASS.
  Static and browser exit codes: `.inspect/session65-static-gates.json` and
  `session65-browser-gates.json`.

Open owner questions, defaults active: keep the large exterior transfer while
Session66 adds playable cover (yes); retain mechanical cargo travel under Reduced
motion but omit optional sway/blink (yes); keep Switchyard radar online (yes).
No answer is needed to continue Cargo Shift2/2. Human first-five-minutes reaction,
all-lane crane visibility, comfortable audio and representative iGPU/6v6 testing
remain open. Encounter fairness stays second in the gap list: inherited Session64
exit improvements do not resolve its unfavorable/censored contact and score data.

Stopped the preview process tree this session started after verifying root PID,
creation time and descendant identities. `.inspect/session65-preview-tree.json`
records12 owned processes; cleanup confirms zero remaining owned processes,
zero8796 listeners and zero inspection browsers (`session65-cleanup.json`).
All working-tree changes remain under apps/ironsight/**, including inherited64.
No commit, push, deployment or live-site change.

### Session 66 - 2026-09-10: Cargo Shift arc 2/2 - trade freight cover for the crossing

Read the standing brief, Session66 supervisor status, plan and all63 design
principles. Branch ironsight-aaa was clean at entry. Supervisor confirms Session65
passed all gates, commit9292cd9, preview deploymentd0c994b5-ef5e-4a7b-a9ef-836f14b6b57d.
This session changes apps/ironsight/** only; no commit, push or deploy.

Reference: R-M03/04/05/08/11/12/14, R-G14/20, R-L14/16/22.
Targets: full cover>=1.75m; an actual route/cover trade on the crane's existing
8s warning/15s transfer; one authoritative collision state shared by rendering,
prediction and historical hits; no raising through occupants; unchanged10-15s
objective rotations; fixed lights/passes/resources; mute/reduced retain gameplay
information. These implemented checks pass. R-M05 is met as an implemented
route-changing map hook. Human first-five-minutes reaction and tactical quality
remain open. All63 scorecard rows reviewed, relevant evidence updated and gaps
re-ranked: Switchyard startup hitch is the preflight priority, followed by
encounter fairness. This cover is not evidence of improved match balance.

Delivered, Cargo Shift2/2 complete and on by default:

- East service FREIGHT / 04 is a4x3x6m counterweight at x124..128,z46..52.
  It provides full cover at rest and locks flush with the apron during the
  existing crane transfer. Crossing directly trades protection for access;
  north and south bypasses remain available when raised. The exterior crane,
  induction pads, spawns, bot combat stats and economy retain their behavior.
- The existing server-only CoreGate drives the existing replicated coreOpen
  bit. No new message, schema field, protocol or persisted shape. Client intents
  cannot forge the epoch/lock. Collision, movement/traversal, current/historical
  analytic and hybrid hits, grenades/blasts, pings, spawns, audio and normal bot
  navigation use the same open/closed sets. No FFA bot teleport or stat bonus.
- Full footprint plus1.5m approach guard holds the down lock for living players
  and grenades when transfer finishes. Standing, crouched/airborne threshold
  cases stay safe; exiting restores cover without HP change. Late seats inherit
  the held state. The existing per-round reset behavior is reused unchanged.
- The visible counterweight follows discrete authoritative locks, as the transit
  shutters do; it is NOT interpolated through a collider or presented as a
  continuously simulated lift. The external crane still animates lift/carry/lower.
  Underfloor weight stays resident; centimetre markings are cosmetic only.
- Original orange ribbed body, pale corner castings, inset serial panel, marked
  floor footprint and amber/teal lock bars. One512x128 sign texture shared on
  both sides. No new realtime light, pass, shadow, dependency or frame-time bake.
  Dynamic body excluded from permanent kit and ground-shadow generation, so no
  invisible baked freight block survives the down lock. Existing static bake
  inputs remain identical; no architecture/AO GLB or image needed regeneration.
- Warning explains COVER DROPS; open phase says CROSSING OPEN and exposed;
  occupied recovery says CLEAR TO RAISE / HELD; restoration announces full cover.
  Existing PA and short motor cue, mute/master/limiter path retained. Radar stays
  online. Geometry/color plus text retain the same information under Reduced motion.
  Provenance/reproduction added to public/assets/README.md: pnpm build:client.

Validation and rejected intermediates:

- Five new server/physics cases verify clear envelope/bypasses, movement, body/
  eye rays, grenades, navigator route, occupied closure, forged input, late seat
  replication and historical analytic/hybrid hits across BOTH transitions.
  Client lock test verifies prediction, visible down height, fixed objects,
  geometry/material references and zero lights. Permanent-kit test explicitly
  excludes the movable body and rejects any static shell/cladding in its footprint.
- First full suite failed the old112-static-shell assumption (111 permanent plus
  one movable body). Updated the test to assert this split and permanent clearance;
  the failure remains in session66-test-first-failed.log. Final590passed,6existing
  opt-in skipped;72passed files,4skipped. No test thresholds were weakened.
- First visual review showed z-fighting from near-coplanar orange panels, ribs,
  sign and castings. Preserved session66-review-*; separated face depths, retained
  millimetre/centimetre trim and shortened corner castings away from top/bottom
  rails. session66-cover-final-* was also an intermediate despite that prefix;
  its corner/rail overlap was corrected afterwards. Final
  session66-final-switchyard-cargo-{cover,crossing}.png reviewed.
- Ground BFS freight approach (121,50)->(131,50), sprint9m/s:1.5556s closed,
  1.1111s open;14m detour becomes10m direct. This is a modest local shortcut with
  a cover cost. Switchyard A-B/B-C/A-C14.44/14.44/11.56s remain unchanged in both
  states. Relay14.44/14.44/11.78, Undertow14.22/14.22/11.33 retained. Switchyard
  colliders111->112 closed,111 open;3m added full cover, no head-height class.
  No new encounter timing, heatmap, side fairness or human6v6 claim this session.
- Static all-reference audit: .inspect/session66-reference-audit.json,
  reproduced by tools/reference-audit.ts. All150x100m/1250m2per-seat, ADS250/200/
  225/400/165ms, sprint recovery120/100/130/150/90ms, respawn3s, hostile foley1.4,
  hit/kill pips and two damage cues retained. DOM4/8s capture,1point/2s/flag,
  no side swap,78hipFOV and top-right feed remain reference mismatches.

Wow check:

- Paired same-camera cover/crossing stills: session66-final-switchyard-cargo-
  {cover,crossing}.png. Pre-change vs final matched stress also retained in
  session66-before/ session66-final reports and stills.
- Real private Switchyard training: session66-wow-report.json and cargo-
  diagnostic.json retain a20408ms capture sequence plus warning, open, crossing,
  held and restored stills. Ordinary W/aim is blocked by raised cover, crosses
  the down lock, stands inside through recovery, then exits and observes safe
  full cover. Stable room epoch, online radar, HP100; all11 checks pass.
- session66-wow-muted-reduced repeats20482ms with mute and Reduced motion;
  identical collision/hold behavior, zero motor sources, readable800x600 and
  390x844 event cards. Final screenshots reviewed. Normal drill verifies motor
  sources end; these silent captures do not establish headphone comfort.
- No state, clock, health, teleport or event injection. This is training plus
  paired before/after states, not a twelve-player excitement test.
- Intended player sentence: "The crane just took away my cover and opened a
  crossing; I can cut through before it comes back." Design intent, not a quote
  from a playtester.

Matched1920x1080 balanced/DPR1 stress, Edge152.0.4191.66, RTX5070 / ANGLE D3D11:
11remote actors plus local viewmodel,145twelve-rifle volleys,96blasts/15s and3s
drain in both runs. Source/assets frozen for final measurements; no second
inspection browser, build or test overlapped stress or hitch sampling.

| Measurement | Session66 start | Final | Delta |
|---|---:|---:|---:|
| Peak draw calls |202|208|+6|
| Peak triangles |165668|166956|+1288|
| Textures / estimated MiB |27 /61.86|28 /62.19|+1 /+0.33|
| Programs / geometries / instance slots |29 /152 /306|29 /158 /306|0 /+6 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Max / first-ready-window ms |7.30 /7.10|7.60 /7.10|+0.30 /0|
| Scene construction / preparation ms |76.70 /1005.30|81.80 /1005.20|5.10 /-0.10|
| Public assets bytes (includes provenance) |26695958|26696582|+624|
| Client JS / source map bytes |2074393 /4608164|2079460 /4618069|+5067 /+9905|
| Entire public bytes |33379123|33394719|+15596|

Public31.85MiB remains below40MiB; largest file Switchyard architecture
7183364bytes unchanged, below25MiB. Assets grow only by README text;
no new binary. Texture estimate62.1888MiB/28 below64MiB/32;208calls below240.
Four blast lights stay constant. Timing differences are observations, not a
speedup or mid-laptop/iGPU/thermal/cold-driver/real6v6 claim. Meshy spend0credits;
reported1530balance unchanged. Exact collision-fit counterweight uses the
original procedural kit. .inspect/session66-summary.json and summarize.mjs
retain exact bytes/timings, gates, reference and wow results.

Final gates:

- pnpm typecheck PASS; pnpm test PASS (590passed,6existing opt-in skipped).
- pnpm build:client PASS; pnpm audit:assets PASS. Logs:
  session66-{typecheck,test,build-client,audit-assets}-final.log.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors/forbidden requests. session66-required-report.json,
  required-{relay,practice-two}.png and required.log retained.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS with original500us CPU sampling and original thresholds: 84777.20ms,
  12208measured frames, two natural bot deaths. See session66-hitch-final.json/log.
- Supplementary --mode=ffa FAILED on changed Switchyard: 47941.30ms,
  6799measured frames, two natural bot deaths. session66-hitch-ffa.json/log.
  First supplementary FFA run FAILED on its first measured frame:341.7ms at
  t341ms, with322of328CPU samples idle, no long task, shader change or console
  error. It still reached two deaths in112190.2ms. Preserved as
  session66-hitch-ffa-first-failed.json/log. No game/probe change was made before
  one recurrence run; it ALSO FAILED:439.2ms at464ms and294ms at777ms. CPU idle
  samples416/427 and274/279, zero long tasks/recompiles/errors, two deaths. The
  signature resembles inherited idle-heavy startup stalls, but CPU attribution
  does not establish its cause. Stopped rerunning and retained both failures.
  All SIX REQUIRED gates green does not mean this supplementary FFA gate passed
  or imply a fix/universal cold-GPU acceptance. Original
  sampling, warm-up, first frame, every spike and every threshold retained.
- Static/browser exit codes: session66-static-gates.json, session66-browser-gates.json.
  No edits to hitch probe, thresholds, profiling, waits or bot death requirement.

Open owner questions/defaults: keep the cover-for-crossing trade (yes); keep
counterweight locks discrete so cover matches authority (yes); leave FFA combat
stats and objective economy unchanged (yes). Human cover clarity, instant-lock
feel, audio comfort, actual RTT/mouse/6v6 and representative iGPU remain open.
No answer blocks continued work. Switchyard startup hitch is the next preflight
priority, then encounter fairness. No owner/performance acceptance is implied.

Cleanup: verified the owned preview root PID/creation time and each descendant
identity before stopping the12-process tree. session66-preview-tree.json and
session66-cleanup.json record zero remaining owned processes, zero8796 listeners
and zero inspection browsers. Final diff check clean; every changed/untracked
source path stays under apps/ironsight/**. All63 scorecard rows present exactly
once in the canonical scorecard (session66-final-audit.json). Six required gates
green; both supplementary FFA failures explicitly retained above. No commit, push
or deploy.


### Session 67 - 2026-09-10: Split Fronts arc 1/1 - hold one flag, push the others

Read standing brief, Session67 supervisor status, plan and all63 design
principles, in the requested order before implementation. Branch ironsight-aaa
was clean at entry. Supervisor confirms Session66 committed b81ec33 and deployed
1752c8f1-86ad-40d2-b952-b17d357d2bc3. This session is a local candidate only.

Reference: R-M07/09/20, R-G20, R-L02/11/14/16.
Targets: distribute DOM orders before arrival; no four-plus same-goal assignment
while two or more flags remain unfinished for a six-bot team; keep a small guard
at secured flags; preserve ordinary input/collision/perception/combat paths;
measure20-30s contacts and disclose misses; original150ms hitch gate/two deaths.
Assignment and required gate targets pass. Contact-band and human side fairness
remain NOT YET/PARTIAL. All63 scorecard rows reviewed and gaps re-ranked above.

Preflight first, rejected workaround:

- Read Session65 cross-process GPU/ANGLE traces and Session66 failed FFA runs.
  Reproduced the unchanged production build with the original profiled full-round
  probe: .inspect/session67-hitch-before-ffa.json/log,381.2ms first measured frame,
  79,252.2ms run, two natural deaths, no program changes or console errors.
- Existing prepare submits warm draws and waits for animation frames. Tested an
  asynchronous WebGL2 completion fence before controls attach: flush once, poll
  clientWaitSync with zero timeout, delete the fence, bound preparation failure.
  API basis: [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
  This was a hypothesis about pending preparation work, not an established cause.
- Candidate ALSO FAILED: .inspect/session67-hitch-fence-ffa.json/log,387.6ms
  first measured frame,31,594.1ms run, two deaths, no recompiles/errors.
  Rejected and removed the helper and all integration; retained its source as
  .inspect/session67-rejected-gpu-ready.ts. main.ts and scene.ts hashes match HEAD.
  No production startup workaround or probe change ships. One fence is insufficient;
  this does not identify the GPU stall cause. No repeated favorable-sample search.
- Continued to the next bounded gap once that candidate failed. The FFA failures
  remain first-priority evidence, separate from the green required Relay gate.

Delivered, Split Fronts1/1 complete and on by default:

- Replaced per-bot nearest-unfinished-flag selection with server-only DomOrders.
  Every1s it considers public capture gauges, allied positions and available bots.
  Normal orders commit for12s to avoid proximity thrash; death, departure, team
  changes and gallery volunteering release seats promptly. Round reset clears
  orders; no persisted state field, protocol/schema or SDK change.
- Preferred slots: two bots per unfinished flag, one guard per secured flag.
  Six neutral attackers therefore split into three pairs before reaching a cap.
  Surplus bots reinforce the least-staffed unfinished objective. When only one
  enemy flag remains, four attackers plus two guards is intentional; the no-pileup
  target applies when multiple unfinished flags offer alternatives. All-owned
  rounds defend across three points rather than blindly touring the spawn circuit.
- Humans keep control; living allies within8m of a reachable cap anchor consume
  reinforcement slots. Gallery volunteers yield their normal orders until their
  existing route finishes. Goals are copied reachable map anchors, with no hidden
  enemy input. Each brain uses existing navigation, close-threat response, aim,
  visibility, handling and server fire validation. No HP/damage/reaction bonus.
- Five regression cases cover both teams,12s commitment, capture relief, human
  occupancy, dead/left/gallery cleanup, all-owned defence, round reset, authored
  anchors, actual Undertow navigation and production-room DOM/TDM integration.
  Initial test used nonexistent harness.dispose; corrected to fixture timer cleanup.
  The failed session67-orders-test.log remains; final suite595passed/6existing skips.
- Extended the opt-in Undertow tool with read-only1s assignment/position samples.
  scripts/dom-orders-summary.mjs compares those and existing100ms life samples.
  No live-state writes, altered clocks, scripted bot routes or shortened rounds.

Three matched natural twelve-bot DOM rounds, identical seeds/normal300s rules:

| Seed | Before -> final red:blue | Final length s | Kills before -> final | Respawn median s before -> final | Contacts<5s before -> final | Final observed/censored respawns |
|---|---|---:|---|---|---|---|
|170684|161:161 ->135:200|275.9|82->88|20.1->17.1|0->0|78/9|
|170685|114:200 ->200:165|299.9|67->94|19.1->17.2|0->0|85/9|
|170686|201:81 ->140:200|293.9|71->93|24.1->16.9|0->1|85/6|

Baseline observed/censored respawns72/8,58/9,60/11. Final initial contact medians
16.1/15.6/16.2s,12observed/0censored each (before18.6/18.5/18.5s).
Gallery visitors2/2/0 ->3/4/4. These are unfavorable contact-band changes and one
new fast respawn, retained explicitly. More kills and less lopsided scores in two
seeds do not establish better balance, overall fairness or human excitement.

With>=2unfinished flags, four-plus bots assigned the same exact goal fell from
448/482,350/421,320/347 team samples (92.95/83.14/92.22%) to0/358,0/403,0/388.
Across ALL team samples, including deliberate final-flag pushes, pileups fell
93.67/86.03/91.24% ->14.36/15.05/17.75%. Assignment diversity is not physical
spacing, actual capture occupancy or win-rate evidence. Censored lives stay
absent, never zero. .inspect/session67-{before,orders}-{170684,170685,170686}-
bot-{round,debug}.json and bot-heatmap.svg retain full evidence. Reproduce with
UNDERTOW_METRICS=1, METRICS_SEED and METRICS_PREFIX using
pnpm exec vitest run test/undertow-metrics.tool.test.ts, then
node scripts/dom-orders-summary.mjs session67-before session67-orders.

Wow check:

- .inspect/session67-wow-follow-report.json and corresponding breakout/squad
  stills retain a40,847ms natural DOM drill:20s ordinary exit navigation, then
  20,432ms walking alongside a real teammate. squad-{0s,5s,10s,15s,20s}.png
  shows combat at A, split minimap allies and naturally earned support.43/170
  samples show living allies within16m of two or more cap centres at once;
  maximum allied separation132.11m. Reviewed0s and10s stills at full size.
- Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom
  --assert-orders --prefix session67-wow-review. Driver only reads replicated
  state and sends W/look input; after natural death it resumes at the real spawn.
  No forced spawn, health, clock, position, enemy loadout or support event.
- Retained first .inspect/session67-wow-* drill also passed distribution, but
  its stationary second half left the revived player facing a wall. Rejected
  that presentation; changed only the capture driver to follow a teammate.
  Final follow sequence passes with zero console errors. No gameplay tuning
  between captures; no claim of a real12-human match or headphone acceptance.
- Intended player sentence: "My squad holds our flag while the others attack
  elsewhere; I can choose which fight to join." Design intent, not a testimonial.

Matched before/final Switchyard stress keeps the same production renderer,
11remote actors plus local viewmodel,145twelve-rifle volleys,96blasts/15s and3s
drain.1920x1080 balanced/DPR1, Edge152.0.4191.66, RTX5070/ANGLE D3D11.
No build/test/bake or second browser overlapped stress or hitch measurement.
The DOM change is server behaviour, so unchanged render costs are expected;
this fixture does not measure the server cost of assignment decisions.

| Measurement | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |208 /166956|208 /166956|0 /0|
| Textures / estimated MiB |28 /62.1888|28 /62.1888|0 /0|
| Programs / geometries / instance slots |29 /158 /306|29 /158 /306|0 /0 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Maximum / first-ready ms |7.4 /7.1|7.4 /7.0|0 /-0.1|
| Construction / preparation ms |81.3 /1003.1|80.3 /1012.6|-1.0 /+9.5|
| Public assets bytes |26696582|26696582|0|
| Client JS / source map bytes |2079460 /4618069|2079460 /4612713|0 /-5356|
| Entire public bytes |33394719|33389363|-5356|

Source-map-only byte reduction comes from restoring the rejected client edits
to HEAD's LF text; executable client JS and asset bytes are unchanged. Public
31.84MiB remains below40MiB, largest file7183364bytes below25MiB. No new binary,
texture, light, render pass, per-frame bake or dependency. Four blast lights stay
fixed. Meshy spend0credits; supervisor balance1530unchanged. This server tactics
change needs no generated art. No iGPU/thermal/real6v6 acceptance from desktop
numbers. Summary/reproduction: .inspect/session67-summary.json and summarize.mjs.

Final validation:

- pnpm typecheck PASS; pnpm test PASS,595passed/6existing opt-in skipped,
  73passed files/4skipped. pnpm build:client PASS; pnpm audit:assets PASS.
  .inspect/session67-{typecheck,test,build-client,audit-assets}.log and
  session67-static-gates.json retain exit codes. All new inspection scripts parse.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors/forbidden requests. Required report/stills/log retained
  as session67-required-*; final inspector repeat after capture-driver edit passes.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS:63,358ms,9,123frames,two deaths,zero frames>24ms,long tasks,recompiles/errors.
  Original500us CPU sampling, waits, startup frame and150ms gate unchanged.
  session67-hitch-final.json/log preserves the exact required run.
- Supplementary changed-mode --mode=dom PASS:93,691.9ms,13,492frames,two deaths,
  zero frames>24ms,long tasks,recompiles/errors; session67-hitch-dom.json/log.
  FFA baseline and rejected fence runs FAILED as disclosed above, not hidden by
  these green results. No universal startup/GPU or other-hardware acceptance.
- Refreshed static audit: session67-reference-audit.json/mjs and tools/reference-audit.ts.
  All maps150x100m/1250m2per-seat; rotations Relay14.44/14.44/11.78,
  Undertow14.22/14.22/11.33,Switchyard14.44/14.44/11.56s. Cover classes unchanged.
  ADS250/200/225/400/165ms,sprint recovery120/100/130/150/90ms,respawn3s,
  hostile foley1.4,hit/kill pips and two damage cues retained. DOM4/8s capture,
  1point/2s/flag,no side swap,78hipFOV and top-right feed remain mismatches.

Open owner questions/defaults: keep coordinated pushes/guards (yes); count nearby
humans without commanding them (yes); preserve gallery volunteer priority (yes).
Keep pacing and fairness explicitly unaccepted until forward holds/contact times
and real6v6 are reviewed. No answer blocks continued work. Human tactical feel,
role readability, audio/mouse comfort, actual RTT and iGPU remain open.

Cleanup and final scope audit recorded in .inspect/session67-cleanup.json and
session67-final-audit.json: owned preview process tree stopped, no8796 listener
or owned inspection browser; all63 canonical scorecard rows present once; diff
check clean and all changed/untracked source paths under apps/ironsight/**.
No commit, push or deployment. Six required gates green; FFA startup risk retained.


### Session 68 - 2026-09-10: Hold and Counter arc 1/1 - guard the approach, keep the duel local

Read the standing brief, Session68 supervisor status, plan and all63 design
principles before implementation. Entry branch ironsight-aaa was clean.
Supervisor confirms Session67 commit133b005 and preview deployment
4a6f743f-ba01-46a0-b03e-3c97c38fdb6c. This session is a local candidate only.

Reference: R-M07/09/20, R-G20, R-L11/14/16.
Targets: close objective dodges stay within2m of their local anchor in the
fixture; arrived guards watch an authored approach with a +/-30degree/6s scan;
silent rear flanks remain outside acquisition until ordinary hearing/vision
allows them; preserve reaction/HP/damage/collision and split assignments;
measure20-30s contacts and disclose misses; original150ms hitch/two deaths.
Local duel, scan, perception and required-gate targets pass. Contact timing and
human fairness remain NOT YET/PARTIAL. All63 scorecard rows reviewed and the
gap list re-ranked; GPU stalls across FFA/DOM remain first priority.

Preflight and unresolved performance evidence:

- Read Session65 GPU/ANGLE trace summaries and Session67's rejected completion
  fence. No renderer workaround or probe edit is carried forward.
- The unchanged production FFA preflight FAILED:40,237.7ms,5,612frames,two
  natural deaths;377.8ms at378ms and904.4ms at32,062ms. The latter has872/883
  CPU samples idle. No long task, program change or console error. Evidence:
  .inspect/session68-hitch-before-ffa.json/log. This extends the recorded risk
  beyond startup; stable Three.js programs do not rule out browser/driver work.
- After the server-only change, supplementary DOM ALSO FAILED:83,248.6ms,
  11,943frames,two deaths;314.8ms at54,310ms,296/301samples idle, zero long
  tasks/recompiles/errors. session68-hitch-dom.json/log retains the failure.
  The idle-heavy signature resembles the earlier GPU-path stalls, but these
  CPU profiles alone do not identify the cause. Do not label it Switchyard-only.
- Required Relay hitch passes below. Neither that pass nor unchanged executable
  client bytes erase the supplementary failures. No favorable-run loop, reduced
  profiling, hidden first frame, changed150ms threshold or longer warm-up.

Delivered, Hold and Counter1/1 complete and on by default:

- Found the close-threat objective branch still using the legacy z=11 combat
  anchor. It could pull a defender off a distant flag or make an advancing bot
  retreat when a nearby opponent appeared. Three new checks fail on the entry
  build: the flag fixture drifts3.3m, the en-route fixture retreats3.0m, and a
  quiet holder turns outside the intended approach sector. Retained in
  session68-hold-before-tests.log; no existing assertions were weakened.
- Close objective duels now copy an anchor when the enemy enters the existing
  8m close-threat range. Arrived defenders use the flag's own anchor; travellers
  use their current z, not their earlier distant-acquisition position. Existing
  +/-1.2m strafe amplitude/cadence and normal movement collision remain. Target
  loss, range exit, objective change, leaving objective mode and death/reset
  release the commitment. This also repairs the shared event-route duel branch.
- Quiet arrived DOM holders watch the centroid of the opposing team's authored
  deployment positions, computed once from map data. They sweep +/-30degrees
  over6s through the existing turn-rate limiter. It never reads a hidden enemy
  location. Sound memory and visible combat override the scan. Existing120degree
  acquisition/160degree tracking cones,150ms reaction, aim noise, health and
  damage remain. A silent rear approach remains unseen in the regression fixture.
- Gallery/core volunteers omit approach scanning and retain route facing.
  Normal TDM/FFA patrols and stationary practice targets retain their behavior.
  Split Fronts slot counts,12s orders, human occupancy and release rules stay
  unchanged. No schema/protocol/state-version, SDK or collision-map change.
- Four new focused regressions cover local hold/travel, late close acquisition,
  loss/reassignment/reset, bounded scan/rear flank, sound override, cover and
  reaction delay. Production-room integration additionally verifies both teams'
  authored watch points and omission for gallery/TDM. Final full suite599passed,
  6existing opt-in skips,74passed files/4skipped.

Three matched natural twelve-bot DOM rounds, normal300s rules and the same seeds:

| Seed | Before -> final red:blue | Final length s | Kills before -> final | Respawn median s before -> final | Contacts<5s before -> final | Final observed/censored respawns |
|---|---|---:|---|---|---|---|
|170684|135:200 ->174:173|300|88->103|17.1->17.4|0->1|93/9|
|170685|200:165 ->201:149|289.9|94->109|17.2->16.7|0->0|98/8|
|170686|140:200 ->185:174|300|93->106|16.9->18.7|1->0|96/10|

Before observed/censored respawns78/9,85/9,85/6. Initial contact medians stay
16.1/15.6/16.2s,12observed/0censored each. All remain below20-30s. One fast
respawn moved seeds, and the second seed's score gap increased. No fairness,
win-rate, excitement or overall pacing acceptance follows from these results.
Gallery visitors3/4/4 ->5/3/3. Four-plus same-goal assignments with>=2unfinished
flags stay0 across all three rounds. Censored contacts remain absent, never zero.

One-second arrived-holder samples facing within60degrees of the authored
incoming approach rise548/664 ->839/922,470/797 ->788/820 and620/922 ->870/903
(82.53/58.97/67.25% ->91.00/96.10/96.35%). These include combat turns and
event-route holders; they are orientation evidence, not a LOS/occupancy verdict.
Final close-duel samples88/55/60 have maximum anchor offsets1.1903/1.1651/1.1875m.
Before did not record duel metadata: no baseline duel-offset comparison claimed.
Full reports/heatmaps: .inspect/session68-{before,hold}-{170684,170685,170686}-
bot-{round,debug}.json and bot-heatmap.svg. Baseline reproduces Session67 scores.
Reproduce with UNDERTOW_METRICS=1, METRICS_SEED and METRICS_PREFIX through
pnpm exec vitest run test/undertow-metrics.tool.test.ts, then
node scripts/dom-orders-summary.mjs session68-before session68-hold and
node scripts/objective-hold-summary.mjs session68-before session68-hold.

Wow check:

- .inspect/session68-wow-court-report.json retains a20,396ms sequence after
  normal navigation to the home court,27,912ms total,238samples/20visible-holder
  samples. hold-{0s,5s,10s,15s,20s}.png shows the A guard, capture and ensuing
  lane fight;0s and10s reviewed at full size. Natural damage/death/respawn are
  retained, never prevented. A holder need not survive the entire sequence.
- Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom
  --assert-holds --prefix session68-wow-court-review. Driver reads state, walks
  with W and aims normally; no forced position, health, bot state or clock.
  After a guard departs it watches the incoming lane while remaining at home.
  Before40s squad capture retained as session68-wow-before-*.
- Rejected presentations retained: session68-wow-* first opening clipped through
  a passing teammate; session68-wow-final-* FAILED with only4visible samples
  after chasing a distant replacement holder. session68-wow-review-* passed
  but faced the cap's wall after its guard departed. Corrected only capture
  navigation/framing, not gameplay. Final court capture has zero console errors.
- Intended player sentence: "My teammate watches this lane while I take another
  angle." Design intent, not a human testimonial or a claimed flank playtest.

Matched1920x1080 balanced/DPR1 Switchyard stress, Edge152.0.4191.66,
RTX5070/ANGLE D3D11:11remote actors plus local viewmodel,145twelve-rifle
volleys,96blasts/15s and3s drain. The first final stress sample overlapped the
reference-audit build; retained as session68-overlapped-stress-* and excluded.
The final comparison is isolated: no build/test/bake or second browser during
stress or hitch measurement. The server-only change has no render-cost change.

| Measurement | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |208 /166956|208 /166956|0 /0|
| Textures / estimated MiB |28 /62.1888|28 /62.1888|0 /0|
| Programs / geometries / instance slots |29 /158 /306|29 /158 /306|0 /0 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.2|6.9 /7.1 /7.1|0 /0 /-0.1|
| Maximum / first-ready ms |7.2 /7.1|7.7 /7.1|+0.5 /0|
| Construction / preparation ms |79.4 /983.5|80.5 /1499.3|+1.1 /+515.8|
| Public assets bytes |26696582|26696582|0|
| Client JS / source map bytes |2079460 /4612713|2079460 /4612713|0 /0|
| Entire public bytes |33389363|33389363|0|

Public31.8426MiB stays below40MiB, largest file7183364bytes below25MiB.
No new asset, dependency, light, render pass or per-frame bake; four blast lights
stay fixed. Meshy spend0credits; reported1530balance unchanged. This AI behavior
uses existing operators/animation and needs no generated prop. Preparation is
slower in this sample despite identical client/assets; no speedup, cold-driver,
server tick-cost, laptop iGPU, thermal or real6v6 claim. Exact data/reproduction:
.inspect/session68-summary.json and session68-summarize.mjs.

Final gates and reference checks:

- pnpm typecheck PASS; pnpm test PASS(599passed/6existing skips);
  pnpm build:client PASS; pnpm audit:assets PASS. Full logs:
  session68-{typecheck,test,build-client,audit-assets}.log.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors/forbidden requests. Repeated after the final capture
  driver edit: session68-required-final-report.json, required-final-{relay,
  practice-two}.png/log. Earlier required report also retained.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS:98,507.4ms,14,185frames,two natural deaths,no>24ms frames,long tasks,
  recompiles or errors. session68-hitch-final.json/log. Original500us CPU
  sampling, setup waits, every startup frame and150ms gate unchanged.
- Supplementary FFA/DOM FAIL as detailed above. All six REQUIRED gates green
  does not make those checks green. Exit-code records: session68-static-gates.json
  and session68-browser-gates.json. All three added/updated inspection scripts parse.
- Static all-reference audit: session68-reference-audit.json/mjs and
  tools/reference-audit.ts. All maps150x100m/1250m2per-seat; rotations Relay
  14.44/14.44/11.78,Undertow14.22/14.22/11.33,Switchyard14.44/14.44/11.56s.
  Cover classes unchanged. ADS250/200/225/400/165ms,sprint recovery120/100/130/
  150/90ms,respawn3s,hostile foley1.4,hit/kill pips and two damage cues retained.
  DOM4/8s capture,1point/2s/flag,no side swap,78hipFOV and top-right feed remain
  reference mismatches. No reference target was silently relaxed.

Open owner questions/defaults: keep local close duels (yes); guards watch the
authored incoming side while quiet (yes); retain silent flank/hearing counterplay
and existing combat stats (yes). No answer blocks continued work. Human guard
readability, contact pace/side fairness, mouse/audio comfort, actual RTT and
representative iGPU remain open. The next preflight must address the broader
GPU stall evidence, not assume all stalls happen at Switchyard startup.

Cleanup: first identity check safely stopped before termination because JSON
StartTime had already decoded to DateTime; corrected the comparison to UTC epoch
milliseconds. Verified root PID/start time and each descendant identity, then
stopped the12-process preview tree. session68-preview-tree.json/cleanup.json
record zero remaining owned processes,8796 listeners or inspection browsers.
Final scope/reference audit: session68-final-audit.json; all63 canonical rows
present once, diff check clean, changed/untracked source paths only under
apps/ironsight/**. No commit, push or deployment. Six required gates green;
supplementary FFA/DOM GPU failures explicitly retained.


### Session 69 - 2026-09-10: Clear Contact arc 1/1 - operator edges and enemy colour choices

Read the standing brief, Session69 supervisor status, plan and all63 reference
principles in the requested order. Entry branch ironsight-aaa was clean.
Supervisor confirms Session68 commit ba440b3 and preview deployment
f5defbec-5f3f-4364-b9ba-94b56be8f508. This session is a local candidate only.

Reference: R-G09, R-L12/13/14/16/23.
Targets: strengthen the existing character silhouette without extra draws,
textures, lights or passes; offer saved enemy-only colour choices using the
same material/shader; preserve opaque cover occlusion, team identity, geometry,
weapons and hit authority; keyboard access at800x600; no material version or
program-count change while switching; retain the original150ms/two-death gate.
Implemented targets pass. Human colour-vision, all-range readability, excitement
and representative iGPU performance remain unaccepted. R-L23 becomes MET for
the implemented dropdown; broader clarity rows stay PARTIAL. All63 rows reviewed.

GPU preflight and scope choice:

- Read the Session65 GPU/ANGLE attribution and Session67 rejected completion
  fence, plus Session68's unchanged FFA and changed-mode DOM failures. The
  existing evidence includes mid-combat stalls, not only Switchyard startup.
- Unchanged FFA with the existing optional GPU trace/timing flags PASS:
  43,589.5ms,6,276frames,two deaths,no>24ms frames,long tasks,recompiles/errors.
  .inspect/session69-hitch-before-ffa.json/log and -trace.json retain the run.
  scripts/hitch-trace-summary.mjs reports no failing windows. Tracing changes
  observation/timing, so this is not an untraced acceptance substitute.
- Unchanged ordinary DOM preflight PASS:64,407.4ms,9,274frames,two deaths,
  no>24ms frames,long tasks,recompiles/errors. session69-hitch-before-dom.json/log.
  No failing trigger was available to attribute this session; no renderer
  workaround was justified. Prior377.8/904.4/314.8ms failures remain evidence.
- Chose the bounded first-play operator-readability/accessibility gap after
  this preflight. Contact pacing still needs the retained multi-seed attack
  route investigation; this session changes no bot/combat/layout balance to
  make the timing metric pass. GPU diagnosis and contact routes remain the
  first two ranked gaps. No probe edit, profiling reduction or favorable-run loop.

Delivered, Clear Contact1/1 complete and on by default:

- ActorAppearance replaces the old tint helper with per-operator owned
  materials. A squared Fresnel term adds a restrained lit edge to the same
  standard-material emissive contribution. Strength .42 near to .62 far,
  smoothly increasing over10-45m of view distance. It never extrudes the mesh,
  samples hidden state or adds a screen outline, light, draw or render pass.
  Original texture, skinning geometry, animation, weapon holds and dark details
  remain. The procedural capsule fallback receives the same material path.
- The existing preparation fixture compiles and draws this exact shader before
  controls attach. Team colours remain the default, including for old saves.
  Settings / Enemy colour adds Yellow and Violet. Only known opponents get
  the override; allies keep their team tint. FFA and training classify every
  remote operator as hostile. Unknown viewer team falls back to team colours.
  Local hands/weapons, objective colours and HUD/feed team colours remain.
- Changes update the existing diffuse/rim colour uniform references. No material
  recreation, needsUpdate, shader defines or per-frame hierarchy traversal.
  Every colour remains opaque, depth-tested and depth-writing; Reduced motion
  has the same cue. Only existing replicated operators can be drawn.
- The labelled native select supports keyboard input, visible focus, the modal
  focus loop, narrow scrolling, immediate persistence and Reset all. Invalid
  saved values fall back to team colours. Changing another binding protects
  the select under the panel's existing capture guard.
- Three focused regressions cover both teams/teamless/unknown classification,
  texture/geometry sharing and per-operator isolation, live uniform identity
  without material-version changes, opaque depth state, old/malformed settings,
  persistence and reset. First typecheck found the new DOM-dependent test in
  the server tsconfig; moved it into the existing client-test include/exclude
  pattern. Final typecheck and all602tests pass; no assertion was weakened.

Wow check and actual UI evidence:

- Before/default-after paired stills: .inspect/session69-before-roles-after.png
  and session69-contrast-roles-after.png, same factory, camera, three loadouts
  and pose fixture. Reviewed at full size. Edge strength is intentionally
  restrained; this does not claim new operator art or a major silhouette change.
- session69-contrast-contrast-{team,yellow,violet}.png shows one unchanged red
  ally and two opponents in the selected colour. The yellow pair demonstrates
  the readily visible new choice. Yellow-reduced retains the same cue.
  Yellow-cover shows the closed core hiding all three operators.
- Stronger occlusion control: session69-verify-contrast-empty-cover.png vs
  session69-verify-contrast-yellow-cover.png are pixel-identical at1920x1080:
  zero differing pixels. Same camera/core, zero vs three operators behind it.
  .inspect/session69-occlusion.json records the comparison. This checks one
  real cover fixture; it is not an all-map LOS or human visibility audit.
- scripts/contrast-probe.mjs opens the actual pause/settings UI, selects with
  Home/ArrowDown/Enter, closes/resumes, then repeats Team/Yellow/Violet/Team/
  Yellow. TDM checks11remote actors, unchanged ally colours, stable material
  versions and33programs at every switch. FFA separately checks all11remotes
  as opponents with29programs. Stored choice and settings fit at1920/800 widths
  pass. Reports: session69-{wow,verify}-report.json, matching logs and stills.
- The TDM probe then runs20,705ms of normal W/look navigation through a real
  bot round:210samples,310received shot events. roles-live-{0s,5s,10s,15s,20s}
  stills retain natural movement/damage. Reviewed10s/20s: they mainly show allies
  and cover, so they are UI/integration evidence, not a staged enemy showcase.
  The paired operator stills above are the visual wow evidence. No health,
  position, bot, clock, loadout or support event is injected into live gameplay.
- Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots tdm
  --assert-contrast --prefix session69-wow-review; repeat with --shots ffa for
  teamless coverage. Offline --shots roles-after,contrast-team,contrast-yellow,
  contrast-violet,contrast-yellow-reduced,contrast-yellow-cover,contrast-empty-cover.
- Intended player sentence: "I can make enemies stand out from the machinery
  without losing sight of who is on my team." Design intent, not a testimonial.

Matched1920x1080 balanced/DPR1 Switchyard stress, Edge152.0.4191.66,
RTX5070/ANGLE D3D11:11remote actors plus local viewmodel,145twelve-rifle volleys,
96blasts/15s and3s drain. No build/test/bake or second inspection browser ran
alongside either stress sample or a hitch measurement.

| Measurement | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |208 /166956|208 /166956|0 /0|
| Textures / estimated MiB |28 /62.1888|28 /62.1888|0 /0|
| Programs / geometries / instance slots |29 /158 /306|29 /158 /306|0 /0 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Maximum / first-ready ms |7.7 /7.1|7.2 /7.0|-0.5 /-0.1|
| Construction / preparation ms |56.4 /593.2|57.1 /579.3|+0.7 /-13.9|
| Public assets bytes |26696582|26696582|0|
| Client JS / source map bytes |2079460 /4612713|2084840 /4625864|+5380 /+13151|
| Entire public bytes |33389363|33407894|+18531|

Public31.8603MiB remains below40MiB; largest file7183364bytes below25MiB.
No new binary asset, dependency, light, render pass or per-frame bake. Four
blast lights remain fixed. Meshy spend0credits; reported1530balance unchanged.
This material/UI change uses the existing operators and needs no generated prop.
Timing differences are sample variability, not a claimed GPU speedup. No iGPU,
thermal, cold-driver or real6v6/RTT acceptance. Reproduction/data:
.inspect/session69-summarize.mjs and session69-summary.json; stress files are
session69-before-* and session69-contrast-*.

Final gates and references:

- pnpm typecheck PASS; pnpm test PASS(602passed/6existing skips,75passed files/
  4skipped); pnpm build:client PASS; pnpm audit:assets PASS. Full logs:
  session69-{typecheck,test,build-client,audit-assets}.log and static-gates.json.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors/forbidden requests. session69-required-report.json,
  required-{relay,practice-two}.png and required.log retain the exact run.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS:63,943.7ms,9,208frames,two natural deaths,no>24ms frames,
  long tasks,recompiles/errors. session69-hitch-final.json/log. Original500us
  CPU sampling, setup waits, startup frames and150ms assertion unchanged.
- Supplementary ordinary FFA PASS:62,924.4ms,9,049frames,two deaths.
  One90.1ms startup frame at716ms is retained (below150ms); no long tasks,
  shader changes or console errors. This is not a uniformly smooth run.
- Supplementary ordinary DOM PASS:74,345.8ms,10,705frames,two deaths,
  no>24ms frames,long tasks,recompiles/errors. session69-hitch-{ffa,dom}.json/log
  and supplementary-gates.json retain both runs. Neither required-gate success
  nor unchanged render counts resolves the prior intermittent GPU failures.
- Refreshed static audit: session69-reference-audit.json/mjs and unchanged
  tools/reference-audit.ts. All maps150x100m/1250m2per-seat. Rotations Relay
  14.44/14.44/11.78,Undertow14.22/14.22/11.33,Switchyard14.44/14.44/11.56s;
  cover classes unchanged. ADS250/200/225/400/165ms,sprint recovery120/100/130/
  150/90ms,respawn3s,hostile foley1.4,hit/kill pips and two damage cues retained.
  DOM4/8s capture,1point/2s/flag,no side swap,78hipFOV and top-right feed remain
  mismatches. No timing/reference target was silently relaxed.

Open owner questions/defaults: keep the subtle rim(yes); keep Team colours as
old-save/default appearance(yes); offer enemy-only Yellow/Violet(yes). No answer
blocks continued work. Human colour-vision/readability, distant silhouettes,
actual mouse/RTT, audio comfort and iGPU remain open. Investigate intermittent
GPU stalls and initial/remaining-fast contact routes next; no fairness claim.

Cleanup: verified the preview root PID/start time and every descendant identity,
then stopped the owned12-process tree (five explicit stops; other descendants
exited with their parents). session69-preview-tree.json and session69-cleanup.json
record zero owned processes,8796 listeners or inspection browsers remaining.
Final scope/reference audit: session69-final-audit.json; all63 canonical rows
appear once, one Session69 entry, clean diff check, all changed/untracked source
paths under apps/ironsight/** on ironsight-aaa. No commit, push or deployment.
Six required gates and supplementary FFA/DOM gates green for these runs; prior
intermittent GPU failures, human colour-vision and iGPU acceptance remain open.

### Session 70 - 2026-09-10: Pump Breach arc 1/1 - take B through the pump court

Read standing brief, Session70 supervisor status, plan and all63 reference
principles. Entry branch ironsight-aaa was clean. Supervisor confirms Session69
commit1101d88 and preview deployment ae31de5c-4c6b-438b-908e-436bcbb726ab.
This session is a local candidate only; no commit, push or deployment.

Reference: R-M02/03/04/07/10/12/13/20, R-L11/14/16.
Targets: keep two clear B entrances and10-15s shortest rotations; move opening
B fights from the exposed service cross-lane into/near the objective; real
waist/full collision cover with matching bakes; preserve split assignments,
local duels and ordinary sight/reaction/fire rules; no extra light, texture or
pass; retain the exact150ms/two-death gate. The local route/cover checks pass.
The20-30s overall contact target remains NOT MET, and fast respawn contacts
regress in these seeds. Human fairness, tactical quality and excitement remain
unaccepted. All63 scorecard rows reviewed; gaps re-ranked around this evidence.

GPU preflight, retained failures and measurement discipline:

- Unchanged FFA with existing --trace/--diagnostic-timing FAIL:42,657.6ms,
  6,026frames,two deaths,814.7ms frame at1.131s. No shader changes, JS long
  tasks or console errors. Trace overlaps an811.84ms ANGLE worker task while
  the20ms heartbeat continues;776/853V8 samples in the gap are idle. This
  reproduces the unresolved GPU path, not a new gameplay regression.
- .inspect/session70-hitch-before-ffa.json/log, -trace.json and
  -trace-summary.json retain the run. Deeper gpu/gpu.angle/service trace:
  session70-gpu-detail.json/log/-trace.json,12,957.9ms/1,866frames,zero slow
  frames and zero deaths. It did not reproduce the trigger and is NOT an
  acceptance run. No renderer workaround or probe change is shipped.
- Unchanged ordinary DOM preflight reports PASS64,210ms/9,246frames/two
  deaths, but the first Switchyard stress launch overlapped its tail. Retain
  session70-hitch-before-dom.* and session70-before-* as EXCLUDED from isolated
  performance comparison. Do not use this overlap as an isolated preflight
  pass. Final changed-mode DOM and matched Undertow stress run separately.
- Previous Session65/67/68 rejected workarounds and mid-combat failures remain
  relevant. A later green required run does not resolve them. Original500us
  profiling, startup waits, all measured frames and150ms assertion unchanged.

Delivered, Pump Breach1/1 complete and on by default:

- Read the retained three-seed routes first. Initial B assignments march along
  z74.5; a released home guard can even cross the northern rifle lane on its
  way to B. The prior remaining4.1s respawn contact occurs after a hidden
  northern deployment exit, not inside an exposed spawn. No timer/stat change.
- Map-owned B approaches now take Pump service behind the southern housings,
  round their returns and enter the same two north-facing court doors. Choose
  the nearest entry from the bot's own position; no hidden enemy destination.
  Near reinforcements (<=25m) or players beyond the entries go direct.
- Each order retains its real capture/guard anchor plus optional route progress.
  Corners advance every simulation tick within0.8m;12s assignment renewal does
  not rewind them. Completion/45s expiry releases the approach. Death, departure,
  reassignment, gallery volunteering and round reset discard old route state.
  No schema/state-version or protocol change; runtime orders remain derived.
- Travel uses the approach, while arrival, guard facing and close duels use the
  actual flag. Distant visible fights still permit movement; close threats
  retain local dodges/reaction delay. Current collision, hearing, aim noise,
  weapon handling, damage, bot fill and TDM/FFA/training brains remain intact.
- Two3m full-cover returns atx62-64/x86-88,z84-88 extend existing housings;
  adjacent waist boxes shorten. Undertow124->126closed colliders,122->124open.
  Standing/crouched z85 rays stop13m fromx49/x101 instead of crossing52m;
  x69/x81 door rays remain clear. Both actual paths walk from all twelve spawns
  with the gallery open/closed and no capsule clipping. Shortest rotations stay
  14.22/14.22/11.33s, unchanged. No new floor plane, collider-only invisible wall
  or decorative cover that the server cannot see.
- Rebuilt original architecture/AO;87460oriented triangles vs86236, zero
  degenerate triangles, max normal component error0.000301. Exact same source
  triangle winding and finite UVs verified. Ten material primitives and one
  1024-square AO image. Ground AO stays2048x1365/13.65px per metre. Two flush
  B/PUMP HALL signs share the existing signage atlas and opaque material.
  Reproduction/provenance is in public/assets/README.md; allowlists unchanged.
- Five new regressions plus room integration checks cover route selection,
  progress/renewal/lifetime, near arrivals, local duels/sight/reaction, real
  all-spawn walks and cover/door rays. Final suite607passed/6existing skips,
  76passed files/4skipped. No existing assertion weakened.

Three matched natural twelve-bot DOM rounds, unchanged300s rules:

| Seed | Before -> final red:blue | Final length s | Kills before -> final | Initial p50 s before -> final | Respawn p50 s before -> final | Contacts<5s before -> final |
|---|---|---:|---|---|---|---|
|170684|174:173 ->177:162|300|103->97|16.1->17.1|17.4->16.7|1->2|
|170685|201:149 ->166:184|300|109->101|15.6->18.0|16.7->18.4|0->1|
|170686|185:174 ->184:158|300|106->100|16.2->18.1|18.7->17.2|0->2|

Initial observed/censored12/0 each before/final. Respawns before93/9,98/8,96/10;
final91/6,92/8,90/7. Quantiles use the existing lower empirical p50; absent
contacts stay censored, never zero. Gallery visitors5/3/3 ->2/3/4. Four-plus
same-flag assignments with>=2unfinished flags remain0. Neither the score gaps
nor three rounds establish side win rates, human6v6 or pacing acceptance.

Fixed opening B cohort bot2/3/4/5, selected by initial assignment before outcomes:
first damage within12m of B rises0/0/1 ->4/3/4 (1/12 ->11/12 overall). Cohort
p50 rises14.6/15.3/14.1s ->18.2/17.2/17.4s, still below20-30s. Keep the survivor
whose first damage only occurs after reassignment; do not outcome-filter it.
B-assignment1s samples in the exposed z72-76,x30-120 strip fall194/216/229 ->
1/1/1; behind-pump samples rise22/17/18 ->245/277/291. Court samples255/259/304
->324/290/282, not uniformly better. New fast respawns2/1/2 all occur near
z27.5 after hidden spawns, from A/C or inner-lane threats. This is an explicit
regression and the next bounded route task, not an overall safety success.

Reports/heatmaps: .inspect/session70-pumps-{170684,170685,170686}-bot-
{round,debug}.json and bot-heatmap.svg, plus -comparison.json and -routes.json.
Baseline is Session68's retained matched production-bot reports; Session69
changed no server behavior. Reproduce with UNDERTOW_METRICS=1,METRICS_SEED,
METRICS_PREFIX and pnpm exec vitest run test/undertow-metrics.tool.test.ts,
then scripts/dom-orders-summary.mjs and objective-approach-summary.mjs.

Rejected intermediates and wow check:

- Route-only candidate retained as session70-approach-{seed}-*: navigation
  passed but z85 still had a long exposed firing line. Superseded by the two
  physical returns, not accepted as a pacing fix. Early architecture audit
  correctly failed against the stale pre-bake GLB; final re-bake audit passes.
- .inspect/session70-wow-* first capture FAIL: only1visible-ally sample after
  the observer fell behind at corners;5s still faces a wall. Kept all files.
  Corrected only the driver to use normal Shift/W pursuit between corners.
- Final session70-wow-follow-report.json and -approach-diagnostic.json retain
  a20,440ms sequence,27,726ms total,239samples/24visible-ally samples and one
  natural death. approach-{0s,5s,10s,15s,20s}.png;5s/10s inspected at full size:
  sign/solid bend, then teammate entering B. No bot, position, health, clock or
  support event injection. Eye-ray samples are not pixel-visibility acceptance.
- Paired .inspect/session70-pumps-{before,after}-undertow-maintenance.png,
  same camera, reviewed at full size. The former distant firing slit is now
  a signed, solid pump return. Final overview and stress stills also retained.
- Reproduce: node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom
  --assert-approaches --prefix session70-review. Every input is normal W/Shift/look;
  captured deaths and lost contact are preserved. Zero console errors.
- Intended player sentence: "We can slip behind the pumps and breach B together."
  Design intent, not a human testimonial or a claim that AAA acceptance is done.

Matched1920x1080 balanced/DPR1 Undertow stress, RTX5070/ANGLE D3D11:
11remote actors plus local viewmodel,145twelve-rifle volleys,96blasts/15s and
3s drain. No build/test/bake or second browser alongside either matched sample
or either final hitch run. These figures do not establish laptop iGPU, thermal,
cold-driver, deployed room cost, real6v6 or RTT feel.

| Measurement | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |207 /156592|208 /157818|+1 /+1226|
| Textures / estimated MiB |25 /60.6055|25 /60.6055|0 /0|
| Programs / geometries / prepared instance slots |29 /164 /625|29 /166 /625|0 /+2 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Maximum / first-ready ms |7.5 /7.1|7.7 /7.1|+0.2 /0|
| Construction / preparation ms |52.8 /595.2|47.2 /627.0|-5.6 /+31.8|
| Assets including README bytes |26696582|26785221|+88639|
| Client JS / source map bytes |2084840 /4625864|2085348 /4627147|+508 /+1283|
| Entire public bytes |33407894|33498324|+90430|

Public31.9465MiB stays below40MiB, largest file7183364bytes below25MiB.
Binary asset delta is86906bytes; other asset bytes are provenance text. Same
per-map lazy loads, no new dependency/light/pass/per-frame bake. Four blast
lights remain fixed. Meshy0credits;1530reported balance unchanged: these solid
architectural returns need exact procedural collision envelopes, not hero props.
Timing deltas are sample variability, not a claimed speedup. Reproduction/data:
.inspect/session70-summarize.mjs and session70-summary.json.

Final gates:

- pnpm typecheck PASS; pnpm test PASS(607passed/6existing skips);
  pnpm build:client PASS; pnpm audit:assets PASS. Full session70-{typecheck,
  test,build-client,audit-assets}.log; static-gates.json records final exits.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors/forbidden requests. session70-required-report.json,
  required-{relay,practice-two}.png and required.log retain the run.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS:117,443.9ms/16,904frames/two natural deaths. Two slow frames26.5ms at26ms
  and47.4ms at45.703s retained; no>150ms frames, long tasks, recompiles or errors.
  session70-hitch-final.json/log. No gate/profiler/setup change.
- Supplementary changed-mode DOM PASS:102,775.7ms/14,800frames/two deaths,
  no>24ms frames, long tasks, recompiles or errors. session70-hitch-dom.json/log
  and supplementary-gates.json. The earlier traced FFA FAIL remains unresolved;
  these passes are not a universal GPU-stall fix.
- Refreshed .inspect/session70-reference-audit.json/mjs via unchanged
  tools/reference-audit.ts. All maps150x100m/1250m2per-seat; rotations within
  10-15s. ADS250/200/225/400/165ms, sprint recovery120/100/130/150/90ms,
  respawn3s, hostile foley1.4, hit/kill pips and two damage cues retained.
  DOM4/8s capture,1point/2s/flag,no side swap,78hipFOV and top-right feed remain
  mismatches. No reference or performance target silently relaxed.

Open owner questions/defaults: keep the covered B approach and signs(yes);
retain existing combat stats(yes); prioritize the now-documented fast northern
exit contacts next(yes). No answer blocks continuing work. Human squad tactics,
first-play excitement, sightline/camping balance, mouse/audio/RTT and iGPU remain
open. The local B gain does not erase the fast-respawn regression or GPU failures.

Cleanup: verified root PID/start time and each descendant identity, then stopped
the owned12-process preview tree (six explicit stops, six already exited).
.inspect/session70-preview-tree.json and session70-cleanup.json record zero
owned processes,8796 listeners or inspection browsers remaining.
Final scope/reference audit: session70-final-audit.json. All63 canonical rows
appear once, one Session70 entry, clean diff check and only apps/ironsight/**
changes on ironsight-aaa. No commit, push or deployment. Six required gates
and changed-mode DOM green; the preflight FFA GPU failure and fast-respawn
regression remain explicitly open.

### Session 71 - 2026-09-10: Breakwater arc 1/1 - regroup before the court

Read the standing brief, Session 71 supervisor status, plan and all 63 design
reference principles. Entry branch ironsight-aaa was clean. Supervisor confirms
Session 70 commit ab1fb9e and preview deployment b38297af-9ec2-4b05-988a-74842a118371.
This session is a local candidate only; no commit, push or deployment.

Reference: R-M03/04/07/09/10/12/13/20, R-L04/11/14/16.
Targets: block the five recorded fast northern-exit firing lines with visible
full cover, retain two standing bypasses/peeks, keep shortest rotations at
10-15 seconds and preserve split objectives, pump approaches and ordinary
combat rules. The bounded cover/navigation checks pass. The overall 20-30 second
contact target remains NOT MET. Re-reviewed all 63 scorecard rows and re-ranked
the gap list; human pacing, camping fairness and excitement remain unaccepted.

GPU preflight and measurement discipline:

- The unchanged traced FFA preflight passes: 36,796.3 ms, 5,297 frames and two
  natural deaths. One 24.7 ms frame at 662 ms; no >150 ms frame, JS long task,
  shader change or console error. Retained session71-hitch-preflight-ffa.json,
  .log and -trace.json. Existing --trace/--diagnostic-timing options only.
- This does not resolve Session 70's 814.7 ms ANGLE stall or the earlier
  mid-combat FFA/DOM failures. No renderer workaround, changed preparation wait,
  frame exclusion, profiler change or favorable-run retry loop was introduced.
- No bake, build, test or second inspection browser overlapped either matched
  stress sample or an acceptance hitch measurement. Original 500 us sampling,
  startup frames, 150 ms assertion and two-death requirement are unchanged.

Delivered, Breakwater 1/1 complete and on by default:

- Read all five Session 70 fast lives and their nearest one-second movement
  samples. Spawns were hidden; first damage occurred in the second northern
  crossing at z=27.5, with threats moving through the inner lane. The older
  exit screens blocked the home-court ray but left this lateral strip exposed.
  Nearby telemetry threats are candidate lines, not claimed exact shooters.
- Two mirrored 2 x 3 x 8 m machinery baffles at x18-20 and x130-132, z24-32,
  screen that strip. Each has a clear standing bypass and firing peek at both
  ends. Their collision tiles feed server movement/hits, client prediction,
  navigation, spawn checks and the original procedural render kit.
- Protected faces carry A / WEST CONTROL and C / EAST CONTROL signs using the
  existing signage atlas and opaque material. The new cover supports regrouping,
  route choice and destination recognition in the same space. It creates no
  floor tier, invisible wall or cosmetic opening.
- Rebuilt ground AO at 2048 x 1365 (13.65 px/m) and architecture AO at 1024
  square. Audit verifies 88,924 oriented triangles, zero degenerates, finite UVs,
  ten material primitives, one embedded AO image and maximum normal component
  error 0.000301. Exact original winding retained. Provenance and reproduction
  commands are in public/assets/README.md; existing asset allowlists suffice.
- Two new regressions check all five measured line fixtures and their mirrors,
  standing/crouched eyes, both gallery states, capsule clearance and bypass/peek
  rays. Existing all-spawn navigation, B-approach, deck, rifle-lane and rotation
  tests pass. No bot stat, spawn score/protection, weapon, timer, map event,
  schema/state-version or protocol change; no existing assertion weakened.

Three matched natural twelve-bot DOM rounds, unchanged 300 second rules:

| Seed | Before -> final red:blue | Kills before -> final | Initial p50 s before -> final | Respawn p50 s before -> final | Contacts <5s before -> final |
|---|---|---|---|---|---|
|170684|177:162 -> 165:195|97 -> 102|17.1 -> 17.1|16.7 -> 17.7|2 -> 0|
|170685|166:184 -> 193:159|101 -> 97|18.0 -> 18.0|18.4 -> 18.1|1 -> 0|
|170686|184:158 -> 146:189|100 -> 102|18.1 -> 18.1|17.2 -> 18.7|2 -> 0|

All six rounds run 300 seconds. Initial observed/censored counts are 12/0 in
every round; respawns before 91/6,92/8,90/7 and final 92/8,87/8,90/11. Quantiles
use the existing lower empirical p50; absent contacts remain censored. Gallery
visitors 2/3/4 -> 2/4/3. Four-plus same-flag assignments with at least two
unfinished flags remain zero. No many-round side win rate or human 6v6 claim.

The fixed opening B cohort retains contact near its objective: first damage
within 12 m rises 4/3/4 -> 4/4/4. B-assignment samples behind the pumps rise
245/277/291 -> 284/279/318; exposed cross-lane samples are 1/1/1 -> 1/1/6.
The last seed is worse on that secondary measure. Initial medians do not improve,
and one respawn median decreases. Zero sampled fast respawns is a bounded gain,
not an overall pacing or safety guarantee. No discarded seed or retuned combat.

Evidence: .inspect/session71-baffles-{170684,170685,170686}-bot-{round,debug}.json
and -bot-heatmap.svg; session71-baffles-comparison.json and -routes.json. Baseline
is Session 70's retained same-seed reports. Reproduce with UNDERTOW_METRICS=1,
METRICS_SEED and METRICS_PREFIX, then pnpm exec vitest run
test/undertow-metrics.tool.test.ts. Existing scripts/dom-orders-summary.mjs and
objective-approach-summary.mjs compare session70-pumps to session71-baffles.

Wow check and rejected alternatives:

- Paired session71-exit-{before,after}-undertow-home.png use the same camera
  (5,1.65,27.5 looking toward 26.5,1.65,26.35) and fixed offline operator.
  Reviewed both at full size: the former visible operator/firing slit is now
  hidden by solid signed machinery. These are offline fixtures, not live state
  injection or proof of every angle. Matching reports have zero console errors.
- session71-wow-report.json retains a 20,414 ms normal DOM capture with 217
  samples and all four route stages reached; A arrival at 11,132 ms. Reviewed
  breakout-stage-2 and breakout-10s at full size: the destination sign and allied
  movement around the baffle, then teammates in A's court. Also retained
  breakout-{0s,5s,10s,15s,20s}, all stage stills and the log. Zero natural deaths
  in this short showcase; it is separate from the two-death acceptance probe.
- Reproduce with node scripts/inspect-map.mjs --url http://localhost:8796
  --shots dom --assert-breakout --prefix session71-review. The unchanged driver
  uses normal W/look input. No health, position, bot, clock, shot or support-event
  injection. Offline still command is in the asset provenance entry.
- Intended player sentence: "I can regroup behind this machinery, then choose
  which side to push." Design intent, not a human testimonial or AAA acceptance.
- No geometry intermediate was rejected: the first bounded baffle candidate
  passed the retained rays, navigation and matched rounds. Timer/health changes
  were rejected as an approach because exposure was spatial. No generated hero
  prop was needed for these exact collision envelopes. Prior GPU failures stay
  in the log; this session supplies no claimed GPU fix.

Matched 1920 x 1080 balanced/DPR 1 Undertow stress, Edge 152.0.4191.66,
RTX 5070/ANGLE D3D11: eleven remote actors and the local viewmodel, 145
twelve-rifle volleys, 96 blasts over 15 seconds and a three-second drain.

| Measurement | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |208 / 157818|209 / 159284|+1 / +1466|
| Textures / estimated MiB |25 / 60.6055|25 / 60.6055|0 / 0|
| Programs / geometries / prepared instance slots |29 / 166 / 625|29 / 168 / 625|0 / +2 / 0|
| Median / p95 / p99 ms |6.9 / 7.1 / 7.1|6.9 / 7.1 / 7.1|0 / 0 / 0|
| Maximum / first-ready ms |7.3 / 7.1|7.3 / 7.1|0 / 0|
| Construction / preparation ms |76.0 / 968.1|77.8 / 947.0|+1.8 / -21.1|
| Assets including README bytes |26785221|26899692|+114471|
| Client JS / source map bytes |2085348 / 4627147|2085440 / 4627656|+92 / +509|
| Entire public bytes |33498324|33613396|+115072|

Public 32.0562 MiB remains below 40 MiB; largest file 7,183,364 bytes remains
below 25 MiB. Binary asset delta 112,760 bytes; the remaining asset bytes are
provenance text. Same per-map lazy loading, fixed four blast lights, no new
dependency, light, pass or per-frame bake. Meshy spend zero; reported balance
1,530 unchanged. Timing differences are sample variability, not a GPU speedup
or laptop iGPU/thermal/cold-driver/real-6v6/RTT acceptance. Data/reproduction:
.inspect/session71-{before,after}-report.json and session71-summarize.mjs /
session71-summary.json.

Required final gates:

- pnpm typecheck PASS; pnpm test PASS (609 passed, six existing skips;
  76 passed files/four skipped); pnpm build:client PASS; pnpm audit:assets PASS.
  Full session71-{typecheck,test,build-client,audit-assets}.log and
  session71-static-gates.json retain the command results.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796
  --shots relay,practice-two PASS; zero console errors/forbidden requests.
  session71-required-report.json, required-{relay,practice-two}.png and
  required.log retain the run.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000
  .inspect/hitch.json --assert PASS: 105,414.2 ms, 15,179 frames and two natural
  deaths. No >24 ms frame, long task, shader recompile or console error.
  Original hitch.json plus session71-hitch-final.json/.log retain the run.
- Refreshed session71-reference-audit.json/mjs via unchanged reference-audit.ts:
  all maps 150 x 100 m / 1,250 m2 per seat; rotations unchanged within 10-15s.
  ADS 250/200/225/400/165 ms, sprint recovery 120/100/130/150/90 ms, respawn 3s,
  hostile foley 1.4, hit/kill pips and two damage cues retained. DOM 4/8s capture,
  one point/2s/flag, no side swap, 78 hip FOV and top-right feed remain reference
  mismatches. No timing or performance target silently relaxed.

Open owner questions/defaults: keep the signed northern baffles (yes); keep both
peeking exits and ordinary combat stats (yes); inspect opening A/C contacts next
(yes). No answer blocks continued work. Human court counterplay, first-play
excitement, colour/aim/audio/RTT and iGPU remain open. The bounded fast-respawn
gain does not erase overall contact timing or historical GPU failures.

Supplementary changed-mode check and final cleanup:

- Ordinary DOM FAIL: 91,859.2 ms / 13,180 frames / two natural deaths. One
  343 ms frame at 36,674 ms coincides with the first death; 323 of 334 V8
  samples in that gap are idle. No JS long task, shader change or console error.
  Retained .inspect/session71-hitch-dom.json/.log. This is consistent with the
  prior idle-heavy failures, but this untraced run does not prove a GPU cause.
- One diagnostic DOM follow-up with existing --trace/--diagnostic-timing
  options: 101,378.1 ms / 14,600 frames / two deaths, no >24 ms frame, long task,
  shader change or console error. It does NOT reproduce the trigger and does
  not replace the ordinary failed run. session71-dom-diagnostic.json/.log,
  -trace.json and -trace-summary.json retained. No further retry or renderer
  change; the evidence does not justify reviving rejected HUD/fence workarounds.
- Verified the preview root PID/start time and each descendant identity, then
  stopped the owned twelve-process tree (five explicit stops, seven already
  exited). session71-preview-tree.json and session71-cleanup.json record zero
  owned processes, port8796 listeners or inspection browsers remaining.
- Final scope/reference audit is session71-final-audit.json: all63 canonical
  rows appear once, one Session71 log entry, clean diff check, only
  apps/ironsight/** changes on ironsight-aaa. No commit, push or deployment.
  Six required gates are green for their exact runs. Additional ordinary DOM
  remains FAILED; neither its later diagnostic pass nor the static stress
  comparison establishes all-mode or universal hitch acceptance.


### Session 72 - 2026-09-10: Field Honors arc 1/1 - make teamwork count

Read the standing brief, Session 72 status, plan and all 63 reference principles.
Entry branch ironsight-aaa was clean. Supervisor confirms Session71 commit
b43589e and preview deployment9ca634cc-7102-4bca-876e-60b85a215dd9. This session
is a local candidate only; no commit, push or deployment.

Reference: R-L06/07/14/16/17, R-M07/20. Targets: server-selected winning-side
MVP using2/kill+1/assist, plus useful objective contribution; show why the
operator won, preserve mute/Reduced motion and rematch controls, add no render
pass/light/texture. The implemented MVP checks pass. R-L06 replay remains
NOT MET; no replay arc is claimed. All63 scorecard rows re-reviewed and the gap
list re-ranked after the opening-contact audit.

Preflight and gap choice:

- Unchanged traced DOM preflight PASS:94,745.7 ms/13,643 frames/two natural deaths,
  no>24 ms frame, long task, recompile or error. Existing --trace and
  --diagnostic-timing only. session72-hitch-preflight-dom.json/.log/-trace.json.
  It does not reproduce or resolve Session71's343ms or older ANGLE failures.
- Read-only session72-opening-audit.mjs/json retains all36 initial lives and
  original orders. Northern attackers bot6-9 contact at13.8-20.3s, all near
  z19.5; red home guard bot1 waits36.7/54.4/104s. This mixed failure argues
  against another uniform cover/timer patch. Preserve it for a role/route arc.
- Selected the next bounded spectacle gap after that pacing check. Existing
  geometry, bot tactics/stats, spawns, movement, weapons, map events, timers,
  mode scoring and wire schema remain unchanged. No claim of improved pacing.

Delivered, Field Honors1/1 complete and on by default:

- RoundHonors tracks only server-attributed assists and actual uncontested
  capture-gauge movement. Divide progress equally among the living capturers;
  clipping at ownership credits only the movement that occurred. Idle ownership,
  contested flags and crowding cannot multiply credit. Whole accumulated shared
  capture seconds count1 each; kills count2 and assists1. These are presentation
  points, never match score, streak credit, health or ammunition.
- Select among seated members of the winning team; FFA uses the actual winner
  id. Draws, practice, zero-contribution and missing-winner cases omit the card.
  Tie order: capture credit, assists, fewer deaths, then stable id. Bots and
  humans follow the same rules. Departed seats are ineligible, matching the
  existing seated-roster contract. Death preserves round contribution; seat
  expiry/bot removal clears it and reset/cold new-round clears the tracker.
- Add optional mvp to the existing matchEnd event. The plain frozen result is
  retained for syncView, including after its operator leaves. No per-tick
  contribution payload, codec/state-version change or client scoring input.
  Old clients ignore the addition; new clients omit honors against old servers.
- Amber FIELD HONORS card: original inline vector commendation seal, operator,
  local YOU marker, elimination/assist/capture breakdown and explicit impact
  formula. Short480ms entrance; vote updates retain focus/scroll and do not
  replay it. Reduced motion retains all information without the entrance.
- One resolved four-note triangle sting,196/293.66/392/493.88Hz, through the
  existing mute/volume bus; last source stops within840ms and disconnects.
  One cue per observed ended round, no replay on syncView or queued unmute.
  This is synthesized audio, not a new media file; headphone comfort is open.
- Seven new tests: objective-led winner, useful-progress conservation/clipping/
  contest/dead occupants, invalid assist filtering, deterministic/frozen result,
  FFA eligibility, room capture/resync/forged input/reset, and a real gun-assist
  TDM winner. Existing assertions and production rules retained.

Three matched natural twelve-bot DOM rounds:

| Seed | Red:blue | MVP | K / assists / capture seconds | Impact |
|---|---|---|---|---:|
|170684|165:195|bot-8 (blue)|15 /2 /18|50|
|170685|193:159|bot-9 (red)|15 /4 /25|59|
|170686|146:189|bot-4 (blue)|15 /2 /32|64|

All300s. Exact JSON comparisons against Session71 pass for scores, duration,
every life/contact sample, kills, gallery, objective movement samples and heatmap
cells. Each natural MVP is also that side's kill leader; these three outcomes
alone do NOT demonstrate objective-led selection. The zero-kill capture-room
test and actual gun-assist test cover that behavior. No human scoring/balance
acceptance. Evidence: session72-honors-{170684,170685,170686}-bot-{round,debug}.json,
-bot-heatmap.svg, logs and session72-rounds-comparison.json. Reproduce using the
existing UNDERTOW_METRICS/METRICS_SEED/METRICS_PREFIX opt-in test, then
.inspect/session72-compare-rounds.mjs. The tool adds read-only final MVP evidence.

Wow check, visual review and rejected intermediates:

- Paired session72-before-match-victory.png / session72-after-match-victory.png
  retain the same offline roster/camera. Full-size before and new DOM desktop/
  narrow stills reviewed. The DOM fixture awards Sable12kills+7 assists+16s=47,
  ahead of the displayed sixteen-kill operator. Fixture, not a live achievement.
- Ten final results fixtures pass: victory/defeat, DOM desktop/1280x600/390x844/
  Reduced motion, FFA, draw, old-server absence and rematch vote. Names/id escape,
  stable markup, whole-roster retention, horizontal fit and reachable controls
  pass. session72-after-report.json has zero errors/forbidden requests.
- Natural workerd DOM capture:327,292 ms total,1178 samples, seven natural deaths,
  normal W/look only. Final173:152; server MVP bot4/ANCHOR4 has14kills,2 assists,
 23shared capture seconds and53impact. Card id, winning team, kills and formula
  match the received matchEnd payload. Full-size5s still reviewed.
- session72-dom-natural-honors-{0s,5s,10s,15s,20s}.png and -honors.json retain
  a20,209 ms end-screen sequence. All five samples remain ended: automatic
  warmup was NOT captured in this sequence. Room reset tests pass separately.
  No position, health, timer, result, support or bot injection. Reproduce with
  node scripts/inspect-map.mjs --url http://localhost:8796 --shots dom
  --assert-honors --prefix session72-review. The full round is showcase evidence,
  not frame-time acceptance; static tests/metric tools ran during part of it.
- Rejected first driver: a unique arena-dom-honors id resolved to TDM, since DOM
  matches arena-dom exactly. Stopped it, confirmed no inspection processes left,
  removed the routing override and added a mode2 assertion. Retained
  session72-natural.log and session72-rejected-capture.json. No production
  resolver or room-rule change. Corrected ordinary DOM run is separate evidence.
- Initial full suite failed one NEW gun-assist fixture: it fired before the
  scripted positions entered lag history. Retained session72-test-initial-failed.log;
  added the same150ms fixture history setup used by existing hitscan tests.
  Targeted test and final suite pass; no combat gate was relaxed.
- Intended player sentence: "Those captures helped me earn MVP."
  Design intent, not a human testimonial or completed AAA acceptance.

Matched1920x1080 balanced/DPR1 Undertow stress, RTX5070/ANGLE D3D11:
eleven remote actors plus local viewmodel,145twelve-rifle volleys and96blasts
over15s, then3s drain. Neither matched stress sample overlapped a build/test,
another inspection browser or an acceptance hitch probe.

| Measurement | Before | Final | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |209 /159284|209 /159284|0 /0|
| Textures / estimated MiB |25 /60.6055|25 /60.6055|0 /0|
| Programs / geometries / prepared instance slots |29 /168 /625|29 /168 /625|0 /0 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.2|6.9 /7.1 /7.1|0 /0 /-0.1|
| Maximum / first-ready ms |7.7 /7.1|7.3 /7.1|-0.4 /0|
| Construction / preparation ms |76.9 /975.4|76.9 /1046.9|0 /+71.5|
| Assets including README bytes |26899692|26899692|0|
| Client JS / source map bytes |2085440 /4627656|2092721 /4638576|+7281 /+10920|
| Entire public bytes |33613396|33631597|+18201|

Public 32.0736 MiB remains below40MiB; largest7,183,364 bytes below25MiB. No new
asset/license/allowlist, dependency, texture, GL material, light, pass or bake.
Fixed four blast lights and per-map lazy loads retained. Meshy 0credits;
reported 1530balance unchanged: the commendation is code-native vector UI.
Timing deltas are sample variability, not a speedup or laptop iGPU/thermal/
cold-driver/real6v6/RTT acceptance. session72-{before,after}-report.json and
session72-summarize.mjs/session72-summary.json retain reproduction/data.

Static/reference and inspection gates:

- pnpm typecheck PASS; pnpm test PASS(616 passed/six existing skips;
 78 passed files/four skipped); pnpm build:client PASS; pnpm audit:assets PASS.
  session72-{typecheck,test,build-client,audit-assets}.log and static-gates.json.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796
  --shots relay,practice-two PASS, zero console errors/forbidden requests.
  session72-required-report.json/.log and required-{relay,practice-two}.png.
- Refreshed tools/reference-audit.ts output: session72-reference-audit.json/mjs.
  All maps150x100m/1250m2per-seat and existing10-15s rotations retained;
  ADS 250/200/225/400/165 ms, sprint recovery120/100/130/150/90 ms, respawn 3s,
  hostile foley 1.4, hit/kill pips and two damage cues unchanged. DOM4/8s capture,
  1point/2s/flag, no side swap,78hipFOV and top-right feed remain mismatches.
  Capture MVP credit describes actual rules; it does not change the economy.

Final hitch validation and cleanup:

- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000
  .inspect/hitch.json --assert PASS: 94,221.4 ms / 13,567 frames / 2 natural deaths.
  0 frames >24 ms, 0 frames >150 ms, 0 long tasks, 0 shader changes, 0 console errors.
  Original hitch.json plus session72-hitch-final.json/.log and hitch-gate.json.
- Additional ordinary DOM through results PASS: 312,302.6 ms / 44,968 frames / 9 natural deaths.
  1 frames >24 ms, 0 frames >150 ms, 0 long tasks, 0 shader changes, 0 console errors. Final phase ended,
  score 148:173. Existing command:
  node scripts/hitch-probe.mjs http://localhost:8796 360000
  .inspect/session72-hitch-dom-ended.json --assert --mode=dom --until-ended.
  This extends the measured round through the end screen; it does not alter
  profiling, preparation, the150 ms assertion or any frame exclusions.
  Retained JSON/log, ended.png and session72-supplementary-gates.json.
  The sole slow frame is 24.4 ms at 306,445 ms. Reviewed the ended still at
  full size: ANCHOR 9 earns 57 impact from 14 kills, 3 assists and 26 shared
  capture seconds, ahead of RUSH 1's 15 kills. This ordinary round demonstrates
  a winning MVP who is not the kill leader; it is not human scoring acceptance.
- No build/test, bake or second inspection browser overlapped either matched
  stress sample or any acceptance hitch measurement. The owned preview was
  restarted once after static work, before the final measurements, to close
  the earlier capture/room processes. No renderer or profiler workaround.
- Historical first-death/mid-combat GPU failures remain unresolved. These
  per-run results do not establish universal, iGPU or real6v6 acceptance.
- Verified preview root and descendant PID/start identities, then stopped
  the final 8-process tree. session72-preview-final-tree.json and
  session72-cleanup-final.json record 0 owned processes, 0 port8796 listeners
  and 0 inspection browsers remaining. Initial-tree cleanup is separately
  retained in session72-cleanup-first.json. No commit, push or deployment.
- session72-final-audit.json checks all 63 unique canonical reference rows,
  one Session 72 log entry, clean diff and only apps/ironsight/** changes on
  ironsight-aaa. Six required gates green; supplementary DOM green.


Open owner questions/defaults: keep useful objective progress in MVP(yes),
keep honors separate from score/streak/resource rewards(yes), preserve immediate
rematch controls(yes). No answer blocks development. Human ranking fairness,
first-play excitement, headphone comfort, controller/colour/RTT and iGPU remain
open. Next route arc should address fast attackers and quiet guards separately;
actual highlight replay remains a distinct unimplemented feature.

### Session 73 - 2026-09-10: Next Deployment arc 1/1 - a visible return to play

Read standing brief, Session73 status, plan and all63 reference principles.
Entry ironsight-aaa was clean. Supervisor confirms Session72 commit9a55e3d
and deployment668fc137-9740-4ef6-84f3-86270c4f9ca6. Local candidate only;
no commit, push or deployment. Scope remains apps/ironsight/**.

Reference: R-L05/07/14/16. Target: one authoritative intermission deadline,
remaining seconds for initial/late subscribers, majority skip, stable keyboard
focus and a server-confirmed transition at zero. Implemented checks pass.
R-L05 remains partial:20s skippable results rather than5-8s freeze. R-L06
replay remains absent. Re-reviewed all63 scorecard rows; encounter pacing
and replay remain larger priorities. The supervisor's short remaining window
selected this bounded flow item after preflight; no rushed role/route change.

Delivered, Next Deployment1/1 complete and ON:

- Optional intermissionEndMs on matchEnd and its frozen syncView result.
  Server expiry uses that same epoch deadline on the next simulation tick,
  matching warmup's clock model. Existing tick-rounded duration and majority
  vote remain. Delayed ticks no longer extend results by missed tick counts.
- NEXT DEPLOYMENT / IN Ns below Field Honors uses the shared client clock
  and ceiling-rounded seconds. Zero says AWAITING SERVER; no local reset.
  Older-server absence uses AUTOMATIC / STAND BY without inventing a deadline.
  Existing connection UI supersedes results while offline.
- Only textContent changes with the countdown. Result tree, MVP card, scroll
  and focused buttons survive. Mute/Reduced motion retain all information.
  No new animation, audio, texture, material, light, pass or per-frame bake.
- Three new tests cover late/forged deadlines, exact boundary, delayed tick,
  majority vote, rounding and older-server fallback. Existing exact late-result
  assertion now includes the actual deadline. Initial full suite failed only
  that outdated expected object; session73-test-initial-failed.log retained.
  The assertion was extended, not weakened to ignore the field.

Wow check: paired .inspect/session73-{before,after}-match-dom.png use the
same fixed offline roster. Reviewed desktop before/after and390x844 after
at full size: the previously unspecified wait now reads NEXT DEPLOYMENT / IN13s.
Eight final fixtures cover desktop,1280x600,390x844, Reduced motion, zero,
older server, FFA and draw. They assert13->12s with identical DOM/focus and
no local start after zero. Before/after evidence uses the brief's stills option;
these are offline fixtures, not injected gameplay or a natural result recording.
Reproduce with node scripts/inspect-map.mjs --url http://localhost:8796 --shots
match-dom,match-dom-short,match-dom-narrow,match-dom-reduced,match-dom-standby,match-legacy,match-ffa,match-draw
--prefix session73-review. Final reports/logs/stills use session73-after.
Intended player sentence: "I know when we are going back in, and we can vote to go sooner."
Design intent, not a testimonial or AAA spectacle acceptance. Rejected approach:
a client-local20s timer would mislead late subscribers and diverge during stalls.
No visual intermediate or generated asset was needed for this code-native UI.

Matched1920x1080 balanced/DPR1 Undertow stress, RTX5070/ANGLE D3D11,
11remote operators plus local weapon,145twelve-rifle volleys and96blasts/15s:

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |209 /159284|209 /159284|0 /0|
| Textures / estimated MiB |25 /60.6055|25 /60.6055|0 /0|
| Programs / geometries |29 /168|29 /168|0 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Maximum / first-ready ms |7.2 /7.1|7.2 /7.2|0 /+0.1|
| Assets including README bytes |26899692|26899692|0|
| Client JS / source map bytes |2092721 /4638576|2095006 /4642253|+2285 /+3677|
| Entire public bytes |33631597|33637559|+5962|

Public32.0793MiB remains below40MiB; largest7,183,364bytes below25MiB.
No dependency, purchased derivative, provenance/allowlist or lazy-load change.
Fixed four blast lights retained. Meshy0credits; reported1530balance unchanged.
Timing variation is not a speedup or iGPU/thermal/real6v6 acceptance.
Data/reproduction: .inspect/session73-summarize.mjs, session73-summary.json
and session73-{before,after}-report.json/logs. No build/test, second inspection
browser or bake overlapped stress or acceptance hitch measurements.

Required gates and limits:

- Unchanged TDM preflight PASS:98,986.3ms/14,254frames/two natural deaths,
  zero>24ms frames, long tasks, shader changes or errors. session73-preflight.json.
  It does not reproduce or resolve the historical DOM/GPU failures.
- pnpm typecheck PASS; pnpm test PASS(619passed/six existing skips,
  79passed files/four skipped); pnpm build:client PASS; pnpm audit:assets PASS.
  session73-static-gates.json and session73-{typecheck,test,build-client,audit-assets}.log.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors. session73-required-report.json/log retains it;
  default relay-{relay,practice-two}.png images. Eight results fixtures and
  matched stress also have zero errors/forbidden requests.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS:69,053.6ms/9,944frames/two natural deaths, zero>24ms or>150ms frames,
  long tasks, shader changes or console errors. Original hitch.json and
  session73-hitch-final.json/log retained. No profiler, threshold or frame exclusion change.
- Static map/combat measurements remain those in session72-reference-audit.json:
  no map, movement, ADS, sprint recovery, respawn, scoring, audio or damage
  change. Known DOM economy/FOV/killfeed mismatches remain documented.
  This session makes no all-mode, human, iGPU or universal hitch claim.

Open owner questions/defaults: keep shared countdown(yes), preserve20s and
majority skip until a larger flow arc(yes), retain still results while replay
remains unimplemented(yes). No answer blocks progress. Human excitement,
encounter pacing, replay, colour/audio/RTT and laptop iGPU remain open.

Final cleanup: verified preview root PID/start time at the persisted millisecond
precision and every descendant's creation identity, then stopped the owned
12-process tree. session73-preview-tree.json and session73-cleanup.json record
zero port8796 listeners and zero inspection browsers remaining. Two earlier
identity checks stopped without killing anything because PowerShell decoded
the saved date automatically and serialized it at millisecond precision;
the corrected comparison used Unix milliseconds. All six required gates green.
Final diff check passes, all63 unique canonical reference rows and one Session73
log entry remain, and only apps/ironsight/** is changed on ironsight-aaa.
No commit, push or deployment.

### Session 74 - 2026-09-10: Raster Budget 1/1 — damage feedback and an explicit hitch gate

Read the standing brief, Session74 supervisor status and plan in that order;
re-read all63 design principles. The owner's GPU priority takes this session
ahead of the next material-fidelity arc. Raster Budget1/1 is on by default:
the damage edge uses a baked image and the headless gate has an explicit,
documented host allowance. This does **not** claim the underlying driver freeze
is fixed. The next visual arc starts with Relay ground/concrete/steel.

Reference: **R-L14, R-L21**. Targets: preserve both damage cues and their aiming
corridor at desktop/narrow sizes; Reduced motion keeps direction without flash;
no new lights, WebGL passes or live
shader/resource churn; trace the stalls; run five consecutive assertions in each
of TDM and FFA under one frozen final policy. R-L21's implementation check is met.
R-L14 remains partial: the host tail is measured and bounded, not player/iGPU
acceptance. All63 canonical rows re-reviewed. A fresh build/run of
`tools/reference-audit.ts` writes `.inspect/session74-reference-audit.json`,
deep-equal to Session72; comparison evidence is retained. Full/waist collider
counts are65/46 Relay,66/62 Undertow,64/48 Switchyard, with no other height
classes. Closed-route sprint A-B/A-C/B-C seconds:14.44/11.78/14.44,
14.22/11.33/14.22,14.44/11.56/14.44 respectively. Spawn-to-objective BFS stays a
travel proxy, not measured first contact. AR/SMG/shotgun/sniper/pistol ADS stays
250/200/225/400/165ms, sprint recovery120/100/130/150/90ms. TDM50kills/300s,
respawn3s, DOM4/8s neutral/enemy capture and0.5point/flag/s remain, without side
swap. Hostile foley1.4, confirmed hit900/1400Hz at.28gain, and the five-row
top-right feed remain. Existing DOM economy, encounter, FOV, killfeed and
human-review gaps stay open.

What changed:

- `client/hud.ts` replaces the animated90px blurred inset damage shadow with an
  original384x384 RGBA PNG,128px nine-slice border and opacity transition.
  Flash/direction lifetimes, victim-only bearing and Reduced motion remain.
  Identical HP, scores, mode, grenade and leaderboard data retain their DOM nodes.
  Changed data still updates; escaping stays in the leaderboard path.
- `tools/bake-damage-vignette.mjs` reproduces the18,491-byte image with Node's
  built-in zlib. Explicit asset allowlist, provenance and page preload added.
  No purchased derivative, new dependency or Meshy generation:0credits spent,
  reported balance1530 unchanged.
- `scripts/hitch-gpu-diagnostics.mjs` adds opt-in per-frame submitted draws,
  unique materials, transparent draws, texture/buffer submissions, resource
  creation, shader links, shadow requests and render-target draws. Transparent
  draw counts are an overdraw proxy, not a GPU pixel-work measurement. Nothing
  is bundled into production; no GPU fence/readback or renderer setting changes.
- `--stop-on-spike` exports a diagnostic at the original150ms trigger before
  its rolling trace is overwritten. It may lack two deaths and is not acceptance.
  The trace reader now checks the renderer's retained range before claiming
  coverage, and reports thread CPU separately from wall time.
- `scripts/hitch-policy.mjs` and `docs/HITCH-GATE.md` deliberately change the
  **headless presentation ceiling150->1500ms**, using the owner's2026-09-10
  compositor/driver exception. Independent bounds are150ms main-thread callback
  or long task,25ms whole-ms p99, and at most5% of measured time in>150ms gaps.
  Shader-count/cache-key additions after3s, console errors and fewer than two
  natural deaths still fail.500us sampling, browser flags and all measured
  frames remain. Every>150ms interval stays in `summary.spikes`, even on PASS;
  no interval is automatically labelled a driver fault. Eight policy regression
  cases include the old shader failure, sustained30fps and repeated one-second
  freezes that a frame-count percentile alone could miss.

Diagnosis and rejected intermediates (all retained, no cherry-picked replacement):

- Original FFA/TDM controls passed, then `session74-repro-2.json` captured887.4ms.
  Its rolling trace had lost the early GPU window; it is not attribution proof.
- Covered `session74-trigger-2-trace-summary.json`:166.5ms at first damage,
  preceding game render about1ms/36calls/29materials. Chromium raster worker
  177.164ms wall/7.243ms CPU; ANGLE pixel executable170.162ms wall/2.878ms CPU.
  No shader/resource/pass churn. The live blurred edge was a plausible trigger,
  so the baked border removes that work; it is not presented as a complete fix.
- The first ordinary five-pair attempt stopped on FFA pair3:
  `session74-final-ffa-3.json`,1002.6ms at first death plus212.1ms while dead.
  Five prior runs had passed. `.inspect/session74-five-pairs.json` preserves the
  failed sequence and proves why a few clean runs were insufficient.
- Covered `session74-death-trace-2-trace-summary.json`:738.5ms startup gap on
  the baked-border candidate, about1.1ms game rendering/104calls/65materials,
  no GPU allocations, shader links, mipmaps, shadow or target draws.
  Skia FinishPaintRenderPass744.013ms wall/3.121ms CPU waits on ANGLE vertex
  executable742.739ms wall/2.250ms CPU. This is compositor/raster waiting work,
  not evidence of a specific NVIDIA defect. Session65's retained executable
  worker reached about1168ms wall/2.608ms CPU;1500ms is a bounded round margin
  above the observed roughly1.2s host tail, not new rendering headroom.
- Four short hidden-HUD controls and four bare one-triangle controls had no
  spike. Six gradient and five blurred-shadow triangle controls also stayed
  smooth; the latter11 check shader linking and the rendered centre pixel.
  These negative controls do not reproduce or disprove the game/compositor tail.
  Session65 already rejected no-profile/hidden-HUD as universal fixes.
- The first three runs of the revised policy were calibration only. Review
  added the5% wall-time bound while they ran; neither pair1 nor pair2 is counted
  in the final five-pair proof. Final acceptance uses pairs3-7 and identical
  final code/limits. No build, test suite, bake or second browser overlaps them.
- The initial damage fixture used nonexistent `#hpValue`, causing a readiness
  timeout. Corrected to the production `.healthValue`; rejected log and later
  corrected reports retained. No game defect was hidden by the fixture repair.
- Final shell wrapper initially treated esbuild's normal stderr as a terminating
  PowerShell error. Retained `session74-build-shell-error.log`, then completed
  build/audit with actual exit-code checks; typecheck/test had already passed.

Wow check: matched before/after stills at the same cameras, not a testimonial.
Intended player sentence: **"The red edge warns me without covering where I'm aiming."**
This is preservation of combat readability, not a new spectacle claim.

- Damage desktop: [.inspect/session74-before-damage-match-combat-front.png](.inspect/session74-before-damage-match-combat-front.png)
  -> [.inspect/session74-after-match-combat-front.png](.inspect/session74-after-match-combat-front.png).
- Narrow/reduced: corresponding `match-combat-narrow` and `match-combat-reduced`
  stills in those prefixes. These use the inspector's existing static background,
  not a live gameplay screenshot. Both damage cues/reset/Reduced motion and
 60 identical HUD updates pass browser assertions.
- Matched Relay/Switchyard/stress views: `session74-{before,after}-{relay,
  switchyard-relay,undertow-effects-stress}.png` and reports. Six final review
  shots have zero console errors/forbidden requests; stress assertions pass.

Matched1920x1080 balanced/DPR1 Undertow stress on RTX5070 / Edge152 / ANGLE D3D11:

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |209 /159284|209 /159284|0 /0|
| Textures / estimated MiB |25 /60.6055|25 /60.6055|0 /0|
| Programs / geometries / prepared instance slots |29 /168 /625|29 /168 /625|0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.2|0 /0 /+0.1|
| Maximum / first-ready ms |7.2 /7.1|7.8 /7.2|+0.6 /+0.1|
| Construction / asset-and-GPU preparation ms |55.7 /1510.2|52.3 /1913.3|-3.4 /+403.1|
| Assets including README bytes |26899692|26919126|+19434|
| Client JS / source map bytes |2095006 /4642253|2096915 /4645657|+1909 /+3404|
| Entire public bytes |33637559|33662381|+24822|

The PNG adds0.5625MiB decoded browser image memory, separately from Three.js's
estimate. Public remains below60MiB; largest file7,183,364bytes below25MiB.
Map loading and fixed light count stay unchanged. Preparation is a fresh-profile
local sample, not a CDN/download benchmark; timing variation is not an iGPU,
thermal or real6v6 result. Reproduce totals with `.inspect/session74-summarize.mjs`.

Final acceptance (same final policy, five consecutive TDM and five consecutive FFA):

| Pair / mode | Seconds / frames | Max frame / callback ms | p99 upper ms | >150ms frames / time share | Deaths | Gate |
|---|---:|---:|---:|---:|---:|---|
|1 / FFA|35.021 / 4858|872.6 / 10.5|9|3 / 3.51%|2|PASS|
|1 / TDM|68.365 / 9845|9.7 / 5.5|8|0 / 0.00%|2|PASS|
|2 / FFA|77.506 / 11160|14.1 / 5.4|8|0 / 0.00%|2|PASS|
|2 / TDM|105.427 / 15177|21.6 / 8.0|8|0 / 0.00%|2|PASS|
|3 / FFA|56.204 / 8011|491.2 / 5.1|8|1 / 0.87%|3|PASS|
|3 / TDM|96.671 / 13902|73.2 / 6.8|8|0 / 0.00%|2|PASS|
|4 / FFA|48.716 / 6927|614.1 / 4.4|8|1 / 1.26%|2|PASS|
|4 / TDM|92.963 / 13383|14.2 / 7.8|9|0 / 0.00%|2|PASS|
|5 / FFA|107.859 / 15353|914.9 / 5.2|9|2 / 1.09%|2|PASS|
|5 / TDM|60.923 / 8458|1136.3 / 7.2|8|2 / 3.60%|2|PASS|

All runs use ordinary `--assert`, default500us profiling, natural bot play and
at least two deaths, with no shader changes or console errors. The table keeps
the original>150ms gap count visible. These passes validate the **revised host
policy**, not the original150ms maximum and not elimination of driver freezes.
Raw evidence: `session74-validated-{ffa,tdm}-{3,4,5,6,7}.json/log`, consolidated
`session74-acceptance.json`; pairs1/2 and original failures remain alongside them.

Required commands:

```sh
pnpm typecheck
pnpm test
pnpm build:client
pnpm audit:assets
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
```

All six required gates PASS. Tests:627 passed/six existing skips,80 passed files/four skipped.
Static evidence: session74-final-static-gates.json and session74-final-{typecheck,
test,build-client,audit-assets}.log. Exact inspector: session74-final-required-report.json/log
and retained relay/practice-two stills, zero console errors. Exact final hitch:
`.inspect/hitch.json` and session74-validated-tdm-7.json/log,
60.923s/8458frames/2deaths,
2>150ms gaps, maximum1136.3ms,
zero shader changes/errors. Policy and production code were frozen throughout pairs3-7.

Open owner questions/defaults: retain baked damage edge(yes); use the explicit
headless host allowance while investigating player reports(yes, per the brief);
next visual arc begins with Relay tiled ground/concrete/steel(yes). No answer
blocks progress. Human damage comfort, actual driver/root-cause remediation,
mid-laptop iGPU, thermal, real6v6/RTT, Firefox/Safari and overall AAA excitement
remain unaccepted. No latency or room-capacity claim is made.

Cleanup verified preview root PID43408 against its saved Unix-ms start
identity, then every descendant's creation identity before stopping the owned
12-process tree. session74-preview-tree.json and session74-cleanup.json
record zero owned processes, port8796 listeners and inspection browsers remaining.
All changes remain in apps/ironsight/** on ironsight-aaa. No commit, push or deploy.
The supervisor retains publication ownership; this entry does not claim a new preview deployment.
Final diff/scope audit: `.inspect/session74-final-audit.json`;63 unique canonical
reference rows, one Session74 log entry,15 changed files all within the app.

### Session 75 - 2026-09-10: Surface Detail arc 1/3 - Relay's poured yard

Read the standing brief, Session75 supervisor status and plan in order, then
all63 design principles and the current scorecard. Entry branch ironsight-aaa
was clean. Supervisor confirms Session74 commit ed99354 and preview deployment
57a04fdb-5e9c-4d99-b8fd-da67d3fc7ab7. This is a local candidate only, confined to
apps/ironsight/**; no commit, push or deployment.

Reference: **R-L12, R-L13, R-L14**. Targets: replace the stretched first-route
floor with readable metric construction detail; keep environment contrast below
operator/sign masses; retain collision, fixed light count, one opaque pass,
<=64MiB texture residency and <=240 stress draws. Implementation/resource checks
pass. These rows remain partial because human readability, other-map material
work, iGPU and driver acceptance remain open. Surface Detail1/3 is ON by default
for Relay; Session76 targets Undertow wet concrete, Session77 Switchyard steel.
The full arc is not yet complete. No feature flag or owner answer is required.

Delivered:

- Original6x5m slab joints, restrained pour variance,2.4x1.2m concrete formwork
  and recessed tie shading. Joints use metric projected UVs and screen derivatives
  in the existing material shader; subpixel contrast fades at grazing/distant
  views. These are surface marks, not holes, displacement or additional cover.
- A finer0.8m tile:256-square tangent normal plus R8 roughness,320texels/m.
  Concrete receives fine aggregate; coated steel/paint gets a weaker finish.
  Existing paint/AO UVs, palette, signs, silhouettes and all geometry remain.
  Thirteen Relay meshes share two detail textures, up from nine; no new draw,
  light, shadow request, pass or per-frame CPU bake/resource allocation.
- Relay's512-square RGBA ground becomes1024x683 linear R8,6.83texels/m in both
  axes. A material tint restores the base hue. This atlas holds broad aging/AO;
  metric tiles and derivative-filtered joints supply close-range detail. The
  unchanged2048x1365 baked AO is sampled at load. No claim of2048 ground colour.
- Explicit north/south row reversal for typed uploads, and a preparation barrier
  for ground AO. The base remains opaque if optional AO fails; the normal warmup
  now waits for the AO composition rather than allowing a late texture upload.
- Inspector reports atlas/detail formats and dimensions and asserts Relay's
  R8 layout,256px pair, valid UVs and existing resource limits. Two meaningful
  tests cover asymmetric north/south linear-light packing, allocation reuse,
  deterministic fine detail and the combined old/new memory budget.

Wow check uses the brief's **matched before/after stills** option. Fixed production
renderer cameras at1920x1080, reviewed at full size:

- [Relay before](.inspect/session75-before-relay.png) -> [Relay after](.inspect/session75-final-relay.png).
- [Cooling before](.inspect/session75-before-cooling.png) -> [Cooling after](.inspect/session75-final-cooling.png).
- [Freight before](.inspect/session75-before-freight.png) -> [Freight after](.inspect/session75-final-freight.png).
- [Deployment before](.inspect/session75-before-spawn.png) -> [Deployment after](.inspect/session75-final-spawn.png).
- Downward ground pair: session75-before-ground-cooling.png ->
  session75-final-ground-cooling.png, eye52,1.65,25 and look60,0,24.
  Final contrast-team and core-open fixtures retain operator separation and
  the clear collision-backed tunnel; these are offline inspection fixtures.

Intended player sentence: **"The yard looks built from poured slabs and cast panels now."**
This names the delivered visible change, not a player testimonial or overall AAA
acceptance. Natural bot play is covered by the hitch probes below; these paired
art stills do not pretend to be a20-second live round.

Rejected intermediates/evidence: session75-candidate-* retained. The first normal
field read too coarse and the joints stayed too dark far away. Finer noise octaves,
lower coated-surface strength and subpixel coverage improve the final image.
The candidate also used implicit flipY for typed data; final packing explicitly
reverses rows and tests an asymmetric atlas. Two initial typecheck failures
(DOM-only canvas typing in a Node test, then unknown texture.image typing in the
inspection report) are retained in session75-typecheck-{dom,image}-type-failure.log;
both were fixed without weakening checks. A reference-audit shell redirection
wrote UTF16; a Node UTF8 writer corrected the evidence format before comparison.

Matched1920x1080 balanced/DPR1 Relay stress, RTX5070 / Edge152 / ANGLE D3D11:

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |238 /150102|238 /150102|0 /0|
| Textures / estimated MiB |30 /63.9388|30 /63.7448|0 /-0.1940|
| Programs / geometries |33 /165|33 /165|0 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.2|6.9 /7.1 /7.2|0 /0 /0|
| Max / first-ready frame ms |201.4 /7.1|13.9 /7.1|-187.5 /0|
| Stress construction / preparation ms |59.4 /600.3|83.8 /1303.4|+24.4 /+703.1|
| First fresh-profile Relay construction / preparation ms |89.4 /886.3|155.3 /2582.8|+65.9 /+1696.5|
| Assets including README bytes |26919126|26920675|+1549|
| Client JS / source map bytes |2096915 /4645657|2102070 /4655051|+5155 /+9394|
| Entire public bytes |33662381|33678479|+16098|

Both stress runs use11 remote operators plus the local rifle and96 blasts over15s;
143 twelve-rifle volleys before,145 after (the earlier stall loses two cadence
windows). All effects drain. Undertow control retains209calls/159284triangles,
25textures/~60.6055MiB,29programs and6.9/7.1/7.2ms median/p95/p99. Max34.7->14ms.
No clean-run speedup or driver-fix claim: the before201.4ms gap remains evidence.

First fresh-profile local preparation is slower in this sample: construction+
preparation0.976->2.738s, before play. Other final Relay cameras prepare in less
time; these are local browser/driver measurements, not CDN download or iGPU
benchmarks. The new finishes add shader work within the same pass; normal warmup
prepares it. GPU/device acceptance is still required before claiming60fps broadly.
R8 ground+detail uses1.3060MiB vs1.5000MiB previously. Public32.1183MiB remains
below60MiB; largest file7,183,364bytes below25MiB. No new downloaded binary,
dependency, purchased derivative, Meshy spend or per-map request. Reported1530
Meshy balance unchanged. Provenance/reproduction is in public/assets/README.md.
Machine evidence: session75-{before,final}-report.json and session75-summary.json;
reproduce totals with node .inspect/session75-summarize.mjs.

Fresh tools/reference-audit.ts output deep-equals Session74, retained in
session75-reference-audit.json and session75-reference-comparison.json. Cover
full/waist counts remain65/46 Relay,66/62 Undertow,64/48 Switchyard; closed-route
sprint A-B/A-C/B-C remains14.44/11.78/14.44,14.22/11.33/14.22,
14.44/11.56/14.44s. Spawn travel is still not encounter timing. ADS250/200/225/
400/165ms and sprint recovery120/100/130/150/90ms; TDM50/300s, respawn3s,
DOM4/8s and0.5point/flag/s; hostile foley1.4, hit900/1400Hz at.28gain,
five-row top-right feed and both damage cues remain. Gameplay numeric gaps stay
open; all63 canonical scorecard rows were re-reviewed, not promoted wholesale.

Required verification:

- pnpm typecheck PASS; pnpm test PASS:629 passed/six existing skips,
  81 passed files/four skipped. pnpm build:client PASS; pnpm audit:assets PASS
  (rerun after the asset README update). session75-static-gates.json and
  session75-final-{typecheck,test,build-client,audit-assets}.log.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS with zero console errors: session75-required-report.json/log. The final
  eight-shot review and ground closeup also have zero errors/forbidden requests;
  both stress budget assertions pass. Final production code stayed frozen during
  the acceptance probes; no build, test suite, bake or second browser overlaps them.

Exact required command:

`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`

PASS under the unchanged Session74 policy. The supplementary FFA command uses
the same arguments plus `--mode=ffa` and its own session75-hitch-ffa.json output.

| Mode | Seconds / frames | Max frame / callback ms | p99 upper ms | >150ms gaps / time share | Deaths | Gate |
|---|---:|---:|---:|---:|---:|---|
|TDM|103.062 / 14525|1106.0 / 21.6|13|2 / 1.647%|2|PASS|
|FFA|51.071 / 7087|516.8 / 22.7|14|3 / 2.934%|2|PASS|

Both have zero console errors, shader changes and long tasks; default500us CPU
profiling, all measured frames and natural bot deaths remain. Raw evidence is
`.inspect/hitch.json`, session75-hitch-{tdm,ffa}.json/log. TDM's1106/591.4ms
gaps and FFA's516.8/500.7/480.8ms gaps are retained. These would fail the original
150ms ceiling. They pass the explicit1500ms presentation/150ms main-thread/
25ms p99/5% stalled-time policy from docs/HITCH-GATE.md, which was not changed
this session. No covered cross-process trace was collected here, so these gaps
are not attributed to a specific cause. Session74's five consecutive TDM+FFA
proof remains the dedicated arc evidence; these are this visual stage's new
checks. No claim that the underlying compositor/driver stall has disappeared.

Open owner questions/defaults: keep restrained joints/fine coated finish(yes),
accept the measured preparation cost in exchange for visible detail(yes for the
local candidate; device review remains open), finish Undertow then Switchyard
within this three-session arc(yes). No answer blocks progress. Human excitement,
readability, moving shimmer/comfort, mid-laptop iGPU/thermal, driver stalls,
real6v6/RTT and Firefox/Safari remain unaccepted.

Cleanup: verified preview root61924 against its saved Unix-ms creation identity,
then each descendant before stopping the owned12-process tree. Evidence:
session75-preview-tree.json and session75-cleanup.json, with zero owned processes,
port8796 listeners or inspection browsers remaining. The first cleanup attempt
stopped after an exiting child lost its Get-Process StartTime; the resume guard
then rejected a nested PowerShell JSON array. The corrected helper resumes only
the saved verified identities and reads stable CIM creation dates. No unrelated
process was targeted. Final scope/diff/reference/session-entry audit is retained
in session75-final-audit.json. All six required gates green, supplementary FFA
green, no commit/push/deploy. Publication remains the supervisor's responsibility.

### Session 76 - 2026-09-10: Surface Detail arc 2/3 - Undertow's wet plant

Read the standing brief, Session76 supervisor status and AAA plan in order, then
all63 design principles and the current scorecard. Entry branch ironsight-aaa
was clean. Supervisor confirms Session75 commit bb3fd52 and preview deployment
5e9067e1-8dd3-4db3-914f-7221a313c079. This is a local candidate only, confined to
apps/ironsight/**; no commit, push or deployment.

Reference: **R-L12, R-L13, R-L14**. Targets: fine material detail at player height,
concrete/paint separation and localized water wear, environment contrast below
sign/operator masses, <=64MiB resident textures and <=240 stress draws, fixed
lights and the existing opaque pass. Implementation/resource checks pass;
these reference rows remain partial pending human readability/device review.
Surface Detail2/3 is ON by default for Undertow; Relay1/3 is retained, and
Session77 finishes Switchyard's steel/service floor. The full arc remains open.

Delivered:

- Undertow ground changes from512-square RGBA to1024x683 linear RG8: red stores
  base intensity, green stores wetness. Original seed76021 masks gather water
  below stationary plant faces and along basin/maintenance service. Retracting
  gallery doors are excluded. Fine aggregate replaces the stretched atlas noise.
- One shared256-square normal + R8 roughness pair gives320texels/metre at0.8m
  tiling, on twelve meshes versus eleven before. Concrete has weaker normals than
  Relay; coated plant trim and pale caps receive quieter grain. Cast panels,
  recessed tie shading, damp wall feet and subtle runoff reinforce the plant.
  Ground joints remain6x5m, cast panels2.4x1.2m; derivatives fade subpixel marks.
- Wet patches darken the base, reduce roughness to0.27 and flatten aggregate
  normals. The existing daylight PMREM supplies sky sheen; this is not a scene
  reflection or water simulation. No lights, geometry, draw calls, render pass,
  per-frame CPU bake or GPU resource allocation added. Collision/authority stays.
- Explicit north/south RG8 row packing keeps linear wetness aligned with colour
  and existing2048x1365 AO. AO composition reuses the same allocation and completes
  before normal preparation. Meaningful tests cover different per-pixel wetness,
  colour gamma, orientation, AO update preservation and combined residency.
  Inspector now reports RG8 accurately and checks Undertow layout/fine detail.

Wow check uses the brief's **matched before/after stills** option, fixed production
renderer cameras at1920x1080. Full-size review includes:

- [North basin before](.inspect/session76-before-undertow-home.png) -> [after](.inspect/session76-final-undertow-home.png).
- [Pump service before](.inspect/session76-before-undertow-maintenance.png) -> [after](.inspect/session76-final-undertow-maintenance.png).
- [Centre before](.inspect/session76-before-undertow-center.png) -> [after](.inspect/session76-final-undertow-center.png).
- [Gallery before](.inspect/session76-before-undertow-gallery-open.png) -> [after](.inspect/session76-final-undertow-gallery-open.png).

Intended player sentence: **"The plant looks damp and weathered now, and the route signs still stand out."**
This is a checkable intended response, not a player testimonial or AAA acceptance.
These are offline art fixtures; natural bot play is covered by the probes below.

Rejected intermediate: session76-candidate-* keeps the first three-camera pass.
Its close concrete normals read too much like coarse stucco; final strength drops
0.18->0.085, painted trim0.045->0.035, and aggregate colour contrast is reduced.
Dry floor roughness rises0.76->0.94 to distinguish the wet patches. Distant wall
streaks now fade with pixel footprint. One typecheck failure occurred after the
new Node test imported a DOM canvas painter: session76-typecheck-dom-failure.log.
Separating Canvas2D painting from the portable packing/shader module fixes it;
no compiler setting or gate was weakened.

Matched1920x1080 balanced/DPR1 Undertow stress, RTX5070 / Edge152 / ANGLE D3D11:

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |209 /159284|209 /159284|0 /0|
| Textures / estimated MiB |25 /60.6055|25 /61.3008|0 /+0.6953|
| Programs / geometries / prepared instance slots |29 /168 /625|29 /168 /625|0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Maximum / first-ready frame ms |14.0 /13.8|14.0 /7.1|0 /-6.7|
| Stress construction / preparation ms |48.7 /764.0|95.2 /997.9|+46.5 /+233.9|
| First fresh-profile construction / preparation ms |80.5 /977.4|214.4 /1667.7|+133.9 /+690.3|
| Assets including README bytes |26920675|26922752|+2077|
| Client JS / source map bytes |2102070 /4655051|2109371 /4668302|+7301 /+13251|
| Entire public bytes |33678479|33701108|+22629|

Both stress runs contain11 remote operators plus the local rifle,145 twelve-rifle
volleys and96 blasts over15s; all effects drain. Relay control retains238draws,
150102triangles,30textures/63.7448MiB,33programs,6.9/7.1/7.1ms and20.8ms maximum.
Neither fixture is a laptop-iGPU, thermal, network or real6v6 benchmark.

First fresh-profile local construction+preparation is1.058->1.882s, before play.
This is a measured preparation cost, not a CDN download comparison. The maintenance
view also records946.5ms construction versus63.9ms before; this outlier is retained
in the full report without attributing it to a driver or claiming a loading-speed win.
Ground+detail
is2.1953MiB versus1.5000MiB; no new downloaded binary or per-map request. Public
32.140MiB remains below60MiB, largest file7,183,364bytes below25MiB. Provenance and
reproduction are in public/assets/README.md. No Meshy spend, dependency or purchased
derivative; reported1530credits unchanged. Machine evidence: session76-{before,
final}-report.json and session76-summary.json; node .inspect/session76-summarize.mjs
reproduces the comparison.

All63 canonical reference rows were re-reviewed and the visual-first gap list
re-ranked. Fresh tools/reference-audit.ts output deep-equals Session75, retained
in session76-reference-{audit,comparison}.json. Cover full/waist remains65/46,
66/62,64/48; A-B/A-C/B-C sprint rotations14.44/11.78/14.44,
14.22/11.33/14.22,14.44/11.56/14.44s. Spawn travel is not contact timing.
ADS250/200/225/400/165ms, sprint recovery120/100/130/150/90ms; TDM50/300s,
respawn3s, DOM4/8s and0.5point/flag/s; hostile foley1.4, hit900/1400Hz at.28gain,
five-row top-right feed and both damage cues remain. Gameplay gaps stay open.

Required verification:

- pnpm typecheck PASS; pnpm test PASS:631 passed/six existing skips,
  82 passed files/four skipped. pnpm build:client PASS; pnpm audit:assets PASS
  (rerun after provenance). Logs: session76-final-{typecheck,test,build-client,
  audit-assets}.log. The DOM/portable test import repair is retained separately.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors: session76-required-report.json/log and retained
  session76-required-{relay,practice-two}.png. The six-shot final art/stress
  review also has zero errors/forbidden requests and both budget assertions pass.

Exact required hitch command:

`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`

PASS under the unchanged Session74 policy. Supplementary DOM and FFA use
--mode=dom / --mode=ffa with their own session76-hitch-{dom,ffa}.json output.
Production code stayed frozen through final captures and these sequential probes;
no test suite, build, bake or second browser overlaps them.

| Mode | Seconds / frames | Max frame / callback ms | p99 upper ms | >150ms gaps / time share | Deaths | Gate |
|---|---:|---:|---:|---:|---:|---|
|TDM|107.131 / 15303|52.3 / 32.9|14|0 / 0.000%|2|PASS|
|DOM|65.709 / 9244|664.8 / 18.3|14|2 / 1.752%|2|PASS|
|FFA|39.042 / 5606|21.7 / 16.4|13|0 / 0.000%|2|PASS|

All three use default500us CPU profiling and natural bot deaths, with zero
console errors, shader changes and main-thread long tasks. The exact required
TDM report remains .inspect/hitch.json and session76-hitch-tdm.json; all three
mode logs/reports and session76-acceptance.json are retained. Undertow DOM's
664.8/486.4ms gaps remain in the report. These fail the original150ms ceiling
but pass the unchanged1500ms presentation/150ms main-thread/25ms p99/5%
stalled-time policy. No cross-process trace was collected, so the gaps are not
attributed to a particular cause. Session74's five consecutive TDM+FFA proof
remains the dedicated arc evidence; these are this stage's fresh checks, not a
claim that player-visible driver/compositor stalls have disappeared.

Open owner questions/defaults: retain wet patches and quieter cast concrete(yes);
accept the measured local preparation cost for this candidate(yes, device review
still required); complete Switchyard in Session77(yes). No answer blocks work.
Human excitement/readability/moving comfort, laptop iGPU/thermal, driver stalls,
real6v6/RTT and Firefox/Safari remain unaccepted. No latency/capacity claim.

Cleanup verified preview root36648 against its saved creation identity, then
each descendant's identity before stopping the owned12-process tree.
Evidence: session76-preview-tree.json and session76-cleanup.json, with zero
owned processes, port8796 listeners or inspection browsers remaining. All six
required gates and supplementary DOM/FFA are green. Scope/diff/reference audit:
session76-final-audit.json. All changes remain in apps/ironsight/** on ironsight-aaa;
no commit/push/deploy. Publication remains the supervisor's responsibility.

### Session 77 - 2026-09-10: Surface Detail arc 3/3 - Switchyard's worn steel

Read the standing brief, Session77 supervisor status and AAA plan in order,
then all63 design principles and canonical scorecard rows. Entry branch
ironsight-aaa was clean. Supervisor confirms Session76 commit1672d51 and preview
deployment6698cf3d-5884-45c6-939a-a12512f325fd. This is a local candidate only;
all changes stay in apps/ironsight/**. No commit, push or deployment.

Reference: **R-L12, R-L13, R-L14**. Targets: distinguish concrete, coated
switchgear and steel ramps at player height; keep small wear subordinate to
signs, launch markings and operator colour masses;320texels/metre fine detail,
<=64MiB resident textures and <=240 stress draws, fixed lights and the existing
opaque pass. Implementation/resource checks pass; these reference rows remain
partial pending human readability/device review. **Surface Detail3/3 completes
the arc, ON by default across Relay, Undertow and Switchyard.** The larger
material/visual-quality gap is still open. Per-map lighting/atmosphere ranks next.

Delivered:

- Switchyard ground changes from512-square RGBA to1024x683 linear R8. The
  already-tested Relay packer preserves north-first colour/AO orientation and
  updates the existing allocation when AO arrives. A material tint preserves
  the yard's base hue. Six-by-five-metre slab joints and finer aggregate replace
  the stretched coarse noise. Original seed77021 broad stains, retired tyre
  tracks and dry grease give the service floor a second scale of wear.
  Retractable freight is excluded from static cabinet-foot stains.
- Twelve meshes share the256-square RGBA8 normal/R8 roughness pair at0.8m
  tiling, up from ten. Authored material slots distinguish concrete, enamel,
  steel and the four ramps. Quiet coated grain replaces the pebbled paint;
  cast concrete panels remain2.4x1.2m. No new downloaded texture or map request.
- Rubbed paint and dirt follow each real rectangular panel edge. Load-time
  triangle-pair validation accepts only coplanar rectangular faces sharing
  their diagonal, including duplicated ramp corners. Curved/triangular regions
  remain unmarked. Positions, normals, indices, paint/AO UVs and collision are
  untouched. The two meaningful tests cover transformed/scaled metric faces,
  preserved geometry/AO, actual ramp corners and unsupported surface masks.
- Rolled-steel roughness and18cm projected anti-slip ramp tread use the existing
  opaque PBR shader; screen derivatives fade small marks at a distance. The
  tread is shaded relief, not geometry or a movement/friction change. No new
  draw, light, shadow request, pass or per-frame CPU bake/resource allocation.
  All resources and the one additional program are prepared before play.
- Inspector asserts Switchyard's R8 dimensions, shared fine textures, six
  surface categories, valid panel coordinates and existing resource limits.
  Source/provenance and a reproducible inspection command are documented in
  public/assets/README.md. No SDK, server state, gameplay rule or wire change.

Wow check uses the brief's **matched before/after stills** option, fixed
production-renderer cameras at1920x1080. Reviewed at full size:

- [North bus before](.inspect/session77-before-switchyard-north.png) -> [after](.inspect/session77-final-switchyard-north.png).
- [South service before](.inspect/session77-before-switchyard-service.png) -> [after](.inspect/session77-final-switchyard-service.png).
- [Switching deck before](.inspect/session77-before-switchyard-center.png) -> [after](.inspect/session77-final-switchyard-center.png).
- [Freight cover before](.inspect/session77-before-switchyard-cargo-cover.png) -> [after](.inspect/session77-final-switchyard-cargo-cover.png).
- [Freight crossing before](.inspect/session77-before-switchyard-cargo-crossing.png) -> [after](.inspect/session77-final-switchyard-cargo-crossing.png).

Additional [ramp close-up](.inspect/session77-final-close-switchyard-ramp.png):
eye75,2.15,37, look75,1.6,39. This supplementary image has no original-build
close-up pair; the five paired cameras above are the before/after proof.
The final stress still retains eleven operators and the local rifle; signs,
large team-colour masses and solid cover remain distinct in this fixture.
These are offline art fixtures, not an injected or purported live bot capture.
Natural gameplay is covered by the two hitch probes below.

Intended player sentence: **"The switchgear looks like worn metal, and the ramps look like grip plate."**
This names the intended visible improvement, not a player testimonial or overall
AAA acceptance. Human excitement/readability remains open.

Rejected intermediates/evidence: session77-candidate-* retains the first art
pass, stress and ramp close-up. Initial cabinet edge strength0.55 and coated
normal0.035 were too assertive; final edge strength is0.32 enamel/0.44 steel,
with normals0.022 enamel/0.025 steel. Fine rolling fades out before subpixel
aliasing, and broad floor mottling counters an overly uniform candidate floor.
The initial inspector failed on zero ramp panel coordinates:
session77-candidate.log. Connected-index rectangle recovery missed the baked
ramps' duplicated triangle vertices. Geometrically validated triangle pairs
fix it; the same inspector assertion now passes with72 ramp panel vertices.
No gate or compiler setting was weakened. The earlier three-camera candidate
and rejected mapping are not substituted for final evidence.

Matched1920x1080 balanced/DPR1 Switchyard stress, RTX5070 / Edge152 / ANGLE D3D11:

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |208 /166956|208 /166956|0 /0|
| Textures / estimated MiB |28 /62.1888|28 /61.9948|0 /-0.1940|
| Programs / geometries / prepared instance slots |29 /158 /306|30 /158 /306|+1 /0 /0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Maximum / first-ready frame ms |14.0 /7.0|7.2 /7.1|-6.8 /+0.1|
| Stress construction / preparation ms |59.9 /637.2|81.4 /698.9|+21.5 /+61.7|
| First fresh-profile construction / preparation ms |92.2 /836.6|146.0 /977.6|+53.8 /+141.0|
| Assets including README bytes |26922752|26925301|+2549|
| Client JS / source map bytes |2109371 /4668302|2119351 /4685499|+9980 /+17197|
| Entire public bytes |33701108|33730834|+29726|

Each stress fixture contains11 remote operators plus the local rifle,
145 twelve-rifle volleys and96 blasts over15s; all effects drain. Relay control
retains238draws/150102triangles,30textures/63.7448MiB,33programs and6.9/7.1/7.1ms;
max13.9->14.0ms. These are local renderer fixtures, not laptop-iGPU, thermal,
network or real6v6 benchmarks. No speedup or driver-fix claim.

First fresh-profile local construction+preparation is0.929->1.124s, +0.195s,
before play. This includes local preparation, not CDN download time. The fine
ground/detail combination is1.3060MiB versus1.5000MiB. Texture savings do not
represent total GPU memory savings: new panel-edge float streams consume
3,015,296bytes and newly detailed steel UVs861,072bytes, total3,876,368bytes
(3.697MiB) per CPU/GPU copy. The streams are populated once at load; no index,
triangle or per-frame upload is added. The resident texture estimate does not
include these vertex buffers or unobservable driver overhead.

Public32.1682MiB is below60MiB; largest file7,183,364bytes is below25MiB. All
new downloaded bytes are client/source-map/provenance text, with no new public
binary. No Meshy spend, dependency or purchased derivative; reported1530credits
unchanged. Machine evidence: session77-{before,final}-report.json and
session77-summary.json; node .inspect/session77-summarize.mjs reproduces the
comparison, including vertex-stream bytes from the loaded original GLB counts.

All63 canonical scorecard rows were re-reviewed and the visual-first gap list
re-ranked. Fresh tools/reference-audit.ts output deep-equals Session76:
session77-reference-{audit,comparison}.json. Cover full/waist stays65/46,
66/62,64/48; A-B/A-C/B-C sprint rotations14.44/11.78/14.44,
14.22/11.33/14.22,14.44/11.56/14.44s. Spawn travel is not contact timing.
ADS250/200/225/400/165ms and sprint recovery120/100/130/150/90ms; TDM50/300s,
respawn3s, DOM4/8s and0.5point/flag/s; hostile foley1.4, hit900/1400Hz at.28gain,
five-row top-right feed and both damage cues remain. Gameplay numeric gaps stay
open; no repeated lifecycle or balance acceptance claim.

Required verification:

- pnpm typecheck PASS; pnpm test PASS:633 passed/six existing skips,
  83 passed files/four skipped. pnpm build:client PASS; pnpm audit:assets PASS.
  Logs: session77-final-{typecheck,test,build-client,audit-assets}.log.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors: session77-required-report.json/log and retained
  session77-required-{relay,practice-two}.png. The seven-shot final art/stress
  review and ramp close-up also have zero errors/forbidden requests. Both
  final stress budget assertions pass.

Exact required hitch command:

`node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert`

PASS under the unchanged Session74 policy. Supplementary FFA uses
--mode=ffa with its own session77-hitch-ffa.json output. Production code stayed
frozen through final captures and sequential probes; no test suite, build,
bake or second browser overlapped them.

| Mode | Seconds / frames | Max frame / callback ms | p99 upper ms | >150ms gaps / time share | Deaths | Gate |
|---|---:|---:|---:|---:|---:|---|
|TDM|62.981 /9069|14.5 /6.4|8|0 /0.000%|2|PASS|
|FFA|27.107 /3904|16.1 /11.2|8|0 /0.000%|3|PASS|

Both use default500us CPU profiling and natural bot deaths, with zero console
errors, shader changes and main-thread long tasks. Raw evidence is
.inspect/hitch.json, session77-hitch-{tdm,ffa}.json/log and
session77-acceptance.json. Neither run uses the1500ms host allowance; no frame
exceeds the original150ms ceiling. The unchanged policy remains1500ms
presentation/150ms main-thread/25ms p99/5% stalled time. These two clean runs
do not establish absence of intermittent compositor/driver freezes; no new
cross-process trace or five-pair proof was collected. Session74 retains the
dedicated arc evidence. Representative iGPU and broader acceptance stay open.

Open owner questions/defaults: keep restrained wear and steel ramp tread(yes);
accept the measured local preparation/vertex-memory cost for this candidate
(yes, pending device review); start the next visual arc with Undertow dusk
(yes, inside fixed-light/existing-pass constraints). No answer blocks progress.
Human excitement/readability/moving comfort, laptop iGPU/thermal, intermittent
driver stalls, real6v6/RTT and Firefox/Safari remain unaccepted. No latency or
capacity claim.

Cleanup verified preview root71904 against its saved creation identity, then
each descendant before stopping the owned12-process tree. Evidence:
session77-preview-tree.json and session77-cleanup.json, with zero owned
processes, port8796 listeners or inspection browsers remaining. All six
required gates and supplementary FFA are green. Scope/diff/reference audit:
session77-final-audit.json. All work remains within apps/ironsight/** on
ironsight-aaa; no commit/push/deploy. Publication is the supervisor's task.


### Session 78 - 2026-09-10: Afterlight arc 1/2 - Undertow at dusk

Read the standing brief, Session78 supervisor status and AAA plan in order,
then all63 design principles and canonical scorecard rows. Entry branch
ironsight-aaa was clean. Supervisor confirms Session77 commit9f44f06 and preview
deployment6dd483e1-1a15-4787-be3c-7b020f18a431. This is a local candidate;
scope remains apps/ironsight/**, with no commit, push or deployment.

Reference: **R-L12, R-L13, R-L14**. Checkable targets: coherent warm/cool
Undertow lighting at player height; readable signs, gallery and large actor
colour masses in shade; unchanged16lights and sky draw, cached1024shadow,
<=240stress calls and<=64MiB textures. The fixtures/resource checks meet these
targets; reference rows remain partial pending human all-range/device review.
**Afterlight1/2 is ON by default for Undertow.** Session79 completes the arc
with Switchyard overcast; Relay daylight remains. The arc is not yet complete.

Delivered:

- Undertow's former shared high daylight key becomes a warm northwest key
  at17.55degrees elevation, with blue hemisphere fill, exposure1.08 and cool
  distant fog. Fog begins at90m, beyond the40m rifle corridors. Low sunlight
  makes long static shadows and separates machinery faces; no light is added,
  hidden or removed. Original actor/HUD palettes and rim settings are retained.
- Original seeded cloud/radiance field baked in Blender. The same profile drives
  the directional key, visible sky and reflected environment. A512x256 linear
  HDR becomes the existing128px/1.5MiB PMREM once before play. A1024x512 sRGB
  PNG supplies the visible sky in the existing draw,2MiB without mipmaps. The
  smooth sun disc is analytic in that shader; the broad halo feeds reflections.
  This is a sky reflection field, not scene reflections, bloom or god-ray passes.
- Sky projection ignores camera translation; sun/clouds remain distant during
  travel and deployment. No live sky clock/animation, CPU bake, geometry churn,
  light-count change or added render pass. All resources prepare before play.
- Each map loads its own environment: Undertow's two files replace its daylight
  HDR request. Relay/Switchyard keep their existing request and allocations.
  Failed partial loads dispose completed textures before the existing fallback.
  Provenance, allowlists and reproduction command are in public/assets/README.md.
- Inspector validates all16prepared lights, sun/key direction, exposure,
  map-only sky/HDR requests, cached shadows and sky dimensions/residency.
  Texture accounting now includes direct texture uniforms in ShaderMaterial.
  Bake validation reopens the PNG and checks every encoded pixel/orientation;
  maximum saved error0.001961, within2/255. No compiler/gate was weakened.

Wow check uses the brief's **matched before/after stills** option, identical
production-renderer cameras at1920x1080. Full-size review:

- [North basin before](.inspect/session78-before-undertow-home.png) -> [after](.inspect/session78-final-undertow-home.png).
- [Pump service before](.inspect/session78-before-undertow-maintenance.png) -> [after](.inspect/session78-final-undertow-maintenance.png).
- [Flood towers before](.inspect/session78-before-undertow-flood-active.png) -> [after](.inspect/session78-final-undertow-flood-active.png).
- [Open gallery before](.inspect/session78-before-undertow-gallery-open.png) -> [after](.inspect/session78-final-undertow-gallery-open.png).

The paired stress stills retain11remote operators and the local rifle.
These are explicitly offline art/effects fixtures, not injected live gameplay.
Natural bot play is covered by the three hitch probes below.
Intended player sentence: **"The flood towers against that sunset make this feel like a different place."**
This states the intended visible improvement, not a player testimonial or AAA
acceptance. Human excitement and all-range readability remain open.

Rejected intermediates: session78-candidate-* shows the first512px sky and
an obviously blocky baked sun. The final sky is1024px with a smooth shader disc;
keeping the reflection bake512px avoids increasing PMREM allocation.
session78-candidate2-* retains a darker PNG pass caused by an sRGB encoding
mismatch. Explicit encoding and the saved-file pixel check restore the intended
radiance; the dark image is not substituted for final evidence. Blender also
rejected setting HDR depth to8bit; the script now sets8bit only forPNG. These
were art/bake intermediates; required final checks below are green.

Matched1920x1080 balanced/DPR1 Undertow stress, RTX5070 / Edge152 / ANGLE D3D11:

| Measurement | Before | After | Delta |
|---|---:|---:|---:|
| Peak calls / triangles |209 /159284|209 /159284|0 /0|
| Textures / estimated MiB |25 /61.3008|26 /63.3008|+1 /+2.0000|
| Programs / geometries / prepared instance slots |29 /168 /625|29 /168 /625|0|
| Median / p95 / p99 ms |6.9 /7.1 /7.1|6.9 /7.1 /7.1|0 /0 /0|
| Maximum / first-ready frame ms |7.5 /7.1|13.9 /7.1|+6.4 /0|
| Stress construction / preparation ms |87.2 /642.4|106.0 /654.1|+18.8 /+11.7|
| First fresh-profile construction / preparation ms |157.1 /847.4|155.8 /844.1|-1.3 /-3.3|
| Assets including README bytes |26925301|27154748|+229447|
| Client JS / source map bytes |2119351 /4685499|2125048 /4695115|+5697 /+9616|
| Entire public bytes |33730834|33975594|+244760|

Each stress fixture contains11remote operators plus the local rifle,
145twelve-rifle volleys and96blasts over15s; all effects drain. Relay control
retains238calls/150102triangles/30textures/63.7448MiB/33programs; Switchyard
retains208calls/166956triangles/28textures/61.9948MiB/30programs. Their maxima
are14.0ms in the final run. These local fixtures do not establish laptop-iGPU,
thermal, real6v6/network performance or a speedup from single-run differences.

First fresh-profile local construction+preparation is1.0045->0.9999s, before
play. This is local preparation, not a CDN/download comparison. Final first-load
environment fetch/decode wall time178.7ms; PMREM preparation call267.5ms versus
8.6ms in the warmed stress view. These are call timings, not isolated GPU traces;
the large first-use cost occurs before ready. Raw data retains all view timings.
Two new binary files total226862bytes (104307HDR +122555PNG), replacing the
41273byte daylight request on Undertow: net+185589 map-load bytes. The whole
product retains daylight for the other maps. Public32.4017MiB stays below60MiB;
largest file7183364bytes stays below25MiB. No Meshy spend, purchased derivative,
dependency or server/wire change; reported1530credits unchanged.
Evidence: session78-{before,final}-report.json, session78-summary.json;
node .inspect/session78-summarize.mjs reproduces comparisons.

All63 canonical scorecard rows were re-reviewed and the visual-first gap list
re-ranked. Fresh tools/reference-audit.ts output deep-equals Session77:
session78-reference-{audit,comparison}.json. Cover full/waist stays65/46,
66/62,64/48; A-B/A-C/B-C sprint rotations14.44/11.78/14.44,
14.22/11.33/14.22,14.44/11.56/14.44s. Spawn travel is not contact timing.
ADS250/200/225/400/165ms and sprint recovery120/100/130/150/90ms; TDM50/300s,
respawn3s, DOM4/8s and0.5point/flag/s; hostile foley1.4, hit900/1400Hz at.28gain,
five-row top-right feed and both damage cues remain. Gameplay gaps stay open.

Required verification:

- pnpm typecheck PASS; pnpm test PASS:633passed/six existing skips,
  83passed files/four skipped. pnpm build:client PASS; pnpm audit:assets PASS.
  Logs: session78-final-{typecheck,test,build-client,audit-assets}.log.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors: session78-required-report.json/log and retained
  session78-required-{relay,practice-two}.png. Seven final art/stress shots have
  zero errors/forbidden requests and all three stress budget assertions pass.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS. Supplementary --mode=dom and --mode=ffa use session78-hitch-{dom,ffa}.json.
  Production code stayed frozen through final captures and sequential probes;
  no test suite, build, bake or second browser overlapped the probes.

| Mode | Seconds / frames | Max frame / callback ms | p99 upper ms | >150ms gaps / time share | Deaths | Gate |
|---|---:|---:|---:|---:|---:|---|
|TDM|86.268 /12422|15.8 /10.9|8|0 /0.000%|2|PASS|
|DOM|68.001 /9788|14.8 /7.9|8|0 /0.000%|2|PASS|
|FFA|46.002 /6624|14.2 /9.5|8|0 /0.000%|2|PASS|

All three use default500us CPU profiling and natural bot deaths. Raw evidence:
.inspect/hitch.json, session78-hitch-{tdm,dom,ffa}.json/log and
session78-acceptance.json. The unchanged Session74 policy remains1500ms
presentation/150ms main-thread/25ms p99/5% stalled time; every>150ms gap stays
reported. Session74 retains the dedicated five-consecutive-TDM+FFA proof.
This session does not claim that intermittent driver/compositor freezes are fixed;
no new cross-process trace or five-pair proof was collected. iGPU acceptance stays open.

Open owner questions/defaults: keep Undertow dusk with its restrained clear
combat lighting(yes); accept2MiB texture and185589 map-load bytes for this
candidate(yes, pending device review); complete Switchyard overcast in Session79
(yes). No answer blocks progress. Human excitement/readability/moving comfort,
laptop iGPU/thermal, intermittent driver stalls, real6v6/RTT and Firefox/Safari
remain unaccepted. No latency/capacity or overall AAA claim.

Cleanup verified preview root18036 against its saved creation identity, then
each descendant before stopping the owned12-process tree. Evidence:
session78-preview-tree.json and session78-cleanup.json, with zero owned processes,
port8796listeners or inspection browsers remaining. All six required gates and
supplementary DOM/FFA are green. Scope/diff/reference audit:
session78-final-audit.json. Work stays within apps/ironsight/** on ironsight-aaa;
no commit/push/deploy. Publication remains the supervisor's responsibility.


### Session 79 - 2026-09-10: Afterlight arc 2/2 - Switchyard under cloud

Read the standing brief, Session79 supervisor status and AAA plan in order,
then all63 design principles and canonical scorecard rows. Entry branch
ironsight-aaa was clean. Supervisor confirms Session78 commit1356a28 and preview
deploymentdf8d7b6e-ac99-4cc2-a006-8b296de8efab. This is a local candidate;
scope remains apps/ironsight/**, with no commit, push or deployment.

Reference: **R-M08, R-M17, R-L12, R-L13, R-L14**. Checkable targets:
Switchyard has coherent overcast sky/light/reflections; amber gantry, central
spine, white route signs and large actor colour masses remain distinct in
player-height views; unchanged16lights, cached1024shadow and sky draw;
<=240stress calls and<=64MiB textures. The fixtures/resource checks meet these
targets. Rows remain partial pending human all-range/wayfinding/device review.
**Afterlight2/2 completes the arc, ON by default.** Relay keeps daylight;
Undertow keeps dusk. Operator/weapon fidelity is the next ranked visual gap.

Delivered:

- Original seeded stratus sky with a broad silver opening aligned to the
  existing high northeast key. The weaker1.05 neutral key,1.35 cool hemisphere
  fill,1.2 environment intensity and1.12exposure replace shared sunny lighting.
  Fog begins at100m, beyond tested40m rifle corridors. No solar disc in overcast.
- A512x256 linear HDR becomes the existing128px/1.5MiB PMREM once before
  ready. A1024x512 sRGB PNG supplies the existing sky draw at2MiB without
  mipmaps. The sky ignores camera translation. Shared profile selection retains
  Undertow's radiance, analytic sun and lighting; Relay uses its original path.
  No new render pass/light, live cloud clock, CPU bake or GPU resource churn.
- Loader remains lazy per map. Inspector checks each exact HDR/sky pair,
  single PMREM generation, fixed lights, key direction/intensity/colour,
  hemisphere/ambient fill, exposure, fog and sky residency. Budget gates were
  not weakened. Original-source allowlists/provenance/reproduction are in
  public/assets/README.md. Server, collision, actor palettes and wire untouched.
- Undertow and Switchyard deployment vistas now match their weather in play.
  These are production-renderer screenshots; menus still use flat images and
  do not load map3D assets. Undertow vista128178->155256bytes; Switchyard
  139710->159792bytes, combined+47160bytes.

Wow check uses the brief's **matched before/after stills** option, identical
production-renderer cameras at1920x1080. Full-size review:

- [North bus before](.inspect/session79-before-switchyard-north.png) -> [after](.inspect/session79-final-switchyard-north.png).
- [South service before](.inspect/session79-before-switchyard-service.png) -> [after](.inspect/session79-final-switchyard-service.png).
- [Switching deck before](.inspect/session79-before-switchyard-center.png) -> [after](.inspect/session79-final-switchyard-center.png).
- [Cargo overhead before](.inspect/session79-before-switchyard-cargo-transfer.png) -> [after](.inspect/session79-final-switchyard-cargo-transfer.png).
- [Freight crossing before](.inspect/session79-before-switchyard-cargo-crossing.png) -> [after](.inspect/session79-final-switchyard-cargo-crossing.png).
- [Switchyard menu before](.inspect/session79-menu-before-menu-switchyard.png) -> [after](.inspect/session79-menu-final-menu-switchyard.png).
- [Undertow menu before](.inspect/session79-menu-before-menu-undertow.png) -> [after](.inspect/session79-menu-final-menu-undertow.png).

Paired stress stills retain11remote operators and the local rifle. Map/event
stills are offline art/effects fixtures, not injected live gameplay. Natural
bot play is covered by all three hitch probes below.
Intended player sentence: **"That yellow crane moving under the clouds makes the yard feel like a real place."**
This describes the intended visual payoff, not a player testimonial or AAA
acceptance. Human excitement and all-range readability remain open.

Rejected intermediate: session79-candidate-* preserves the darker first fill.
The shaded freight wall lost too much detail at1.10hemisphere/1.10environment.
Final1.35/1.20 and a lighter ground-fill colour lift it; key1.20->1.05 reduces
direct-light contrast. No extra light or shadow kernel change. Cloud textures
are unchanged by this fill adjustment. The saved PNG pixel/orientation check
reports maximum encoded error0.001961 (<2/255), in session79-candidate-bake.log.
An early reference-summary attempt rejected PowerShell's UTF16 redirection;
explicit UTF8 output fixed the evidence file. No game or gate failure was hidden.

Matched1920x1080 balanced/DPR1 Switchyard stress, RTX5070 / Edge152 / ANGLE D3D11:

| Measurement | Before | After |
|---|---:|---:|
| Peak calls / triangles |208 /166956|208 /166956|
| Textures / estimated MiB |28 /61.9948|29 /63.9948|
| Programs / geometries / prepared instance slots |30 /158 /306|30 /158 /306|
| Median ms |6.9 | 6.9|
| p95 / p99 ms |7.1 /7.1|7.1 /7.1|
| Maximum ms |7.6 | 13.9|
| First-ready frame ms |7.1 | 7.1|
| Stress construction / preparation ms |81.6 /703.1|78.8 /674.3|
| First fresh-profile construction / preparation ms |139.6 /878.2|142.8 /871.5|

Each stress fixture contains145twelve-rifle volleys and96blasts over15s, then
effects drain. Relay control retains238calls/150102triangles/30textures/
63.7448MiB/33programs; Undertow retains209calls/159284triangles/26textures/
63.3008MiB/29programs. Both retain6.9/7.1/7.1ms median/p95/p99. Their maxima
are13.9ms and7.3ms respectively. These local fixtures do not establish laptop
iGPU, thermal, real6v6/network performance or a speedup from single-run changes.

First fresh-profile local construction+preparation is
1.0178->1.0143s before play.
Environment fetch/decode wall time180.9->65.6ms; first PMREM call265.1->318.1ms
(warmed stress8.0->8.1ms). These are local call timings, not isolated GPU traces
or CDN/download performance. First-use work completes before ready.

| Bytes | Before | After | Delta |
|---|---:|---:|---:|
| Assets including README |27154748 | 27484756 | +330008|
| Client JS |2125048 | 2126134 | +1086|
| Source map |4695115 | 4697111 | +1996|
| Entire public |33975594 | 34308684 | +333090|

Two new binaries total279975bytes (144190HDR +135785PNG), replacing the
41273byte daylight request on Switchyard: net+238702map-load bytes. Public
32.7193MiB stays below60MiB; largest file7183364bytes stays
below25MiB. Texture residency adds2MiB and leaves only5461estimated bytes
under64MiB; future texture work must free residency first. This estimate omits
vertex buffers and driver overhead. No Meshy spend, purchased derivative or
dependency; reported1530credits unchanged. Evidence: session79-{before,final}-
report.json and session79-summary.json; node .inspect/session79-summarize.mjs
reproduces the comparison.

All63 canonical rows re-reviewed and the visual-first gap list re-ranked.
Fresh tools/reference-audit.ts output deep-equals Session78:
session79-reference-{audit,comparison}.json. Cover full/waist remains65/46,
66/62,64/48; A-B/A-C/B-C sprint rotations14.44/11.78/14.44,
14.22/11.33/14.22,14.44/11.56/14.44s. Spawn travel is not contact timing.
ADS250/200/225/400/165ms and sprint recovery120/100/130/150/90ms; TDM50/300s,
respawn3s, DOM4/8s and0.5point/flag/s; hostile foley1.4, hit900/1400Hz at.28gain,
five-row top-right feed and both damage cues remain. Gameplay gaps stay open.

Required verification:

- pnpm typecheck PASS; pnpm test PASS:633passed/six existing skips,
  83passed files/four skipped. pnpm build:client PASS; pnpm audit:assets PASS.
  Logs: session79-final-{typecheck,test,build-client,audit-assets}.log.
- Exact node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
  PASS, zero console errors: session79-required-report.json/log and retained
  session79-required-{relay,practice-two}.png. Eight final art/stress views,
  two vistas and both menu pairs also have zero errors/forbidden requests;
  all three stress budget assertions pass.
- Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
  PASS. Supplementary --mode=ffa and --mode=dom use session79-hitch-{ffa,dom}.json.
  Production code stayed frozen throughout final captures and sequential probes;
  no test suite, build, bake or second browser overlapped the hitch probes.

| Mode | Seconds / frames | Max frame / callback ms | p99 upper ms | >150ms gaps / time share | Deaths | Gate |
|---|---:|---:|---:|---:|---:|---|
|TDM|61.148 /8781|145.7 /13.0|8|0 /0.000%|2|PASS|
|FFA|32.844 /4705|52.4 /19.8|8|0 /0.000%|2|PASS|
|DOM|58.135 /8319|178.2 /33.1|8|1 /0.307%|2|PASS|

The DOM run uses the existing headless allowance: a single 178.2 ms interval
at 3.498 s accounts for 0.307% of measured time. It records 29 programs,
26 textures and 168 geometries; 163 of 167 CPU samples in that interval are
idle. No cross-process trace covers it, so its cause is not assigned to the
driver. The original 150 ms ceiling would fail this supplementary run. The
sample is retained, and neither the policy nor the recorded interval was changed.

All use default500us CPU profiling and natural bot deaths. Raw evidence:
.inspect/hitch.json, session79-hitch-{tdm,ffa,dom}.json/log and
session79-acceptance.json. Zero console errors, shader changes and main-thread
long tasks. Session74 policy remains1500ms presentation/150ms main-thread/
25ms p99/5% stalled time; every>150ms gap remains reported. Its five-consecutive
TDM+FFA proof is retained. No new five-pair proof/cross-process trace was taken;
the session does not claim that intermittent driver/compositor freezes are fixed.

Open owner questions/defaults: keep the restrained overcast and brighter final
fill(yes); keep the refreshed weather-map deployment vistas(yes); prioritize
operator/weapon fidelity next(yes, with texture residency freed before growth).
No answer blocks progress. Human excitement/readability/moving comfort,
laptop iGPU/thermal, intermittent driver stalls, real6v6/RTT and Firefox/Safari
remain unaccepted. No latency/capacity or overall AAA claim.

Cleanup verified preview root30924 against its saved creation identity, then
each descendant before stopping the owned12-process tree. Evidence:
session79-preview-tree.json and session79-cleanup.json, with zero owned processes,
port8796listeners or inspection browsers remaining. All six required gates and
supplementary FFA/DOM are green. Final scope/diff/reference audit:
session79-final-audit.json. Work stays within apps/ironsight/** on ironsight-aaa;
no commit/push/deploy. Publication remains the supervisor's responsibility.


### Session 80 - 2026-09-10: First Fight arc 1/1 - prepare the compositor before combat

Read the standing brief, Session80 status and AAA plan in order, then all63
design principles/canonical scorecard rows. Entry branch ironsight-aaa was clean.
Supervisor confirms Session79 commit057e989 and preview deployment
344591b0-2cf1-48c4-bf9f-2defe0213189. Its14:25 instruction to warm the compositor
outranks the next operator-art item. This dedicated performance arc is complete
and ON by default. No commit, push or deployment; all work is apps/ironsight/**.

Reference: **R-L14, R-L21, R-L20, R-L05**. Checkable targets: actually rasterize
match UI during loading, preserve its appearance/accessibility/state, and keep
first natural damage/death below150ms on five consecutive fresh-profile TDM/FFA
pairs. Retain <=240stress calls, <=64MiB estimated textures,16fixed lights,
cached shadows, the same WebGL pass and all existing gate limits. These checks
pass. Broader device/driver and human presentation acceptance remain open.

Delivered:

- Eighteen preparation views use the real HUD/menu styles: four damage
  directions, body/head markers, feed/confirmation/streak, death, team/solo
  results and honors, three support silhouettes, deployment, map event, ping,
  pause and settings. The real2D minimap is drawn before play as well.
- Full-size copies sit above loading at1%opacity. Zero-opacity/offscreen or
  occluded copies can be culled, so those approaches were rejected. The trace
  proves these copies submit raster work. Three animation frames per view,
  with actual animations sampled halfway and paused. Existing border-image
  decode and fonts complete first. No blur/backdrop-filter remained in match CSS.
- Copies are inert/aria-hidden, have no global menu listeners, cannot produce
  sounds or gameplay, and are removed before enabling the canvas. A fresh
  authoritative self snapshot seeds prediction after preparation. The room's
  warmup deadline is unchanged. No permanent layer, light, asset or GPU pass.
- The probe now retains pre-play frame intervals and observes live-join hits
  before pointer-lock/profiler setup. First-use windows include250ms before
  through1000ms after each first observed event, including crossing intervals;
  fatal hits count, missing/incomplete windows fail. All gameplay spikes stay
  reported. The optional150ms check supplements the unchanged Session74 policy.
  A startup trace mode, trace summarizer and screenshot-only sequence support
  repeatable diagnosis. Four unit cases cover boundary stalls, missing capture,
  first-event retention and negative-time live joins.

Browser fixtures at1920x1080,390x844 and1280x600, including Reduced motion,
verify submitted copies, cleanup, stable live HUD/settings/focus, no ghost feed
or style leak, and that real Settings still opens/closes with restored focus.
Evidence: session80-final-report.json and session80-final-match-preparation*.png.
Natural production preparation includes all18 views; the smaller offline fixture
does not instantiate the3D intro/minimap. No room/network requests in fixtures.

Wow check: a **25.991second natural FFA bot sequence**,
11stills, driven by normal movement/look/fire inputs. Evidence:
[first exchange](.inspect/session80-wow-fight-00.png), [last still](.inspect/session80-wow-fight-10.png),
session80-wow.json/log and session80-wow.html. Screenshot capture is deliberately
separate from acceptance because it perturbs presentation; combining its flag
with assertions is rejected. Intended player sentence: **"The first firefight
stays smooth when I get hit."** This is an intended experience, not a testimonial
or overall AAA/device acceptance.

Matched before/after preservation evidence, identical1920x1080 fixtures:
[combat before](.inspect/session80-before-match-combat-front.png) ->
[after](.inspect/session80-final-match-combat-front.png), and
[results before](.inspect/session80-before-match-dom.png) ->
[after](.inspect/session80-final-match-dom.png). Both PNG pairs have identical
SHA256 hashes. Art/lighting/gameplay changed by zero; the change is preparation.

Matched twelve-rifle/eleven-remote-operator stress on RTX5070 / Edge152 / ANGLE
D3D11, balanced/DPR1 at1920x1080. Every row retains its before draw/triangle/
texture/program/geometry counts and6.9/7.1/7.1ms median/p95/p99:

| Map | Calls / triangles | Textures / estimated MiB | Before -> after max ms |
|---|---:|---:|---:|
|Relay|238 / 150102|30 / 63.7448|7.7 -> 7.2|
|undertow|209 / 159284|26 / 63.3008|7.2 -> 7.2|
|switchyard|208 / 166956|29 / 63.9948|7.2 -> 7.2|

Each fixture has145volleys and96blasts over15s, then drains. This is neither an
iGPU test nor a speedup claim from single-run timing differences. These estimates
exclude transient browser compositor surfaces, buffers and driver overhead.

| Bytes | Before | After | Delta |
|---|---:|---:|---:|
|assets|27484756|27484756|0|
|public|34308684|34338885|30201|
|client|2126134|2136387|10253|
|map|4697111|4717059|19948|

Public32.7481MiB remains below60MiB; largest
file7183364bytes remains below25MiB. No new asset/download, dependency,
purchased derivative, collision/server/wire change or Meshy spend; balance1530
credits unchanged. Source map growth is included in public bytes. The map loader
remains lazy. Fresh-profile local page-ready observation is2552.1-3677.4ms;
UI preparation takes398.2-445.9ms before play. This is local loading and
preparation, including connection/assets, not CDN performance. Source data and
comparisons: session80-{before,final}-report.json and session80-summary.json;
node .inspect/session80-summarize.mjs reproduces them.

GPU evidence: session80-preparation-trace{,-trace,-summary}.json. The covered
433.9ms warmup has134 GPU raster tasks, with21 pixel and21 vertex executable
tasks overlapping it; every one of18 view windows contains raster work. Largest
overlapping executable:19.755ms wall/18.544ms CPU. Before that warmup, a283.3ms
loading interval overlaps ANGLE GetPixelExecutableTask:254.010ms wall/247.476ms
CPU. This records cold first-use compilation during loading, not a driver-fault
claim or a discarded gameplay frame. Additional post-preparation diagnosis is
recorded in the Session80 startup investigation addendum below.

Required verification: pnpm typecheck PASS; pnpm test PASS (637passed/six existing
skips,84passed files/four skipped); pnpm build:client PASS; pnpm audit:assets PASS.
Logs: session80-final-{typecheck,test,build-client,audit-assets}.log. Exact
node scripts/inspect-map.mjs --url http://localhost:8796 --shots relay,practice-two
PASS, zero console errors: session80-required-report.json/log and retained stills.
Nine final stress/UI views also pass, with no console/forbidden-network errors.
Exact node scripts/hitch-probe.mjs http://localhost:8796 150000 .inspect/hitch.json --assert
PASS; retained as session80-final-tdm-1.json/log. Supplementary DOM with the
first-use assertion also passes (14.3ms max).

All14 sequential TDM/FFA acceptance runs pass. Pairs3/4/5/6/7
are the **five consecutive pairs with complete early observation**, the final
proof below. Each uses a fresh browser profile,500us CPU profiling, normal
inputs and two natural bot deaths. The client bundle stayed SHA256-frozen;
no other browser, bake, build, test suite or trace analysis overlapped the probes.

| Run | Seconds / frames | Max frame / callback ms | First damage / death max ms | First-ready max ms | Deaths | Gate |
|---|---:|---:|---:|---:|---:|---|
|TDM 3|106.073 / 15271|18.4 / 14.2|7.6 / 8.3|45.3|2|PASS|
|FFA 3|31.066 / 4470|14.1 / 5.0|8.0 / 8.2|66.9|2|PASS|
|TDM 4|77.230 / 11112|28.4 / 8.4|9.0 / 9.5|46.5|2|PASS|
|FFA 4|65.590 / 9445|14.4 / 5.8|7.8 / 8.7|292.4|2|PASS|
|TDM 5|93.012 / 13389|17.8 / 14.4|7.8 / 8.6|46.0|2|PASS|
|FFA 5|77.878 / 11210|14.3 / 7.9|7.9 / 8.0|68.9|2|PASS|
|TDM 6|114.197 / 16442|21.9 / 10.8|8.2 / 8.1|63.5|2|PASS|
|FFA 6|45.737 / 6571|27.8 / 6.3|8.0 / 9.1|68.7|2|PASS|
|TDM 7|97.353 / 13993|28.2 / 22.6|8.4 / 8.8|65.4|2|PASS|
|FFA 7|47.614 / 6849|31.6 / 27.6|8.3 / 9.7|138.4|2|PASS|

All ten first-use windows per event pass150ms; first damage peaks at
9.0ms and death at9.7ms. Every whole-round
p99 upper bound is8ms and no interval in the ordinary gameplay measurement
exceeds150ms in this proof. Earlier observation includes first entry before
profiler setup and must not be described as universally smooth gameplay.
The first-ready column and20pre-measurement intervals
above150ms remain in the evidence; they are not silently filtered. In particular,
FFA4's292.4ms early interval is outside the later ordinary measurement and is
retained for startup investigation. Fresh browser profiles do not flush the
shared driver cache. First-use bounds here do not prove universal stall removal.

Rejected/intermediate evidence: two baseline TDM runs already pass their first
damage/death windows; no before/after first-hit speedup is claimed. The second
was initially labelled FFA despite omitting the mode flag; its unmodified
mode0 report/log is now session80-before-tdm-2. It retains an untraced283.4ms
gameplay gap, not assigned to a cause. Pairs1/2 of the final sequence lacked
pre-profiler damage observation, so the sequence was extended through pair7;
none of these reports was overwritten or counted toward the stronger five-pair
proof. No gate threshold, warmup allowance, bot route or death requirement changed.

Initial reference comparison rejected the prior file's UTF8 BOM; removing only
that byte-order mark allowed the full parsed-value comparison to pass.

Fresh tools/reference-audit.ts output deep-equals Session79:
session80-reference-{audit,comparison}.json. All63 canonical rows reviewed and
the gap list updated. Full/waist cover65/46,66/62,64/48; A-B/A-C/B-C sprint
rotations14.44/11.78/14.44,14.22/11.33/14.22,14.44/11.56/14.44s. Spawn travel
is not contact timing. ADS250/200/225/400/165ms, sprint recovery120/100/130/150/90ms;
TDM50/300s, respawn3s, DOM4/8s and0.5point/flag/s; hostile foley1.4,
hit900/1400Hz at.28gain, five-row top-right feed and both damage cues unchanged.

Open owner questions/defaults: retain the measured loading warmup(yes); return
to operator/weapon fidelity next(yes, release texture residency before growth).
No answer blocks progress. Human excitement/readability/comfort, laptop iGPU,
thermal, real6v6/RTT and Firefox/Safari remain unaccepted. No capacity/latency
claim. Final process cleanup/scope verification is recorded in the addendum.


**Session80 startup investigation and cleanup.** The full early observation
contains20 intervals above150ms:12 during loading and8 after ready, including
first entry before profiler setup. Every interval is retained below in ms;
this is not a universally smooth startup claim.

| Run | Loading gaps >150ms | After-ready, pre-profiler gaps >150ms |
|---|---:|---:|
|TDM 3|289.1|206.7|
|FFA 3|271.9|216.8|
|TDM 4|286.8|none|
|FFA 4|290.9|292.4, 477.1|
|TDM 5|284.3|none|
|FFA 5|279.5|599.2|
|TDM 6|290.1|none|
|FFA 6|280.6|394.0|
|TDM 7|304.3, 153.2|466.8|
|FFA 7|300.5, 156.2|156.6|

The three extra fresh-profile startup diagnoses retain all intervals and run
separately from acceptance. In session80-startup-3, a **462.2ms** early interval
at5567.9ms after navigation (148.9ms before the ordinary measurement origin)
is covered by the rolling trace. BrowserRasterWorker takes465.782ms wall/
7.390ms CPU; an ANGLE GetPixelExecutableTask takes461.675ms wall/3.782ms CPU.
The renderer thread executes7.117ms of tasks across that interval. Nearby game
draw calls take1.1-1.6ms,101-121draws/57-77materials, with zero new textures,
buffers, programs or shader links, zero target draws and no shadow request.
Existing skin texture updates and256byte buffer updates continue normally.
This is a **remaining cold-GPU-cache presentation cost after UI warming** in
the browser raster executable path, under the supervisor's explicit accepted
residue provision. It does not prove a named driver defect, make this cost good
gameplay, or assign that cause to every untraced interval (including292.4ms).

Evidence: session80-startup-{1,2,3}.json/log, their raw trace/summary files,
session80-startup-search.json, and the full
session80-startup-3-trace-summary.json. The earlier loading-only trace is
session80-preparation-trace{,-trace,-summary}.json. Reproduce covered full
windows with node scripts/hitch-trace-summary.mjs .inspect/session80-startup-3.json --startup;
node scripts/compositor-trace-summary.mjs .inspect/session80-startup-3 gives
per-view raster/executable counts and retained early WebGL diagnostics.
The short diagnoses intentionally have no two-death assertion; they are not
substituted for acceptance. No browser flags or hitch thresholds were changed.

The full wow sequence lasts25.991s, including the required20s and a respawn;
frame08 at20.779s shows the natural first death. All11stills are retained in
the scrubber. Screenshots were reviewed at full size. Their timing is not used
as performance acceptance.

Cleanup verified the saved preview root PID/creation time, then descendant
parentage/creation times before stopping the owned12-process tree.
session80-preview-tree.json and session80-cleanup.json confirm zero owned
processes, port8796listeners and inspection browsers remaining. Required gates,
supplementary DOM, scope/diff and the63-row audit are green; machine-readable
verification is session80-final-audit.json. The supervisor owns publication.
