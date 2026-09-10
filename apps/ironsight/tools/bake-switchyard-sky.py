"""Original overcast radiance field. Blender 4.5, no external imagery.

Blender --background --python tools/bake-switchyard-sky.py
The same JSON controls the runtime key, fill, fog and reflection intensity.
World-direction noise makes the equirectangular seam continuous.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector, noise

root = Path(__file__).resolve().parents[1]
profile = json.loads((root / 'client/switchyard-overcast.json').read_text())
sun = Vector(profile['sunDirection']).normalized()


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x-a) / (b-a)))
    return t*t*(3-2*t)


def srgb(linear):
    return 12.92*linear if linear <= .0031308 else 1.055*linear**(1/2.4)-.055


def cloud_field(direction):
    x, y, z = direction
    p = Vector((x/(y+.32)*1.65, z/(y+.32)*1.65, profile['cloudSeed']*.37))
    # Stretched lower stratus with larger billows overhead; baked, never animated.
    p.x *= .78
    return sum(noise.noise(p*scale, noise_basis='PERLIN_ORIGINAL')*weight
               for scale, weight in [(1, .57), (2.09, .27), (4.31, .11), (8.77, .05)])


def radiance(direction):
    y = direction.y
    t = abs(y)**.55
    end = profile['zenith'] if y >= 0 else profile['ground']
    color = [a*(1-t)+b*t for a, b in zip(profile['horizon'], end)]
    if y < 0:
        return color
    alignment = max(0, direction.dot(sun))
    # Diffuse bright opening, not a sun disc or screen-space bloom.
    opening = alignment**9
    cover = smooth(-.24, .24, cloud_field(direction))
    strength = smooth(.015, .16, y)
    body = [.115, .150, .195]
    silver = 4*cover*(1-cover)*opening
    for channel, gain in enumerate((1.0, .98, .93)):
        color[channel] += opening*.52*gain
        cloud = body[channel]+silver*.30*gain+opening*.11
        color[channel] = color[channel]*(1-cover*.76*strength)+cloud*cover*.76*strength
    return color


scene = bpy.context.scene
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
for w, h, format, path in [
    (profile['width'], profile['height'], 'HDR', profile['environment']),
    (profile['skyWidth'], profile['skyHeight'], 'PNG', profile['sky']),
]:
    image = bpy.data.images.new(f"{profile['name']}-{format}", w, h, alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    pixels = []
    for row in range(h):
        latitude = ((row+.5)/h-.5)*math.pi
        for col in range(w):
            longitude = ((col+.5)/w-.5)*math.tau
            direction = Vector((math.cos(latitude)*math.cos(longitude), math.sin(latitude),
                                math.cos(latitude)*math.sin(longitude)))
            linear = radiance(direction)
            pixels.extend(([srgb(c) for c in linear] if format == 'PNG' else linear)+[1])
    image.pixels.foreach_set(pixels)
    scene.render.image_settings.file_format = format
    scene.render.image_settings.color_mode = 'RGB'
    if format == 'PNG':
        scene.render.image_settings.color_depth = '8'
    out = root / 'public' / path.lstrip('/')
    image.save_render(str(out), scene=scene)
    print(f'[overcast] {w}x{h}, {out.stat().st_size} bytes, key {tuple(sun)}')
    if format == 'PNG':
        saved = bpy.data.images.load(str(out), check_existing=False)
        saved.colorspace_settings.name = 'Non-Color'
        actual = list(saved.pixels)
        error = max(abs(actual[i]-pixels[i]) for i in range(len(pixels)) if i % 4 != 3)
        assert error < 2/255, f'Saved sky encoding/orientation drift: {error}'
        print(f'[overcast] saved PNG maximum encoded error {error:.6f} (< 2/255)')
