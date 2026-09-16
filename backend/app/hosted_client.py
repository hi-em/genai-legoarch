"""Hosted generation: Gemini (image) + fal.ai (image -> 3D) instead of local ComfyUI.

Same three entry points and the same return shapes as `comfy_client`, so
`main.py` can pick either module with GENERATION_BACKEND and nothing downstream
notices (the legolizer, brick model, assembly, shelf and auth are untouched):

    run_txt2img(prompt, seed, steps, cfg_scale, lora_strength, negative)
        -> {"png": bytes, "params": {...}}
    run_img2img(prompt, image, ...)              -> {"png": bytes, "params": {...}}
    run_trellis(image, seed, ss_steps, shape_steps, shape_guidance, max_tokens)
        -> {"glb": bytes, "filename": str, "params": {...}}

The FLUX-only knobs (steps / cfg / LoRA strength / negative) are accepted and
echoed back as `params` so the run record stays honest, but Gemini has no
equivalent: the negative list becomes prose, and the LoRA is replaced by three
of our OWN box-art renders passed as style references (see docs/hosted-
generation.md §1.2 — never the LEGO product photographs in the training set).

Why these providers, with numbers: docs/hosted-generation.md. Short version:
Gemini 3.1 Flash Image on Vertex `eu` authenticates with the Cloud Run service
account (no key, EU processing, ~$0.074/image, 11-16 s); Hunyuan3D 3.1 Rapid
on fal was the fastest and steadiest image-to-3D in the study (77-122 s,
$0.225, support 0.96-0.99), with TRELLIS-2 on fal selectable when colour
fidelity matters more than latency.

Env:
  GENERATION_BACKEND        comfyui | hosted        (read in main.py; default comfyui)
  GOOGLE_CLOUD_PROJECT      set by Cloud Run -> Gemini via Vertex + ADC (preferred)
  HOSTED_GCP_PROJECT        same, but only for Vertex (local runs: keeps the shelf on disk)
  HOSTED_GEMINI_LOCATION    Vertex location, default "eu" (EU multi-region)
  GEMINI_API_KEY            alternative: the Gemini Developer API (no residency guarantee)
  HOSTED_IMAGE_MODEL        default gemini-3.1-flash-image
  HOSTED_STYLE_REFS         "1" (default) sends the three bundled renders as style refs
  FAL_KEY                   fal.ai key (Secret Manager on Cloud Run)
  HOSTED_3D_MODEL           hunyuan (default) | trellis2
  HOSTED_MESH_DIR           where finished GLBs are cached for /api/mesh/{name}
                            (default: <tmp>/legoarch-meshes — Cloud Run's /tmp is
                            in-memory, so a mesh outlives the request but not the instance)
"""
from __future__ import annotations

import io
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Optional

