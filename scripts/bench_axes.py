"""Offline benchmark axes (NO GPU) on the forged example meshes.

Reads docs/benchmarks/assets/examples/<key>/<key>.glb + <key>.png and computes,
per building, the three deterministic-computation axes the slides compare across
the 3 buildings consistently:

  COLOUR  (Track B) : strict per-voxel quantize  vs  the rgb_blur denoise default
  FILL    (buildability): raw hollow "surface"   vs  solid flood-fill (connectivity + pieces)
  SCALE   (detail/set)  : voxel target 24 / 32 / 48 (pieces vs fidelity)

Writes per building:
    <key>_color.png      render | mesh | post-exposure | build, baseline then recommended
    <key>_montage.png    the canonical end-to-end montage (production settings)
    <key>_axes.json      every axis number (pieces/colours/connected/support/M1/grid)

Run with the backend venv after bench_buildings.py:
    backend/.venv/Scripts/python scripts/bench_axes.py            # all forged buildings
    backend/.venv/Scripts/python scripts/bench_axes.py muralla
"""
from __future__ import annotations

import base64
import io
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

import replay_color as R                                   # noqa: E402
from app.legolizer import metrics as M                     # noqa: E402
from app.mesh_voxelize import match_exposure, voxelize_glb  # noqa: E402
from forge_examples import EX, EXAMPLES                     # noqa: E402

BASELINE = {"palette": "classic", "rgb_blur_iters": 0, "smooth_iters": 1, "merge_tol": 0.0, "smooth_3d": False}
PROD     = {"palette": "classic", "rgb_blur_iters": 1, "smooth_iters": 2, "merge_tol": 15.0, "smooth_3d": False}
TIER = "classic"


def _vox(glb: bytes, render_png: bytes, target: int, fill_mode: str):
    """Voxelize + exposure-match once for a (target, fill_mode)."""
    v = voxelize_glb(glb, target=target, fill_mode=fill_mode)
    nx, ny, nz = v["nx"], v["ny"], v["nz"]
    occ = (np.frombuffer(base64.b64decode(v["occ_b64"]), dtype=np.uint8)
           .reshape((nx, ny, nz), order="F").astype(bool))
    rgb_pre = None
    if v.get("rgb_b64"):
        rgb_pre = (np.frombuffer(base64.b64decode(v["rgb_b64"]), dtype=np.uint8)
                   .reshape((nz, ny, nx, 3)).transpose(2, 1, 0, 3))
    rgb_post = match_exposure(rgb_pre, render_png) if rgb_pre is not None else None
    return occ, rgb_pre, rgb_post


def _cell(occ, rgb_pre, rgb_post, render_png, render_h, cell):
    return R._run_cell(occ, rgb_post, render_png, render_h, rgb_pre, cell)


def _montage(path: Path, occ, rgb_pre, rgb_post, render_png, model):
    from PIL import Image
    H = max(occ.shape[2] * 8, 160)

    def _fit(arr):
        im = Image.fromarray(arr)
        return im.resize((max(1, int(im.width * H / im.height)), H), Image.NEAREST)

    render = Image.open(io.BytesIO(render_png)).convert("RGB")
    panels = [render.resize((int(render.width * H / render.height), H)),
              _fit(R._elevation(rgb_pre, occ)),
              _fit(R._elevation(rgb_post, occ)),
              _fit(R._elevation(R._bricks_grid(model, TIER), occ))]
    gap = 8
    W = sum(p.width for p in panels) + gap * (len(panels) - 1)
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    x = 0
    for p in panels:
        canvas.paste(p, (x, 0)); x += p.width + gap
    canvas.save(path)


def _row_montage(path: Path, panels, scale_px: int = 5, gap: int = 12):
    """Side-by-side elevation panels at a common display height (NEAREST = blocky)."""
    from PIL import Image
    H = max(p.shape[0] for p in panels) * scale_px
    ims = []
    for arr in panels:
        im = Image.fromarray(arr)
        ims.append(im.resize((max(1, int(im.width * H / im.height)), H), Image.NEAREST))
    W = sum(i.width for i in ims) + gap * (len(ims) - 1)
    cv = Image.new("RGB", (W, H), (255, 255, 255))
    x = 0
    for i in ims:
        cv.paste(i, (x, 0)); x += i.width + gap
    cv.save(path)


