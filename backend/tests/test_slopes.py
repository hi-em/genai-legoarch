"""Slope pass tests (Sprint 2): staircase detection -> 45-degree bevels."""
import numpy as np

from app.legolizer import legolize_voxelgrid
from app.legolizer.slopes import SLOPE_PARTS, place_slopes


def _ziggurat(levels=3, base=12, course=3):
    """Square stepped pyramid: each level inset by 1 stud, 1 course tall."""
    n = base
    occ = np.zeros((n, n, levels * course), dtype=bool)
    for lv in range(levels):
        occ[lv:n - lv, lv:n - lv, lv * course:(lv + 1) * course] = True
    return occ


def test_ziggurat_grows_slopes_on_all_sides():
    occ = _ziggurat()
    pieces, consumed = place_slopes(occ)
    assert pieces, "stepped pyramid must produce slopes"
    rots = {p[4] for p in pieces}
    assert rots == {0, 90, 180, 270}, f"all four downhill directions: {rots}"
    assert all(p[0] in SLOPE_PARTS for p in pieces)
    assert all(p[7] == 3 for p in pieces)          # 45s are brick height
    # consumed cells are exactly the pieces' footprints
    total = sum(p[5] * p[6] * p[7] for p in pieces)
    assert consumed.sum() == total


def test_slope_pieces_prefer_wide_parts():
    occ = _ziggurat(levels=2, base=10)
    pieces, _ = place_slopes(occ)
    widths = sorted({max(p[5], p[6]) for p in pieces}, reverse=True)
    assert widths[0] >= 4, "long straight edges should merge into 2x4 slopes"


def test_flat_slab_gets_no_slopes():
    occ = np.ones((6, 6, 3), dtype=bool)
    pieces, consumed = place_slopes(occ)
    assert pieces == [] and not consumed.any()


def test_one_stud_wall_bevels_only_along_the_ridge():
    """A 1-stud-thick wall: gable ENDS may take slopes (seat exists along the
    ridge) but never ACROSS the wall (no seat, and the drop is a cliff)."""
    occ = np.zeros((8, 3, 6), dtype=bool)
    occ[:, 1, 0:3] = True          # base wall, 1 stud thick
    occ[2:6, 1, 3:6] = True        # upper level of the wall
    pieces, _ = place_slopes(occ)
    assert pieces, "gable ends should bevel"
    for p in pieces:
        assert p[4] in (0, 180), f"slope across the thin wall is illegal: {p}"
        assert p[6] == 1            # d=1: rides the ridge, never overhangs


def test_full_pipeline_with_slopes_covers_exactly():
    occ = _ziggurat()
    model = legolize_voxelgrid(_occupancy=occ, options={"seed": 1})
    parts_used = {b.part for b in model.bricks}
    assert parts_used & SLOPE_PARTS, "pipeline output should include slopes"
    # exact coverage: rebuild occupancy from pieces, compare to input
    rebuilt = np.zeros_like(occ)
    for b in model.bricks:
        region = rebuilt[b.x:b.x + b.w, b.y:b.y + b.d, b.z:b.z + b.h]
        assert not region.any(), "pieces must not overlap"
        rebuilt[b.x:b.x + b.w, b.y:b.y + b.d, b.z:b.z + b.h] = True
    assert (rebuilt == occ).all(), "exact coverage including slope cells"


def test_slopes_can_be_disabled():
    occ = _ziggurat()
    model = legolize_voxelgrid(_occupancy=occ, options={"seed": 1, "slopes": False})
    assert not ({b.part for b in model.bricks} & SLOPE_PARTS)


def test_no_slope_seated_over_a_void():
    """Review finding (critical): `top >= c` accepted overhang seat columns
    hollow at exactly course c — the slope's seat hung in air and the piece
    claimed cells the model never had."""
    occ = np.zeros((4, 3, 9), dtype=bool)
    occ[:, :, 0:3] = True          # grounded slab (course 0)
    occ[2, 1, 3:6] = True          # edge ridge at course 1
    occ[1, 1, 6:9] = True          # seat column: filled course 0 and 2 only —
    #                                course 1 (the seat course) stays VOID
    pieces, consumed = place_slopes(occ)
    for p in pieces:
        x, y, z, w, d, h = p[1], p[2], p[3], p[5], p[6], p[7]
        assert occ[x:x + w, y:y + d, z:z + h].all(), (
            f"slope {p} occupies cells the model never had"
        )
    # and the model-level invariant holds end to end (repair off: the fixture
    # floats its overhang on purpose, and pillars legitimately ADD material)
    model = legolize_voxelgrid(_occupancy=occ, options={"seed": 1, "repair": False})
    rebuilt = np.zeros_like(occ)
    for b in model.bricks:
        rebuilt[b.x:b.x + b.w, b.y:b.y + b.d, b.z:b.z + b.h] = True
    assert (rebuilt == occ).all()


def test_no_slope_under_partial_plates():
    """Review finding (major): partial plates above the top FULL course are
    invisible to course math — a slope under them leaves plates floating on
    the slanted face."""
    occ = np.zeros((6, 3, 8), dtype=bool)
    occ[:, :, 0:3] = True          # lower level
    occ[2:6, :, 3:6] = True        # upper level -> step edge at x=2 (downhill -x)
    occ[2, 1, 6] = True            # ONE extra plate above the step edge cell
    pieces, _ = place_slopes(occ)
    for p in pieces:
        x, y, w, d = p[1], p[2], p[5], p[6]
        assert not (x <= 2 < x + w and y <= 1 < y + d), (
            f"slope {p} placed under an overhanging plate"
        )


def test_slopes_respect_color_boundaries():
    occ = _ziggurat(levels=2, base=10)
    rgb = np.zeros(occ.shape + (3,), dtype=np.uint8)
    rgb[:5, :, :] = (201, 26, 9)     # red half
    rgb[5:, :, :] = (255, 255, 255)  # white half
    model = legolize_voxelgrid(
        _occupancy=occ, voxel_rgb=rgb, options={"seed": 1, "palette": "classic"}
    )
    slope_bricks = [b for b in model.bricks if b.part in SLOPE_PARTS]
    assert slope_bricks
    # no slope may straddle the colour boundary at x=5 (runs split on colour)
    for b in slope_bricks:
        assert not (b.x < 5 and b.x + b.w > 5), (
            f"slope {b.part} at x={b.x} w={b.w} straddles the colour boundary"
        )
