"""A/B: solid vs shell fill modes on a real TRELLIS GLB (quality preset)."""
import sys
import time
from pathlib import Path

import numpy as np

from app.main import _voxelize_and_legolize

GLB = Path(r"C:\ComfyUI_3D\output") / sys.argv[1]
glb = GLB.read_bytes()
print(f"mesh: {GLB.name} ({len(glb)/1e6:.1f} MB)\n")

for mode, t in (("solid", 2), ("shell", 2), ("shell", 3)):
    t0 = time.time()
    out = _voxelize_and_legolize(glb, None, 32, 7, {}, fill_mode=mode, shell_thickness=t)
    dt = time.time() - t0
    bm = out["brickModel"]
    st = bm["stability"]
    n_colors = len({b["color"] for b in bm["bricks"]})
    label = mode if mode == "solid" else f"{mode} t={t}"
    print(f"{label:>9}: {st['n_bricks']:>6} pieces | voxels {out['voxel']['count']:>6} "
          f"| connected={st['connected']} comps {st.get('components_before','-')}->"
          f"{st.get('components_after','-')} pillars={st.get('pillars_added','-')} "
          f"| support={st['support_ratio']} | colours={n_colors} | {dt:.1f}s")
