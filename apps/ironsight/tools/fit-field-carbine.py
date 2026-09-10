"""Fit the generated carbine to the existing +Z bore / grip-space convention.

Blender 4.5 --background --python tools/fit-field-carbine.py --
  --input <512px shrunk.glb> --output public/assets/weapons/field-carbine.glb
Only the generated prop is read. No purchased geometry or animation is exported.
"""
import argparse
import json
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
source = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
source.data.transform(source.matrix_world)
source.matrix_world = Matrix.Identity(4)
material = source.data.materials[0]
# Two shared 512px images (albedo + packed roughness/metallic). The generated
# normal map is omitted deliberately to retain the 32-texture stress ceiling.
bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
for link in list(bsdf.inputs['Normal'].links):
    material.node_tree.links.remove(link)
material.name = 'field-carbine-parkerised-steel'

bm = bmesh.new()
bm.from_mesh(source.data)
# Remove the uneven generated front sight. The original open reflex frame is
# the aiming reference; a fused post above it would obscure the centre ray.
bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
    plane_co=(0,0,.213), plane_no=(0,0,1), dist=1e-6)
post=[f for f in bm.faces if f.calc_center_median().x<-.20 and all(v.co.z>=.212999 for v in f.verts)]
bmesh.ops.delete(bm,geom=post,context='FACES')
lip=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-.213)<1e-5 and v.co.x<-.20 for v in e.verts)]
if lip:bmesh.ops.holes_fill(bm,edges=lip,sides=0)
# Cut at the magazine well, preserving interpolated UVs on the generated mesh.
bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
    plane_co=(0, 0, .120), plane_no=(0, 0, 1), dist=1e-6)
bm.to_mesh(source.data)
bm.free()
parts = []
for name, want_magazine in [('field-body', False), ('field-magazine', True)]:
    mesh = source.data.copy()
    bm = bmesh.new(); bm.from_mesh(mesh)
    remove = []
    for face in bm.faces:
        center = face.calc_center_median()
        is_magazine = center.x < -.025 and all(v.co.z <= .120001 for v in face.verts)
        if is_magazine != want_magazine: remove.append(face)
    bmesh.ops.delete(bm, geom=remove, context='FACES')
    if want_magazine:
        # The generated trigger guard includes a disconnected thin chip below
        # the cut. Keep the magazine's connected shell, never animate that chip.
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
        remaining=set(bm.faces);components=[]
        while remaining:
            seen={remaining.pop()};todo=list(seen)
            while todo:
                for edge in todo.pop().edges:
                    for f in edge.link_faces:
                        if f in remaining:remaining.remove(f);seen.add(f);todo.append(f)
            components.append(seen)
        largest=max(components,key=lambda c:sum(f.calc_area() for f in c))
        removed=[f for group in components if group is not largest for f in group]
        print('magazine components',[(len(c),sum(f.calc_area() for f in c)) for c in components])
        bmesh.ops.delete(bm,geom=removed,context='FACES')
    lip = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z-.120)<1e-5 and v.co.x<-.025 for v in e.verts)]
    if lip: bmesh.ops.holes_fill(bm, edges=lip, sides=0)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free()
    # In Blender: Y becomes -Z in glTF. Muzzle is the source's negative X.
    # 1.20m asset-space length becomes .72m in the remote mount.
    scale = 1.20 / .7078425884246826
    mesh.transform(Matrix(((0,-scale,0,.0029*scale),
        (scale,0,0,-.088*scale),(0,0,scale,-.190*scale),(0,0,0,1))))
    # Seat the pistol grip and mag well at the authored hand contacts. Retain
    # the muzzle/fore-end length; compress the telescoping rear stock smoothly.
    for v in mesh.vertices:
        forward=-v.co.y
        if forward < .45:
            t=max(0,min(1,(forward-.05)/.40))
            rear=max(0,min(1,(forward+.451)/.35))
            v.co.y += .18*(1-t*t*(3-2*t))*rear*rear*(3-2*rear)
    # Changed proportions need normals from the final surface, not stale
    # imported split normals. Keep the imported smooth/flat face assignments.
    if mesh.has_custom_normals:
        mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
    mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    parts.append(obj)
