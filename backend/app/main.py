"""BrickForge FastAPI app.

Wraps a running ComfyUI (FLUX.2 + legoarch LoRA + TRELLIS) and the custom
legolizer. Endpoints are defined here as a thin layer; heavy logic lives in
`app.comfy_client` and `app.legolizer`.

Run:  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import base64
import os
from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .legolizer import legolize_voxelgrid, BrickModel

app = FastAPI(title="BrickForge API", version="0.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFYUI_3D_URL = os.environ.get("COMFYUI_3D_URL", "http://127.0.0.1:8189")


def _data_url(data: bytes, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


def _decode_image(value: str) -> bytes:
    """Accept raw base64 or a data: URL and return the bytes."""
    if value.startswith("data:"):
        value = value.split(",", 1)[1]
    return base64.b64decode(value)


# ---------- request models ----------
class GenerateImageReq(BaseModel):
    prompt: str
    image_b64: Optional[str] = None        # for img2img
    seed: Optional[int] = None
    steps: Optional[int] = None            # FLUX sampling steps
    guidance: Optional[float] = None       # CFG (klein *base* is undistilled, CFG works)
    lora_scale: Optional[float] = None     # legoarch LoRA strength_model
    negative: Optional[str] = None         # negative prompt (None -> tuned default)


class Generate3DReq(BaseModel):
    image_b64: Optional[str] = None        # the generated LEGO render (b64 or data URL)
    image_url: Optional[str] = None        # or a URL the backend can fetch
    seed: Optional[int] = None
    ss_steps: Optional[int] = None         # TRELLIS sparse-structure steps
    shape_steps: Optional[int] = None      # TRELLIS shape steps
    shape_guidance: Optional[float] = None  # TRELLIS shape guidance strength
    voxel_target: int = 32                 # studs along the longest horizontal axis
    legolize_options: dict[str, Any] = {}  # seed / randomness / seam_weight / tile_tops


class LegolizeMeshReq(BaseModel):
    """The CPU-only back half of the pipeline: GLB -> voxels -> bricks.

    Powers the staged flow's "mesh stop": the user can re-legolize the SAME
    mesh with different brick settings in seconds, no GPU involved.
    """
    glb_b64: str                           # the TRELLIS mesh (b64 or data URL)
    image_b64: Optional[str] = None        # the render, for colour exposure matching
    seed: Optional[int] = None
    voxel_target: int = 32
    legolize_options: dict[str, Any] = {}  # randomness / seam_weight / tile_tops


class SetCopyReq(BaseModel):
    subject: str
    n_bricks: int = 0
    n_parts: int = 0
    n_colors: int = 0
    grid: list[int] = []
    support_ratio: float = 1.0
    connected: bool = True


class LegolizeReq(BaseModel):
    voxelgrid_npz_url: Optional[str] = None
    stl_url: Optional[str] = None
    image_url: Optional[str] = None        # for color assignment
    unit_mm: float = 8.0                   # one LEGO module (stud pitch)
    options: dict[str, Any] = {}


# ---------- routes ----------
@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "comfyui_url": COMFYUI_URL, "comfyui_3d_url": COMFYUI_3D_URL}


@app.post("/generate-image")
def generate_image(req: GenerateImageReq) -> dict[str, Any]:
    """FLUX.2 + legoarch via ComfyUI (:8188). img2img when image_b64 is given."""
    from . import comfy_client

    kwargs = dict(
        seed=req.seed,
        steps=req.steps,
        cfg_scale=req.guidance,
        lora_strength=req.lora_scale,
        negative=req.negative,
    )
    if req.image_b64:
        result = comfy_client.run_img2img(req.prompt, _decode_image(req.image_b64), **kwargs)
    else:
        result = comfy_client.run_txt2img(req.prompt, **kwargs)
    # `params` echoes the RESOLVED values (incl. the random seed actually used)
    # so the frontend / benchmark harness can record a reproducible run.
    return {"imageUrl": _data_url(result["png"], "image/png"), "params": result["params"]}


def _voxelize_and_legolize(
    glb: bytes,
    render_png: Optional[bytes],
    voxel_target: int,
    seed: Optional[int],
    options: dict[str, Any],
) -> dict[str, Any]:
    """GLB -> plate-unit voxels -> brick model. Pure CPU, a few seconds.

    fill=True (solid core, not a hollow shell) is what guarantees a single
    connected component + ~0.99 support at ANY TRELLIS preset, and packs
    ~70% fewer pieces (big interior bricks instead of 1x1 surface skin).
    Benchmark evidence: docs/benchmarks.md §4.
    """
    import numpy as np

    from .mesh_voxelize import match_exposure, voxelize_glb

    voxel = voxelize_glb(glb, target=voxel_target, fill=True)
    nx, ny, nz = voxel["nx"], voxel["ny"], voxel["nz"]
    occ = (
        np.frombuffer(base64.b64decode(voxel["occ_b64"]), dtype=np.uint8)
        .reshape((nx, ny, nz), order="F")
        .astype(bool)
    )
    # real colour from the generated model, matched to LEGO colours downstream
    voxel_rgb = None
    if voxel.get("rgb_b64"):
        voxel_rgb = (
            np.frombuffer(base64.b64decode(voxel["rgb_b64"]), dtype=np.uint8)
            .reshape((nz, ny, nx, 3))
            .transpose(2, 1, 0, 3)
        )
        if render_png:
            voxel_rgb = match_exposure(voxel_rgb, render_png)  # tie colours to the render
    model = legolize_voxelgrid(
        _occupancy=occ, options={"seed": seed or 1, **options}, voxel_rgb=voxel_rgb
    )
    return {"voxel": voxel, "brickModel": model.to_dict()}


@app.post("/generate-mesh")
def generate_mesh(req: Generate3DReq) -> dict[str, Any]:
    """The GPU half only: render -> TRELLIS-2 mesh. Returns the GLB data URL.

    The staged flow's "mesh stop" pairs this with /legolize-mesh so brick
    settings can be re-tried in seconds without re-running TRELLIS.
    """
    from . import comfy_client

    if req.image_b64:
        img = _decode_image(req.image_b64)
    elif req.image_url:
        import httpx

        img = httpx.get(req.image_url, timeout=30.0).content
    else:
        raise ValueError("generate-mesh needs image_b64 or image_url")

    result = comfy_client.run_trellis(
        img,
        seed=req.seed,
        ss_steps=req.ss_steps,
        shape_steps=req.shape_steps,
        shape_guidance=req.shape_guidance,
    )
    return {
        "glbUrl": _data_url(result["glb"], "model/gltf-binary"),
        "filename": result["filename"],
        "params": result.get("params", {}),
    }


@app.post("/legolize-mesh")
def legolize_mesh(req: LegolizeMeshReq) -> dict[str, Any]:
    """The CPU half only: GLB -> voxels -> bricks. Seconds, no ComfyUI."""
    voxel_target = max(16, min(64, req.voxel_target))
    glb = _decode_image(req.glb_b64)           # same b64/data-URL decoding rules
    # the render is only used for colour exposure matching — never fatal
    try:
        png = _decode_image(req.image_b64) if req.image_b64 else None
    except Exception:
        png = None
    out = _voxelize_and_legolize(glb, png, voxel_target, req.seed, req.legolize_options)
    out["params"] = {"voxel_target": voxel_target, "seed": req.seed, **req.legolize_options}
    return out


@app.post("/generate-3d")
def generate_3d(req: Generate3DReq) -> dict[str, Any]:
    """One-shot: TRELLIS mesh + voxelize + legolize (kept for the benchmark
    harness and any caller that doesn't need the staged stops)."""
    from . import comfy_client

    if req.image_b64:
        img = _decode_image(req.image_b64)
    elif req.image_url:
        import httpx

        img = httpx.get(req.image_url, timeout=30.0).content
    else:
        raise ValueError("generate-3d needs image_b64 or image_url")

    result = comfy_client.run_trellis(
        img,
        seed=req.seed,
        ss_steps=req.ss_steps,
        shape_steps=req.shape_steps,
        shape_guidance=req.shape_guidance,
    )
    voxel_target = max(16, min(64, req.voxel_target))
    resp: dict[str, Any] = {
        "glbUrl": _data_url(result["glb"], "model/gltf-binary"),
        "filename": result["filename"],
        "params": {**result.get("params", {}), "voxel_target": voxel_target},
    }
    try:
        out = _voxelize_and_legolize(result["glb"], img, voxel_target, req.seed, req.legolize_options)
        resp.update(out)
    except Exception as e:  # keep the GLB usable even if voxelization fails
        resp["voxelError"] = str(e)
    return resp


@app.post("/set-copy")
def set_copy(req: SetCopyReq) -> dict[str, Any]:
    """Name the set + write the box/share copy (Claude if keyed, else template)."""
    from .set_designer import generate_set_copy

    return generate_set_copy(req.model_dump())


@app.post("/legolize")
def legolize(req: LegolizeReq) -> dict[str, Any]:
    """Custom legolizer (M2): voxel grid -> legal bricks -> color -> checks."""
    model: BrickModel = legolize_voxelgrid(
        voxelgrid_npz_url=req.voxelgrid_npz_url,
        image_url=req.image_url,
        unit_mm=req.unit_mm,
        options=req.options,
    )
    return model.to_dict()
