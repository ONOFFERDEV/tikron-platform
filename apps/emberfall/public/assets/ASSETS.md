# Asset upgrade guide (샘플 지금, 교체 나중)

Every logical id in `manifest.json` currently resolves to a **procedural
primitive** (see `AssetRegistry` in `client/assets.ts`) — the game is fully
playable with zero downloaded assets. This doc is the swap-in contract: drop
a glTF/GLB file, point a manifest entry at it, done. **No client code
changes required** — `AssetRegistry.getUnitVisual()` is model-source-agnostic.

## How a swap works

1. Download a pack below, unzip it.
2. Copy the `.glb` (or convert `.fbx`/`.gltf` → `.glb`) into
   `public/assets/models/`.
3. Edit the matching entry in `manifest.json`: replace `"primitive": "..."`
   with `"model": "models/<file>.glb"`, and (for units) add an `"anims"` map
   from our 6 animation states to the pack's clip names.
4. Record the source + license in a `public/assets/LICENSE.md` you add at
   swap time (see `apps/gateway/public/assets/shooter/LICENSE.md` for the
   format this repo follows).

Example — swapping the warrior from primitive to a Quaternius GLB:

```json
"unit.warrior": {
  "model": "models/warrior.glb",
  "scale": 1.0,
  "anims": { "idle": "Idle", "walk": "Walk", "attack": "Attack", "cast": "Cast", "hit": "HitReact", "death": "Death" }
}
```

The 6 animation states the engine drives are fixed: `idle | walk | attack |
cast | hit | death`. Any state missing from `anims` (or any clip name that
doesn't match one in the GLB) silently falls back to whatever idle clip is
present — it never crashes the boot. If the GLB itself fails to fetch/parse
at runtime, `AssetRegistry` logs a warning and renders the procedural
fallback instead, keyed off the manifest's `"fallback"` entry.

## Packs (PLAN-EMBERFALL.md §6.2), all CC0

| Manifest ids | Pack | URL | Files → drop into |
|---|---|---|---|
| `unit.warrior`, `unit.mage`, `unit.cleric` | **Quaternius — Ultimate RPG Pack** (rigged + 6-ish anim clips per character) | https://quaternius.com/packs/ultimaterpg.html | `models/warrior.glb`, `models/mage.glb`, `models/cleric.glb` |
| `unit.wolf`, `unit.boar` | **Quaternius — Ultimate Monsters** (50 monsters, attack/death/run/walk anims) | https://quaternius.com/packs/ultimatemonsters.html | `models/wolf.glb`, `models/boar.glb` |
| `unit.goblin`, `unit.goblin_thrower`, `unit.goblin_shaman` | **Quaternius — Ultimate Monsters** (goblin variants) or **KayKit — Adventurers** for a stylised alt | https://quaternius.com/packs/ultimatemonsters.html · https://kaylousberg.itch.io/kaykit-adventurers | `models/goblin.glb`, `models/goblin_thrower.glb`, `models/goblin_shaman.glb` |
| `unit.skeleton`, `unit.wraith` | **KayKit — Character Pack: Skeletons** (rigged, compatible with KayKit Character Animations) | https://kaylousberg.itch.io/kaykit-skeletons | `models/skeleton.glb`, `models/wraith.glb` (wraith = tinted/scaled skeleton or reuse a caster pose) |
| `unit.golem` | **Quaternius — Ultimate Monsters** (largest/stone-toned monster) | https://quaternius.com/packs/ultimatemonsters.html | `models/golem.glb` |
| `unit.boss_chief`, `unit.boss_lord` | Any of the above, scaled up + tinted (plan explicitly allows sampling this way — no dedicated boss pack needed for v1) | — | reuse `goblin.glb` / `skeleton.glb` at larger `scale` + a distinct `tint` isn't available once on a real model; use a `"model"` entry with a bigger `scale` instead |
| `npc.vendor` | **KayKit — Character Pack: Adventurers** (reuse a merchant-styled character) | https://kaylousberg.itch.io/kaykit-adventurers | `models/vendor.glb` |
| `prop.tree_a` | **Quaternius — Ultimate Nature Pack** | https://quaternius.com/packs/ultimatenature.html | `models/tree_a.glb` (drop the `"primitive"` key, `"model"` only — props don't need `anims`) |
| `prop.rock_a` | **Quaternius — Ultimate Nature Pack** | https://quaternius.com/packs/ultimatenature.html | `models/rock_a.glb` |
| `prop.tent` | **KayKit — Adventurers** environment bits or **KayKit — Medieval Hexagon Pack** (has camp/tent-style props) | https://kaylousberg.itch.io/kaykit-medieval-hexagon | `models/tent.glb` |
| *(v2, town/dungeon environment — not wired into manifest.json yet, M2+)* | **KayKit — Medieval Hexagon Pack** (village: houses, well, market, walls) · **KayKit — Dungeon Pack Remastered** (floor/wall modules, pillars, braziers, doors) | https://kaylousberg.itch.io/kaykit-medieval-hexagon · https://kaylousberg.itch.io/kaykit-dungeon-remastered | `models/town/*.glb`, `models/dungeon/*.glb` |
| *(v2, UI — icons/bars/panels, not wired yet)* | **Kenney — UI Pack** + **UI Pack (RPG Expansion)** | https://kenney.nl/assets/ui-pack · https://kenney.nl/assets/ui-pack-rpg-expansion | `ui/*.png` |
| *(v2, UI icons — hotbar/skill icons)* | **game-icons.net** — **CC-BY, attribution required** (unlike everything else here) | https://game-icons.net/ | `ui/icons/*.svg` + record each icon's author in `LICENSE.md` |
| *(v2, audio — hit/cast/death/level-up/UI/BGM)* | **Kenney — RPG Audio** + **UI Audio** | https://kenney.nl/assets/rpg-audio · https://kenney.nl/assets/ui-audio | `audio/*.ogg` |

All Quaternius and KayKit packs above are **CC0** (public domain) — no
attribution required, though crediting the author is appreciated. Kenney
packs are CC0 too. **game-icons.net is the one exception**: it's CC-BY, so
any icon pulled from there needs a per-icon attribution line in
`LICENSE.md` (author + icon name + link), same pattern as
`apps/gateway/public/assets/shooter/LICENSE.md`.

## Format note

These packs ship `.fbx`/`.gltf`/`.obj`. `GLTFLoader` (already wired into
`AssetRegistry`) wants `.glb`. Convert with Blender (File → Export → glTF
2.0, Format: `glTF Binary (.glb)`) or the `gltf-pipeline` / `FBX2glTF` CLI —
whichever's already in your toolchain. Keep the combined `public/assets/`
budget ≤ 25MB per PLAN §8; move to R2 if a real pack push blows past that.
