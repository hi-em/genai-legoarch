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
            │  TRELLIS 2  (image → 3D, emits voxelgrid_npz)
            ▼
  [ 3D model ] ───────────── EXIT 1 ▶ download STL → 3D print (smooth souvenir)
            │  CUSTOM LEGOLIZER  ← our computational centerpiece
            ▼
  [ buildable brick set ] ── EXIT 2 ▶ LDraw + parts list + step-by-step instructions
```

All wrapped in a **playful, LEGO-skinned UI** with a **collection shelf** of your own creations.

### Why it's different
A prior course project generated *images of LEGO sets and nothing else*. **BrickForge produces something you can hold** — printed or built. The original "a 3D-printed mesh loses the LEGO feel" worry is resolved by making the smooth print **Exit 1** (optional) and the real, studded, buildable set **Exit 2**.

---

## Repo layout

| Path | What's inside |
|---|---|
| `docs/` | Concept, research notes (cited), ADRs, roadmap |
| `references/` | Trained `legoarch` LoRA + the original ComfyUI workflow JSONs |
| `comfyui/` | Workflow notes / custom-node setup |
| `backend/` | FastAPI service wrapping ComfyUI + the **custom legolizer** |
| `frontend/` | React + three.js LEGO-skinned interface |
| `samples/` | Example inputs & outputs for the demo |

See [`docs/concept.md`](docs/concept.md) for the full concept and [`docs/plan.md`](docs/plan.md) for the milestone roadmap.

---

## Quick start (dev)

> Prereqs: a local **ComfyUI** with FLUX.2 + the `legoarch` LoRA + TRELLIS-2 nodes, Python 3.10+, Node 18+.

```bash
# 1) Backend
cd backend
python -m venv .venv && . .venv/Scripts/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2) Frontend
cd frontend
npm install
npm run dev
```

Set `COMFYUI_URL` (default `http://127.0.0.1:8188`) so the backend can reach ComfyUI.

---

## Status

🚧 Early scaffold (M0). See the roadmap in [`docs/plan.md`](docs/plan.md).
