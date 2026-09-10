"""Bake an original Meshy radio's albedo into vertex colours for one skinned draw.

Blender 4.5 --background --python tools/bake-radio-colors.py -- --input <shrunk.glb> --output <radio.glb>
Run shrink-glb.py --size 512 --webp on the original download first. No purchased
geometry is read or written; the client fits this prop to its existing skeleton.
"""
import argparse, sys
from pathlib import Path
import bpy

p = argparse.ArgumentParser()
p.add_argument('--input', required=True)
p.add_argument('--output', required=True)
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
scene.render.bake.target = 'VERTEX_COLORS'
scene.view_settings.view_transform = 'Standard'
meshes = [o for o in scene.objects if o.type == 'MESH']
for obj in meshes:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    color = obj.data.color_attributes.new(name='FieldAlbedo', type='FLOAT_COLOR', domain='CORNER')
    obj.data.color_attributes.active_color = color
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    for other in list(obj.data.color_attributes):
        if other.name != color.name:
            obj.data.color_attributes.remove(other)
    assert min(v.color[0] for v in color.data) < .5, 'Albedo bake is empty/white'
    obj.data.materials.clear()
    mat = bpy.data.materials.new('Field radio / vertex albedo')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = .92
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = color.name
    mat.node_tree.links.new(vertex.outputs['Color'], bsdf.inputs['Base Color'])
    obj.data.materials.append(mat)
out = Path(args.output).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_animations=False,
    export_cameras=False, export_lights=False, export_yup=True, export_all_vertex_colors=True)
print({'bytes': out.stat().st_size, 'meshes': len(meshes), 'textures': 0})
