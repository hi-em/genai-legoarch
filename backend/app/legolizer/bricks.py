"""Brick layout — cover an occupancy grid with legal LEGO brick footprints.

Real implementation (Luo et al., SIGGRAPH Asia 2015, extended with mixed
heights after Kim et al., CGI 2017): the grid's vertical axis is in PLATE
units (1 plate = 3.2 mm; 3 plates = 1 brick). Each plate-layer gets a greedy
two-pass split-and-merge:

  Pass 1 (bricks)  — anchor full-height bricks (3 plates tall) wherever a
                     colour-uniform 3-plate column is free, preferring large
                     footprints with a soft running-bond penalty that staggers
                     vertical seams against the layer below.
  Pass 2 (plates)  — pack whatever is left of the layer with plates; the 1x1
                     plate is the guaranteed terminal fallback, so the
                     silhouette is preserved exactly — never a cell added or
                     missed.
  Pass 3 (tiles)   — swap plates whose entire top face is exposed for studless
                     tiles: the LEGO Architecture signature finish for roofs,
                     terraces and plazas.

Emits pieces as (part, x, y, z, rot, w, d, h):
  (x, y) = min-corner grid cell of the footprint; z = bottom plate-layer
  rot    = 0 or 90, LDraw footprint rotation
  w, d   = footprint extent in grid-x / grid-y studs, as placed
  h      = height in plates (3 = brick, 1 = plate/tile)

Grid convention: occ[x, y, z]; z is the vertical (plate-layer) axis.
"""
from __future__ import annotations

import random
from typing import Any, Optional

import numpy as np

# Part IDs are LDraw part numbers (so `<part>.dat` resolves in Studio/LDView);
# for bricks and plates these match the BrickLink IDs, tiles carry the LDraw
# `b` suffix (groove variant — plain `3070.dat` does not exist).
PART_1x1 = "3005"
PART_1x2 = "3004"
PART_1x3 = "3622"
PART_1x4 = "3010"
PART_1x6 = "3009"
PART_1x8 = "3008"
PART_2x2 = "3003"
PART_2x3 = "3002"
PART_2x4 = "3001"
PART_2x6 = "2456"
PART_2x8 = "3007"

PLATE_1x1 = "3024"
PLATE_1x2 = "3023"
PLATE_1x3 = "3623"
PLATE_1x4 = "3710"
PLATE_1x6 = "3666"
PLATE_1x8 = "3460"
PLATE_2x2 = "3022"
PLATE_2x3 = "3021"
PLATE_2x4 = "3020"
PLATE_2x6 = "3795"
PLATE_2x8 = "3034"

TILE_1x1 = "3070b"
TILE_1x2 = "3069b"
TILE_1x3 = "63864"
TILE_1x4 = "2431"
TILE_2x2 = "3068b"
TILE_2x4 = "87079"

BRICK_H = 3   # brick height in plates
PLATE_H = 1

# (part, ax, az) native footprint in studs. The merge expands these into both
# orientations. Keep 1x1 last — it is the guaranteed terminal fallback.
FOOTPRINTS: list[tuple[str, int, int]] = [
    (PART_2x8, 2, 8),
    (PART_2x6, 2, 6),
    (PART_2x4, 2, 4),
    (PART_2x3, 2, 3),
    (PART_1x8, 1, 8),
    (PART_1x6, 1, 6),
    (PART_2x2, 2, 2),
    (PART_1x4, 1, 4),
    (PART_1x3, 1, 3),
    (PART_1x2, 1, 2),
    (PART_1x1, 1, 1),
]

FOOTPRINTS_PLATE: list[tuple[str, int, int]] = [
    (PLATE_2x8, 2, 8),
    (PLATE_2x6, 2, 6),
    (PLATE_2x4, 2, 4),
    (PLATE_2x3, 2, 3),
    (PLATE_1x8, 1, 8),
    (PLATE_1x6, 1, 6),
    (PLATE_2x2, 2, 2),
    (PLATE_1x4, 1, 4),
    (PLATE_1x3, 1, 3),
    (PLATE_1x2, 1, 2),
    (PLATE_1x1, 1, 1),
]

# placed footprint (w, d) -> studless tile part, for the pass-3 swap
TILE_EQUIV: dict[tuple[int, int], str] = {
    (1, 1): TILE_1x1,
    (1, 2): TILE_1x2,
    (2, 1): TILE_1x2,
    (1, 3): TILE_1x3,
    (3, 1): TILE_1x3,
    (1, 4): TILE_1x4,
    (4, 1): TILE_1x4,
    (2, 2): TILE_2x2,
    (2, 4): TILE_2x4,
    (4, 2): TILE_2x4,
}

