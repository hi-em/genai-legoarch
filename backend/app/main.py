"""lEgoarCh FastAPI app.

Wraps a running ComfyUI (FLUX.2 + legoarch LoRA + TRELLIS) and the custom
legolizer. Endpoints are defined here as a thin layer; heavy logic lives in
`app.comfy_client` and `app.legolizer`.

Run:  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import base64
import os
from typing import Any, Optional

from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .legolizer import legolize_voxelgrid

app = FastAPI(title="lEgoarCh API", version="0.0.1")

# Every API route lives under /api — the SAME path in dev and in production.
# The Vite proxy used to strip the prefix, which meant the deployed one-origin
# build called /api/... while the backend answered on /..., and the SPA
# catch-all quietly returned index.html for every API request.
api = APIRouter()

# The dev origins are always allowed; a deployed frontend lives on some other
# origin entirely, so add it with ALLOWED_ORIGINS (comma-separated). Without
# this the browser blocks every call from the deployed site — the failure looks
# like the backend is down when it is in fact running fine.
_DEV_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5175", "http://127.0.0.1:5175",
]
_EXTRA_ORIGINS = [
    o.strip().rstrip("/")
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEV_ORIGINS + _EXTRA_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

def auth_dep():
    """`Depends(require_user)`, imported lazily so `app.auth` stays out of the
    module's import-time graph (google-auth is slow to import)."""
    from .auth import require_user

    return Depends(require_user)


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
    fill_mode: str = "solid"               # "solid" | "shell" | "surface"
    shell_thickness: int = 2               # wall thickness in studs (shell mode)
    legolize_options: dict[str, Any] = {}  # seed / randomness / seam_weight / tile_tops


class LegolizeMeshReq(BaseModel):
    """The CPU-only back half of the pipeline: GLB -> voxels -> bricks.

    Powers the staged flow's "mesh stop": the user can re-legolize the SAME
    mesh with different brick settings in seconds, no GPU involved. Pass
    `glb_name` (the filename /generate-mesh returned — read straight from the
    ComfyUI output dir) or fall back to inline `glb_b64`.
    """
    glb_name: Optional[str] = None         # filename in the 3D output dir (preferred)
    glb_b64: Optional[str] = None          # or the mesh inline (b64 / data URL)
    image_b64: Optional[str] = None        # the render, for colour exposure matching
    seed: Optional[int] = None
    voxel_target: int = 32
    fill_mode: str = "solid"               # "solid" | "shell" | "surface"
    shell_thickness: int = 2               # wall thickness in studs (shell mode)
    legolize_options: dict[str, Any] = {}  # randomness / seam_weight / tile_tops / palette / slopes


class SignInReq(BaseModel):
    credential: str                        # the Google ID token from GIS


class SetCopyReq(BaseModel):
    subject: str
    n_bricks: int = 0
    n_parts: int = 0
    n_colors: int = 0
    grid: list[int] = []
    support_ratio: float = 1.0
    connected: bool = True


# ---------- routes ----------
@api.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "comfyui_url": COMFYUI_URL, "comfyui_3d_url": COMFYUI_3D_URL}


def _comfy_up(base: str, timeout: float = 1.5) -> bool:
    """Is a ComfyUI actually answering at `base`? Cheap GET, short timeout."""
    import httpx

    try:
        r = httpx.get(f"{base}/system_stats", timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


@api.get("/capabilities")
def capabilities() -> dict[str, Any]:
    """Which pipeline stages can actually run right now.

    The frontend asks this on load so the GPU steps can announce themselves as
    offline BEFORE the user spends a click on them. The two ComfyUI servers are
    the expensive, frequently-absent half: the deployed site is usually up with
    the GPU box switched off (see docs/deploy.md), and a disabled button with a
    reason reads very differently from a 4-minute wait ending in "didn't
    finish". The CPU legolizer needs no GPU, so it is up whenever we are.
    """
    flux = _comfy_up(COMFYUI_URL)
    trellis = _comfy_up(COMFYUI_3D_URL)
    return {
        "backend": True,
        "image": flux,        # /generate-image  (FLUX + legoarch LoRA)
        "mesh": trellis,      # /generate-mesh   (TRELLIS-2)
        "bricks": True,       # /legolize-mesh   (CPU only — always available)
        "gpu": flux and trellis,
    }


@api.post("/generate-image")
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
    fill_mode: str = "solid",
    shell_thickness: int = 2,
) -> dict[str, Any]:
    """GLB -> plate-unit voxels -> brick model. Pure CPU, a few seconds.

    fill_mode "solid" guarantees a single connected component + ~0.99 support
    at ANY TRELLIS preset and packs ~70% fewer pieces than a raw surface skin
    (docs/benchmarks.md §4). "shell" hollows the solid back to real walls —
    exterior-connected voids (windows, courtyards) stay open — and relies on
    the connectivity repair pass for the rare floating fragment.
    """
    import numpy as np

    from .mesh_voxelize import match_exposure, voxelize_glb

    voxel = voxelize_glb(
        glb, target=voxel_target,
        fill_mode=fill_mode if fill_mode in ("solid", "shell", "surface") else "solid",
        shell_thickness=shell_thickness,
    )
    nx, ny, nz = voxel["nx"], voxel["ny"], voxel["nz"]
    occ = (
        np.frombuffer(base64.b64decode(voxel["occ_b64"]), dtype=np.uint8)
        .reshape((nx, ny, nz), order="F")
        .astype(bool)
    )
    # real colour from the generated model, matched to LEGO colours downstream
    voxel_rgb = None
    voxel_rgb_pre = None
    if voxel.get("rgb_b64"):
        voxel_rgb = (
            np.frombuffer(base64.b64decode(voxel["rgb_b64"]), dtype=np.uint8)
            .reshape((nz, ny, nx, 3))
            .transpose(2, 1, 0, 3)
        )
        voxel_rgb_pre = voxel_rgb
        if render_png:
            voxel_rgb = match_exposure(voxel_rgb, render_png)  # tie colours to the render
    model = legolize_voxelgrid(
        _occupancy=occ, options={"seed": seed or 1, **options}, voxel_rgb=voxel_rgb
    )
    result = {"voxel": voxel, "brickModel": model.to_dict()}
    # Track-B instrumentation: objective colour-consistency numbers from a live
    # forge (M1 perceptual palette agreement + M3 shatter + per-hop drift), so
    # tuning isn't eyeballed. Off by default; the replay harness is the offline
    # equivalent on saved (GLB, render) pairs.
    if options.get("debug_metrics") and render_png:
        result["colorMetrics"] = _color_metrics(
            render_png, voxel_rgb_pre, voxel_rgb, model, str(options.get("palette", "")) or None
        )
    return result


