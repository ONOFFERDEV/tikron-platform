# Emberfall audio assets — licensing

All audio in `audio/` is **Creative Commons Zero (CC0 1.0 Universal)** — public
domain. It may be used in personal and commercial projects with **no attribution
required**. Optional credit: Kenney (www.kenney.nl).

CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/

The game references these files by logical id (see `client/audio.ts`'s
`SFX_FILES`), never by path — several ids intentionally share one file.

| File | Source pack | Pack URL |
|------|-------------|----------|
| `audio/knifeSlice.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/knifeSlice2.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/chop.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/metalPot1.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/drawKnife1.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/cloth3.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/dropLeather.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/handleCoins.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/handleCoins2.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/metalClick.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/cloth1.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/beltHandle1.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/bookOpen.ogg` | Kenney — RPG Audio | https://kenney.nl/assets/rpg-audio |
| `audio/click1.ogg` | Kenney — UI Audio (UI SFX Set) | https://kenney.nl/assets/ui-audio |

## Verification of CC0

Each source pack ships a `License.txt` stating CC0. Verbatim excerpts:

**RPG Audio** (by Kenney Vleugels, Kenney.nl):
> License (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> You may use these assets in personal and commercial projects.
> Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.

**UI SFX Set** (by Kenney Vleugels, Kenney.nl):
> License (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> You may use these assets in personal and commercial projects.
> Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.

## 3D models — AI-generated

The following untextured GLB meshes in `models/` were generated for this project
with **FLUX.1-dev** (image) + **Hunyuan3D-2 mini** (image→3D) via **Modly**, and
are cleared for commercial use: `boss_lord`, `golem`, `roza` (vendor),
`everhearth`, `star_heart`, `portal_gate` — generated for this project, 2026-07-06.
They ship geometry only (no baked color); the game tints them at runtime via the
manifest's `tint`/`emissive` fields.

## 3D models — downloaded (CC0)

Animated character/creature meshes downloaded from CC0 sources. **Creative
Commons Zero (CC0 1.0)** — public domain, no attribution required (credit
optional). CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/

| File | Author | Source URL |
|------|--------|------------|
| `models/wolf.glb` | Quaternius | https://poly.pizza/m/P1gU3Qkr9r |
| `models/Knight.glb`, `Mage.glb`, `Ranger.glb` | Kay Lousberg — KayKit Adventurers | https://kaylousberg.itch.io/kaykit-adventurers |
| `models/Skeleton_Warrior.glb`, `Skeleton_Rogue.glb`, `Skeleton_Mage.glb` | Kay Lousberg — KayKit Skeletons | https://kaylousberg.itch.io/kaykit-skeletons |
| hero weapons (`models/sword_1handed`, `sword_2handed`, `shield_round`, `staff`, `wand` + `knight_texture.png`, `mage_texture.png`) | Kay Lousberg — KayKit Adventurers | https://kaylousberg.itch.io/kaykit-adventurers |
| skeleton weapons (`models/Skeleton_Blade`, `Skeleton_Shield_Small_A`, `Skeleton_Crossbow` + `skeleton_texture.png`) | Kay Lousberg — KayKit Skeletons | https://kaylousberg.itch.io/kaykit-skeletons |
| dungeon props (`models/barrel*`, `chest`, `column`, `crate*`, `crates_stacked`, `banner_red`, …) | Kay Lousberg — KayKit Dungeon | https://kaylousberg.itch.io/kaykit-dungeon-remastered |
| village props (`models/building_*`) | Kay Lousberg — KayKit Medieval Hexagon | https://kaylousberg.itch.io/kaykit-medieval-hexagon-pack |

The wolf ships a baked color texture and animation clips (Idle, Walk, Attack,
Death, Idle_HitReact_Left/Right, Gallop, Jump, Eating); the game drives
idle/walk/attack/hit/death via the manifest's `anims` map.

The **KayKit** packs by Kay Lousberg are all **CC0 1.0** (public domain, no
attribution required, commercial use unrestricted); credit is optional. They
supply the M3 dungeon roster (skeleton adventurers, incl. `Skeleton_Rogue`),
the player class meshes (Knight/Mage/Ranger), and the dungeon/village props.
CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/
