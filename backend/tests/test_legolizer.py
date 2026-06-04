"""Tests for the custom legolizer (runs without ComfyUI)."""
import numpy as np

from app.legolizer import legolize_voxelgrid
from app.legolizer.color import nearest_lego_color
from app.legolizer.ldraw import write_ldr


def _solid_box(nx=3, ny=3, nz=2) -> np.ndarray:
    return np.ones((nx, ny, nz), dtype=bool)


def test_legolize_solid_box_counts_bricks():
    occ = _solid_box(3, 3, 2)
    model = legolize_voxelgrid(_occupancy=occ)
    assert len(model.bricks) == 18          # baseline: one 1x1 per voxel
    assert model.grid == (3, 3, 2)
    assert sum(model.parts_list.values()) == 18


def test_solid_box_is_connected_and_supported():
    model = legolize_voxelgrid(_occupancy=_solid_box())
    assert model.stability["connected"] is True
    assert model.stability["n_components"] == 1
    assert model.stability["support_ratio"] == 1.0


def test_floating_brick_breaks_connectivity():
    occ = np.zeros((3, 3, 3), dtype=bool)
    occ[0, 0, 0] = True
    occ[2, 2, 2] = True                     # disconnected island
    model = legolize_voxelgrid(_occupancy=occ)
    assert model.stability["connected"] is False
    assert model.stability["n_components"] == 2


def test_nearest_lego_color_picks_white_and_red():
    assert nearest_lego_color((255, 255, 255)) == 15      # exact White
    assert nearest_lego_color((200, 20, 10)) == 4         # Red
    assert nearest_lego_color((30, 90, 168)) == 1         # Blue


def test_ldraw_export_is_valid(tmp_path):
    model = legolize_voxelgrid(_occupancy=_solid_box(2, 2, 1))
    out = tmp_path / "model.ldr"
    write_ldr(model.bricks, str(out))
    text = out.read_text()
    lines = [l for l in text.splitlines() if l.startswith("1 ")]
    assert len(lines) == 4                  # 2x2x1 => 4 bricks
    # each type-1 line: "1 color x y z + 9 matrix + part.dat" = 15 tokens
    assert all(len(l.split()) == 15 for l in lines)
