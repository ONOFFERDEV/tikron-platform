# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# How to run: blender --background --threads 2 --python tools/render-ww1-environment.py -- --asset-root public/assets/ww1 --output <dir> --report <json>

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Final

import bpy
import mathutils


ANGLES: Final = (25, 115, 205, 295)


def option(name: str) -> Path:
    arguments = sys.argv[sys.argv.index("--") + 1 :]
    index = arguments.index(name)
    return Path(arguments[index + 1]).resolve()


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in tuple(blocks):
            blocks.remove(block)


def add_lighting() -> None:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.18, 0.21, 0.25, 1)
    background.inputs["Strength"].default_value = 1.2
    for name, location, energy, size in (
        ("key", (4.5, -5.5, 7.0), 3000.0, 4.0),
        ("fill", (-4.0, 2.0, 4.0), 1600.0, 3.0),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(name, data)
        light.location = location
        bpy.context.scene.collection.objects.link(light)


def mesh_bounds() -> tuple[mathutils.Vector, mathutils.Vector]:
    points = [
        item.matrix_world @ mathutils.Vector(corner)
        for item in bpy.context.scene.objects
        if item.type == "MESH" and not item.hide_render
        for corner in item.bound_box
    ]
    if not points:
        raise RuntimeError("Imported environment asset contains no visible mesh")
    minimum = mathutils.Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = mathutils.Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def apply_review_material() -> None:
    material = bpy.data.materials.new("morphology-clay")
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (0.34, 0.22, 0.11, 1)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.72
    shader.inputs["Emission Color"].default_value = (0.12, 0.055, 0.018, 1)
    shader.inputs["Emission Strength"].default_value = 0.35
    for item in bpy.context.scene.objects:
        if item.type == "MESH":
            item.data.materials.clear()
            item.data.materials.append(material)


def select_hero_lod() -> None:
    for item in bpy.context.scene.objects:
        if item.name in {"LOD1", "LOD2"}:
            item.hide_render = True


def render_asset(model: Path, output_root: Path) -> list[Path]:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(model))
    select_hero_lod()
    apply_review_material()
    minimum, maximum = mesh_bounds()
    centre = (minimum + maximum) * 0.5
    radius = max(maximum - minimum) * 1.8
    camera_data = bpy.data.cameras.new("review-camera")
    camera_data.lens = 55
    camera = bpy.data.objects.new("review-camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    add_lighting()
    directory = output_root / model.stem
    directory.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for index, angle in enumerate(ANGLES):
        radians = math.radians(angle)
        camera.location = centre + mathutils.Vector((radius * math.sin(radians), radius * math.cos(radians), radius * 0.55))
        camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
        output = directory / f"{model.stem}-{index + 1}.png"
        bpy.context.scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(output)
    return outputs


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    asset_root = option("--asset-root")
    output_root = option("--output")
    report_path = option("--report")
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 2
    scene.render.resolution_x = 320
    scene.render.resolution_y = 320
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 1.3
    models = sorted((asset_root / "environment").glob("*.glb")) + sorted((asset_root / "support").glob("biplane.glb"))
    records = []
    for model in models:
        outputs = render_asset(model, output_root)
        records.append({
            "key": model.stem,
            "model": str(model),
            "modelSha256": sha256(model),
            "views": [{"path": str(output), "sha256": sha256(output)} for output in outputs],
        })
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps({
        "schemaVersion": 1,
        "renderer": "Blender 4.5 EEVEE CPU orchestration",
        "threads": 2,
        "anglesDegrees": ANGLES,
        "assets": records,
    }, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
