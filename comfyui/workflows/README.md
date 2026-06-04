# ComfyUI workflows

The canonical, trained assets live in [`../../references/`](../../references/):

| File | Role |
|---|---|
| `legoarch.safetensors` | Trained FLUX.2 LoRA (trigger word: `legoarch`) — LEGO-Architecture style |
| `05_FLUX.2_LoRA.json` | FLUX.2 + LoRA text-to-image workflow |
| `FLUX.2_image-to-image_LoRA.json` | FLUX.2 + LoRA **img2img** (LoraLoader + VAEEncode + ReferenceLatent) |
| `3D.json` | TRELLIS-2 image→3D (emits a `voxelgrid_npz` intermediate we reuse for legolization) |

## Backend integration notes
- The backend talks to a running **ComfyUI** over its HTTP/websocket API (`COMFYUI_URL`, default `http://127.0.0.1:8188`).
- We submit these workflows as **API-format** graphs (ComfyUI → *Save (API Format)*) with prompt/image/seed parameterized. Put the API-format exports here as `*.api.json` when ready.
- TRELLIS node `Trellis2ShapeToTexturedMesh` exposes a `voxelgrid_npz` output — prefer it over re-voxelizing the smooth mesh.

## Setup checklist
- [ ] ComfyUI installed with FLUX.2 base model
- [ ] `legoarch.safetensors` placed in `ComfyUI/models/loras/`
- [ ] TRELLIS-2 custom nodes installed
- [ ] Export each workflow in **API format** and drop it here
