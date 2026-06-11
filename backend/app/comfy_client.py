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
# Trellis2ExportGLB writes the .glb here but doesn't report it in /history,
# so we read it off disk. Override with COMFYUI_3D_OUTPUT if your output dir differs.
OUTPUT_3D_DIR = Path(os.environ.get("COMFYUI_3D_OUTPUT", r"C:\ComfyUI_3D\output"))

_TIMEOUT = httpx.Timeout(900.0, connect=10.0)
_POLL_SECONDS = 1.0
_MAX_WAIT = 900.0  # 15 min ceiling per job

# ---- tuned defaults (env-overridable) -----------------------------------------
# These (not the workflow JSONs) are the single source of truth for generation
# defaults: the JSONs are raw ComfyUI exports and every tunable value below is
# injected by node id at submit time. Benchmark evidence: docs/benchmarks.md.
#
# FLUX.2 Klein *base* (the checkpoint we load) is NOT guidance/step-distilled —
# real CFG applies and the negative prompt works. Benchmark winners (2026-06,
# stages A-E in docs/benchmarks.md): 28 steps ≈ 40 at 70% of the time; CFG 5.0
# beats 3.0/4.0 on geometric definition + palette separation; LoRA 1.0 keeps
# the stud/seam texture 0.75 loses; the negative prompt yields chunkier,
# cleaner massing that survives voxelization best.
FLUX_STEPS = int(os.environ.get("FLUX_STEPS", "28"))
FLUX_CFG = float(os.environ.get("FLUX_CFG", "5.0"))
FLUX_LORA_STRENGTH = float(os.environ.get("FLUX_LORA_STRENGTH", "1.0"))
FLUX_NEGATIVE = os.environ.get(
    "FLUX_NEGATIVE",
    "people, trees, cars, vehicles, text, watermark, photograph of real building, "
    "landscape, cluttered background, thin spires, antennas",
)
# TRELLIS: we voxelize at ~26^3 and SAMPLE the texture for LEGO colour matching,
# so a 200k-face / 1024px texture mesh is wasted detail. We cut steps + face
# budget hard but KEEP the texture (it's what the colour match reads from).
# TRELLIS defaults follow the owner-optimized 2026-06-11 workflow export
# (quality-leaning: more steps + full mesh/texture budget). Buildability no
# longer depends on these — the solid voxel fill guarantees connectivity at
# any preset (docs/benchmarks.md §4) — so they purely trade time for fidelity.
TRELLIS_SS_STEPS = int(os.environ.get("TRELLIS_SS_STEPS", "25"))      # node 94
TRELLIS_SHAPE_STEPS = int(os.environ.get("TRELLIS_SHAPE_STEPS", "35"))  # node 94
TRELLIS_SHAPE_GUIDANCE = float(os.environ.get("TRELLIS_SHAPE_GUIDANCE", "7.5"))  # node 94
TRELLIS_MAX_TOKENS = int(os.environ.get("TRELLIS_MAX_TOKENS", "49152"))  # node 94
TRELLIS_TEX_STEPS = int(os.environ.get("TRELLIS_TEX_STEPS", "25"))     # node 95
TRELLIS_DECIMATION = int(os.environ.get("TRELLIS_DECIMATION", "200000"))  # node 96
TRELLIS_TEXTURE_SIZE = int(os.environ.get("TRELLIS_TEXTURE_SIZE", "1024"))  # node 96

# ---- which node in each template carries which parameter ----------------------
# (derived from the exported *.api.json graphs)
TXT2IMG = {
    "file": "flux_txt2img.api.json",
    "output": "676",        # SaveImage on the legoarch-LoRA branch (678:*)
    "extra_outputs": ["678:675"],  # SaveParamsSVG — per-run params sidecar (faculty docs)
    "prompt": "734",        # PrimitiveStringMultiline -> concat "legoarch " + this
    "negative": "678:661",  # CLIPTextEncode .text (empty in the export; CFG>1 so it works)
    "seed": "685",          # PrimitiveInt seed
    "steps": "678:668",     # PrimitiveInt -> Flux2Scheduler.steps
    "cfg": "678:674",       # PrimitiveFloat -> CFGGuider.cfg
    "lora": "678:682",      # LoraLoader .strength_model / .strength_clip
}
IMG2IMG = {
    "file": "flux_img2img.api.json",
    "output": "663",        # SaveImage
    "extra_outputs": ["662:357"],  # SaveParamsSVG — per-run params sidecar
    "prompt": "728",        # PrimitiveStringMultiline (we prepend "legoarch ")
    "negative": "662:410",  # CLIPTextEncode .text feeding the negative ReferenceLatent
    "seed": "662:353",      # PrimitiveInt seed
    "steps": "662:354",     # PrimitiveInt -> Flux2Scheduler.steps
    "cfg": "662:553",       # PrimitiveFloat -> CFGGuider.cfg
    "lora": "662:689",      # LoraLoader .strength_model / .strength_clip
    "image": "660",         # LoadImage
}
TRELLIS = {
    "file": "trellis_3d.api.json",
    "output": "96",         # Trellis2ExportGLB
    "image": "85",          # LoadImage
    "seeds": ["94", "95"],  # ImageToShape / ShapeToTexturedMesh seeds
    "shape_node": "94",     # Trellis2ImageToShape: ss/shape steps + guidance + max_tokens
    "tex_node": "95",       # Trellis2ShapeToTexturedMesh: tex_sampling_steps
    "export_node": "96",    # Trellis2ExportGLB: decimation_target, texture_size
}


