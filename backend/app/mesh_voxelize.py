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


def _solidify(grid: np.ndarray) -> np.ndarray:
    """Fill the interior of a (possibly leaky) shell, z-up grid.

    trimesh's VoxelGrid.fill only fills FULLY enclosed cavities — a mesh with
    an open bottom (common: TRELLIS models sit on a display base) leaks and
    stays hollow. Buildings stand on the ground, so: seal the bottom with a
    virtual ground plane, flood the outside air (6-connected), and everything
    the air can't reach becomes solid.
    """
    from scipy import ndimage

    padded = np.pad(grid, 1, constant_values=False)
    padded[:, :, 0] = True                       # virtual ground seals the underside
    air = ndimage.label(~padded, structure=ndimage.generate_binary_structure(3, 1))[0]
    outside = air[0, 0, -1]                      # padded top corner is always open sky
    interior = (~padded) & (air != outside)
    return grid | interior[1:-1, 1:-1, 1:-1]


def _shell(solid: np.ndarray, t_xy: int = 2, t_z: int = 5) -> np.ndarray:
    """Hollow a solidified grid down to walls/floors of real thickness.

    Erodes the solid with three 1D structuring elements (their composition is
    a box erosion), then keeps `solid & ~core`. Anisotropic on purpose: cells
    are 1 stud wide but 1 plate (0.4 stud) tall, so a wall `t_xy` studs thick
    needs ~2.5x that many cells vertically to give floors/roofs the same
    physical depth. Voids that connect to outside air (windows, courtyards,
    arcades) were never solidified, so the shell wraps THEM in walls too —
    architecture keeps its rooms.
    """
    from scipy import ndimage

    core = solid
    for axis, t in ((0, t_xy), (1, t_xy), (2, t_z)):
        if t <= 0:
            continue
        shape = [1, 1, 1]
        shape[axis] = 2 * t + 1
        core = ndimage.binary_erosion(core, structure=np.ones(shape), border_value=0)
    return solid & ~core


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
    """Match the sampled voxel colours to the generated render the user saw.

    The TRELLIS texture bakes shading (AO, unlit faces) and reads much darker
    AND more bimodal than the FLUX render. A mean-gain under-lifts the shadows
    (everything quantizes to Black), so we do per-channel QUANTILE matching:
    the voxel foreground's colour distribution is mapped onto the render
    foreground's distribution — shadows land on the render's shadows, lights
    on its lights. Verified on the brutalist benchmark model (Black 57% ->
    the render's true dark-grey/light-grey palette); see docs/benchmarks.md.
    """
    try:
        from PIL import Image

        ref = np.asarray(Image.open(io.BytesIO(reference_png)).convert("RGB")).reshape(-1, 3).astype(float)
        ref_fg = ref[~np.all(ref > 238, axis=1)]            # drop near-white background
        flat = voxel_rgb.reshape(-1, 3).astype(float)
        mask = flat.sum(axis=1) > 0                         # only sampled voxels
        if len(ref_fg) == 0 or not mask.any():
            return voxel_rgb
        qs = np.linspace(0.0, 1.0, 65)
        out_flat = flat.copy()
        for c in range(3):
            src_q = np.quantile(flat[mask, c], qs)
            dst_q = np.quantile(ref_fg[:, c], qs)
            out_flat[mask, c] = np.interp(flat[mask, c], src_q, dst_q)
        out = np.clip(out_flat, 0, 255).reshape(voxel_rgb.shape).astype(np.uint8)
        out[voxel_rgb.sum(axis=3) == 0] = 0                 # keep unsampled voxels black
        return out
    except Exception:
        return voxel_rgb


# vertical stretch applied before voxelizing: 8 mm stud pitch / 3.2 mm plate
# height. Uniform-pitch voxels of the stretched mesh = plate-height cells of
# the real mesh, which both fixes the old 1.2x vertical distortion (cubic
# voxels rendered as 9.6 mm bricks) and triples the vertical resolution.
PLATE_RATIO = 2.5


def voxelize_glb(
    data: bytes, target: int = 32, fill: bool = False, up: str = "y",
    fill_mode: str | None = None, shell_thickness: int = 2,
) -> dict:
    """Voxelize GLB bytes into plate-unit cells.

    `target` = voxels (studs) along the longest HORIZONTAL axis; the vertical
    axis comes out in plate layers (~2.5 cells per stud of height).

    `fill_mode`: "surface" (raw voxel skin), "solid" (flood-fill interior —
    the old fill=True), or "shell" (solidify, then hollow back to walls
    `shell_thickness` studs thick; exterior-connected voids stay open).
    The legacy `fill` bool maps to solid/surface when fill_mode is None.
    """
    import trimesh

    mesh = trimesh.load(io.BytesIO(data), file_type="glb", force="mesh")
    if mesh is None or not hasattr(mesh, "vertices") or len(mesh.vertices) == 0:
        raise ValueError("no mesh in GLB")

    mesh.apply_translation(-mesh.bounds.mean(axis=0))  # center on origin
    up_axis = {"x": 0, "y": 1, "z": 2}[up]
    horizontal = [float(e) for i, e in enumerate(mesh.extents) if i != up_axis]
    biggest = max(horizontal) if horizontal else 0.0
    if biggest <= 0:
        raise ValueError("degenerate mesh")

    scale = [1.0, 1.0, 1.0]
    scale[up_axis] = PLATE_RATIO
    mesh.apply_scale(scale)

    pitch = biggest / max(8, int(target))
    vg = mesh.voxelized(pitch)

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
    mode = fill_mode or ("solid" if fill else "surface")
    if mode in ("solid", "shell"):
        grid = _solidify(grid)   # solid core: connected + supported + fewer pieces
    if mode == "shell":
        t = max(1, int(shell_thickness))
        # round-half-UP: int(round()) is banker's rounding, which made t=1
        # floors thinner than walls (2.5 -> 2) while t=3 rounded up
        grid = _shell(grid, t_xy=t, t_z=int(t * 2.5 + 0.5))

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
