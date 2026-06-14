"""Tests for the Track-B colour-consistency metrics (metrics.py)."""
import numpy as np

from app.legolizer import color as _color
from app.legolizer import metrics as _m
from app.legolizer import Brick


def _onehot(i: int, n: int) -> np.ndarray:
    h = np.zeros(n)
    h[i] = 1.0
    return h


def test_palette_share_identical_is_one():
    pal, _ = _color.resolve_palette("classic")
    h = _onehot(0, len(pal))
    assert _m.palette_share(h, h, "classic") == 1.0


def test_palette_share_rewards_perceptually_near():
    """A build one palette step off the render must score higher than a build
    on a perceptually distant colour — the whole point of the CIEDE2000 kernel."""
    dist = _color.palette_code_distances("classic")
    n = dist.shape[0]
    target = 0
    near = int(np.argsort(dist[target])[1])         # closest other colour
    far = int(np.argmax(dist[target]))              # most distant colour
    r = _onehot(target, n)
    near_score = _m.palette_share(r, _onehot(near, n), "classic")
    far_score = _m.palette_share(r, _onehot(far, n), "classic")
    assert near_score > far_score


def test_shatter_stats_counts_1x1_and_colors():
    bricks = [
        Brick(part="3005", x=0, y=0, z=0, color=15, w=1, d=1, h=1),   # 1x1 white
        Brick(part="3005", x=1, y=0, z=0, color=15, w=1, d=1, h=1),   # 1x1 white
        Brick(part="3001", x=0, y=0, z=1, color=71, w=2, d=4, h=3),   # 2x4 grey
    ]
    s = _m.shatter_stats(bricks)
    assert s["n_pieces"] == 3
    assert s["n_colors"] == 2
    assert abs(s["frac_1x1"] - 2 / 3) < 1e-9


def test_build_hist_is_area_weighted():
    pal, _ = _color.resolve_palette("classic")
    idx_of = {p[0]: i for i, p in enumerate(pal)}
    bricks = [
        Brick(part="3005", x=0, y=0, z=0, color=15, w=1, d=1, h=1),   # area 1
        Brick(part="3001", x=0, y=0, z=1, color=71, w=2, d=4, h=3),   # area 8
    ]
    h = _m.build_hist(bricks, "classic")
    # the 2x4 piece dominates the histogram by footprint area, not piece count
    assert h[idx_of[71]] > h[idx_of[15]]
    assert abs(h.sum() - 1.0) < 1e-9
