"""Offline replay + lever sweep for the colour pipeline (CPU only, no GPU).

The render -> mesh -> brick colour drift is tuned here, not on the shared GPU.
For each saved (GLB, render.png) pair this:
  1. voxelizes + exposure-matches ONCE (these don't depend on the colour levers),
  2. re-runs quantize -> pack -> assign for a grid of levers,
  3. scores each with metrics.py (M1 palette-share, M2 per-hop dE, M3 shatter),
  4. writes sweep.csv, and (with --dump) an elevation montage per mesh.

Corpus convention (docs/benchmarks/assets):
    mesh_<core>_<preset>.glb   <->   img_<core>.png
e.g. mesh_brutalist_..._neg_stock.glb  pairs with  img_brutalist_..._neg.png

Usage (run from repo root, with backend on PYTHONPATH):
    python scripts/replay_color.py                 # representative corpus, sweep, csv
    python scripts/replay_color.py --all --dump     # every glb + montages
    python scripts/replay_color.py mesh_habitat_..._stock.glb   # one mesh
"""
from __future__ import annotations

import argparse
import base64
import csv
import sys
from itertools import product
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "benchmarks" / "assets"
OUT = ASSETS / "color_replay"
sys.path.insert(0, str(ROOT / "backend"))

from app.legolizer import legolize_voxelgrid          # noqa: E402
from app.legolizer import color as _color             # noqa: E402
from app.legolizer import metrics as _metrics         # noqa: E402
from app.mesh_voxelize import match_exposure, voxelize_glb  # noqa: E402

_PRESETS = ("stock", "fast", "hybrid", "fullmesh", "halftok", "lowguide")

# Sweep grid. rgb_blur_iters is the headline lever (denoise the TRELLIS chroma
# speckle at its source); merge_tol stays in but barely fires on classic (colours
# sit ~38 dE apart); smooth_3d dropped — it washed M1 in the first sweep.
SWEEP = {
    "palette": ["classic"],
    "rgb_blur_iters": [0, 1, 2],
    "smooth_iters": [1, 2],
    "merge_tol": [0.0, 15.0],
    "smooth_3d": [False],
}


def _render_for(glb: Path) -> Path | None:
    """img_<core>.png for a mesh_<core>_<preset>.glb (strip prefix + preset)."""
    stem = glb.stem
    core = stem[len("mesh_"):] if stem.startswith("mesh_") else stem
    parts = core.rsplit("_", 1)
    if len(parts) == 2 and parts[1] in _PRESETS:
        core = parts[0]
    png = ASSETS / f"img_{core}.png"
    return png if png.exists() else None


def _representative() -> list[Path]:
    """One mesh per subject (prefer the 'stock' preset)."""
    glbs = sorted(ASSETS.glob("mesh_*.glb"))
    by_subject: dict[str, Path] = {}
    for g in glbs:
        subject = g.stem.split("_", 2)[1]               # mesh_<subject>_...
        if subject not in by_subject or "_stock" in g.stem:
            by_subject[subject] = g
    return list(by_subject.values())


def _prepare(glb_path: Path, render_path: Path, target: int = 32):
    """Voxelize + exposure-match once. Returns occ, rgb_pre, rgb_post, render_png."""
    glb = glb_path.read_bytes()
    render_png = render_path.read_bytes()
    voxel = voxelize_glb(glb, target=target, fill_mode="solid")
    nx, ny, nz = voxel["nx"], voxel["ny"], voxel["nz"]
    occ = (np.frombuffer(base64.b64decode(voxel["occ_b64"]), dtype=np.uint8)
           .reshape((nx, ny, nz), order="F").astype(bool))
    rgb_pre = None
    if voxel.get("rgb_b64"):
        rgb_pre = (np.frombuffer(base64.b64decode(voxel["rgb_b64"]), dtype=np.uint8)
                   .reshape((nz, ny, nx, 3)).transpose(2, 1, 0, 3))
    rgb_post = match_exposure(rgb_pre, render_png) if rgb_pre is not None else None
    return occ, rgb_pre, rgb_post, render_png


