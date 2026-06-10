"""Buildability checks.

Two things a real build needs beyond "looks right":
  1. Single connected component — no floating disconnected bricks.
  2. Support / stability — bricks shouldn't cantilever past what studs can hold.

Shipping now: connectivity via 6-neighbour flood (vertical + horizontal contact)
and a simple per-layer support ratio. Upgrade path = StableLego Rigid Block
Equilibrium per-brick score V_i (arXiv 2402.10711); see docs/research.md.
"""
from __future__ import annotations

from typing import Any

import numpy as np
from scipy import ndimage


def _occupancy_from_model(model) -> np.ndarray:
    nx, ny, nz = model.grid
    occ = np.zeros((nx, ny, nz), dtype=bool)
    for b in model.bricks:
        w = getattr(b, "w", 1)
        d = getattr(b, "d", 1)
        occ[b.x:b.x + w, b.y:b.y + d, b.z] = True
    return occ


def analyze(model) -> dict[str, Any]:
    """Return connectivity + a coarse support metric for the BrickModel."""
    if not model.bricks:
        return {"connected": True, "n_components": 0, "support_ratio": 1.0,
                "n_bricks": 0, "unsupported_layers": []}

    occ = _occupancy_from_model(model)

    # 1) connectivity (6-neighbour)
    structure = ndimage.generate_binary_structure(3, 1)
    labels, n = ndimage.label(occ, structure=structure)
    connected = n <= 1

    # 2) coarse support: a voxel above the base needs a voxel directly below it
    nx, ny, nz = occ.shape
    supported = 0
    total_above = 0
    unsupported_layers: list[int] = []
    for z in range(1, nz):
        layer = occ[:, :, z]
        below = occ[:, :, z - 1]
        need = layer
        has = layer & below
        total_above += int(need.sum())
        supported += int(has.sum())
        if need.sum() > 0 and has.sum() < need.sum():
            unsupported_layers.append(z)
    support_ratio = 1.0 if total_above == 0 else supported / total_above

    return {
        "connected": bool(connected),
        "n_components": int(n),
        "support_ratio": round(float(support_ratio), 3),
        "n_bricks": len(model.bricks),
        "unsupported_layers": unsupported_layers,
    }
