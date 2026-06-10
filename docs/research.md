# Research notes & citations

Curated from a multi-agent research panel — the primary sources have exact algorithms/equations we reuse rather than reinvent.

**Implemented:** Luo-2015 greedy split-and-merge (`bricks.py`), CIEDE2000 colour matching + exposure-match to the render (`color.py` + `mesh_voxelize.py`), connectivity + support stability (`stability.py`), LDraw export (`ldraw.py`).
**Next upgrade:** Luo's stability-driven refinement loop (re-merge the weakest region) and StableLego's per-brick equilibrium score.

## Legolization (voxel → legal, buildable bricks) — core of `legolizer/bricks.py`
- **Luo et al., "Legolization: Optimizing LEGO Designs", SIGGRAPH Asia 2015.** *(implemented — greedy pass with running-bond seam staggering)* Voxelize, then split-and-remerge voxels into legal brick footprints (1×1…2×4…) while preserving silhouette; force-based stability metric + a refinement loop that re-merges the weakest region *(the refinement loop is our next upgrade)*. → http://www.cmlab.csie.ntu.edu.tw/~forestking/research/SIGA15-Legolization/
- **Zhou et al., "Automatic Generation of Vivid LEGO Architectural Sculptures", CGF / Eurographics 2019.** *Architecture-specific.* Deformation reconciles continuous mesh vs discrete brick grid; preserves repeating architectural features. Closest precedent to what we're doing. → https://onlinelibrary.wiley.com/doi/abs/10.1111/cgf.13603
- **Testuz et al., "Automatic Generation of Constructable Brick Sculptures" (EPFL).** Graph-based connectivity + structural repair. Good for the connectivity check.
- **Image2Lego, arXiv 2108.08477.** image → voxel → LEGO directly (skip the lossy smooth-mesh round-trip).

## Stability (optional rigor upgrade) — `legolizer/stability.py`
- **StableLego (Liu et al., IEEE RA-L 2024, arXiv 2402.10711).** Rigid Block Equilibrium; per-brick stability score V_i ∈ [0,1); ~1s/solve; weakest-brick heatmap. Open code: https://github.com/intelligent-control-lab/StableLego
- **LegoGPT / BrickGPT (Pun et al., CMU 2025, arXiv 2505.05469, MIT).** Text→stable buildable LEGO; rejection sampling + physics-aware rollback; 47k-structure dataset. Text-only & no architecture class → our `legoarch` front end fills that gap. https://avalovelace1.github.io/BrickGPT/
- For the seminar, a **simplified** support/center-of-mass + single-connected-component check is acceptable; cite the above and label ours an approximation.

## Color — `legolizer/color.py` *(implemented)*
- Per-brick colour is assigned explicitly (stability/voxel tools are colourless). We sample the **TRELLIS mesh's real colour** per voxel, **exposure/white-balance it to the FLUX render** (the mesh texture reads darker than the render), then map each footprint to the nearest real LEGO colour via **CIEDE2000**. A deterministic legoarch-palette heuristic is the fallback for untextured meshes. Without colour matching, output is grey rubble.

## Toolchain / export — `legolizer/ldraw.py`
- **LDraw** open format (`.ldr`/`.mpd`). **BrickLink Studio** imports LDraw, validates parts/inventory/price, auto-generates instruction PDFs; its **Sculpture** feature converts OBJ/STL→bricks (the off-the-shelf baseline we intentionally go beyond). https://www.bricklink.com/v3/studio/download.page · https://studiohelp.bricklink.com/hc/en-us/articles/6508264220183-Sculpture
- **LSculpt** — open-source mesh→LDraw "studs-out" voxelizer (reference implementation).

## Differentiation / framing
- Prior MaCAD images-only project: https://blog.iaac.net/lego-set-a-generative-ai-approach/
- Same-course interface precedent ("ARchitect", FLUX+LoRA+UI): https://blog.iaac.net/architect/
- Evaluate with **buildability metrics** (stable %, brick count, connectivity), not FID/CLIP (FID misses structural plausibility — arXiv 2403.05352).

## Far-future / optional neuro tab (not in core scope)
- Valentine & Wilkins, "Visual Discomfort in the Built Environment", Buildings 2025, 15(13):2208 — Fourier spatial-frequency analysis predicts facade visual stress (~3 cycles/degree danger band). https://www.mdpi.com/2075-5309/15/13/2208
- Fractal-dimension comfort sweet spot D≈1.3–1.5 (Taylor et al., Frontiers Hum. Neurosci. 2011).
- Note: these **predict** stress, they don't measure brains — would need "predicted/proxy" labeling and a pixel→cycles/degree conversion.
