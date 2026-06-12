"""Slope pass — "Pass 1.5", run before the rectangular packer.

The first open implementation of slope-aware legolization for buildings
(closest academic recipe: Zhou & Chen 2019, CGF — no code released). v1 is
staircase-native: wherever the building's top surface steps down by EXACTLY
one brick course to the neighbouring column, the step edge is bevelled with a
real 45-degree slope brick facing downhill. Runs of eligible edge cells merge
into the widest slope the catalog offers (2x4 -> 2x1). The consumed cells are
removed from the packer's free mask, so bricks/plates/tiles pack around the
slopes exactly as before.

Orientation convention (grid): rot 0 = downhill toward +x, 90 = +y,
180 = -x, 270 = -y. `w`/`d` are stored AS PLACED (world extents), matching
the rectangular pieces; the canonical part has its slope axis along x.

v2 hooks (documented, not yet wired): 33-degree family on 3-stud treads,
curved family from mesh-normal buckets, inverted slopes under overhangs.
"""
from __future__ import annotations

from typing import Any, Optional

import numpy as np

COURSE = 3  # plates per brick course

# 45-degree family: canonical footprint = 2 studs along the slope axis,
# `across` studs wide. Ordered widest-first for the greedy run merge.
SLOPE45_BY_WIDTH: list[tuple[str, int]] = [
    ("3037", 4),
    ("3038", 3),
    ("3039", 2),
    ("3040b", 1),
]
SLOPE_PARTS = {p for p, _ in SLOPE45_BY_WIDTH}

# downhill directions: (dx, dy, rot)
_DIRS = [(1, 0, 0), (0, 1, 90), (-1, 0, 180), (0, -1, 270)]


def _course_grid(occ: np.ndarray) -> np.ndarray:
    """(nx, ny, n_courses) bool — course fully filled."""
    nx, ny, nz = occ.shape
    nc = nz // COURSE
    if nc == 0:
        return np.zeros((nx, ny, 0), dtype=bool)
    trimmed = occ[:, :, : nc * COURSE]
    return trimmed.reshape(nx, ny, nc, COURSE).all(axis=3)


def _top_course(courses: np.ndarray) -> np.ndarray:
    """(nx, ny) int — highest fully-filled course per column, -1 if none."""
    nc = courses.shape[2]
    if nc == 0:
        return np.full(courses.shape[:2], -1, dtype=int)
    idx = np.arange(1, nc + 1)
    return (courses * idx).max(axis=2) - 1


def place_slopes(
    occ: np.ndarray, code: Optional[np.ndarray] = None,
) -> tuple[list[list[Any]], np.ndarray]:
    """Detect one-course steps and bevel them with 45-degree slopes.

    Returns (pieces, consumed): pieces as [part, x, y, z, rot, w, d, h]
    lists (same raw shape the packer emits), consumed = bool grid of cells
    the pieces occupy.
    """
    nx, ny, nz = occ.shape
    consumed = np.zeros_like(occ, dtype=bool)
    pieces: list[list[Any]] = []

    courses = _course_grid(occ)
    top = _top_course(courses)
    if courses.shape[2] == 0:
        return pieces, consumed

    MIXED = -2

    def cell_free(x: int, y: int, c: int) -> bool:
        z = c * COURSE
        return not consumed[x, y, z: z + COURSE].any()

    def piece_code(x: int, y: int, c: int, dx: int, dy: int):
        """Quantized colour of the WHOLE would-be slope (edge + seat cells,
        all three plates). None = wildcard-only; MIXED = spans a colour
        boundary and may not be placed at all (matches the packer's
        _code_uniform guarantee)."""
        if code is None:
            return None
        z = c * COURSE
        found = None
        for (cx, cy) in ((x, y), (x - dx, y - dy)):
            vals = code[cx, cy, z: z + COURSE]
            vals = vals[vals >= 0]
            for v in vals:
                v = int(v)
                if found is None:
                    found = v
                elif v != found:
                    return MIXED
        return found

    for dx, dy, rot in _DIRS:
        # eligible edge cells for this downhill direction
        eligible: dict[tuple[int, int], int] = {}  # (x, y) -> top course c
        for x in range(nx):
            for y in range(ny):
                c = top[x, y]
                if c < 0:
                    continue
                fx, fy = x + dx, y + dy            # downhill neighbour
                bx, by = x - dx, y - dy            # cell behind the edge
                if not (0 <= fx < nx and 0 <= fy < ny):
                    continue                        # model border: cliff, not step
                if top[fx, fy] != c - 1:
                    continue                        # not exactly one course down
                # nothing may sit above the slanted face: `top` only sees FULL
                # courses, but partial plates above (routine at plate-unit
                # resolution) would be left floating on the slope
                if occ[x, y, (c + 1) * COURSE:].any():
                    continue
                # the seat COURSE itself must be filled — `top >= c` is true
                # for overhang columns that are hollow at exactly course c
                # (shell mode makes these routine), and a slope seated over a
                # void would add cells the model never had
                if not (0 <= bx < nx and 0 <= by < ny) or not courses[bx, by, c]:
                    continue
                if not (cell_free(x, y, c) and cell_free(bx, by, c)):
                    continue                        # already bevelled by another dir
                if piece_code(x, y, c, dx, dy) == MIXED:
                    continue                        # would straddle a colour boundary
                eligible[(x, y)] = c

        # merge runs of edge cells (same course, contiguous across the slope
        # axis) into the widest catalog slope
        across_axis = 1 if dx != 0 else 0           # run extends perpendicular
        keys = sorted(
            eligible.keys(),
            key=lambda k: (k[1 - across_axis], k[across_axis]),
        )
        used: set[tuple[int, int]] = set()
        i = 0
        while i < len(keys):
            x0, y0 = keys[i]
            if (x0, y0) in used:
                i += 1
                continue
            c = eligible[(x0, y0)]
            col0 = piece_code(x0, y0, c, dx, dy)
            # grow the run while contiguous, same course, same colour
            # (colour covers edge AND seat cells — the whole piece)
            run = [(x0, y0)]
            while len(run) < SLOPE45_BY_WIDTH[0][1]:
                lx, ly = run[-1]
                nxt = (lx + (1 - abs(dx)), ly + (1 - abs(dy)))
                if (
                    nxt in eligible and nxt not in used
                    and eligible[nxt] == c
                    and piece_code(*nxt, c, dx, dy) == col0
                ):
                    run.append(nxt)
                else:
                    break
            # fit the widest part(s) onto the run
            remaining = run
            while remaining:
                for part, width in SLOPE45_BY_WIDTH:
                    if width <= len(remaining):
                        seg = remaining[:width]
                        remaining = remaining[width:]
                        _emit(pieces, consumed, seg, c, dx, dy, rot, part)
                        used.update(seg)
                        break
            i += 1

    return pieces, consumed


def _emit(pieces, consumed, seg, c, dx, dy, rot, part):
    """Append one slope piece covering the edge cells + their seat cells."""
    cells = []
    for (ex, ey) in seg:
        cells.append((ex, ey))
        cells.append((ex - dx, ey - dy))           # seat cell behind the edge
    xs = [p[0] for p in cells]
    ys = [p[1] for p in cells]
    x, y = min(xs), min(ys)
    w = max(xs) - x + 1
    d = max(ys) - y + 1
    z = c * COURSE
    for (cx, cy) in cells:
        consumed[cx, cy, z: z + COURSE] = True
    # plain ints: numpy scalars would poison JSON serialisation downstream
    pieces.append([part, int(x), int(y), int(z), int(rot), int(w), int(d), COURSE])