def _axes_one(key: str) -> dict:
    label, _ = EXAMPLES[key]
    d = EX / key
    glb = (d / f"{key}.glb").read_bytes()
    render = (d / f"{key}.png").read_bytes()
    render_h = M.render_hist(render, TIER)
    print(f"\n=== {label} ({key}) ===")

    # ---- COLOUR (Track B) : on the solid voxelization (production path) -------
    occ, rgb_pre, rgb_post = _vox(glb, render, 32, "solid")
    if rgb_post is None:
        raise SystemExit(f"{key}: mesh has no vertex colours")
    base = _cell(occ, rgb_pre, rgb_post, render, render_h, BASELINE)
    reco = _cell(occ, rgb_pre, rgb_post, render, render_h, PROD)
    _montage(d / f"{key}_montage.png", occ, rgb_pre, rgb_post, render, reco["model"])
    # before|after stacked colour montage
    from PIL import Image
    _montage(d / "_b.png", occ, rgb_pre, rgb_post, render, base["model"])
    _montage(d / "_r.png", occ, rgb_pre, rgb_post, render, reco["model"])
    bi, ri = Image.open(d / "_b.png"), Image.open(d / "_r.png")
    cv = Image.new("RGB", (max(bi.width, ri.width), bi.height + ri.height + 8), (255, 255, 255))
    cv.paste(bi, (0, 0)); cv.paste(ri, (0, bi.height + 8)); cv.save(d / f"{key}_color.png")
    (d / "_b.png").unlink(); (d / "_r.png").unlink()
    dpc = round(100 * (reco["n_pieces"] - base["n_pieces"]) / base["n_pieces"], 1)
    print(f"  colour : {base['n_pieces']}pc/{base['n_colors']}col -> "
          f"{reco['n_pieces']}pc/{reco['n_colors']}col ({dpc}% pieces)  M1 "
          f"{base['M1_palette_share']}->{reco['M1_palette_share']}")

    # ---- FILL / VOID : raw hollow surface vs solid flood-fill ----------------
    fill = {}
    for mode in ("surface", "solid"):
        o, rp, rq = _vox(glb, render, 32, mode)
        r = _cell(o, rp, rq, render, render_h, PROD)
        fill[mode] = {"pieces": r["n_pieces"], "connected": r["connected"],
                      "support": r["support"], "n_colors": r["n_colors"]}
    df = round(100 * (fill["solid"]["pieces"] - fill["surface"]["pieces"]) / fill["surface"]["pieces"], 1)
    print(f"  fill   : surface {fill['surface']['pieces']}pc "
          f"connected={fill['surface']['connected']}  ->  solid "
          f"{fill['solid']['pieces']}pc connected={fill['solid']['connected']}  ({df}% pieces)")

    # ---- SCALE : detail target 24 / 32 / 48 (+ build-elevation montage) ------
    scale = {}
    scale_panels = []
    for t in (24, 32, 48):
        o, rp, rq = _vox(glb, render, t, "solid")
        r = _cell(o, rp, rq, render, render_h, PROD)
        scale[str(t)] = {"pieces": r["n_pieces"], "n_colors": r["n_colors"],
                         "grid": list(r["model"].grid), "connected": r["connected"],
                         "support": r["support"]}
        scale_panels.append(R._elevation(R._bricks_grid(r["model"], TIER), o))
    _row_montage(d / f"{key}_scale.png", scale_panels, scale_px=5, gap=14)
    print(f"  scale  : " + " · ".join(f"{t}->{scale[t]['pieces']}pc" for t in ("24", "32", "48")))

    stats = {
        "building": label, "key": key,
        "colour": {"baseline": {"pieces": base["n_pieces"], "n_colors": base["n_colors"],
                                "frac_1x1": base["frac_1x1"], "M1": base["M1_palette_share"]},
                   "recommended": {"pieces": reco["n_pieces"], "n_colors": reco["n_colors"],
                                   "frac_1x1": reco["frac_1x1"], "M1": reco["M1_palette_share"]},
                   "delta_pieces_pct": dpc},
        "fill": {**fill, "delta_pieces_pct": df},
        "scale": scale,
        "grid": list(reco["model"].grid),
        "support": reco["support"], "connected": reco["connected"],
    }
    (d / f"{key}_axes.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats


def main():
    keys = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not keys:
        keys = [k for k in EXAMPLES if (EX / k / f"{k}.glb").exists()]
    allstats = []
    for k in keys:
        if not (EX / k / f"{k}.glb").exists():
            print(f"  skip {k}: no forged glb yet"); continue
        allstats.append(_axes_one(k))
    if allstats:
        (EX / "axes_summary.json").write_text(json.dumps(allstats, indent=2), encoding="utf-8")
        print(f"\nwrote {EX / 'axes_summary.json'}  ({len(allstats)} buildings)")


if __name__ == "__main__":
    main()
