"""Tests for the custom legolizer (runs without ComfyUI).

Grid convention: occ[x, y, z] with z in PLATE units (3 plates = 1 brick).
"""
import numpy as np

from app.legolizer import legolize_voxelgrid
from app.legolizer.bricks import (
    LEGAL_PARTS, TILE_PARTS, TILE_EQUIV, split_and_merge,
)
from app.legolizer.color import nearest_lego_color, quantize_voxels
from app.legolizer.ldraw import brick_to_ldraw_line, write_ldr


def _solid_box(nx=3, ny=3, nz=6) -> np.ndarray:
    return np.ones((nx, ny, nz), dtype=bool)


def _coverage(model) -> int:
    """Total cells covered by all pieces (footprint area x height summed)."""
    return sum(b.w * b.d * b.h for b in model.bricks)


def test_coverage_equals_voxel_count():
    occ = _solid_box(5, 4, 7)
    model = legolize_voxelgrid(_occupancy=occ)
    assert _coverage(model) == int(occ.sum())      # exact silhouette, nothing lost/added
    assert model.grid == (5, 4, 7)
    assert model.z_unit == "plate"


def test_merge_uses_fewer_larger_pieces_than_1x1():
    occ = _solid_box(6, 6, 6)
    model = legolize_voxelgrid(_occupancy=occ)
    # a real merge must beat the 1x1-plate-per-voxel baseline substantially
    assert len(model.bricks) < int(occ.sum())
    assert any((b.w * b.d) > 1 for b in model.bricks)


def test_solid_box_packs_full_bricks():
    occ = _solid_box(4, 4, 6)
    model = legolize_voxelgrid(_occupancy=occ)
    assert any(b.h == 3 for b in model.bricks)     # bricks in the body
    assert any(b.h == 1 for b in model.bricks)     # plates/tiles at the top skin


def test_flat_slab_packs_only_plates_and_tiles():
    occ = np.ones((4, 4, 1), dtype=bool)
    model = legolize_voxelgrid(_occupancy=occ)
    assert all(b.h == 1 for b in model.bricks)


def test_all_footprints_are_legal():
    occ = _solid_box(7, 5, 8)
    model = legolize_voxelgrid(_occupancy=occ)
    for b in model.bricks:
        assert b.part in LEGAL_PARTS
        assert (b.w, b.d) != (0, 0)


def test_no_overlapping_footprints_in_3d():
    occ = _solid_box(6, 5, 6)
    model = legolize_voxelgrid(_occupancy=occ)
    seen = set()
    for b in model.bricks:
        for dx in range(b.w):
            for dy in range(b.d):
                for dz in range(b.h):
                    cell = (b.x + dx, b.y + dy, b.z + dz)
                    assert cell not in seen        # each cell covered exactly once
                    seen.add(cell)
    assert len(seen) == int(occ.sum())


def test_single_2x2_slab_becomes_one_tile():
    occ = np.ones((2, 2, 1), dtype=bool)
    model = legolize_voxelgrid(_occupancy=occ)
    assert len(model.bricks) == 1
    assert model.bricks[0].part == "3068b"         # Tile 2 x 2 (exposed top)


def test_tile_tops_swaps_exposed_plates():
    occ = np.ones((2, 2, 4), dtype=bool)           # 1 brick course + 1 exposed plate
    model = legolize_voxelgrid(_occupancy=occ)
    tops = [b for b in model.bricks if b.z == 3]
    assert tops and all(b.part in TILE_PARTS for b in tops)


def test_tile_tops_off_keeps_studded_plates():
    occ = np.ones((2, 2, 1), dtype=bool)
    model = legolize_voxelgrid(_occupancy=occ, options={"tile_tops": False})
    assert all(b.part not in TILE_PARTS for b in model.bricks)


def test_color_boundary_blocks_vertical_merge():
    occ = np.ones((2, 2, 6), dtype=bool)
    code = np.zeros((2, 2, 6), dtype=int)
    code[:, :, 2:] = 1                              # colour changes inside course 1
    pieces = split_and_merge(occ, code=code, seed=1, options={"tile_tops": False})
    for (part, x, y, z, rot, w, d, h) in pieces:
        vals = code[x:x + w, y:y + d, z:z + h]
        assert (vals == vals.flat[0]).all()         # no piece spans two colours


def test_deterministic_under_fixed_seed():
    occ = _solid_box(6, 6, 8)
    a = legolize_voxelgrid(_occupancy=occ, options={"seed": 42})
    b = legolize_voxelgrid(_occupancy=occ, options={"seed": 42})
    sig = lambda m: [(x.part, x.x, x.y, x.z, x.rot, x.w, x.d, x.h) for x in m.bricks]
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


def test_quantize_voxels_wildcards_unsampled():
    rgb = np.zeros((2, 2, 2, 3), dtype=np.uint8)
    rgb[0, 0, 0] = (255, 255, 255)
    code = quantize_voxels(rgb, smooth=False)
    assert code[0, 0, 0] == 0                     # palette index 0 = White
    assert code[1, 1, 1] == -1                    # unsampled stays wildcard


def test_ldraw_export_is_valid(tmp_path):
    model = legolize_voxelgrid(_occupancy=_solid_box(4, 4, 4))
    out = tmp_path / "model.ldr"
    write_ldr(model.bricks, str(out))
    text = out.read_text()
    lines = [l for l in text.splitlines() if l.startswith("1 ")]
    assert len(lines) == len(model.bricks)       # one type-1 line per brick
    # each type-1 line: "1 color x y z + 9 matrix + part.dat" = 15 tokens
    assert all(len(l.split()) == 15 for l in lines)


def test_ldraw_plate_y_regression():
    # brick whose bottom is one course up (plate-z 3) == old course-1 y (-24)
    assert brick_to_ldraw_line("3005", 0, 0, 3, 15, 0, 1, 1, 3).split()[3] == "-24"
    # ground-level brick keeps the old course-0 origin (0)
    assert brick_to_ldraw_line("3005", 0, 0, 0, 15, 0, 1, 1, 3).split()[3] == "0"
    # a plate on the ground sits 16 LDU lower than a brick's origin (2/3 height)
    assert brick_to_ldraw_line("3024", 0, 0, 0, 15, 0, 1, 1, 1).split()[3] == "16"


def test_split_and_merge_raw_tuple_shape():
    occ = _solid_box(3, 3, 1)
    bricks = split_and_merge(occ, seed=1)
    assert all(len(b) == 8 for b in bricks)      # (part,x,y,z,rot,w,d,h)
