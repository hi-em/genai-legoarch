# lEgoarCh backend

FastAPI service wrapping the two ComfyUIs (FLUX.2 + legoarch on :8188, TRELLIS-2 on :8189) and the custom legolizer. Full run guide: [`../README.md`](../README.md).

## Setup
```bash
# run from inside backend/
python -m venv .venv
. .venv/Scripts/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Env (defaults): `COMFYUI_URL=http://127.0.0.1:8188`, `COMFYUI_3D_URL=http://127.0.0.1:8189`,
`COMFYUI_3D_OUTPUT=C:\ComfyUI_3D\output` (where TRELLIS writes the GLB), `ANTHROPIC_API_KEY` (optional, rich prompts).

## Tests
```bash
pytest -q                         # legolizer tests run without ComfyUI
```

## Layout
- `app/main.py` — routes (`/health`, `/generate-image`, `/generate-3d`, `/legolize`, `/set-copy`)
- `app/comfy_client.py` — ComfyUI client: load API workflow → prune → override prompt/seed/steps/image → submit → poll → fetch. Tuned defaults (FLUX 28 steps, TRELLIS steps/decimation/texture) are env-overridable.
- `app/prompt_enhance.py` — expands a building name into the rich legoarch prompt; passes already-rich prompts through verbatim (Claude if `ANTHROPIC_API_KEY`, else template)
- `app/set_designer.py` — the "set designer" persona: names the set + writes box copy (Claude if keyed, else templates)
- `app/mesh_voxelize.py` — TRELLIS GLB → occupancy grid **+ per-voxel colour sampled from the mesh, exposure-matched to the render**
- `app/legolizer/` — the computational core (single source of truth for the brick layout):
  - `bricks.py` (real Luo split-and-merge, legal footprints, seam-staggered) · `color.py` (CIEDE2000 colour match) · `stability.py` (connectivity + support) · `ldraw.py` (centered-origin export) · `voxelize.py`

## Status
ComfyUI is **wired** and the pipeline is live end-to-end: `/generate-image` (txt2img + img2img) and `/generate-3d` (TRELLIS mesh → voxelize + colour → **backend legolize**) return the real, buildable `brickModel`. The frontend renders it directly (no client-side layout). Next: Luo's stability-driven refinement loop. See `../docs/plan.md`.
