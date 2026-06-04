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
    lora_scale: float = 1.0


class Generate3DReq(BaseModel):
    image_b64: Optional[str] = None        # the generated LEGO render (b64 or data URL)
    image_url: Optional[str] = None        # or a URL the backend can fetch
    seed: Optional[int] = None


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

    if req.image_b64:
        png = comfy_client.run_img2img(req.prompt, _decode_image(req.image_b64), seed=req.seed)
    else:
        png = comfy_client.run_txt2img(req.prompt, seed=req.seed)
    return {"imageUrl": _data_url(png, "image/png")}


@app.post("/generate-3d")
def generate_3d(req: Generate3DReq) -> dict[str, Any]:
    """TRELLIS-2 image->3D via ComfyUI (:8189). Returns a GLB as a data URL."""
    from . import comfy_client

    if req.image_b64:
        img = _decode_image(req.image_b64)
    elif req.image_url:
        import httpx

        img = httpx.get(req.image_url, timeout=30.0).content
    else:
        raise ValueError("generate-3d needs image_b64 or image_url")

    result = comfy_client.run_trellis(img, seed=req.seed)
    resp: dict[str, Any] = {
        "glbUrl": _data_url(result["glb"], "model/gltf-binary"),
        "filename": result["filename"],
    }
    # Voxelize the mesh so the frontend can legolize the REAL geometry.
    try:
        from .mesh_voxelize import voxelize_glb

        resp["voxel"] = voxelize_glb(result["glb"], target=26)
    except Exception as e:  # keep the GLB usable even if voxelization fails
        resp["voxelError"] = str(e)
    return resp


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