def _run_cell(occ, rgb_post, render_png, render_h, rgb_pre, cell: dict) -> dict:
    """Legolize one lever cell and score it."""
    tier = cell["palette"]
    options = {
        "seed": 1, "palette": tier,
        "merge_tol": cell["merge_tol"],
        "smooth_iters": cell["smooth_iters"],
        "smooth_3d": cell["smooth_3d"],
        "rgb_blur_iters": cell["rgb_blur_iters"],
    }
    model = legolize_voxelgrid(_occupancy=occ, options=options, voxel_rgb=rgb_post)
    bricks = model.bricks
    build_h = _metrics.build_hist(bricks, tier)
    m1 = _metrics.palette_share(render_h, build_h, tier)
    shatter = _metrics.shatter_stats(bricks)
    hops = _metrics.per_hop_delta_e({
        "render": render_h,
        "mesh": _metrics.voxel_hist(rgb_pre, tier) if rgb_pre is not None else None,
        "post_exp": _metrics.voxel_hist(rgb_post, tier) if rgb_post is not None else None,
        "build": build_h,
    }, tier)
    st = model.stability
    return {
        "M1_palette_share": round(m1, 4),
        "frac_1x1": round(shatter["frac_1x1"], 4),
        "n_pieces": shatter["n_pieces"],
        "n_colors": shatter["n_colors"],
        "tail_share": round(shatter["tail_share"], 4),
        "dE_chain": _chain_de(hops),               # render->mesh->post_exp->build
        "connected": st.get("connected"),
        "support": st.get("support_ratio"),
        "model": model,
    }


def _chain_de(hops: dict) -> float:
    """Sum of consecutive per-hop dE (render->mesh->post_exp->build)."""
    return round(sum(v for k, v in hops.items() if "->" in k), 2)


# --- elevation montage (front projection along y) ---------------------------

def _palette_rgb(tier):
    pal, _ = _color.resolve_palette(tier)
    return {p[0]: np.array(p[2], dtype=np.uint8) for p in pal}, pal


def _elevation(color_grid: np.ndarray, occ: np.ndarray) -> np.ndarray:
    """Front view (project along -y): (nz, nx, 3), z up."""
    nx, ny, nz = occ.shape
    img = np.full((nz, nx, 3), 245, dtype=np.uint8)
    for x in range(nx):
        for z in range(nz):
            col = occ[x, :, z]
            ys = np.nonzero(col)[0]
            if len(ys):
                img[nz - 1 - z, x] = color_grid[x, ys[0], z]
    return img


def _bricks_grid(model, tier) -> np.ndarray:
    """Rasterize the build into an (nx,ny,nz,3) colour grid via palette sRGB."""
    nx, ny, nz = model.grid
    code_rgb, _ = _palette_rgb(tier)
    grid = np.zeros((nx, ny, nz, 3), dtype=np.uint8)
    for b in model.bricks:
        rgb = code_rgb.get(b.color, np.array([200, 200, 200], dtype=np.uint8))
        grid[b.x:b.x + b.w, b.y:b.y + b.d, b.z:b.z + b.h] = rgb
    return grid


