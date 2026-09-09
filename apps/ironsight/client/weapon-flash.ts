import * as THREE from 'three';

/** Presentation only. Millisecond lifetimes give 2-4 frames at 60 Hz; every
 * weapon uses the same warmed material program and the same atlas source. */
export const WEAPON_FLASHES = [
  { name: 'rifle crown', lifeMs: 50, width: .34, height: .34, localScale: 1, rotation: .12 },
  { name: 'smg fork', lifeMs: 34, width: .26, height: .34, localScale: .88, rotation: .65 },
  { name: 'shotgun bloom', lifeMs: 64, width: .52, height: .44, localScale: .7, rotation: .08 },
  { name: 'sniper lance', lifeMs: 60, width: .24, height: .76, localScale: .75, rotation: .85 },
  { name: 'pistol star', lifeMs: 42, width: .25, height: .25, localScale: .85, rotation: .35 },
] as const;

export function weaponFlash(index: number) { return WEAPON_FLASHES[index] ?? WEAPON_FLASHES[0]!; }

/** Absolute shot age, not accumulated delta: identical shape/fade at any fps. */
export function flashEnvelope(ageMs: number, index: number): number {
  const t = ageMs / weaponFlash(index).lifeMs;
  return t < 0 || t >= 1 ? 0 : (1 - t) ** .65;
}

let textures: readonly THREE.Texture[] | undefined;

/** Original analytic flame silhouettes baked once at startup into five 64px
 * cells. No image download, frame-time bake, material define or extra draw.
 * Immutable UV views share one Source/sampler, hence one 128KiB GPU texture. */
export function weaponFlashTextures(): readonly THREE.Texture[] {
  if (textures) return textures;
  const width = 256, height = 128, cell = 64;
  const data = new Uint8Array(width * height * 4);
  const colors = [[255, 194, 91], [160, 227, 255], [255, 137, 48], [194, 225, 255], [255, 218, 138]] as const;
  for (let slot = 0; slot < 5; slot++) {
    for (let py = 0; py < cell; py++) for (let px = 0; px < cell; px++) {
      const x = (px + .5 - 32) / 31, y = (py + .5 - 32) / 31;
      const radius = Math.hypot(x, y), angle = Math.atan2(y, x);
      // Four-prong rifle, split SMG, broad ragged shotgun, long sniper lance,
      // compact five-point pistol. Bright cores sit exactly on the muzzle.
      const boundary = slot === 0 ? .24 + .64 * Math.abs(Math.cos(2 * angle)) ** 7
        : slot === 1 ? .22 + .62 * Math.abs(Math.sin(angle)) ** 9
        : slot === 2 ? .63 + .19 * Math.cos(7 * angle) * Math.cos(3 * angle)
        : slot === 3 ? .14 + .78 * Math.abs(Math.sin(angle)) ** 18
        : .2 + .48 * ((1 + Math.cos(5 * angle)) / 2) ** 8;
      const flame = Math.max(0, Math.min(1, (boundary - radius) * 9));
      const halo = Math.max(0, 1 - radius / .7) ** 3 * .2;
      const core = Math.max(0, 1 - radius / .22);
      const alpha = Math.min(1, flame * (.5 + .5 * (1 - radius)) + halo + core);
      const white = Math.min(1, core * 2.5);
      const rgb = colors[slot]!;
      const i = ((Math.floor(slot / 4) * cell + py) * width + (slot % 4) * cell + px) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(rgb[c]! * (1 - white) + 255 * white);
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const atlas = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  atlas.name = 'weapon-flash-atlas';
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.minFilter = atlas.magFilter = THREE.LinearFilter;
  atlas.generateMipmaps = false;
  atlas.needsUpdate = true;
  textures = WEAPON_FLASHES.map((_, i) => {
    const view = atlas.clone();
    view.repeat.set(.25, .5);
    view.offset.set((i % 4) * .25, Math.floor(i / 4) * .5);
    view.needsUpdate = true;
    return view;
  });
  return textures;
}

export function weaponFlashTexture(index: number): THREE.Texture {
  return weaponFlashTextures()[index] ?? weaponFlashTextures()[0]!;
}
