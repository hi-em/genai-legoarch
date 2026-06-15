"""Sagrada exploration: 5 prompt+seed variants to pick the most faithful one.

Stage 1 (default): generate the 5 FLUX renders only (cheap) + a comparison grid.
    backend/.venv/Scripts/python scripts/forge_sagrada_variants.py
Stage 2: forge the full build (TRELLIS + legolize + montage) for a chosen variant.
    backend/.venv/Scripts/python scripts/forge_sagrada_variants.py --build v3

Outputs to docs/benchmarks/assets/examples/sagrada/variants/.
"""
from __future__ import annotations

import base64
import io
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

from forge_examples import NEGATIVE  # noqa: E402

TAIL = ("standalone model on dark display base, white background, elevated 3/4 angle, "
        "product photography, studio lighting, official LEGO set photography")
OUT = ROOT / "docs" / "benchmarks" / "assets" / "examples" / "sagrada" / "variants"

# Each variant takes a different path to "the real deal", with its own seed.
VARIANTS = [
    ("v1", "baseline", 1001,
     "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, longitudinal "
     "basilica with eighteen clustered tapering openwork towers fused into the nave "
     "body, four-tower clusters over three sculpted facades and a taller central tower "
     "group, smooth tan and dark tan plastic bricks, intricate carved-stone filigree "
     "texture with deep portal recesses, stepped apse and solid podium base, tan stone "
     "throughout, dark tan shadow details, translucent crystal pinnacle tips, "
     "stained-glass color accents, " + TAIL),
    ("v2", "spire-forest", 2002,
     "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, a dense vertical "
     "forest of eighteen tall slender tapering openwork spires fused into one "
     "continuous basilica body, the central Tower of Jesus rising tallest above "
     "clustered facade towers, smooth tan and dark tan plastic bricks, perforated "
     "lacework stone with repeating pointed pinnacles and tracery, stepped apse on a "
     "solid podium base, warm tan sandstone throughout, dark tan recess shadows, "
     "pearl-gold pinnacle tips, " + TAIL),
    ("v3", "facade-ornament", 3003,
     "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, monumental "
     "basilica with three deeply sculpted facades fused beneath eighteen clustered "
     "tapering towers, the Nativity facade dense with carved ornament over three "
     "recessed portals, smooth tan and dark tan plastic bricks, intricate carved-stone "
     "relief and bar tracery, stepped apse and broad solid podium base, honey tan "
     "sandstone, dark tan carved shadows, colorful ceramic mosaic pinnacle caps, " + TAIL),
    ("v4", "set-21065", 7777,
     "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set 21065, the "
     "completed basilica with all eighteen towers fused into one unified tan-stone "
     "massing, the tall central spire flanked by four-tower facade clusters, smooth tan "
     "and dark tan plastic bricks, regular vertical bays of pointed openwork windows, "
     "stepped apse on a solid display podium, uniform tan stone throughout, subtle dark "
     "tan seams, crystal-tipped spires, " + TAIL),
    ("v5", "polychrome", 4242,
     "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, soaring basilica "
     "of eighteen fused tapering openwork towers over three carved facades, smooth tan "
     "and warm sand plastic bricks, finely textured lacework stone with deep window "
     "recesses, stepped apse and solid podium base, warm honey-tan sandstone walls, "
     "dark tan shadow detailing, bright polychrome ceramic mosaic pinnacle tips in red "
     "green and gold, " + TAIL),
]
# Blended follow-ups (owner ask): v2 spire-forest × v4 unified set massing,
# foregrounding the tallest central Tower of Jesus Christ crowned with a cross.
# Tower worded STOUT/fused so it (and the cross) survive voxelization.
_P_JESUS = (
    "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, the completed "
    "basilica as one unified tan-stone massing of eighteen fused tapering openwork "
    "towers in a dense vertical cluster, the tallest central Tower of Jesus Christ a "
    "stout fused spire rising far above the others and crowned with a cross, smooth tan "
    "and dark tan plastic bricks, vertical lacework stone with pointed pinnacles and "
    "tracery, stepped apse on a solid display podium, warm tan sandstone throughout, "
    "dark tan recess shadows, pearl-gold pinnacle tips, " + TAIL)