bpy.data.objects.remove(source, do_unlink=True)

# The generated magazine's thin, folded underside fails the close reload view.
# Replace that rejected part with an original capped box magazine and tape band.
# Sample solid albedo texels so it shares the receiver's two images/material.
generated_mag=parts.pop();bpy.data.objects.remove(generated_mag,do_unlink=True)
image=next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.outputs['Color'].is_linked and any(l.to_socket==bsdf.inputs['Base Color'] for l in n.outputs['Color'].links))
pixels=list(image.pixels);width,height=image.size
def swatch(rgb):
    i=min(range(0,len(pixels),4),key=lambda i:sum((pixels[i+j]-rgb[j])**2 for j in range(3)))//4
    return ((i%width+.5)/width,(i//width+.5)/height)
dark=swatch((.09,.10,.09));tape=swatch((.49,.44,.32))
verts=[]
for down,forward,w,d in [(-.108,.205,.060,.096),(-.205,.211,.060,.101),
    (-.240,.221,.060,.103),(-.310,.238,.055,.100)]:
    for x,y in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:verts.append((x,-forward+y,down))
faces=[(3,2,1,0),(12,13,14,15)]
bands=[False,False]
for ring in range(3):
    for i in range(4):faces.append((ring*4+i,ring*4+(i+1)%4,(ring+1)*4+(i+1)%4,(ring+1)*4+i));bands.append(ring==1)
mesh=bpy.data.meshes.new('issued-box-magazine');mesh.from_pydata(verts,[],faces);mesh.update()
uvs=mesh.uv_layers.new(name='UVMap')
for face,band in zip(mesh.polygons,bands):
    for loop in face.loop_indices:uvs.data[loop].uv=tape if band else dark
mag=bpy.data.objects.new('field-magazine',mesh);bpy.context.collection.objects.link(mag)
mag.data.materials.append(material)
bpy.context.view_layer.objects.active=mag
bevel=mag.modifiers.new('folded-steel-edges','BEVEL');bevel.width=.002;bevel.segments=1
bpy.ops.object.modifier_apply(modifier=bevel.name)
parts.append(mag)

# A simple, separated charging latch replaces the generated fused detail.
# It uses the same shared PBR material and moves with the existing reload phase.
bpy.ops.mesh.primitive_cube_add(size=1, location=(-.033,.155,.013))
bolt=bpy.context.object;bolt.name='field-bolt';bolt.dimensions=(.037,.045,.018)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bolt.data.materials.append(material)
for uv in bolt.data.uv_layers.active.data: uv.uv=(.5,.5)
parts.append(bolt)

# Low rail-mounted open reflex housing, merged into the receiver draw. No
# glass, separate light, or opaque optical lens. Coordinates are asset metres.
body=parts[0]
housing=[]
for center,size in [((.005,-.23,.038),(.067,.115,.018)),
    ((-.038,-.23,.077),(.009,.032,.066)),
    ((.048,-.23,.077),(.009,.032,.066)),
    ((.005,-.23,.113),(.095,.032,.009))]:
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=o.modifiers.new('machined-edges','BEVEL');bevel.width=.002;bevel.segments=1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    o.data.materials.append(material)
    for uv in o.data.uv_layers.active.data:uv.uv=(.5,.5)
    housing.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in [body,*housing]:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
root=bpy.data.objects.new('field-carbine',None);bpy.context.collection.objects.link(root)
for obj in parts: obj.parent=root
root['issuedCarbine']=True
root['sightY']=.085
out=Path(args.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_image_format='WEBP',
    export_image_quality=80,export_yup=True,export_animations=False,export_extras=True,
    export_cameras=False,export_lights=False)
print(json.dumps({'output':str(out),'bytes':out.stat().st_size,
    'parts':[{ 'name':o.name,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)} for o in parts]}))
