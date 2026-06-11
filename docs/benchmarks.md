# lEgoarCh — Generation benchmarks

**Date:** 2026-06-11 · **Base commit:** `e27ec48` · **GPU:** NVIDIA GeForce RTX 4090 Laptop (16 GB)
**ComfyUI:** 0.20.1 (image, :8188) / 0.22.0 (3D, :8189)

Every output shown in this project carries its full recipe: each thumbnail
below has a sibling `.json` in [benchmarks/assets/](benchmarks/assets/)
recording the model, prompt, seed, and every parameter — produced by
[scripts/benchmark_runs.py](../scripts/benchmark_runs.py), which drives the
exact production code path (`backend/app/comfy_client.py` → ComfyUI).

## 1. Fixed configuration

| Component | Value |
|---|---|
| Image model | `flux-2-klein-base-4b-fp8` (FLUX.2 Klein 4B, **base/undistilled** — real CFG applies, negative prompts active) |
| Text encoder / VAE | `qwen_3_4b_fp8_mixed` / `flux2-vae` |
| LoRA | `FLUX.2/legoarch.safetensors` — custom fine-tune on LEGO Architecture set photography; trigger word `legoarch` prepended in-graph |
| Sampler / scheduler | `euler` + `Flux2Scheduler`, 1024×1024 |
| 3D model | TRELLIS.2-4B (visualbruno ComfyUI wrapper), background removal on |
| Voxelizer | trimesh, anisotropic plate-unit grid (8 mm stud pitch / 3.2 mm plate), default 32 studs on the longest horizontal axis |
| Legolizer | three-pass split-and-merge (bricks → plates → top tiles), CIEDE2000 colour quantization, seam-stagger penalty 1.0, randomness 0.12 |

## 2. Method

Three canonical prompts (full text in [scripts/benchmark_runs.py](../scripts/benchmark_runs.py)):

- **P1 `brutalist`** — Brutalist tower with stepped setbacks: the prismatic best case.
- **P2 `flv`** — Fondation Louis Vuitton: the documented **stress case** (curved, translucent sails — great render, hostile to 3D reconstruction + voxelization; this is why it was removed from the UI example chips).
- **P3 `habitat`** — Habitat 67: terraced/stacked, the target aesthetic and the new prompt-enhancement reference.

Fixed seeds 1001 (primary) and 2002 (robustness). One axis swept at a time,
sequentially — the winner of each stage is carried into the next (19 image
runs total instead of a 108-run factorial). Judged on four criteria (0–2):
**silhouette cleanliness**, **LEGO-ness** (stud/seam read, plastic material),
**colour fidelity** (named palette appears and separates), **voxelization
survival** (clean massing at ~32 studs). Ties break toward faster settings.

## 3. Image parameter sweep (FLUX.2 Klein base + legoarch LoRA)

### Stage A — steps (cfg 4.0, LoRA 1.0, seed 1001)

| steps | time | P1 | P3 | notes |
|---|---|---|---|---|
| 20 | ~25–44 s | ![](benchmarks/assets/img_brutalist_seed1001_st20_cfg4p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st20_cfg4p0_lora1p0.png) | fine stud detail slightly soft |
| **28** ✓ | ~34 s | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg4p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg4p0_lora1p0.png) | crisp; indistinguishable from 40 |
| 40 | ~48 s | ![](benchmarks/assets/img_brutalist_seed1001_st40_cfg4p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st40_cfg4p0_lora1p0.png) | +14 s for no visible gain |

**Winner: 28.** Klein base converges early; composition is essentially fixed
by step 20, micro-detail saturates by 28. (P2 FLV runs are in assets/ —
beautiful sails, and exactly the thin translucent geometry that shreds
downstream, confirming its demotion to stress case.)

### Stage B — CFG (steps 28, LoRA 1.0)

| cfg | P1 | P3 | notes |
|---|---|---|---|
| 3.0 | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg3p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg3p0_lora1p0.png) | softer, slightly washed palette |
| 4.0 | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg4p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg4p0_lora1p0.png) | solid |
| **5.0** ✓ | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg5p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg5p0_lora1p0.png) | crispest geometry, cleanest grey/tan separation, no overcooking |

**Winner: 5.0.** Stronger palette separation directly improves the CIEDE2000
brick-colour matching downstream.

