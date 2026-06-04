"""Client for the two running ComfyUI instances.

- FLUX image-gen  -> COMFYUI_URL     (default http://127.0.0.1:8188, env `genai`)
- TRELLIS-2 3D    -> COMFYUI_3D_URL  (default http://127.0.0.1:8189, env `genai_3D`)

Flow per call:
  1. load the API-format workflow template from ../../comfyui/workflows/*.api.json
  2. prune it to only the nodes feeding the chosen output node
  3. override the prompt / seed / input-image nodes
  4. POST /prompt, poll /history/{id} until done, fetch the result via /view

The exported workflows are demo graphs with several variants + hardcoded prompts;
we keep only the LoRA branch we care about and parameterize it by node id.
"""
from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path
from typing import Any, Optional

import httpx

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
COMFYUI_3D_URL = os.environ.get("COMFYUI_3D_URL", "http://127.0.0.1:8189").rstrip("/")
WORKFLOWS_DIR = Path(__file__).resolve().parents[2] / "comfyui" / "workflows"

_TIMEOUT = httpx.Timeout(900.0, connect=10.0)
_POLL_SECONDS = 1.0
_MAX_WAIT = 900.0  # 15 min ceiling per job

# ---- which node in each template carries which parameter ----------------------
# (derived from the exported *.api.json graphs)
TXT2IMG = {
    "file": "flux_txt2img.api.json",
    "output": "676",        # SaveImage on the legoarch-LoRA branch (678:*)
    "prompt": "734",        # PrimitiveStringMultiline -> concat "legoarch " + this
    "seed": "685",          # PrimitiveInt seed
}
IMG2IMG = {
    "file": "flux_img2img.api.json",
    "output": "663",        # SaveImage
    "prompt": "728",        # PrimitiveStringMultiline (we prepend "legoarch ")
    "seed": "662:353",      # PrimitiveInt seed
    "image": "660",         # LoadImage
}
TRELLIS = {
    "file": "trellis_3d.api.json",
    "output": "96",         # Trellis2ExportGLB
    "image": "85",          # LoadImage
    "seeds": ["94", "95"],  # ImageToShape / ShapeToTexturedMesh seeds
}


# ---- graph helpers ------------------------------------------------------------
def _load_workflow(name: str) -> dict[str, Any]:
    return json.loads((WORKFLOWS_DIR / name).read_text(encoding="utf-8"))


def _prune_to(graph: dict[str, Any], output_id: str) -> dict[str, Any]:
    """Keep only nodes reachable (via input links) from `output_id`."""
    keep: set[str] = set()
    stack = [output_id]
    while stack:
        nid = stack.pop()
        if nid in keep or nid not in graph:
            continue
        keep.add(nid)
        for v in graph[nid].get("inputs", {}).values():
            if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str):
                stack.append(v[0])
    return {k: graph[k] for k in keep}


def _set_value(graph: dict[str, Any], node_id: str, value: Any, key: str = "value") -> None:
    if node_id in graph:
        graph[node_id]["inputs"][key] = value


def _rand_seed() -> int:
    return random.randint(1, 2**53 - 1)


# ---- ComfyUI REST -------------------------------------------------------------
def _upload_image(base: str, data: bytes, filename: str) -> str:
    """Upload bytes to ComfyUI's input dir; return the name to use in LoadImage."""
    r = httpx.post(
        f"{base}/upload/image",
        files={"image": (filename, data, "application/octet-stream")},
        data={"overwrite": "true"},
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    j = r.json()
    name = j["name"]
    if j.get("subfolder"):
        name = f"{j['subfolder']}/{name}"
    return name


def _submit_and_wait(base: str, graph: dict[str, Any]) -> dict[str, Any]:
    """Queue a graph and block until it finishes; return the history entry."""
    r = httpx.post(f"{base}/prompt", json={"prompt": graph}, timeout=_TIMEOUT)
    if r.status_code >= 400:
        raise RuntimeError(f"ComfyUI rejected the prompt ({r.status_code}): {r.text[:1000]}")
    pid = r.json()["prompt_id"]

    started = time.monotonic()
    while True:
        h = httpx.get(f"{base}/history/{pid}", timeout=_TIMEOUT).json()
        entry = h.get(pid)
        if entry:
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                msgs = status.get("messages", [])
                raise RuntimeError(f"ComfyUI run failed: {json.dumps(msgs)[:1500]}")
            if status.get("completed") or entry.get("outputs"):
                return entry
        if time.monotonic() - started > _MAX_WAIT:
            raise TimeoutError(f"ComfyUI job {pid} did not finish within {_MAX_WAIT:.0f}s")
        time.sleep(_POLL_SECONDS)


def _view_url(base: str, ref: dict[str, Any]) -> str:
    sub = ref.get("subfolder", "")
    typ = ref.get("type", "output")
    return f"{base}/view?filename={ref['filename']}&subfolder={sub}&type={typ}"


def _fetch(url: str) -> bytes:
    r = httpx.get(url, timeout=_TIMEOUT)
    r.raise_for_status()
    return r.content


def _first_file_ref(node_output: dict[str, Any], ext: Optional[str] = None) -> Optional[dict[str, Any]]:
    """Find the first {filename,...} ref inside a node's history output."""
    for value in node_output.values():
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict) and "filename" in item:
                    if ext is None or str(item["filename"]).lower().endswith(ext):
                        return item
    return None


