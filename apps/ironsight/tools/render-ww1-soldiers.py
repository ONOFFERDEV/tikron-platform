from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--khaki", type=Path, required=True)
    parser.add_argument("--fieldgrey", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_soldier(path: Path, offset: float):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    imported = set(bpy.context.scene.objects) - before
    for obj in imported:
        if obj.name.startswith("LOD1") or obj.name.startswith("LOD2"):
            obj.hide_render = True
        if obj.parent is None:
            obj.location.x += offset
    return next(obj for obj in imported if obj.type == "ARMATURE")


def evaluated_points() -> list[Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render or not obj.name.startswith("LOD0"):
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    return points


def render(output: Path, camera, floor, direction: tuple[float, float, float]) -> None:
    bpy.context.view_layer.update()
    points = evaluated_points()
    low = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    high = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    center = (low + high) * 0.5
    view = Vector(direction).normalized()
    right = Vector((view.y, -view.x, 0)).normalized()
    width = max(point.dot(right) for point in points) - min(point.dot(right) for point in points)
    camera.data.ortho_scale = max(high.z - low.z, width) * 1.14
    print(f"frame={output.name} low={tuple(low)} high={tuple(high)} width={width:.4f} ortho={camera.data.ortho_scale:.4f}")
    camera.location = center + view * 4.2
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    floor.location.z = low.z
    bpy.context.scene.render.filepath = str(output.resolve())
    bpy.ops.render.render(write_still=True)


def crouch(rigs: list[object]) -> None:
    for rig in rigs:
        rig.pose.bones["Pelvis"].location.y -= 0.32
        rig.pose.bones["Thigh_L"].rotation_mode = "XYZ"
        rig.pose.bones["Thigh_R"].rotation_mode = "XYZ"
        rig.pose.bones["calf_l"].rotation_mode = "XYZ"
        rig.pose.bones["calf_r"].rotation_mode = "XYZ"
        rig.pose.bones["spine_01"].rotation_mode = "XYZ"
        rig.pose.bones["Thigh_L"].rotation_euler.x = -1.1
        rig.pose.bones["Thigh_R"].rotation_euler.x = -1.1
        rig.pose.bones["calf_l"].rotation_euler.x = 1.7
        rig.pose.bones["calf_r"].rotation_euler.x = 1.7
        rig.pose.bones["spine_01"].rotation_euler.x = 0.16


def main() -> None:
    args = arguments()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    clear()
    rigs = [import_soldier(args.khaki, -0.42), import_soldier(args.fieldgrey, 0.42)]
    bpy.ops.mesh.primitive_plane_add(size=10)
    floor = bpy.context.object
    floor.name = "qa-floor"
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.studio_light = "rim.sl"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.035, 0.04, 0.035)
    bpy.context.view_layer.update()
    standing_hips = [(rig.matrix_world @ rig.pose.bones["Pelvis"].head).z for rig in rigs]
    render(args.output_dir / "standing-contact.png", camera, floor, (0, -1, 0))
    rigs[0].location.x = 0
    rigs[1].location.x = 0
    rigs[0].location.y = -0.42
    rigs[1].location.y = 0.42
    render(args.output_dir / "side-contact.png", camera, floor, (1, 0, 0))
    rigs[0].location.x = -0.42
    rigs[1].location.x = 0.42
    rigs[0].location.y = 0
    rigs[1].location.y = 0
    render(args.output_dir / "back-contact.png", camera, floor, (0, 1, 0))
    crouch(rigs)
    render(args.output_dir / "crouch-fullbody.png", camera, floor, (0.6, -1, 0.22))
    bpy.context.view_layer.update()
    crouched_hips = [(rig.matrix_world @ rig.pose.bones["Pelvis"].head).z - floor.location.z for rig in rigs]
    pose_metrics = {"schemaVersion": 1, "pose": "offline-synthetic-crouch", "units": "metres",
                    "standingHipHeight": standing_hips, "crouchedHipHeightAboveFloor": crouched_hips,
                    "hipHeightReduction": [standing_hips[i] - crouched_hips[i] for i in range(len(rigs))]}
    (args.output_dir / "pose-metrics.json").write_text(json.dumps(pose_metrics, indent=2) + "\n", encoding="utf-8")


main()
