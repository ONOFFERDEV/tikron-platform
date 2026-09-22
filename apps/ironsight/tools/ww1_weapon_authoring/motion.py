# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
from typing import Final, Literal, TypedDict

import bpy
from mathutils import Vector

from geometry import gp

Visibility = Literal["persistent", "transient"]
Motion = tuple[str, tuple[float, float, float], float, Visibility]


class MotionRecord(TypedDict):
    pivotSocket: str
    translation: tuple[float, float, float]
    rotationAxis: tuple[float, float, float]
    rotationRadians: float
    visibility: Visibility

MOTIONS: Final[dict[str, dict[str, Motion]]] = {
    "automatic_rifle": {
        "magazine": ("magwell", (0.0, -0.16, 0.0), 0.0, "persistent"),
        "bolt": ("chamber", (0.0, 0.0, -0.085), 0.0, "persistent"),
    },
    "trench_smg": {
        "magazine": ("magwell", (0.0, -0.16, 0.0), 0.0, "persistent"),
        "bolt": ("chamber", (0.0, 0.0, -0.085), 0.0, "persistent"),
    },
    "pump_shotgun": {
        "pump": ("grip_l", (0.0, 0.0, -0.12), 0.0, "persistent"),
        "shell": ("chamber", (0.0, -0.08, 0.0), 0.0, "transient"),
    },
    "bolt_service_rifle": {
        "bolt": ("chamber", (0.0, 0.0, -0.085), 1.0, "persistent"),
        "clip": ("clip_mount", (0.0, 0.08, 0.0), 0.0, "transient"),
    },
    "service_pistol": {
        "slide": ("chamber", (0.0, 0.0, -0.055), 0.0, "persistent"),
        "magazine": ("magwell", (0.0, -0.16, 0.0), 0.0, "persistent"),
    },
}


def _set_origin_at(obj, point: tuple[float, float, float]) -> None:
    cursor = bpy.context.scene.cursor.location.copy()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.context.scene.cursor.location = Vector(gp(point))
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    bpy.context.scene.cursor.location = cursor


def configure_motion(asset_key: str, moving, sockets) -> dict[str, MotionRecord]:
    output: dict[str, MotionRecord] = {}
    for part_name, (pivot_socket, translation, rotation_radians, visibility) in MOTIONS[asset_key].items():
        part = moving[part_name]
        _set_origin_at(part, sockets[pivot_socket])
        part["ww1MotionPivotSocket"] = pivot_socket
        part["ww1MotionTranslation"] = translation
        part["ww1MotionRotationAxis"] = (0.0, 0.0, 1.0)
        part["ww1MotionRotationRadians"] = rotation_radians
        part["ww1MotionVisibility"] = visibility
        output[part_name] = {
            "pivotSocket": pivot_socket,
            "translation": translation,
            "rotationAxis": (0.0, 0.0, 1.0),
            "rotationRadians": rotation_radians,
            "visibility": visibility,
        }
    return output