# HOSTED_GCP_PROJECT lets a laptop call Vertex with its own ADC while keeping the
# shelf and quota local (GOOGLE_CLOUD_PROJECT would switch those to Firestore).
GOOGLE_CLOUD_PROJECT = os.environ.get("HOSTED_GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
GEMINI_LOCATION = os.environ.get("HOSTED_GEMINI_LOCATION", "eu")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
IMAGE_MODEL = os.environ.get("HOSTED_IMAGE_MODEL", "gemini-3.1-flash-image")
STYLE_REFS = os.environ.get("HOSTED_STYLE_REFS", "1") not in ("0", "false", "no", "")
FAL_KEY = os.environ.get("FAL_KEY", "")
MODEL_3D = os.environ.get("HOSTED_3D_MODEL", "hunyuan").lower()
OUTPUT_3D_DIR = Path(os.environ.get("HOSTED_MESH_DIR", "") or Path(tempfile.gettempdir()) / "legoarch-meshes")

STYLE_REF_DIR = Path(__file__).resolve().parent / "style_refs"
STYLE_REF_FILES = ("sagrada.jpg", "muralla.jpg", "bilbao.jpg")

FAL_ENDPOINTS = {
    "hunyuan": "fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d",
    "trellis2": "fal-ai/trellis-2",
}

# Measured in docs/hosted-generation.md §3.2: Gemini 11-16 s; Hunyuan 77-122 s;
# TRELLIS-2 on fal 96-469 s. The 3D ceiling leaves room for a fal queue on a
# bad day but still fits a 900 s Cloud Run request with the retry below.
_IMAGE_TIMEOUT = 120.0
_MESH_TIMEOUT = 600.0

# --- prompt wording ------------------------------------------------------------
# The study's Muralla run doubled its piece count because Gemini drew a thick
# grey display slab that TRELLIS/Hunyuan turned into geometry; the LoRA renders
# always had a thin black plate. Say so explicitly.
_BASE_PLATE = (
    "The model stands on a thin flat black LEGO base plate, one plate thick, with a small "
    "printed name tile at the front edge. Plain white background, nothing else in the scene."
)
_STYLE_INSTRUCTION = (
    "The first three images are style references: match their look exactly — an official "
    "LEGO Architecture product photograph of a brick-built model, visible studs and brick "
    "seams, matte plastic, elevated three-quarter angle, soft studio lighting, thin black base "
    "plate. Do not copy their buildings; only their style, framing and lighting."
)
_PHOTO_INSTRUCTION = (
    "The last image is a photograph of the building to model. Reproduce its massing, "
    "proportions and colours as a LEGO Architecture set."
)
_IP_RETRY_SWAP = ("LEGO Architecture set", "brick-built architecture model in the style of a collectible display set")


def _negative_as_prose(negative: Optional[str]) -> str:
    """Gemini has no negative prompt — restate the exclusion list as instructions."""
    items = [n.strip() for n in (negative or "").split(",") if n.strip()]
    if not items:
        return ""
    return "Do not include: " + ", ".join(items) + "."


def build_image_prompt(subject: str, negative: Optional[str]) -> str:
    """The provider-neutral grammar prompt (prompt_enhance) + hosted-only tails."""
    from .prompt_enhance import enhance_prompt

    body = enhance_prompt(subject)
    parts = [body, _BASE_PLATE]
    neg = _negative_as_prose(negative)
    if neg:
        parts.append(neg)
    return " ".join(parts)


# --- configuration probes --------------------------------------------------------
def image_configured() -> bool:
    return bool(GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT)


def mesh_configured() -> bool:
    return bool(FAL_KEY) and MODEL_3D in FAL_ENDPOINTS


def describe() -> dict[str, Any]:
    """What /api/capabilities reports about the hosted stages."""
    return {
        "image": image_configured(),
        "mesh": mesh_configured(),
        "imageModel": IMAGE_MODEL,
        "imageVia": "vertex" if GOOGLE_CLOUD_PROJECT and not GEMINI_API_KEY else "gemini-api",
        "meshModel": MODEL_3D,
        "meshEndpoint": FAL_ENDPOINTS.get(MODEL_3D),
    }


# --- Gemini -------------------------------------------------------------------------
_gemini = None


def _gemini_client():
    global _gemini
    if _gemini is None:
        from google import genai

        if GEMINI_API_KEY:
            _gemini = genai.Client(api_key=GEMINI_API_KEY)
        elif GOOGLE_CLOUD_PROJECT:
            # ADC: on Cloud Run this is the runtime service account (roles/aiplatform.user)
            _gemini = genai.Client(vertexai=True, project=GOOGLE_CLOUD_PROJECT, location=GEMINI_LOCATION)
        else:
            raise RuntimeError("hosted image generation needs GOOGLE_CLOUD_PROJECT (Vertex) or GEMINI_API_KEY")
    return _gemini


def _style_ref_parts():
    from google.genai import types

    parts = []
    for name in STYLE_REF_FILES:
        p = STYLE_REF_DIR / name
        if p.exists():
            parts.append(types.Part.from_bytes(data=p.read_bytes(), mime_type="image/jpeg"))
    return parts


def _generate_image(prompt: str, seed: Optional[int], photo: Optional[bytes]) -> tuple[bytes, str]:
    """One Gemini call. Returns (png_bytes, finish_reason). Raises on no image."""
    from google.genai import types

    contents: list[Any] = []
    refs = _style_ref_parts() if STYLE_REFS else []
    if refs:
        contents.append(_STYLE_INSTRUCTION)
        contents.extend(refs)
    if photo is not None:
        contents.append(_PHOTO_INSTRUCTION)
        contents.append(types.Part.from_bytes(data=photo, mime_type=_sniff_mime(photo)))
    contents.append(prompt)

    cfg: dict[str, Any] = {
        "response_modalities": ["IMAGE"],
        "image_config": types.ImageConfig(aspect_ratio="1:1", image_size="1K"),
        "http_options": types.HttpOptions(timeout=int(_IMAGE_TIMEOUT * 1000)),
    }
    if seed is not None:
        cfg["seed"] = int(seed) & 0x7FFFFFFF
    resp = _gemini_client().models.generate_content(
        model=IMAGE_MODEL, contents=contents, config=types.GenerateContentConfig(**cfg)
    )
    cand = (resp.candidates or [None])[0]
    finish = str(getattr(cand, "finish_reason", "") or "")
    if cand is not None and cand.content and cand.content.parts:
        for part in cand.content.parts:
            data = getattr(getattr(part, "inline_data", None), "data", None)
            if data:
                return bytes(data), finish
    raise RuntimeError(f"gemini returned no image (finish_reason={finish or 'unknown'})")


def _sniff_mime(data: bytes) -> str:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return "image/png"


def _image_with_ip_retry(prompt: str, seed: Optional[int], photo: Optional[bytes]) -> tuple[bytes, dict[str, Any]]:
    """Gemini's IP/trademark heuristic surfaces as a non-STOP finish with no image.
    Retry once with the brand words swapped for descriptive ones (README policy)."""
    try:
        png, finish = _generate_image(prompt, seed, photo)
        return png, {"finish": finish, "retried": False}
    except RuntimeError as first:
        if _IP_RETRY_SWAP[0] not in prompt:
            raise
        retry_prompt = prompt.replace(*_IP_RETRY_SWAP)
        try:
            png, finish = _generate_image(retry_prompt, seed, photo)
        except RuntimeError as second:
            raise RuntimeError(f"{first}; retry without brand wording also failed: {second}") from second
        return png, {"finish": finish, "retried": True, "prompt_used": retry_prompt}


def run_txt2img(
    prompt: str,
    seed: Optional[int] = None,
    steps: Optional[int] = None,
    cfg_scale: Optional[float] = None,
    lora_strength: Optional[float] = None,
    negative: Optional[str] = None,
) -> dict[str, Any]:
    """Gemini text-to-image in the LEGO-Architecture grammar. Same shape as comfy_client."""
    full = build_image_prompt(prompt, negative)
    t0 = time.perf_counter()
    png, meta = _image_with_ip_retry(full, seed, None)
    return {
        "png": png,
        "params": {
            "backend": "hosted",
            "model": IMAGE_MODEL,
            "prompt": full,
            "seed": seed,
            "steps": steps, "guidance": cfg_scale, "lora_strength": lora_strength,   # n/a on Gemini, echoed
            "negative": negative,
            "style_refs": list(STYLE_REF_FILES) if STYLE_REFS else [],
            "seconds": round(time.perf_counter() - t0, 1),
            **meta,
        },
    }


def run_img2img(
    prompt: str,
    image: bytes,
    seed: Optional[int] = None,
    steps: Optional[int] = None,
    cfg_scale: Optional[float] = None,
    lora_strength: Optional[float] = None,
    negative: Optional[str] = None,
) -> dict[str, Any]:
    """Gemini image-to-image: the user's reference photo becomes an input image."""
    full = build_image_prompt(prompt, negative)
    t0 = time.perf_counter()
    png, meta = _image_with_ip_retry(full, seed, image)
    return {
        "png": png,
        "params": {
            "backend": "hosted",
            "model": IMAGE_MODEL,
            "prompt": full,
            "seed": seed,
            "steps": steps, "guidance": cfg_scale, "lora_strength": lora_strength,
            "negative": negative,
            "style_refs": list(STYLE_REF_FILES) if STYLE_REFS else [],
            "photo": True,
            "seconds": round(time.perf_counter() - t0, 1),
            **meta,
        },
    }


# --- fal.ai -------------------------------------------------------------------------
def _fal():
    import fal_client

    if not FAL_KEY:
        raise RuntimeError("hosted 3D needs FAL_KEY")
    return fal_client.SyncClient(key=FAL_KEY, default_timeout=_MESH_TIMEOUT)


def _fal_args(url: str, seed: Optional[int], ss_steps, shape_steps, shape_guidance) -> dict[str, Any]:
    if MODEL_3D == "hunyuan":
        # no seed / step knobs exposed; geometry-only is off so we get the texture
        return {"input_image_url": url, "enable_pbr": False}
    # trellis2: mirror comfy_client's TRELLIS defaults; 40k faces is what the
    # shipped benchmark meshes use and keeps the GLB at ~3-4 MB
    from . import comfy_client as cc

    args: dict[str, Any] = {
        "image_url": url,
        "resolution": "1024",
        "ss_sampling_steps": ss_steps if ss_steps is not None else cc.TRELLIS_SS_STEPS,
        "shape_slat_sampling_steps": shape_steps if shape_steps is not None else cc.TRELLIS_SHAPE_STEPS,
        "tex_slat_sampling_steps": cc.TRELLIS_TEX_STEPS,
        "ss_guidance_strength": shape_guidance if shape_guidance is not None else cc.TRELLIS_SHAPE_GUIDANCE,
        "decimation_target": 40000,
        "texture_size": 1024,
    }
    if seed is not None:
        args["seed"] = int(seed) & 0x7FFFFFFF
    return args


def _pick(res: dict[str, Any], *keys: str) -> Optional[dict[str, Any]]:
    mu = res.get("model_urls") or {}
    for k in keys:
        v = mu.get(k) or res.get(k)
        if isinstance(v, dict) and v.get("url"):
            return v
    return None


def obj_bundle_to_glb(obj: bytes, mtl: Optional[bytes], texture: Optional[bytes], texture_name: str = "texture.png") -> bytes:
    """Hunyuan on fal returns OBJ + MTL + texture PNG (no GLB without PBR).

    trimesh resolves the MTL and its `map_Kd` texture from the OBJ's directory,
    so write the three files side by side in a temp dir and export a GLB with
    TextureVisuals — the voxelizer then samples colour exactly as it does for a
    TRELLIS GLB.
    """
    import trimesh

    with tempfile.TemporaryDirectory() as d:
        dd = Path(d)
        mtl_name = "material.mtl"
        text = obj.decode("utf-8", "ignore")
        for line in text.splitlines():
            if line.startswith("mtllib"):
                mtl_name = line.split(None, 1)[1].strip() or mtl_name
                break
        (dd / "model.obj").write_bytes(obj)
        if mtl is not None:
            mtl_text = mtl.decode("utf-8", "ignore")
            for line in mtl_text.splitlines():
                s = line.strip()
                if s.startswith("map_Kd"):
                    texture_name = s.split(None, 1)[1].strip() or texture_name
            (dd / mtl_name).write_bytes(mtl)
        if texture is not None:
            (dd / texture_name).write_bytes(texture)
        mesh = trimesh.load(str(dd / "model.obj"), force="mesh")
        _matte(mesh)
        return mesh.export(file_type="glb")


def _matte(mesh) -> Optional[object]:
    """Pin the exported PBR material to matte plastic.

    An OBJ/MTL has no metalness; trimesh leaves `metallicFactor` unset and the
    glTF default for an unset value is 1.0 — fully metallic — which the app's
    MeshViewer (plain lights, no environment map) renders nearly black. It also
    scales the texture by a 0.8 base-colour factor. Neither is what the render
    looked like, so: metallic 0, rough, white factor, texture untouched.
    """
    from trimesh.visual.material import PBRMaterial, SimpleMaterial

    vis = getattr(mesh, "visual", None)
    mat = getattr(vis, "material", None)
    if mat is None:
        return None
    pbr = mat.to_pbr() if isinstance(mat, SimpleMaterial) else mat
    if not isinstance(pbr, PBRMaterial):
        return None
    pbr.metallicFactor = 0.0
    pbr.roughnessFactor = 0.9
    pbr.baseColorFactor = [255, 255, 255, 255]
    vis.material = pbr
    return pbr


def _download(url: str) -> bytes:
    import httpx

    r = httpx.get(url, timeout=180.0, follow_redirects=True)
    r.raise_for_status()
    return r.content


def _fetch_glb(res: dict[str, Any]) -> bytes:
    glb = _pick(res, "glb", "model_glb", "model_mesh")
    if glb and str(glb.get("url", "")).lower().split("?")[0].endswith(".glb"):
        return _download(glb["url"])
    obj = _pick(res, "obj", "model_glb")          # hunyuan: model_glb points at the OBJ
    if obj is None:
        raise RuntimeError("fal result carried no mesh: " + ", ".join(sorted(res.keys())))
    mtl = _pick(res, "mtl", "material_mtl")
    tex = _pick(res, "texture")
    return obj_bundle_to_glb(
        _download(obj["url"]),
        _download(mtl["url"]) if mtl else None,
        _download(tex["url"]) if tex else None,
    )


def _is_transient(exc: Exception) -> bool:
    """fal's queue occasionally 5xx-es ('downstream service unavailable'); those
    are not billed, and one retry fixed it every time in the study."""
    status = getattr(getattr(exc, "response", None), "status_code", None) or getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status >= 500
    return "downstream" in str(exc).lower() or "timeout" in str(exc).lower()


def _newest_glb(after: float = 0.0) -> Optional[Path]:
    """Same contract as comfy_client._newest_glb, over the hosted mesh cache."""
    if not OUTPUT_3D_DIR.exists():
        return None
    cands = [p for p in OUTPUT_3D_DIR.glob("*.glb") if p.stat().st_mtime >= after - 2.0]
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def run_trellis(
    image: bytes,
    seed: Optional[int] = None,
    ss_steps: Optional[int] = None,
    shape_steps: Optional[int] = None,
    shape_guidance: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> dict[str, Any]:
    """Image -> textured GLB on fal (Hunyuan3D 3.1 Rapid or TRELLIS-2). Same shape as comfy_client."""
    endpoint = FAL_ENDPOINTS[MODEL_3D]
    client = _fal()
    t0 = time.perf_counter()
    url = client.upload(image, _sniff_mime(image))
    args = _fal_args(url, seed, ss_steps, shape_steps, shape_guidance)

    attempts = 0
    while True:
        attempts += 1
        try:
            # X-Fal-Store-IO: 0 asks fal not to keep the request payload (the
            # render) beyond the job — see the privacy page's third-party section.
            res = client.subscribe(
                endpoint, arguments=args, with_logs=False,
                headers={"X-Fal-Store-IO": "0"}, client_timeout=_MESH_TIMEOUT,
            )
            break
        except Exception as e:  # noqa: BLE001 — fal_client raises several types
            if attempts >= 2 or not _is_transient(e):
                raise RuntimeError(f"fal {endpoint} failed: {e}") from e
            time.sleep(3.0)
    glb = _fetch_glb(res)
    seconds = round(time.perf_counter() - t0, 1)

    OUTPUT_3D_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"hosted_{MODEL_3D}_{int(time.time())}_{(seed or 0) & 0xFFFF}.glb"
    (OUTPUT_3D_DIR / filename).write_bytes(glb)
    return {
        "glb": glb,
        "filename": filename,
        "params": {
            "backend": "hosted",
            "model": MODEL_3D,
            "endpoint": endpoint,
            "seed": seed,
            "ss_steps": args.get("ss_sampling_steps"),
            "shape_steps": args.get("shape_slat_sampling_steps"),
            "shape_guidance": args.get("ss_guidance_strength"),
            "max_tokens": max_tokens,
            "attempts": attempts,
            "seconds": seconds,
        },
    }
