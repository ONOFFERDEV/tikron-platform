import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ww1_blender_render import render_turntable

VERSION = "ww1-local-tools/1"
SOCKETS = ("grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front")
WEAPONS = {
    "automatic_rifle": (("magazine", "bolt"), ("magwell", "chamber"), 1.12),
    "trench_smg": (("magazine", "bolt"), ("magwell", "chamber"), 0.76),
    "pump_shotgun": (("pump", "shell"), ("chamber",), 1.08),
    "bolt_service_rifle": (("bolt", "clip"), ("chamber", "clip_mount"), 1.24),
    "service_pistol": (("slide", "magazine"), ("magwell", "chamber"), 0.31),
}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--asset-key", choices=tuple(WEAPONS))
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--source-sha256")
    parser.add_argument("--author-components", action="store_true")
    parser.add_argument("--review-only", action="store_true")
    parser.add_argument("--turntables", type=Path)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reset() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in tuple(datablocks):
            datablocks.remove(block)


def material(name: str, colour: tuple[float, float, float, float], metallic: float, roughness: float):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    result = bpy.data.materials.new(name)
    result.diffuse_color = colour
    result.metallic = metallic
    result.roughness = roughness
    return result


WOOD = lambda: material("oiled-walnut", (0.16, 0.055, 0.018, 1), 0.0, 0.52)
STEEL = lambda: material("blued-steel", (0.055, 0.065, 0.07, 1), 0.78, 0.3)
BRASS = lambda: material("aged-brass", (0.32, 0.17, 0.035, 1), 0.65, 0.35)


def finish(obj, name: str, location, scale, authored_material):
    obj.name = name
    obj.location = (location[0], -location[2], location[1])
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(authored_material)
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name="UVMap")
    return obj


def box(name: str, location, scale, authored_material):
    bpy.ops.mesh.primitive_cube_add(location=location)
    return finish(bpy.context.object, name, location, scale, authored_material)


def tetra(name: str, location, scale, authored_material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-1, -1, -1), (1, -1, -1), (0, 1, -1), (0, 0, 1)], [], [(0, 1, 2), (0, 3, 1), (1, 3, 2), (2, 3, 0)])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, location, scale, authored_material)


def cylinder(name: str, location, radius: float, depth: float, authored_material, vertices: int = 16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, rotation=(math.pi / 2, 0, 0))
    return finish(bpy.context.object, name, location, (1, 1, 1), authored_material)


def empty(name: str, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "ARROWS"
    obj.empty_display_size = 0.035
    obj.location = (location[0], -location[2], location[1])
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def parent_all(root) -> None:
    for obj in tuple(bpy.context.scene.objects):
        if obj is not root and obj.parent is None and obj.type in {"MESH", "EMPTY"}:
            obj.parent = root


def normalize_source(objects, target_length: float) -> dict:
    meshes = [obj for obj in objects if obj.type == "MESH"]
    corners = [obj.matrix_world @ mathutils.Vector(corner) for obj in meshes for corner in obj.bound_box]
    if not corners:
        raise ValueError("candidate has no mesh geometry")
    minimum = mathutils.Vector(tuple(min(point[axis] for point in corners) for axis in range(3)))
    maximum = mathutils.Vector(tuple(max(point[axis] for point in corners) for axis in range(3)))
    extents = maximum - minimum
    source_axis = max(range(3), key=lambda axis: extents[axis])
    scale = target_length / extents[source_axis]
    root = empty("source_candidate", (0, 0, 0))
    for obj in objects:
        obj.name = f"source__{obj.name}"
        if obj.parent is None:
            world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world
    root.scale = (scale, scale, scale)
    if source_axis == 0:
        root.rotation_euler[2] = -math.pi / 2
    elif source_axis == 1:
        root.rotation_euler[2] = math.pi
    else:
        root.rotation_euler[0] = math.pi / 2
    return {"sourceLongestAxis": "XYZ"[source_axis], "uniformScale": scale, "singleRootTransform": True}


def weapon_components(asset_key: str) -> None:
    parts, mechanism_sockets, length = WEAPONS[asset_key]
    root = empty(asset_key, (0, 0, 0))
    stock_length = max(0.13, length * (0.28 if asset_key != "service_pistol" else 0.34))
    lod0 = box("LOD0", (0, -0.015, length * 0.32), (0.055, 0.07, length * 0.28), WOOD())
    bevel = lod0.modifiers.new("authored-edge-roll", "BEVEL")
    bevel.width = 0.008
    bevel.segments = 2
    bpy.context.view_layer.objects.active = lod0
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    box("LOD1", (0, -0.002, length * 0.32), (0.049, 0.061, length * 0.27), WOOD())
    tetra("LOD2", (0, 0.01, length * 0.32), (0.043, 0.052, length * 0.25), WOOD())
    box("receiver", (0, 0.02, length * 0.60), (0.048, 0.055, stock_length), STEEL())
    cylinder("barrel", (0, 0.02, length * 0.84), 0.018, length * 0.35, STEEL(), 20)
    for index, part in enumerate(parts):
        if part in {"bolt", "slide"}:
            box(part, (0.045, 0.06, length * 0.62), (0.018, 0.018, 0.10), STEEL())
        elif part in {"magazine", "clip"}:
            box(part, (0, -0.09, length * 0.58), (0.035, 0.075, 0.055), STEEL())
        elif part == "pump":
            cylinder(part, (0, -0.005, length * 0.76), 0.042, 0.22, WOOD(), 20)
        else:
            cylinder(part, (0.065 + index * 0.018, -0.04, length * 0.54), 0.011, 0.055, BRASS(), 16)
    socket_positions = {
        "grip_r": (0, 0, 0), "grip_l": (0, -0.045, length * 0.72),
        "muzzle": (0, 0.02, length + 0.02), "eject": (0.055, 0.04, length * 0.62),
        "sight_rear": (0, 0.095, length * 0.55), "sight_front": (0, 0.075, length * 0.96),
        "magwell": (0, -0.065, length * 0.58), "chamber": (0, 0.02, length * 0.70),
        "clip_mount": (0, 0.09, length * 0.61),
    }
    for name in (*SOCKETS, *mechanism_sockets):
        empty(name, socket_positions[name], root)
    parent_all(root)


def grenade() -> None:
    root = empty("grenade", (0, 0, 0))
    cylinder("grenade_body", (0, 0, 0.13), 0.058, 0.22, STEEL(), 16)
    for offset in (-0.045, -0.015, 0.015, 0.045):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.058, minor_radius=0.004, major_segments=16, minor_segments=6, location=(0, 0, 0.13 + offset))
        finish(bpy.context.object, f"body_rib_{offset:+.3f}", bpy.context.object.location, (1, 1, 1), STEEL())
    box("safety_lever", (0.045, 0, 0.27), (0.018, 0.012, 0.075), STEEL())
    bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.004, major_segments=20, minor_segments=6, location=(0.09, 0, 0.28), rotation=(math.pi / 2, 0, 0))
    finish(bpy.context.object, "pin_ring", bpy.context.object.location, (1, 1, 1), STEEL())
    parent_all(root)


