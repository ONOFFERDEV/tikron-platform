# ironsight art concept — grounded modern warfare (Battlefield lane)

**Owner decision 2026-09-10: Battlefield feel, not Overwatch.** This document is the
authority on look and tone. When it disagrees with an older art note in AAA-PLAN.md, this
wins. `AAA-DESIGN-REFERENCE.md` still governs readability and gameplay rules; where the two
pull against each other, readability wins and the concept bends (see "Non-negotiables").

## The one-line target

A working industrial site that a modern war has arrived at this week: grounded, dusty,
desaturated, physically plausible, with smoke on the horizon and gear that looks issued
rather than designed. Weight over agility, grit over gloss, scale over spectacle.

## What changes from today's look

Today the game reads as clean stylized sci-fi industry: bright ivory concrete, saturated
teal and amber accents, flat untextured surfaces, clear blue sky, tidy undamaged
architecture, red plastic-looking operators. That is the Titanfall/Overwatch lane. Move it:

| Axis | From (now) | To (Battlefield lane) |
|---|---|---|
| Palette | ivory + saturated teal/amber | desaturated olive, grey-brown, concrete grey, rust; accents muted to safety-faded amber and pale teal, used sparingly on signage only |
| Saturation | mid-high, cheerful | low; colour comes from light (sun, sodium lamps, fire) not from paint |
| Surfaces | flat single-colour panels | layered tiling detail: aggregate concrete, scratched steel, chipped paint, streak stains, water marks, rust bleed at joints |
| Damage | pristine | war-worn: shell scars on walls, blown-out windows, buckled fences, collapsed sections, sandbag and concrete-block emplacements, debris piles, burnt vehicles |
| Air | clear | haze with depth; dust motes, smoke columns on the skyline, drifting smoke at ground level, heat shimmer over machinery |
| Light | even daylight | directional and dramatic: hard sun with long shadows and strong ambient occlusion, or overcast flat grey, or dusk with sodium/emergency lighting; heavy contrast between lit ground and shadowed interiors |
| Characters | red/blue plastic operators | soldiers in plate carriers, helmets with covers, knee pads, pouches, radio antennas; team read by faded fabric colour + patch + helmet band, not by full-body tint |
| Weapons | clean stylised | issued kit: worn polymer and parkerised steel, rail-mounted optics, slings, taped magazines |
| Sound-visual pairing | discrete pops | firefights that look and sound loud: muzzle blast dust, tracers, spent brass, impact dust puffs, concrete spall, ricochet sparks |
| Camera | steady | weighted: subtle sway walking, dip on landing, shake near explosions, dust on the lens near blasts |

## Reference language (do not copy assets or layouts, only principles)

Battlefield 3/4/1's industrial and urban maps: functional structures first, decoration as
evidence of use; whole-scene value contrast (dark interiors against blown-out sky); smoke
and particulate as a primary composition tool; destruction as silhouette change. DICE's own
rule of building for the main mode first applies (R-M15). Keep the "Ironsight" name and all
original signage; never reproduce a real brand, unit insignia, or another game's identifiable
geometry, logo, or map layout. Weapon and vehicle props stay generic-military by description
(bullpup carbine, wheeled APC, flatbed truck) with no real model names or manufacturer marks.

## Per-map treatment

- **Relay** (comms transfer yard, hard noon sun): dusty concrete apron, sun-bleached
  paint, long hard shadows, dust devils, a distant smoke column behind the dish. Hero
  focus: the relay mast and dish complex, sandbagged comms shelter, generator bank.
- **Undertow** (water reclamation plant, dusk): wet concrete with standing water and real
  reflections, sodium lamps, steam from the pipes, dark interiors against an orange sky,
  rust bleeding down tanks. Hero focus: the pump hall interior, sluice channel, clarifier.
- **Switchyard** (power distribution depot, overcast): flat grey light, wet asphalt,
  transformer banks with insulator strings, gantry and containers, puddle reflections,
  a burnt-out truck and blast crater. Hero focus: the capacitor bank and crane.

## Non-negotiables (readability and budget outrank mood)

1. **Enemies must stay instantly readable** (R-G09, R-L12/13/14). Desaturating the world is
   what makes soldiers read; keep the enemy rim/fresnel highlight and a large faded-colour
   mass on the torso. If a grittier palette ever hides a soldier, the soldier wins.
2. **No graphics setting may reveal or hide gameplay information** (R-L14). Smoke, haze and
   post are cosmetic only; anything that blocks sight must be server-known and hard-edged.
3. **60 fps at 1080p on a mid laptop iGPU.** Haze, dust and reflections are cheap fakes
   (billboards, screen-space, baked cubes), not volumetrics or SSR unless measured.
4. **Assets: 60 MiB public ceiling, 25 MiB per file, lazy per map**, and the hitch gate
   stays green — new textures are the most likely cause of a new stall, so log first-load
   time and the hitch probe every session.
5. **Colourblind support stays**: enemy highlight colour remains user-selectable.

## Meshy asset programme (owner budget: 1,300 credits)

A preview + PBR refine is ~30 credits, so the budget is roughly 40 assets. Spend it on
silhouettes a player sees in the first five minutes, in this order. Generate at
`--polycount 2000-4000`, always `tools/shrink-glb.py --size 512 --webp` before shipping,
inspect in the map inspector, and **reject and re-prompt rather than shipping a weak
silhouette** (the cable-drum lesson). Cap **150 credits per session** and log credits
spent, bytes added and the reject count every time.

1. **Soldier kit and weapons (10-12 assets, ~350 credits).** Plate carrier, helmet with
   cover, pouch set, knee pads, radio pack, sling; carbine, SMG, shotgun, bolt sniper,
   pistol as worn-military versions of the existing five. These change every frame the
   player sees — do them first.
2. **Combat set dressing (10-12 assets, ~350 credits).** Sandbag wall, HESCO-style barrier,
   concrete block barricade, jersey barrier, razor-wire coil, ammo crates and pallets,
   fuel drums, generator, field antenna mast, folded tarp, tool cart.
3. **War-worn hero props (8-10 assets, ~300 credits).** Burnt-out truck, wheeled APC hulk,
   flatbed truck, forklift, shipping containers (dented and holed variants), transformer,
   pump housing, blast-cratered slab, collapsed wall section.
4. **Scale and skyline (6-8 assets, ~200 credits).** Cooling tower, chimney stack,
   silo cluster, pylon, water tank, distant crane, bombed structure shell.
5. **Reserve (~100 credits)** for re-prompts and one late signature piece.

Textures, decals, haze, lighting and post are **not** Meshy work: do them procedurally or
with Blender bakes. Meshy is only for geometry whose silhouette matters.