def _dump_montage(name: str, occ, rgb_pre, rgb_post, render_png, model, tier):
    from PIL import Image

    OUT.mkdir(parents=True, exist_ok=True)
    nx, ny, nz = occ.shape
    panels = []
    H = max(nz * 8, 160)

    def _fit(img_arr):
        im = Image.fromarray(img_arr)
        scale = H / im.height
        return im.resize((max(1, int(im.width * scale)), H), Image.NEAREST)

    render = Image.open(__import__("io").BytesIO(render_png)).convert("RGB")
    rscale = H / render.height
    panels.append(render.resize((int(render.width * rscale), H)))
    if rgb_pre is not None:
        panels.append(_fit(_elevation(rgb_pre, occ)))
    if rgb_post is not None:
        panels.append(_fit(_elevation(rgb_post, occ)))
    panels.append(_fit(_elevation(_bricks_grid(model, tier), occ)))

    gap = 8
    W = sum(p.width for p in panels) + gap * (len(panels) - 1)
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    x = 0
    for p in panels:
        canvas.paste(p, (x, 0))
        x += p.width + gap
    path = OUT / f"{name}.png"
    canvas.save(path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("meshes", nargs="*", help="specific mesh_*.glb names (default: representative)")
    ap.add_argument("--all", action="store_true", help="every mesh_*.glb in the corpus")
    ap.add_argument("--dump", action="store_true", help="write an elevation montage per mesh (baseline + best M1)")
    ap.add_argument("--full", action="store_true", help="also sweep the full (48) palette tier")
    args = ap.parse_args()

    if args.meshes:
        meshes = [ASSETS / m for m in args.meshes]
    elif args.all:
        meshes = sorted(ASSETS.glob("mesh_*.glb"))
    else:
        meshes = _representative()

    grid = dict(SWEEP)
    if args.full:
        grid["palette"] = ["classic", "full"]
    cells = [dict(zip(grid, vals)) for vals in product(*grid.values())]

    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for glb in meshes:
        render = _render_for(glb)
        if render is None:
            print(f"  skip {glb.name}: no matching render")
            continue
        print(f"\n=== {glb.name}  <-  {render.name} ===")
        occ, rgb_pre, rgb_post, render_png = _prepare(glb, render)
        if rgb_post is None:
            print("  no vertex colours in mesh — skipping")
            continue
        render_hists = {t: _metrics.render_hist(render_png, t) for t in grid["palette"]}

        print(f"  {'palette':>8} {'blur':>4} {'it':>2} {'mtol':>4} | "
              f"{'M1':>6} {'1x1%':>6} {'pieces':>7} {'cols':>4} {'dEsum':>6} {'conn':>5}")
        best = None
        for cell in cells:
            r = _run_cell(occ, rgb_post, render_png, render_hists[cell["palette"]], rgb_pre, cell)
            print(f"  {cell['palette']:>8} {cell['rgb_blur_iters']:>4} {cell['smooth_iters']:>2} "
                  f"{cell['merge_tol']:>4.0f} | {r['M1_palette_share']:>6.3f} "
                  f"{100*r['frac_1x1']:>5.1f}% {r['n_pieces']:>7} {r['n_colors']:>4} "
                  f"{r['dE_chain']:>6} {str(r['connected']):>5}")
            row = {"mesh": glb.name, **cell, **{k: v for k, v in r.items() if k != "model"}}
            rows.append(row)
            if best is None or r["M1_palette_share"] > best[1]["M1_palette_share"]:
                best = (cell, r)

        if args.dump and best is not None:
            baseline = next(c for c in cells
                            if c["merge_tol"] == 0 and c["smooth_iters"] == 1
                            and c["rgb_blur_iters"] == 0 and not c["smooth_3d"]
                            and c["palette"] == grid["palette"][0])
            b_model = _run_cell(occ, rgb_post, render_png,
                                render_hists[baseline["palette"]], rgb_pre, baseline)["model"]
            subj = glb.stem.split("_", 2)[1]
            p1 = _dump_montage(f"{subj}_baseline", occ, rgb_pre, rgb_post, render_png, b_model, baseline["palette"])
            p2 = _dump_montage(f"{subj}_best_m1", occ, rgb_pre, rgb_post, render_png, best[1]["model"], best[0]["palette"])
            print(f"  montage: {p1.name}, {p2.name}  (best: {best[0]})")

    if rows:
        csv_path = OUT / "sweep.csv"
        with open(csv_path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print(f"\nwrote {csv_path}  ({len(rows)} rows)")


if __name__ == "__main__":
    main()
