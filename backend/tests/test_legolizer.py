"""Tests for the custom legolizer (runs without ComfyUI)."""
import numpy as np

from app.legolizer import legolize_voxelgrid
from app.legolizer.bricks import LEGAL_PARTS, split_and_merge
from app.legolizer.color import nearest_lego_color
from app.legolizer.ldraw import write_ldr


def _solid_box(nx=3, ny=3, nz=2) -> np.ndarray:
    return np.ones((nx, ny, nz), dtype=bool)


def _coverage(model) -> int:
    """Total studs covered by all bricks (footprint areas summed)."""
    return sum(b.w * b.d for b in model.bricks)


def test_coverage_equals_voxel_count():
    occ = _solid_box(5, 4, 3)
    model = legolize_voxelgrid(_occupancy=occ)
    assert _coverage(model) == int(occ.sum())      # exact silhouette, nothing lost/added
    assert model.grid == (5, 4, 3)


def test_merge_uses_fewer_larger_bricks_than_1x1():
    occ = _solid_box(6, 6, 3)
    model = legolize_voxelgrid(_occupancy=occ)
    # a real merge must beat the 1x1-per-voxel baseline substantially
    assert len(model.bricks) < int(occ.sum())
    assert any((b.w * b.d) > 1 for b in model.bricks)


def test_all_footprints_are_legal():
    occ = _solid_box(7, 5, 4)
    model = legolize_voxelgrid(_occupancy=occ)
    for b in model.bricks:
        assert b.part in LEGAL_PARTS
        assert (b.w, b.d) != (0, 0)


def test_no_overlapping_footprints():
    occ = _solid_box(6, 5, 3)
    model = legolize_voxelgrid(_occupancy=occ)
    seen = set()
    for b in model.bricks:
        for dx in range(b.w):
            for dy in range(b.d):
                cell = (b.x + dx, b.y + dy, b.z)
                assert cell not in seen          # each stud covered exactly once
                seen.add(cell)
    assert len(seen) == int(occ.sum())


def test_single_2x2_layer_merges_to_one_brick():
    occ = np.ones((2, 2, 1), dtype=bool)
    model = legolize_voxelgrid(_occupancy=occ)
    assert len(model.bricks) == 1
    assert model.bricks[0].part == "3003"        # Brick 2 x 2


def test_deterministic_under_fixed_seed():
    occ = _solid_box(6, 6, 4)
    a = legolize_voxelgrid(_occupancy=occ, options={"seed": 42})
    b = legolize_voxelgrid(_occupancy=occ, options={"seed": 42})
    sig = lambda m: [(x.part, x.x, x.y, x.z, x.rot, x.w, x.d) for x in m.bricks]
    assert sig(a) == sig(b)


def test_solid_box_is_connected_and_supported():
    model = legolize_voxelgrid(_occupancy=_solid_box())
    assert model.stability["connected"] is True
    assert model.stability["n_components"] == 1
    assert model.stability["support_ratio"] == 1.0


def test_floating_brick_breaks_connectivity():
    occ = np.zeros((3, 3, 3), dtype=bool)
    occ[0, 0, 0] = True
    occ[2, 2, 2] = True                          # disconnected island
    model = legolize_voxelgrid(_occupancy=occ)
    assert model.stability["connected"] is False
    assert model.stability["n_components"] == 2


def test_nearest_lego_color_picks_white_and_red():
    assert nearest_lego_color((255, 255, 255)) == 15      # exact White
    assert nearest_lego_color((200, 20, 10)) == 4         # Red
    assert nearest_lego_color((30, 90, 168)) == 1         # Blue


def test_ldraw_export_is_valid(tmp_path):
    model = legolize_voxelgrid(_occupancy=_solid_box(4, 4, 2))
    out = tmp_path / "model.ldr"
    write_ldr(model.bricks, str(out))
    text = out.read_text()
    lines = [l for l in text.splitlines() if l.startswith("1 ")]
    assert len(lines) == len(model.bricks)       # one type-1 line per brick
    # each type-1 line: "1 color x y z + 9 matrix + part.dat" = 15 tokens
    assert all(len(l.split()) == 15 for l in lines)


def test_split_and_merge_raw_tuple_shape():
    occ = _solid_box(3, 3, 1)
    bricks = split_and_merge(occ, seed=1)
    assert all(len(b) == 7 for b in bricks)      # (part,x,y,z,rot,w,d)
