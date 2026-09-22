from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--clips", nargs="+", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def exported_mesh_names(path: Path) -> list[str]:
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    return [node.get("name", "") for node in document.get("nodes", []) if "mesh" in node]


def visible_points(exported: set[str]) -> list[Vector]:
    graph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name not in exported:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    return points


def render(path: Path, camera, floor, direction: tuple[float, float, float], exported: set[str]) -> dict[str, object]:
    bpy.context.view_layer.update()
    points = visible_points(exported)
    low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    center = (low + high) * 0.5
    view = Vector(direction).normalized()
    right = Vector((view.y, -view.x, 0)).normalized()
    width = max(point.dot(right) for point in points) - min(point.dot(right) for point in points)
    camera.data.ortho_scale = max(high.z - low.z, width) * 1.14
    camera.location = center + view * 4.2
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    floor.location.z = low.z
    bpy.context.scene.render.filepath = str(path.resolve())
    bpy.ops.render.render(write_still=True)
    return {"path": str(path.resolve()), "low": list(low), "high": list(high), "floorZ": low.z}


def main() -> None:
    args = arguments()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    exported_names = exported_mesh_names(args.input.resolve())
    exported = {name for name in exported_names if name == "LOD0"}
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name in exported]
    unexpected = sorted(name for name in exported_names if not name.startswith(("LOD0", "LOD1", "LOD2")))
    if unexpected:
        raise RuntimeError(f"unexpected renderable meshes {unexpected}")
    points = visible_points(exported)
    low_z = min(point.z for point in points)
    high_z = max(point.z for point in points)
    runtime_root = bpy.data.objects.new("runtime-model-root", None)
    bpy.context.collection.objects.link(runtime_root)
    for obj in list(bpy.context.scene.objects):
        if obj != runtime_root and obj.parent is None:
            obj.parent = runtime_root
    base_scale = 1.8 / (high_z - low_z)
    runtime_root.scale = (base_scale,) * 3
    runtime_root.location.z = -low_z * base_scale
    floor = bpy.data.objects.new("qa-floor", None)
    bpy.context.collection.objects.link(floor)
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
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    rig.animation_data_create()
    reports = []
    for clip_name in args.clips:
        action = bpy.data.actions.get(clip_name)
        if action is None:
            raise RuntimeError(f"missing clip {clip_name}")
        rig.animation_data.action = action
        start, end = action.frame_range
        frame = start + (end - start) * 0.5
        scene.frame_set(int(frame), subframe=frame % 1)
        front = render(args.output_dir / f"{clip_name}-front.png", camera, floor, (0, -1, 0.08), exported)
        side = render(args.output_dir / f"{clip_name}-side.png", camera, floor, (1, 0, 0.08), exported)
        back = render(args.output_dir / f"{clip_name}-back.png", camera, floor, (0, 1, 0.08), exported)
        reports.append({"clip": clip_name, "frame": frame, "front": front, "side": side, "back": back})
    (args.output_dir / "pose-render-report.json").write_text(json.dumps({"schemaVersion": 2,
        "input": str(args.input.resolve()), "renderableMeshes": exported_names,
        "runtimeNormalization": {"sourceMinZ": low_z, "sourceMaxZ": high_z,
                                 "baseScale": base_scale, "feetOffsetY": -low_z * base_scale},
        "clips": reports}, indent=2) + "\n", encoding="utf-8")


main()
