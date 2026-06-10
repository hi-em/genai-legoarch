"""Voxelize a TRELLIS GLB into the occupancy grid the legolizer wants, AND
sample the mesh's real colour at each voxel so the bricks match the generated
model (mapped to the nearest real LEGO colour downstream).

Returns {nx, ny, nz, occ_b64, count, rgb_b64?} where occ is a flat uint8 (0/1)
array indexed x-fastest: idx = x + nx*(y + ny*z), with z = up. `rgb_b64` (when
the mesh carries colour) is a parallel nx*ny*nz*3 uint8 array in the same order.
glTF is Y-up, so we map mesh axes (X,Y,Z) -> grid (x, y=meshZ, z=meshY).
"""
from __future__ import annotations

import base64
import io

import numpy as np


def _trim_slices(grid: np.ndarray):
    """Slices that crop empty margins so the model sits tight in the grid."""
    if not grid.any():
        return (slice(None), slice(None), slice(None))
    xs = np.where(np.any(grid, axis=(1, 2)))[0]
    ys = np.where(np.any(grid, axis=(0, 2)))[0]
    zs = np.where(np.any(grid, axis=(0, 1)))[0]
    return (slice(xs[0], xs[-1] + 1), slice(ys[0], ys[-1] + 1), slice(zs[0], zs[-1] + 1))


def _vertex_colors(mesh) -> np.ndarray | None:
    """Best-effort (V,3) uint8 vertex colours; None if the mesh is untextured."""
    v = getattr(mesh, "visual", None)
    if v is None:
        return None
    # textured mesh -> bake texture to per-vertex colour
    try:
        if hasattr(v, "to_color"):
            cv = v.to_color()
            vc = getattr(cv, "vertex_colors", None)
            if vc is not None and len(vc) == len(mesh.vertices):
                arr = np.asarray(vc)[:, :3].astype(np.uint8)
                if arr.std() > 2:  # reject a flat fallback colour
                    return arr
    except Exception:
        pass
    # already has vertex colours
    vc = getattr(v, "vertex_colors", None)
    if vc is not None and len(vc) == len(mesh.vertices):
        arr = np.asarray(vc)[:, :3].astype(np.uint8)
        if arr.std() > 2:
            return arr
    return None


def _remap(a: np.ndarray, up: str) -> np.ndarray:
    """Map mesh axes to grid axes (z up). Works for 3D occ and 4D colour grids."""
    if up == "y":
        return np.transpose(a, (0, 2, 1) if a.ndim == 3 else (0, 2, 1, 3))
    if up == "x":
        return np.transpose(a, (1, 2, 0) if a.ndim == 3 else (1, 2, 0, 3))
    return a


def match_exposure(voxel_rgb: np.ndarray, reference_png: bytes) -> np.ndarray:
    """White-balance/expose the sampled voxel colours to the generated render.

    The TRELLIS texture bakes shading and reads darker than the FLUX render the
    user actually saw. We rescale each channel so the model's foreground mean
    matches the render's foreground mean — tying brick colours to the image.
    """
    try:
        from PIL import Image

        ref = np.asarray(Image.open(io.BytesIO(reference_png)).convert("RGB")).reshape(-1, 3).astype(float)
        ref_fg = ref[~np.all(ref > 238, axis=1)]            # drop near-white background
        occ = voxel_rgb.reshape(-1, 3).astype(float)
        occ_fg = occ[occ.sum(axis=1) > 0]                   # only sampled voxels
        if len(ref_fg) == 0 or len(occ_fg) == 0:
            return voxel_rgb
        gain = np.clip(ref_fg.mean(axis=0) / np.maximum(occ_fg.mean(axis=0), 1.0), 0.5, 3.0)
        out = np.clip(voxel_rgb.astype(float) * gain, 0, 255).astype(np.uint8)
        out[voxel_rgb.sum(axis=3) == 0] = 0                 # keep unsampled voxels black
        return out
    except Exception:
        return voxel_rgb


def voxelize_glb(data: bytes, target: int = 26, fill: bool = False, up: str = "y") -> dict:
    """Voxelize GLB bytes. `target` = voxels along the longest axis."""
    import trimesh

    mesh = trimesh.load(io.BytesIO(data), file_type="glb", force="mesh")
    if mesh is None or not hasattr(mesh, "vertices") or len(mesh.vertices) == 0:
        raise ValueError("no mesh in GLB")

    mesh.apply_translation(-mesh.bounds.mean(axis=0))  # center on origin
    biggest = float(max(mesh.extents))
    if biggest <= 0:
        raise ValueError("degenerate mesh")

    pitch = biggest / max(8, int(target))
    vg = mesh.voxelized(pitch)
    if fill:
        try:
            vg = vg.fill()
        except Exception:
            pass

    matrix = np.asarray(vg.matrix, dtype=bool)  # [meshX, meshY, meshZ]

    # per-voxel colour sampled from the nearest mesh vertex
    color_dense = None
    try:
        vcol = _vertex_colors(mesh)
        if vcol is not None:
            from scipy.spatial import cKDTree

            pts = np.asarray(vg.points)           # world centres of filled cells
            idx = np.asarray(vg.sparse_indices)   # matching indices into `matrix`
            if len(pts) == len(idx) and len(pts) > 0:
                _, nn = cKDTree(mesh.vertices).query(pts, k=1)
                color_dense = np.zeros(matrix.shape + (3,), dtype=np.uint8)
                color_dense[idx[:, 0], idx[:, 1], idx[:, 2]] = vcol[nn]
    except Exception:
        color_dense = None

    grid = _remap(matrix, up)
    cgrid = _remap(color_dense, up) if color_dense is not None else None

    sl = _trim_slices(grid)
    grid = grid[sl]
    if cgrid is not None:
        cgrid = cgrid[sl]

    nx, ny, nz = (int(s) for s in grid.shape)
    occ = np.ascontiguousarray(grid, dtype=np.uint8).flatten(order="F")  # x fastest
    out = {
        "nx": nx, "ny": ny, "nz": nz,
        "occ_b64": base64.b64encode(occ.tobytes()).decode("ascii"),
        "count": int(occ.sum()),
    }
    if cgrid is not None:
        # same x-fastest voxel order as occ, each voxel followed by its R,G,B
        rgb = np.ascontiguousarray(np.transpose(cgrid, (2, 1, 0, 3))).reshape(-1, 3)
        out["rgb_b64"] = base64.b64encode(rgb.astype(np.uint8).tobytes()).decode("ascii")
    return out
