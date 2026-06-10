"""Brick layout — cover an occupancy grid with legal LEGO brick footprints.

Real implementation (Luo et al., SIGGRAPH Asia 2015): a greedy per-z-layer
split-and-merge. Every occupied stud starts as a 1x1; we greedily merge free
studs into the largest legal footprint anchored there, with controlled
randomness so we don't get degenerate striping, and a soft running-bond penalty
that staggers vertical seams against the layer below (so courses tie together
instead of cracking along a stacked joint). The 1x1 is always the terminal
fallback, so the silhouette is preserved exactly — never a stud added or missed.

Emits bricks as (part, x, y, z, rot, w, d):
  (x, y) = min-corner grid cell of the footprint; z = layer (z up)
  rot    = 0 or 90, LDraw footprint rotation
  w, d   = footprint extent in grid-x / grid-y studs, as placed

Grid convention: occ[x, y, z]; z is the vertical (layer) axis.
"""
from __future__ import annotations

import random
from typing import Any, Optional

import numpy as np

# BrickLink part IDs, stored in native LDraw orientation (studs along X, along Z).
# A "W x L" brick is authored W studs along X and L studs along Z.
PART_1x1 = "3005"
PART_1x2 = "3004"
PART_1x3 = "3622"
PART_1x4 = "3010"
PART_2x2 = "3003"
PART_2x3 = "3002"
PART_2x4 = "3001"

# (part, ax, az) native footprint in studs. The merge expands these into both
# orientations. Keep 1x1 last — it is the guaranteed terminal fallback.
FOOTPRINTS: list[tuple[str, int, int]] = [
    (PART_2x4, 2, 4),
    (PART_2x3, 2, 3),
    (PART_2x2, 2, 2),
    (PART_1x4, 1, 4),
    (PART_1x3, 1, 3),
    (PART_1x2, 1, 2),
    (PART_1x1, 1, 1),
]

# Set of legal part ids, for validation/tests.
LEGAL_PARTS = {p for p, _, _ in FOOTPRINTS}


def _candidates() -> list[tuple[str, int, int, int]]:
    """Expand footprints into placement candidates (part, w, d, rot), area-desc."""
    out: list[tuple[str, int, int, int]] = []
    for part, ax, az in FOOTPRINTS:
        out.append((part, ax, az, 0))
        if ax != az:
            out.append((part, az, ax, 90))   # rotated footprint
    out.sort(key=lambda c: c[1] * c[2], reverse=True)
    return out


_CANDIDATES = _candidates()


def _seam_lines(ids_below: np.ndarray) -> tuple[set, set]:
    """Vertical mortar joints in the layer below.

    xcuts = {(x, y)} a wall between columns x-1 and x at row y;
    ycuts = {(x, y)} a wall between rows y-1 and y at column x.
    A wall exists where two adjacent cells belong to different bricks (or one is
    empty) — those are the joints the next course should *not* stack on.
    """
    nx, ny = ids_below.shape
    xcuts: set = set()
    ycuts: set = set()
    for x in range(1, nx):
        for y in range(ny):
            a, b = ids_below[x - 1, y], ids_below[x, y]
            if a != b:
                xcuts.add((x, y))
    for x in range(nx):
        for y in range(1, ny):
            a, b = ids_below[x, y - 1], ids_below[x, y]
            if a != b:
                ycuts.add((x, y))
    return xcuts, ycuts


def _seam_penalty(x: int, y: int, w: int, d: int, xcuts: set, ycuts: set) -> int:
    """How many of a candidate's walls stack directly on a joint below."""
    pen = 0
    for yy in range(y, y + d):
        if (x, yy) in xcuts:          # left wall
            pen += 1
        if (x + w, yy) in xcuts:      # right wall
            pen += 1
    for xx in range(x, x + w):
        if (xx, y) in ycuts:          # near wall
            pen += 1
        if (xx, y + d) in ycuts:      # far wall
            pen += 1
    return pen


def split_and_merge(
    occ: np.ndarray, seed: int = 1, options: Optional[dict[str, Any]] = None
) -> list[tuple[str, int, int, int, int, int, int]]:
    """Cover `occ` layer-by-layer with legal bricks.

    Returns bricks as (part, x, y, z, rot, w, d). Coverage is exact: every
    occupied stud is covered exactly once, none added.
    """
    options = options or {}
    p_random = float(options.get("randomness", 0.12))   # controlled randomness
    seam_weight = float(options.get("seam_weight", 1.0))
    rng = random.Random(int(seed) & 0xFFFFFFFF)

    occ = occ.astype(bool)
    nx, ny, nz = occ.shape
    bricks: list[tuple[str, int, int, int, int, int, int]] = []
    ids_below: Optional[np.ndarray] = None   # brick index per cell, prev layer

    for z in range(nz):
        free = occ[:, :, z].copy()
        ids_here = np.full((nx, ny), -1, dtype=int)
        xcuts, ycuts = _seam_lines(ids_below) if ids_below is not None else (set(), set())

        # Anchor at each free region's min-corner in raster order — this is what
        # guarantees a full rectangle (e.g. a 2x2) is taken whole. Variety and
        # seam-staggering come from the footprint *choice* below, not the order.
        cells = [(int(x), int(y)) for x, y in np.argwhere(free)]
        for x, y in cells:
            if not free[x, y]:
                continue
            fits = []
            for part, w, d, rot in _CANDIDATES:
                if x + w <= nx and y + d <= ny and free[x:x + w, y:y + d].all():
                    pen = _seam_penalty(x, y, w, d, xcuts, ycuts)
                    fits.append((part, w, d, rot, w * d, pen))
            # `fits` is never empty — the 1x1 always fits.
            if rng.random() < p_random:
                part, w, d, rot, _, _ = rng.choice(fits)
            else:
                part, w, d, rot, _, _ = max(
                    fits, key=lambda c: c[4] - seam_weight * c[5]
                )
            free[x:x + w, y:y + d] = False
            ids_here[x:x + w, y:y + d] = len(bricks)
            bricks.append((part, x, y, z, rot, w, d))
        ids_below = ids_here

    return bricks


def parts_count(bricks: list) -> dict[str, int]:
    """Aggregate a parts list: {part_id: quantity}."""
    counts: dict[str, int] = {}
    for b in bricks:
        part = b.part if hasattr(b, "part") else b[0]
        counts[part] = counts.get(part, 0) + 1
    return counts
