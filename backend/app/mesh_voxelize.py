"""Voxelize a TRELLIS GLB into the occupancy grid the frontend legolizer wants.

Returns {nx, ny, nz, occ_b64} where occ is a flat uint8 (0/1) array indexed
x-fastest: idx = x + nx*(y + ny*z), with z = up — matching frontend/src/lib/voxel.js.
glTF is Y-up, so we map mesh axes (X,Y,Z) -> grid (x, y=meshZ, z=meshY).
"""
from __future__ import annotations

import base64
import io

import numpy as np


def _trim(grid: np.ndarray) -> np.ndarray:
    """Crop empty margins so the model sits tight in the grid."""
    if not grid.any():
        return grid
    xs = np.where(np.any(grid, axis=(1, 2)))[0]
    ys = np.where(np.any(grid, axis=(0, 2)))[0]
    zs = np.where(np.any(grid, axis=(0, 1)))[0]
    return grid[xs[0]:xs[-1] + 1, ys[0]:ys[-1] + 1, zs[0]:zs[-1] + 1]


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
    if up == "y":
        grid = np.transpose(matrix, (0, 2, 1))   # grid[x,y,z] = matrix[x, z, y]; z = meshY
    elif up == "x":
        grid = np.transpose(matrix, (1, 2, 0))
    else:  # "z"
        grid = matrix

    grid = _trim(grid)
    nx, ny, nz = (int(s) for s in grid.shape)
    occ = np.ascontiguousarray(grid, dtype=np.uint8).flatten(order="F")  # x fastest
    return {
        "nx": nx, "ny": ny, "nz": nz,
        "occ_b64": base64.b64encode(occ.tobytes()).decode("ascii"),
        "count": int(occ.sum()),
    }
