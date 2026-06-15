# Design decisions, justified

The defense deck in one sentence: **GenAI proposes the form; deterministic
computation proves it's buildable; a real catalog proves it's real.**

Every decision below maps to **one** of those three beats, cites the **evidence**
that justifies it, and ends with the **one-line takeaway** for the slide. The
whole benchmark is run on the **same three example buildings** — **Sagrada
Família** (fame + LEGO set #21065), **La Muralla Roja** (colour story), and
**Guggenheim Bilbao** (the honest boundary) — so every axis is directly
comparable. Numbers trace to real runs; recipes in [benchmarks.md](benchmarks.md).

> We evaluate on **buildability** — single connected component, % supported, piece
> count, real part ids, validated colours — **not** FID/CLIP. A render is a
> proposal; a connected, supported, catalog-legal brick model is a proof.

---

## Slide map (lift straight into the deck)

| # | Slide | Beat | Decision | Figure | One-line takeaway |
|---|---|---|---|---|---|
| 1 | The pipeline | frame | Backend = single source of truth | [pipeline.svg](benchmarks/assets/pipeline.svg) | One thread: name → render → mesh → **solve into legal bricks** → real set. |
| 2 | FLUX defaults | ① propose | 28 / 5.0 / 1.0 / neg, A/B | [ab_*](benchmarks/assets/examples/) grids | Tuned for what the pipeline can use downstream, shown on all three. |
| 3 | Three buildings | ① propose | Selection + honest boundary | per-building montages | Two recognizable; Bilbao is the method's predicted boundary, shown on purpose. |
| 4 | Buildable & robust | ② prove | Connectivity + support | §4 stats | Every example is **one connected mass, ~93–95 % supported**. |
| 5 | Coherent colour | ② prove | Track-B denoise | [colour montages](benchmarks/assets/examples/) | One blur: **−19 to −46 % pieces, no stability loss**. |
| 6 | Detail per set | ② prove | Voxel scale | [scale montages](benchmarks/assets/examples/) | Piece budget scales with detail — 2k draft → 22k flagship. |
| 7 | Seed-robust | ② prove | Seed consistency | seed-cmp montages | Stable across seeds — not a single-seed fluke. |
| 8 | Real, not simulated | ③ real | Catalog + colour clamp | §10 | Every part is a real id in a colour its mould exists in. |
| 9 | Contribution | ③ real | Slopes + Testuz repair | §10 | First open slope-aware legolizer, vs the 1×1 Studio baseline. |

---

## Frame — backend as the single source of truth

**Decision.** The FastAPI backend owns the brick layout; the frontend renders
exactly what it returns and never invents geometry. The smooth TRELLIS mesh is an
*internal* step, not the product.

**Why.** Buildability is a property of a specific, deterministic brick model — not
of a render or a mesh. One authority, one artifact, one set of metrics, fully
reproducible.

**Evidence.** [pipeline.svg](benchmarks/assets/pipeline.svg) — the whole flow,
banded to the three beats. Source Mermaid in [architecture.md](architecture.md).

**Takeaway.** *The render is a proposal; the backend's connected, supported,
catalog-legal brick model is the proof.*

> **ADR — single source of truth.** *Decision:* the backend legolizer is the sole
> producer of brick geometry; the client is a pure renderer. *Consequences:* every
> set carries its recipe; metrics computed once, server-side; the UI can't drift
> from the buildable truth. *Rejected:* client-side voxelizing (fast to demo,
> impossible to defend as reproducible).

---

## ① GenAI proposes the form

### Decision 1 — FLUX defaults (steps 28 / CFG 5.0 / LoRA 1.0 / negative ON)

**Decision.** Generate with FLUX.2 Klein **base** at 28 / 5.0 / 1.0, negative on.

**Why.** A one-axis-at-a-time A/B (winner carried forward), now run on the three
example buildings so the effect is visible on the real product. Klein base is
undistilled, so real CFG and negatives apply — the negative prompt biases toward
the chunky single-mass massing that survives image-to-3D.

**Evidence.** [benchmarks §3](benchmarks.md) — four grids (steps / CFG / LoRA /
negative), rows = buildings, winner ringed.

**Takeaway.** *Settings tuned for what the pipeline can use downstream — chunky
massing that voxelizes cleanly — not for prettier pixels.*

### Decision 2 — the three example buildings (selection + the boundary)

**Decision.** Sagrada Família, La Muralla Roja, Guggenheim Bilbao — and keep
Bilbao's failure visible.

**Why (selection).** Each is famous (LoRA-recognizable) with **fused, continuous
massing** worded to survive voxelization, a distinct **colour story**, and (for
Sagrada) a real **LEGO Architecture set**. Bilbao is the deliberate stress: smooth
Gehry curves.

**Evidence.** [benchmarks §4](benchmarks.md) — end-to-end montages + stats: Sagrada
4,682 pc / ✓ / 0.95; Muralla 7,343 / ✓ / 0.95; Bilbao 5,830 / ✓ / 0.93.

**Takeaway.** *Two read instantly; Bilbao reconstructs as a connected but
unrecognizable metallic blob — the **predicted boundary** of voxel-based
legolization. Showing it proves we know where the method ends.*

> **Bilbao framing:** present as a *predicted* limitation ("curvature voxelization
> can't preserve"), never "sometimes it breaks." The failure is evidence of rigor.

---

## ② Deterministic computation proves it's buildable

### Decision 3 — solid fill + buildability robustness (the headline)

**Decision.** Voxelize **solid** by default; report connectivity + support per build.

**Why.** Buildability is binary: a set must be one connected, supported mass.
Solid fill is the connectivity guarantee — transformative on pathological
hollow-shell reconstructions, a harmless no-op on well-formed massings.

**Evidence.** [benchmarks §4 + §6](benchmarks.md): **all three buildings are a
single connected component at ~93–95 % support**, with or without fill (fill is
−3.6 % / −0.5 % / +6.2 % pieces — near-neutral here). Floating fragments are
re-grounded by Testuz-style pillar repair.

**Takeaway.** *Every example comes out as one connected, ~95 %-supported, buildable
mass — robustly, not by luck.*

> **ADR — fill vs shell.** *Default = solid fill* (connectivity guarantee). On
> solid massings it's piece-neutral; on hollow reconstructions it's the safety net
> that seals connectivity. The optional **Hollow** dial is the inverse (erode a
> solid massing to shed invisible interior bricks) — a UX option, not a competing
> result. *Note:* the dramatic piece-savings from filling only appear on genuinely
> hollow reconstructions; on these well-formed buildings the buildability story is
> **robustness**, not piece reduction.

### Decision 4 — the Track-B colour denoise

**Decision.** Denoise per-voxel colour (`rgb_blur_iters=1`, `smooth_iters=2`,
`merge_tol=15`) before quantization.

**Why.** TRELLIS chroma speckle survives exposure-matching and shatters the build
into 1×1 confetti. A masked blur dilutes specks onto the local dominant. Tuned on
**M3/shatter** (piece & colour counts); **M1** (CIEDE2000 palette-share) is the
no-regression floor.

**Evidence.** [benchmarks §5](benchmarks.md): Sagrada **−46 %** pieces, Bilbao
**−29 %**, Muralla **−19 %**; connectivity & support unchanged; M1 held within
~0.04. Before/after montages per building.

**Takeaway.** *One blur turns colour confetti into a coherent palette and sheds
19–46 % of the pieces — with no loss of structural stability.* **Slide rule:** lead
with the before/after image; name M1/M2/M3 as corroboration.

> **ADR — colour pipeline (two layers).** *Layer 1:* quantile exposure-match fixes
> the dominant tone. *Layer 2:* the Track-B denoise removes the residual speckle.
> Tuned on shatter; M1 is the floor. *Rejected:* merge-tolerance alone (barely
> fires on the classic palette — colours sit ~38 ΔE apart) and 3-D code smoothing
> (washes M1).

### Decision 5 — detail per set (the scale axis)

**Decision.** Default voxel target 32 studs; expose 16–64 as the detail dial.

**Why.** Detail sets the brick budget; piece count scales ~quadratically while the
silhouette resolves from blocky to crisp. Different building types want different
defaults; one dial covers draft → flagship.

**Evidence.** [benchmarks §7](benchmarks.md): detail 24 → 2.2–3.6k pieces (draft),
32 → 4.7–7.3k (a buildable set), 48 → 15–22k (flagship). Build-elevation montages
at 24 | 32 | 48 per building.

**Takeaway.** *One dial spans a quick draft to a 21k-piece flagship; 32 is the
buildable default.*

### Decision 6 — seed robustness

**Decision.** Validate the winning config at a second seed (2002).

**Why.** A defensible result must not be a single-seed cherry-pick.

**Evidence.** [benchmarks §8](benchmarks.md) — each building re-forged at seed
2002, render + build + piece count beside seed 1001.

**Takeaway.** *The pipeline produces a consistent, buildable set across seeds — the
result is the method, not the seed.*

---

## ③ A real catalog proves it's real

### Decision 7 — the Rebrickable catalog + buildable-colour clamp

**Decision.** Every part is a real BrickLink/LDraw id; every brick's colour is
clamped to a colour that mould actually exists in (`elements.csv`), matched by
CIEDE2000.

**Why.** "Buildable" must mean *orderable*. A correct geometry in a colour the part
was never produced in is not a real set — the catalog is the third leg of the
thesis.

**Evidence.** [benchmarks §10](benchmarks.md): 48 colours / 44 parts / 1,598
validated part+colour combos; Rebrickable CSVs cross-validated against LDraw
`LDConfig.ldr` (caught Olive Green 326≠330, Nougat).

**Takeaway.** *Order the parts list tomorrow — every id and colour is one a real
LEGO mould was made in.*

### Decision 8 — the open-source contribution (vs baselines)

**Decision.** Slope-aware legolization (45° family, course-space staircase
detection) + Testuz-style connectivity repair on a Luo-2015 split-and-merge core.

**Why (framed against baselines).** The honest baseline is **BrickLink Studio's
Sculpture tool**: 1×1 studs only, no stability. **Zhou & Chen 2019** (CGF) describe
slope-aware legolization but **release no code** — ours is the **first open
implementation**. Testuz 2013 repair is a cheap post-pack pass.

**Evidence.** [benchmarks §10](benchmarks.md) + [legolizer-research.md](legolizer-research.md);
slopes are active in every build figure.

**Takeaway.** *Not a wrapper around a converter: the first open slope-aware,
connectivity-repaired legolizer — measured against the 1×1 Studio baseline.*

---

## What is deliberately NOT on the slides (scope discipline)

- **The full M1/M2/M3 sweep table** → corroboration under the colour slide; the
  before/after image is the argument.
- **FID / CLIP** → out of scope by design; buildability metrics are the thesis.
- **The −73 % "hollow→solid fill" stat** → cut. It only appears on a pathological
  disconnected-shell mesh, which none of the three real buildings produce; the
  honest buildability story here is **robustness** (§4/§6), not piece reduction.
- **Abandoned test prompts + presets** (brutalist/FLV/habitat, stock/fullmesh/…)
  → deleted; the benchmark now lives entirely on the three example buildings.

Everything kept earns a slide because it justifies a decision.