# ---- graph helpers ------------------------------------------------------------
def _load_workflow(name: str) -> dict[str, Any]:
    return json.loads((WORKFLOWS_DIR / name).read_text(encoding="utf-8"))


def _prune_to(graph: dict[str, Any], output_id: str, extra: list[str] | None = None) -> dict[str, Any]:
    """Keep only nodes reachable (via input links) from the output node(s)."""
    keep: set[str] = set()
    stack = [output_id, *(extra or [])]
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
    # int32 range: the TRELLIS nodes cap seed at 2**31-1, and it keeps seeds
    # safely representable everywhere (JS Number, JSON, UI display).
    return random.randint(1, 2**31 - 1)


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


def _newest_glb(after: float = 0.0) -> Optional[Path]:
    """Newest .glb in the 3D output dir whose mtime is >= `after` (epoch secs)."""
    if not OUTPUT_3D_DIR.exists():
        return None
    cands = [p for p in OUTPUT_3D_DIR.rglob("*.glb") if p.stat().st_mtime >= after - 2.0]
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


# ---- high-level operations ----------------------------------------------------
def run_txt2img(
    prompt: str,
    seed: Optional[int] = None,
    steps: Optional[int] = None,
    cfg_scale: Optional[float] = None,
    lora_strength: Optional[float] = None,
    negative: Optional[str] = None,
) -> dict[str, Any]:
    """FLUX.2 + legoarch text-to-image.

    Returns {'png': bytes, 'params': {...resolved values for reproducibility}}.
    """
    from .prompt_enhance import enhance_prompt

    cfg = TXT2IMG
    graph = _prune_to(_load_workflow(cfg["file"]), cfg["output"], cfg.get("extra_outputs"))
    resolved = {
        "seed": seed if seed is not None else _rand_seed(),
        "steps": steps if steps is not None else FLUX_STEPS,
        "guidance": cfg_scale if cfg_scale is not None else FLUX_CFG,
        "lora_strength": lora_strength if lora_strength is not None else FLUX_LORA_STRENGTH,
        "negative": negative if negative is not None else FLUX_NEGATIVE,
    }
    # enhance_prompt returns the rich body WITHOUT the trigger; the graph's
    # StringConcatenate node prepends "legoarch " for us.
    enhanced = enhance_prompt(prompt)
    resolved["prompt"] = enhanced
    _set_value(graph, cfg["prompt"], enhanced)
    _set_value(graph, cfg["seed"], resolved["seed"])
    _set_value(graph, cfg["steps"], resolved["steps"])
    _set_value(graph, cfg["cfg"], resolved["guidance"])
    _set_value(graph, cfg["lora"], resolved["lora_strength"], key="strength_model")
    _set_value(graph, cfg["negative"], resolved["negative"], key="text")

    entry = _submit_and_wait(COMFYUI_URL, graph)
    out = entry["outputs"].get(cfg["output"], {})
    imgs = out.get("images") or []
    if not imgs:
        raise RuntimeError("txt2img produced no image")
    return {"png": _fetch(_view_url(COMFYUI_URL, imgs[0])), "params": resolved}


