"""Blender 4.5: bake ground ambient occlusion for each map from its collision geometry.

node tools/dump-maps.mjs <maps.json>
blender --background --python tools/bake-ground-ao.py -- --maps <maps.json> [--size 1024] [--samples 96]

Writes public/assets/maps/<presentation>-ground-ao.png (original, versioned; no purchased
geometry is involved). site-ground.ts multiplies it into the ground atlas at load.
PNG row 0 = z 0 (north), column 0 = x 0 — the same orientation as the canvas atlas.
"""
import argparse
import json
import sys
from pathlib import Path

import bmesh
import bpy

app = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--maps", required=True)
parser.add_argument("--size", type=int, default=1024)
parser.add_argument("--samples", type=int, default=96)
parser.add_argument("--distance", type=float, default=3.5, help="AO ray distance in metres")
parser.add_argument("--architecture", help="Optional original-kit dump; include only exterior geometry as AO context")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
maps = json.loads(Path(args.maps).read_text())
architecture = json.loads(Path(args.architecture).read_text()) if args.architecture else {}


def game(x, y, z):
    """Game (x right, y up, z south) -> Blender (x, -z, y)."""
    return (x, -z, y)


def mesh_object(name, verts, faces):
    bm = bmesh.new()
    bverts = [bm.verts.new(game(*v)) for v in verts]
    for face in faces:
        bm.faces.new([bverts[i] for i in face])
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def box(name, b):
    lo, hi = b["min"], b["max"]
    xs, ys, zs = (lo["x"], hi["x"]), (lo["y"], hi["y"]), (lo["z"], hi["z"])
    verts = [(xs[i], ys[j], zs[k]) for i in range(2) for j in range(2) for k in range(2)]
    # index = i*4 + j*2 + k
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return mesh_object(name, verts, faces)


def ramp(name, r):
    axis, d, top = r["axis"], r["dir"], r["topY"]
    lo_a, hi_a = (r["minX"], r["maxX"]) if axis == "x" else (r["minZ"], r["maxZ"])
    lo_b, hi_b = (r["minZ"], r["maxZ"]) if axis == "x" else (r["minX"], r["maxX"])
    low, high = (lo_a, hi_a) if d == 1 else (hi_a, lo_a)

    def v(a, b, y):
        return (a, y, b) if axis == "x" else (b, y, a)

    verts = [v(low, lo_b, r.get("baseY", 0)), v(low, hi_b, r.get("baseY", 0)), v(high, lo_b, r.get("baseY", 0)), v(high, hi_b, r.get("baseY", 0)), v(high, lo_b, top), v(high, hi_b, top)]
    faces = [(0, 1, 3, 2), (0, 2, 4), (1, 5, 3), (2, 3, 5, 4), (0, 4, 5, 1)]
    return mesh_object(name, verts, faces)


def ground(name, width, depth, terrain=None):
    surfaces = terrain["faces"] if terrain else [dict(minX=0, maxX=width, minZ=0, maxZ=depth, y=0)]
    verts, faces = [], []
    for f in surfaces:
        x0, x1, z0, z1, y = f["minX"], f["maxX"], f["minZ"], f["maxZ"], f["y"]
        n = len(verts)
        # Lift a millimetre off the supporting earth, preventing self-occlusion.
        verts.extend([(x0, y+.001, z0), (x1, y+.001, z0), (x1, y+.001, z1), (x0, y+.001, z1)])
        faces.append((n, n+3, n+2, n+1))
    obj = mesh_object(name, verts, faces)
    uv = obj.data.uv_layers.new(name="ao")
    for loop in obj.data.loops:
        x, _, z = verts[loop.vertex_index]
        uv.data[loop.index].uv = (x / width, 1 - z / depth)
    return obj


scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = args.samples
scene.cycles.use_denoising = False
scene.render.bake.use_selected_to_active = False
scene.render.bake.margin = 0
# AgX (4.x default) would compress unoccluded white to ~0.8 on save.
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.world = scene.world or bpy.data.worlds.new("World")
scene.world.light_settings.distance = args.distance

for key, m in maps.items():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for image in list(bpy.data.images):
        bpy.data.images.remove(image)
    for i, b in enumerate(m["boxes"]):
        box(f"{key}-box-{i}", b)
    for i, r in enumerate(m["ramps"]):
        ramp(f"{key}-ramp-{i}", r)
    width, depth = m["bounds"]["width"], m["bounds"]["depth"]
    # Presentation outside the server rectangle cannot change cover, but its
    # contact shadow belongs at the yard edge. Never import interior cladding
    # here: authority boxes/ramps already supply that occlusion exactly once.
    exterior_count = 0
    for i, part in enumerate(architecture.get(key, {}).get("meshes", [])):
        p = part["positions"]
        verts = [p[j:j+3] for j in range(0, len(p), 3)]
        if not (max(v[0] for v in verts) <= .00001 or min(v[0] for v in verts) >= width - .00001
                or max(v[2] for v in verts) <= .00001 or min(v[2] for v in verts) >= depth - .00001):
            continue
        faces = [part["indices"][j:j+3] for j in range(0, len(part["indices"]), 3)]
        mesh_object(f"{key}-exterior-{i}", verts, faces)
        exterior_count += 1
    print(f"[bake-ground-ao] {key}: exterior context parts={exterior_count}")
    floor = ground(f"{key}-ground", width, depth, m.get("terrain"))

    size = (args.size, round(args.size * depth / width))
    image = bpy.data.images.new(f"{key}-ao", *size, alpha=False, float_buffer=False)
    material = bpy.data.materials.new(f"{key}-ground")
    material.use_nodes = True
    node = material.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    material.node_tree.nodes.active = node
    floor.data.materials.append(material)

    bpy.ops.object.select_all(action="DESELECT")
    floor.select_set(True)
    bpy.context.view_layer.objects.active = floor
    bpy.ops.object.bake(type="AO")

    out = app / "public/assets/maps" / f"{key}-ground-ao.png"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "BW"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 90
    image.save_render(str(out), scene=scene)
    print(f"[bake-ground-ao] {key}: {size[0]}x{size[1]} boxes={len(m['boxes'])} ramps={len(m['ramps'])} -> {out} ({out.stat().st_size} bytes)")
