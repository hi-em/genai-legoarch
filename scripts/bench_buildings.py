"""Full-axis benchmark on the example buildings (consistent per-building story).

GPU stage only: per building, a one-axis-at-a-time FLUX A/B sweep (steps -> cfg
-> lora -> negative, winner carried forward) + ONE TRELLIS forge of the winning
config. The fill/void, colour and scale axes are computed OFFLINE from the
resulting GLB by bench_axes.py (no GPU) — so this is the only GPU spend.

Per building writes to docs/benchmarks/assets/examples/<key>/:
    img_<cell>.png / .json     the 7 sweep cells (recipe sidecars)
    <key>.png                  the winning render (28/5.0/1.0/neg, canonical)
    <key>.glb                  the winning TRELLIS mesh
    <key>_mesh.json            mesh/brick stats from the live /generate-3d path

Run with the backend venv, ONE invocation (it serialises internally; never two
generations at once):

    backend/.venv/Scripts/python scripts/bench_buildings.py            # all three
    backend/.venv/Scripts/python scripts/bench_buildings.py muralla    # one
"""
from __future__ import annotations

import base64
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

from forge_examples import EXAMPLES, NEGATIVE, SEED, EX  # noqa: E402

# One-axis-at-a-time sweep, winner carried forward (mirrors docs/benchmarks.md §3).
#   name, steps, cfg, lora, negative
IMG_CELLS = [
    ("st20_cfg4",          20, 4.0, 1.0,  False),   # steps axis
    ("st28_cfg4",          28, 4.0, 1.0,  False),   #   winner: 28
    ("st40_cfg4",          40, 4.0, 1.0,  False),
    ("st28_cfg3",          28, 3.0, 1.0,  False),   # cfg axis (cfg4 reused above)
    ("st28_cfg5",          28, 5.0, 1.0,  False),   #   winner: 5.0  (= lora1 / neg-off)
    ("st28_cfg5_lora0p75", 28, 5.0, 0.75, False),   # lora axis (lora1 = st28_cfg5)
    ("st28_cfg5_neg",      28, 5.0, 1.0,  True),    # negative axis -> WINNER
]
WINNER = "st28_cfg5_neg"
FAST = dict(ss=20, shape=25, tex=18, guidance=7.5,
            max_tokens=49152, decimation=40000, texture_size=512)


def _sweep_one(key: str) -> None:
    from app import comfy_client
    from app.main import Generate3DReq, generate_3d

    label, prompt = EXAMPLES[key]
    d = EX / key
    d.mkdir(parents=True, exist_ok=True)
    print(f"\n=== {label} ({key}) ===")

    # ---- FLUX one-axis sweep -------------------------------------------------
    for name, steps, cfg, lora, neg in IMG_CELLS:
        png = d / f"img_{name}.png"
        if png.exists():
            print(f"  skip (exists): img_{name}.png")
            continue
        t0 = time.monotonic()
        res = comfy_client.run_txt2img(prompt, seed=SEED, steps=steps, cfg_scale=cfg,
                                       lora_strength=lora,
                                       negative=NEGATIVE if neg else "")
        dt = round(time.monotonic() - t0, 1)
        png.write_bytes(res["png"])
        (d / f"img_{name}.json").write_text(json.dumps({
            "building": label, "cell": name, "seed": SEED,
            "steps": steps, "cfg": cfg, "lora": lora, "negative": bool(neg),
            "time_s": dt, **res.get("params", {})}, indent=2), encoding="utf-8")
        print(f"  img_{name}.png  ({dt}s)")

    # canonical render = the winner
    (d / f"{key}.png").write_bytes((d / f"img_{WINNER}.png").read_bytes())

    # ---- TRELLIS forge of the winner ----------------------------------------
    glb = d / f"{key}.glb"
    if glb.exists():
        print(f"  skip (exists): {key}.glb")
        return
    print(f"  TRELLIS {label} (fast preset) ...")
    comfy_client.TRELLIS_TEX_STEPS = FAST["tex"]
    comfy_client.TRELLIS_MAX_TOKENS = FAST["max_tokens"]
    comfy_client.TRELLIS_DECIMATION = FAST["decimation"]
    comfy_client.TRELLIS_TEXTURE_SIZE = FAST["texture_size"]
    img_b64 = base64.b64encode((d / f"{key}.png").read_bytes()).decode("ascii")
    t0 = time.monotonic()
    resp = generate_3d(Generate3DReq(
        image_b64=img_b64, seed=SEED, ss_steps=FAST["ss"], shape_steps=FAST["shape"],
        shape_guidance=FAST["guidance"], voxel_target=32))
    dt = round(time.monotonic() - t0, 1)
    glb.write_bytes(base64.b64decode(resp["glbUrl"].split(",", 1)[1]))
    bm = resp.get("brickModel") or {}
    st = bm.get("stability") or {}
    (d / f"{key}_mesh.json").write_text(json.dumps({
        "building": label, "key": key, "seed": SEED, "preset": "fast",
        "time_s": dt, "voxel_count": (resp.get("voxel") or {}).get("count"),
        "grid": bm.get("grid"), "n_bricks": len(bm.get("bricks") or []),
        "connected": st.get("connected"), "support_ratio": st.get("support_ratio"),
    }, indent=2), encoding="utf-8")
    print(f"  {key}.glb  ({dt}s)  bricks={len(bm.get('bricks') or [])} "
          f"connected={st.get('connected')} support={st.get('support_ratio')}")


def main():
    keys = [a for a in sys.argv[1:] if not a.startswith("-")] or list(EXAMPLES)
    bad = [k for k in keys if k not in EXAMPLES]
    if bad:
        raise SystemExit(f"unknown keys {bad}; choices: {list(EXAMPLES)}")
    print(f"buildings: {keys}  (serial — never two generations at once)")
    for k in keys:
        _sweep_one(k)
    print("\nGPU sweep done. Next: scripts/bench_axes.py (offline) for fill/colour/scale.")


if __name__ == "__main__":
    main()
