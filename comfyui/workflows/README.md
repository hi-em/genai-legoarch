# ComfyUI workflows

The canonical, trained assets live in [`../../references/`](../../references/):

| File | Role |
|---|---|
| `legoarch.safetensors` | Trained FLUX.2 LoRA (trigger word: `legoarch`) — LEGO-Architecture style |
| `05_FLUX.2_LoRA.json` | FLUX.2 + LoRA text-to-image workflow |
| `FLUX.2_image-to-image_LoRA.json` | FLUX.2 + LoRA **img2img** (LoraLoader + VAEEncode + ReferenceLatent) |
| `3D.json` | TRELLIS-2 image→3D (emits a `voxelgrid_npz` intermediate we reuse for legolization) |

The API-format graphs the backend actually submits live here:

| File | Role |
|---|---|
| `flux_txt2img.api.json` | FLUX.2 + legoarch txt2img (a `StringConcatenate` node prepends the `legoarch` trigger) |
| `flux_img2img.api.json` | FLUX.2 + legoarch img2img |
| `trellis_3d.api.json` | TRELLIS-2 image → textured 3D mesh, exported as GLB |

## Backend integration notes
- The backend (`app/comfy_client.py`) talks to two running **ComfyUI** servers over HTTP (`COMFYUI_URL` :8188 for FLUX, `COMFYUI_3D_URL` :8189 for TRELLIS).
- It loads each `*.api.json`, prunes to the LoRA branch, and overrides **prompt / seed / steps** (FLUX) and the **TRELLIS preset** (ss/shape/tex steps, decimation, texture size) by node id — all env-overridable (`FLUX_STEPS`, `TRELLIS_*`).
- `Trellis2ExportGLB` writes the `.glb` to `COMFYUI_3D_OUTPUT`; the backend reads it back, **voxelizes the mesh** and **samples its texture per voxel** for LEGO-colour matching (kept the texture deliberately — it's what the colours read from).

## Setup checklist
- [x] ComfyUI installed with FLUX.2 base model
- [x] `legoarch.safetensors` placed in `ComfyUI/models/loras/`
- [x] TRELLIS-2 custom nodes installed
- [x] API-format workflows exported here as `*.api.json`