TILE_PARTS = {TILE_1x1, TILE_1x2, TILE_1x3, TILE_1x4, TILE_2x2, TILE_2x4}

# tile -> studded plate of the same footprint (repair un-tiles pillar bases)
TILE_TO_PLATE: dict[str, str] = {
    TILE_1x1: PLATE_1x1,
    TILE_1x2: PLATE_1x2,
    TILE_1x3: PLATE_1x3,
    TILE_1x4: PLATE_1x4,
    TILE_2x2: PLATE_2x2,
    TILE_2x4: PLATE_2x4,
}

from . import slopes as _slopes  # noqa: E402  (leaf module: numpy only)

# Set of legal part ids, for validation/tests.
LEGAL_PARTS = (
    {p for p, _, _ in FOOTPRINTS}
    | {p for p, _, _ in FOOTPRINTS_PLATE}
    | TILE_PARTS
    | _slopes.SLOPE_PARTS
)


def _candidates(footprints: list[tuple[str, int, int]]) -> list[tuple[str, int, int, int]]:
    """Expand footprints into placement candidates (part, w, d, rot), area-desc."""
    out: list[tuple[str, int, int, int]] = []
    for part, ax, az in footprints:
        out.append((part, ax, az, 0))
        if ax != az:
            out.append((part, az, ax, 90))   # rotated footprint
    out.sort(key=lambda c: c[1] * c[2], reverse=True)
    return out


_BRICK_CANDIDATES = _candidates(FOOTPRINTS)
_PLATE_CANDIDATES = _candidates(FOOTPRINTS_PLATE)


