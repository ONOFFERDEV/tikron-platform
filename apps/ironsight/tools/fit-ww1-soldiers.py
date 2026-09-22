from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ww1_soldier_geometry import kit_geometry, uniform_body_geometry


JOINTS = (
    "Pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head", "eyes", "eyebrows",
    "clavicle_l", "UpperArm_L", "lowerarm_l", "Hand_L", "thumb_01_l", "thumb_02_l", "thumb_03_l",
    "indexFinger_01_l", "indexFinger_02_l", "indexFinger_03_l", "indexFinger_04_l", "finger_01_l",
    "finger_02_l", "finger_03_l", "finger_04_l", "clavicle_r", "UpperArm_R", "lowerarm_r", "Hand_R",
    "thumb_01_r", "thumb_02_r", "thumb_03_r", "indexFinger_01_r", "indexFinger_02_r",
    "indexFinger_03_r", "indexFinger_04_r", "finger_01_r", "finger_02_r", "finger_03_r", "finger_04_r",
    "Thigh_R", "calf_r", "Foot_R", "ball_r", "toes_r", "Thigh_L", "calf_l", "Foot_L", "ball_l",
    "toes_l", "ik_foot_root", "ik_foot_l", "ik_foot_r", "ik_hand_root", "ik_hand_gun", "ik_hand_l",
    "ik_hand_r",
)

def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--rig-source", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clear() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.data.orphans_purge(do_recursive=True)


def material(name: str, color: tuple[float, float, float, float], metal: float = 0.0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.metallic = metal
    result.roughness = 0.88 if metal == 0 else 0.62
    return result


def bone_positions() -> dict[str, tuple[float, float, float]]:
    result = {name: (0.0, 1.0, 0.0) for name in JOINTS}
    result.update({"Pelvis": (0, 0.93, 0), "spine_01": (0, 1.08, 0), "spine_02": (0, 1.27, 0),
                   "spine_03": (0, 1.43, 0), "neck_01": (0, 1.54, 0), "head": (0, 1.63, 0),
                   "eyes": (0, 1.67, 0.09), "eyebrows": (0, 1.7, 0.085), "ik_foot_root": (0, 0, 0),
                   "ik_hand_root": (0, 0.95, 0), "ik_hand_gun": (0, 1.15, 0.2)})
    for side, sign in (("l", 1), ("r", -1)):
        upper = "UpperArm_L" if side == "l" else "UpperArm_R"
        hand = "Hand_L" if side == "l" else "Hand_R"
        thigh = "Thigh_L" if side == "l" else "Thigh_R"
        foot = "Foot_L" if side == "l" else "Foot_R"
        result.update({f"clavicle_{side}": (0.12 * sign, 1.47, 0), upper: (0.25 * sign, 1.43, 0),
                       f"lowerarm_{side}": (0.48 * sign, 1.25, 0), hand: (0.64 * sign, 1.08, 0),
                       thigh: (0.11 * sign, 0.9, 0), f"calf_{side}": (0.11 * sign, 0.5, 0),
                       foot: (0.11 * sign, 0.12, 0.04), f"ball_{side}": (0.11 * sign, 0.04, 0.13),
                       f"toes_{side}": (0.11 * sign, 0.03, 0.22), f"ik_foot_{side}": (0.11 * sign, 0.04, 0.08),
                       f"ik_hand_{side}": (0.64 * sign, 1.08, 0)})
        for family in ("thumb", "indexFinger", "finger"):
            count = 3 if family == "thumb" else 4
            for number in range(1, count + 1):
                result[f"{family}_{number:02d}_{side}"] = (sign * (0.64 + 0.025 * number), 1.08, 0.015 * number)
    return result


def bone_parent(name: str) -> str | None:
    fixed = {
        "spine_01": "Pelvis", "spine_02": "spine_01", "spine_03": "spine_02", "neck_01": "spine_03",
        "head": "neck_01", "eyes": "head", "eyebrows": "head", "clavicle_l": "spine_03",
        "UpperArm_L": "clavicle_l", "lowerarm_l": "UpperArm_L", "Hand_L": "lowerarm_l",
        "clavicle_r": "spine_03", "UpperArm_R": "clavicle_r", "lowerarm_r": "UpperArm_R",
        "Hand_R": "lowerarm_r", "Thigh_L": "Pelvis", "calf_l": "Thigh_L", "Foot_L": "calf_l",
        "ball_l": "Foot_L", "toes_l": "ball_l", "Thigh_R": "Pelvis", "calf_r": "Thigh_R",
        "Foot_R": "calf_r", "ball_r": "Foot_R", "toes_r": "ball_r", "ik_foot_l": "ik_foot_root",
        "ik_foot_root": "Pelvis", "ik_foot_l": "ik_foot_root", "ik_foot_r": "ik_foot_root",
        "ik_hand_root": "Pelvis", "ik_hand_gun": "ik_hand_root", "ik_hand_l": "ik_hand_root",
        "ik_hand_r": "ik_hand_root",
    }
    if name in fixed:
        return fixed[name]
    for side in ("l", "r"):
        hand = "Hand_L" if side == "l" else "Hand_R"
        for family in ("thumb", "indexFinger", "finger"):
            count = 3 if family == "thumb" else 4
            for number in range(1, count + 1):
                joint = f"{family}_{number:02d}_{side}"
                if name == joint:
                    return hand if number == 1 else f"{family}_{number - 1:02d}_{side}"
    return None


def join_and_skin(body, parts: list[object], rig, lod: str, ratio: float):
    for modifier in list(body.modifiers):
        if modifier.type == "ARMATURE":
            body.modifiers.remove(modifier)
    if ratio < 0.999:
        decimate = body.modifiers.new(f"{lod}-decimate", "DECIMATE")
        decimate.ratio = ratio
        bpy.context.view_layer.objects.active = body
        body.select_set(True)
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    for part in parts:
        if part.vertex_groups:
            continue
        name = part.name.lower()
        if "helmet" in name:
            joint = "head"
        elif "collar" in name or "webbing" in name or "shoulder" in name:
            joint = "spine_03"
        elif "pack" in name:
            joint = "spine_02"
        else:
            joint = "Pelvis"
        group = part.vertex_groups.new(name=joint)
        group.add(range(len(part.data.vertices)), 1.0, "REPLACE")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [body, *parts]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = lod
    if lod == "LOD2":
        distance_decimate = body.modifiers.new("LOD2-distance-decimate", "DECIMATE")
        distance_decimate.ratio = 0.60
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=distance_decimate.name)
    body.parent = rig
    modifier = body.modifiers.new("humanoid-skin", "ARMATURE")
    modifier.object = rig
    return body


