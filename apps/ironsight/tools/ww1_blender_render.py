import math
from pathlib import Path

import bpy
import mathutils


def render_turntable(directory: Path, slug: str) -> list[str]:
    directory = directory.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 2
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.32, 0.36, 0.44, 1)
    background.inputs["Strength"].default_value = 1.2
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    camera_data = bpy.data.cameras.new("turntable_camera")
    camera = bpy.data.objects.new("turntable_camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    corners = [obj.matrix_world @ mathutils.Vector(corner) for obj in scene.objects if obj.type == "MESH" for corner in obj.bound_box]
    minimum = mathutils.Vector(tuple(min(point[axis] for point in corners) for axis in range(3)))
    maximum = mathutils.Vector(tuple(max(point[axis] for point in corners) for axis in range(3)))
    centre = (minimum + maximum) * 0.5
    radius = max(maximum - minimum) * 1.35
    outputs = []
    for index, angle in enumerate((25, 145, 265)):
        radians = math.radians(angle)
        camera.location = centre + mathutils.Vector((radius * math.sin(radians), radius * math.cos(radians), radius * 0.55))
        camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
        output = directory / f"{slug}-{index + 1}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))
    return outputs