### Stage C — LoRA strength (steps 28, cfg 5.0)

| lora | P1 | P3 | notes |
|---|---|---|---|
| 0.75 | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg5p0_lora0p75.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg5p0_lora0p75.png) | surfaces smooth out — stud/seam texture fades |
| **1.0** ✓ | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg5p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg5p0_lora1p0.png) | full set-photography look, no artifacts |

**Winner: 1.0.** The LEGO-ness lives in the LoRA; 0.75 trades it for nothing.

### Stage D — negative prompt (steps 28, cfg 5.0, LoRA 1.0)

Negative: `people, trees, cars, vehicles, text, watermark, photograph of real
building, landscape, cluttered background, thin spires, antennas` — possible
at all because Klein **base** is undistilled (CFG > 1 is real).

| neg | P1 | P3 | notes |
|---|---|---|---|
| off | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg5p0_lora1p0.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg5p0_lora1p0.png) | |
| **on** ✓ | ![](benchmarks/assets/img_brutalist_seed1001_st28_cfg5p0_lora1p0_neg.png) | ![](benchmarks/assets/img_habitat_seed1001_st28_cfg5p0_lora1p0_neg.png) | chunkier, cleaner massing; stronger courses; best voxelization survival |

**Winner: on.**

### Stage E — seed robustness (winner config, seed 2002)

![](benchmarks/assets/img_brutalist_seed2002_st28_cfg5p0_lora1p0_neg.png)
![](benchmarks/assets/img_habitat_seed2002_st28_cfg5p0_lora1p0_neg.png)
![](benchmarks/assets/img_flv_seed2002_st28_cfg5p0_lora1p0_neg.png)

All three subjects hold style and quality on a fresh seed — the config is
robust, not a single-seed fluke.

## 4. TRELLIS.2 sweep (image → 3D → voxels → bricks)

Input: the Stage-D winning renders. Each run goes through the REAL
`/generate-3d` path, so the table includes voxelization survival and the
brick solve (plate engine, detail 32). Per-run JSON + GLB + voxel elevations
in assets/.

| run | preset | ss/shape/tex steps | guidance | max_tokens | decim/tex | time | voxels | bricks | connected | support |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 P1 | fast | 20/25/18 | 7.5 | 49152 | 40k/512 | 155 s¹ | — | 6655 | ✓ | 0.93 |
| T2 P1 | stock | 25/35/25 | 7.5 | 49152 | 200k/1024 | 123 s | — | 5548 | ✓ | — |
| T3 P3 | fast | 20/25/18 | 7.5 | 49152 | 40k/512 | 289 s² | 19 949 | 10 297 | **✗** | 0.82 |
| T4 P3 | stock | 25/35/25 | 7.5 | 49152 | 200k/1024 | 340 s² | 23 907 | 12 387 | ✓ | **0.99** |
| T5 P3 | low-guidance | 20/25/18 | 5.0 | 49152 | 40k/512 | 251 s² | — | 10 746 | **✗** | — |
| T6 P3 | half-tokens | 20/25/18 | 7.5 | 24576 | 40k/512 | 665 s² | — | 10 348 | **✗** | — |
| T7 P2 | fast (stress) | 20/25/18 | 7.5 | 49152 | 40k/512 | — | 16 913 | 7806 | **✗** (sails) | 0.83 |
| T8 P3 | hybrid (steps test) | 25/35/20 | 7.5 | 49152 | 40k/512 | 395 s | 20 204 | 10 100 | **✗** | 0.88 |
| T9 P3 | fullmesh (decimation test) | 20/25/18 | 7.5 | 49152 | **200k**/512 | 340 s | 24 836 | 12 555 | ✓ | 0.994 |
| T10 P3 | **fast + voxel `fill`** ✓ | 20/25/18 | 7.5 | 49152 | 40k/512 | = T3 + ~1 s CPU | 24 832 | **2 722** | ✓ | **0.996** |
| T11 P3 | stock + voxel `fill` (control) | 25/35/25 | 7.5 | 49152 | 200k/1024 | = T4 + ~1 s CPU | 24 033 | 2 728 | ✓ | 0.993 |

¹ includes model load/warm-up. ² ran contended with a concurrent FLUX job on
the same GPU — timings inflated, quality metrics unaffected.

