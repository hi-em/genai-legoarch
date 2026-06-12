"""LDraw export.

Writes a `.ldr` that opens in BrickLink Studio / any LDraw viewer, which gives
us photoreal rendering, real part/price validation, and auto instructions.

LDraw line type 1 (sub-file reference):
    1 <colour> x y z  a b c  d e f  g h i  <part>.dat
with a 3x3 orientation matrix. LDraw uses a Y-DOWN coordinate system and
1 LDU = 0.4 mm; a brick is 20 LDU wide (1 stud) and 24 LDU tall.

Orientation is NOT what the engine's grid convention assumes: official parts
are authored long-axis-along-X, and the 45-degree slope family is authored
slope-axis-along-Z, downhill toward -Z, with the origin centred on the HIGH
stud row (10 LDU off the footprint centre). The viewer corrects all of this
at geometry load (partGeometry.canonicalize); this exporter applies the SAME
correction algebraically: a quarter-turn pre-matrix for transposed parts plus
a rotated origin offset for slopes. Engine rotations compose as R(-rot)
because Y-down flips rotation handedness — identical for 180-symmetric
bricks (so legacy exports are unchanged) but essential for slopes.
"""
from __future__ import annotations

from typing import Iterable

from . import bricks as _bricks
from .slopes import SLOPE_PARTS as _SLOPE45

LDU_PER_STUD = 20      # horizontal stud pitch
LDU_PER_PLATE = 8      # one plate height (a brick = 3 plates = 24 LDU)

# R_y(theta) in LDraw coords, row-major
_ROT0 = (1, 0, 0, 0, 1, 0, 0, 0, 1)
_ROT90 = (0, 0, 1, 0, 1, 0, -1, 0, 0)
_ROT180 = (-1, 0, 0, 0, 1, 0, 0, 0, -1)
_ROT270 = (0, 0, -1, 0, 1, 0, 1, 0, 0)
# engine rot (about the up axis, grid +x toward +y) = R_y(-rot) in Y-down LDraw
_ENGINE_ROT = {0: _ROT0, 90: _ROT270, 180: _ROT180, 270: _ROT90}

# raw -> canonical quarter turn (same correction the viewer derives by
# measuring the loaded geometry)
_QUARTER = (0, 0, -1, 0, 1, 0, 1, 0, 0)

# non-square rect parts: authored long-axis-along-X, engine treats them as
# (short w, long d) at rot 0 -> need the quarter turn
_TRANSPOSED = (
    {p for p, ax, az in _bricks.FOOTPRINTS if ax != az}
    | {p for p, ax, az in _bricks.FOOTPRINTS_PLATE if ax != az}
    | {t for (fw, fd), t in _bricks.TILE_EQUIV.items() if fw != fd}
)

# slope family: quarter turn + raw footprint centre sits 10 LDU toward -Z of
# the part origin (origin is centred on the high stud row)
_SLOPE_CENTER_RAW = (0.0, 0.0, -10.0)


def _matmul(a, b):
    return tuple(
        sum(a[3 * i + k] * b[3 * k + j] for k in range(3))
        for i in range(3) for j in range(3)
    )


def _matvec(m, v):
    return tuple(sum(m[3 * i + k] * v[k] for k in range(3)) for i in range(3))


def part_transform(part: str, rot: int):
    """(matrix, origin_offset_ldu) for a placed part: full orientation plus
    the world-space offset that re-centres raw geometry on its footprint."""
    rotm = _ENGINE_ROT.get(int(rot) % 360, _ROT0)
    if part in _SLOPE45:
        m = _matmul(rotm, _QUARTER)
        return m, _matvec(m, _SLOPE_CENTER_RAW)
    if part in _TRANSPOSED:
        return _matmul(rotm, _QUARTER), (0.0, 0.0, 0.0)
    return rotm, (0.0, 0.0, 0.0)


def brick_to_ldraw_line(
    part: str, x: int, y: int, z: int, color: int, rot: int,
    w: int = 1, d: int = 1, h: int = 3,
) -> str:
    # grid (x,y,z) with z up, z in PLATE layers -> LDraw (X, Y-down, Z). LDraw
    # parts have their origin at the part TOP, so a piece whose bottom sits on
    # plate-layer z has its origin at the top of its own height:
    # y = -(z + h - 3) * 8 LDU (the -3 keeps full-brick models byte-identical
    # with the pre-plate exporter, where course k sat at -24k).
    m, off = part_transform(part, rot)
    lx = int(round((x + (w - 1) / 2.0) * LDU_PER_STUD - off[0]))
    ly = -(z + h - 3) * LDU_PER_PLATE
    lz = int(round((y + (d - 1) / 2.0) * LDU_PER_STUD - off[2]))
    coords = f"{lx} {ly} {lz}"
    matrix = " ".join(str(int(v)) if float(v).is_integer() else str(v) for v in m)
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
        w = getattr(b, "w", 1)
        d = getattr(b, "d", 1)
        h = getattr(b, "h", 3)
        lines.append(brick_to_ldraw_line(part, x, y, z, color, rot, w, d, h))
    text = "\n".join(lines) + "\n"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return path