def _seam_lines(ids_below: np.ndarray) -> tuple[set, set]:
    """Vertical mortar joints in the layer below.

    xcuts = {(x, y)} a wall between columns x-1 and x at row y;
    ycuts = {(x, y)} a wall between rows y-1 and y at column x.
    A wall exists where two adjacent cells belong to different pieces (or one is
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


def _code_uniform(box: np.ndarray) -> bool:
    """A piece may only span one quantized colour (wildcard -1 matches any)."""
    vals = box[box >= 0]
    return vals.size == 0 or bool((vals == vals.flat[0]).all())


def _code_compatible(box: np.ndarray, code_dist: np.ndarray, tol: float) -> bool:
    """A piece may span codes within `tol` CIEDE2000 of its dominant code.

    Relaxes _code_uniform: rather than forcing a 1x1 boundary at every
    quantization speck, a footprint absorbs near-identical neighbours (the
    piece is later coloured by its dominant code, so no colour is invented).
    At tol <= 0 this reduces exactly to _code_uniform.
    """
    vals = box[box >= 0]
    if vals.size == 0:
        return True
    idx, counts = np.unique(vals, return_counts=True)
    if idx.size == 1:
        return True
    if tol <= 0:
        return False
    dom = idx[int(np.argmax(counts))]
    return bool((code_dist[dom, idx] <= tol).all())


def split_and_merge(
    occ: np.ndarray,
    code: Optional[np.ndarray] = None,
    seed: int = 1,
    options: Optional[dict[str, Any]] = None,
    merge_tol: float = 0.0,
    code_dist: Optional[np.ndarray] = None,
) -> list[tuple[str, int, int, int, int, int, int, int]]:
    """Cover `occ` (plate-unit z) with bricks, plates and top tiles.

    `code` is an optional (nx, ny, nz) int grid of quantized palette indices
    (-1 = unsampled wildcard); by default pieces never span two different codes,
    so colour boundaries in the generated model survive into the build.
    `merge_tol` (> 0, with `code_dist` the palette's code-to-code CIEDE2000
    matrix) lets a piece span codes that close, healing texture-noise confetti
    without crossing real colour edges.

    Returns pieces as (part, x, y, z, rot, w, d, h). Coverage is exact: every
    occupied cell is covered exactly once, none added.
    """
    options = options or {}
    p_random = float(options.get("randomness", 0.12))   # controlled randomness
    seam_weight = float(options.get("seam_weight", 1.0))
    tile_tops = bool(options.get("tile_tops", True))
    merge_tol = float(options.get("merge_tol", merge_tol))
    use_tol = merge_tol > 0 and code_dist is not None
    rng = random.Random(int(seed) & 0xFFFFFFFF)

    occ = occ.astype(bool)
    nx, ny, nz = occ.shape
    if code is None:
        code = np.full((nx, ny, nz), -1, dtype=int)

    free = occ.copy()
    ids = np.full((nx, ny, nz), -1, dtype=int)          # piece id per CELL (3D)
    # exposed = occupied with nothing directly above (from the ORIGINAL grid):
    # these are the visible top skins that pass 3 turns into tiles.
    exposed = occ.copy()
    exposed[:, :, :-1] &= ~occ[:, :, 1:]

    pieces: list[list] = []

    # ---- pass 1.5 (runs FIRST): bevel one-course roof steps with real 45°
    # slope bricks. Their cells leave the free mask, so the rectangular
    # passes pack around them untouched.
    if bool(options.get("slopes", True)):
        slope_pieces, _consumed = _slopes.place_slopes(occ, code)
        for sp in slope_pieces:
            part, sx, sy, sz, rot, w, d, h = sp
            free[sx:sx + w, sy:sy + d, sz:sz + h] = False
            ids[sx:sx + w, sy:sy + d, sz:sz + h] = len(pieces)
            pieces.append(sp)

    def _greedy_pass(zp: int, mask: np.ndarray, candidates, h: int,
                     xcuts: set, ycuts: set, terminal_1x1: bool) -> None:
        cells = [(int(x), int(y)) for x, y in np.argwhere(mask)]
        for x, y in cells:
            if not mask[x, y]:
                continue
            fits = []
            for part, w, d, rot in candidates:
                if not (x + w <= nx and y + d <= ny and mask[x:x + w, y:y + d].all()):
                    continue
                box = code[x:x + w, y:y + d, zp:zp + h]
                code_ok = (
                    _code_compatible(box, code_dist, merge_tol) if use_tol
                    else _code_uniform(box)
                )
                if code_ok:
                    pen = _seam_penalty(x, y, w, d, xcuts, ycuts)
                    fits.append((part, w, d, rot, w * d, pen))
            if not fits:
                if terminal_1x1:
                    raise AssertionError("1x1 must always fit")  # pragma: no cover
                continue        # brick pass: leftovers fall through to plates
            if rng.random() < p_random:
                part, w, d, rot, _, _ = rng.choice(fits)
            else:
                part, w, d, rot, _, _ = max(fits, key=lambda c: c[4] - seam_weight * c[5])
            mask[x:x + w, y:y + d] = False
            free[x:x + w, y:y + d, zp:zp + h] = False
            ids[x:x + w, y:y + d, zp:zp + h] = len(pieces)
            pieces.append([part, x, y, zp, rot, w, d, h])

    for zp in range(nz):
        xcuts, ycuts = _seam_lines(ids[:, :, zp - 1]) if zp > 0 else (set(), set())

        # ---- pass 1: full-height bricks anchored with their bottom at zp ----
        if zp + BRICK_H <= nz:
            brickable = free[:, :, zp] & free[:, :, zp + 1] & free[:, :, zp + 2]
            if tile_tops:
                # keep the visible top skin out of brick bodies so it stays a
                # separate plate that pass 3 can swap for a studless tile
                brickable &= ~exposed[:, :, zp + BRICK_H - 1]
            _greedy_pass(zp, brickable, _BRICK_CANDIDATES, BRICK_H,
                         xcuts, ycuts, terminal_1x1=False)

        # ---- pass 2: plates on whatever is left of this layer ----
        _greedy_pass(zp, free[:, :, zp].copy(), _PLATE_CANDIDATES, PLATE_H,
                     xcuts, ycuts, terminal_1x1=True)

    # ---- pass 3: swap fully-exposed plates for studless tiles ----
    if tile_tops:
        plate_parts = {p for p, _, _ in FOOTPRINTS_PLATE}
        for piece in pieces:
            part, x, y, zp, rot, w, d, h = piece
            if (
                h == PLATE_H
                and part in plate_parts
                and (w, d) in TILE_EQUIV
                and exposed[x:x + w, y:y + d, zp].all()
            ):
                piece[0] = TILE_EQUIV[(w, d)]

    return [tuple(p) for p in pieces]


def parts_count(bricks: list) -> dict[str, int]:
    """Aggregate a parts list: {part_id: quantity}."""
    counts: dict[str, int] = {}
    for b in bricks:
        part = b.part if hasattr(b, "part") else b[0]
        counts[part] = counts.get(part, 0) + 1
    return counts
