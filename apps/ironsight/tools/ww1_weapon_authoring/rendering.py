# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""CPU review rendering for WW1 weapon production candidates."""

import hashlib
import math
from pathlib import Path

import bpy
from mathutils import Vector

from geometry import gp


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def look(obj, target: Vector):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def contact_marker(point):
    target = Vector(gp(point))
    material = bpy.data.materials.new("contact-marker")
    material.diffuse_color = (1.0, 0.12, 0.01, 1.0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.012, location=target + Vector((0.055, 0, 0)))
    marker = bpy.context.object
    marker.data.materials.append(material)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.003, depth=0.055, location=target + Vector((0.0275, 0, 0)), rotation=(0, math.pi / 2, 0))
    stalk = bpy.context.object
    stalk.data.materials.append(material)
    return target, (marker, stalk), material


def render_mechanisms(scene, camera, output: Path, radius: float, center: Vector, moving):
    images = []
    for part_name, part in moving.items():
        base_location = part.location.copy()
        base_rotation = part.rotation_euler.copy()
        base_hidden = part.hide_render
        translation = Vector(gp(tuple(part["ww1MotionTranslation"])))
        rotation = float(part["ww1MotionRotationRadians"])
        transient = part["ww1MotionVisibility"] == "transient"
        for state, fraction in (("closed", 0.0), ("mid", 0.5), ("open", 1.0)):
            action_fraction = 1.0 - fraction if transient else fraction
            part.location = base_location + translation * action_fraction
            part.rotation_euler = base_rotation
            part.rotation_euler[1] = base_rotation[1] - rotation * action_fraction
            part.hide_render = transient and state == "closed"
            camera.location = (radius * 0.9, center.y, 0.20)
            look(camera, center)
            camera.data.lens = 65
            path = output / f"mechanism-{part_name}-{state}.png"
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            images.append(path)
        part.location = base_location
        part.rotation_euler = base_rotation
        part.hide_render = base_hidden
    return images


def render_packet(output: Path, length: float, sockets, moving):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.render.resolution_x = 420
    scene.render.resolution_y = 300
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("review-world")
    scene.world.color = (0.018, 0.021, 0.025)
    for transient in ("clip", "shell"):
        if bpy.data.objects.get(transient):
            bpy.data.objects[transient].hide_render = True
    camera_data = bpy.data.cameras.new("review-camera")
    camera = bpy.data.objects.new("review-camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.data.lens = 58
    visible = [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]
    corners = [obj.matrix_world @ Vector(corner) for obj in visible for corner in obj.bound_box]
    center = Vector(tuple((min(point[axis] for point in corners) + max(point[axis] for point in corners)) * 0.5 for axis in range(3)))
    radius = max(0.72, length * 2.2)
    views = {
        "side-right": (radius, center.y, 0.16),
        "three-quarter-front": (radius * 0.65, center.y - radius * 0.65, 0.25),
        "muzzle-end": (0, center.y - radius, 0.18),
        "three-quarter-left": (-radius * 0.65, center.y - radius * 0.65, 0.25),
        "side-left": (-radius, center.y, 0.16),
    }
    for index, location in enumerate(((2.2, 1.2, 2.4), (-1.8, -0.8, 1.4), (0, 1.5, 0.4))):
        data = bpy.data.lights.new(f"area-{index}", "AREA")
        data.energy = (900, 650, 350)[index]
        data.shape = "DISK"
        data.size = (2.4, 1.8, 1.2)[index]
        light = bpy.data.objects.new(f"area-{index}", data)
        scene.collection.objects.link(light)
        light.location = location
        look(light, center)
    output.mkdir(parents=True, exist_ok=True)
    images = []
    for name, location in views.items():
        camera.location = location
        look(camera, center)
        scene.render.filepath = str(output / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        images.append(output / f"{name}.png")
    rear, front = sockets["sight_rear"], sockets["sight_front"]
    camera.location = (rear[0], -rear[2] + 0.22, rear[1] + 0.035)
    look(camera, Vector((front[0], -front[2], front[1] + 0.015)))
    scene.render.filepath = str(output / "iron-sight.png")
    bpy.ops.render.render(write_still=True)
    images.append(output / "iron-sight.png")
    for name, socket_name in (("contact-grip-r", "grip_r"), ("contact-grip-l", "grip_l")):
        point = sockets[socket_name]
        target, markers, marker_material = contact_marker(point)
        camera.location = target + Vector((0.24, 0.18, 0.18))
        look(camera, target)
        camera.data.lens = 68
        scene.render.filepath = str(output / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        images.append(output / f"{name}.png")
        for marker in markers:
            bpy.data.objects.remove(marker, do_unlink=True)
        bpy.data.materials.remove(marker_material)
    images.extend(render_mechanisms(scene, camera, output, radius, center, moving))
    return [{"path": str(path), "sha256": sha(path)} for path in images]
