# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# Imported by Blender 4.5 tools/fit-ww1-soldiers.py; coordinates are metres, Y up, +Z forward.
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final, Literal, TypeAlias, assert_never

Point: TypeAlias = tuple[float, float, float]
Face: TypeAlias = tuple[int, ...]
Faction: TypeAlias = Literal["khaki", "fieldgrey"]
SEGMENTS: Final = 32


@dataclass(frozen=True, slots=True)
class Surface:
    vertices: tuple[Point, ...]
    faces: tuple[Face, ...]


def face_relief(height: float, forward: float) -> float:
    """Forward offset for nose, brow and eye sockets; forward is sin(angle), 1 at the face centre."""
    front = max(0.0, forward)
    nose = {1.622: .007, 1.637: .021, 1.652: .010}.get(height, 0.0) * front ** 24
    brow = .007 * front ** 4 if height == 1.667 else 0.0
    socket = -.007 if height == 1.652 and .80 < front < .99 else 0.0
    return nose + brow + socket


def head_surface() -> Surface:
    rings = (
        (1.555, .031, .038, .038), (1.568, .045, .052, .053),
        (1.585, .056, .072, .062), (1.603, .068, .079, .072),
        (1.622, .077, .082, .077), (1.637, .081, .083, .080),
        (1.652, .083, .084, .083), (1.667, .083, .086, .084),
        (1.684, .080, .084, .082), (1.700, .072, .074, .074),
        (1.714, .056, .058, .059), (1.725, .028, .030, .031),
    )
    vertices: list[Point] = []
    for height, width, front, back in rings:
        for step in range(SEGMENTS):
            angle = step * math.tau / SEGMENTS
            forward = math.sin(angle)
            depth = front if forward >= 0 else back
            vertices.append((width * math.cos(angle), height, depth * forward + face_relief(height, forward)))
    faces: list[Face] = []
    for ring in range(len(rings) - 1):
        for step in range(SEGMENTS):
            a = ring * SEGMENTS + step
            b = ring * SEGMENTS + (step + 1) % SEGMENTS
            faces.append((a, a + SEGMENTS, b + SEGMENTS, b))
    bottom, top = len(vertices), len(vertices) + 1
    vertices.extend(((0, 1.555, 0), (0, 1.728, 0)))
    for step in range(SEGMENTS):
        following = (step + 1) % SEGMENTS
        faces.append((bottom, step, following))
        a = (len(rings) - 1) * SEGMENTS
        faces.append((top, a + following, a + step))
    return Surface(tuple(vertices), tuple(faces))


def helmet_surface(faction: Faction) -> Surface:
    match faction:
        case "khaki":
            base, depth = 1.690, .94
            profile = ((.0, .058), (.035, .055), (.065, .047), (.088, .034),
                       (.104, .016), (.114, .005), (.132, .001), (.149, -.004))
        case "fieldgrey":
            base, depth = 1.692, 1.02
            profile = ((.0, .063), (.035, .060), (.065, .052), (.088, .038),
                       (.104, .020), (.112, .004), (.116, -.012), (.123, -.022))
        case unreachable:
            assert_never(unreachable)
    vertices: list[Point] = [(0, base + profile[0][1], 0)]
    for ring, (radius, vertical) in enumerate(profile[1:], 1):
        skirt = max(0.0, (ring - 4) / 3)
        for step in range(SEGMENTS):
            angle = step * math.tau / SEGMENTS
            forward = math.sin(angle)
            x, z = radius * math.cos(angle), radius * forward * depth
            y = base + vertical
            if faction == "fieldgrey":
                front = max(0.0, forward) ** 6
                rear = max(0.0, -forward)
                y += skirt * (.020 * front - .044 * rear)
                z += skirt * .018 * front
            vertices.append((x, y, z))
    faces: list[Face] = [(0, 1 + (step + 1) % SEGMENTS, 1 + step)
                         for step in range(SEGMENTS)]
    for ring in range(len(profile) - 2):
        start = 1 + ring * SEGMENTS
        for step in range(SEGMENTS):
            a = start + step
            b = start + (step + 1) % SEGMENTS
            faces.append((a, b, b + SEGMENTS, a + SEGMENTS))
    outer_count = len(vertices)
    vertices.extend((x, y - .003, z) for x, y, z in tuple(vertices))
    faces.extend(tuple(index + outer_count for index in reversed(face)) for face in tuple(faces))
    start = 1 + (len(profile) - 2) * SEGMENTS
    for step in range(SEGMENTS):
        a = start + step
        b = start + (step + 1) % SEGMENTS
        faces.append((a, b, b + outer_count, a + outer_count))
    return Surface(tuple(vertices), tuple(faces))
