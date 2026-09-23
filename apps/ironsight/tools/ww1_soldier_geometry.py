from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Vector
from ww1_soldier_headgear import Surface, head_surface, helmet_surface as fitted_helmet_surface
from ww1_soldier_body import ClothSurface, boot_surface, finger_surface, limb_surface, neck_surface, tunic_surface


def primitive(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], mat,
              kind: str = "cube", rotation: tuple[float, float, float] = (0, 0, 0)):
    location = (location[0], -location[2], location[1])
    scale = (scale[0], scale[2], scale[1])
    if kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location, rotation=rotation)
    elif kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1, depth=2, location=location, rotation=rotation)
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=0.75, minor_radius=0.25, major_segments=24, minor_segments=8,
                                        location=location, rotation=rotation)
    else:
        bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if kind == "cube":
        bevel = obj.modifiers.new("cloth-edge", "BEVEL")
        bevel.width = max(0.004, min(scale) * 0.34)
        bevel.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.data.materials.append(mat)
    return obj


def authored_surface(name: str, surface: Surface, mat: bpy.types.Material) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}-mesh")
    mesh.from_pydata([(x, -z, y) for x, y, z in surface.vertices], [], surface.faces)
    mesh.materials.append(mat)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def pouch(name: str, x: float, height: float, mats: dict[str, object], width: float = 0.043) -> list[object]:
    return [
        primitive(name, (x, height, 0.175), (width, 0.068, 0.032), mats["leather"]),
        primitive(f"{name}-flap", (x, height + 0.025, 0.21), (width * 0.9, 0.02, 0.006), mats["canvas"],
                  rotation=(0.18, 0, 0)),
    ]


def khaki_kit(mats: dict[str, object]) -> list[object]:
    gear = [
        primitive("webbing-l", (-0.105, 1.235, 0.145), (0.014, 0.22, 0.011), mats["leather"], rotation=(0, -0.12, 0)),
        primitive("webbing-r", (0.105, 1.235, 0.145), (0.014, 0.22, 0.011), mats["leather"], rotation=(0, 0.12, 0)),
        primitive("waist-belt", (0, 1.035, 0.14), (0.195, 0.018, 0.016), mats["leather"]),
        primitive("pack", (0, 1.14, -0.18), (0.155, 0.145, 0.05), mats["canvas"]),
        primitive("pack-flap", (0, 1.205, -0.235), (0.143, 0.055, 0.007), mats["blanket"]),
        primitive("pack-strap-l", (-0.08, 1.14, -0.237), (0.01, 0.125, 0.007), mats["leather"]),
        primitive("pack-strap-r", (0.08, 1.14, -0.237), (0.01, 0.125, 0.007), mats["leather"]),
        primitive("blanket-roll", (0, 0.945, -0.18), (0.15, 0.045, 0.045), mats["blanket"], "cylinder", (0, math.pi / 2, 0)),
        primitive("canteen", (0.225, 0.94, -0.01), (0.065, 0.078, 0.03), mats["canvas"], "cylinder", (math.pi / 2, 0, 0)),
        authored_surface("khaki-brodie-helmet", fitted_helmet_surface("khaki"), mats["steel"]),
    ]
    for index, x in enumerate((-0.155, -0.052, 0.052, 0.155)):
        gear.extend(pouch(f"khaki-ammo-{index}", x, 1.005, mats))
    return gear


def fieldgrey_kit(mats: dict[str, object]) -> list[object]:
    gear = [
        primitive("cross-webbing-l", (-0.07, 1.245, 0.145), (0.013, 0.235, 0.011), mats["leather"], rotation=(0, -0.18, 0)),
        primitive("cross-webbing-r", (0.07, 1.245, 0.145), (0.013, 0.235, 0.011), mats["leather"], rotation=(0, 0.18, 0)),
        primitive("waist-belt", (0, 1.035, 0.14), (0.205, 0.018, 0.016), mats["leather"]),
        primitive("field-pack", (-0.045, 1.08, -0.18), (0.135, 0.125, 0.05), mats["canvas"]),
        primitive("field-pack-flap", (-0.045, 1.135, -0.235), (0.123, 0.045, 0.007), mats["blanket"]),
        primitive("shoulder-roll", (0.16, 1.15, -0.175), (0.045, 0.18, 0.045), mats["blanket"], "cylinder"),
        primitive("canteen", (-0.225, 0.94, -0.01), (0.065, 0.078, 0.03), mats["canvas"], "cylinder", (math.pi / 2, 0, 0)),
        authored_surface("fieldgrey-deep-helmet", fitted_helmet_surface("fieldgrey"), mats["steel"]),
        primitive("coat-tail-l", (-0.11, 0.94, -0.005), (0.115, 0.22, 0.095), mats["wool"], rotation=(0, -0.05, 0)),
        primitive("coat-tail-r", (0.11, 0.94, -0.005), (0.115, 0.22, 0.095), mats["wool"], rotation=(0, 0.05, 0)),
        primitive("collar-l", (-0.055, 1.475, 0.125), (0.06, 0.025, 0.016), mats["collar"], rotation=(0, -0.42, 0)),
        primitive("collar-r", (0.055, 1.475, 0.125), (0.06, 0.025, 0.016), mats["collar"], rotation=(0, 0.42, 0)),
    ]
    for index, x in enumerate((-0.17, -0.10, 0.10, 0.17)):
        gear.extend(pouch(f"fieldgrey-ammo-{index}", x, 1.0 if abs(x) > 0.12 else 1.035, mats, 0.035))
    return gear


