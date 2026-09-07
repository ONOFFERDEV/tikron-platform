"""Original low-resolution linear radiance sky, no external imagery or lighting.
Blender background --python tools/bake-environment.py -- (no physical lights).
"""
import math
from pathlib import Path
import bpy

w, h = 512, 256
image = bpy.data.images.new('industrial-daylight', w, h, alpha=False, float_buffer=True)
image.colorspace_settings.name = 'Non-Color'
pixels = []
sun = (-0.46, 0.84, -0.29)
for row in range(h):
    latitude = (row / (h - 1) - 0.5) * math.pi
    y = math.sin(latitude)
    for col in range(w):
        longitude = col / w * math.tau
        direction = (math.cos(latitude) * math.cos(longitude), y, math.cos(latitude) * math.sin(longitude))
        horizon, zenith, ground = (0.72, 0.82, 0.80), (0.22, 0.42, 0.62), (0.14, 0.16, 0.14)
        t = abs(y) ** 0.55
        end = zenith if y >= 0 else ground
        # Broad warm cloud halo; direct sun/shadows remain the existing key light.
        halo = max(0, sum(a*b for a,b in zip(direction, sun))) ** 32 * 1.2
        pixels.extend([horizon[c]*(1-t) + end[c]*t + halo*(1.0,0.78,0.48)[c] for c in range(3)] + [1])
image.pixels.foreach_set(pixels)
scene = bpy.context.scene
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'HDR'
out = Path(__file__).resolve().parents[1] / 'public/assets/industrial-daylight.hdr'
image.save_render(str(out), scene=scene)
print(f'[environment] {w}x{h}, {out.stat().st_size} bytes')
