import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


COLORS = {
    "weapon": (0.32, 0.25, 0.14, 1),
    "body": (0.38, 0.19, 0.14, 1),
    "r-arm": (0.46, 0.18, 0.14, 1),
    "l-arm": (0.14, 0.34, 0.24, 1),
    "l-palm": (0.18, 0.55, 0.32, 1),
    "l-thumb": (0.15, 0.72, 0.72, 1),
    "l-index": (0.2, 0.46, 0.86, 1),
    "l-middle": (0.52, 0.32, 0.88, 1),
    "l-ring": (0.62, 0.42, 0.78, 1),
    "l-little": (0.72, 0.52, 0.68, 1),
    "r-palm": (0.72, 0.22, 0.16, 1),
    "r-thumb": (0.95, 0.55, 0.12, 1),
    "r-index": (0.88, 0.25, 0.48, 1),
    "r-middle": (0.72, 0.12, 0.72, 1),
    "r-ring": (0.82, 0.22, 0.62, 1),
    "r-little": (0.92, 0.32, 0.52, 1),
}


def clear():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def material(name):
    result = bpy.data.materials.new(name)
    result.diffuse_color = COLORS[name]
    return result


def add_surface(name, surface, mat, limit_centers=None):
    vertices = [surface["vertices"][index:index + 3]
                for index in range(0, len(surface["vertices"]), 3)]
    indices = surface["indices"]
    faces = []
    for index in range(0, len(indices), 3):
        face = tuple(indices[index:index + 3])
        if limit_centers:
            centre = sum((Vector(vertices[value]) for value in face), Vector()) / 3
            if min((centre - point).length for point in limit_centers) > .22:
                continue
        faces.append(face)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj


def centre_of(surface):
    values = surface["vertices"]
    points = [Vector(values[index:index + 3]) for index in range(0, len(values), 3)]
    return sum(points, Vector()) / len(points)


def render_sample(sample, output_dir, right_only=False, full_context=False):
    clear()
    mats = {name: material(name) for name in COLORS}
    sides = ("r",) if right_only else tuple(sample["handSurfaces"])
    palm_centres = [centre_of(sample["handSurfaces"][side]["palm"]) for side in sides]
    objects = []
    if full_context:
        objects.append(add_surface("body", sample["bodySurface"], mats["body"]))
        for surface in sample["weaponSurfaces"]:
            objects.append(add_surface(f"weapon-{surface['name']}", surface, mats["weapon"], palm_centres))
    else:
        for side, surface in sample.get("armSurfaces", {}).items():
            if side not in sides:
                continue
            objects.append(add_surface(f"{side}-arm", surface, mats[f"{side}-arm"]))
        for surface in sample["weaponSurfaces"]:
            objects.append(add_surface(f"weapon-{surface['name']}", surface, mats["weapon"], palm_centres))
        for side in sides:
            for group, surface in sample["handSurfaces"][side].items():
                objects.append(add_surface(f"{side}-{group}", surface, mats[f"{side}-{group}"]))
    points = [Vector(vertex.co) for obj in objects for vertex in obj.data.vertices]
    centre = sum(points, Vector()) / len(points)
    if full_context:
        centre.y += .3
    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 1.35 if full_context else .5
    light_data = bpy.data.lights.new("key", "AREA")
    light_data.energy = 900
    light_data.shape = "DISK"
    light_data.size = 4
    light = bpy.data.objects.new("key", light_data)
    light.location = centre + Vector((1.5, 2, 1.5))
    bpy.context.collection.objects.link(light)
    views = {
        "normal": Vector((1, 0, 0)),
        "wrist": Vector((0, 1, 0)),
        "tangent": Vector((0, 0, 1)),
    }
    for label, direction in views.items():
        camera.location = centre + direction * .7
        camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
        hold = sample.get("hold")
        stem = f"{sample['key']}-{hold}" if hold else sample["key"]
        bpy.context.scene.render.filepath = str(output_dir / f"{stem}-{label}.png")
        bpy.ops.render.render(write_still=True)


def main():
    separator = sys.argv.index("--")
    source = Path(sys.argv[separator + 1])
    output_dir = Path(sys.argv[separator + 2])
    arguments = sys.argv[separator + 3:]
    right_only = "right-only" in arguments
    full_context = "full-context" in arguments
    keys = set(arguments) - {"right-only", "full-context"}
    output_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    data = json.loads(source.read_text(encoding="utf-8"))
    samples = [sample for sample in data["samples"] if not keys or sample["key"] in keys]
    for sample in samples:
        render_sample(sample, output_dir, right_only, full_context)
    print(json.dumps({"samples": len(samples), "images": len(samples) * 3}))


if __name__ == "__main__":
    main()