def kit_geometry(faction: str, mats: dict[str, object]) -> list[object]:
    return khaki_kit(mats) if faction == "khaki" else fieldgrey_kit(mats)


def weighted(obj, joint: str):
    group = obj.vertex_groups.new(name=joint)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    return obj


def palm(rig, joint: str, mat):
    side = joint[-1].lower()
    wrist = rig.data.bones[joint].head_local
    roots = [rig.data.bones[f"{family}_01_{side}"].head_local
             for family in ("thumb", "indexFinger", "finger")]
    mcp = sum(roots, Vector()) / len(roots)
    direction = mcp - wrist
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1,
                                         location=(wrist + mcp) * .5)
    obj = bpy.context.object
    obj.name = f"uniform-palm-{joint}"
    obj.scale = (.03, .014, direction.length * .36)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.data.materials.append(mat)
    return weighted(obj, joint)


def uniform_body_geometry(rig, mats: dict[str, object]) -> list[object]:
    wool = mats["wool"]
    def cloth(name: str, surface: ClothSurface, mat=wool):
        obj = authored_surface(name, surface.surface, mat)
        for index, weights in enumerate(surface.weights):
            for joint, weight in weights:
                group = obj.vertex_groups.get(joint) or obj.vertex_groups.new(name=joint)
                group.add([index], weight, "REPLACE")
        for face in obj.data.polygons:
            face.use_smooth = True
        return obj

    spine = tuple((joint, rig.data.bones[joint].head_local.z) for joint in
                  ("Pelvis", "spine_01", "spine_02", "spine_03", "neck_01"))
    parts = [
        cloth("uniform-tunic", tunic_surface(spine)),
        cloth("uniform-neck", neck_surface("spine_03", "neck_01", "head"), mats["collar"]),
        weighted(authored_surface("uniform-head", head_surface(), wool), "head"),
    ]
    for face in parts[-1].data.polygons:
        face.use_smooth = True
    for side in ("L", "R"):
        for kind, joints, radii in (("sleeve", (f"UpperArm_{side}", f"lowerarm_{side.lower()}", f"Hand_{side}"), (.105, .070, .036)),
                                   ("trouser", (f"Thigh_{side}", f"calf_{side.lower()}", f"Foot_{side}"), (.102, .074, .047))):
            points = tuple((rig.data.bones[joint].head_local.x, rig.data.bones[joint].head_local.z,
                            -rig.data.bones[joint].head_local.y) for joint in joints)
            root = None
            if kind == "sleeve":
                clavicle_name = f"clavicle_{side.lower()}"
                clavicle = rig.data.bones[clavicle_name].head_local
                root = ((clavicle.x, clavicle.z, -clavicle.y), clavicle_name)
            parts.append(cloth(f"uniform-{kind}-{side}", limb_surface(points, joints[:2], radii, root)))
        foot = rig.data.bones[f"Foot_{side}"].head_local
        parts.append(cloth(f"uniform-boot-{side}", boot_surface((foot.x, foot.z, -foot.y),
                           f"Foot_{side}"), mats["leather"]))
    def point(joint: str) -> Vector:
        head = rig.data.bones[joint].head_local
        return Vector((head.x, head.z, -head.y))

    for side in ("l", "r"):
        hand = f"Hand_{side.upper()}"
        parts.append(palm(rig, hand, mats["leather"]))
        spread = (point(f"indexFinger_01_{side}") - point(f"finger_01_{side}")).normalized()
        for family, radii in (("thumb", (.012, .011)), ("indexFinger", (.0105, .0095)), ("finger", (.026, .011))):
            joints = (hand, *(f"{family}_{number:02d}_{side}" for number in (1, 2, 3)))
            points = [point(joint) for joint in joints]
            points.append(point(f"{family}_04_{side}") if family != "thumb" else points[-1] + (points[-1] - points[-2]) * .75)
            parts.append(cloth(f"uniform-{family}-{side}", finger_surface(
                tuple(tuple(p) for p in points), joints, tuple(spread), radii), mats["leather"]))
    return parts


def remove_source_headwear(mesh) -> None:
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    headwear = []
    for face in bm.faces:
        center = face.calc_center_median()
        side = max(abs(vertex.co.x) for vertex in face.verts)
        rear = max(vertex.co.y for vertex in face.verts)
        if any(vertex.co.z > 1.67 for vertex in face.verts) or (center.z > 1.55 and (side > 0.075 or rear > 0.045)):
            headwear.append(face)
    bmesh.ops.delete(bm, geom=headwear, context="FACES")
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()
