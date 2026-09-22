from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix


COMMON_CLIPS = ("crouch_idle", "crouch_walk", "death", "hit_chest", "hit_head", "idle", "run", "sprint", "walk")
HOLD_PREFIXES = ("rifle", "smg", "shotgun", "sniper", "pistol")
HOLD_STATES = ("idle", "walk", "run", "sprint", "crouch_idle", "crouch_walk", "strafe_left",
               "strafe_right", "backpedal", "crouch_left", "crouch_right")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--clips", choices=("common", "all"), default="common")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def import_glb(path: Path) -> tuple[object, list[object], set[object]]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    imported = set(bpy.context.scene.objects) - before
    rigs = [obj for obj in imported if obj.type == "ARMATURE"]
    if len(rigs) != 1:
        raise RuntimeError(f"{path} requires one armature, found {len(rigs)}")
    return rigs[0], [obj for obj in imported if obj.type == "MESH"], imported


def clip_names(mode: str) -> tuple[str, ...]:
    if mode == "common":
        return COMMON_CLIPS
    return COMMON_CLIPS + tuple(f"{prefix}_{state}" for prefix in HOLD_PREFIXES for state in HOLD_STATES)


def action_frames(action) -> list[float]:
    start, end = (int(action.frame_range[0]), int(action.frame_range[1]))
    return [float(frame) for frame in range(start, end + 1)]


def local_rest_matrix(bone) -> Matrix:
    return bone.parent.matrix_local.inverted_safe() @ bone.matrix_local if bone.parent else bone.matrix_local.copy()


def rest_delta(source_rig, target_rig) -> float:
    maximum = 0.0
    for bone in target_rig.data.bones:
        source = source_rig.data.bones.get(bone.name)
        if source is None:
            continue
        delta = local_rest_matrix(bone).inverted_safe() @ local_rest_matrix(source)
        maximum = max(maximum, max(abs(delta[row][column] - (1.0 if row == column else 0.0))
                                   for row in range(4) for column in range(4)))
    return maximum


def retarget_pose_matrix(source_pose, source_rest, target_pose, target_rest, root_scale: float) -> Matrix:
    source_rest_local = local_rest_matrix(source_rest)
    source_pose_local = (source_pose.parent.matrix.inverted_safe() @ source_pose.matrix
                         if source_pose.parent else source_pose.matrix.copy())
    target_rest_local = local_rest_matrix(target_rest)
    pose_local = target_rest_local @ source_rest_local.inverted_safe() @ source_pose_local
    pose_local.translation = target_rest_local.translation + (
        source_pose_local.translation - source_rest_local.translation) * root_scale
    return target_pose.parent.matrix @ pose_local if target_pose.parent else pose_local


def retarget_action(source_rig, target_rig, source_action, target_action) -> dict[str, object]:
    source_bones = source_rig.data.bones
    target_bones = target_rig.data.bones
    names = [bone.name for bone in target_bones if bone.name in source_bones]
    missing = sorted(bone.name for bone in target_bones if bone.name not in source_bones and bone.name != "neutral_bone")
    if missing:
        raise RuntimeError(f"source missing target joints: {missing}")
    frames = action_frames(source_action)
    source_rig.animation_data_create()
    target_rig.animation_data_create()
    source_rig.animation_data.action = source_action
    target_rig.animation_data.action = target_action
    source_height = max(0.001, source_bones["Pelvis"].matrix_local.translation.z)
    root_scale = target_bones["Pelvis"].matrix_local.translation.z / source_height
    for frame in frames:
        bpy.context.scene.frame_set(int(frame), subframe=frame % 1)
        for name in names:
            source_pose = source_rig.pose.bones[name]
            target_pose = target_rig.pose.bones[name]
            target_pose.rotation_mode = "QUATERNION"
            target_pose.matrix = retarget_pose_matrix(source_pose, source_bones[name], target_pose,
                                                       target_bones[name], root_scale)
            target_pose.keyframe_insert("location", frame=frame, group=name)
            target_pose.keyframe_insert("rotation_quaternion", frame=frame, group=name)
            target_pose.keyframe_insert("scale", frame=frame, group=name)
    target_action.use_fake_user = True
    return {"name": source_action.name, "frames": len(frames), "start": frames[0], "end": frames[-1]}


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def main() -> None:
    args = arguments()
    if "4.5" not in bpy.app.version_string:
        raise RuntimeError(f"Blender 4.5 required, got {bpy.app.version_string}")
    clear()
    source_metadata = args.target.with_suffix(".meta.json")
    metadata = json.loads(source_metadata.read_text(encoding="utf-8")) if source_metadata.exists() else None
    target_rig, target_meshes, target_objects = import_glb(args.target)
    source_rig, _, source_objects = import_glb(args.source)
    source_actions = {action.name: action for action in bpy.data.actions}
    required = clip_names(args.clips)
    missing = [name for name in required if name not in source_actions]
    if missing:
        raise RuntimeError(f"source clips missing: {missing}")
    maximum_rest_delta = rest_delta(source_rig, target_rig)
    reports = []
    target_actions = []
    for name in required:
        action = bpy.data.actions.new(name=f"retarget-{name}")
        target_actions.append((name, action))
        reports.append(retarget_action(source_rig, target_rig, source_actions[name], action))
    source_rig.animation_data_clear()
    target_rig.animation_data.action = None
    for pose_bone in target_rig.pose.bones:
        pose_bone.matrix_basis.identity()
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    for obj in source_objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in source_actions.values():
        bpy.data.actions.remove(action)
    for name, action in target_actions:
        action.name = name
    bpy.ops.object.select_all(action="DESELECT")
    target_rig.select_set(True)
    for mesh in target_meshes:
        mesh.select_set(True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB", use_selection=True,
                              export_skins=True, export_animations=True, export_animation_mode="ACTIONS", export_yup=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    report = {"schemaVersion": 2, "method": "local-rest-space-conjugation", "mode": args.clips,
              "source": str(args.source.resolve()), "sourceSha256": sha256(args.source),
              "target": str(args.target.resolve()), "targetSha256": sha256(args.target),
              "output": str(args.output.resolve()), "outputSha256": sha256(args.output),
              "jointCount": len(target_rig.data.bones), "maximumLocalRestDelta": maximum_rest_delta,
              "clips": reports, "clipCount": len(reports)}
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if args.metadata is not None:
        if metadata is None:
            raise RuntimeError(f"target metadata missing: {source_metadata}")
        metadata.update({"outputSha256": report["outputSha256"], "bytes": args.output.stat().st_size,
                         "animationSourcePath": str(args.source.resolve()),
                         "animationSourceSha256": report["sourceSha256"], "animationClipCount": len(reports),
                         "animationRetargetMethod": report["method"],
                         "retargetScriptSha256": sha256(Path(__file__).resolve())})
        args.metadata.parent.mkdir(parents=True, exist_ok=True)
        args.metadata.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


main()
