# lEgoarCh

**Generative-AI brick-architecture studio** — type a building and watch it become a *genuinely buildable* LEGO set: rendered, reconstructed in 3D, solved brick by brick, and packaged like a real product. (The capital **E** and **C** in the name are for **E**milie and **C**harles.)

> Academic project — MaCAD (Master in Advanced Computation for Architecture & Design), Generative AI seminar.
> By **Emilie El Chidiac** & **Charles Abi Chahine**.
>
> LEGO® is a trademark of the LEGO Group of companies, which does not sponsor, authorize or endorse this project. This is a non-commercial, academic project; it avoids the LEGO logo, the minifigure, and the trademarked 2×4 brick silhouette, and uses "LEGO" only descriptively (e.g. "built of LEGO bricks"). The visual language is grounded in LEGO's real design system — see [`docs/design-system.md`](docs/design-system.md).

---

## The thesis

> *Generative AI proposes the form; deterministic computation proves it's buildable.*

A prior course project stopped at generated **images**. lEgoarCh continues downstream to a real, legal brick set — every footprint a buildable BrickLink part, colours matched to the render, stability checked.

## What it does — one cinematic flow

```
  [ building name (or rich prompt / reference photo) ]
            │  FLUX.2 + legoarch LoRA  (ComfyUI :8188)
            ▼
  [ LEGO-Architecture render ]
            │  TRELLIS-2  (image → textured 3D mesh, ComfyUI :8189)
            ▼
  [ voxelize + sample colour, exposure-matched to the render ]
            │  CUSTOM LEGOLIZER  ← the computational centerpiece (backend)
            │  split-and-merge into legal bricks → nearest LEGO colour (CIEDE2000) → stability
            ▼
  [ buildable brick set ]  ──▶  watch it assemble course-by-course, then:
       · The Box        — official-style box art
       · Instructions   — step-by-step PDF booklet
       · Priced set     — parts list + build-cost estimate (+ BrickLink link)
       · Share card     — a social card
       · Add to Shelf   — your persistent collection
```

The backend is the **single source of truth** for the brick layout; the frontend renders exactly what it returns (no client-side guessing, no mock geometry).

---

## Repo layout

| Path | What's inside |
|---|---|
| `docs/` | [Concept](docs/concept.md), [architecture & flow](docs/architecture.md), [prior art / repos](docs/references.md), [design system](docs/design-system.md), [research](docs/research.md), [ADRs](docs/adr/), [roadmap](docs/plan.md) |
| `references/` | Trained `legoarch` LoRA + the original ComfyUI workflow JSONs |
| `comfyui/workflows/` | API-format workflows the backend submits (`flux_txt2img`, `flux_img2img`, `trellis_3d`) |
| `backend/` | FastAPI service wrapping ComfyUI + the **custom legolizer** + the set-designer persona |
| `frontend/` | React + three.js hero flow & collection |
| `samples/` | Example inputs & outputs |

---

## Running it locally

Four processes: two ComfyUI servers (image + 3D), the FastAPI backend, and the Vite frontend. The frontend talks only to the backend (`/api` → `:8000`); the backend drives the two ComfyUIs.

```
 frontend :5173 ──/api──► backend :8000 ──► ComfyUI FLUX    :8188  (text/img → LEGO render)
                                       └──► ComfyUI TRELLIS :8189  (render → textured 3D mesh)
```

### Prerequisites
- **Python 3.10+** and **Node 18+**
- An **NVIDIA GPU** (~16 GB VRAM) + recent driver
- **Two ComfyUI installs** (set up once):
  - **FLUX** on **:8188** with the FLUX.2 models (`flux-2-klein-base-4b-fp8`, `qwen_3_4b_fp8_mixed`, `flux2-vae`) and the **`legoarch` LoRA** (`references/legoarch.safetensors` → `models/loras/`).
  - **TRELLIS-2** on **:8189** with the [`ComfyUI-TRELLIS2`](https://github.com/PozzettiAndrea/ComfyUI-TRELLIS2) nodes (CUDA wheels, SDPA attention — see the team notes).

### 1 · Start the two ComfyUI servers
- FLUX ComfyUI → **http://127.0.0.1:8188**
- TRELLIS-2 ComfyUI → **http://127.0.0.1:8189**

### 2 · Backend (FastAPI) — terminal #1
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # bash/macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional environment variables (defaults shown):

| Var | Default | Purpose |
|---|---|---|
| `COMFYUI_URL` | `http://127.0.0.1:8188` | FLUX image-gen server |
| `COMFYUI_3D_URL` | `http://127.0.0.1:8189` | TRELLIS-2 3D server |
| `COMFYUI_3D_OUTPUT` | `C:\ComfyUI_3D\output` | where TRELLIS writes the `.glb` (backend reads it back) — **point this at your 3D install's output dir** |
| `ANTHROPIC_API_KEY` | _(unset)_ | optional — richer prompt expansion + wittier box copy via Claude; without it, built-in templates are used |
| `FLUX_STEPS` | `28` | FLUX sampling steps (Klein is distilled; 28 ≈ stock 50 at ~half the time) |
| `TRELLIS_*` | see `comfy_client.py` | TRELLIS step / decimation / texture-size overrides |

Health check: **http://127.0.0.1:8000/health**.

### 3 · Frontend (Vite) — terminal #2
```powershell
cd frontend
npm install      # first time only
npm run dev      # http://localhost:5173
```

### Using it
1. **Name a building** (no need to type `legoarch` — it's added for you), pick a rich example, or attach a reference photo (→ img2img). Hit **Forge the set**.
2. Watch the **FLUX render** appear, then the set **assemble course-by-course**.
3. On the reveal: grab **The Box**, **Instructions (PDF)**, the **Priced set**, a **Share card**, or **Add to Shelf**. Saved sets reopen from **Collection** with full 3D + trophies + LDraw/CSV exports.

---

## Status

✅ **Full pipeline live end-to-end** on local ComfyUI: prompt/photo → FLUX render → TRELLIS mesh → voxelize + colour-match → real split-and-merge bricks → assembly → trophies → collection. The legolizer uses real LEGO footprints; colours are matched to the generated render. See the roadmap in [`docs/plan.md`](docs/plan.md).
