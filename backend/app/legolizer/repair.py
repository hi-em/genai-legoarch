"""Connectivity repair — Testuz, Schwartzburg & Pauly 2013 style.

Hollow shells (and the odd TRELLIS artifact) can pack into a model whose
voxel graph has floating components: geometry with nothing under it all the
way down. Real LEGO sets solve this with hidden internal supports, and so do
we: for every component not anchored to the ground we drop a 1x1 pillar from
its best column down to whatever is below (another component or the ground),
colour-matched to the piece it supports. Honest stats are returned so the UI
can say "3 hidden supports added" instead of pretending.
"""
from __future__ import annotations

from typing import Any, Optional

import numpy as np

from . import color as _color
from .bricks import TILE_TO_PLATE

PILLAR_BRICK = "3005"   # 1x1 brick (3 plates)
PILLAR_PLATE = "3024"   # 1x1 plate (1 plate)


def _grids_from_model(grid_shape, bricks) -> tuple[np.ndarray, np.ndarray]:
    """Rebuild occupancy + per-cell colour from packed pieces."""
    nx, ny, nz = grid_shape
    occ = np.zeros((nx, ny, nz), dtype=bool)
    col = np.full((nx, ny, nz), 15, dtype=int)
    for b in bricks:
        occ[b.x:b.x + b.w, b.y:b.y + b.d, b.z:b.z + b.h] = True
        col[b.x:b.x + b.w, b.y:b.y + b.d, b.z:b.z + b.h] = b.color
    return occ, col


def repair_connectivity(model, brick_cls, tier: Optional[str] = None) -> dict[str, Any]:
    """Append support pillars until every component chains to the ground.

    Mutates model.bricks in place. Returns stats for the stability dict.
    `brick_cls` is the Brick dataclass (passed in to avoid a circular import).
    Pillar colours are clamped to colours the 1x1 moulds actually exist in,
    and a pillar landing on a studless tile converts that tile back to its
    plate equivalent — bricks cannot clutch onto a tile.
    """
    from scipy import ndimage

    if not model.bricks:
        return {"pillars_added": 0, "components_before": 0, "components_after": 0}

    occ, col = _grids_from_model(model.grid, model.bricks)
    structure = ndimage.generate_binary_structure(3, 1)
    labels, n_before = ndimage.label(occ, structure=structure)
    grounded = set(np.unique(labels[:, :, 0])) - {0}
    floating = [l for l in range(1, n_before + 1) if l not in grounded]

    # bottom-up: lower components get grounded first, so a higher float that
    # lands its pillar on one of them is transitively grounded too
    floating.sort(key=lambda l: int(np.argwhere(labels == l)[:, 2].min()))

    pillars = 0
    for lab in floating:
        cells = np.argwhere(labels == lab)
        # candidate columns: the component's lowest cell per (x, y)
        best = None  # (gap, x, y, z_lo, z_below_top)
        cols: dict[tuple[int, int], int] = {}
        for x, y, z in cells:
            key = (int(x), int(y))
            if key not in cols or z < cols[key]:
                cols[key] = int(z)
        for (x, y), z_lo in cols.items():
            below = np.where(occ[x, y, :z_lo])[0]
            z_top = int(below[-1]) if below.size else -1
            gap = z_lo - z_top - 1
            if gap > 0 and (best is None or gap < best[0]):
                best = (gap, x, y, z_lo, z_top)
        if best is None:
            continue  # touches something after an earlier pillar — already fine
        gap, x, y, z_lo, z_top = best
        color = int(col[x, y, z_lo])
        # the colour was clamped for the NEIGHBOUR's mould, not for a 1x1 —
        # snap it to a colour the pillar parts really exist in
        color = _color.clamp_to_available(
            [(PILLAR_BRICK, x, y, 0, 0, 1, 1, 3)], [color], tier=tier
        )[0]
        # a pillar cannot clutch a studless tile: if it lands on one, give
        # that piece its studs back (tile -> same-footprint plate)
        if z_top >= 0:
            for piece in model.bricks:
                if (
                    piece.part in TILE_TO_PLATE
                    and piece.x <= x < piece.x + piece.w
                    and piece.y <= y < piece.y + piece.d
                    and piece.z <= z_top < piece.z + piece.h
                ):
                    piece.part = TILE_TO_PLATE[piece.part]
                    break
        z = z_top + 1
        n_bricks, n_plates = divmod(gap, 3)
        for _ in range(n_bricks):
            model.bricks.append(brick_cls(part=PILLAR_BRICK, x=x, y=y, z=z,
                                          color=color, rot=0, w=1, d=1, h=3))
            occ[x, y, z:z + 3] = True
            z += 3
            pillars += 1
        for _ in range(n_plates):
            model.bricks.append(brick_cls(part=PILLAR_PLATE, x=x, y=y, z=z,
                                          color=color, rot=0, w=1, d=1, h=1))
            occ[x, y, z] = True
            z += 1
            pillars += 1

    _, n_after = ndimage.label(occ, structure=structure)
    return {
        "pillars_added": int(pillars),
        "components_before": int(n_before),
        "components_after": int(n_after),
    }