def _color_metrics(render_png, rgb_pre, rgb_post, model, tier):
    """M1 palette-share + M3 shatter + per-hop dominant-colour drift for a run."""
    from .legolizer import metrics as _m

    render_h = _m.render_hist(render_png, tier)
    build_h = _m.build_hist(model.bricks, tier)
    return {
        "M1_palette_share": round(_m.palette_share(render_h, build_h, tier), 4),
        "shatter": _m.shatter_stats(model.bricks),
        "per_hop": _m.per_hop_delta_e({
            "render": render_h,
            "mesh": _m.voxel_hist(rgb_pre, tier) if rgb_pre is not None else None,
            "post_exp": _m.voxel_hist(rgb_post, tier) if rgb_post is not None else None,
            "build": build_h,
        }, tier),
    }


def _mesh_path(name: str):
    """Resolve a GLB filename inside the ComfyUI 3D output dir (no traversal)."""
    from pathlib import Path

    from . import comfy_client

    safe = Path(name).name                     # strip any directory components
    if not safe.lower().endswith(".glb"):
        raise ValueError("not a .glb")
    p = comfy_client.OUTPUT_3D_DIR / safe
    if not p.exists():
        raise FileNotFoundError(safe)
    return p


@api.get("/mesh/{name}")
def get_mesh(name: str):
    """Serve a generated GLB as a real binary file.

    Quality exports are >10 MB — inlining them as base64 data URLs froze the
    browser's JSON parse, so meshes travel by URL: tiny JSON responses, native
    binary streaming, and re-legolize requests reference the file by name
    instead of re-uploading 16 MB.
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    try:
        path = _mesh_path(name)
    except FileNotFoundError:
        # distinguishable 404 so the frontend can steer the user to
        # re-materialize instead of retrying a doomed request forever
        raise HTTPException(status_code=404, detail={"code": "mesh_not_found", "name": name})
    return FileResponse(path, media_type="model/gltf-binary")


@api.get("/latest-mesh")
def latest_mesh(since: float = 0.0) -> dict[str, Any]:
    """Newest GLB in the 3D output dir with mtime >= `since`.

    `since` is epoch MILLISECONDS (what Date.now() persisted at job start);
    the frontend's refresh-recovery banner uses this to re-attach a mesh
    whose job outlived the page. 404 when nothing new exists.
    """
    from fastapi import HTTPException

    from . import comfy_client

    p = comfy_client._newest_glb(after=since / 1000.0)
    if p is None:
        raise HTTPException(status_code=404, detail={"code": "no_mesh"})
    return {"glbName": p.name, "glbUrl": f"/api/mesh/{p.name}", "mtimeMs": p.stat().st_mtime * 1000}


@api.post("/generate-mesh")
def generate_mesh(req: Generate3DReq) -> dict[str, Any]:
    """The GPU half only: render -> TRELLIS-2 mesh. Returns a mesh file URL.

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
        "glbName": result["filename"],
        "glbUrl": f"/api/mesh/{result['filename']}",
        "params": result.get("params", {}),
    }


