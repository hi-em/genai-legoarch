"""BrickForge FastAPI app.

Wraps a running ComfyUI (FLUX.2 + legoarch LoRA + TRELLIS) and the custom
legolizer. Endpoints are defined here as a thin layer; heavy logic lives in
`app.comfy_client` and `app.legolizer`.

Run:  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

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


# ---------- request models ----------
class GenerateImageReq(BaseModel):
    prompt: str
    image_b64: Optional[str] = None        # for img2img
    lora_scale: float = 1.0


class Generate3DReq(BaseModel):
    image_url: str


class LegolizeReq(BaseModel):
    voxelgrid_npz_url: Optional[str] = None
    stl_url: Optional[str] = None
    image_url: Optional[str] = None        # for color assignment
    unit_mm: float = 8.0                   # one LEGO module (stud pitch)
    options: dict[str, Any] = {}


# ---------- routes ----------
@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "comfyui_url": COMFYUI_URL}


@app.post("/generate-image")
def generate_image(req: GenerateImageReq) -> dict[str, Any]:
    """FLUX.2 + legoarch (txt2img / img2img) via ComfyUI. TODO: wire comfy_client."""
    # from .comfy_client import run_legoarch
    # return run_legoarch(req.prompt, req.image_b64, req.lora_scale)
    raise NotImplementedError("M0: wire ComfyUI client")


@app.post("/generate-3d")
def generate_3d(req: Generate3DReq) -> dict[str, Any]:
    """TRELLIS image->3D via ComfyUI; returns STL + voxelgrid_npz. TODO (M1)."""
    raise NotImplementedError("M1: wire TRELLIS workflow")


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
