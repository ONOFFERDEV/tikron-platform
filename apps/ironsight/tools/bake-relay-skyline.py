"""Blender 4.5: bake licensed scenery outside playable bounds, one shared atlas.

blender --background --python tools/bake-relay-skyline.py -- --source <GLB dir>
Output is always app-local public/assets/maps/relay-skyline.glb (ignored).
Raw source inputs are read in-place; no purchased sources are copied into the app.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

app = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--source", required=True)
parser.add_argument("--maps", required=True, help="dump-maps JSON; Relay bounds determine exterior placement")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
source = Path(args.source).resolve()
bounds = json.loads(Path(args.maps).read_text())["relay"]["bounds"]
map_width, map_depth = bounds["width"], bounds["depth"]
output = app / "public/assets/maps/relay-skyline.glb"
manifest = []
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# (source, x/z centre, exact bounding envelope width/height/depth).
# Every envelope is strictly outside the shared 60 x 40 m game rectangle.
placements = [
    ("buildings/SM_Bld_Power_03.glb", -12, 4, 15, 26, 18),
    ("buildings/SM_Bld_Power_03.glb", -13, 33, 14, 16, 14),
    ("buildings/SM_Bld_Power_01.glb", 72, 7, 17, 24, 22),
    ("buildings/SM_Bld_Power_02.glb", 76, 36, 21, 18, 18),
    ("buildings/SM_Bld_Warehouse_01.glb", 9, -16, 18, 15, 20),
    ("buildings/SM_Bld_Power_02.glb", 49, -19, 17, 26, 21),
    ("buildings/SM_Bld_Power_01.glb", 15, 58, 23, 17, 22),
    ("buildings/SM_Bld_Power_03.glb", 52, 59, 20, 29, 22),
]
all_meshes = []
for relative, x, z, width, height, depth in placements:
    x = x if x < 0 else map_width + x - 60 if x > 60 else x * map_width / 60
    z = z if z < 0 else map_depth + z - 40 if z > 40 else z * map_depth / 40
    assert x + width / 2 < 0 or x - width / 2 > map_width or z + depth / 2 < 0 or z - depth / 2 > map_depth
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source / relative))
    imported = set(bpy.data.objects) - before
    meshes = [obj for obj in imported if obj.type == "MESH"]
    # Bake full imported world matrices; never overwrite the pack's native scales.
    vertices = [obj.matrix_world @ v.co for obj in meshes for v in obj.data.vertices]
    lo = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    # Blender is Z-up. glTF x/y/z = Blender x/z/-y.
    center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    scale = Vector((width / (hi.x - lo.x), depth / (hi.y - lo.y), height / (hi.z - lo.z)))
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.data = obj.data.copy()
        for vertex in obj.data.vertices:
            point = world @ vertex.co - center
            vertex.co = Vector((point.x * scale.x + x, point.y * scale.y - z, point.z * scale.z))
        obj.parent = None
        obj.matrix_world.identity()
        all_meshes.append(obj)
    for obj in imported:
        if obj.type != "MESH": bpy.data.objects.remove(obj, do_unlink=True)
    manifest.append({"source": relative, "sha256": hashlib.sha256((source / relative).read_bytes()).hexdigest(),
                     "centerXZ": [x, z], "envelope": [width, height, depth]})

# All supplied static models use the same Synty palette atlas; verify image
# pixels before deduping, rather than assuming material names prove equality.
images = {}
for material in bpy.data.materials:
    if not material.use_nodes: continue
    for node in material.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            img = node.image
            fingerprint = hashlib.sha256(bytes(round(c * 255) for c in img.pixels[:])).hexdigest()
            if fingerprint in images: node.image = images[fingerprint]
            else: images[fingerprint] = img

shared = {}
for image in images.values():
    if max(image.size) > 1024:
        scale = 1024 / max(image.size)
        image.scale(round(image.size[0] * scale), round(image.size[1] * scale))
for obj in all_meshes:
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes: continue
        images_in_mat = tuple(node.image.name for node in mat.node_tree.nodes if node.type == "TEX_IMAGE" and node.image)
        key = (images_in_mat, tuple(mat.diffuse_color))
        if key in shared: slot.material = shared[key]
        else: shared[key] = mat

bpy.ops.object.select_all(action="DESELECT")
for obj in all_meshes: obj.select_set(True)
bpy.context.view_layer.objects.active = all_meshes[0]
bpy.ops.object.join()
bpy.context.object.name = "relay_skyline_baked"
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True,
                          export_animations=False, export_cameras=False, export_lights=False)
assert output.stat().st_size < 25 * 1024 * 1024
(app / ".inspect").mkdir(exist_ok=True)
(app / ".inspect/relay-skyline-provenance.json").write_text(json.dumps({"placements": manifest,
    "bytes": output.stat().st_size, "sharedMaterials": len(shared), "images": len(images)}, indent=2))
print(f"BAKED {output} ({output.stat().st_size} bytes)")
