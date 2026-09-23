# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# Imported by Blender 4.5 tools/fit-ww1-soldiers.py; metres, Y up, +Z forward.
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TypeAlias

from ww1_soldier_headgear import Face, Point, Surface

Weights: TypeAlias = tuple[tuple[str, float], ...]


@dataclass(frozen=True, slots=True)
class ClothSurface:
    surface: Surface
    weights: tuple[Weights, ...]


@dataclass(frozen=True, slots=True)
class Ring:
    center: Point
    across: Point
    depth: Point
    weights: Weights


def mix(a: Point, b: Point, amount: float) -> Point:
    return (a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount,
            a[2] + (b[2] - a[2]) * amount)


def add(a: Point, b: Point) -> Point:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def scale(v: Point, amount: float) -> Point:
    return (v[0] * amount, v[1] * amount, v[2] * amount)


def cross(a: Point, b: Point) -> Point:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def unit(v: Point) -> Point:
    length = math.sqrt(sum(value * value for value in v))
    return (v[0] / length, v[1] / length, v[2] / length)


def loft(rings: tuple[Ring, ...], segments: int = 24) -> ClothSurface:
    vertices: list[Point] = []
    weights: list[Weights] = []
    for ring in rings:
        for step in range(segments):
            angle = step * math.tau / segments
            c, s = math.cos(angle), math.sin(angle)
            vertices.append(add(ring.center, add(scale(ring.across, c), scale(ring.depth, s))))
            weights.append(ring.weights)
    faces: list[Face] = []
    for index in range(len(rings) - 1):
        for step in range(segments):
            a = index * segments + step
            b = index * segments + (step + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    bottom, top = len(vertices), len(vertices) + 1
    vertices.extend((rings[0].center, rings[-1].center))
    weights.extend((rings[0].weights, rings[-1].weights))
    last = (len(rings) - 1) * segments
    for step in range(segments):
        following = (step + 1) % segments
        faces.extend(((bottom, following, step), (top, last + step, last + following)))
    return ClothSurface(Surface(tuple(vertices), tuple(faces)), tuple(weights))


def tunic_surface(spine: tuple[tuple[str, float], ...]) -> ClothSurface:
    profile = ((.80, .177, .105), (.84, .195, .119), (.91, .194, .122),
               (.98, .178, .113), (1.035, .169, .109), (1.09, .177, .117),
               (1.16, .192, .128), (1.24, .208, .139), (1.32, .225, .139),
               (1.38, .237, .132), (1.415, .218, .119), (1.45, .165, .099),
               (1.478, .093, .072), (1.50, .061, .059))
    rings: list[Ring] = []
    for height, width, depth in profile:
        weights: Weights = ((spine[0][0], 1.0),)
        for (lower, start), (upper, end) in zip(spine, spine[1:]):
            if height >= end:
                weights = ((upper, 1.0),)
            elif height > start:
                blend = (height - start) / (end - start)
                weights = ((lower, 1 - blend), (upper, blend))
                break
        rings.append(Ring((0, height, -.012), (-width, 0, 0), (0, 0, depth), weights))
    return loft(tuple(rings))


def limb_surface(points: tuple[Point, Point, Point], joints: tuple[str, str],
                 radii: tuple[float, float, float],
                 root: tuple[Point, str] | None = None) -> ClothSurface:
    rings: list[Ring] = []
    for fraction, fullness in ((0, 1), (.08, 1.08), (.22, 1.06), (.37, 1.01),
                               (.43, 1.04), (.48, .99), (.52, 1.02), (.57, 1.0),
                               (.68, 1.06), (.84, 1.02), (.94, 1.01), (1, 1)):
        segment = 0 if fraction <= .5 else 1
        amount = fraction * 2 - segment
        center = mix(points[segment], points[segment + 1], amount)
        tangent = unit(mix(add(points[1], scale(points[0], -1)),
                           add(points[2], scale(points[1], -1)), fraction))
        across = unit(cross((0, 0, 1), tangent))
        depth = cross(tangent, across)
        radius = (radii[segment] + (radii[segment + 1] - radii[segment]) * amount) * fullness
        blend = min(1.0, max(0.0, (fraction - .35) / .30))
        weights: Weights = tuple((joint, weight) for joint, weight in
                                 ((joints[0], 1 - blend), (joints[1], blend)) if weight > 0)
        if root is not None and fraction < .08:
            shoulder_blend = fraction / .08
            weights = tuple((joint, weight) for joint, weight in
                            ((root[1], 1 - shoulder_blend), (joints[0], shoulder_blend)) if weight > 0)
            if fraction == 0:
                center = root[0]
                radius *= .55
        rings.append(Ring(center, scale(across, radius), scale(depth, radius * .90), weights))
    return loft(tuple(rings), 20)


def boot_surface(ankle: Point, joint: str) -> ClothSurface:
    profile = ((-.075, .067, .173, .061), (-.060, .071, .177, .063),
               (-.034, .069, .175, .063), (-.012, .061, .149, .061),
               (.023, .052, .087, .059), (.070, .049, .059, .052),
               (.105, .050, .057, .051))
    return loft(tuple(Ring((ankle[0], ankle[1] + height, ankle[2] + (front - back) / 2),
                           (-width, 0, 0), (0, 0, (front + back) / 2), ((joint, 1.0),))
                      for height, width, front, back in profile), 20)