def ammunition_support() -> None:
    root = empty("clip-shell-casing", (0, 0, 0))
    box("clip", (0, 0, 0.035), (0.055, 0.012, 0.012), STEEL())
    for index in range(5):
        x = (index - 2) * 0.022
        cylinder(f"casing_{index + 1}", (x, 0, 0.09), 0.007, 0.085, BRASS(), 12)
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.007, radius2=0.001, depth=0.026, location=(x, 0, 0.145))
        finish(bpy.context.object, f"bullet_{index + 1}", bpy.context.object.location, (1, 1, 1), BRASS())
    cylinder("shell", (0.085, 0, 0.045), 0.012, 0.09, BRASS(), 16)
    cylinder("casing", (0.125, 0, 0.038), 0.008, 0.076, BRASS(), 16)
    parent_all(root)


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_yup=True, export_animations=True)


def author_components(options: argparse.Namespace) -> dict:
    if not options.output:
        raise ValueError("author-components mode requires --output")
    outputs = []
    for key in WEAPONS:
        reset(); weapon_components(key)
        path = options.output / f"{key}.intermediate.glb"; export_glb(path)
        turntables = render_turntable(options.turntables, key) if options.turntables else []
        outputs.append({"key": key, "path": str(path), "sha256": sha256(path), "kind": "intermediate-mechanical-assembly", "turntables": turntables})
    for key, author in (("grenade", grenade), ("clip-shell-casing", ammunition_support)):
        reset(); author()
        path = options.output / f"{key}.glb"; export_glb(path)
        turntables = render_turntable(options.turntables, key) if options.turntables else []
        outputs.append({"key": key, "path": str(path), "sha256": sha256(path), "kind": "original-authored-support-source", "turntables": turntables})
    return {"mode": "author-components", "runtimeAccepted": False, "outputs": outputs}


def fit_candidate(options: argparse.Namespace) -> dict:
    if not options.input or not options.asset_key or not options.manifest or not options.output:
        raise ValueError("fit mode requires --input, --asset-key, --manifest and --output")
    source_hash = sha256(options.input)
    if options.source_sha256 and source_hash != options.source_sha256:
        raise ValueError(f"source hash mismatch: expected {options.source_sha256}, got {source_hash}")
    if options.asset_key not in options.manifest.read_text(encoding="utf8"):
        raise ValueError(f"asset key {options.asset_key} absent from manifest")
    reset(); bpy.ops.import_scene.gltf(filepath=str(options.input))
    imported = tuple(bpy.context.scene.objects)
    source_actions = tuple(action.name for action in bpy.data.actions)
    normalization = normalize_source(imported, WEAPONS[options.asset_key][2])
    weapon_components(options.asset_key); export_glb(options.output)
    return {"mode": "fit-candidate", "runtimeAccepted": False, "assetKey": options.asset_key, "sourceSha256": source_hash, "output": str(options.output), "outputSha256": sha256(options.output), "animationsPreserved": tuple(action.name for action in bpy.data.actions) == source_actions, "sourceActions": source_actions, "normalization": normalization}


def review_input(options: argparse.Namespace) -> dict:
    if not options.input or not options.asset_key or not options.turntables:
        raise ValueError("review-only mode requires --input, --asset-key and --turntables")
    source_hash = sha256(options.input)
    if options.source_sha256 and source_hash != options.source_sha256:
        raise ValueError(f"source hash mismatch: expected {options.source_sha256}, got {source_hash}")
    reset(); bpy.ops.import_scene.gltf(filepath=str(options.input))
    images = render_turntable(options.turntables, f"{options.asset_key}-preview")
    return {"mode": "review-only", "runtimeAccepted": False, "assetKey": options.asset_key, "sourceSha256": source_hash, "turntables": images}


def main() -> None:
    options = arguments()
    result = review_input(options) if options.review_only else author_components(options) if options.author_components else fit_candidate(options)
    result.update({"schemaVersion": 1, "exporterVersion": VERSION, "coordinateSystem": {"units": "metres", "up": "+Y", "forward": "+Z"}})
    options.report.parent.mkdir(parents=True, exist_ok=True)
    options.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    import mathutils
    main()
