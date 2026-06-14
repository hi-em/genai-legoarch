"""Objective colour-consistency metrics for the render -> mesh -> bricks pipeline.

The whole point of Track B is "do the three stages tell one colour story?".
Eyeballing the SpineCompareViewer is the final judgement, but to *tune* the
pipeline we need a scalar that moves. Everything here reduces each stage to a
palette-index histogram (share of the build/image that lands on each LEGO
colour), then compares those histograms:

  M1 palette-share  = 1 - total-variation distance between the render's
                      palette histogram and the build's footprint-area-weighted
                      palette histogram. 1.0 = identical colour story, 0.0 =
                      disjoint. This is the number to maximize.
  M2 per-hop dE     = CIEDE2000 between the DOMINANT palette colour of
                      consecutive stages (render -> mesh -> post-exposure ->
                      bricks); pinpoints WHICH hop the colour drifts at.
  M3 shatter        = 1x1 fraction + colour-count tail; the confetti symptom.

All pure-numpy over data already in hand (no GPU, no re-forge).
"""
from __future__ import annotations

import io
from typing import Any, Optional

import numpy as np

from . import color as _color


# --- stage -> palette-index histogram ---------------------------------------

def _index_hist(indices: np.ndarray, weights: np.ndarray, n: int) -> np.ndarray:
    """Normalized histogram of palette indices in [0, n). Empty -> zeros."""
    hist = np.bincount(indices, weights=weights, minlength=n)[:n].astype(float)
    total = hist.sum()
    return hist / total if total > 0 else hist


def _rgb_to_indices(rgb: np.ndarray, tier: Optional[str]) -> np.ndarray:
    """Nearest palette INDEX (CIEDE2000) for each sRGB row of an (m, 3) array."""
    _, lab_tbl = _color.resolve_palette(tier)
    lab = _color._srgb_to_lab(rgb.astype(float))
    d = _color._ciede2000(lab[:, None, :], lab_tbl[None, :, :])
    return np.argmin(d, axis=1)


def _truncate_to_cover(hist: np.ndarray, cover: float) -> np.ndarray:
    """Keep the fewest top bins covering `cover` of the mass; renormalize.

    The render's per-pixel lighting gradient smears a little mass across many
    palette bins. Comparing a clean (few-colour) build against that full spread
    unfairly rewards confetti for accidentally overlapping the tail. Truncating
    to the render's DOMINANT colours compares like-to-like: a clean build that
    matches the render's main colours scores high; stray specks (a hue the
    render doesn't prominently use) still fall outside and are penalized.
    """
    if cover >= 1.0 or hist.sum() == 0:
        return hist
    order = np.argsort(hist)[::-1]
    csum = np.cumsum(hist[order])
    keep_n = int(np.searchsorted(csum, cover * hist.sum()) + 1)
    out = np.zeros_like(hist)
    out[order[:keep_n]] = hist[order[:keep_n]]
    total = out.sum()
    return out / total if total > 0 else out


def render_hist(
    render_png: bytes, tier: Optional[str] = None,
    bg_thresh: int = 238, max_px: int = 160, dominant_cover: float = 0.85,
) -> np.ndarray:
    """Palette histogram of the FLUX render foreground (background dropped).

    Downsamples to `max_px` on the long side first — quantizing every pixel is
    wasteful and the histogram is scale-invariant. `dominant_cover` truncates to
    the render's dominant colours (see _truncate_to_cover) so M1 measures the
    shared colour STORY, not the render's per-pixel lighting noise.
    """
    from PIL import Image

    pal, _ = _color.resolve_palette(tier)
    img = Image.open(io.BytesIO(render_png)).convert("RGB")
    if max(img.size) > max_px:
        scale = max_px / max(img.size)
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))))
    arr = np.asarray(img).reshape(-1, 3)
    fg = arr[~np.all(arr > bg_thresh, axis=1)]            # drop near-white bg
    if len(fg) == 0:
        return np.zeros(len(pal))
    idx = _rgb_to_indices(fg, tier)
    hist = _index_hist(idx, np.ones(len(idx)), len(pal))
    return _truncate_to_cover(hist, dominant_cover)


def voxel_hist(voxel_rgb: np.ndarray, tier: Optional[str] = None) -> np.ndarray:
    """Palette histogram of sampled (non-black) voxels of an (nx,ny,nz,3) grid."""
    pal, _ = _color.resolve_palette(tier)
    flat = voxel_rgb.reshape(-1, 3)
    lit = flat[flat.sum(axis=1) > 0]
    if len(lit) == 0:
        return np.zeros(len(pal))
    idx = _rgb_to_indices(lit, tier)
    return _index_hist(idx, np.ones(len(idx)), len(pal))


