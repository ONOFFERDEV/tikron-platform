# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Blender geometry helpers for measured WW1 weapon candidates."""

import math
from collections.abc import Iterable

import bpy
from mathutils import Vector


def mat(name: str, color: tuple[float, float, float, float], metallic: float, roughness: float):
    found = bpy.data.materials.get(name)
    if found:
        return found
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.metallic = metallic
    result.roughness = roughness
    result.use_backface_culling = True
    result.use_nodes = True
    nodes = result.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    image = bpy.data.images.new(f"{name}-surface", width=128, height=128, alpha=False)
    roughness_image = bpy.data.images.new(f"{name}-roughness", width=128, height=128, alpha=False)
    normal_image = bpy.data.images.new(f"{name}-normal", width=128, height=128, alpha=False)
    pixels = []
    roughness_pixels = []
    normal_pixels = []
    for y in range(128):
        for x in range(128):
            grain = math.sin(y * 0.31 + math.sin(x * 0.09) * 2.3) * 0.5 + 0.5
            speckle = ((x * 73 + y * 151 + x * y * 3) % 97) / 96
            variation = (grain * 0.18 + speckle * 0.06 - 0.12) if "walnut" in name else (speckle - 0.5) * 0.07
            pixels.extend((*[max(0.0, min(1.0, channel * (1 + variation))) for channel in color[:3]], 1.0))
            local_roughness = max(0.08, min(0.92, roughness + (grain - 0.5) * 0.16 + (speckle - 0.5) * 0.08))
            roughness_pixels.extend((local_roughness, local_roughness, local_roughness, 1.0))
            normal_x = 0.5 + math.cos(y * 0.31 + math.sin(x * 0.09) * 2.3) * (0.09 if "walnut" in name else 0.025)
            normal_pixels.extend((normal_x, 0.5, 1.0, 1.0))
    image.pixels = pixels
    roughness_image.pixels = roughness_pixels
    normal_image.pixels = normal_pixels
    image.pack()
    roughness_image.pack()
    normal_image.pack()
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    result.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    roughness_texture = nodes.new("ShaderNodeTexImage")
    roughness_texture.image = roughness_image
    roughness_texture.image.colorspace_settings.name = "Non-Color"
    result.node_tree.links.new(roughness_texture.outputs["Color"], bsdf.inputs["Roughness"])
    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.image = normal_image
    normal_texture.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.32 if "walnut" in name else 0.16
    result.node_tree.links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    result.node_tree.links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    metallic_input = bsdf.inputs.get("Metallic IOR Level") or bsdf.inputs.get("Metallic")
    if metallic_input is None:
        raise RuntimeError("Principled BSDF metallic input is unavailable")
    metallic_input.default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return result


def materials() -> dict[str, object]:
    return {
        "steel": mat("blued-steel", (0.025, 0.035, 0.045, 1), 0.88, 0.24),
        "steel_worn": mat("worn-steel", (0.075, 0.08, 0.075, 1), 0.78, 0.36),
        "wood": mat("oiled-walnut", (0.19, 0.055, 0.018, 1), 0.0, 0.38),
        "wood_dark": mat("dark-walnut", (0.075, 0.018, 0.008, 1), 0.0, 0.48),
        "brass": mat("aged-brass", (0.32, 0.16, 0.025, 1), 0.65, 0.3),
        "black": mat("recess-black", (0.006, 0.008, 0.009, 1), 0.25, 0.5),
    }


def gp(point: tuple[float, float, float]) -> tuple[float, float, float]:
    return point[0], -point[2], point[1]


def quantize_uvs(obj) -> None:
    layer = obj.data.uv_layers.active
    if layer is None:
        return
    for item in layer.data:
        item.uv = (round(float(item.uv.x), 6), round(float(item.uv.y), 6))


def finish(obj, name: str, material, bevel: float = 0.0, segments: int = 2):
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("machined-edge-roll", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if material is not None:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="UVMap")
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
    quantize_uvs(obj)
    return obj


def box(name: str, center, half, material, bevel=0.003, segments=2):
    bpy.ops.mesh.primitive_cube_add(location=gp(center))
    obj = bpy.context.object
    obj.scale = half[0], half[2], half[1]
    return finish(obj, name, material, bevel, segments)


def cylinder(name: str, center, radius: float, length: float, material, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=length,
        location=gp(center), rotation=(math.pi / 2, 0, 0),
    )
    return finish(bpy.context.object, name, material)


def side_cylinder(name: str, center, radius: float, length: float, material, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=length,
        location=gp(center), rotation=(0, math.pi / 2, 0),
    )
    return finish(bpy.context.object, name, material)


def cone(name: str, center, radius1: float, radius2: float, length: float, material, vertices=32):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius1, radius2=radius2, depth=length,
        location=gp(center), rotation=(math.pi / 2, 0, 0),
    )
    return finish(bpy.context.object, name, material)


def torus(name: str, center, major: float, minor: float, material, segments=24):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=8,
        location=gp(center), rotation=(math.pi / 2, 0, 0),
    )
    return finish(bpy.context.object, name, material)


def side_torus(name: str, center, major: float, minor: float, material, segments=24):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=8,
        location=gp(center), rotation=(0, math.pi / 2, 0),
    )
    return finish(bpy.context.object, name, material)


def profile(name: str, points: list[tuple[float, float]], width: float, material, bevel=0.005):
    vertices = []
    for x in (-width, width):
        vertices.extend((x, -z, y) for z, y in points)
    count = len(points)
    faces = []
    faces.append(tuple(range(count)))
    faces.append(tuple(reversed(range(count, count * 2))))
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, material, bevel, 3)


def empty(name: str, point, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "ARROWS"
    obj.empty_display_size = 0.025
    obj.location = gp(point)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def join(objects: Iterable, name: str):
    selected = [item for item in objects if item and item.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for item in selected:
        item.select_set(True)
    bpy.context.view_layer.objects.active = selected[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    if not result.data.uv_layers:
        result.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    quantize_uvs(result)
    return result


def parent_keep_world(child, parent):
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def decimated_copy(source, name: str, ratio: float):
    copy = source.copy()
    copy.data = source.data.copy()
    bpy.context.collection.objects.link(copy)
    copy.name = name
    modifier = copy.modifiers.new("true-lod-decimation", "DECIMATE")
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = copy
    copy.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return copy


def dimensions(objects: Iterable) -> dict[str, list[float]]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    return {"blenderMin": low, "blenderMax": high, "metres": [high[0] - low[0], high[2] - low[2], high[1] - low[1]]}
