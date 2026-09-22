# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Single-material remote atlas used by weapon LODs and mechanisms."""

import bpy


_QUADRANTS = {
    0: (0.16, 0.045, 0.012, 0.48),
    1: (0.28, 0.13, 0.025, 0.34),
    2: (0.008, 0.010, 0.012, 0.62),
    3: (0.035, 0.045, 0.052, 0.32),
}


def remote_atlas():
    found = bpy.data.materials.get("remote-weapon-atlas")
    if found:
        return found
    material = bpy.data.materials.new("remote-weapon-atlas")
    material.use_backface_culling = True
    material.use_nodes = True
    color = bpy.data.images.new("remote-weapon-atlas-color", width=256, height=256, alpha=False)
    rough = bpy.data.images.new("remote-weapon-atlas-roughness", width=256, height=256, alpha=False)
    color_pixels, rough_pixels = [], []
    for y in range(256):
        for x in range(256):
            quadrant = (1 if x >= 128 else 0) + (2 if y >= 128 else 0)
            red, green, blue, base_rough = _QUADRANTS[quadrant]
            noise = (((x * 61 + y * 103 + x * y) % 89) / 88 - 0.5) * 0.08
            color_pixels.extend((red * (1 + noise), green * (1 + noise), blue * (1 + noise), 1.0))
            value = max(0.08, min(0.92, base_rough + noise))
            rough_pixels.extend((value, value, value, 1.0))
    color.pixels = color_pixels
    rough.pixels = rough_pixels
    color.pack()
    rough.pack()
    rough.colorspace_settings.name = "Non-Color"
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    color_node = nodes.new("ShaderNodeTexImage")
    color_node.image = color
    rough_node = nodes.new("ShaderNodeTexImage")
    rough_node.image = rough
    material.node_tree.links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])
    material.node_tree.links.new(rough_node.outputs["Color"], bsdf.inputs["Roughness"])
    return material


def _quadrant(name: str) -> int:
    if "walnut" in name:
        return 0
    if "brass" in name:
        return 1
    if "black" in name:
        return 2
    return 3


def collapse_to_remote_atlas(obj, atlas) -> None:
    uv_layer = obj.data.uv_layers.active
    if uv_layer is None:
        raise RuntimeError(f"{obj.name}: remote atlas requires UVs")
    material_names = [slot.material.name if slot.material else "" for slot in obj.material_slots]
    origins = ((0.0, 0.0), (0.5, 0.0), (0.0, 0.5), (0.5, 0.5))
    for polygon in obj.data.polygons:
        quadrant = _quadrant(material_names[polygon.material_index] if polygon.material_index < len(material_names) else "")
        origin_x, origin_y = origins[quadrant]
        for loop_index in polygon.loop_indices:
            uv = uv_layer.data[loop_index].uv
            uv.x = origin_x + (uv.x % 1.0) * 0.5
            uv.y = origin_y + (uv.y % 1.0) * 0.5
        polygon.material_index = 0
    obj.data.materials.clear()
    obj.data.materials.append(atlas)
