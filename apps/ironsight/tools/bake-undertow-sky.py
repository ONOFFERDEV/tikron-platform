"""Original dusk radiance/cloud field, baked once in Blender; no external imagery.

Blender --background --python tools/bake-undertow-sky.py
The JSON is also read by the client. Equirectangular orientation matches Three's
equirectUv; noise uses world directions so the longitude seam is continuous.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector, noise

root = Path(__file__).resolve().parents[1]
profile = json.loads((root / 'client/undertow-dusk.json').read_text())
w, h = profile['width'], profile['height']
sun = Vector(profile['sunDirection']).normalized()


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def srgb(linear):
    return 12.92 * linear if linear <= .0031308 else 1.055 * linear ** (1 / 2.4) - .055


def clouds(direction):
    # Two broad cloud scales plus small edge breakup, all computed offline.
    x, y, z = direction
    p = Vector((x / (y + .23) * 2.0, z / (y + .23) * 2.0, profile['cloudSeed'] * .37))
    return sum(noise.noise(p * scale, noise_basis='PERLIN_ORIGINAL') * weight
               for scale, weight in [(1, .64), (2.13, .25), (4.71, .11)])


def radiance(direction):
    y = direction.y
    t = abs(y) ** .55
    end = profile['zenith'] if y >= 0 else profile['ground']
    color = [a * (1-t) + b * t for a, b in zip(profile['horizon'], end)]
    if y < 0:
        return color
    align = max(0, direction.dot(sun))
    glow = align ** 12 * .70
    for c, gain in enumerate((1.0, .47, .17)):
        color[c] += glow * gain
    cover = smooth(-.08, .25, clouds(direction)) * smooth(.015, .13, y)
    # Dark blue cloud bodies with broad copper-lit edges near the low key.
    edge = 4 * cover * (1-cover) * align ** 6
    cloud = (.085 + .30 * edge, .115 + .15 * edge, .185 + .065 * edge)
    color = [a * (1-cover * .75) + b * cover * .75 for a, b in zip(color, cloud)]
    return color


scene = bpy.context.scene
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
for w, h, format, path in [
    (w, h, 'HDR', profile['environment']),
    (profile['skyWidth'], profile['skyHeight'], 'PNG', profile['sky']),
]:
    image = bpy.data.images.new(f"{profile['name']}-{format}", w, h, alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    pixels = []
    for row in range(h):
        latitude = ((row + .5) / h - .5) * math.pi
        for col in range(w):
            longitude = ((col + .5) / w - .5) * math.tau
            direction = Vector((math.cos(latitude) * math.cos(longitude), math.sin(latitude),
                                math.cos(latitude) * math.sin(longitude)))
            linear = radiance(direction)
            # Non-Color bypasses Blender's display conversion. Encode the PNG
            # explicitly once; the client's sRGB sampler decodes it once. HDR
            # remains linear, so sky and PMREM share the same radiance field.
            pixels.extend(([srgb(c) for c in linear] if format == 'PNG' else linear) + [1])
    image.pixels.foreach_set(pixels)
    scene.render.image_settings.file_format = format
    scene.render.image_settings.color_mode = 'RGB'
    if format == 'PNG':
        scene.render.image_settings.color_depth = '8'
    out = root / 'public' / path.lstrip('/')
    image.save_render(str(out), scene=scene)
    print(f'[dusk] {w}x{h}, {out.stat().st_size} bytes, sun {tuple(sun)}')
    if format == 'PNG':
        # Check the actual saved pixels, not only the in-memory source. Catches
        # accidental AgX/view-transform/gamma changes and row inversion.
        saved = bpy.data.images.load(str(out), check_existing=False)
        saved.colorspace_settings.name = 'Non-Color'
        actual = list(saved.pixels)
        error = max(abs(actual[i] - pixels[i]) for i in range(len(pixels)) if i % 4 != 3)
        assert error < 2 / 255, f'Saved sky encoding/orientation drift: {error}'
        print(f'[dusk] saved PNG maximum encoded error {error:.6f} (< 2/255)')
