"""Throwaway perf probe: slope pass vs packer vs colour pipeline at target-64 scale."""
import time

import numpy as np

from app.legolizer import bricks as B
from app.legolizer import color as C
from app.legolizer import slopes as S
from app.legolizer import repair as R
from app.legolizer import legolize_voxelgrid


def synth_building(nx=64, ny=64, nz=160, shell=True):
    """Stepped 'ziggurat' building with window voids — worst-ish case for slopes."""
    occ = np.zeros((nx, ny, nz), dtype=bool)
    # stepped pyramid: every 2 courses (6 plates) inset by 1 stud
    for z in range(nz):
        inset = min(z // 6, nx // 2 - 2)
        occ[inset:nx - inset, inset:ny - inset, z] = True
    if shell:
        from scipy import ndimage
        core = occ
        for axis, t in ((0, 2), (1, 2), (2, 5)):
            shape = [1, 1, 1]
            shape[axis] = 2 * t + 1
            core = ndimage.binary_erosion(core, structure=np.ones(shape), border_value=0)
        occ = occ & ~core
    return occ


def synth_rgb(occ):
    """Surface-sampled RGB like TRELLIS texture sampling: surface voxels lit."""
    from scipy import ndimage
    interior = ndimage.binary_erosion(occ)
    surf = occ & ~interior
    rgb = np.zeros(occ.shape + (3,), dtype=np.uint8)
    nx, ny, nz = occ.shape
    xs, ys, zs = np.indices(occ.shape)
    rgb[..., 0] = (xs * 4 + 30) % 256
    rgb[..., 1] = (zs * 3 + 60) % 256
    rgb[..., 2] = 180
    rgb[~surf] = 0
    return rgb


def main():
    occ = synth_building()
    n_occ = int(occ.sum())
    print(f"grid {occ.shape}, occupied {n_occ}")
    rgb = synth_rgb(occ)
    print(f"sampled voxels: {int((rgb.sum(axis=3) > 0).sum())}")

    # --- quantize (classic vs full, smooth iters) ---
    for tier, iters in (("classic", 1), ("full", 1), ("full", 2)):
        t0 = time.perf_counter()
        code = C.quantize_voxels(rgb, tier=tier, smooth_iters=iters)
        print(f"quantize tier={tier} iters={iters}: {time.perf_counter() - t0:.2f}s")

    code = C.quantize_voxels(rgb, tier="classic")

    # smooth alone
    t0 = time.perf_counter()
    C._smooth_codes(code, n_classes=48)
    print(f"_smooth_codes alone n_classes=48: {time.perf_counter() - t0:.2f}s")
    t0 = time.perf_counter()
    C._smooth_codes(code, n_classes=len(np.unique(code[code >= 0])))
    print(f"_smooth_codes alone n_classes=present({len(np.unique(code[code>=0]))}): {time.perf_counter() - t0:.2f}s")

    # --- slope pass alone ---
    t0 = time.perf_counter()
    pieces, consumed = S.place_slopes(occ, code)
    t_slopes = time.perf_counter() - t0
    print(f"place_slopes: {t_slopes:.3f}s ({len(pieces)} slopes)")

    # --- packer (includes slope pass) ---
    t0 = time.perf_counter()
    raw = B.split_and_merge(occ, code=code, seed=7)
    t_pack = time.perf_counter() - t0
    print(f"split_and_merge total: {t_pack:.2f}s ({len(raw)} pieces) | slopes share {100*t_slopes/t_pack:.1f}%")

    # --- colour assign + clamp ---
    t0 = time.perf_counter()
    colors = C.assign_colors(raw, occ, None, voxel_rgb=rgb, code=code, tier="classic")
    print(f"assign_colors+clamp: {time.perf_counter() - t0:.2f}s")

    # --- full pipeline incl. repair ---
    occ_u8 = occ.astype(np.uint8)
    t0 = time.perf_counter()
    model = legolize_voxelgrid(occ_u8, voxel_rgb=rgb, options={})
    t_total = time.perf_counter() - t0
    print(f"legolize_voxelgrid total: {t_total:.2f}s, bricks={len(model.bricks)}, "
          f"stability={ {k: v for k, v in model.stability.items() if k in ('pillars_added','components_before','components_after')} }")

    # repair alone on the packed model
    from app.legolizer import Brick
    t0 = time.perf_counter()
    stats = R.repair_connectivity(model, Brick)
    print(f"repair_connectivity (re-run): {time.perf_counter() - t0:.2f}s {stats}")


if __name__ == "__main__":
    main()
