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
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--size", type=int, default=512)
parser.add_argument("--quality", type=int, default=80)
parser.add_argument("--webp", action="store_true")
parser.add_argument("--height-m", type=float, help="Uniformly fit height in metres and centre the base pivot")
parser.add_argument("--omit-normal-map", action="store_true", help="Omit a rejected generated normal map; keep source vertex normals")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
if args.size < 1 or (args.height_m is not None and (not 0 < args.height_m < 1000)):
    parser.error("size must be positive and height-m must be between 0 and 1000")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
if args.omit_normal_map:
    for material in bpy.data.materials:
        if material.use_nodes:
            for node in material.node_tree.nodes:
                if node.type == "BSDF_PRINCIPLED":
                    for link in list(node.inputs["Normal"].links):
                        material.node_tree.links.remove(link)
if args.height_m is not None:
    # Blender is Z-up; export_yup below converts the centred base to glTF Y-up.
    points = [obj.matrix_world @ Vector(p) for obj in bpy.context.scene.objects
              if obj.type == "MESH" for p in obj.bound_box]
    if not points:
        raise ValueError("Cannot normalize an empty GLB")
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    if high.z - low.z <= 1e-8:
        raise ValueError("Cannot normalize a flat GLB")
    base = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    transform = Matrix.Scale(args.height_m / (high.z - low.z), 4) @ Matrix.Translation(-base)
    for obj in bpy.context.scene.objects:
        if obj.parent is None:
            obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()
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
tris = 0
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.data.calc_loop_triangles()
        tris += len(obj.data.loop_triangles)
print(f"[shrink-glb] {Path(args.input).name} {Path(args.input).stat().st_size} -> {out} {out.stat().st_size} bytes, {tris} triangles, {len(bpy.data.images)} images @{args.size}px")
