# lEgoarCh

**Generative-AI brick-architecture studio** — turn a building into a render built of LEGO bricks, a 3D-printable model, *and* a genuinely buildable brick set. (The capital **E** and **C** in the name are for **E**milie and **C**harles.)

> Academic project — MaCAD (Master in Advanced Computation for Architecture & Design), Generative AI seminar.
> By **Emilie El Chidiac** & **Charles Abi Chahine**.
>
> LEGO® is a trademark of the LEGO Group of companies, which does not sponsor, authorize or endorse this project. This is a non-commercial, academic project; it avoids the LEGO logo, the minifigure, and the trademarked 2×4 brick silhouette, and uses "LEGO" only descriptively (e.g. "built of LEGO bricks"). The visual language is grounded in LEGO's real design system — see [`docs/design-system.md`](docs/design-system.md).

---

## What it does

One pipeline, **two exits**, the user chooses how far to go:

```
  [ building photo + text prompt ]
            │  FLUX.2 + legoarch LoRA
            ▼
  [ LEGO-style image ]
            │  TRELLIS 2  (image → smooth 3D mesh / GLB)
            ▼
  [ 3D model ] ───────────── EXIT 1 ▶ download GLB/STL → 3D print (smooth souvenir)
            │  voxelize → CUSTOM LEGOLIZER  ← our computational centerpiece
            ▼
  [ buildable brick set ] ── EXIT 2 ▶ LDraw + parts list + step-by-step instructions
```

All wrapped in a **playful, LEGO-skinned UI** with a **collection shelf** of your own creations.

### Why it's different
A prior course project generated *images of LEGO sets and nothing else*. **lEgoarCh produces something you can hold** — printed or built. The original "a 3D-printed mesh loses the LEGO feel" worry is resolved by making the smooth print **Exit 1** (optional) and the real, studded, buildable set **Exit 2**.

---

## Repo layout

| Path | What's inside |
|---|---|
| `docs/` | [Concept](docs/concept.md), [architecture & flow diagrams](docs/architecture.md), [prior art / repos we build on](docs/references.md), [design system](docs/design-system.md), [research](docs/research.md), ADRs, [roadmap](docs/plan.md) |
| `references/` | Trained `legoarch` LoRA + the original ComfyUI workflow JSONs |
| `comfyui/` | Workflow notes / custom-node setup |
| `backend/` | FastAPI service wrapping ComfyUI + the **custom legolizer** |
| `frontend/` | React + three.js LEGO-skinned interface |
| `samples/` | Example inputs & outputs for the demo |

See [`docs/concept.md`](docs/concept.md) for the full concept and [`docs/plan.md`](docs/plan.md) for the milestone roadmap.

---

## Running it locally

The app is **four processes**: two ComfyUI servers (image + 3D), the FastAPI backend, and the Vite frontend. The frontend talks only to the backend (`/api` → `:8000`); the backend drives the two ComfyUIs.

```
 frontend  :5173  ──/api──►  backend  :8000  ──►  ComfyUI FLUX   :8188   (text/img → LEGO image)
                                              └──►  ComfyUI TRELLIS :8189  (image → 3D mesh)
```

### Prerequisites

- **Python 3.10+** and **Node 18+**
- An **NVIDIA GPU** (~16 GB VRAM works) + recent driver
- **Miniconda** (the two ComfyUI environments are conda envs)
- **Two ComfyUI installs** — this is the heavy part, set up once:
  - **FLUX** ComfyUI on **:8188** with the FLUX.2 models (`flux-2-klein-base-4b-fp8`, `qwen_3_4b_fp8_mixed`, `flux2-vae`) and the **`legoarch` LoRA** (`references/legoarch.safetensors` → `models/loras/`).
  - **TRELLIS-2** ComfyUI on **:8189** with the [`ComfyUI-TRELLIS2`](https://github.com/PozzettiAndrea/ComfyUI-TRELLIS2) nodes. Setup is involved (CUDA wheels, etc.) — see the full walkthrough in the team **Notion → 3D section** and the notes in [`comfyui/workflows/README.md`](comfyui/workflows/README.md).
  - The API-format workflows the backend submits live in [`comfyui/workflows/`](comfyui/workflows/) (`flux_txt2img`, `flux_img2img`, `trellis_3d`).

> On a laptop RTX 4090, TRELLIS-2 needs a few fixes to run (pin `transformers==4.53.3`, use SDPA attention instead of sage/flash, launch with `--use-pytorch-cross-attention`). These are baked into the team's `run_comfyui_3D.bat`.

### 1 · Start the two ComfyUI servers

Launch each from its own install (e.g. the `.bat` launchers):

- FLUX ComfyUI → **http://127.0.0.1:8188**
- TRELLIS-2 ComfyUI → **http://127.0.0.1:8189**

(Only `:8188` is needed for image generation; `:8189` is needed for the 3D / brick steps.)

### 2 · Backend (FastAPI) — terminal #1

> **Run uvicorn from inside `backend/`** (the `app` package lives there).

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # Windows PowerShell
# (bash/macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional environment variables (sensible defaults shown):

| Var | Default | Purpose |
|---|---|---|
| `COMFYUI_URL` | `http://127.0.0.1:8188` | FLUX image-gen server |
| `COMFYUI_3D_URL` | `http://127.0.0.1:8189` | TRELLIS-2 3D server |
| `COMFYUI_3D_OUTPUT` | `C:\ComfyUI_3D\output` | where TRELLIS writes the `.glb` (backend reads it back) — **set this to your 3D install's output dir** |
| `ANTHROPIC_API_KEY` | _(unset)_ | optional — rich prompt expansion via Claude; without it a built-in template is used |

Set them before launching, e.g. `$env:COMFYUI_3D_OUTPUT="D:\ComfyUI_3D\output"`.

Health check: open **http://127.0.0.1:8000/health**.

### 3 · Frontend (Vite) — terminal #2

```powershell
cd frontend
npm install      # first time only
npm run dev      # http://localhost:5173
```

Then open **http://localhost:5173**.

### Using it

1. **Generate** — name a building (no need to type `legoarch`, it's added for you) or attach a reference photo (→ img2img). You get a real **FLUX render**.
2. **Continue → 3D · Print** → **Generate smooth 3D mesh** — TRELLIS rebuilds the geometry (~2–3 min). Download **GLB/STL**.
3. **Brick Studio** — the mesh is voxelized + legolized, so the bricks **match the building**: stability checks, parts list, **LDraw `.ldr` / CSV / instructions**, **Add to Shelf**.

---

## Status

✅ **Full pipeline is live end-to-end**: prompt/photo → FLUX image → TRELLIS mesh → voxelize → legolized bricks → exports. Generation quality and brick resolution are still being tuned. See the roadmap in [`docs/plan.md`](docs/plan.md).
