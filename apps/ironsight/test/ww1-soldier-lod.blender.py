# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# How to run: Blender 4.5 --background --python-exit-code 1
# --python test/ww1-soldier-lod.blender.py -- <characters-dir> [report.json]
"""Check fitted soldier exports through Blender, including actual triangle budgets."""

from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import NotRequired, TypedDict

import bpy
from mathutils import Vector


APP = Path(__file__).resolve().parents[1]
LIMITS = {"LOD0": 18_000, "LOD1": 8_000, "LOD2": 3_000}


class LodMeasurement(TypedDict):
    triangles: int
    metadataTriangles: int
    limit: int
    vertices: int
    maxBoundsDriftMetres: NotRequired[float]


class FactionReport(TypedDict):
    asset: str
    lods: dict[str, LodMeasurement]
    failures: list[str]


def check_faction(path: Path) -> FactionReport:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    blob = path.read_bytes()
    json_length = struct.unpack_from("<I", blob, 12)[0]
    document = json.loads(blob[20:20 + json_length])
    metadata = json.loads(path.with_suffix(".meta.json").read_text(encoding="utf-8"))
    assert len(document["animations"]) == 64, "All 64 source clips must survive export"
    assert len(rig.data.bones) == 55, "All 55 humanoid joints must survive export"
    assert len(document["materials"]) == 3, "Soldier must remain within three draws"
    measurements: dict[str, LodMeasurement] = {}
    bounds = {}
    failures = []
    body_hash = hashlib.sha256((APP / "tools/ww1_soldier_body.py").read_bytes()).hexdigest()
    if metadata.get("bodyScriptSha256") != body_hash:
        failures.append("Body helper provenance hash is missing or stale")
    for name, limit in LIMITS.items():
        mesh = bpy.data.objects[name]
        mesh.data.calc_loop_triangles()
        triangles = len(mesh.data.loop_triangles)
        node = next(item for item in document["nodes"] if item["name"] == name)
        exported = document["meshes"][node["mesh"]]
        index_triangles = sum(document["accessors"][item["indices"]]["count"] // 3
                              for item in exported["primitives"])
        assert triangles == index_triangles, f"{name}: Blender/export triangle mismatch"
        assert len(exported["primitives"]) == 3, f"{name}: field kit, wool and steel must survive"
        assert mesh.parent == rig, f"{name}: disconnected armature"
        assert any(mod.type == "ARMATURE" and mod.object == rig for mod in mesh.modifiers)
        for vertex in mesh.data.vertices:
            assert vertex.groups, f"{name}: unweighted vertex {vertex.index}"
            assert abs(sum(group.weight for group in vertex.groups) - 1.0) < 0.0001
        points = [mesh.matrix_world @ vertex.co for vertex in mesh.data.vertices]
        bounds[name] = [(min(point[axis] for point in points), max(point[axis] for point in points))
                        for axis in range(3)]
        measurements[name] = {"triangles": triangles, "metadataTriangles": metadata["lodTriangles"][name],
                              "limit": limit, "vertices": len(mesh.data.vertices)}
        if triangles > limit:
            failures.append(f"{name}: {triangles} triangles exceed {limit}")
        if metadata["lodTriangles"][name] != triangles:
            failures.append(f"{name}: metadata reports {metadata['lodTriangles'][name]}, export has {triangles}")
    for name in ("LOD1", "LOD2"):
        drift = max(abs(value - bounds["LOD0"][axis][side])
                    for axis, pair in enumerate(bounds[name]) for side, value in enumerate(pair))
        assert drift <= 0.02, f"{name}: rest silhouette extent drift {drift:.4f} m exceeds 2 cm"
        measurements[name]["maxBoundsDriftMetres"] = drift
    assert measurements["LOD0"]["triangles"] > measurements["LOD1"]["triangles"] > measurements["LOD2"]["triangles"]
    # Exercise the exported skin modifier rather than accepting attributes alone.
    rig.data.pose_position = "POSE"
    rig.animation_data_clear()
    rig.pose.bones["spine_02"].rotation_mode = "XYZ"
    rig.pose.bones["spine_02"].rotation_euler.x += 0.3
    bpy.context.view_layer.update()
    for name in LIMITS:
        mesh = bpy.data.objects[name]
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        deformed = evaluated.to_mesh()
        displacement = max((Vector(vertex.co) - deformed.vertices[vertex.index].co).length
                           for vertex in mesh.data.vertices)
        evaluated.to_mesh_clear()
        assert displacement > 0.01, f"{name}: skin does not respond to spine pose"
    return {"asset": path.name, "lods": measurements, "failures": failures}


args = sys.argv[sys.argv.index("--") + 1:]
root = Path(args[0]).resolve()
reports = [check_faction(root / f"soldier-{faction}.glb") for faction in ("khaki", "fieldgrey")]
report_path = Path(args[1]).resolve() if len(args) > 1 else root.parent / "lod-regression.json"
report_path.write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
assert not any(report["failures"] for report in reports), json.dumps(reports, indent=2)
print(f"PASS: actual triangle budgets, metadata, skin, silhouette bounds, 55 joints and 64 clips: {report_path}")
