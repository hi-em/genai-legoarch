"""Canonical figures for the six example buildings (the defense slide montage).

Forges each chip end-to-end through the REAL production path at the locked
defaults — FLUX (steps 28 / CFG 5.0 / LoRA 1.0 / negative ON) -> TRELLIS fast
preset -> voxelize(solid fill) -> legolize with the production colour fix
(rgb_blur 1 / smooth 2 / merge_tol 15) — and saves, per building:

    docs/benchmarks/assets/examples/<key>.png            FLUX render (proposed form)
    docs/benchmarks/assets/examples/<key>.glb            TRELLIS mesh
    docs/benchmarks/assets/examples/<key>_montage.png     render | mesh | post-exp | build
    docs/benchmarks/assets/examples/<key>.json            stats (pieces/colours/connected/support/grid)

GPU work is FLUX + TRELLIS only; the voxel/legolize/montage stage is the same
offline path replay_color.py uses, so the montage style matches §8.

Run with the backend venv, ONE building at a time (never two generations on the
16 GB GPU at once):

    backend/.venv/Scripts/python scripts/forge_examples.py colosseum
    backend/.venv/Scripts/python scripts/forge_examples.py --list
    backend/.venv/Scripts/python scripts/forge_examples.py --offline colosseum   # re-make montage/json from saved png+glb (no GPU)
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

EX = ROOT / "docs" / "benchmarks" / "assets" / "examples"

# Studio tail = prompt_grammar.json style_suffix (kept in sync by assertion below).
TAIL = (
    "standalone model on dark display base, white background, elevated 3/4 angle, "
    "product photography, studio lighting, official LEGO set photography"
)
NEGATIVE = (
    "people, trees, cars, vehicles, text, watermark, photograph of real building, "
    "landscape, cluttered background, thin spires, antennas"
)
SEED = 1001

# The six chips, verbatim from frontend/src/hero/examples.js (TAIL appended).
EXAMPLES = {
    "sagrada": (
        "Sagrada Família",
        "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, "
        "longitudinal basilica with eighteen clustered tapering openwork towers "
        "fused into the nave body, four-tower clusters over three sculpted "
        "facades and a taller central tower group, smooth tan and dark tan "
        "plastic bricks, intricate carved-stone filigree texture with deep "
        "portal recesses, stepped apse and solid podium base, tan stone "
        "throughout, dark tan shadow details, translucent crystal pinnacle "
        "tips, stained-glass color accents, " + TAIL),
    "sydney": (
        "Sydney Opera House",
        "Sydney Opera House Jørn Utzon, LEGO Architecture set, mirrored pairs "
        "of spherical-segment shell roofs rising in three fused groups from a "
        "massive solid podium, each shell a curved triangular section of one "
        "common sphere, smooth white and tan plastic bricks, subtle two-tone "
        "chevron tile pattern across the shells, broad terraced podium with "
        "monumental steps, glossy white shells, matte cream chevron bands, "
        "warm tan podium, dark glazing beneath the shells, " + TAIL),
    "muralla": (
        "La Muralla Roja",
        "La Muralla Roja Calpe Ricardo Bofill, LEGO Architecture set, "
        "interlocking Greek-cross towers forming a stepped casbah-like "
        "fortress around inner courtyards, rooftop terraces with external "
        "staircases descending between volumes, smooth dark red and coral "
        "plastic bricks, repeating vertical slot openings and crisp parapet "
        "edges, monolithic interlocked massing on a solid plinth, dark red "
        "outer walls, coral pink courtyards, medium lavender and sand blue "
        "stairwells, " + TAIL),
    "bilbao": (
        "Guggenheim Bilbao",
        "Guggenheim Museum Bilbao Frank Gehry, LEGO Architecture set, "
        "interconnected swirling titanium-clad volumes fused around a tall "
        "central glass atrium, overlapping curved ship-like masses merging "
        "into one continuous sculptural body, smooth metallic silver and light "
        "bluish grey plastic bricks, rippling overlapping metallic panel "
        "cladding with soft curved reflective folds, long stepped limestone "
        "plinth along the waterfront, metallic silver titanium curves, light "
        "bluish grey shadow folds, tan limestone base, trans-clear glazed "
        "atrium, " + TAIL),
    "stbasils": (
        "Saint Basil's Cathedral",
        "Saint Basil's Cathedral Moscow Red Square, LEGO Architecture set, "
        "nine onion-domed chapels clustered symmetrically around a tall central "
        "tented spire, all fused onto one shared raised gallery, bulbous domes "
        "on stout cylindrical drums, smooth red and white plastic bricks, "
        "candy-striped spiral and faceted onion domes with patterned brickwork "
        "and pointed arched gables, raised arcaded gallery podium with covered "
        "staircases, scarlet red brick walls, white trim, dark green, blue, "
        "golden yellow and orange spiral domes, pearl gold cupola tips, " + TAIL),
    "colosseum": (
        "Colosseum",
        "Colosseum Rome Flavian Amphitheatre, LEGO Architecture set, massive "
        "elliptical amphitheatre as one continuous fused oval ring of four "
        "stacked stone arcades, thick solid outer wall stepping down where it "
        "is ruined, enclosing the tiered arena, smooth tan and dark tan "
        "plastic bricks, repeating tiered round-arch arcades with engaged "
        "columns and regular rows of arched openings, solid stepped stone "
        "foundation ring, tan travertine stone, dark tan weathered shadows, "
        "reddish brown ruined breaks, light bluish grey arena floor, " + TAIL),
}

# Production legolize cell — the locked defaults (matches §8 "recommended").
PROD_CELL = {"palette": "classic", "rgb_blur_iters": 1, "smooth_iters": 2,
             "merge_tol": 15.0, "smooth_3d": False}
# TRELLIS fast preset (= production default).
FAST = dict(ss=20, shape=25, tex=18, guidance=7.5,
            max_tokens=49152, decimation=40000, texture_size=512)


def _assert_tail():
    import app.prompt_enhance  # noqa: F401  (ensures grammar loads)
    grammar = json.loads((ROOT / "backend" / "app" / "prompt_grammar.json").read_text(encoding="utf-8"))
    assert grammar["style_suffix"] == TAIL, "TAIL drifted from prompt_grammar.json style_suffix"


def _forge_gpu(key: str) -> None:
    """FLUX + TRELLIS (the only GPU work). Saves <key>.png and <key>.glb."""
    from app import comfy_client
    from app.main import Generate3DReq, generate_3d

    label, prompt = EXAMPLES[key]
    EX.mkdir(parents=True, exist_ok=True)
    png_path, glb_path = EX / f"{key}.png", EX / f"{key}.glb"

    if png_path.exists():
        print(f"  render exists, skip FLUX: {png_path.name}")
    else:
        print(f"  FLUX  {label} (steps 28 / cfg 5.0 / lora 1.0 / neg on) ...")
        t0 = time.monotonic()
        res = comfy_client.run_txt2img(prompt, seed=SEED, steps=28, cfg_scale=5.0,
                                       lora_strength=1.0, negative=NEGATIVE)
        png_path.write_bytes(res["png"])
        print(f"    -> {png_path.name}  ({round(time.monotonic()-t0,1)}s)")

    if glb_path.exists():
        print(f"  mesh exists, skip TRELLIS: {glb_path.name}")
        return
    print(f"  TRELLIS  {label} (fast preset) ...")
    comfy_client.TRELLIS_TEX_STEPS = FAST["tex"]
    comfy_client.TRELLIS_MAX_TOKENS = FAST["max_tokens"]
    comfy_client.TRELLIS_DECIMATION = FAST["decimation"]
    comfy_client.TRELLIS_TEXTURE_SIZE = FAST["texture_size"]
    img_b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    t0 = time.monotonic()
    resp = generate_3d(Generate3DReq(
        image_b64=img_b64, seed=SEED, ss_steps=FAST["ss"], shape_steps=FAST["shape"],
        shape_guidance=FAST["guidance"], voxel_target=32))
    glb_path.write_bytes(base64.b64decode(resp["glbUrl"].split(",", 1)[1]))
    print(f"    -> {glb_path.name}  ({round(time.monotonic()-t0,1)}s)")


def _montage_and_stats(key: str) -> dict:
    """Offline (no GPU): voxelize+exposure+legolize the saved glb, write montage + json."""
    import replay_color as R
    from app.legolizer import metrics as M

    label, _ = EXAMPLES[key]
    png_path, glb_path = EX / f"{key}.png", EX / f"{key}.glb"
    occ, rgb_pre, rgb_post, render_png = R._prepare(glb_path, png_path)
    if rgb_post is None:
        raise SystemExit(f"{key}: mesh has no vertex colours")
    render_h = M.render_hist(render_png, PROD_CELL["palette"])
    r = R._run_cell(occ, rgb_post, render_png, render_h, rgb_pre, PROD_CELL)
    model = r["model"]

    # montage in the §8 style, written to examples/
    from PIL import Image
    H = max(occ.shape[2] * 8, 160)

    def _fit(arr):
        im = Image.fromarray(arr)
        return im.resize((max(1, int(im.width * H / im.height)), H), Image.NEAREST)

    render = Image.open(__import__("io").BytesIO(render_png)).convert("RGB")
    panels = [render.resize((int(render.width * H / render.height), H)),
              _fit(R._elevation(rgb_pre, occ)),
              _fit(R._elevation(rgb_post, occ)),
              _fit(R._elevation(R._bricks_grid(model, PROD_CELL["palette"]), occ))]
    gap = 8
    W = sum(p.width for p in panels) + gap * (len(panels) - 1)
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    x = 0
    for p in panels:
        canvas.paste(p, (x, 0)); x += p.width + gap
    canvas.save(EX / f"{key}_montage.png")

    stats = {
        "building": label, "key": key, "seed": SEED,
        "flux": {"steps": 28, "cfg": 5.0, "lora": 1.0, "negative": True},
        "trellis_preset": "fast", "legolize": PROD_CELL,
        "pieces": r["n_pieces"], "n_colors": r["n_colors"],
        "frac_1x1": r["frac_1x1"], "grid": list(model.grid),
        "connected": r["connected"], "support": r["support"],
        "M1_palette_share": r["M1_palette_share"],
    }
    (EX / f"{key}.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(f"  -> {key}_montage.png · {key}.json  "
          f"(pieces={stats['pieces']} colours={stats['n_colors']} "
          f"connected={stats['connected']} support={stats['support']})")
    return stats


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("keys", nargs="*", help="building keys to forge (default: all)")
    ap.add_argument("--list", action="store_true", help="list building keys and exit")
    ap.add_argument("--offline", action="store_true",
                    help="skip GPU; rebuild montage+json from saved png+glb only")
    args = ap.parse_args()

    if args.list:
        for k, (label, _) in EXAMPLES.items():
            print(f"  {k:10} {label}")
        return

    _assert_tail()
    keys = args.keys or list(EXAMPLES)
    bad = [k for k in keys if k not in EXAMPLES]
    if bad:
        raise SystemExit(f"unknown keys {bad}; use --list")

    for k in keys:
        print(f"\n=== {EXAMPLES[k][0]} ({k}) ===")
        if not args.offline:
            _forge_gpu(k)
        _montage_and_stats(k)


if __name__ == "__main__":
    main()
