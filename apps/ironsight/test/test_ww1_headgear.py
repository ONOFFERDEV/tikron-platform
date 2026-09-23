# /// script
# requires-python = ">=3.11"
# dependencies = ["pytest"]
# ///
# uv run --no-project test/test_ww1_headgear.py
from __future__ import annotations

import math
import sys
from collections import Counter
from collections.abc import Iterator
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from ww1_soldier_headgear import Faction, Point, Surface, head_surface, helmet_surface


def triangles(surface: Surface) -> Iterator[tuple[Point, Point, Point]]:
    for face in surface.faces:
        for index in range(1, len(face) - 1):
            yield surface.vertices[face[0]], surface.vertices[face[index]], surface.vertices[face[index + 1]]


def signed_volume(surface: Surface) -> float:
    total = 0.0
    for a, b, c in triangles(surface):
        total += (a[0] * (b[1]*c[2]-b[2]*c[1]) - a[1] * (b[0]*c[2]-b[2]*c[0])
                  + a[2] * (b[0]*c[1]-b[1]*c[0])) / 6
    return total


@pytest.mark.parametrize('surface', [head_surface(), helmet_surface('khaki'), helmet_surface('fieldgrey')])
def test_closed_outward_mesh_with_no_degenerate_triangles(surface: Surface) -> None:
    assert all(math.isfinite(value) for vertex in surface.vertices for value in vertex)
    assert len(set(surface.vertices)) == len(surface.vertices)
    directed = Counter((a, b) for face in surface.faces for a, b in zip(face, (*face[1:], face[0]), strict=True))
    assert all(count == 1 and directed[b, a] == 1 for (a, b), count in directed.items())
    assert signed_volume(surface) > 0
    for a, b, c in triangles(surface):
        u, v = tuple(b[i]-a[i] for i in range(3)), tuple(c[i]-a[i] for i in range(3))
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        assert sum(x*x for x in cross) > 1e-16


@pytest.mark.parametrize('faction', ['khaki', 'fieldgrey'])
def test_every_crown_vertex_fits_below_the_inner_shell(faction: Faction) -> None:
    shell = helmet_surface(faction)
    for x, y, z in head_surface().vertices:
        if y < 1.69:
            continue
        heights = []
        for a, b, c in triangles(shell):
            denominator = (b[2]-c[2])*(a[0]-c[0]) + (c[0]-b[0])*(a[2]-c[2])
            if abs(denominator) < 1e-12:
                continue
            u = ((b[2]-c[2])*(x-c[0]) + (c[0]-b[0])*(z-c[2])) / denominator
            v = ((c[2]-a[2])*(x-c[0]) + (a[0]-c[0])*(z-c[2])) / denominator
            w = 1-u-v
            if min(u,v,w) >= -1e-9:
                heights.append(u*a[1]+v*b[1]+w*c[1])
        assert heights
        assert min(heights) - y >= .003


def test_faction_outlines_use_width_and_a_rear_skirt() -> None:
    khaki, grey = helmet_surface('khaki'), helmet_surface('fieldgrey')
    width = lambda surface: max(p[0] for p in surface.vertices)-min(p[0] for p in surface.vertices)
    assert width(khaki)-width(grey) >= .025
    front = min(p[1] for p in grey.vertices if p[2] > .10)
    back = min(p[1] for p in grey.vertices if p[2] < -.10)
    assert front-back >= .04
    assert max(p[1] for p in khaki.vertices)-min(p[1] for p in khaki.vertices) < .07


def test_head_is_compact_and_helmet_triangle_count_stays_bounded() -> None:
    head = head_surface()
    assert max(p[1] for p in head.vertices)-min(p[1] for p in head.vertices) <= .18
    assert max(p[0] for p in head.vertices)-min(p[0] for p in head.vertices) <= .17
    assert all(sum(len(face)-2 for face in helmet_surface(faction).faces) <= 1400
               for faction in ('khaki','fieldgrey'))


if __name__ == '__main__':
    raise SystemExit(pytest.main([__file__, '-q']))
