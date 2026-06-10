# Roadmap & status

The spine is built end-to-end; what remains is rigor and polish.

| # | Milestone | Deliverable | Status |
|---|---|---|---|
| **M0** | Scaffold | Repo; ComfyUI reachable from FastAPI; React shell; **photo/prompt → legoarch render** in the app | ✅ done |
| **M1** | Generative 3D | FLUX render → **TRELLIS textured mesh** → voxelize | ✅ done |
| **M2** | Custom legolizer — **THE CORE** | real split-and-merge into legal bricks → **colour matched to the render** (CIEDE2000) → connectivity/stability → LDraw/CSV | ✅ done |
| **M3** | Experience | cinematic hero flow + **course-by-course assembly**; set-designer persona; **collection shelf** | ✅ done |
| **M4** | Trophies | **The Box** · **instruction booklet PDF** · **priced set** · **share card** | ✅ done |
| **M5** | Workflow tuning | FLUX 50→28 steps; TRELLIS steps/decimation/texture; colour exposure-match | ✅ done |
| **M6** | Rigor upgrades (next) | stability-driven **refinement loop** (re-merge weakest region); wider footprint/plate catalog; real BrickLink price proxy | ⬜ next |

## API contract (live)

| Endpoint | In | Out |
|---|---|---|
| `POST /generate-image` | `{prompt, image_b64?, seed?}` | `{imageUrl}` |
| `POST /generate-3d` | `{image_b64? \| image_url?, seed?}` | `{glbUrl, filename, voxel, brickModel}` |
| `POST /legolize` | `{voxelgrid_npz_url? \| stl_url?, image_url?, unit_mm, options}` | `brickModel` |
| `POST /set-copy` | `{subject, n_bricks, n_parts, n_colors, grid, support_ratio, connected}` | `{set_name, set_number, series, box_blurb, designer_quote, value_verdict, share_tagline}` |
| `GET /health` | — | `{ok, comfyui_url, comfyui_3d_url}` |

`brickModel` schema: `{ bricks: [{ part, x, y, z, color, rot, w, d }], grid: [nx, ny, nz], unit_mm, stability: { connected, n_components, support_ratio, n_bricks, unsupported_layers }, parts_list }`.

The backend is the single source of truth for `brickModel`; the frontend renders it directly (it attaches display hex + a colour-aware parts list, but does no layout).

## Open items
- Stability **refinement loop** (Luo's re-merge-weakest-region) to lift the support ratio on organic forms — currently a single greedy pass.
- Real BrickLink pricing via a backend OAuth proxy (today's "Priced set" is an honest estimate + a BrickLink search link).
- Optional: surface the smooth GLB again as a downloadable "souvenir" export if wanted.