@api.post("/legolize-mesh")
def legolize_mesh(req: LegolizeMeshReq) -> dict[str, Any]:
    """The CPU half only: GLB -> voxels -> bricks. Seconds, no ComfyUI."""
    voxel_target = max(16, min(64, req.voxel_target))
    if req.glb_name:
        from fastapi import HTTPException

        try:
            glb = _mesh_path(req.glb_name).read_bytes()
        except FileNotFoundError:
            # the mesh file was cleaned up — tell the frontend EXACTLY that,
            # so it steers the user to re-materialize instead of retry-looping
            raise HTTPException(
                status_code=404, detail={"code": "mesh_not_found", "name": req.glb_name}
            )
    elif req.glb_b64:
        glb = _decode_image(req.glb_b64)       # same b64/data-URL decoding rules
    else:
        raise ValueError("legolize-mesh needs glb_name or glb_b64")
    # the render is only used for colour exposure matching — never fatal
    try:
        png = _decode_image(req.image_b64) if req.image_b64 else None
    except Exception:
        png = None
    out = _voxelize_and_legolize(
        glb, png, voxel_target, req.seed, req.legolize_options,
        fill_mode=req.fill_mode, shell_thickness=req.shell_thickness,
    )
    out["params"] = {
        "voxel_target": voxel_target, "seed": req.seed,
        "fill_mode": req.fill_mode, "shell_thickness": req.shell_thickness,
        **req.legolize_options,
    }
    return out


@api.post("/generate-3d")
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
        out = _voxelize_and_legolize(
            result["glb"], img, voxel_target, req.seed, req.legolize_options,
            fill_mode=req.fill_mode, shell_thickness=req.shell_thickness,
        )
        resp.update(out)
    except Exception as e:  # keep the GLB usable even if voxelization fails
        resp["voxelError"] = str(e)
    return resp


@api.post("/set-copy")
def set_copy(req: SetCopyReq) -> dict[str, Any]:
    """Name the set + write the box/share copy (Claude if keyed, else template)."""
    from .set_designer import generate_set_copy

    return generate_set_copy(req.model_dump())


# ---------- auth ----------
@api.get("/auth/config")
def auth_config() -> dict[str, Any]:
    """What the sign-in gate needs to render. No secrets — the client ID is public."""
    from . import auth

    return {"clientId": auth.GOOGLE_CLIENT_ID, "configured": bool(auth.GOOGLE_CLIENT_ID)}


@api.post("/auth/session")
def sign_in(req: SignInReq, response: Response) -> dict[str, Any]:
    """Exchange a verified Google ID token for our own session cookie."""
    from . import auth, shelf_store

    claims = auth.verify_google_token(req.credential)
    profile = auth.profile_for(claims)
    try:
        shelf_store.touch_user(profile)
    except Exception:
        # a storage hiccup must not block sign-in — the session is still valid
        pass
    auth.issue_session(response, claims)
    return {"user": {k: profile[k] for k in ("uid", "email", "name", "picture")}}


@api.get("/auth/me")
def whoami(request: Request) -> dict[str, Any]:
    from . import auth

    user = auth.optional_user(request)
    return {"user": user}


@api.post("/auth/logout")
def sign_out(response: Response) -> dict[str, Any]:
    from . import auth

    auth.clear_session(response)
    return {"ok": True}


# ---------- the cloud shelf ----------
@api.get("/shelf")
def shelf_list(user: dict[str, Any] = auth_dep()) -> dict[str, Any]:
    """The index only — the Collection grid, without the multi-MB payloads."""
    from . import shelf_store

    return {"items": shelf_store.list_sets(user["uid"])}


@api.get("/shelf/{set_id}")
def shelf_get(set_id: str, user: dict[str, Any] = auth_dep()) -> dict[str, Any]:
    from fastapi import HTTPException

    from . import shelf_store

    item = shelf_store.get_set(user["uid"], set_id)
    if item is None:
        raise HTTPException(status_code=404, detail={"code": "set_not_found"})
    return {"item": item}


@api.put("/shelf/{set_id}")
async def shelf_put(set_id: str, request: Request, user: dict[str, Any] = auth_dep()) -> dict[str, Any]:
    """Save or replace one set.

    The body is read raw rather than through a pydantic model: a set is a large,
    open-ended blob (brickModel, setCopy, runRecord) and validating it field by
    field here would only duplicate the frontend's adapter.
    """
    from . import shelf_store

    item = await request.json()
    item["id"] = set_id
    return shelf_store.save_set(user["uid"], item)


@api.delete("/shelf/{set_id}")
def shelf_delete(set_id: str, user: dict[str, Any] = auth_dep()) -> dict[str, Any]:
    from . import shelf_store

    shelf_store.delete_set(user["uid"], set_id)
    return {"ok": True}


app.include_router(api, prefix="/api")


# ---------- the built frontend ----------
# Cloud Run runs ONE container: FastAPI serves the API and the SPA together, so
# there is no second origin and therefore no CORS to configure. Mounted last —
# the catch-all owns "/" and would otherwise shadow every route above.
_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _DIST.is_dir():
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        """Serve a real file when one exists, else index.html."""
        candidate = (_DIST / path).resolve()
        if path and _DIST in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
