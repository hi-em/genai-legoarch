"""Voxelization — get a boolean occupancy grid on a real LEGO unit lattice.

Preferred source: the `voxelgrid_npz` that TRELLIS already emits (avoids
re-voxelizing the smooth mesh, which compounds error). Fallback: voxelize an
STL/mesh with trimesh on the LEGO unit pitch.
"""
from __future__ import annotations

import numpy as np


def load_voxelgrid(npz_path_or_url: str) -> np.ndarray:
    """Load a TRELLIS voxelgrid_npz -> bool occupancy (nx,ny,nz).

    TODO (M2): handle remote URLs (download to temp) and the actual npz key
    layout TRELLIS uses. For local files this reads the first array found.
    """
    data = np.load(npz_path_or_url)
    key = data.files[0]
    arr = data[key]
    return arr.astype(bool)


def voxelize_mesh(stl_path: str, unit_mm: float = 8.0) -> np.ndarray:
    """Fallback: voxelize a mesh onto the LEGO grid. TODO (M2).

    Plan: trimesh.load -> mesh.voxelized(pitch=unit_mm) -> .matrix (bool).
    Add silhouette-fitting / deformation for curved forms (Zhou et al. 2019).
    """
    import trimesh

    mesh = trimesh.load(stl_path, force="mesh")
    vox = mesh.voxelized(pitch=unit_mm)
    return np.asarray(vox.matrix, dtype=bool)