def build_hist(bricks: list, tier: Optional[str] = None) -> np.ndarray:
    """Footprint-area-weighted palette histogram of the final brick build.

    `bricks` may be Brick objects, dicts (model.to_dict()), or raw tuples paired
    elsewhere with colours — anything exposing color + w + d. A piece weighs its
    visible footprint area (w*d), so a 2x4 counts 8x a 1x1.
    """
    pal, _ = _color.resolve_palette(tier)
    idx_of = {p[0]: i for i, p in enumerate(pal)}
    idxs: list[int] = []
    wts: list[float] = []
    for b in bricks:
        color, w, d = _brick_color_wd(b)
        i = idx_of.get(color)
        if i is None:
            continue                                      # off-palette (rare) -> skip
        idxs.append(i)
        wts.append(float(w * d))
    if not idxs:
        return np.zeros(len(pal))
    return _index_hist(np.asarray(idxs), np.asarray(wts), len(pal))


def _brick_color_wd(b: Any) -> tuple[int, int, int]:
    """(color, w, d) from a Brick object, a model dict, or an (..,w,d,h) tuple."""
    if hasattr(b, "color"):
        return int(b.color), int(b.w), int(b.d)
    if isinstance(b, dict):
        return int(b["color"]), int(b["w"]), int(b["d"])
    # raw packer tuple has no colour; not expected here
    return int(b[-4]), int(b[-3]), int(b[-2])


# --- M1: palette share (perceptual) -----------------------------------------

def palette_share(
    render_h: np.ndarray, build_h: np.ndarray,
    tier: Optional[str] = None, sigma: float = 12.0,
) -> float:
    """Perceptual colour-story agreement of two palette histograms, in [0, 1].

    A plain histogram intersection treats White / Light-Gray / Light-Bluish-Gray
    as three unrelated bins, so a build that reads the right grey but lands one
    palette step off scores as a total miss — and, perversely, confetti scores
    HIGHER for accidentally sprinkling mass across the render's gradient bins.
    Instead we use a CIEDE2000 kernel S_ij = exp(-(dE_ij/sigma)^2) (near colours
    ~ same) and a cosine-normalized kernel similarity (a Bhattacharyya-style
    measure): partial credit for perceptually-close colours, real penalty for a
    hue the other side doesn't use, and collapse-to-one-colour can't game it.
    """
    if render_h.sum() == 0 or build_h.sum() == 0:
        return 0.0
    dist = _color.palette_code_distances(tier)
    S = np.exp(-((dist / sigma) ** 2))
    cross = float(render_h @ S @ build_h)
    rr = float(render_h @ S @ render_h)
    bb = float(build_h @ S @ build_h)
    denom = (rr * bb) ** 0.5
    return float(cross / denom) if denom > 0 else 0.0


# --- M2: per-hop dominant-colour drift --------------------------------------

def per_hop_delta_e(stage_hists: dict[str, np.ndarray], tier: Optional[str] = None) -> dict[str, float]:
    """CIEDE2000 between the dominant palette colours of consecutive stages.

    `stage_hists` is an ordered dict of {stage_name: palette_hist}; returns
    {"render->mesh": dE, ...} plus the dominant LDraw code per stage.
    """
    pal, _ = _color.resolve_palette(tier)
    code_dist = _color.palette_code_distances(tier)
    names = [n for n, h in stage_hists.items() if h is not None and h.sum() > 0]
    dom = {n: int(np.argmax(stage_hists[n])) for n in names}
    out: dict[str, float] = {}
    for a, b in zip(names, names[1:]):
        out[f"{a}->{b}"] = float(code_dist[dom[a], dom[b]])
    out_dominant = {f"dom_{n}": int(pal[dom[n]][0]) for n in names}
    return {**out, **out_dominant}


# --- M3: shatter / confetti -------------------------------------------------

def shatter_stats(bricks: list, top_k: int = 3) -> dict[str, float]:
    """1x1 fraction and colour-distribution tail — the confetti symptom."""
    n = len(bricks)
    if n == 0:
        return {"n_pieces": 0, "frac_1x1": 0.0, "n_colors": 0, "tail_share": 0.0}
    n_1x1 = 0
    color_area: dict[int, float] = {}
    for b in bricks:
        color, w, d = _brick_color_wd(b)
        if w == 1 and d == 1:
            n_1x1 += 1
        color_area[color] = color_area.get(color, 0.0) + float(w * d)
    areas = np.sort(np.array(list(color_area.values())))[::-1]
    total = areas.sum()
    tail = float(areas[top_k:].sum() / total) if total > 0 and len(areas) > top_k else 0.0
    return {
        "n_pieces": int(n),
        "frac_1x1": float(n_1x1 / n),
        "n_colors": int(len(color_area)),
        "tail_share": tail,                               # area on colours beyond top-k
    }
