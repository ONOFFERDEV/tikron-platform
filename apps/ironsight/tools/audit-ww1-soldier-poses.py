from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

COMMON = ("crouch_idle", "crouch_walk", "death", "hit_chest", "hit_head", "idle", "run", "sprint", "walk")
PREFIXES = ("rifle", "smg", "shotgun", "sniper", "pistol")
STATES = ("idle", "walk", "run", "sprint", "crouch_idle", "crouch_walk", "strafe_left",
          "strafe_right", "backpedal", "crouch_left", "crouch_right")
EXPECTED = COMMON + tuple(f"{prefix}_{state}" for prefix in PREFIXES for state in STATES)
HEAD_GROUPS = frozenset(("head", "neck_01"))
TORSO_GROUPS = frozenset(("Pelvis", "spine_01", "spine_02", "spine_03"))


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--soldier", action="append", required=True, metavar="FACTION=PATH")
    parser.add_argument("--animation-source", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--calibration", type=Path, required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def exported_mesh_names(path: Path) -> list[str]:
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    return [node.get("name", "") for node in document.get("nodes", []) if "mesh" in node]


def clear() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.data.orphans_purge(do_recursive=True)


def parse_soldier(value: str) -> tuple[str, Path]:
    faction, separator, path = value.partition("=")
    if not separator or not faction or not path:
        raise ValueError(f"invalid --soldier {value!r}; expected FACTION=PATH")
    return faction, Path(path).resolve()


def evaluated_positions(mesh) -> list[Vector]:
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(graph)
    data = evaluated.to_mesh()
    result = [evaluated.matrix_world @ vertex.co for vertex in data.vertices]
    evaluated.to_mesh_clear()
    return result


def selected_indices(mesh, groups: frozenset[str]) -> list[int]:
    indices = []
    for vertex in mesh.data.vertices:
        weight = sum(item.weight for item in vertex.groups if mesh.vertex_groups[item.group].name in groups)
        if weight >= 0.45:
            indices.append(vertex.index)
    return indices


def bounds(points: list[Vector]) -> dict[str, object]:
    low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return {"min": list(low), "max": list(high), "center": list((low + high) * 0.5),
            "radius": max((point - (low + high) * 0.5).length for point in points)}


def triangle_stretch(mesh, rest: list[Vector], posed: list[Vector]) -> float:
    maximum = 1.0
    for polygon in mesh.data.polygons:
        if len(polygon.vertices) != 3:
            continue
        triangle = tuple(polygon.vertices)
        for offset in range(3):
            left, right = triangle[offset], triangle[(offset + 1) % 3]
            base = (rest[left] - rest[right]).length
            if base >= 0.005:
                maximum = max(maximum, (posed[left] - posed[right]).length / base)
    return maximum


def audit(faction: str, path: Path, stretch_limit: float) -> tuple[dict[str, object], list[dict[str, object]], list[str]]:
    clear()
    bpy.ops.import_scene.gltf(filepath=str(path))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    exported_names = exported_mesh_names(path)
    unexpected_meshes = sorted(name for name in exported_names if not name.startswith(("LOD0", "LOD1", "LOD2")))
    context_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    meshes = [obj for obj in context_meshes if obj.name in exported_names]
    ignored_importer_meshes = sorted(obj.name for obj in context_meshes if obj.name not in exported_names)
    lod0 = next((mesh for mesh in meshes if mesh.name.startswith("LOD0")), max(meshes, key=lambda item: len(item.data.vertices)))
    actions = {action.name: action for action in bpy.data.actions}
    issues = []
    if unexpected_meshes:
        issues.append(f"unexpected-meshes {unexpected_meshes}")
    if set(actions) != set(EXPECTED):
        issues.append(f"clip-set expected={len(EXPECTED)} actual={len(actions)} missing={sorted(set(EXPECTED) - set(actions))}")
    weight_sums = [sum(item.weight for item in vertex.groups) for vertex in lod0.data.vertices]
    if not weight_sums or min(weight_sums) < 0.99 or max(weight_sums) > 1.01:
        issues.append(f"weight-sum min={min(weight_sums, default=0):.6f} max={max(weight_sums, default=0):.6f}")
    neutral = lod0.vertex_groups.get("neutral_bone")
    if neutral and any(any(item.group == neutral.index and item.weight > 0.001 for item in vertex.groups)
                       for vertex in lod0.data.vertices):
        issues.append("neutral-bone-weight")
    rig.animation_data_create()
    rig.animation_data.action = None
    bpy.context.scene.frame_set(0)
    rest = evaluated_positions(lod0)
    full_body = [point for mesh in meshes for point in evaluated_positions(mesh)]
    full_body_bounds = bounds(full_body)
    full_body_height = full_body_bounds["max"][2] - full_body_bounds["min"][2]
    runtime_scale = 1.8 / full_body_height
    head_indices = selected_indices(lod0, HEAD_GROUPS)
    torso_indices = selected_indices(lod0, TORSO_GROUPS)
    if not head_indices or not torso_indices:
        issues.append(f"calibration-groups head={len(head_indices)} torso={len(torso_indices)}")
    samples = []
    worst_stretch = 1.0
    joint_samples: dict[str, dict[str, list[float]]] = {}
    for name in EXPECTED:
        action = actions.get(name)
        if action is None:
            continue
        rig.animation_data.action = action
        start, end = action.frame_range
        for phase, frame in (("start", start), ("mid", (start + end) * 0.5), ("end", end)):
            bpy.context.scene.frame_set(int(frame), subframe=frame % 1)
            posed = evaluated_positions(lod0)
            stretch = triangle_stretch(lod0, rest, posed)
            worst_stretch = max(worst_stretch, stretch)
            head = [posed[index] for index in head_indices]
            torso = [posed[index] for index in torso_indices]
            samples.append({"faction": faction, "clip": name, "phase": phase, "frame": frame,
                            "head": bounds(head), "torso": bounds(torso), "maxTriangleStretch": stretch})
        bpy.context.scene.frame_set(int((start + end) * 0.5))
        joint_samples[name] = {joint: list(rig.matrix_world @ rig.pose.bones[joint].head)
                               for joint in ("head", "Hand_L", "Hand_R", "Foot_L", "Foot_R")}
    if worst_stretch > stretch_limit:
        issues.append(f"triangle-stretch {worst_stretch:.6f}>{stretch_limit:.6f}")
    if "idle" in joint_samples and "death" in joint_samples:
        head_motion = (Vector(joint_samples["idle"]["head"]) - Vector(joint_samples["death"]["head"])).length
        if head_motion < 0.30:
            issues.append(f"death-motion {head_motion:.6f}<0.30")
    if "idle" in joint_samples and "rifle_idle" in joint_samples:
        contact_motion = (Vector(joint_samples["idle"]["Hand_L"]) - Vector(joint_samples["rifle_idle"]["Hand_L"])).length
        if contact_motion < 0.15:
            issues.append(f"rifle-contact-motion {contact_motion:.6f}<0.15")
    report = {"faction": faction, "path": str(path), "sha256": sha256(path), "clipCount": len(actions),
              "exportedRenderableMeshes": exported_names, "blenderContextMeshes": sorted(obj.name for obj in context_meshes),
              "ignoredImporterMeshes": ignored_importer_meshes, "vertices": len(lod0.data.vertices),
              "headVertices": len(head_indices), "torsoVertices": len(torso_indices),
              "fullBodyBoundsBlender": full_body_bounds, "runtimeNormalization": {
                  "axisMap": {"x": "+Bx", "y": "+Bz", "z": "-By"},
                  "baseScale": runtime_scale, "feetOffsetY": -full_body_bounds["min"][2] * runtime_scale,
              }, "maxTriangleStretch": worst_stretch, "jointSamples": joint_samples, "issues": issues}
    return report, samples, issues


def main() -> None:
    args = arguments()
    reports, samples, issues = [], [], []
    source = args.animation_source.resolve()
    source_report, _, source_issues = audit("animation-source", source, float("inf"))
    source_issues = [issue for issue in source_issues if not issue.startswith(("calibration-groups", "unexpected-meshes"))]
    if source_issues:
        raise RuntimeError("animation-source:" + ";".join(source_issues))
    stretch_limit = float(source_report["maxTriangleStretch"]) * 1.25
    for value in args.soldier:
        faction, path = parse_soldier(value)
        report, faction_samples, faction_issues = audit(faction, path, stretch_limit)
        reports.append(report)
        samples.extend(faction_samples)
        issues.extend(f"{faction}:{issue}" for issue in faction_issues)
    result = {"schemaVersion": 1, "valid": not issues, "animationSource": str(source),
              "animationSourceSha256": sha256(source), "sourceStretchBaseline": source_report["maxTriangleStretch"],
              "stretchLimit": stretch_limit, "reports": reports, "issues": issues}
    calibration = {"schemaVersion": 1, "units": "metres", "decisionAuthority": "task-23",
                   "animationSourceSha256": sha256(source), "soldiers": [
                       {"faction": report["faction"], "sha256": report["sha256"]} for report in reports],
                   "sampleCount": len(samples), "samples": samples}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.calibration.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    args.calibration.write_text(json.dumps(calibration, indent=2) + "\n", encoding="utf-8")
    if issues:
        raise RuntimeError("; ".join(issues))


main()
