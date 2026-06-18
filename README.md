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

## Repository layout

| Path | What's inside |
|---|---|
| `backend/` | FastAPI service wrapping ComfyUI + the **custom legolizer** + the set-designer persona |
| `frontend/` | React + three.js hero flow & collection |
| `comfyui/workflows/` | API-format workflows the backend submits (`flux_txt2img`, `flux_img2img`, `trellis_3d`) |
| `references/` | Trained `legoarch` LoRA (git-LFS) + the original ComfyUI workflow JSONs |
| `docs/` | Narrative docs + evidence — see the [docs index](docs/README.md). Highlights: [concept](docs/concept.md), [architecture](docs/architecture.md), [benchmarks](docs/benchmarks.md), [design system](docs/design-system.md), [ADRs](docs/adr/), [roadmap](docs/plan.md), and the [blog post](docs/blog/legoarch-blog-post.md) |
| `docs/presentation/` | The deck (`build_deck.py` → PDF/PPTX), the "Studwork" deck design system, and the talk/recording kit in [`talk/`](docs/presentation/talk/) |
| `scripts/` | Catalog/asset build tools + benchmark figure generators — see the [scripts index](scripts/README.md) |
| `samples/` | Example inputs & outputs (placeholder for curated examples) |
| `start-app.ps1` | One-command launcher for the backend + frontend (see below) |

---

## Running it locally

The app is **four separate processes**, each in its own terminal: two ComfyUI servers (image + 3D), the FastAPI backend, and the Vite frontend. The frontend talks only to the backend (`/api` → `:8000`); the backend drives the two ComfyUIs.

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

### What to run in each terminal

Open **four terminals**. Terminals 3 & 4 below start at the **repo root** (`genai-legoarch/`); terminals 1 & 2 run from wherever each ComfyUI is installed. Start them top to bottom.

| Terminal | Process | Where | Opens at |
|---|---|---|---|
| **1** | ComfyUI **FLUX** | your FLUX ComfyUI install | http://127.0.0.1:8188 |
| **2** | ComfyUI **TRELLIS-2** | your TRELLIS ComfyUI install | http://127.0.0.1:8189 |
| **3** | **Backend** (FastAPI) | repo root → `backend/` | http://127.0.0.1:8000 |
| **4** | **Frontend** (Vite) | repo root → `frontend/` | http://localhost:5173 |

> Use the **frontend URL (http://localhost:5173)** in your browser — that's the app. The other three are services it depends on.

---

### ▶ Every time — just start the app (setup already done)

Once the one-time setup below has been run, this is all you need.

**Shortcut (backend + frontend in one command)** — from the repo root:
```powershell
.\start-app.ps1
```
Opens the backend (:8000) and frontend (:5173) each in its own window and launches the browser
at http://localhost:5173. It uses the venv's Python directly (so a conda `(base)` prompt is fine).
If scripts are blocked, run `powershell -ExecutionPolicy Bypass -File .\start-app.ps1` once, or
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. This does **not** start ComfyUI — fine for
screenshots / slides / the pre-baked shelf; start ComfyUI FLUX (:8188) + TRELLIS (:8189) yourself
only to render a brand-new building live.

Or start each process by hand (below). **Run the lines one at a time** (don't paste a whole block — pasted comments/continuations cause errors in PowerShell).

**Terminal 1 — ComfyUI FLUX (:8188)** — from your FLUX ComfyUI folder:
```powershell
python main.py --port 8188
```

**Terminal 2 — ComfyUI TRELLIS-2 (:8189)** — from your TRELLIS ComfyUI folder:
```powershell
python main.py --port 8189
```

**Terminal 3 — Backend (:8000)** — from the repo root:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**Terminal 4 — Frontend (:5173)** — from the repo root:
```powershell
cd frontend
npm run dev
```

**Then open http://localhost:5173 in your browser.** (Backend OK check: http://127.0.0.1:8000/health)

To stop any process: `Ctrl+C` in its terminal. To leave the backend venv: `deactivate`.

---

### First-time setup (run once)

You only do this once per machine. After it, use the **"Every time"** steps above.

**Backend venv + dependencies** — from the repo root:
```powershell
cd backend
python -m venv .venv                 # creates .venv (slow in OneDrive — let it finish, ~1-2 min)
.\.venv\Scripts\Activate.ps1         # bash/macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

**Frontend dependencies** — from the repo root:
```powershell
cd frontend
npm install
```

> **⚠️ venv gotchas (these bit us — read before re-running setup):**
> - **Use one Python consistently.** Don't create the venv from a conda `(base)` prompt one time and a plain shell another — mixing Python versions (e.g. 3.13 vs 3.14) corrupts the compiled packages (numpy/pydantic-core fail to import). If imports break with `cp31x` / `No module named '..._core'` errors, **delete `backend\.venv` and recreate it** with a single Python.
> - **Don't re-run `python -m venv .venv` on an existing, working venv** — if it's already set up, just `Activate.ps1` and run uvicorn.
> - If `Activate.ps1` is blocked ("running scripts is disabled"), run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Optional backend environment variables (defaults shown):

| Var | Default | Purpose |
|---|---|---|
| `COMFYUI_URL` | `http://127.0.0.1:8188` | FLUX image-gen server |
| `COMFYUI_3D_URL` | `http://127.0.0.1:8189` | TRELLIS-2 3D server |
| `COMFYUI_3D_OUTPUT` | `C:\ComfyUI_3D\output` | where TRELLIS writes the `.glb` (backend reads it back) — **point this at your 3D install's output dir** |
| `ANTHROPIC_API_KEY` | _(unset)_ | optional — richer prompt expansion + wittier box copy via Claude; without it, built-in templates are used |
| `FLUX_STEPS` | `28` | FLUX sampling steps (Klein is distilled; 28 ≈ stock 50 at ~half the time) |
| `TRELLIS_*` | see `comfy_client.py` | TRELLIS step / decimation / texture-size overrides |

### Using it
1. **Name a building** (no need to type `legoarch` — it's added for you), pick a rich example, or attach a reference photo (→ img2img). Hit **Forge the set**.
2. Watch the **FLUX render** appear, then the set **assemble course-by-course**.
3. On the reveal: grab **The Box**, **Instructions (PDF)**, the **Priced set**, a **Share card**, or **Add to Shelf**. Saved sets reopen from **Collection** with full 3D + trophies + LDraw/CSV exports.

---

## Status

✅ **Full pipeline live end-to-end** on local ComfyUI: prompt/photo → FLUX render → TRELLIS mesh → voxelize + colour-match → real split-and-merge bricks → assembly → trophies → collection. The legolizer uses real LEGO footprints; colours are matched to the generated render. See the roadmap in [`docs/plan.md`](docs/plan.md).
