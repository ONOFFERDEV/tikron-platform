# Ironsight art concept — late-WW1 infantry front

**Owner decision 2026-09-11: browser Battlefield 1 direction, original WW1 assets.** This
document governs look and tone. The typed delivery authority is `config/ww1-assets.ts` and
the execution authority is `.omo/plans/ironsight-competitive-replan.md`. Historical session
notes remain provenance, but their modern equipment programme is superseded.

## The one-line target

A battered late-war infantry front: wool, webbing, timber, mud, brick, blued steel and worn
wood, with legible iron sights and heavy mechanical motion. It is fictional and original,
without copied Battlefield geometry, real unit insignia, or unsupported historical claims.

## What changes from today's look

Today the game reads as clean stylized sci-fi industry: bright ivory concrete, saturated
teal and amber accents, flat untextured surfaces, clear blue sky, tidy undamaged
architecture, red plastic-looking operators. That is the Titanfall/Overwatch lane. Move it:

| Axis | From (now) | To (WW1 infantry lane) |
|---|---|---|
| Palette | ivory + saturated teal/amber | desaturated olive, grey-brown, concrete grey, rust; accents muted to safety-faded amber and pale teal, used sparingly on signage only |
| Saturation | mid-high, cheerful | low; colour comes from light (sun, sodium lamps, fire) not from paint |
| Surfaces | flat single-colour panels | layered tiling detail: aggregate concrete, scratched steel, chipped paint, streak stains, water marks, rust bleed at joints |
| Damage | pristine | war-worn: shell scars on walls, blown-out windows, buckled fences, collapsed sections, sandbag and concrete-block emplacements, debris piles, burnt vehicles |
| Air | clear | haze with depth; dust motes, smoke columns on the skyline, drifting smoke at ground level, heat shimmer over machinery |
| Light | even daylight | directional and dramatic: hard sun with long shadows and strong ambient occlusion, or overcast flat grey, or dusk with sodium/emergency lighting; heavy contrast between lit ground and shadowed interiors |
| Characters | red/blue plastic operators | two original wool-uniform soldiers; khaki vs field-grey torso value, different helmet outlines and webbing placement; no plate carrier, knee pad or personal radio antenna |
| Weapons | clean stylised modern bundle | five distinct wood-and-steel service silhouettes with iron sights and visible magazine/bolt/slide/pump/clip/shell motion |
| Sound-visual pairing | discrete pops | firefights that look and sound loud: muzzle blast dust, tracers, spent brass, impact dust puffs, concrete spall, ricochet sparks |
| Camera | steady | weighted: subtle sway walking, dip on landing, shake near explosions, dust on the lens near blasts |

## Reference language (do not copy assets or layouts, only principles)

Battlefield 1 supplies experience principles only: readable silhouettes, grounded material
weight, strong value separation, functional spaces and battlefield atmosphere. Keep the
Ironsight identity and original signage. Never reproduce another game's model, map, logo,
sound, unit mark or texture. Exact equipment dates and names require the research ledger;
unverified assets remain fictional late-war designs.

## Per-map treatment

- **arena1 / signal station**: hard daylight, timber communications shelter, mast and field
  telephone positions, with dust and distant smoke behind a defended yard.
- **arena2 / underpass trench**: wet masonry, dugouts, drainage and low dusk light; dark
  interiors stay readable against the sky without cosmetic smoke becoming cover.
- **arena3 / front supply depot**: overcast rail unloading, timber platforms, ammunition
  stacks, wagons and bomb damage. Modern transformer/container language is removed.

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

## Level design: places, not arenas (owner decision 2026-09-10, "the maps need remaking")

The overhead view is the tell: today every map is **a fenced flat rectangle of closed
single-storey boxes on a grid**. Nothing can be entered, nothing is above or below you, the
boundary is a chain-link fence with empty ground beyond it, and the layout is mirrored on a
tile grid. That reads as an arena, which is the opposite of the Battlefield lane, and it is
why the maps feel thin no matter how good the surfaces get.

