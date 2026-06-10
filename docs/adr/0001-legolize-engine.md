# ADR 0001 — Legolize engine: custom in-app vs BrickLink Studio Sculpture

- **Status:** Accepted
- **Date:** 2026-06
- **Deciders:** Emilie El Chidiac, Charles Abi Chahine

## Context
"Exit 2" converts a generated 3D model into a buildable brick set. Two viable paths:
1. **BrickLink Studio "Sculpture"** — a free, built-in mesh(OBJ/STL)→bricks converter that also makes instructions + parts lists. Reliable, but a **manual desktop step**, not integrated, and (being off-the-shelf) adds little novelty.
2. **Custom legolizer in-app** — our own voxelize → split-and-merge → color → connectivity/stability → LDraw pipeline, runnable from the backend API.

## Decision
Build the **custom legolizer** as the core, integrated, novel contribution. Keep Studio as an **optional downstream polish** step (open the exported `.ldr` to render photoreal instructions / validate real part availability + price).

## Rationale
- The seminar rewards an **original computational artifact**; wrapping a one-click tool does not.
- Integration matters for the UX (live brick view in the same app, no manual export/import).
- We can reuse published algorithms (Luo 2015 split-and-remerge; StableLego stability; CIEDE2000 color) — *reuse the math, own the integration + the architecture-domain application.*

## Consequences
- More engineering (voxel grid handling, brick-layout legality, LDraw writer). Mitigated by starting from the **TRELLIS `voxelgrid_npz`** intermediate and a **simplified** stability check.
- Must implement explicit per-brick color (CIEDE2000) or output looks grey.
- Studio remains the validation oracle: a generated `.ldr` that opens + passes Studio's Connectivity Check is our buildability proof.

## Revisit if
- Custom legolizer quality blocks the demo → fall back to Studio Sculpture while keeping the custom path as the research contribution, clearly labeled.

## Outcome (2026-06) — implemented
- The custom legolizer shipped and is the **single source of truth** for the brick layout (`backend/app/legolizer/`): real Luo-2015 greedy split-and-merge into legal footprints (1×1…2×4) with running-bond seam staggering, per-brick colour matched to the generated render (CIEDE2000 + exposure-match), connectivity/support stability, and LDraw/CSV export. A solid box correctly collapses to a few large bricks (≈80% fewer parts than a 1×1 baseline). Studio Sculpture was **not** used. Remaining upgrade: Luo's stability-driven refinement loop.
