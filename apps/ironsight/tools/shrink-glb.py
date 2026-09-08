"""Blender 4.5: shrink a generated GLB's embedded textures for the web budget.

blender --background --python tools/shrink-glb.py -- --input <in.glb> --output <out.glb> [--size 512] [--quality 80]

Resizes every image to at most --size px on the long edge, re-exports with JPEG textures
(WebP when --webp is given), keeps geometry, normals, UVs and PBR material slots. Meshy's
2k JPEG set (~6 MB GLB) typically becomes ~300-600 KB at 512 px.
"""
import argparse
import sys
from pathlib import Path

import bpy

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--size", type=int, default=512)
parser.add_argument("--quality", type=int, default=80)
parser.add_argument("--webp", action="store_true")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
for image in bpy.data.images:
    if image.size[0] == 0:
        continue
    scale = args.size / max(image.size)
    if scale < 1:
        image.scale(max(1, round(image.size[0] * scale)), max(1, round(image.size[1] * scale)))
out = Path(args.output).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_image_format="WEBP" if args.webp else "JPEG",
                          export_jpeg_quality=args.quality, export_image_quality=args.quality, export_yup=True,
                          export_animations=False, export_cameras=False, export_lights=False)
tris = sum(len(m.data.polygons) for m in bpy.data.objects if m.type == "MESH")
print(f"[shrink-glb] {Path(args.input).name} {Path(args.input).stat().st_size} -> {out} {out.stat().st_size} bytes, {tris} polys, {len(bpy.data.images)} images @{args.size}px")
