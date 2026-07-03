# "Made with Tikron" badge

Show that your game runs on Tikron's server-authoritative multiplayer. Drop this
badge in your game's footer, start screen, or credits and link it back to
`https://tikron.dev`. Using it is optional and free — no attribution is required
by the license, but it's appreciated and it helps other builders find Tikron.

## Files (served from `https://tikron.dev/badge/…`)

| File | Use |
|---|---|
| `made-with-tikron-dark.svg` | **Preferred.** Vector, sharp at any size, transparent. For dark UIs. |
| `made-with-tikron-light.svg` | Vector, for light UIs. |
| `made-with-tikron-dark.png` / `…-2x.png` | Raster fallback (208×56 / 416×112), transparent. Dark UI. |
| `made-with-tikron-light.png` / `…-2x.png` | Raster fallback, light UI. |
| `…-dark.webp` / `…-dark-2x.webp` · `…-light.webp` / `…-light-2x.webp` | Smaller raster, transparent. Modern browsers. |

All raster assets have a transparent background, so they sit on any color.

## Embed (hotlink — always up to date)

Simplest — SVG, scales perfectly, one request:

```html
<a href="https://tikron.dev" target="_blank" rel="noopener"
   aria-label="Made with Tikron — multiplayer on the edge">
  <img src="https://tikron.dev/badge/made-with-tikron-dark.svg"
       alt="Made with Tikron" width="156" height="42" />
</a>
```

WebP with PNG fallback + retina, for pixel-perfect raster:

```html
<a href="https://tikron.dev" target="_blank" rel="noopener">
  <picture>
    <source type="image/webp"
      srcset="https://tikron.dev/badge/made-with-tikron-dark.webp 1x,
              https://tikron.dev/badge/made-with-tikron-dark-2x.webp 2x" />
    <img src="https://tikron.dev/badge/made-with-tikron-dark.png"
         srcset="https://tikron.dev/badge/made-with-tikron-dark-2x.png 2x"
         alt="Made with Tikron" width="156" height="42" />
  </picture>
</a>
```

Use the `-light` variants on light backgrounds.

## Self-host (copy the files into your project)

If you'd rather not hotlink, copy any of the files above into your own
`public/` and point the `src` at your copy. They're tiny (SVG ≈ 1 KB).

## Placement

- **Footer / corner of the start screen** is ideal — small, out of the way,
  linked to `https://tikron.dev`.
- Keep it at least ~120px wide so the wordmark stays legible.
- Don't recolor the wordmark or stretch the aspect ratio; use the light/dark
  variant that fits your background instead.

## Brand colors (if you build your own layout)

- Background dark `#0a0e14`, border `#232b36`
- Neon accent `#00e5a0` (dark bg) / `#00b57e` (light bg)
- Text `#e6edf3` (dark) / `#0a0e14` (light), muted label `#8b98a8`