What a map must become, in priority order:

1. **Buildings you fight inside.** At least two enterable structures per map with a real
   interior: doorways, windows that are firing positions, internal cover, a stairwell or
   ladder to a second floor, and a roof you can hold. Interiors are where the Battlefield
   read comes from (dark inside against blown-out sky, R-L12/14 value contrast).
2. **Three floor planes actually used** (R-M18): ground, a walkway/roof tier around +3 m,
   and a sunken tier (service trench, drainage channel, loading dock) around -2 to -3 m.
   Not decorative — routes must run through all three.
3. **A built boundary, not a fence.** Replace the perimeter fence with mass: masonry
   walls, embankments, timber revetments, a rail cut, a canal edge and collapsed structures.
   The player should feel enclosed by the place, not by a barrier. Keep the same playable
   rectangle for the server; only the presentation of the edge changes.
4. **Break the grid.** Rotate and offset structures off the tile axis, vary building
   footprints and heights, let one side of the map be a different kind of space from the
   other (yard vs hall vs channel) while keeping the three lanes and mirrored power
   positions that the reference requires (R-M01, R-M08 asymmetric landmarks).
5. **Evidence of use and of war**: emplacements at the objectives, blocked doorways,
   craters and rubble that change routes, vehicles parked where they would be parked.

**Technical path (verified, no engine change needed).** Collision is a list of `Box`
(`min`/`max` Vec3) plus ramps, and `min.y` is arbitrary — so a floor slab at y = 3.0-3.3 and
a wall with a door gap are already expressible today; the physics, hit validation and bot
navigation all consume the same box list. The only limit is the **authoring format**:
`tilemap.ts` is a 2D grid with one height class per tile, every box starting at y = 0.
So the first arc is an authoring upgrade, not a rewrite:

- Add a **structure layer** compiled into the existing box list: a building definition with
  footprint, wall segments (thin boxes) with door/window openings, floor slabs at given
  heights, stairs (existing ramp defs or stepped boxes), and roof access. Keep the tile grid
  for open-yard cover so existing maps keep working.
- Extend `GroundNavigator`/bot nav to route through doorways and up stairs, or restrict bots
  to the ground plane on purpose and say so in the log.
- Re-bake ground AO and architecture AO per map after every layout change, and re-measure
  R-M04 rotation and R-M07 spawn-to-contact seconds; interiors will change both.
- Keep the collision map the sole authority; if it looks like cover it must be cover.

Sequence: (A) structure authoring layer + one enterable building on Relay as proof;
(B) Relay redesigned as a place; (C) Undertow; (D) Switchyard; (E) boundary mass and
grid-breaking pass across all three. Each session green, each with an overhead before/after.

## Meshy and authored asset programme

P alone owns paid generation and receipts. The current execution cap is 600 credits total,
150 per batch, while preserving at least 300. Preview acceptance precedes refine. A completed
API task is still a candidate until geometry, topology, provenance, fit and runtime budgets
pass. A weak generated silhouette is rejected rather than hidden by materials or smoothing.

1. Five weapon receiver candidates and two clean A-pose soldier candidates are generated;
   iron sights, mechanical parts, helmets, FP arms, LODs and sockets are directly authored.
2. Six environment candidates are generated: timber supply wagon, period ammunition crate,
   field telephone, damaged freight wagon chassis, brick rubble and timber observation post.
3. Repeated trench wall, duckboard, sandbag, timber brace, wire and rail/platform modules,
   grenade, pooled clip/shell/casing geometry, and the non-pilot biplane are directly authored.
4. Raw or rejected candidates stay under `.inspect`; only accepted receipt-linked hashes enter
   `public/assets/ww1`. The typed inventory and role budgets live in `config/ww1-assets.ts`.

Textures, decals, haze, lighting and post remain authored or baked work. Meshy supplies
candidate geometry only and never supplies gameplay authority, final rig quality, or proof.
