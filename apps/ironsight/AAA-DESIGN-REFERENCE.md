# ironsight AAA Design Reference

Compiled 2026-09-08 from GDC talks, developer blogs, official docs and analyses of the
best-selling / most acclaimed multiplayer shooters (Call of Duty, Counter-Strike, Valorant,
Halo, Overwatch, Titanfall / Apex, DOOM, Destiny, Battlefield, Rainbow Six Siege, Quake /
UT, Team Fortress 2, Splatoon, Fortnite). Owner directive: learn from what sold and what
reviewed well, and apply it here.

How to use (astra, every session): pick the gap item, list the reference ids it touches as
`Reference: R-M03, R-G06`, state the concrete target, deliver, then record met / partial /
not yet in the `## Reference scorecard` at the top of the AAA-PLAN.md session log. When
your instinct and the reference disagree, follow the reference unless a guardrail or budget
forbids it, and say so in the log. Numbers are targets to measure against, not decoration.

ironsight facts the references are applied to: 60 x 40 m arenas, 6v6 TDM and Domination
(A/B/C), bots, five weapons (AR, SMG, shotgun, sniper, pistol), server-authoritative hits,
browser Three.js, 60 fps iGPU budget.

---

## M. Map and level design

**R-M01 Three lanes, each with a stated purpose.** Two side lanes + one center lane between
spawns; "never more than three decisions". A power position on one side is answered by an
opposing one; each main path has 1+ flank route. (Treyarch, Black Ops 7 interview —
https://news.xbox.com/en-us/2025/10/27/how-treyarch-crafts-multiplayer-maps-call-of-duty-black-ops-7/)
Apply: lanes along the 60 m axis, ~14 m open mid power lane, 10-14 m flanks, 2-3 lateral
connectors, mirrored power positions each side of mid. Write the purpose of every lane in the
map's design note.

**R-M02 Co-visible chokepoints.** Never more than 2 entrances into an objective/room that one
defender cannot see at once. Long sightlines favour rifles, tight tunnels force close fights.
(WoLD CS layout guide — https://www.worldofleveldesign.com/categories/csgo-tutorials/csgo-how-to-design-gameplay-map-layouts.php ;
https://www.gamedeveloper.com/design/why-is-de_dust2-s-level-design-so-popular-)
Apply: each cap point has exactly 2 sightlined approaches visible from one defensive spot; one
long lane with a 20 m+ sightline, one tight lane under 8 m.

**R-M03 Cover height classes.** Waist cover 1.0-1.25 m (peek, stops body shots), full cover
>= 1.75 m (breaks LOS); avoid head-height 1.5-1.6 m (bad duels); < 0.5 m is decoration.
(CS "dos and don'ts" — https://steamcommunity.com/sharedfiles/filedetails/?id=1110438811 ;
Level Design Book, Schatz — https://book.leveldesignbook.com/process/combat/cover)
Apply: audit every collider height per map; convert head-height boxes to waist or full.

**R-M04 Rotation timing 10-15 s.** Site-to-site rotation 10-15 s (ideal 12-14): < 10 s
over-favours defence, > 20 s kills retakes. (Mapcore — https://www.mapcore.org/forums/thread/18489-csgo-good-map-rotation-times/)
Apply: measure A→B, B→C, A→C at run speed with `walkSeconds`; target 10-15 s.

**R-M05 One mechanical hook per map.** Push each map in one direction instead of balancing every
permutation; give it a signature gimmick. (Riot, Fracture — https://playvalorant.com/en-us/news/dev/controlled-ruptures-making-valorant-s-fracture/)
Apply: Relay, Undertow, Switchyard each get one named hook (one-way drop, catwalk, sunken
channel, destructible barrier) that changes routes, not only looks.

**R-M06 Neutral symmetric power pickups.** Fixed, symmetric, neutral spots just outside
objectives. (https://wiki.playvalorant.com/en-us/Orbs) Apply: any pickup at mid, equidistant
from both spawns.

**R-M07 30 seconds of fun, repeated.** Time to next engagement ~20-30 s. (Griesemer, Bungie —
https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer/)
Apply: spawn→first contact and point-loss→recontest measured in the 20-30 s band.

**R-M08 Deliberate asymmetry for orientation.** Balance-symmetric, but unique landmark
silhouettes per half so players know where they are. (Bungie map design PDF —
https://www.jmeiners.com/shamans/papers/art/bungie_map_design.pdf ; Halo 3 ViDoc —
https://halo.fandom.com/wiki/Halo_3_ViDoc:_Mapmaker,_Mapmaker_Make_Me_a_Map)

**R-M09 Spawns: wall-backed, landmark-facing, weighted away from enemies.** Enemy position / LOS
lowers a spawn's weight, teammates raise it; zone size scales with map size.
(Halo 3 docs — https://learn.microsoft.com/en-us/halo-master-chief-collection/h3/guides/mpmapsetup ;
https://halo.bungie.org/misc/fyrewulff_spawnsystem/) Apply: score spawn candidates every
respawn by enemy distance and recent enemy sightlines; never spawn inside a living enemy's LOS.

**R-M10 Arena inside an arena.** A tight combat shell around each capture point nested in the
broader lane space. (Keller, Overwatch — https://www.redbull.com/us-en/blizzard-on-overwatch-balancing-and-eichenwalde)
Apply: inner ring of closer cover around A/B/C.

**R-M11 Design for total traversal.** Every reachable vantage must be dressed and contained.
(https://www.gamedeveloper.com/design/the-challenge-of-designing-i-overwatch-i-maps-when-players-can-get-literally-everywhere-)

**R-M12 Action blocks before geometry.** Prototype lane segments as distinct traversal/combat
beats. (Dionne, Titanfall 2, GDC 2018 — https://www.gdcvault.com/play/1025105/Designing-Unforgettable-Titanfall-Single-Player)

**R-M13 Zones identifiable on sight with a unique theme.** Each lane and objective has a
distinct silhouette/theme usable as a callout; maps in the pool differ deliberately.
(Apex — https://www.aspaceman.com/apex ; https://dotesports.com/apex-legends/news/storm-point-brings-design-lessons-from-kings-canyon-worlds-edge-and-a-year-of-apex-live-play)

**R-M14 Windows and destruction are persistent lanes.** Openings overlooking objectives are
contested all round; any destructible element must change routes. (L'Heureux GDC 2016 —
https://gdcvault.com/play/1023003 ; Ubisoft Kafe blog — https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/6nDqxITrS6tFdhjFkmVnrZ/dev-blog-level-design-kafe)

**R-M15 Design the majority mode first.** Build geometry for Domination first, verify TDM on
it. (DICE — https://battlelog.battlefield.com/bf4/de/news/view/mapdesign)

**R-M16 Item control as strategic core.** Central high-risk item, ~30 s timers, never cornered,
audible pickup. (Quake3World — https://www.quake3world.com/forum/viewtopic.php?t=50729 ;
Yoder GDC 2018 — https://www.gdcvault.com/play/1025497/Level-Design-Workshop-The-Holy)

**R-M17 Weenies and lit contrast drive wayfinding.** One tall central landmark visible down all
lanes; objectives lit/coloured distinctly from lanes and from each other. (Rogers GDC 2009 —
https://www.gdcvault.com/play/1305/Everything-I-Learned-About-Level ; https://book.leveldesignbook.com/process/blockout/wayfinding)

**R-M18 At most 3 floor planes, 3 m / 6 m steps.** (https://book.leveldesignbook.com/process/layout/flow/verticality ;
https://www.ongamedesign.net/designing-fps-multiplayer-maps-part-1/) Apply: ground, +3 m
tier, -2 to -3 m tier, reused across lanes.

**R-M19 Footprint vs player count.** 60 x 40 m for 12 = 200 m²/player = Nuketown/Shipment
density; only valid with short engagement ranges and fast TTK. For 20 m+ rifle duels widen to
80-120 m long axis or lower the count. (same source) Apply: decide per map and write it down;
sniper lanes on a 60 x 40 m map must be the exception, not the norm.

**R-M20 Validate with telemetry.** Kill/death heatmaps per lane and objective, win rate by spawn
side over many rounds (2fort looked symmetric and was not). (Ambinder, Valve GDC 2009 —
https://book.leveldesignbook.com/process/blockout/playtesting) Apply: add a bot-match heatmap
tool and report side win rate per map before calling a layout done.

---

## G. Gunplay, feel and combat readability

**R-G01 Push-forward combat.** Remove what rewards retreat; tie recovery to aggression.
(id, GDC 2018 — https://www.gdcvault.com/play/1024940/Embracing-Push-Forward-Combat-in)
Apply: ammo/health near contested space; consider a small reward for aggressive actions.

**R-G02 Golden triangle and TTK as a lever.** Guns + grenades + melee/movement, none dominant;
tune TTK per weapon by duel feel, in fractions of a second. (343 —
https://www.halowaypoint.com/en-us/news/inside-infinite-january-2021 ; Griesemer GDC "0.5 to
0.7 seconds for Halo 3" — https://gdcvault.com/play/1012211)

**R-G03 Near-instant TTK weapons need telegraphs.** Sniper: glint, tracer, footsteps, travel
or ready-up time. (Respawn — https://gdcvault.com/play/1024056/Solving-Titan-Sized-Problems-Evolving)

**R-G04 First shot is sacred; movement penalty dwarfs stance bonus.** Tactical tier TTK
0.15-0.30 s vs 200-250 ms human reaction; first N shots deterministic; moving inaccuracy far
larger than standing/crouch difference (crouch 16-34%). (https://csdb.gg/recoil-patterns/ ;
https://csdb.gg/crouch-when-shooting/) Apply: near-zero first-shot spread when still; movement
spread multiplier large; expose the table.

**R-G05 Deterministic learnable recoil.** Per-weapon fixed (dx, dy) sequence, reset on release;
first 3-5 shots near vertical, horizontal drift later. (https://counterstrike.fandom.com/wiki/Recoil)
**R-G06 Hybrid after N shots + ADS/stationary multiplier.** Controlled randomness deep in the
spray; ADS and crouch stack multiplicatively; centre-bias error. (Riot via
https://www.thespike.gg/valorant/news/valorant-s-design-philosophy/41)

**R-G07 Trauma-driven camera shake.** trauma 0-1, shake = trauma² or ³, rotational only,
2-10° max, ~2 s decay, render layer only. (Eiserloh GDC 2016 — https://www.gdcvault.com/play/1023146)
**R-G08 Separate aim kick from viewmodel kick.** Authoritative aim offset vs cosmetic
viewmodel rotation; ship a "reduce view kick" setting. (https://www.setup.gg/game/cs2/fov-viewmodel/)

**R-G09 Silhouette readability as art pillar.** Enemy colour/rim contrast against environment
and allies; distinct held pose per weapon class. (Petras & Tsang GDC 2017 —
https://www.gdcvault.com/play/1024268/The-Art-of-Overwatch-Evolving)
**R-G10 Muzzle flash identifies the weapon; 2-4 frames.** Unique shape/colour per weapon.
(https://www.gamedeveloper.com/design/vfx-as-game-design-tools-the-ludology-of-vfx-in-god-of-war-ragnarok-and-halo-infinite)
**R-G11 Every bullet is a tracer.** Especially sniper, so victims can trace the shooter.
(https://tropedia.fandom.com/wiki/Every_Bullet_Is_a_Tracer)
**R-G12 Keep the combat corridor clear.** Reload/inspect flair away from the centre 15-20%
vertical strip. (Helsby GDC 2015 — https://gdcvault.com/play/1022298/The-Art-of-First-Person)
**R-G13 FOV 90-100 default, slider capped ~110.** 90→103 costs ~12% target width.
(https://fovcalculatorpro.com/blogs/best-fov-competitive-fps/)

**R-G14 Play by sound; enemy footsteps louder.** Enemy footstep/reload gain 1.3-1.5x vs ally
at equal distance; distinct footstep sets. (Blizzard GDC 2016 — https://gdcvault.com/play/1023317/Overwatch-The-Elusive-Goal-Play)
**R-G15 Hit-confirm sound is mandatory.** One distinct non-weapon hit pip + kill variant above
the weapon in the mix; absence misinforms. (https://www.pcgamer.com/the-origin-of-call-of-dutys-most-heard-sound/)
**R-G16 Occlusion, not naive distance.** Heavy volume/low-pass cut behind solid geometry.
(https://www.gamedeveloper.com/design/game-design-deep-dive-dynamic-audio-in-destructible-levels-in-i-rainbow-six-siege-i-)
**R-G17 Layered weapon audio.** Shared crack + unique identity transient + tail + distance
variants; priority mixing. (Strandberg — https://designingsound.org/2010/03/29/battlefield-bad-company-2-exclusive-interview-with-audio-director-stefan-strandberg/ ;
BF1 GDC 2017 — https://gdcvault.com/browse/gdc-17/play/1024111)

**R-G18 Weapon FOV separate from world FOV; procedural sway; ADS cuts sway 50-80%.**
(Helsby GDC 2015, above)
**R-G19 Sprint-to-fire and ADS are deliberate timers.** Sprint-to-fire 90-150 ms; ADS pistol
150-180, SMG 180-220, AR 230-270, shotgun 200-250, sniper 350-450 ms; server-validated.
(https://hone.gg/blog/ads-in-call-of-duty/)
**R-G20 One data table for feel and authority.** Recoil curve, first-shot accuracy, movement
penalty, ADS time, sprint-to-fire live in one per-weapon table read by client prediction and
server; all juice is a client layer on server-confirmed events.

---

## L. Fun loop, match flow, presentation, onboarding

**R-L01 Streak rewards with caps and a reset.** 3-tier streak (reveal / buff / support) reset on
death, capped so a hot player cannot lock the match; pair with a mild catch-up element.
(https://machinations.io/articles/game-systems-feedback-loops-and-how-they-help-craft-player-experiences)
**R-L02 Mode pacing norms.** TDM 6v6: score limit 50-75 kills, ~10 min soft cap. Domination:
10 s uncontested capture, 1 point / 5 s per flag, first to 200, sides swap at half.
(https://www.callofduty.com/guides) Apply: match `MATCH`/`MODES` config to these and log the
actual match lengths from bot rounds.
**R-L03 TTK is a spectrum; bias moderate-high here.** 3-4 hits at close range for the AR;
0.2 s changes are felt. (Griesemer GDC — https://gdcvault.com/play/1012211 ;
https://www.nme.com/news/gaming-news/call-of-duty-modern-warfare-3-developers-talk-visibility-changes-and-lengthy-time-to-kill-3513887)
**R-L04 Respawn 3-5 s in TDM, dynamic spawn scoring.** Spawn camping is a spawn-logic bug, not
a timer bug. (https://www.gamedeveloper.com/programming/definitive-solution-to-spawn-camping-in-a-fps-game)
**R-L05 Tight round rhythm.** Deployment 20-30 s max and skippable, round 90-120 s if
round-based, 5-8 s result freeze, no dead air. (Valorant timings, community-verified —
https://turbosmurfs.gg/article/how-long-is-a-valorant-game)

**R-L06 Play of the Game / MVP moment that is not pure kill count.** 5 s intro + 12 s replay;
score difficulty, saves and objective plays. (https://www.gamedeveloper.com/design/designing-and-improving-i-overwatch-i-s-play-of-the-game-highlights)
Apply: replay the top 8-10 s moment from the MVP's POV before the scoreboard.
**R-L07 Algorithmic MVP for small/bot lobbies; vote only for next map.** CS: 2/kill, 1/assist,
winning team only. (https://counterstrike.fandom.com/wiki/MVP)

**R-L08 Ping system built with voice banned.** One key, context-aware line (enemy / go here /
need backup), wheel for explicit types. (https://www.gamedeveloper.com/design/respawn-played-with-muted-mics-to-get-i-apex-legends-i-smart-comms-system-just-right)
**R-L09 Onboarding teaches only what is needed to feel competent.** First match: move, aim,
shoot, one objective, ping. Everything else after match 1. (Hodent GDC 2016 —
https://gdcvault.com/play/1023231)
**R-L10 Bot-blended first matches.** First 2-3 matches all-bot with rising aggression, then
taper; never bots in ranked. (https://www.fortnite.com/news/fortnite-matchmaking-update-battle-royale)
**R-L11 Bot difficulty by reaction delay and look-ahead, not HP/damage.** Easy 600 ms → hard
150 ms reaction; hard bots path to flanks. (https://www.gamedeveloper.com/game-platforms/building-ai-for-games-that-scales)

**R-L12 Illustrative rendering: readability is the goal.** Rim highlights, value banding,
silhouettes readable in any lighting. (Valve NPAR 2007 — https://steamcdn-a.akamaihd.net/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf)
**R-L13 Value contrast beats colour count.** One large team-colour mass on the torso/shoulders,
one saturated accent, compress small details. (https://medium.com/@xavierck/character-readability-in-team-fortress-2-and-overwatch-68c41d454465)
**R-L14 Gameplay clarity pillars.** No graphics setting may reveal or hide gameplay info; enemy
red / ally blue fresnel amplified with distance; environment flatter than characters;
vision-blocking VFX hard-edged. (Riot — https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity)
**R-L15 Resource loop is the fun.** Small HP/ammo reward for aggressive skill actions. (id GDC
2018, above)
**R-L16 One mechanic, many jobs; stagger content.** (Nogami GDC 2018 — https://gdcvault.com/play/1024999)
**R-L17 Medal rules.** Reward explicit repeatable actions; never reinforce failure; names read
well aloud. (343, Grossman)

**R-L18 Sound priority is asymmetric.** Enemy sounds +20-30% and threat-weighted by
reachability. (Blizzard GDC 2016, above)
**R-L19 Favour the shooter; escapes favour the escaper; show a network-quality indicator, not
tick numbers.** (Ford GDC 2017 — https://gdcvault.com/play/1024001)

**R-L20 Killfeed conventions.** Bottom-left, 4-5 entries, killer → weapon icon → victim,
headshot icon, enemy red / friendly neutral, objective events in the same feed.
(https://callofduty.fandom.com/wiki/Killfeed)
**R-L21 Damage indicators need two cues.** Full-screen flash + directional edge/arrow (front,
back, left, right is enough). (https://medium.com/@jasper.stephenson/a-ux-analysis-of-first-person-shooter-damage-indicators-59ac9d41caf8)
**R-L22 Minimap is a choice.** Minimal minimap (pings, recent gunfire) keeps pings meaningful.
(https://playcaliber.com/en/news/638/about-our-approach-to-hud-design)
**R-L23 Colourblind: enemy highlight colour dropdown on the same rim shader.** (https://switchbladegaming.com/game-settings/colorblind-players)

**Top review complaints and the counter:** hit registration (R-L19, one data table R-G20),
sweaty matchmaking (R-L10), queue waits (few dense playlists), spawn camping (R-L04, R-M09),
visibility (R-L12-14), grind (30-90 s core loop), stutter (R-L14 performance pillar, hitch
probe), monetization (out of scope).

---

## Scorecard template (copy into AAA-PLAN.md and keep current)

| Id | Status (met / partial / not yet / n.a.) | Evidence |
|---|---|---|
| R-M01 | | |
| … | | |

Sourcing notes: some talk titles commonly cited online do not exist on the GDC Vault (e.g.
"The Animation of Call of Duty", a DOOM Eternal-specific GDC talk); the closest verified
sources are used above. Valorant timer figures are community-verified, not Riot-published.
