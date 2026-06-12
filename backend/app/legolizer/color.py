"""Per-brick color assignment.

The voxel/stability steps are colorless; colour comes from sampling the
TRELLIS texture per voxel and mapping to the nearest real LEGO colour via
CIEDE2000 distance in Lab space.

Palettes are tiered: "classic" (~23 architecture staples) and "full" (~48
current production colours), both generated from Rebrickable data and
validated against LDConfig.ldr by scripts/build_catalog.py. The hardcoded
starter palette below survives only as the "legacy" fallback when no
catalog.json is present. Every assigned colour is finally clamped to the
colours the part's mould was actually produced in (elements.csv), so the
output is buildable, not just renderable.
"""
from __future__ import annotations

import random
from typing import Optional

import numpy as np

from ..catalog import get_palette as _catalog_palette, part_colors as _part_colors

# (LDraw color code, name, sRGB 0-255). Legacy fallback when catalog.json is
# missing — the live palettes come from the catalog package.
LEGO_PALETTE: list[tuple[int, str, tuple[int, int, int]]] = [
    (15, "White", (255, 255, 255)),
    (151, "Light Bluish Gray", (160, 165, 169)),
    (71, "Light Gray", (163, 162, 165)),
    (72, "Dark Bluish Gray", (99, 95, 98)),
    (0, "Black", (27, 42, 52)),
    (19, "Tan", (228, 205, 158)),
    (4, "Red", (201, 26, 9)),
    (14, "Yellow", (242, 205, 55)),
    (1, "Blue", (30, 90, 168)),
    (2, "Green", (88, 171, 65)),
    (47, "Trans Clear", (252, 252, 252)),
    (46, "Trans Yellow", (245, 205, 47)),
]


