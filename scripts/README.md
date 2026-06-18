# scripts/

One-off and re-runnable tooling. **Nothing here runs during the app** — these
generate catalog/asset data and the benchmark figures under
[`docs/benchmarks/assets/`](../docs/benchmarks/assets/).

> **Keep this folder flat.** Every Python script resolves the repo root as
> `Path(__file__).resolve().parents[1]` and the benchmark scripts cross-import
> (`from forge_examples import …` via `sys.path.insert(0, ROOT/"scripts")`).
> Run them from the **repo root**, e.g. `python scripts/build_catalog.py`.
> Moving a script into a subfolder breaks both the root math and the imports.

## Build tools — re-run when inputs change

| Script | Reads → Writes | When to run |
|---|---|---|
| `build_catalog.py` | Rebrickable CSVs + LDraw `LDConfig.ldr` (cached in `.cache/`) → `backend/app/catalog/catalog.json`, `frontend/src/lib/catalog.gen.json` | Once per new LEGO colour/part release |
| `sync_grammar.mjs` | `backend/app/prompt_grammar.json` → `frontend/src/lib/promptGrammar.gen.json` | After editing the prompt grammar |
| `build_parts.mjs` | LDraw parts → `frontend/public/parts/` | When the part set changes |
| `build_intro_assets.mjs` | source imagery → `frontend/src/intro-assets/` | When intro art changes |

## Benchmark & figure generators

These produce the figures referenced by [`docs/benchmarks.md`](../docs/benchmarks.md)
and [`docs/decisions-justified.md`](../docs/decisions-justified.md). The GPU ones
need both ComfyUI servers up; the CPU ones are deterministic and offline.

| Script | Role | GPU? |
|---|---|---|
| `forge_examples.py` | End-to-end canonical figure for one building; **shared `EXAMPLES`/`NEGATIVE`/`SEED`** imported by the others | yes |
| `bench_buildings.py` | Full FLUX→mesh run over the three benchmark buildings | yes |
| `bench_seed.py` | Seed-robustness comparison | yes |
| `bench_axes.py` | Offline colour/scale axis sweep → `*_color.png`, `*_montage.png`, `*_axes.json` | no |
| `benchmark_runs.py` | Orchestration wrapper over the above | — |

### Historical / one-shot (kept for reproducibility, not part of the current flow)

- `bench_figures.py` — early montage builder, superseded by `bench_axes.py`.
- `bench_fill_modes.py` — fill-mode comparison from the voxel-density study.
- `forge_sagrada_variants.py` — research-phase prompt-variant explorer.
- `replay_color.py` — colour-lever sweep over an existing render/mesh corpus.
