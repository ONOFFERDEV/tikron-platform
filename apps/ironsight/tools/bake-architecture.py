"""Blender 4.5, original procedural kit -> per-map AO GLB. No purchased inputs.
Run node tools/dump-architecture.mjs first; see assets/README.md.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--input', default='.inspect/architecture.json')
parser.add_argument('--size', type=int, default=1024)
parser.add_argument('--samples', type=int, default=64)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
app = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.world.light_settings.distance = 2.5
scene.render.bake.margin = 4
scene.render.bake.use_selected_to_active = False

for name, kit in json.loads(Path(args.input).read_text()).items():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    image = bpy.data.images.new(name + '-architecture-ao', args.size, args.size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    materials = []
    # glTF exporter recognizes this node group's Occlusion input.
    group = bpy.data.node_groups.new(name + ' glTF Material Output', 'ShaderNodeTree')
    group.name = 'glTF Material Output'
    group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    for i, source in enumerate(kit['materials']):
        mat = bpy.data.materials.new(f'{name}-{i}')
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*source['color'], 1)
        bsdf.inputs['Roughness'].default_value = source['roughness']
        bsdf.inputs['Metallic'].default_value = source['metalness']
        mat.use_backface_culling = not source['doubleSide']
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        mat.node_tree.nodes.active = tex
        output = mat.node_tree.nodes.new('ShaderNodeGroup')
        output.node_tree = group
        mat.node_tree.links.new(tex.outputs['Color'], output.inputs['Occlusion'])
        materials.append(mat)
    parts = []
    for i, part in enumerate(kit['meshes']):
        p = part['positions']
        vertices = [(p[j], -p[j+2], p[j+1]) for j in range(0, len(p), 3)]
        indices = part['indices']
        faces = [indices[j:j+3] for j in range(0, len(indices), 3)]
        # Zero-area dish-centre triangles have no surface and destabilize
        # Blender's custom-normal basis. Drop only mathematically degenerate faces.
        def area2(face):
            a, b, c = [vertices[k] for k in face]
            u = [b[k]-a[k] for k in range(3)]; v = [c[k]-a[k] for k in range(3)]
            return sum(x*x for x in (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]))
        faces = [f for f in faces if area2(f) >= 1e-16]
        mesh = bpy.data.meshes.new(f'part-{i}')
        mesh.from_pydata(vertices, [], faces)
        # Preserve authored winding and split normals exactly. Recalculating
        # disconnected/overlapping kit parts can invert thin boundary faces.
        for polygon in mesh.polygons: polygon.use_smooth = True
        normals = part['normals']
        mesh.normals_split_custom_set_from_vertices([(normals[j], -normals[j+2], normals[j+1])
            for j in range(0, len(normals), 3)])
        obj = bpy.data.objects.new(f'part-{i}', mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(materials[part['material']])
        parts.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    kit_object = bpy.context.object
    kit_object.name = name + '-original-architecture'
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.0015)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Floor is an occluder only; not part of the exported architecture.
    bpy.ops.mesh.primitive_plane_add(size=220, location=(30, -20, -0.012))
    floor = bpy.context.object
    floor.select_set(False)
    kit_object.select_set(True)
    bpy.context.view_layer.objects.active = kit_object
    bpy.ops.object.bake(type='AO')
    out = app / 'public/assets/maps' / (name + '-architecture.glb')
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True,
        export_texcoords=True, export_normals=True, export_materials='EXPORT',
        export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    print(f'[architecture] {name}: {len(kit_object.data.polygons)} triangles, {out.stat().st_size} bytes')