**The decisive signal is connectivity, not looks.** Habitat's fast/stock
*silhouettes* are pixel-identical at 32 studs, but only stock's pipeline
yielded a connected build. The ablation chain:

- **T8 (stock steps, lean export): still disconnected** → sampling steps are
  NOT the lever.
- **T9 (fast steps, full 200k-face budget): connected** → the 40k-face
  simplification was severing the thin links between Habitat's offset cubes
  before voxelization. But fixing it mesh-side costs ~2 min and a 13 MB GLB.
- **T10/T11 (voxel-level `fill`): the dominant fix.** The voxelizer had
  always produced a hollow SHELL; filling the interior (instant CPU, no GPU)
  seals connectivity at any preset, lifts support to ~0.996, and — the
  surprise — **cuts pieces 73 %** (10.3k → 2.7k): a hollow shell forces thin
  1×1 skin everywhere, a solid core packs into big interior bricks, exactly
  like a real set. Adopted: **fast preset + fill=True** — fastest, smallest
  GLB (matters for the in-browser mesh/bricks compare slider), buildable.

Lower guidance (T5) and halved tokens (T6) rescue nothing. T7 documents why
Fondation Louis Vuitton was demoted from the example chips: the reconstructed
sails voxelize into disconnected fragments by nature, at any setting.
Trade-off accepted with `fill`: interior bricks are invisible but counted in
the parts list/pricing (as in real sets) and default to white.

## 5. Decisions (the "explain your data and workflows" narrative)

- **Steps 28** — Klein base saturates visually before 28; 40 costs 40 % more
  time for nothing the pipeline can use.
- **CFG 5.0** — the undistilled base rewards real guidance: sharper massing
  and better-separated named colours, which the CIEDE2000 matcher converts
  into more faithful brick palettes.
- **LoRA 1.0** — at 0.75 the model "un-LEGOs": studs and mortar seams fade.
  The fine-tune carries the entire product-photography look; run it at full.
- **Negative prompt on by default** — a free lever that only exists because
  the checkpoint is undistilled. It removes context clutter AND biases toward
  chunkier single-mass compositions — the best input for image-to-3D.
- **Prompt structure** — subject → "LEGO Architecture set" → massing →
  materials → named LEGO colours → studio tail. The tail (white background,
  3/4 elevated product shot) doubles as TRELLIS input conditioning. Prismatic
  subjects only in the UI chips; curved/translucent icons are stress cases.
- **TRELLIS preset: fast, with solid voxel fill** — buildability (connectivity)
  is the thesis metric. The ablations (T8–T11) showed it isn't bought with
  sampling steps or export budget at all, but at the voxel layer: a solid core
  instead of a hollow shell. That keeps the fast preset's ~3-minute runtime
  and 3 MB GLB while guaranteeing a connected, ~0.99-supported, 70 %-leaner
  brick model.
- **Colour matching: quantile, not mean** — TRELLIS textures bake shading and
  read dark + bimodal; mean-gain exposure matching let 57 % of a grey tower
  quantize to Black. Per-channel quantile matching of the voxel foreground
  onto the render foreground restored the true palette
  (`match_exposure`, backend/app/mesh_voxelize.py). Before/after on the
  brutalist model:
  ![](benchmarks/assets/color_meangain_elevation.png)
  ![](benchmarks/assets/color_quantile_elevation.png)

## 6. Final defaults

Encoded as env-overridable defaults in
[backend/app/comfy_client.py](../backend/app/comfy_client.py); UI ranges in
[frontend/src/hero/tinkerParams.js](../frontend/src/hero/tinkerParams.js).

| Parameter | Default | UI slider range |
|---|---|---|
| FLUX steps | 28 | 8–50 |
| FLUX CFG | 5.0 | 1–8 |
| LoRA strength | 1.0 | 0–1.5 |
| Negative prompt | on (env `FLUX_NEGATIVE`) | not exposed |
| TRELLIS ss/shape/tex steps | 20 / 25 / 18 | shape 15–40 |
| TRELLIS shape guidance | 7.5 | 3–10 |
| TRELLIS max_tokens / decimation / texture | 49152 / 40k / 512 | env only |
| Voxel target (brick detail) | 32 studs | 16–64 |
| Voxel fill (solid core) | **on** (`fill=True`, main.py) | not exposed |
| Legolizer randomness / seam weight | 0.12 / 1.0 | 0–0.5 / 0–2 |
