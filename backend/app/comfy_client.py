"""Thin client for a running ComfyUI instance.

ComfyUI exposes a REST + websocket API. The usual flow:
  1. POST /prompt  with an API-format workflow graph (parameterized).
  2. Listen on ws /ws?clientId=... for execution progress + the output node.
  3. GET /view to download the resulting image/file.

We keep the API-format workflow JSONs in ../../comfyui/workflows/*.api.json and
substitute the prompt/image/seed before submitting.

TODO (M0/M1): implement run_legoarch() and run_trellis().
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
WORKFLOWS_DIR = Path(__file__).resolve().parents[2] / "comfyui" / "workflows"


def _load_workflow(name: str) -> dict[str, Any]:
    path = WORKFLOWS_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


def submit_prompt(graph: dict[str, Any], client_id: str) -> str:
    """Queue a workflow; return the prompt_id. TODO: implement."""
    raise NotImplementedError


def run_legoarch(prompt: str, image_b64: str | None, lora_scale: float) -> dict[str, Any]:
    """txt2img or img2img with FLUX.2 + legoarch. TODO (M0)."""
    raise NotImplementedError


def run_trellis(image_url: str) -> dict[str, Any]:
    """TRELLIS image->3D; return {stl_url, voxelgrid_npz_url, glb_url}. TODO (M1)."""
    raise NotImplementedError
