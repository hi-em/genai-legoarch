# BrickForge backend

FastAPI service wrapping ComfyUI (FLUX.2 + legoarch + TRELLIS) and the custom legolizer.

## Setup
```bash
python -m venv .venv
. .venv/Scripts/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Set `COMFYUI_URL` (default `http://127.0.0.1:8188`).

## Tests
```bash
pytest -q                         # legolizer tests run without ComfyUI
```

## Layout
- `app/main.py` — routes (`/generate-image`, `/generate-3d`, `/legolize`, `/export`)
- `app/comfy_client.py` — ComfyUI REST/ws client (TODO M0/M1)
- `app/legolizer/` — the computational core:
  - `voxelize.py` · `bricks.py` · `color.py` (CIEDE2000) · `stability.py` · `ldraw.py`

## Status
Legolizer ships a **working 1×1 baseline** (connected + supported + LDraw export, all tested). Upgrade `bricks.split_and_merge` toward Luo 2015 and wire ComfyUI for the generative steps. See `../docs/plan.md`.
