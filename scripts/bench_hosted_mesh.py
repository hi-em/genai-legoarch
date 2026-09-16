"""Legolize ANY image-to-3D mesh with the production CPU pipeline and score it.

Built for the hosted-generation study (docs/hosted-generation.md): feed the
same benchmark render to a hosted image-to-3D service, drop the GLB it returns
next to the TRELLIS one, and compare on the thesis metrics — piece count,
colours, single connected component, support ratio, M1 palette agreement —
plus a montage (render | mesh voxel colour | exposure-matched | brick build)
so "does it still read as the building" can be judged by eye.

CPU only, no GPU, no ComfyUI. Uses the SAME code path as /api/legolize-mesh
(voxelize_glb -> match_exposure -> legolize_voxelgrid) and the same production
levers as docs/benchmarks.md (detail 32, solid fill, rgb_blur 1 / smooth 2 /
merge_tol 15, classic palette).

Usage (from repo root, backend venv):
    backend/.venv/Scripts/python scripts/bench_hosted_mesh.py \
        --glb path/to/hosted.glb --render docs/benchmarks/assets/examples/sagrada/sagrada.png \
        --label "sagrada / meshy" --out docs/benchmarks/assets/hosted/sagrada_meshy

    # reproduce the TRELLIS reference numbers (4,682 pc / 21 col / 0.95):
    backend/.venv/Scripts/python scripts/bench_hosted_mesh.py --example sagrada

Writes <out>.json (numbers) and <out>_montage.png (the four panels).
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EX = ROOT / "docs" / "benchmarks" / "assets" / "examples"
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

import replay_color as R                     # noqa: E402
from app.legolizer import metrics as M       # noqa: E402

PROD = {"palette": "classic", "rgb_blur_iters": 1, "smooth_iters": 2, "merge_tol": 15.0, "smooth_3d": False}
TIER = "classic"


def _mesh_facts(glb: bytes) -> dict:
    """What the voxelizer will see: faces, watertight, colour source."""
    import trimesh

    scene = trimesh.load(io.BytesIO(glb), file_type="glb", force="scene")
    meshes = [g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh)]
    faces = sum(len(m.faces) for m in meshes)
    kinds = sorted({type(m.visual).__name__ for m in meshes})
    watertight = all(m.is_watertight for m in meshes) if meshes else False
    return {"geometries": len(meshes), "faces": faces, "visual": kinds, "watertight": watertight}


def score(glb: bytes, render_png: bytes, target: int = 32, out: Path | None = None) -> dict:
    t0 = time.perf_counter()
    voxel = R.voxelize_glb(glb, target=target, fill_mode="solid")
    import base64
    import numpy as np
    nx, ny, nz = voxel["nx"], voxel["ny"], voxel["nz"]
    occ = (np.frombuffer(base64.b64decode(voxel["occ_b64"]), dtype=np.uint8)
           .reshape((nx, ny, nz), order="F").astype(bool))
    rgb_pre = None
    if voxel.get("rgb_b64"):
        rgb_pre = (np.frombuffer(base64.b64decode(voxel["rgb_b64"]), dtype=np.uint8)
                   .reshape((nz, ny, nx, 3)).transpose(2, 1, 0, 3))
    if rgb_pre is None:
        raise SystemExit("mesh carries no colour (no texture / vertex colours) — the legolizer would go grey")
    rgb_post = R.match_exposure(rgb_pre, render_png)
    render_h = M.render_hist(render_png, TIER)
    cell = R._run_cell(occ, rgb_post, render_png, render_h, rgb_pre, PROD)
    model = cell.pop("model")
    cell["grid"] = list(model.grid)
    cell["voxels"] = int(occ.sum())
    cell["legolize_s"] = round(time.perf_counter() - t0, 1)
    cell["mesh"] = _mesh_facts(glb)
    if out is not None:
        out.parent.mkdir(parents=True, exist_ok=True)
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
        cv = Image.new("RGB", (W, H), (255, 255, 255))
        x = 0
        for p in panels:
            cv.paste(p, (x, 0)); x += p.width + gap
        cv.save(out.with_name(out.name + "_montage.png"))
        out.with_suffix(".json").write_text(json.dumps(cell, indent=2), encoding="utf-8")
    return cell


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--example", help="benchmark key (sagrada|muralla|bilbao): use its TRELLIS glb + render")
    ap.add_argument("--glb", help="any GLB (e.g. from a hosted service)")
    ap.add_argument("--render", help="the render PNG that produced it (colour exposure match)")
    ap.add_argument("--label", default="")
    ap.add_argument("--target", type=int, default=32)
    ap.add_argument("--out", help="output stem (writes <out>.json + <out>_montage.png)")
    a = ap.parse_args()
    if a.example:
        glb_p = EX / a.example / f"{a.example}.glb"
        render_p = EX / a.example / f"{a.example}.png"
        label = a.label or f"{a.example} / TRELLIS-2 (reference)"
    else:
        if not (a.glb and a.render):
            ap.error("--glb and --render are required without --example")
        glb_p, render_p, label = Path(a.glb), Path(a.render), a.label or Path(a.glb).stem
    out = Path(a.out) if a.out else None
    r = score(glb_p.read_bytes(), render_p.read_bytes(), a.target, out)
    print(f"=== {label} ===")
    print(f"  mesh     : {r['mesh']}")
    print(f"  grid     : {r['grid']}  voxels {r['voxels']}")
    print(f"  pieces   : {r['n_pieces']}   colours {r['n_colors']}   frac_1x1 {r['frac_1x1']}")
    print(f"  connected: {r['connected']}   support {r['support']}")
    print(f"  M1       : {r['M1_palette_share']}   dE chain {r['dE_chain']}   ({r['legolize_s']}s)")
    if out:
        print(f"  wrote    : {out}.json + {out}_montage.png")


if __name__ == "__main__":
    main()