_P_JESUS_POLY = (
    "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set 21065, the completed "
    "basilica with all eighteen towers fused into one unified tan-stone massing, the "
    "tall central Tower of Jesus Christ a stout fused spire rising highest and crowned "
    "with a cross, flanked by four-tower facade clusters, smooth tan and warm sand "
    "plastic bricks, regular vertical bays of pointed openwork windows, stepped apse on "
    "a solid podium, warm honey-tan sandstone, dark tan seams, bright polychrome ceramic "
    "mosaic pinnacle tips in red green and gold, " + TAIL)
MIX = [
    ("v6a", "jesus-tower", 5050, _P_JESUS),
    ("v6b", "jesus-tower", 6161, _P_JESUS),
    ("v7a", "jesus-poly", 8080, _P_JESUS_POLY),
    ("v7b", "jesus-poly", 9090, _P_JESUS_POLY),
]
# Match the ACTUAL released LEGO Architecture 21065 (researched 2026-06): the real
# set is UNIFIED TAN (not polychrome) — colour comes only from trans stained-glass
# windows + trans-clear "5-point crystal" spire tips; central Tower of Jesus Christ
# rises tallest with a cross; 3 facades + rounded apse + two circular sacristies.
_P_MATCH = (
    "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set 21065, the completed "
    "basilica with eighteen symbolic tapering openwork towers fused into one unified "
    "tan-stone massing, the central Tower of Jesus Christ a stout fused spire rising "
    "tallest above the others and crowned with a cross, three deeply carved facades with "
    "a rounded apse and two circular sacristies, smooth tan plastic bricks in a unified "
    "stone palette with subtle sand and light bluish grey, fine vertical openwork tracery "
    "with tall pointed window bays, stepped solid display base, uniform tan sandstone "
    "throughout, transparent stained-glass windows glowing red orange blue and green, "
    "trans-clear crystal pinnacle and star tips, " + TAIL)
MATCH = [
    ("v8a", "match-21065", 1212, _P_MATCH),
    ("v8b", "match-21065", 3434, _P_MATCH),
]
BY_ID = {v[0]: v for v in VARIANTS + MIX + MATCH}
FAST = dict(ss=20, shape=25, tex=18, guidance=7.5, max_tokens=49152, decimation=40000, texture_size=512)


def _font(sz, bold=False):
    p = r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"
    try:
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.load_default()


def _renders(variants, grid_name):
    from app import comfy_client
    OUT.mkdir(parents=True, exist_ok=True)
    for vid, label, seed, prompt in variants:
        png = OUT / f"{vid}_{label}.png"
        if png.exists():
            print(f"  skip (exists): {png.name}"); continue
        t0 = time.monotonic()
        res = comfy_client.run_txt2img(prompt, seed=seed, steps=28, cfg_scale=5.0,
                                       lora_strength=1.0, negative=NEGATIVE)
        png.write_bytes(res["png"])
        (OUT / f"{vid}_{label}.json").write_text(json.dumps(
            {"id": vid, "label": label, "seed": seed, "prompt": prompt}, indent=2), encoding="utf-8")
        print(f"  {png.name}  seed {seed}  ({round(time.monotonic()-t0,1)}s)")
    _grid(variants, grid_name)


