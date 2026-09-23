# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# Run with Blender 4.5 --background --python tools/audit-ww1-headgear.py -- <output.json>
from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ww1_soldier_geometry import kit_geometry, uniform_body_geometry


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path("public/assets/models/player.glb").resolve()))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    material = bpy.data.materials.new("audit-clay")
    mats = dict.fromkeys(("wool", "canvas", "leather", "blanket", "steel", "collar"), material)
    body = uniform_body_geometry(rig, mats)
    head = next(obj for obj in body if obj.name.startswith("uniform-head"))
    bpy.context.view_layer.update()
    head_points = [head.matrix_world @ vertex.co for vertex in head.data.vertices]
    results = []
    for faction in ("khaki", "fieldgrey"):
        parts = kit_geometry(faction, mats)
        helmet = next(obj for obj in parts if "helmet" in obj.name)
        bpy.context.view_layer.update()
        points = [helmet.matrix_world @ vertex.co for vertex in helmet.data.vertices]
        polygons = [tuple(face.vertices) for face in helmet.data.polygons]
        tree = BVHTree.FromPolygons(points, polygons)
        crown = [point for point in head_points if point.z >= 1.69]
        clearance = []
        for point in crown:
            origin = Vector((point.x, point.y, 2))
            hit, _normal, _face, _distance = tree.ray_cast(origin, Vector((0, 0, -1)))
            clearance.append(-1 if hit is None else hit.z - point.z)
        edges = {}
        for face in polygons:
            for first, second in zip(face, (*face[1:], face[0]), strict=True):
                edge = tuple(sorted((first, second)))
                edges[edge] = edges.get(edge, 0) + 1
        front = [point.z for point in points if point.y < -.10]
        back = [point.z for point in points if point.y > .10]
        results.append({"faction": faction, "headTop": max(p.z for p in head_points),
                        "helmetTop": max(p.z for p in points), "crownSamples": len(crown),
                        "minimumCrownClearance": min(clearance),
                        "boundaryEdges": sum(count != 2 for count in edges.values()),
                        "width": max(p.x for p in points) - min(p.x for p in points),
                        "frontRim": min(front), "backRim": min(back),
                        "triangles": sum(len(face) - 2 for face in polygons)})
        for part in parts:
            bpy.data.objects.remove(part, do_unlink=True)
    output = Path(sys.argv[sys.argv.index("--") + 1])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    for result in results:
        assert result["minimumCrownClearance"] >= .003, result
        assert result["boundaryEdges"] == 0, result
        assert result["triangles"] <= 1400, result
    khaki, grey = results
    assert khaki["width"] - grey["width"] >= .025, results
    assert grey["frontRim"] - grey["backRim"] >= .04, results
    print("HEADGEAR GEOMETRY PASS", output)


main()