def run_img2img(
    prompt: str,
    image: bytes,
    seed: Optional[int] = None,
    steps: Optional[int] = None,
    cfg_scale: Optional[float] = None,
    lora_strength: Optional[float] = None,
    negative: Optional[str] = None,
) -> dict[str, Any]:
    """FLUX.2 + legoarch image-to-image.

    The exported img2img graph is tuned differently from txt2img (cfg 2.5,
    LoRA 0.75) so we only override what the caller explicitly passes.
    Returns {'png': bytes, 'params': {...resolved values}}.
    """
    from .prompt_enhance import enhance_prompt

    cfg = IMG2IMG
    name = _upload_image(COMFYUI_URL, image, "legoarch_input.png")
    graph = _prune_to(_load_workflow(cfg["file"]), cfg["output"], cfg.get("extra_outputs"))
    _set_value(graph, cfg["image"], name, key="image")
    # this template has no concat node; prepend the trigger word ourselves.
    enhanced = enhance_prompt(prompt)
    _set_value(graph, cfg["prompt"], f"legoarch {enhanced}")
    resolved = {
        "prompt": enhanced,
        "seed": seed if seed is not None else _rand_seed(),
        "steps": steps if steps is not None else graph[cfg["steps"]]["inputs"]["value"],
        "guidance": cfg_scale if cfg_scale is not None else graph[cfg["cfg"]]["inputs"]["value"],
        "lora_strength": (
            lora_strength
            if lora_strength is not None
            else graph[cfg["lora"]]["inputs"]["strength_model"]
        ),
    }
    _set_value(graph, cfg["seed"], resolved["seed"])
    if steps is not None:
        _set_value(graph, cfg["steps"], steps)
    if cfg_scale is not None:
        _set_value(graph, cfg["cfg"], cfg_scale)
    if lora_strength is not None:
        _set_value(graph, cfg["lora"], lora_strength, key="strength_model")
    if negative is not None:
        _set_value(graph, cfg["negative"], negative, key="text")

    entry = _submit_and_wait(COMFYUI_URL, graph)
    out = entry["outputs"].get(cfg["output"], {})
    imgs = out.get("images") or []
    if not imgs:
        raise RuntimeError("img2img produced no image")
    return {"png": _fetch(_view_url(COMFYUI_URL, imgs[0])), "params": resolved}


def run_trellis(
    image: bytes,
    seed: Optional[int] = None,
    ss_steps: Optional[int] = None,
    shape_steps: Optional[int] = None,
    shape_guidance: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> dict[str, Any]:
    """TRELLIS-2 image->3D. Returns {'glb': bytes, 'filename': str, 'params': {...}}."""
    cfg = TRELLIS
    name = _upload_image(COMFYUI_3D_URL, image, "legoarch_render.png")
    graph = _prune_to(_load_workflow(cfg["file"]), cfg["output"])
    _set_value(graph, cfg["image"], name, key="image")
    if seed is not None:
        seed = int(seed) & 0x7FFFFFFF   # Trellis2 nodes reject seeds > int32 max
        for nid in cfg["seeds"]:
            _set_value(graph, nid, seed, key="seed")
    resolved = {
        "seed": seed,
        "ss_steps": ss_steps if ss_steps is not None else TRELLIS_SS_STEPS,
        "shape_steps": shape_steps if shape_steps is not None else TRELLIS_SHAPE_STEPS,
        "shape_guidance": shape_guidance if shape_guidance is not None else TRELLIS_SHAPE_GUIDANCE,
        "max_tokens": max_tokens if max_tokens is not None else TRELLIS_MAX_TOKENS,
        "tex_steps": TRELLIS_TEX_STEPS,
        "decimation": TRELLIS_DECIMATION,
        "texture_size": TRELLIS_TEXTURE_SIZE,
    }
    # faster preset — fewer diffusion steps + a far smaller face/texture budget
    # (we only need a clean shell + sampleable colour, not a 200k-face render)
    shape_node, tex_node, export_node = cfg["shape_node"], cfg["tex_node"], cfg["export_node"]
    _set_value(graph, shape_node, resolved["ss_steps"], key="ss_sampling_steps")
    _set_value(graph, shape_node, resolved["shape_steps"], key="shape_sampling_steps")
    _set_value(graph, shape_node, resolved["shape_guidance"], key="shape_guidance_strength")
    _set_value(graph, shape_node, resolved["max_tokens"], key="max_tokens")
    _set_value(graph, tex_node, resolved["tex_steps"], key="tex_sampling_steps")
    _set_value(graph, export_node, resolved["decimation"], key="decimation_target")
    _set_value(graph, export_node, resolved["texture_size"], key="texture_size")

    started = time.time()
    entry = _submit_and_wait(COMFYUI_3D_URL, graph)

    # Trellis2ExportGLB writes the .glb to disk but doesn't register it in
    # /history, and the file can land a beat AFTER the job reports complete, so
    # poll briefly for the newest .glb that appeared since we submitted.
    glb = _newest_glb(after=started)
    for _ in range(30):
        if glb is not None:
            break
        time.sleep(1.0)
        glb = _newest_glb(after=started)
    if glb is not None:
        return {"glb": glb.read_bytes(), "filename": glb.name, "params": resolved}

    # Fallback: in case a future node version DOES report it in /history.
    out = entry.get("outputs", {}).get(cfg["output"], {})
    ref = _first_file_ref(out, ext=".glb")
    if ref:
        return {
            "glb": _fetch(_view_url(COMFYUI_3D_URL, ref)),
            "filename": ref["filename"],
            "params": resolved,
        }
    raise RuntimeError(
        f"TRELLIS finished but no .glb appeared in {OUTPUT_3D_DIR}. "
        "Set COMFYUI_3D_OUTPUT to your ComfyUI-3D output directory."
    )
