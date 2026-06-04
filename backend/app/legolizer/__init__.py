"""Custom legolizer — the computational centerpiece.

Pipeline:  voxel grid -> legal brick layout -> per-brick color -> checks -> LDraw.

This package intentionally reuses *published algorithms* (Luo 2015 split-and-merge,
StableLego stability, CIEDE2000 color) but owns the integration and the
architecture-domain application. See ../../docs/research.md.

The orchestrator below returns a `BrickModel`. Sub-steps live in the sibling
modules and currently ship as working-but-minimal implementations (1x1 baseline)
to be upgraded toward the cited methods.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional

import numpy as np

from . import voxelize as _voxelize
from . import bricks as _bricks
from . import color as _color
from . import stability as _stability


@dataclass
class Brick:
    part: str          # e.g. "3005" (1x1), "3004" (1x2) — BrickLink part IDs
    x: int             # grid coords (studs / plates)
    y: int
    z: int
    color: int = 15    # LDraw color code (15 = white)
    rot: int = 0       # 0/90 footprint rotation


@dataclass
class BrickModel:
    bricks: list[Brick] = field(default_factory=list)
    grid: tuple[int, int, int] = (0, 0, 0)
    unit_mm: float = 8.0
    stability: dict[str, Any] = field(default_factory=dict)
    parts_list: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["grid"] = list(self.grid)
        return d


def legolize_voxelgrid(
    voxelgrid_npz_url: Optional[str] = None,
    image_url: Optional[str] = None,
    unit_mm: float = 8.0,
    options: Optional[dict[str, Any]] = None,
    _occupancy: Optional[np.ndarray] = None,
) -> BrickModel:
    """Convert a voxel occupancy grid into a buildable BrickModel.

    Pass `_occupancy` directly (a 3D bool ndarray) to bypass IO in tests.
    """
    options = options or {}

    if _occupancy is not None:
        occ = _occupancy.astype(bool)
    elif voxelgrid_npz_url is not None:
        occ = _voxelize.load_voxelgrid(voxelgrid_npz_url)
    else:
        raise ValueError("Provide voxelgrid_npz_url or _occupancy")

    raw_bricks = _bricks.split_and_merge(occ)           # [(part,x,y,z,rot), ...]
    colors = _color.assign_colors(raw_bricks, occ, image_url)

    model = BrickModel(
        bricks=[Brick(part=p, x=x, y=y, z=z, color=c, rot=r)
                for (p, x, y, z, r), c in zip(raw_bricks, colors)],
        grid=tuple(int(s) for s in occ.shape),
        unit_mm=unit_mm,
    )
    model.stability = _stability.analyze(model)
    model.parts_list = _bricks.parts_count(model.bricks)
    return model


__all__ = ["Brick", "BrickModel", "legolize_voxelgrid"]
