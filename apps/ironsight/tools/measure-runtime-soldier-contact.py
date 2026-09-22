import json
import sys
from pathlib import Path

from mathutils import Vector
from mathutils.bvhtree import BVHTree


def mesh(surface):
    vertices = [Vector(surface["vertices"][index:index + 3])
                for index in range(0, len(surface["vertices"]), 3)]
    indices = surface["indices"]
    source_faces = [tuple(indices[index:index + 3]) for index in range(0, len(indices), 3)]
    faces = [face for face in source_faces if (vertices[face[1]] - vertices[face[0]]).cross(
        vertices[face[2]] - vertices[face[0]]).length_squared > 1e-16]
    return vertices, faces, len(source_faces) - len(faces)


def combined_weapon(surfaces):
    vertices = []
    faces = []
    names = []
    degenerate = 0
    for surface in surfaces:
        source_vertices, source_faces, source_degenerate = mesh(surface)
        offset = len(vertices)
        vertices.extend(source_vertices)
        faces.extend(tuple(offset + value for value in face) for face in source_faces)
        names.extend([surface.get("path") or surface["name"]] * len(source_faces))
        degenerate += source_degenerate
    return vertices, faces, names, degenerate


def nearest(source_vertices, source_faces, target_bvh, target_names=None):
    best = None
    for face in source_faces:
        normal = (source_vertices[face[1]] - source_vertices[face[0]]).cross(
            source_vertices[face[2]] - source_vertices[face[0]]).normalized()
        for index in face:
            found = target_bvh.find_nearest(source_vertices[index])
            if found is None or best is not None and found[3] >= best["gapM"]:
                continue
            if found[1] is None:
                continue
            target_normal = found[1].normalized()
            best = {
                "gapM": found[3],
                "sourcePoint": list(source_vertices[index]),
                "targetPoint": list(found[0]),
                "normalDot": normal.dot(target_normal),
                "targetNode": target_names[found[2]] if target_names else None,
            }
    return best


def surface_result(surface, weapon_vertices, weapon_faces, weapon_names, weapon_bvh):
    vertices, faces, degenerate = mesh(surface)
    if not faces:
        raise ValueError("hand surface has no non-degenerate triangles")
    hand_bvh = BVHTree.FromPolygons(vertices, faces, all_triangles=True)
    forward = nearest(vertices, faces, weapon_bvh, weapon_names)
    reverse = nearest(weapon_vertices, weapon_faces, hand_bvh)
    if forward is None or reverse is None:
        raise ValueError("surface has no valid nearest triangle result")
    closest = forward if forward["gapM"] <= reverse["gapM"] else {
        "gapM": reverse["gapM"],
        "sourcePoint": reverse["targetPoint"],
        "targetPoint": reverse["sourcePoint"],
        "normalDot": reverse["normalDot"],
        "targetNode": forward["targetNode"],
    }
    return {
        "triangles": len(faces),
        "degenerateTrianglesExcluded": degenerate,
        "minimumGapM": closest["gapM"],
        "overlapTriangles": len(hand_bvh.overlap(weapon_bvh)),
        "handPoint": closest["sourcePoint"],
        "weaponPoint": closest["targetPoint"],
        "surfaceNormalDot": closest["normalDot"],
        "weaponNode": closest["targetNode"],
    }, hand_bvh


def measure_sample(sample):
    weapon_vertices, weapon_faces, weapon_names, weapon_degenerate = combined_weapon(sample["weaponSurfaces"])
    if not weapon_faces:
        raise ValueError("weapon surface has no non-degenerate triangles")
    weapon_bvh = BVHTree.FromPolygons(weapon_vertices, weapon_faces, all_triangles=True)
    sides = {}
    hand_bvhs = {}
    for side, surfaces in sample["handSurfaces"].items():
        groups = {}
        empty_groups = []
        for name, surface in surfaces.items():
            _, faces, _ = mesh(surface)
            if not faces:
                empty_groups.append(name)
                continue
            groups[name], hand_bvhs[(side, name)] = surface_result(
                surface, weapon_vertices, weapon_faces, weapon_names, weapon_bvh)
        index_name = "indexFinger" if "indexFinger" in groups else "index"
        other_names = [name for name in ("finger", "middle", "ring", "little") if name in groups]
        if "thumb" not in groups or index_name not in groups or not other_names:
            raise ValueError("hand surface lacks thumb, index, or opposing digit triangles")
        other_name = min(other_names, key=lambda name: groups[name]["minimumGapM"])
        thumb = Vector(groups["thumb"]["handPoint"])
        index_finger = Vector(groups[index_name]["handPoint"])
        other_finger = Vector(groups[other_name]["handPoint"])
        contact_names = ("thumb", index_name, other_name)
        sides[side] = {
            "groups": groups,
            "emptyGroupsExcluded": empty_groups,
            "contactGroups": list(contact_names),
            "thumbIndexSpanM": (thumb - index_finger).length,
            "thumbOtherFingerSpanM": (thumb - other_finger).length,
            "threeDigitTriangleContact": all(
                groups[name]["minimumGapM"] <= .006
                for name in contact_names),
            "palmTriangleContact": groups["palm"]["minimumGapM"] <= .008,
        }
    mutual_pairs = ({
        f"{name}:{other}": len(hand_bvhs[("l", name)].overlap(hand_bvhs[("r", other)]))
        for name in sides["l"]["groups"]
        for other in sides["r"]["groups"]
    } if "l" in sides and "r" in sides else {})
    return {
        "key": sample["key"],
        "hold": sample["hold"],
        "weaponNodes": sorted(set(weapon_names)),
        "weaponTriangles": len(weapon_faces),
        "weaponDegenerateTrianglesExcluded": weapon_degenerate,
        "sides": sides,
        "mutualHandOverlapTriangles": sum(mutual_pairs.values()),
        "mutualHandOverlapPairs": mutual_pairs,
    }


def main():
    separator = sys.argv.index("--")
    source_path = Path(sys.argv[separator + 1])
    output_path = Path(sys.argv[separator + 2])
    data = json.loads(source_path.read_text(encoding="utf-8"))
    samples = [measure_sample(sample) for sample in data["samples"]]
    output = {
        "schemaVersion": 1,
        "source": str(source_path),
        "sourceSoldier": data["soldier"],
        "signedVolumeClaim": False,
        "measurement": "unsigned post-skin triangle BVH proximity and intersection",
        "samples": samples,
    }
    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "samples": len(samples),
        "allThreeDigitContact": all(side["threeDigitTriangleContact"]
                                    for sample in samples for side in sample["sides"].values()),
        "allPalmContact": all(side["palmTriangleContact"]
                              for sample in samples for side in sample["sides"].values()),
        "mutualHandOverlapMax": max(sample["mutualHandOverlapTriangles"] for sample in samples),
    }))


if __name__ == "__main__":
    main()
