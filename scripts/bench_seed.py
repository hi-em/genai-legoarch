"""Seed-robustness forge: re-run each building's WINNING config at other seeds.

Shows the pipeline is consistent, not a single-seed fluke. Forges only the
winner (28 / CFG 5.0 / LoRA 1.0 / negative on) at each requested seed — no A/B
sweep — so it's cheap (one image + one mesh per building per seed).

Writes docs/benchmarks/assets/examples/<key>/:
    <key>_s<seed>.png / .glb / _mesh.json

Run with the backend venv (serial; never two generations at once):
    backend/.venv/Scripts/python scripts/bench_seed.py --seed 2002 muralla sagrada bilbao
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
sys.path.insert(0, str(ROOT / "scripts"))

from forge_examples import EXAMPLES, NEGATIVE, EX  # noqa: E402

FAST = dict(ss=20, shape=25, tex=18, guidance=7.5,
            max_tokens=49152, decimation=40000, texture_size=512)
WIN = dict(steps=28, cfg=5.0, lora=1.0, neg=True)


def _forge(key: str, seed: int) -> None:
    from app import comfy_client
    from app.main import Generate3DReq, generate_3d

    label, prompt = EXAMPLES[key]
    d = EX / key
    d.mkdir(parents=True, exist_ok=True)
    png, glb = d / f"{key}_s{seed}.png", d / f"{key}_s{seed}.glb"
    print(f"\n=== {label} ({key}) · seed {seed} ===")

    if png.exists():
        print(f"  skip (exists): {png.name}")
    else:
        t0 = time.monotonic()
        res = comfy_client.run_txt2img(prompt, seed=seed, steps=WIN["steps"],
                                       cfg_scale=WIN["cfg"], lora_strength=WIN["lora"],
                                       negative=NEGATIVE if WIN["neg"] else "")
        png.write_bytes(res["png"])
        print(f"  {png.name}  ({round(time.monotonic()-t0,1)}s)")

    if glb.exists():
        print(f"  skip (exists): {glb.name}")
        return
    comfy_client.TRELLIS_TEX_STEPS = FAST["tex"]
    comfy_client.TRELLIS_MAX_TOKENS = FAST["max_tokens"]
    comfy_client.TRELLIS_DECIMATION = FAST["decimation"]
    comfy_client.TRELLIS_TEXTURE_SIZE = FAST["texture_size"]
    img_b64 = base64.b64encode(png.read_bytes()).decode("ascii")
    t0 = time.monotonic()
    resp = generate_3d(Generate3DReq(
        image_b64=img_b64, seed=seed, ss_steps=FAST["ss"], shape_steps=FAST["shape"],
        shape_guidance=FAST["guidance"], voxel_target=32))
    glb.write_bytes(base64.b64decode(resp["glbUrl"].split(",", 1)[1]))
    bm = resp.get("brickModel") or {}
    st = bm.get("stability") or {}
    (d / f"{key}_s{seed}_mesh.json").write_text(json.dumps({
        "building": label, "key": key, "seed": seed, "preset": "fast",
        "grid": bm.get("grid"), "n_bricks": len(bm.get("bricks") or []),
        "connected": st.get("connected"), "support_ratio": st.get("support_ratio"),
    }, indent=2), encoding="utf-8")
    print(f"  {glb.name}  ({round(time.monotonic()-t0,1)}s)  "
          f"bricks={len(bm.get('bricks') or [])} connected={st.get('connected')} "
          f"support={st.get('support_ratio')}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--seed", type=int, action="append", default=[],
                    help="alternate seed(s); repeatable")
    a = ap.parse_args()
    seeds = a.seed or [2002]
    keys = a.keys or list(EXAMPLES)
    bad = [k for k in keys if k not in EXAMPLES]
    if bad:
        raise SystemExit(f"unknown keys {bad}")
    print(f"seed-robustness: buildings={keys} seeds={seeds} (serial)")
    for k in keys:
        for s in seeds:
            _forge(k, s)
    print("\nseed forge done. Next: bench_axes.py rebuilds the seed-comparison montages.")


if __name__ == "__main__":
    main()