def _grid(variants, grid_name):
    cell, pad, hdr = 300, 14, 40
    items = [(v[0], v[1], v[2], OUT / f"{v[0]}_{v[1]}.png") for v in variants]
    items = [it for it in items if it[3].exists()]
    n = len(items)
    W = n * (cell + pad) + pad
    H = hdr + cell + pad
    cv = Image.new("RGB", (W, H), (255, 255, 255))
    dr = ImageDraw.Draw(cv)
    f = _font(17, True)
    for i, (vid, label, seed, p) in enumerate(items):
        x = pad + i * (cell + pad)
        dr.text((x + cell // 2, 8), f"{vid} · {label} · seed {seed}", font=f, fill=(32, 38, 43), anchor="ma")
        cv.paste(Image.open(p).convert("RGB").resize((cell, cell)), (x, hdr))
    cv.save(OUT / f"{grid_name}.png")
    print(f"  {grid_name}.png ({n} variants)")


def _build(vid: str):
    """Full build for one chosen variant: TRELLIS + legolize + render|mesh|post|build montage."""
    import replay_color as R
    from app.legolizer import metrics as M
    from app.mesh_voxelize import match_exposure, voxelize_glb
    from app import comfy_client
    from app.main import Generate3DReq, generate_3d

    vid_, label, seed, prompt = BY_ID[vid]
    png = OUT / f"{vid}_{label}.png"
    if not png.exists():
        raise SystemExit(f"{vid}: render missing — run stage 1 first")
    glb = OUT / f"{vid}_{label}.glb"
    if not glb.exists():
        print(f"  TRELLIS {vid} ({label}) seed {seed} ...")
        comfy_client.TRELLIS_TEX_STEPS = FAST["tex"]
        comfy_client.TRELLIS_MAX_TOKENS = FAST["max_tokens"]
        comfy_client.TRELLIS_DECIMATION = FAST["decimation"]
        comfy_client.TRELLIS_TEXTURE_SIZE = FAST["texture_size"]
        b64 = base64.b64encode(png.read_bytes()).decode("ascii")
        resp = generate_3d(Generate3DReq(image_b64=b64, seed=seed, ss_steps=FAST["ss"],
                                         shape_steps=FAST["shape"], shape_guidance=FAST["guidance"],
                                         voxel_target=32))
        glb.write_bytes(base64.b64decode(resp["glbUrl"].split(",", 1)[1]))

    render = png.read_bytes()
    v = voxelize_glb(glb.read_bytes(), target=32, fill_mode="solid")
    nx, ny, nz = v["nx"], v["ny"], v["nz"]
    occ = np.frombuffer(base64.b64decode(v["occ_b64"]), np.uint8).reshape((nx, ny, nz), order="F").astype(bool)
    rgb_pre = np.frombuffer(base64.b64decode(v["rgb_b64"]), np.uint8).reshape((nz, ny, nx, 3)).transpose(2, 1, 0, 3)
    rgb_post = match_exposure(rgb_pre, render)
    rh = M.render_hist(render, "classic")
    cell = {"palette": "classic", "rgb_blur_iters": 1, "smooth_iters": 2, "merge_tol": 15.0, "smooth_3d": False}
    r = R._run_cell(occ, rgb_post, render, rh, rgb_pre, cell)
    H = max(nz * 8, 160)

    def _fit(a):
        im = Image.fromarray(a); return im.resize((max(1, int(im.width * H / im.height)), H), Image.NEAREST)
    rimg = Image.open(io.BytesIO(render)).convert("RGB")
    panels = [rimg.resize((int(rimg.width * H / rimg.height), H)), _fit(R._elevation(rgb_pre, occ)),
              _fit(R._elevation(rgb_post, occ)), _fit(R._elevation(R._bricks_grid(r["model"], "classic"), occ))]
    Wt = sum(p.width for p in panels) + 8 * 3
    cv = Image.new("RGB", (Wt, H), (255, 255, 255)); x = 0
    for p in panels:
        cv.paste(p, (x, 0)); x += p.width + 8
    cv.save(OUT / f"{vid}_{label}_montage.png")
    print(f"  {vid} build: {r['n_pieces']} pieces / {r['n_colors']} colours / "
          f"connected={r['connected']} / support={r['support']} -> {vid}_{label}_montage.png")


def main():
    args = sys.argv[1:]
    if args and args[0] == "--build":
        for vid in args[1:]:
            _build(vid)
    elif args and args[0] == "--mix":
        _renders(MIX, "mix_grid")
    elif args and args[0] == "--match":
        _renders(MATCH, "match_grid")
    else:
        _renders(VARIANTS, "variants_grid")


if __name__ == "__main__":
    main()
