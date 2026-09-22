# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build and review five directly authored WW1 production weapon candidates."""

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

MODULE_DIR = Path(__file__).resolve().parent / "ww1_weapon_authoring"
sys.path.insert(0, str(MODULE_DIR))
from geometry import decimated_copy, dimensions, empty, gp, join, materials, parent_keep_world
from motion import MOTIONS, configure_motion
from paths import planned_paths, require_absolute
from rendering import render_packet
from remote import collapse_to_remote_atlas, remote_atlas
from specs import BUILDERS

COMMON_SOCKETS = ("grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front")
RAW_SHA = {
    "automatic_rifle": "6e323010a32e8aaacc434e14df0b93c8719cd9806a69bfc2835db8a460b3100e",
    "trench_smg": "bc5abe9ea76dc5be35dc863f3781ccf9ecee0a2f84ff620799003118f0e062dd",
    "pump_shotgun": "0651ed5b42ea6bf4b2da91353aa05e24d90505ddd2a0ae17f850da3e680a79d0",
    "bolt_service_rifle": "52ab234466154aa23f23d8f2ff995c47b3b6fe2c17c87d94112c2ad21c416d7a",
    "service_pistol": "98b0244ff7b5a1d3989f69c111d3f6662c00fdf17b1c516faade665ba8b2ca0a",
}


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--asset-key", choices=tuple(BUILDERS))
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_reference(path: Path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [item for item in bpy.context.scene.objects if item not in before]
    collection = bpy.data.collections.new("REJECTED_PROVIDER_REFERENCE")
    bpy.context.scene.collection.children.link(collection)
    for item in imported:
        for owner in tuple(item.users_collection):
            owner.objects.unlink(item)
        collection.objects.link(item)
        item.hide_render = True
        item.hide_viewport = True
    collection.hide_render = True
    collection.hide_viewport = True
    return imported


def triangle_count(obj) -> int:
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons) if obj.type == "MESH" else 0


def build_weapon(key: str):
    mats = materials()
    body_parts, moving, sockets, length = BUILDERS[key](mats, True)
    mechanism_motions = configure_motion(key, moving, sockets)
    grip = sockets["grip_r"]
    offset = Vector(gp((-grip[0], -grip[1], -grip[2])))
    for item in (*body_parts, *moving.values()):
        item.location += offset
    sockets = {name: tuple(point[axis] - grip[axis] for axis in range(3)) for name, point in sockets.items()}
    if sockets["grip_r"] != (0, 0, 0):
        raise RuntimeError(f"{key}: grip_r origin normalization failed")
    body = join(body_parts, "fp")
    root = empty(key, (0, 0, 0))
    parent_keep_world(body, root)
    lod0 = decimated_copy(body, "LOD0", 0.72)
    lod1 = decimated_copy(body, "LOD1", 0.38)
    lod2 = decimated_copy(body, "LOD2", 0.16)
    atlas = remote_atlas()
    for lod in (lod0, lod1, lod2):
        collapse_to_remote_atlas(lod, atlas)
        parent_keep_world(lod, root)
        lod.hide_render = True
    for name, part in moving.items():
        part.name = name
        collapse_to_remote_atlas(part, atlas)
        parent_keep_world(part, root)
    for name, point in sockets.items():
        empty(name, point, root)
    missing = set(COMMON_SOCKETS) - set(sockets)
    if missing:
        raise RuntimeError(f"{key}: missing sockets {sorted(missing)}")
    root["authoring"] = "direct-hard-surface-rebuild"
    root["forward"] = "+Z"
    root["up"] = "+Y"
    root["units"] = "metres"
    meshes = [body, lod0, lod1, lod2, *moving.values()]
    return root, meshes, moving, sockets, length, mechanism_motions


def export_glb(path: Path, root):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True, export_yup=True,
        export_animations=True, export_normals=True, export_texcoords=True,
        export_materials="EXPORT", export_apply=True, export_extras=True,
    )


def main():
    options = args()
    require_absolute(options)
    plan = planned_paths(options, BUILDERS, MOTIONS)
    options.evidence.mkdir(parents=True, exist_ok=True)
    plan_path = options.evidence / "planned-paths.json"
    if options.dry_run:
        plan_path.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf8")
        print(json.dumps({"dryRun": True, "plan": str(plan_path), "weapons": len(plan["candidates"])}))
        return
    if not plan_path.exists() or json.loads(plan_path.read_text(encoding="utf8")) != plan:
        raise RuntimeError("planned-paths.json missing or does not match current absolute path plan")
    results = []
    keys = (options.asset_key,) if options.asset_key else BUILDERS
    for key in keys:
        raw = options.raw_root / key / "preview.glb"
        if sha(raw) != RAW_SHA[key]:
            raise RuntimeError(f"{key}: raw source hash mismatch")
        reset()
        imported = import_reference(raw)
        root, meshes, moving, sockets, length, mechanism_motions = build_weapon(key)
        target = options.output_root / key
        glb = target / "candidate.glb"
        export_glb(glb, root)
        blend = target / "source.blend"
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
        images = render_packet(target / "renders", length, sockets, moving)
        metadata = {
            "schemaVersion": 1, "assetKey": key, "status": "production_candidate_pending_review",
            "runtimeAccepted": False, "heroAccepted": False,
            "source": {"kind": "rejected-provider-dimensional-reference", "path": str(raw), "sha256": RAW_SHA[key],
                       "geometryRetainedInExport": False, "referenceObjectsInBlend": len(imported)},
            "correction": "direct-authored receiver/barrel/stock-controls/sights/mechanical rebuild",
            "coordinateSystem": {"units": "metres", "up": "+Y", "forward": "+Z", "origin": "grip_r"},
            "output": {"path": str(glb), "sha256": sha(glb), "bytes": glb.stat().st_size,
                       "blendPath": str(blend), "blendSha256": sha(blend)},
            "triangles": {obj.name: triangle_count(obj) for obj in meshes},
            "drawGroups": {"fpBody": len(meshes[0].material_slots), "remoteBodyPerLod": 1, "mechanisms": len(moving), "remoteSteadyMaximum": 1 + len(moving)},
            "movingParts": sorted(moving), "sockets": sockets, "bounds": dimensions(meshes),
            "mechanismMotions": mechanism_motions, "renders": images,
        }
        metadata_path = target / "metadata.json"
        metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf8")
        results.append(metadata)
    report = {"schemaVersion": 1, "scope": "Task8 production candidates", "runtimeAccepted": False,
              "heroAccepted": False, "results": results}
    report_path = options.evidence / "builder-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"report": str(report_path), "weapons": len(results)}))


if __name__ == "__main__":
    main()



