"""Keep the shrunk sandbag's albedo and geometry for the shared runtime atlas.

First run shrink-glb.py --size 512 --webp. No source texture is uploaded separately
at runtime; normals/metallic maps would only add unnecessary download bytes.
"""
import argparse
import sys
from pathlib import Path
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    # The generated hard split normals make soft canvas look like folded metal.
    # Average this single manifold prop only; never touch the architectural kit.
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.00001)
    bpy.ops.object.mode_set(mode='OBJECT')
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    nodes = material.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    for key in ['Normal', 'Metallic', 'Roughness']:
        for link in list(bsdf.inputs[key].links):
            material.node_tree.links.remove(link)
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Roughness'].default_value = .94
    # Strip the imported AO output, too; creases remain in the generated albedo.
    for node in list(nodes):
        if node.type == 'GROUP':
            nodes.remove(node)
output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
    export_image_format='WEBP', export_image_quality=85, export_yup=True,
    export_animations=False, export_cameras=False, export_lights=False)
print(f'[pack-field-sandbag] {output.stat().st_size} bytes')