def _srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB (0-255) -> CIE Lab (D65). Vectorized over the last axis."""
    c = rgb.astype(float) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805],
                  [0.2126, 0.7152, 0.0722],
                  [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def _ciede2000(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """CIEDE2000 color difference. lab1 (...,3) vs lab2 (...,3), broadcast."""
    L1, a1, b1 = lab1[..., 0], lab1[..., 1], lab1[..., 2]
    L2, a2, b2 = lab2[..., 0], lab2[..., 1], lab2[..., 2]
    avg_L = (L1 + L2) / 2
    C1 = np.hypot(a1, b1)
    C2 = np.hypot(a2, b2)
    avg_C = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(avg_C ** 7 / (avg_C ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    avg_Cp = (C1p + C2p) / 2
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp = L2 - L1
    dCp = C2p - C1p
    dhp = h2p - h1p
    dhp = np.where(dhp > 180, dhp - 360, dhp)
    dhp = np.where(dhp < -180, dhp + 360, dhp)
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dhp) / 2)
    avg_Lp = (L1 + L2) / 2
    avg_hp = np.where(np.abs(h1p - h2p) > 180, (h1p + h2p + 360) / 2, (h1p + h2p) / 2)
    T = (1 - 0.17 * np.cos(np.radians(avg_hp - 30))
         + 0.24 * np.cos(np.radians(2 * avg_hp))
         + 0.32 * np.cos(np.radians(3 * avg_hp + 6))
         - 0.20 * np.cos(np.radians(4 * avg_hp - 63)))
    Sl = 1 + (0.015 * (avg_Lp - 50) ** 2) / np.sqrt(20 + (avg_Lp - 50) ** 2)
    Sc = 1 + 0.045 * avg_Cp
    Sh = 1 + 0.015 * avg_Cp * T
    dtheta = 30 * np.exp(-(((avg_hp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(avg_Cp ** 7 / (avg_Cp ** 7 + 25 ** 7))
    Rt = -Rc * np.sin(np.radians(2 * dtheta))
    return np.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
                   + Rt * (dCp / Sc) * (dHp / Sh))


# --- tiered palettes ---------------------------------------------------------
# A "tier" names a palette: "classic" / "full" (from the generated catalog) or
# "legacy" (the hardcoded list above). Each resolves once to (palette, Lab).
_PALETTE_CACHE: dict[str, tuple[list[tuple[int, str, tuple[int, int, int]]], np.ndarray]] = {}


def resolve_palette(tier: Optional[str] = None) -> tuple[list, np.ndarray]:
    """Return (palette, lab_array) for a tier, falling back to legacy."""
    name = tier or DEFAULT_TIER
    hit = _PALETTE_CACHE.get(name)
    if hit is not None:
        return hit
    pal = _catalog_palette(name) if name != "legacy" else None
    if pal is None:
        pal = LEGO_PALETTE
    entry = (pal, _srgb_to_lab(np.array([p[2] for p in pal])))
    _PALETTE_CACHE[name] = entry
    return entry


DEFAULT_TIER = "classic" if _catalog_palette("classic") else "legacy"

# Back-compat: the legacy module-level Lab table (tests/poke scripts may use it).
_PALETTE_LAB = _srgb_to_lab(np.array([p[2] for p in LEGO_PALETTE]))


def nearest_lego_color(rgb: tuple[int, int, int], tier: Optional[str] = None) -> int:
    """Return the LDraw color code nearest to an sRGB value (CIEDE2000)."""
    pal, lab_tbl = resolve_palette(tier)
    lab = _srgb_to_lab(np.array(rgb))
    d = _ciede2000(lab[None, :], lab_tbl)
    return pal[int(np.argmin(d))][0]


def quantize_voxels(
    voxel_rgb: np.ndarray, smooth: bool = True,
    tier: Optional[str] = None, smooth_iters: int = 1,
) -> np.ndarray:
    """Map every sampled voxel to its nearest palette INDEX (CIEDE2000).

    Returns an (nx, ny, nz) int grid; -1 marks unsampled (black) voxels, which
    act as wildcards in the packer's colour-uniformity check. Quantizing BEFORE
    packing lets pieces respect colour boundaries instead of averaging across
    them. `smooth` applies a 3x3x1 majority filter so texture noise doesn't
    shatter footprints into 1x1 confetti; `smooth_iters` repeats it (richer
    palettes draw more boundaries, so they may need a second pass).
    """
    pal, lab_tbl = resolve_palette(tier)
    flat = voxel_rgb.reshape(-1, 3).astype(float)
    sampled = flat.sum(axis=1) > 0
    out = np.full(flat.shape[0], -1, dtype=int)
    if sampled.any():
        lab = _srgb_to_lab(flat[sampled])
        d = _ciede2000(lab[:, None, :], lab_tbl[None, :, :])
        out[sampled] = np.argmin(d, axis=1)
    code = out.reshape(voxel_rgb.shape[:3])
    if smooth:
        for _ in range(max(1, int(smooth_iters))):
            code = _smooth_codes(code, n_classes=len(pal))
    return code


def _smooth_codes(code: np.ndarray, n_classes: Optional[int] = None) -> np.ndarray:
    """3x3x1 per-layer majority vote over palette indices (wildcards stay -1)."""
    from scipy import ndimage

    if n_classes is None:
        n_classes = len(LEGO_PALETTE)
    kern = np.ones((3, 3, 1))
    best = np.full(code.shape, -1, dtype=int)
    best_cnt = np.zeros(code.shape)
    # convolve only the classes actually present — a Full-48 palette request
    # typically uses ~7, and each pass sweeps the whole grid
    present = np.unique(code[code >= 0])
    for c in present[present < n_classes]:
        cnt = ndimage.convolve((code == c).astype(np.uint8), kern, mode="constant")
        upd = cnt > best_cnt
        best[upd] = c
        best_cnt[upd] = cnt[upd]
    best[code < 0] = -1            # never invent colour where nothing was sampled
    return best


# --- signature legoarch palette (LDraw codes, catalog-aligned) --------------
_PODIUM = 71    # Light Bluish Gray
_CROWN = 72     # Dark Bluish Gray
_WINDOW = 46    # Trans Yellow
_BODY = 15      # White
_ACCENT = 19    # Tan


def _on_edge(x: int, y: int, z: int, w: int, d: int, occ: np.ndarray) -> bool:
    """True if the footprint touches the silhouette boundary at this layer."""
    nx, ny, _ = occ.shape
    if x == 0 or y == 0 or x + w >= nx or y + d >= ny:
        return True
    return (
        not occ[x - 1, y:y + d, z].all()
        or not occ[x + w, y:y + d, z].all()
        or not occ[x:x + w, y - 1, z].all()
        or not occ[x:x + w, y + d, z].all()
    )


def _colors_from_code(bricks, code: np.ndarray, palette: list) -> list[int]:
    """Each piece takes the quantized palette colour of its cells (the packer
    guarantees uniformity, so the mode is just 'the' value or a wildcard)."""
    out: list[int] = []
    for (part, x, y, z, rot, w, d, h) in bricks:
        vals = code[x:x + w, y:y + d, z:z + h]
        vals = vals[vals >= 0]
        if vals.size == 0:
            out.append(15)                      # wildcard-only piece -> White
        else:
            idx, counts = np.unique(vals, return_counts=True)
            out.append(palette[int(idx[np.argmax(counts)])][0])
    return out


def _colors_from_rgb(bricks, voxel_rgb: np.ndarray, tier: Optional[str]) -> list[int]:
    """Match each piece to the real LEGO colour nearest the generated model's
    colour over its full cell volume (CIEDE2000)."""
    out: list[int] = []
    for (part, x, y, z, rot, w, d, h) in bricks:
        patch = voxel_rgb[x:x + w, y:y + d, z:z + h].reshape(-1, 3).astype(float)
        lit = patch[patch.sum(axis=1) > 0]      # ignore unsampled (black) voxels
        if len(lit) == 0:
            out.append(15)                      # default White
            continue
        mean = lit.mean(axis=0)
        out.append(nearest_lego_color(
            (int(mean[0]), int(mean[1]), int(mean[2])), tier=tier))
    return out


def clamp_to_available(bricks, colors: list[int], tier: Optional[str] = None) -> list[int]:
    """Snap each piece's colour to one its mould was actually produced in.

    Uses the catalog's elements.csv-derived availability. A colour outside the
    palette (e.g. heuristic codes) or a part without availability data passes
    through unchanged. Distance is CIEDE2000 over the active palette.
    """
    avail_map = _part_colors()
    if not avail_map:
        return colors
    pal, lab_tbl = resolve_palette(tier)
    idx_of = {p[0]: i for i, p in enumerate(pal)}
    out: list[int] = []
    for (part, *_rest), color in zip(bricks, colors):
        avail = avail_map.get(part)
        if not avail or color in avail or color not in idx_of:
            out.append(color)
            continue
        cand = [i for i, p in enumerate(pal) if p[0] in avail]
        if not cand:
            out.append(color)
            continue
        d = _ciede2000(lab_tbl[idx_of[color]][None, :], lab_tbl[cand])
        out.append(pal[cand[int(np.argmin(d))]][0])
    return out


def assign_colors(
    bricks, occ, image_url: Optional[str] = None, seed: int = 7,
    voxel_rgb: Optional[np.ndarray] = None,
    code: Optional[np.ndarray] = None,
    tier: Optional[str] = None,
) -> list[int]:
    """Assign an LDraw color per piece.

    Preferred: the pre-quantized `code` grid the packer already honoured (so
    piece colours and piece boundaries agree). Next: match the generated
    model's real colour per cell volume (CIEDE2000) from `voxel_rgb`. Fallback
    (untextured mesh): the signature legoarch heuristic — light-grey podium,
    dark-grey crown, the odd translucent-yellow window, pearl-white body.
    Whatever the path, the result is clamped to real part+colour combos.
    """
    if code is not None:
        pal, _ = resolve_palette(tier)
        return clamp_to_available(bricks, _colors_from_code(bricks, code, pal), tier)
    if voxel_rgb is not None:
        return clamp_to_available(bricks, _colors_from_rgb(bricks, voxel_rgb, tier), tier)

    nz = occ.shape[2]                            # plate units: 2 courses = 6 plates
    rng = random.Random(int(seed) & 0xFFFFFFFF)
    out: list[int] = []
    for (part, x, y, z, rot, w, d, h) in bricks:
        if z < 6:
            out.append(_PODIUM)
        elif z + h > nz - 6:
            out.append(_CROWN)
        elif _on_edge(x, y, z, w, d, occ) and rng.random() < 0.16:
            out.append(_WINDOW)
        else:
            out.append(_ACCENT if rng.random() < 0.12 else _BODY)
    return clamp_to_available(bricks, out, tier)