# ---- high-level operations ----------------------------------------------------
def run_txt2img(prompt: str, seed: Optional[int] = None) -> bytes:
    """FLUX.2 + legoarch text-to-image. Returns PNG bytes."""
    cfg = TXT2IMG
    graph = _prune_to(_load_workflow(cfg["file"]), cfg["output"])
    # the graph prepends "legoarch " via a StringConcatenate node, so strip a
    # leading trigger word from the user's prompt to avoid doubling it.
    clean = prompt.strip()
    if clean.lower().startswith("legoarch "):
        clean = clean[len("legoarch "):]
    _set_value(graph, cfg["prompt"], clean)
    _set_value(graph, cfg["seed"], seed if seed is not None else _rand_seed())

    entry = _submit_and_wait(COMFYUI_URL, graph)
    out = entry["outputs"].get(cfg["output"], {})
    imgs = out.get("images") or []
    if not imgs:
        raise RuntimeError("txt2img produced no image")
    return _fetch(_view_url(COMFYUI_URL, imgs[0]))


def run_img2img(prompt: str, image: bytes, seed: Optional[int] = None) -> bytes:
    """FLUX.2 + legoarch image-to-image. Returns PNG bytes."""
    cfg = IMG2IMG
    name = _upload_image(COMFYUI_URL, image, "legoarch_input.png")
    graph = _prune_to(_load_workflow(cfg["file"]), cfg["output"])
    _set_value(graph, cfg["image"], name, key="image")
    # this template has no concat node; include the trigger word ourselves.
    clean = prompt.strip()
    if not clean.lower().startswith("legoarch"):
        clean = f"legoarch {clean}"
    _set_value(graph, cfg["prompt"], clean)
    _set_value(graph, cfg["seed"], seed if seed is not None else _rand_seed())

    entry = _submit_and_wait(COMFYUI_URL, graph)
    out = entry["outputs"].get(cfg["output"], {})
    imgs = out.get("images") or []
    if not imgs:
        raise RuntimeError("img2img produced no image")
    return _fetch(_view_url(COMFYUI_URL, imgs[0]))


def run_trellis(image: bytes, seed: Optional[int] = None) -> dict[str, Any]:
    """TRELLIS-2 image->3D. Returns {'glb': bytes, 'filename': str}."""
    cfg = TRELLIS
    name = _upload_image(COMFYUI_3D_URL, image, "legoarch_render.png")
    graph = _prune_to(_load_workflow(cfg["file"]), cfg["output"])
    _set_value(graph, cfg["image"], name, key="image")
    if seed is not None:
        for nid in cfg["seeds"]:
            _set_value(graph, nid, seed, key="seed")

    entry = _submit_and_wait(COMFYUI_3D_URL, graph)
    out = entry["outputs"].get(cfg["output"], {})
    ref = _first_file_ref(out, ext=".glb") or _first_file_ref(out)
    if not ref:
        raise RuntimeError(f"TRELLIS produced no file (node {cfg['output']} output: {json.dumps(out)[:500]})")
    return {"glb": _fetch(_view_url(COMFYUI_3D_URL, ref)), "filename": ref["filename"]}
