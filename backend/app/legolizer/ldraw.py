"""LDraw export.

Writes a `.ldr` that opens in BrickLink Studio / any LDraw viewer, which gives
us photoreal rendering, real part/price validation, and auto instructions.

LDraw line type 1 (sub-file reference):
    1 <colour> x y z  a b c  d e f  g h i  <part>.dat
with a 3x3 orientation matrix. LDraw uses a Y-down coordinate system and
1 LDU = 0.4 mm; a brick is 20 LDU wide (1 stud) and 24 LDU tall.
"""
from __future__ import annotations

from typing import Iterable

LDU_PER_STUD = 20      # horizontal stud pitch
LDU_PER_BRICK_H = 24   # one brick height

# identity (rot 0) and 90-degree footprint rotation matrices, row-major
_ROT0 = (1, 0, 0, 0, 1, 0, 0, 0, 1)
_ROT90 = (0, 0, 1, 0, 1, 0, -1, 0, 0)


def brick_to_ldraw_line(part: str, x: int, y: int, z: int, color: int, rot: int) -> str:
    # grid (x,y,z) with z up  ->  LDraw (X, Y-down, Z)
    lx = x * LDU_PER_STUD
    ly = -z * LDU_PER_BRICK_H
    lz = y * LDU_PER_STUD
    m = _ROT90 if rot == 90 else _ROT0
    coords = f"{lx} {ly} {lz}"
    matrix = " ".join(str(v) for v in m)
    return f"1 {color} {coords} {matrix} {part}.dat"


def write_ldr(bricks: Iterable, path: str, title: str = "BrickForge model") -> str:
    lines = [f"0 {title}", "0 Name: model.ldr", "0 Author: BrickForge", ""]
    for b in bricks:
        part = b.part if hasattr(b, "part") else b[0]
        x = b.x if hasattr(b, "x") else b[1]
        y = b.y if hasattr(b, "y") else b[2]
        z = b.z if hasattr(b, "z") else b[3]
        color = getattr(b, "color", 15)
        rot = getattr(b, "rot", 0)
        lines.append(brick_to_ldraw_line(part, x, y, z, color, rot))
    text = "\n".join(lines) + "\n"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return path
