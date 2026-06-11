# Legolizer engine research — survey & roadmap

Companion to [research.md](research.md). Written alongside the plate-engine
upgrade (June 2026): grid z moved to **plate units** (1 cell = 3.2 mm, 3 plates
= 1 brick), the packer became a three-pass mixed-height greedy (bricks →
plates → top tiles), and colour is quantized to the LEGO palette **before**
packing so pieces respect colour boundaries. This doc records what else is out
there, what we adopted, and what is deliberately deferred.

## 1. Our baseline

`backend/app/legolizer/bricks.py` — greedy per-layer split-and-merge in the
spirit of Luo et al. 2015: raster-order anchoring, largest-footprint-first
with a **soft running-bond penalty** (walls are discouraged from stacking on
the joints below) and ~12% controlled randomness, all seeded and
deterministic. Coverage is exact (1×1 plate terminal fallback). What it does
NOT do: any global objective — no force model, no connectivity-aware
re-merging, no iterative refinement.

The plate upgrade follows **Kim et al., "Legorization with multi-height
bricks from silhouette-fitted voxelization" (CGI 2017)** — the direct academic
precedent for mixing brick- and plate-height pieces on a plate-unit grid. It
also fixed a latent geometry bug: cubic voxels were previously exported at
brick height (9.6 mm), vertically stretching every model 1.2×.

## 2. Academic approaches

| Approach | What it does better than ours | Integration cost | Verdict |
|---|---|---|---|
| **Luo et al. 2015**, *Legolization: Optimizing LEGO Designs* (ACM TOG / SIGGRAPH Asia) | Force-based stability analysis + simulated-annealing layout refinement around the weakest joints — provable-ish buildability for big sculptures | High: physics solver + iterative re-merge loop (seconds–minutes per model) | **Hook, don't implement.** `options.refine_iters` is reserved; the packer's 3D `ids` grid is exactly the interface a future refiner would mutate. |
| **Testuz, Schwartzburg, Pauly 2013**, *Automatic Generation of Constructable Brick Sculptures* (EPFL / Eurographics short) | Brick-graph analysis: detect disconnected components and articulation (single-point-of-failure) bricks, then re-merge locally across weak seams | **Low** — operates on the piece list + adjacency we already implicitly have | **Adopt next.** Directly fixes the rare `connected: false` outputs; cheap post-pack pass. |
| **Kim et al. 2017**, *Legorization with multi-height bricks* (CGI) | Multi-height packing (validates our plate grid); silhouette-fitted (deformed) voxelization hugs curved facades | Plate part: done. Silhouette-fitting: medium | Plate grid **implemented**; silhouette-fitting is a v2 idea for curved subjects. |
| **StableLego (2024)**, arXiv 2402.10711 | Per-brick rigid-block-equilibrium stability score (force distribution, not just support ratio) | Medium: LP solve per model | Upgrade path for `stability.py`; already cited there. |
| **LegoGPT / BrickGPT (2025)**, arXiv 2505.05469 | Generates designs directly from text with physics-aware rollback | Different paradigm (generator, not packer) | Ecosystem context only — our thesis is *deterministic* proof of buildability, so a neural packer would undercut the argument. |

## 3. Open-source / tooling

- **brickr** (R, ryantimpe) — per-layer greedy with an offset-seam heuristic,
  no stability analysis. Confirms our baseline is state-of-practice for
  mosaics/voxel models; nothing to lift.
- **LSculpt** — studs-out *surface shell* voxelizer (different goal: hollow
  panel sculptures, not solid architecture massing).
- **Image2Lego** (arXiv 2108.08477) — image→voxel→brick pipeline; the brick
  step is 1×N greedy, weaker than ours.
- **BrickLink Studio "Sculpture" tool** — the off-the-shelf baseline: 1×1
  studs only at our scale. We beat it by construction; Studio remains our
  *validator* (LDraw import checks part ids and joints).
- **Mecabricks** — renderer/ecosystem, not a packer.

## 4. LEGO Architecture techniques (the design language)

What the official sets actually do, and where we stand:

1. **Plate & tile layering** — terraces, rooflines and plazas built from
   1-plate steps finished with studless tiles. **Implemented** (pass 3
   tile-swap, `tile_tops` on by default).
2. **1×1-plate facade texture** — micro-relief on tower facades. Possible
   future: keep the top *two* plate skins out of brick bodies for relief.
3. **Slopes** — used sparingly in real Architecture sets (the look is mostly
   stepped plates, e.g. Trevi Fountain, Louvre). Slope *detection* from voxel
   data needs course-level staircase fitting + oriented parts in two LDraw
   exporters and three renderers. **Deferred to v2**; the pass structure
   leaves room for a "pass 1.5".
4. **SNOT (studs-not-on-top)** — sideways building. Breaks the axis-aligned
   grid assumption in every module. **Out of scope.**

## 5. Adopted / deferred summary

- ✅ **Adopted now:** plate-unit grid + mixed-height packing (Kim 2017),
  tile finishing, colour-quantize-before-pack (CIEDE2000), anisotropic
  voxelization fixing the 1.2× stretch.
- ⏭ **Next (small):** Testuz-style post-pack connectivity repair — build the
  piece adjacency graph from `ids`, find components/articulation pieces,
  locally re-merge across the weak seam.
- 🧊 **Hooked, not built:** Luo simulated-annealing refinement
  (`options.refine_iters`), StableLego force-based stability, silhouette-
  fitted voxelization, slopes.

## Sources

- Luo, Yu, et al. *Legolization: Optimizing LEGO Designs.* ACM TOG 34(6), 2015. https://dl.acm.org/doi/10.1145/2816795.2818091
- Testuz, Schwartzburg, Pauly. *Automatic Generation of Constructable Brick Sculptures.* Eurographics 2013 (short). https://infoscience.epfl.ch/entities/publication/2f9a0aa6-bf62-4b40-9cb3-e43ca49c3f1a
- Kim, et al. *Legorization with multi-height bricks from silhouette-fitted voxelization.* CGI 2017. https://dl.acm.org/doi/10.1145/3095140.3095180
- StableLego: arXiv 2402.10711 · BrickGPT: arXiv 2505.05469
- brickr: https://github.com/ryantimpe/brickr · LSculpt: https://lsculpt.sourceforge.net · Image2Lego: arXiv 2108.08477
