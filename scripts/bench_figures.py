"""Assemble the consistent 3-building comparison figures (offline, no GPU).

- FLUX A/B grids: rows = buildings, cols = the swept setting, winner ringed.
    examples/ab_steps.png · ab_cfg.png · ab_lora.png · ab_negative.png
- Seed-robustness: per building, seed 1001 vs each alt seed, render + build.
    examples/<key>/<key>_seedcmp.png  (built only if <key>_s<seed>.glb exists)

Run with the backend venv after bench_buildings.py / bench_seed.py / bench_axes.py:
    backend/.venv/Scripts/python scripts/bench_figures.py
"""
from __future__ import annotations

import base64
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

import replay_color as R                                   # noqa: E402
from app.legolizer import metrics as M                     # noqa: E402
from app.mesh_voxelize import match_exposure, voxelize_glb  # noqa: E402
from forge_examples import EX, EXAMPLES                     # noqa: E402

ORDER = ["sagrada", "muralla", "bilbao"]
PROD = {"palette": "classic", "rgb_blur_iters": 1, "smooth_iters": 2, "merge_tol": 15.0, "smooth_3d": False}
TIER = "classic"
CELL = 200          # render thumb size
PAD, LBL, HDR = 12, 150, 34


def _font(sz, bold=False):
    for p in ([r"C:\Windows\Fonts\arialbd.ttf"] if bold else [r"C:\Windows\Fonts\arial.ttf"]):
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


# columns per axis: (col_label, img_cell_stem, is_winner)
AXES = {
    "steps":    [("20", "img_st20_cfg4", False), ("28", "img_st28_cfg4", True), ("40", "img_st40_cfg4", False)],
    "cfg":      [("3.0", "img_st28_cfg3", False), ("4.0", "img_st28_cfg4", False), ("5.0", "img_st28_cfg5", True)],
    "lora":     [("0.75", "img_st28_cfg5_lora0p75", False), ("1.0", "img_st28_cfg5", True)],
    "negative": [("off", "img_st28_cfg5", False), ("on", "img_st28_cfg5_neg", True)],
}
AXIS_TITLE = {"steps": "FLUX steps", "cfg": "CFG scale", "lora": "LoRA strength",
              "negative": "negative prompt"}


def _ab_grid(axis: str) -> None:
    cols = AXES[axis]
    ncol = len(cols)
    W = LBL + ncol * (CELL + PAD) + PAD
    H = HDR + len(ORDER) * (CELL + PAD) + PAD
    cv = Image.new("RGB", (W, H), (255, 255, 255))
    dr = ImageDraw.Draw(cv)
    fb, fr = _font(18, True), _font(16)

    for ci, (clabel, _, win) in enumerate(cols):
        x = LBL + ci * (CELL + PAD) + CELL // 2
        dr.text((x, 8), clabel + (" ✓" if win else ""), font=fb,
                fill=(20, 110, 50) if win else (32, 38, 43), anchor="ma")
    for ri, key in enumerate(ORDER):
        y = HDR + ri * (CELL + PAD)
        dr.text((8, y + CELL // 2), EXAMPLES[key][0], font=fr, fill=(32, 38, 43), anchor="lm")
        for ci, (_, stem, win) in enumerate(cols):
            p = EX / key / f"{stem}.png"
            x = LBL + ci * (CELL + PAD)
            if not p.exists():
                continue
            im = Image.open(p).convert("RGB").resize((CELL, CELL))
            cv.paste(im, (x, y))
            if win:
                dr.rectangle([x - 2, y - 2, x + CELL + 1, y + CELL + 1], outline=(20, 110, 50), width=3)
    out = EX / f"ab_{axis}.png"
    cv.save(out)
    print(f"  {out.name}  ({AXIS_TITLE[axis]}: {[c[0] for c in cols]})")


def _build_elev(glb: bytes, render_png: bytes):
    v = voxelize_glb(glb, target=32, fill_mode="solid")
    nx, ny, nz = v["nx"], v["ny"], v["nz"]
    occ = (np.frombuffer(base64.b64decode(v["occ_b64"]), dtype=np.uint8)
           .reshape((nx, ny, nz), order="F").astype(bool))
    rgb_pre = (np.frombuffer(base64.b64decode(v["rgb_b64"]), dtype=np.uint8)
               .reshape((nz, ny, nx, 3)).transpose(2, 1, 0, 3)) if v.get("rgb_b64") else None
    rgb_post = match_exposure(rgb_pre, render_png) if rgb_pre is not None else None
    rh = M.render_hist(render_png, TIER)
    r = R._run_cell(occ, rgb_post, render_png, rh, rgb_pre, PROD)
    return R._elevation(R._bricks_grid(r["model"], TIER), occ), r["n_pieces"]


def _seed_cmp(key: str) -> None:
    d = EX / key
    seeds = [("1001", d / f"{key}.png", d / f"{key}.glb")]
    for g in sorted(d.glob(f"{key}_s*.glb")):
        s = g.stem.split("_s")[-1]
        seeds.append((s, d / f"{key}_s{s}.png", g))
    seeds = [(s, p, g) for s, p, g in seeds if p.exists() and g.exists()]
    if len(seeds) < 2:
        print(f"  {key}: <2 seeds, skip"); return

    Hc = 200
    panels = []  # (render_img, build_img, label, pieces)
    for s, png, glb in seeds:
        render = Image.open(png).convert("RGB").resize((Hc, Hc))
        elev, pc = _build_elev(glb.read_bytes(), png.read_bytes())
        b = Image.fromarray(elev)
        b = b.resize((max(1, int(b.width * Hc / b.height)), Hc), Image.NEAREST)
        panels.append((render, b, s, pc))

    gap, lblh = 16, 28
    roww = [Hc + gap + p[1].width for p in panels]
    W = max(roww) + 2 * PAD
    rowh = Hc + lblh
    H = len(panels) * (rowh + gap) + PAD
    cv = Image.new("RGB", (W, H), (255, 255, 255))
    dr = ImageDraw.Draw(cv)
    f = _font(16, True)
    y = PAD
    for render, b, s, pc in panels:
        dr.text((PAD, y), f"seed {s}   render → build   {pc:,} pieces", font=f, fill=(32, 38, 43))
        cv.paste(render, (PAD, y + lblh))
        cv.paste(b, (PAD + Hc + gap, y + lblh))
        y += rowh + gap
    out = d / f"{key}_seedcmp.png"
    cv.save(out)
    print(f"  {out.name}  ({len(panels)} seeds)")


def main():
    print("FLUX A/B grids:")
    for axis in AXES:
        _ab_grid(axis)
    print("seed-robustness montages:")
    for key in ORDER:
        _seed_cmp(key)


if __name__ == "__main__":
    main()
