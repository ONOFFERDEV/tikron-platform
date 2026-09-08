"""Offline vertex weathering for the ORIGINAL Relay concrete kit (Python stdlib).

Run after bake-architecture.py, before serving. Input must be the unweathered bake;
refuse already-colored input so this cannot silently compound on repeated builds.
No geometry displacement, texture edits, normal recalculation or runtime bake.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct


def weather(position, normal, bottom, top):
    x, y, z = position
    u = x if abs(normal[2]) > 0.5 else z
    depth = max(0, top - y)
    # Narrow runoff merging into broad damp shoulders below the parapet.
    stream = (0.5 + 0.5 * math.sin(u * 4.1 + math.sin(u * 1.7))) ** 4
    shoulder = (0.5 + 0.5 * math.sin(u * 1.31 + 0.6)) ** 3
    reach = 1.3 + 1.7 * (0.5 + 0.5 * math.sin(u * 2.13))
    runoff = (0.58 * stream + 0.22 * shoulder) * math.exp(-depth / reach)
    tide = 0.36 * math.exp(-max(0, y - bottom) / (0.42 + shoulder * 0.4))
    mottling = 0.035 * (0.5 + 0.5 * math.sin(u * 5.7 + y * 3.1) * math.sin(u * 2.2 - y * 7.3))
    dirt = min(0.72, runoff + tide + mottling)
    # Linear-light multipliers: desaturated mineral deposits, never black cover.
    return (1 - dirt * 0.94, 1 - dirt, 1 - dirt * 1.08)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--edge-length', type=float, default=0.7, help='Offline vertex spacing in metres; triangle cap remains 45000')
    args = parser.parse_args()
    assert 0.5 <= args.edge_length <= 2
    source = Path(args.input).read_bytes()
    magic, version, size = struct.unpack_from('<III', source)
    assert (magic, version, size) == (0x46546c67, 2, len(source))
    length, kind = struct.unpack_from('<II', source, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(source[20:20 + length])
    offset = 20 + length
    binary_length, kind = struct.unpack_from('<II', source, offset)
    assert kind == 0x004e4942
    binary = bytearray(source[offset + 8:offset + 8 + binary_length])
    assert len(doc['buffers']) == 1
    assert all(set(n) <= {'mesh', 'name'} for n in doc['nodes']), 'Expected world-space original bake'
    formats = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}
    widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def read(index):
        a = doc['accessors'][index]
        assert not a.get('normalized') and 'sparse' not in a
        view = doc['bufferViews'][a['bufferView']]
        fmt = '<' + formats[a['componentType']] * widths[a['type']]
        start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = view.get('byteStride', struct.calcsize(fmt))
        return [struct.unpack_from(fmt, binary, start + i * stride) for i in range(a['count'])]

    def append(values, shape, component=5126, bounds=False):
        binary.extend(b'\0' * (-len(binary) % 4))
        start = len(binary)
        fmt = '<' + formats[component] * widths[shape]
        for value in values:
            binary.extend(struct.pack(fmt, *value))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(binary) - start})
        a = {'bufferView': view, 'componentType': component, 'count': len(values), 'type': shape}
        if bounds:
            a['min'] = [min(v[i] for v in values) for i in range(widths[shape])]
            a['max'] = [max(v[i] for v in values) for i in range(widths[shape])]
        doc['accessors'].append(a)
        return len(doc['accessors']) - 1

    stats = []
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            material = doc['materials'][primitive['material']]
            pbr = material.get('pbrMetallicRoughness', {})
            if pbr.get('metallicFactor', 1) != 0 or not 0.91 < pbr.get('roughnessFactor', 1) < 0.94:
                continue
            attrs = primitive['attributes']
            assert set(attrs) == {'POSITION', 'NORMAL', 'TEXCOORD_0'}, 'Use a fresh unweathered bake'
            data = {key: read(index) for key, index in attrs.items()}
            indices = [v[0] for v in read(primitive['indices'])]
            output = {key: [] for key in attrs}
            output['COLOR_0'] = []
            shared = {}
            new_indices = []
            parents = []
            original_attrs = dict(attrs)
            original_indices = primitive['indices']
            old_area = new_area = 0.0

            def area(tri):
                a, b, c = [v['POSITION'] for v in tri]
                u = [b[i] - a[i] for i in range(3)]
                v = [c[i] - a[i] for i in range(3)]
                return math.sqrt(sum(t*t for t in (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]))) / 2

            for start in range(0, len(indices), 3):
                original = [{key: data[key][i] for key in attrs} for i in indices[start:start+3]]
                old_area += area(original)
                vertical = all(abs(v['NORMAL'][1]) < 0.01 for v in original)
                bottom = min(v['POSITION'][1] for v in original)
                top = max(v['POSITION'][1] for v in original)
                stack = [original]
                while stack:
                    tri = stack.pop()
                    lengths = [sum((tri[i]['POSITION'][k] - tri[(i+1) % 3]['POSITION'][k])**2 for k in range(3)) for i in range(3)]
                    edge = lengths.index(max(lengths))
                    if vertical and top - bottom > 0.5 and lengths[edge] > args.edge_length**2:
                        a, b, c = tri[edge], tri[(edge+1) % 3], tri[(edge+2) % 3]
                        mid = {key: tuple((x+y)/2 for x, y in zip(a[key], b[key])) for key in attrs}
                        stack.extend([[a, mid, c], [mid, b, c]])
                        continue
                    new_area += area(tri)
                    parents.append((start // 3,))
                    for v in tri:
                        color = weather(v['POSITION'], v['NORMAL'], bottom, top) if vertical else (1, 1, 1)
                        identity = tuple(round(c, 7) for values in [*v.values(), color] for c in values)
                        if identity not in shared:
                            shared[identity] = len(output['POSITION'])
                            for key in attrs:
                                output[key].append(v[key])
                            output['COLOR_0'].append(color)
                        new_indices.append(shared[identity])
            assert math.isclose(old_area, new_area, rel_tol=1e-9), 'Surface area changed'
            assert len(new_indices) // 3 <= 45000, 'Concrete triangle budget exceeded'
            assert all(0.2 <= c <= 1 for color in output['COLOR_0'] for c in color)
            for key, values in output.items():
                primitive['attributes'][key] = append(values, 'VEC2' if key == 'TEXCOORD_0' else 'VEC3', bounds=key == 'POSITION')
            primitive['indices'] = append([(i,) for i in new_indices], 'SCALAR', 5125 if len(shared) > 65535 else 5123)
            primitive.setdefault('extras', {})['weathering'] = {
                'attributes': original_attrs, 'indices': original_indices,
                'triangleParents': append(parents, 'SCALAR', 5123),
            }
            old_bounds = ([min(p[k] for p in data['POSITION']) for k in range(3)], [max(p[k] for p in data['POSITION']) for k in range(3)])
            new_bounds = ([min(p[k] for p in output['POSITION']) for k in range(3)], [max(p[k] for p in output['POSITION']) for k in range(3)])
            assert old_bounds == new_bounds
            stats.append({'material': material['name'], 'beforeTriangles': len(indices)//3,
                          'afterTriangles': len(new_indices)//3, 'vertices': len(shared), 'surfaceAreaBefore': old_area,
                          'surfaceAreaAfter': new_area, 'boundsUnchanged': True,
                          'vertexColorMin': min(min(c) for c in output['COLOR_0'])})
    assert len(stats) == 1, 'Expected exactly one original concrete primitive'
    binary.extend(b'\0' * (-len(binary) % 4))
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    result = struct.pack('<III', magic, 2, 28 + len(encoded) + len(binary))
    result += struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
    result += struct.pack('<II', len(binary), 0x004e4942) + binary
    Path(args.output).write_bytes(result)
    report = {'sourceSha256': hashlib.sha256(source).hexdigest(), 'outputSha256': hashlib.sha256(result).hexdigest(),
              'beforeBytes': len(source), 'afterBytes': len(result), 'primitives': stats,
              'texturesAdded': 0, 'materialsAdded': 0,
              'note': 'Only concrete subdivided; barycentric UV/normal interpolation, no displacement. Original binary image bytes retained.'}
    Path(args.report).write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
