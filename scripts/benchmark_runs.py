"""A/B benchmark harness for the lEgoarCh generation pipeline.

Runs the parameter matrix documented in docs/benchmarks.md against the two
live ComfyUI servers, saving every output next to a sidecar .json that records
model, prompt, seed and every parameter — the raw data behind the faculty
"explain your data and workflows" requirement.

Run with the backend venv (it has fastapi/trimesh/httpx/Pillow):

    backend/.venv/Scripts/python scripts/benchmark_runs.py A          # image stage A (steps)
    backend/.venv/Scripts/python scripts/benchmark_runs.py B --steps 28
    backend/.venv/Scripts/python scripts/benchmark_runs.py C --steps 28 --cfg 4.0
    backend/.venv/Scripts/python scripts/benchmark_runs.py D --steps 28 --cfg 4.0 --lora 1.0
    backend/.venv/Scripts/python scripts/benchmark_runs.py E --steps 28 --cfg 4.0 --lora 1.0 [--neg]
    backend/.venv/Scripts/python scripts/benchmark_runs.py T --image img_brutalist_seed1001_...png

Stages are sequential one-axis-at-a-time: judge each stage's outputs, then pass
the winner forward as flags to the next stage. Stage T (TRELLIS) takes winning
image files via --image (repeatable) and exercises /generate-3d end to end so
voxelization survival + brick stats are captured per run.
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

ASSETS = ROOT / "docs" / "benchmarks" / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

TAIL = (
    "standalone model on dark display base, white background, elevated 3/4 angle, "
    "product photography, studio lighting, official LEGO set photography"
)

# Canonical prompts: P1 = best-case prismatic, P2 = curved/translucent stress
# case, P3 = the terraced target aesthetic (also the new prompt reference).
PROMPTS = {
    "brutalist": (
        "Brutalist concrete tower with stepped setbacks, LEGO Architecture set, "
        "monolithic stacked rectilinear massing rising in receding tiers, smooth dark "
        "bluish grey and light grey plastic bricks, board-formed concrete texture with "
        "deep window recesses, cantilevered terrace slabs, heavy podium base, exposed "
        "structural grid, " + TAIL
    ),
    "flv": (
        "Fondation Louis Vuitton Paris Frank Gehry, LEGO Architecture set, multiple "
        "billowing curved glass sail forms arching over white concrete base, smooth "
        "translucent light grey and pearl white plastic bricks, overlapping curved "
        "canopy sails with ribbed surface pattern, angular deconstructivist white base "
        "volumes beneath, light grey translucent sail panels, bright white concrete "
        "base, silver grey structural ribs, " + TAIL
    ),
    "habitat": (
        "Habitat 67 Montreal Moshe Safdie, LEGO Architecture set, stacked offset "
        "concrete cube modules forming a terraced pyramidal hill, smooth light bluish "
        "grey and tan plastic bricks, repeating modular box pattern with recessed "
        "terrace openings, cantilevered cubic clusters over a solid podium, light "
        "bluish grey volumes, tan terrace insets, dark grey shadow gaps, " + TAIL
    ),
}

NEGATIVE = (
    "people, trees, cars, vehicles, text, watermark, photograph of real building, "
    "landscape, cluttered background, thin spires, antennas"
)

SEED_MAIN = 1001
SEED_ALT = 2002


def _slug(v: float) -> str:
    return str(v).replace(".", "p")


def run_image(prompt_key: str, seed: int, steps: int, cfg: float, lora: float,
              negative: str = "") -> Path:
    """One txt2img run; saves PNG + sidecar JSON; returns the PNG path."""
    from app import comfy_client

    name = (
        f"img_{prompt_key}_seed{seed}_st{steps}_cfg{_slug(cfg)}_lora{_slug(lora)}"
        + ("_neg" if negative else "")
    )
    png_path = ASSETS / f"{name}.png"
    if png_path.exists():
        print(f"  skip (exists): {png_path.name}")
        return png_path

    t0 = time.monotonic()
    result = comfy_client.run_txt2img(
        PROMPTS[prompt_key], seed=seed, steps=steps, cfg_scale=cfg,
        lora_strength=lora, negative=negative,
    )
    elapsed = round(time.monotonic() - t0, 1)
    png_path.write_bytes(result["png"])
    record = {
        "kind": "image",
        "model": "flux-2-klein-base-4b-fp8 + FLUX.2/legoarch.safetensors LoRA",
        "text_encoder": "qwen_3_4b_fp8_mixed",
        "vae": "flux2-vae",
        "sampler": "euler + Flux2Scheduler",
        "resolution": "1024x1024",
        "prompt_key": prompt_key,
        "time_s": elapsed,
        **result["params"],
    }
    (ASSETS / f"{name}.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    print(f"  {png_path.name}  ({elapsed}s)")
    return png_path


def run_trellis_preset(image_path: Path, preset: str, *, ss: int, shape: int,
                       tex: int, guidance: float, max_tokens: int,
                       decimation: int, texture_size: int,
                       voxel_target: int = 32, seed: int = SEED_MAIN) -> None:
    """One image->3D->voxel->bricks run through the real /generate-3d logic."""
    from app import comfy_client
    from app.main import Generate3DReq, generate_3d

    name = f"mesh_{image_path.stem.replace('img_', '')}_{preset}"
    glb_path = ASSETS / f"{name}.glb"
    if glb_path.exists():
        print(f"  skip (exists): {glb_path.name}")
        return

    # tex steps / max tokens / decimation / texture size are env-level knobs,
    # not request params — override the module constants for this run.
    comfy_client.TRELLIS_TEX_STEPS = tex
    comfy_client.TRELLIS_MAX_TOKENS = max_tokens
    comfy_client.TRELLIS_DECIMATION = decimation
    comfy_client.TRELLIS_TEXTURE_SIZE = texture_size

    img_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    t0 = time.monotonic()
    resp = generate_3d(Generate3DReq(
        image_b64=img_b64, seed=seed, ss_steps=ss, shape_steps=shape,
        shape_guidance=guidance, voxel_target=voxel_target,
    ))
    elapsed = round(time.monotonic() - t0, 1)

    glb_path.write_bytes(base64.b64decode(resp["glbUrl"].split(",", 1)[1]))
    bm = resp.get("brickModel") or {}
    stability = bm.get("stability") or {}
    record = {
        "kind": "trellis",
        "model": "TRELLIS.2-4B (visualbruno ComfyUI wrapper)",
        "input_image": image_path.name,
        "preset": preset,
        "time_s": elapsed,
        "ss_steps": ss, "shape_steps": shape, "tex_steps": tex,
        "shape_guidance": guidance, "max_tokens": max_tokens,
        "decimation": decimation, "texture_size": texture_size,
        "voxel_target": voxel_target, "seed": seed,
        "voxel_count": (resp.get("voxel") or {}).get("count"),
        "grid": bm.get("grid"),
        "n_bricks": len(bm.get("bricks") or []),
        "connected": stability.get("connected"),
        "support_ratio": stability.get("support_ratio"),
        "voxel_error": resp.get("voxelError"),
    }
    (ASSETS / f"{name}.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    _save_voxel_preview(resp, ASSETS / f"{name}_voxels.png")
    print(f"  {glb_path.name}  ({elapsed}s)  bricks={record['n_bricks']} "
          f"connected={record['connected']}")


def _save_voxel_preview(resp: dict, out: Path) -> None:
    """Tiny front + side elevation render of the occupancy grid (judging aid)."""
    try:
        import numpy as np
        from PIL import Image

        voxel = resp.get("voxel") or {}
        nx, ny, nz = voxel["nx"], voxel["ny"], voxel["nz"]
        occ = (
            np.frombuffer(base64.b64decode(voxel["occ_b64"]), dtype=np.uint8)
            .reshape((nx, ny, nz), order="F").astype(bool)
        )
        front = occ.any(axis=1).T[::-1]          # (nz, nx), z up
        side = occ.any(axis=0).T[::-1]           # (nz, ny)
        gap = np.zeros((front.shape[0], 2), dtype=bool)
        panel = np.concatenate([front, gap, side], axis=1)
        img = Image.fromarray((~panel * 255).astype("uint8"), "L")
        img = img.resize((panel.shape[1] * 8, panel.shape[0] * 8), Image.NEAREST)
        img.save(out)
    except Exception as e:  # preview is best-effort only
        print(f"  (voxel preview failed: {e})")


# ---- stages --------------------------------------------------------------------
def stage_A(args):
    print("Stage A — steps sweep (cfg 4.0, lora 1.0, seed 1001)")
    for key in ("brutalist", "flv", "habitat"):
        for steps in (20, 28, 40):
            run_image(key, SEED_MAIN, steps, 4.0, 1.0)


def stage_B(args):
    print(f"Stage B — cfg sweep @ steps={args.steps}")
    for key in ("brutalist", "habitat"):
        for cfg in (3.0, 4.0, 5.0):
            run_image(key, SEED_MAIN, args.steps, cfg, 1.0)


def stage_C(args):
    print(f"Stage C — lora sweep @ steps={args.steps} cfg={args.cfg}")
    for key in ("brutalist", "habitat"):
        for lora in (0.75, 1.0):
            run_image(key, SEED_MAIN, args.steps, args.cfg, lora)


def stage_D(args):
    print(f"Stage D — negative prompt @ steps={args.steps} cfg={args.cfg} lora={args.lora}")
    for key in ("brutalist", "habitat"):
        run_image(key, SEED_MAIN, args.steps, args.cfg, args.lora, negative=NEGATIVE)


def stage_E(args):
    print(f"Stage E — seed robustness @ winner config (seed {SEED_ALT})")
    neg = NEGATIVE if args.neg else ""
    for key in ("brutalist", "flv", "habitat"):
        run_image(key, SEED_ALT, args.steps, args.cfg, args.lora, negative=neg)


TRELLIS_PRESETS = {
    "fast":      dict(ss=20, shape=25, tex=18, guidance=7.5, max_tokens=49152, decimation=40000,  texture_size=512),
    "stock":     dict(ss=25, shape=35, tex=25, guidance=7.5, max_tokens=49152, decimation=200000, texture_size=1024),
    "lowguide":  dict(ss=20, shape=25, tex=18, guidance=5.0, max_tokens=49152, decimation=40000,  texture_size=512),
    "halftok":   dict(ss=20, shape=25, tex=18, guidance=7.5, max_tokens=24576, decimation=40000,  texture_size=512),
    # stock's geometry steps (what fixes connectivity?) + fast's export budget
    # -> REFUTED: still disconnected. Steps are not the lever.
    "hybrid":    dict(ss=25, shape=35, tex=20, guidance=7.5, max_tokens=49152, decimation=40000,  texture_size=512),
    # fast steps + FULL decimation: tests whether the 40k-face simplification
    # is what severs thin links (texture size is colour-only, kept lean)
    "fullmesh":  dict(ss=20, shape=25, tex=18, guidance=7.5, max_tokens=49152, decimation=200000, texture_size=512),
}


def stage_T(args):
    presets = args.presets or list(TRELLIS_PRESETS)
    print(f"Stage T — TRELLIS sweep, presets: {presets}")
    for image in args.image:
        path = Path(image) if Path(image).is_absolute() else ASSETS / image
        if not path.exists():
            print(f"  MISSING image: {path}")
            continue
        for preset in presets:
            run_trellis_preset(path, preset, **TRELLIS_PRESETS[preset])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("stage", choices=["A", "B", "C", "D", "E", "T"])
    ap.add_argument("--steps", type=int, default=28, help="winner steps from stage A")
    ap.add_argument("--cfg", type=float, default=4.0, help="winner cfg from stage B")
    ap.add_argument("--lora", type=float, default=1.0, help="winner lora from stage C")
    ap.add_argument("--neg", action="store_true", help="include the negative prompt (stage E)")
    ap.add_argument("--image", action="append", default=[],
                    help="input image (filename in assets/ or absolute path) for stage T")
    ap.add_argument("--presets", nargs="*", choices=list(TRELLIS_PRESETS),
                    help="subset of TRELLIS presets for stage T")
    args = ap.parse_args()
    {"A": stage_A, "B": stage_B, "C": stage_C, "D": stage_D, "E": stage_E, "T": stage_T}[args.stage](args)


if __name__ == "__main__":
    main()
