# Roadmap & milestones

Milestones with a **ruthless cut order** so a polished demo always exists.

| # | Milestone | Deliverable | Status |
|---|---|---|---|
| **M0** | Scaffold & week-1 insurance | Repo + folders; ComfyUI reachable from FastAPI; React shell with LEGO skin; end-to-end **photo+prompt → legoarch image** in the app | 🚧 in progress |
| **M1** | Flow 1 (3D + Exit 1) | Wire TRELLIS; three.js viewer; **download STL** | ⬜ |
| **M2** | Custom legolizer (Exit 2) — **THE CORE** | voxelize → split-and-merge bricks → CIEDE2000 color → connectivity/stability → **LDraw + parts list + instructions**; brick model in viewer | ⬜ |
| **M3** | Fun layer (must-have) | LEGO skin polish; **Collection Shelf** persistence | ⬜ |
| **M4** | Playground (nice-to-have) | Mashup / restyle / sectional-axo detail / recolor | ⬜ |
| **M5** | Stretch (decide later) | Make-it-stand mini-game · physical build validation · neuro tab | ⬜ |
| **M6** | Deliverables | `research.md` writeup · README + demo GIF · crit deck | ⬜ |

**Cut order if time runs short:** drop M5 → M4 first. **Never** cut M0–M2 (spine) or M3 (skin + shelf).

## API contract (lock early — biggest scope-saver)

| Endpoint | In | Out |
|---|---|---|
| `POST /generate-image` | `{prompt, image?, lora_scale?}` | `{image_url}` |
| `POST /generate-3d` | `{image_url}` | `{stl_url, voxelgrid_npz_url, glb_url}` |
| `POST /legolize` | `{voxelgrid_npz_url \| stl_url, options}` | `{brick_model, stability, parts_list}` |
| `POST /export` | `{brick_model}` | `{ldr_url, instructions_url, parts_csv_url}` |
| `GET/POST /shelf` | creation CRUD | shelf items |

`brick_model` schema (draft): `{ bricks: [{ part, x, y, z, color, rot }], grid: {nx,ny,nz}, unit_mm }`.

## Open items
- GitHub username + final repo name (for the public repo).
- Keep make-it-stand mini-game in M5 or promote it.
- Physical build vs Studio-simulated validation.
