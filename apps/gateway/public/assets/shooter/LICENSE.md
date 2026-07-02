# Shooter demo assets — licensing

All assets in this folder are **Creative Commons Zero (CC0 1.0 Universal)** —
public domain. They may be used in personal and commercial projects with **no
attribution required**. Optional credit: Kenney (www.kenney.nl).

CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/

| File | Origin file | Source pack | Pack URL |
|------|-------------|-------------|----------|
| `player.png` | `PNG/Man Blue/manBlue_gun.png` | Kenney — Top-down Shooter | https://www.kenney.nl/assets/top-down-shooter |
| `enemy.png` | `PNG/Man Brown/manBrown_gun.png` | Kenney — Top-down Shooter | https://www.kenney.nl/assets/top-down-shooter |
| `ground.png` | `PNG/Tiles/tile_09.png` | Kenney — Top-down Shooter | https://www.kenney.nl/assets/top-down-shooter |
| `crate.png` | `PNG/Tiles/tile_129.png` | Kenney — Top-down Shooter | https://www.kenney.nl/assets/top-down-shooter |
| `muzzle.png` | `PNG (Transparent)/muzzle_01.png` | Kenney — Particle Pack | https://kenney.nl/assets/particle-pack |
| `shot.ogg` | `Audio/laserRetro_000.ogg` | Kenney — Sci-Fi Sounds | https://kenney.nl/assets/sci-fi-sounds |
| `hit.ogg` | `Audio/impactMetal_000.ogg` | Kenney — Sci-Fi Sounds | https://kenney.nl/assets/sci-fi-sounds |
| `death.ogg` | `Audio/explosionCrunch_000.ogg` | Kenney — Sci-Fi Sounds | https://kenney.nl/assets/sci-fi-sounds |

## Verification of CC0

Each source pack ships a `License.txt` stating CC0. Verbatim excerpts:

**Top-down Shooter Pack** (by Kenney Vleugels, Kenney.nl):
> License (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> You may use these assets in personal and commercial projects.
> Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.

**Particle Pack (1.1)** (by Kenney Vleugels, Kenney.nl):
> License (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> You may use these assets in personal and commercial projects.

**Sci-Fi Sounds (1.0)** (created/distributed by Kenney, www.kenney.nl):
> License: (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> This content is free to use in personal, educational and commercial projects.

## Notes for integration

- **Sprite orientation:** `player.png` and `enemy.png` face **+X (right)** by
  default (gun points right at rotation 0). Rotate the sprite by the aim angle.
- **Player vs enemy:** same "Man" body, color only differs — blue (player) vs
  brown (enemy).
- **Muzzle flash:** `muzzle.png` is a white 512×512 flare pointing **up (−Y)**.
  Tint/scale as needed; because the body faces +X, add a +90° offset (or use the
  aim angle − 90°) so the flash lines up with the barrel.
- Sprites are ~64 px; `ground.png` and `crate.png` are 64×64 tiles.
