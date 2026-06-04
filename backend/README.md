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
- `app/main.py` — routes (`/health`, `/generate-image`, `/generate-3d`, `/legolize`)
- `app/comfy_client.py` — ComfyUI client: load API workflow → prune → override prompt/seed/image → submit → poll → fetch
- `app/prompt_enhance.py` — expands a building name into the rich legoarch prompt (Claude if `ANTHROPIC_API_KEY`, else template)
- `app/mesh_voxelize.py` — TRELLIS GLB → occupancy grid for the frontend legolizer
- `app/legolizer/` — the computational core:
  - `voxelize.py` · `bricks.py` · `color.py` (CIEDE2000) · `stability.py` · `ldraw.py`

## Status
ComfyUI is **wired**: `/generate-image` (txt2img + img2img) and `/generate-3d` (TRELLIS mesh + voxelization) are live. The frontend legolizes the voxelized mesh in-browser. Next: upgrade `bricks.split_and_merge` toward Luo 2015. See `../docs/plan.md`.
