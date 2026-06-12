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

from . import bricks as _bricks
from . import color as _color
from . import repair as _repair
from . import stability as _stability


@dataclass
class Brick:
    part: str          # LDraw part id, e.g. "3005" (1x1 brick), "3024" (1x1 plate)
    x: int             # grid coords; (x,y) = footprint min-corner in studs
    y: int
    z: int             # bottom PLATE layer (1 plate = 3.2 mm; 3 plates = 1 brick)
    color: int = 15    # LDraw color code (15 = white)
    rot: int = 0       # 0/90 footprint rotation
    w: int = 1         # footprint extent along grid-x (studs), as placed
    d: int = 1         # footprint extent along grid-y (studs), as placed
    h: int = 3         # height in plates (3 = brick, 1 = plate/tile)


@dataclass
class BrickModel:
    bricks: list[Brick] = field(default_factory=list)
    grid: tuple[int, int, int] = (0, 0, 0)   # (studs, studs, PLATE layers)
    unit_mm: float = 8.0                     # horizontal stud pitch
    plate_mm: float = 3.2                    # vertical plate height
    z_unit: str = "plate"                    # schema marker (frontend back-compat)
    stability: dict[str, Any] = field(default_factory=dict)
    parts_list: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["grid"] = list(self.grid)
        return d


def legolize_voxelgrid(
    image_url: Optional[str] = None,
    unit_mm: float = 8.0,
    options: Optional[dict[str, Any]] = None,
    _occupancy: Optional[np.ndarray] = None,
    voxel_rgb: Optional[np.ndarray] = None,
) -> BrickModel:
    """Convert a voxel occupancy grid into a buildable BrickModel.

    The grid's z axis is in PLATE units (3 plates = 1 brick course); the packer
    mixes full bricks, plates and studless top tiles. `_occupancy` is a 3D
    bool ndarray; `voxel_rgb` (nx,ny,nz,3 uint8) enables real colour matching
    to the generated model.
    """
    options = options or {}

    if _occupancy is None:
        raise ValueError("Provide _occupancy")
    occ = _occupancy.astype(bool)

    seed = int(options.get("seed", 1))
    tier = str(options.get("palette", _color.DEFAULT_TIER))
    # Quantize colours BEFORE packing so pieces respect colour boundaries
    # (escape hatch: color_strict=False reverts to average-after-pack).
    code = None
    if voxel_rgb is not None and options.get("color_strict", True):
        code = _color.quantize_voxels(
            voxel_rgb, tier=tier,
            smooth_iters=int(options.get("smooth_iters", 1)),
        )
    raw_bricks = _bricks.split_and_merge(occ, code=code, seed=seed, options=options)
    colors = _color.assign_colors(
        raw_bricks, occ, image_url, seed=seed, voxel_rgb=voxel_rgb, code=code,
        tier=tier,
    )

    model = BrickModel(
        bricks=[Brick(part=p, x=x, y=y, z=z, color=c, rot=r, w=w, d=d, h=h)
                for (p, x, y, z, r, w, d, h), c in zip(raw_bricks, colors)],
        grid=tuple(int(s) for s in occ.shape),
        unit_mm=unit_mm,
    )
    # Testuz-style repair: ground every floating component with hidden 1x1
    # pillars (hollow shells make these possible), then report honestly.
    repair_stats = {}
    if options.get("repair", True):
        repair_stats = _repair.repair_connectivity(model, Brick, tier=tier)
    model.stability = {**_stability.analyze(model), **repair_stats}
    model.parts_list = _bricks.parts_count(model.bricks)
    return model


__all__ = ["Brick", "BrickModel", "legolize_voxelgrid"]
