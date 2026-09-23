# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# Blender 4.5 --background --python test/test_ww1_body.py
from __future__ import annotations

import sys
import unittest
from collections import Counter
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from ww1_soldier_geometry import uniform_body_geometry


class UniformSurfaceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / "public/assets/models/player.glb"))
        cls.rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
        mat = bpy.data.materials.new("test-cloth")
        cls.parts = uniform_body_geometry(cls.rig, dict.fromkeys(
            ("wool", "collar", "leather"), mat))
        for part in cls.parts:
            part.parent = cls.rig
            modifier = part.modifiers.new("test-skin", "ARMATURE")
            modifier.object = cls.rig

    def test_tunic_has_one_continuous_surface_across_spine(self) -> None:
        tunic = next((obj for obj in self.parts if obj.name == "uniform-tunic"), None)
        self.assertIsNotNone(tunic, "The tunic must span pelvis through shoulders in one skin")
        self.assertEqual({group.name for group in tunic.vertex_groups},
                         {"Pelvis", "spine_01", "spine_02", "spine_03", "neck_01"})
        self.assertGreater(sum(len(vertex.groups) > 1 for vertex in tunic.data.vertices), 100)

    def test_each_limb_has_shared_vertices_across_its_joint(self) -> None:
        for side in ("L", "R"):
            for kind, names in (("sleeve", (f"UpperArm_{side}", f"lowerarm_{side.lower()}")),
                                ("trouser", (f"Thigh_{side}", f"calf_{side.lower()}"))):
                with self.subTest(side=side, kind=kind):
                    limb = next((obj for obj in self.parts if obj.name == f"uniform-{kind}-{side}"), None)
                    self.assertIsNotNone(limb, "Separate shortened cylinders expose joint gaps")
                    expected = {*names, f"clavicle_{side.lower()}"} if kind == "sleeve" else set(names)
                    self.assertEqual({group.name for group in limb.vertex_groups}, expected)
                    self.assertGreater(sum(len(vertex.groups) == 2 for vertex in limb.data.vertices), 20)

    def test_main_cloth_surfaces_are_closed_and_consistently_wound(self) -> None:
        surfaces = [obj for obj in self.parts if obj.name == "uniform-tunic"
                    or obj.name.startswith(("uniform-sleeve-", "uniform-trouser-"))]
        self.assertEqual(len(surfaces), 5)
        for obj in surfaces:
            with self.subTest(mesh=obj.name):
                edges = Counter((a, b) for face in obj.data.polygons
                                for a, b in zip(face.vertices, (*face.vertices[1:], face.vertices[0])))
                self.assertTrue(all(count == 1 and edges[b, a] == 1
                                    for (a, b), count in edges.items()))
                self.assertTrue(all(abs(sum(g.weight for g in vertex.groups) - 1) < 1e-6
                                    for vertex in obj.data.vertices))

    def test_sleeves_reach_the_wrist_without_changing_hand_geometry(self) -> None:
        for side in ("L", "R"):
            sleeve = next((obj for obj in self.parts if obj.name == f"uniform-sleeve-{side}"), None)
            self.assertIsNotNone(sleeve)
            wrist = self.rig.data.bones[f"Hand_{side}"].head_local
            closest = min((vertex.co - wrist).length for vertex in sleeve.data.vertices)
            self.assertLess(closest, .05)
            self.assertTrue(any(obj.name == f"uniform-palm-Hand_{side}" for obj in self.parts))

    def test_sleeve_roots_are_seated_inside_the_tunic_shoulder(self) -> None:
        for side in ("L", "R"):
            sleeve = next(obj for obj in self.parts if obj.name == f"uniform-sleeve-{side}")
            root = sleeve.vertex_groups.get(f"clavicle_{side.lower()}")
            self.assertIsNotNone(root, "The shoulder root must follow its clavicle")
            seated = [vertex.co for vertex in sleeve.data.vertices
                      if any(group.group == root.index and group.weight > .999
                             for group in vertex.groups)]
            self.assertGreater(len(seated), 15)
            self.assertLess(max(abs(point.x) for point in seated), .10)
            self.assertLess(max(point.z for point in seated), 1.46)

    def test_upper_sleeve_follows_arm_beyond_the_shoulder_joint(self) -> None:
        for side in ("L", "R"):
            sleeve = next(obj for obj in self.parts if obj.name == f"uniform-sleeve-{side}")
            shoulder = self.rig.data.bones[f"UpperArm_{side}"].head_local
            elbow = self.rig.data.bones[f"lowerarm_{side.lower()}"].head_local
            direction = (elbow - shoulder).normalized()
            clavicle = sleeve.vertex_groups[f"clavicle_{side.lower()}"]
            outer = [vertex for vertex in sleeve.data.vertices
                     if (vertex.co - shoulder).dot(direction) > .03]
            self.assertGreater(len(outer), 100)
            self.assertFalse(any(group.group == clavicle.index and group.weight > 1e-6
                                 for vertex in outer for group in vertex.groups),
                             "Clavicle influence beyond the upper-arm joint folds the sleeve back onto the chest")

    def test_neck_is_one_surface_blended_from_collar_to_skull(self) -> None:
        neck = next((obj for obj in self.parts if obj.name == "uniform-neck"), None)
        self.assertIsNotNone(neck)
        self.assertEqual({group.name for group in neck.vertex_groups}, {"spine_03", "neck_01", "head"},
                         "A rigid neck cylinder shears at the collar and jaw")
        self.assertGreater(sum(len(vertex.groups) == 2 for vertex in neck.data.vertices), 20)

    def test_each_finger_is_one_continuous_tapered_surface(self) -> None:
        self.assertFalse(any(obj.name.startswith("uniform-tip-") for obj in self.parts),
                         "Sphere knuckles on cylinders read as beads, not fingers")
        for side in ("l", "r"):
            for family in ("thumb", "indexFinger", "finger"):
                with self.subTest(side=side, family=family):
                    finger = next((obj for obj in self.parts if obj.name == f"uniform-{family}-{side}"), None)
                    self.assertIsNotNone(finger)
                    self.assertEqual({group.name for group in finger.vertex_groups},
                                     {f"Hand_{side.upper()}", *(f"{family}_{n:02d}_{side}" for n in (1, 2, 3))})
                    self.assertGreater(sum(len(vertex.groups) == 2 for vertex in finger.data.vertices), 15)
                    edges = Counter((a, b) for face in finger.data.polygons
                                    for a, b in zip(face.vertices, (*face.vertices[1:], face.vertices[0])))
                    self.assertTrue(all(count == 1 and edges[b, a] == 1 for (a, b), count in edges.items()))
                    root = self.rig.data.bones[f"{family}_01_{side}"].head_local
                    tip = max((vertex.co - root).length for vertex in finger.data.vertices)
                    self.assertGreater(tip, .045, "The finger must reach past its last knuckle")

    def test_boots_have_level_soles_and_a_forward_toe(self) -> None:
        for side in ("L", "R"):
            boot = next((obj for obj in self.parts if obj.name == f"uniform-boot-{side}"), None)
            self.assertIsNotNone(boot, "A foot requires a sole and toe, not a tilted ankle cylinder")
            sole = [vertex.co for vertex in boot.data.vertices if vertex.co.z < -.018]
            self.assertGreater(len(sole), 15)
            self.assertLess(max(vertex.z for vertex in sole) - min(vertex.z for vertex in sole), .002)
            self.assertGreater(-min(vertex.co.y for vertex in boot.data.vertices), .125)

    def test_sleeve_root_caps_remain_inside_tunic_during_rifle_holds(self) -> None:
        tunic = next(obj for obj in self.parts if obj.name == "uniform-tunic")
        for clip, phase in (("rifle_idle", .5), ("rifle_run", .2), ("rifle_run", .5),
                            ("rifle_run", .8), ("rifle_crouch_idle", .5)):
            action = bpy.data.actions[clip]
            self.rig.animation_data.action = action
            self.rig.animation_data.action_slot = action.slots[0]
            frame = action.frame_range[0] + phase * (action.frame_range[1] - action.frame_range[0])
            bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
            graph = bpy.context.evaluated_depsgraph_get()
            torso = tunic.evaluated_get(graph)
            mesh = torso.to_mesh()
            tree = BVHTree.FromPolygons([tunic.matrix_world @ vertex.co for vertex in mesh.vertices],
                                       [tuple(face.vertices) for face in mesh.polygons])
            torso.to_mesh_clear()
            for side in ("L", "R"):
                sleeve = next(obj for obj in self.parts if obj.name == f"uniform-sleeve-{side}")
                root_indices = [vertex.index for vertex in sleeve.data.vertices if abs(vertex.co.x) < .10]
                self.assertGreater(len(root_indices), 15)
                evaluated = sleeve.evaluated_get(graph)
                surface = evaluated.to_mesh()
                exposed = []
                for index in root_indices:
                    point = sleeve.matrix_world @ surface.vertices[index].co
                    nearest, normal, _, _ = tree.find_nearest(point)
                    exposed.append((point - nearest).dot(normal))
                evaluated.to_mesh_clear()
                with self.subTest(clip=clip, phase=phase, side=side):
                    self.assertLessEqual(max(exposed), 0.00001, "The inner sleeve cap protrudes through the tunic")


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(UniformSurfaceTest))
    if not result.wasSuccessful():
        raise SystemExit(1)
