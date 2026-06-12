"""Catalog + tiered-palette + availability-clamp tests (Sprint 1A)."""
import numpy as np
import pytest

from app.catalog import load_catalog, get_palette, part_colors, parts_by_id
from app.legolizer import color as color_mod
from app.legolizer import legolize_voxelgrid


def test_catalog_loads_and_is_sane():
    cat = load_catalog()
    assert cat is not None, "catalog.json missing — run scripts/build_catalog.py"
    assert len(cat["colors"]) >= 30
    assert set(cat["palettes"]["classic"]) <= set(cat["palettes"]["full"])
    for c in cat["colors"]:
        assert len(c["rgb"]) == 3
        assert c["hex"].startswith("#")


def test_palette_tiers_resolve():
    classic = get_palette("classic")
    full = get_palette("full")
    assert classic and len(classic) >= 20
    assert full and len(full) >= len(classic)
    codes = [p[0] for p in classic]
    assert 15 in codes and 0 in codes and 19 in codes  # White, Black, Tan


def test_placeable_parts_have_availability():
    pc = part_colors()
    for pid, part in parts_by_id().items():
        if part.get("place", True):
            assert pc.get(pid), f"{pid} has no part+colour availability"
            assert len(pc[pid]) >= 8, f"{pid} suspiciously few colours"


def test_clamp_passes_available_and_snaps_unavailable():
    pc = part_colors()
    assert 379 not in pc["3038"], "fixture assumption: Sand Blue not made for 3038"
    bricks = [("3038", 0, 0, 0, 0, 2, 3, 3), ("3001", 0, 0, 0, 0, 2, 4, 3)]
    out = color_mod.clamp_to_available(bricks, [379, 15], tier="classic")
    assert out[0] != 379 and out[0] in pc["3038"]   # snapped to a real colour
    assert out[1] == 15                             # White 2x4 exists, untouched


def test_clamp_unknown_part_passes_through():
    out = color_mod.clamp_to_available([("9999", 0, 0, 0, 0, 1, 1, 3)], [4])
    assert out == [4]


def test_quantize_uses_active_tier_indices():
    full, _ = color_mod.resolve_palette("full")
    rgb = np.zeros((2, 2, 2, 3), dtype=np.uint8)
    rgb[..., :] = (228, 205, 158)  # Tan
    code = color_mod.quantize_voxels(rgb, smooth=False, tier="full")
    assert code.max() < len(full)
    assert (code >= 0).all()


def test_legolize_colors_are_buildable():
    """End-to-end: every assigned colour is real for its part (classic tier)."""
    occ = np.ones((4, 4, 6), dtype=bool)
    rgb = np.zeros((4, 4, 6, 3), dtype=np.uint8)
    rgb[..., :] = (201, 26, 9)  # Red
    model = legolize_voxelgrid(
        _occupancy=occ, voxel_rgb=rgb, options={"seed": 3, "palette": "classic"}
    )
    pc = part_colors()
    for b in model.bricks:
        avail = pc.get(b.part)
        assert avail is None or b.color in avail, (
            f"{b.part} assigned colour {b.color} that no real element has"
        )
