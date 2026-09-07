"""Compare the original render kit to baked GLBs, including triangle winding.
Run node tools/dump-architecture.mjs first. Python standard library only.
"""
import hashlib
import json
import math
import struct
from pathlib import Path

app = Path(__file__).resolve().parents[1]
source_path = app / '.inspect/architecture.json'
source = json.loads(source_path.read_text())
reports = {}

def triangles(positions, normals, indices):
    result = {}
    degenerates = 0
    for i in range(0, len(indices), 3):
        vertices = [positions[j] for j in indices[i:i+3]]
        ns = [normals[j] for j in indices[i:i+3]]
        a = [vertices[1][k]-vertices[0][k] for k in range(3)]
        b = [vertices[2][k]-vertices[0][k] for k in range(3)]
        cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
        if sum(c*c for c in cross) < 1e-16:
            degenerates += 1
            continue
        points = [tuple(round(c*10000) for c in v) for v in vertices]
        # Cyclic permutation allowed, reversed winding is NOT equivalent.
        offset = min(range(3), key=lambda k: points[k:] + points[:k])
        key = tuple(points[offset:] + points[:offset])
        ns = ns[offset:] + ns[:offset]
        ns = [tuple(c / (math.sqrt(sum(v*v for v in n)) or 1) for c in n) for n in ns]
        result.setdefault(key, []).append(ns)
    return result, degenerates

for name, kit in source.items():
    expected = {}
    source_degenerates = 0
    for part in kit['meshes']:
        points = [part['positions'][i:i+3] for i in range(0,len(part['positions']),3)]
        normals = [part['normals'][i:i+3] for i in range(0,len(part['normals']),3)]
        tris, degen = triangles(points,normals,part['indices'])
        source_degenerates += degen
        for key, values in tris.items(): expected.setdefault(key, []).extend(values)
    path = app / 'public/assets/maps' / (name + '-architecture.glb')
    raw = path.read_bytes()
    length = struct.unpack_from('<I',raw,12)[0]
    doc = json.loads(raw[20:20+length])
    binary = raw[28+length:]
    assert len(doc['nodes']) == 1 and not any(k in doc['nodes'][0] for k in ['matrix','translation','rotation','scale'])
    assert not doc.get('animations') and not doc.get('skins')
    assert len(doc['images']) == 1 and 'uri' not in doc['images'][0]
    assert all('occlusionTexture' in mat for mat in doc['materials'])
    def accessor(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        count = {'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        fmt = '<' + {5126:'f',5123:'H',5125:'I'}[a['componentType']] * count
        offset = v.get('byteOffset',0) + a.get('byteOffset',0)
        stride = v.get('byteStride',struct.calcsize(fmt))
        return [struct.unpack_from(fmt,binary,offset+i*stride) for i in range(a['count'])]
    actual = {}; exported_degenerates = 0
    for primitive in doc['meshes'][0]['primitives']:
        attrs = primitive['attributes']
        uvs = accessor(attrs['TEXCOORD_0'])
        assert all(math.isfinite(c) and -0.0001 <= c <= 1.0001 for uv in uvs for c in uv)
        tris, degen = triangles(accessor(attrs['POSITION']),accessor(attrs['NORMAL']),[v[0] for v in accessor(primitive['indices'])])
        exported_degenerates += degen
        for key, values in tris.items(): actual.setdefault(key, []).extend(values)
    assert expected.keys() == actual.keys(), f'{name}: missing/extra/flipped triangles: {len(expected.keys()-actual.keys())}/{len(actual.keys()-expected.keys())}'
    worst_normal = 0
    for key, originals in expected.items():
        candidates = actual[key]
        assert len(originals) == len(candidates), f'{name}: changed triangle multiplicity'
        for normals in originals:
            errors = [max(abs(a-b) for n,m in zip(normals,other) for a,b in zip(n,m)) for other in candidates]
            best = min(range(len(errors)),key=errors.__getitem__)
            if errors[best] > worst_normal:
                worst_normal = errors[best]; worst_triangle = dict(points=key, expected=normals, actual=candidates[best])
            candidates.pop(best)
    assert worst_normal < 0.001, f'{name}: altered authored normal {worst_normal}, {worst_triangle}'
    reports[name] = dict(triangles=sum(len(v) for v in expected.values()), sourceDegenerates=source_degenerates,
        exportedDegenerates=exported_degenerates, maxNormalComponentError=worst_normal,
        originalParts=len(kit['meshes']), materialPrimitives=len(doc['meshes'][0]['primitives']), bytes=len(raw),
        sha256=hashlib.sha256(raw).hexdigest(), positionToleranceMetres=0.0001, normalComponentTolerance=0.001,
        status='PASS: same oriented triangles and authored normals; UVs finite, one embedded AO image, no purchased inputs')
report = dict(sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),maps=reports)
(app / '.inspect/session9-geometry-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
