# Prior art, repos & tools we build on

Candidate **bases** for lEgoarCh — the open-source projects, tools, and papers our research surfaced. We don't reinvent the hard parts; we reuse these and contribute the *integration* + the *architecture-domain application* + the *interface*. Licenses noted where known (always verify before redistributing weights/code).

---

## 1. Buildability / legolization — the computational core (fork candidates)

| Project | Link | What we'd reuse | License |
|---|---|---|---|
| **BrickGPT / LegoGPT** (CMU, 2025) | code → https://github.com/AvaLovelace1/BrickGPT · page → https://avalovelace1.github.io/BrickGPT/ · paper → https://arxiv.org/abs/2505.05469 | Text→stable, buildable brick generation; rejection sampling + physics-aware rollback; 47k-structure dataset (StableText2Brick on Hugging Face) | MIT *(verify)* |
| **StableLego** (Intelligent Control Lab, 2024) | code → https://github.com/intelligent-control-lab/StableLego · paper → https://arxiv.org/abs/2402.10711 | Rigid-Block-Equilibrium stability solver; per-brick stability score; weakest-brick heatmap | open *(verify)* |
| **Image2Lego** (2021) | paper → https://arxiv.org/abs/2108.08477 | image → voxel → brick directly (lets us skip the lossy smooth-mesh round-trip) | — |
| **brickalize** | https://github.com/CreativeMindstorms/brickalize | STL → brick structure + support generation + layer-by-layer views (Python) | see repo |
| **3D-to-Lego** | https://github.com/AJaiman/3D-to-Lego | mesh → LEGO sculpture exported as LDraw (.ldr) | see repo |
| **LSculpt** | https://lego.bldesign.org/LSculpt/ | mesh → LDraw "studs-out" voxelizer (reference implementation) | GPLv3 |

## 2. Image → 3D backbone (already in our ComfyUI workflow)

| Project | Link | Role |
|---|---|---|
| **TRELLIS / TRELLIS-2** (Microsoft, CVPR'25) | https://github.com/microsoft/TRELLIS | image → 3D (mesh + the `voxelgrid_npz` intermediate we brickify) |
| **ComfyUI** | https://github.com/comfyanonymous/ComfyUI | the node graph hosting FLUX.2 + our `legoarch` LoRA + TRELLIS |

## 3. Tools & file formats (export / instructions / validation)

| Tool | Link | Role |
|---|---|---|
| **BrickLink Studio (Stud.io)** | https://www.bricklink.com/v3/studio/download.page | LDraw editor/renderer; auto build instructions; real part/price validation; the **Sculpture** mesh→bricks baseline we intentionally go beyond → https://studiohelp.bricklink.com/hc/en-us/articles/6508264220183-Sculpture |
| **LDraw** | https://ldraw.org | open CAD standard (`.ldr`/`.mpd`) our legolizer exports |

## 4. Methods papers (algorithms we implement, no public code)

- **Legolization: Optimizing LEGO Designs** — Luo et al., SIGGRAPH Asia 2015 → http://www.cmlab.csie.ntu.edu.tw/~forestking/research/SIGA15-Legolization/ (split-and-merge into legal bricks + force-based stability — the basis of our `bricks.py`)
- **Automatic Generation of Vivid LEGO Architectural Sculptures** — Zhou et al., CGF/Eurographics 2019 → https://onlinelibrary.wiley.com/doi/abs/10.1111/cgf.13603 (architecture-specific brickification; mesh-vs-grid deformation — our closest precedent)
- **Constructable Brick Sculptures** — Testuz et al., EPFL → https://infoscience.epfl.ch/record/183442 (graph-based connectivity + repair)
- **Optimal LEGO Brick Layout via Genetic Algorithm** — GECCO 2015 → https://dl.acm.org/doi/10.1145/2739480.2754667
- **Style2Fab** — Faruqi & Mueller, MIT CSAIL, UIST 2023 → https://hcie.csail.mit.edu/research/style2fab/style2fab.html · https://arxiv.org/abs/2309.06379 (functional-vs-aesthetic segmentation — the basis if we revisit the hybrid "print the signature piece" idea)

## 5. Differentiation baselines (what we improve on)

- **"LEGO Set: A Generative AI Approach"** — prior MaCAD project (images + text only, nothing buildable) → https://blog.iaac.net/lego-set-a-generative-ai-approach/
- **"ARchitect"** — same course, FLUX+LoRA+interface (proves the format reads well to faculty) → https://blog.iaac.net/architect/

## 6. Design system & trademark sources (for the UI)

- LEGO **Fair Play** / trademark policy → https://www.lego.com/en-us/legal/notices-and-policies/fair-play
- **BrickLink** color catalog (214 colors) → https://www.bricklink.com/catalogColors.asp
- **Swooshable / Ryan Howerter** color cross-reference (LEGO/BrickLink/LDraw + hex) → https://swooshable.com/parts/colors
- **Lucide** icons → https://lucide.dev · **Mermaid** diagrams → https://mermaid.js.org
- Brick dimensions (8 mm module, 3:1 plate ratio) → https://www.bricklink.com/help.asp?helpID=261

## 7. (Optional) neuroarchitecture extension

- Valentine & Wilkins, *Visual Discomfort in the Built Environment* (Buildings 2025) → https://www.mdpi.com/2075-5309/15/13/2208 — Fourier facade visual-stress scoring, if we ever add the "predicted visual comfort" tab.

---

> **Our contribution vs. these bases:** none of them generate *architecture* from a real building, none combine the generative front end with an interactive, buildable, exportable studio, and none colour-match the bricks to the generated render or package the result as a collector product (box art, instruction booklet, priced set, share card). We integrate published algorithms, apply them to architecture, and wrap them in a usable interface. See [`architecture.md`](architecture.md) and [`concept.md`](concept.md).