def make_faction(source, rig_source: Path, faction: str, output: Path, source_hash: str) -> dict[str, object]:
    clear()
    palette = ((0.34, 0.31, 0.19, 1), (0.23, 0.27, 0.22, 1)) if faction == "khaki" else ((0.25, 0.29, 0.27, 1), (0.18, 0.20, 0.16, 1))
    field_kit = material(f"{faction}-field-kit", palette[1])
    mats = {"wool": material(f"{faction}-wool", palette[0]), "canvas": field_kit,
            "leather": field_kit, "blanket": field_kit,
            "steel": material(f"{faction}-helmet", (0.20, 0.22, 0.17, 1), 0.35), "collar": field_kit}
    bpy.ops.import_scene.gltf(filepath=str(rig_source.resolve()))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    imported = max((obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
                   key=lambda obj: len(obj.data.vertices))
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH" and obj != imported:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.objects.remove(imported, do_unlink=True)
    meshes = []
    for lod, ratio in (("LOD0", 1.0), ("LOD1", 0.55), ("LOD2", 0.25)):
        uniform = uniform_body_geometry(rig, mats)
        body, parts = uniform[0], [*uniform[1:], *kit_geometry(faction, mats)]
        meshes.append(join_and_skin(body, parts, rig, lod, ratio))
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True, export_skins=True,
                              export_animations=True, export_animation_mode="ACTIONS", export_yup=True)
    parents = {name: bone_parent(name) for name in JOINTS}
    return {"faction": faction, "sourceSha256": source_hash, "outputSha256": sha256(output),
            "bytes": output.stat().st_size, "lodTriangles": {mesh.name: len(mesh.data.polygons) for mesh in meshes},
            "jointParents": parents}


def main() -> None:
    args = arguments()
    if "4.5" not in bpy.app.version_string:
        raise RuntimeError(f"Blender 4.5 required, got {bpy.app.version_string}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    source = args.input.resolve()
    source_hash = sha256(args.rig_source.resolve())
    reports = [make_faction(source, args.rig_source, faction, args.output_dir / f"soldier-{faction}.glb", source_hash)
               for faction in ("khaki", "fieldgrey")]
    script_hash = sha256(Path(__file__).resolve())
    geometry_script_hash = sha256(Path(__file__).with_name("ww1_soldier_geometry.py").resolve())
    for report in reports:
        metadata = {"schemaVersion": 1, "assetKey": f"soldier-{report['faction']}", "role": "hero-character",
                    "sourceKind": "licensed-derived", "sourcePath": str(args.rig_source.resolve()),
                    "sourceSha256": source_hash, "outputSha256": report["outputSha256"], "scriptSha256": script_hash,
                    "geometryScriptSha256": geometry_script_hash,
                    "derivativeDescription": "Synty humanoid rig and 64 animations with original authored low-poly WW1 body, helmet, and field kit",
                    "visualReferencePath": str(source), "visualReferenceSha256": sha256(source),
                    "exporter": f"Blender {bpy.app.version_string}", "coordinateSystem": {"up": "+Y", "forward": "+Z", "units": "metres"},
                    "skeleton": "ironsight-humanoid-55", "requiredJoints": list(JOINTS), "equipmentHitTarget": False,
                    "jointParents": report["jointParents"], "lodTriangles": report["lodTriangles"], "bytes": report["bytes"]}
        meta_path = args.output_dir / f"soldier-{report['faction']}.meta.json"
        meta_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    (args.evidence_dir / "fit-report.json").write_text(json.dumps({"schemaVersion": 1, "reports": reports}, indent=2) + "\n", encoding="utf-8")


main()
