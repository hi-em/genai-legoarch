"""Brick layout — cover an occupancy grid with legal brick footprints.

Baseline (shipping now): one 1x1 brick per occupied voxel. Correct and buildable,
just inefficient. Upgrade path = Luo et al. (SIGGRAPH Asia 2015) split-and-merge:
greedily merge coplanar 1x1s into larger legal footprints (1x2, 1x4, 2x2, 2x4...)
with controlled randomness, then a refinement loop that re-merges the weakest
region (see stability.py). Tracked in docs/research.md.

Grid convention: occ[x, y, z]; z is the vertical (layer) axis.
"""
from __future__ import annotations

import numpy as np

# BrickLink part IDs for common footprints (height = 1 brick).
PART_1x1 = "3005"
PART_1x2 = "3004"
PART_2x2 = "3003"
PART_2x4 = "3001"

# footprint sizes in studs, ordered largest-first for the greedy merge
FOOTPRINTS = [
    (PART_2x4, 2, 4),
    (PART_2x2, 2, 2),
    (PART_1x2, 1, 2),
    (PART_1x1, 1, 1),
]


def split_and_merge(occ: np.ndarray) -> list[tuple[str, int, int, int, int]]:
    """Return bricks as (part, x, y, z, rot). Baseline = one 1x1 per voxel.

    TODO (M2): replace the baseline with the real greedy merge over each z-layer.
    """
    bricks: list[tuple[str, int, int, int, int]] = []
    nx, ny, nz = occ.shape
    for z in range(nz):
        for x in range(nx):
            for y in range(ny):
                if occ[x, y, z]:
                    bricks.append((PART_1x1, x, y, z, 0))
    return bricks


def parts_count(bricks: list) -> dict[str, int]:
    """Aggregate a parts list: {part_id: quantity}."""
    counts: dict[str, int] = {}
    for b in bricks:
        part = b.part if hasattr(b, "part") else b[0]
        counts[part] = counts.get(part, 0) + 1
    return counts
