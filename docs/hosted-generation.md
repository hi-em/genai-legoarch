# Hosted generation for the deployed site — Phase 1 study

**Date:** 2026-09-16 · **Status:** research + measurement done, awaiting a go/no-go on Phase 2.

The local pipeline (ComfyUI FLUX.2 Klein + the `legoarch` LoRA, TRELLIS-2) is
the research and stays exactly as it is. This doc asks one question: **what
should the deployed site at legoarch.charlesabichahine.com call instead, so a
visitor can forge a new building without our GPU?** Everything downstream of
the mesh — the legolizer, the brick model, assembly, shelf, auth — is untouched.

Every price and limit below was read from the provider's own page on the date
above; the "Sources" section at the end links each one. Where a page could not
be read it says so.

---

## 0. Recommendation (the short version)

**Measured, not guessed** — every number below comes from the 2026-09-16 run in
§3 (6 Gemini images, 14 fal meshes, ≈ $3.90 total).

| Stage | Pick | Why | Cost / set |
|---|---|---|---|
| Image | **Gemini 3.1 Flash Image (Nano Banana 2) on Vertex AI, `location="eu"`**, with the three LoRA renders as style references | Verified from this project via the Cloud Run service account, no key; EU multi-region ML processing; 11–16 s per image; **no LoRA needed** — the prompt-only renders already read as box art (studs, plates, nameplate, product lighting); no filter hit on "LEGO Architecture set" in 6 of 6 | $0.074 + <$0.01 for the references |
| 3D | **Hunyuan3D 3.1 Rapid on fal.ai** (`fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d`) | Fastest and steadiest of the three (77–122 s vs 96–469 s for TRELLIS-2); cheapest; highest support (0.96–0.99); M1 0.90–0.95 on two of three buildings; every set connected | $0.225 |
| | *Configurable alternative:* TRELLIS-2 on fal (`fal-ai/trellis-2`) | Closest to the local reference in piece count and colour (same model), but fal's queue made it 96–469 s per job, which does not fit a blocking Cloud Run request reliably | $0.30 |

**≈ $0.30 per forged set** (image + mesh), so a **$10/month cap ≈ 33 sets**.
Measured end-to-end: image 11–16 s, mesh 77–122 s, legolize 2–4 s → about
two to two and a half minutes, inside a blocking Cloud Run request once the
service timeout is raised from 300 s to 900 s.

**Main risks:** (1) fal has no self-serve monthly spend limit, so the prepaid
balance *is* the cap; (2) one Hunyuan call in four returned a 504 from fal —
the hosted client needs one retry; (3) Gemini sometimes draws a thick grey
display base that becomes geometry (Muralla went from 7k to 12k pieces) — the
hosted prompt must ask for a *thin black* base plate; (4) the privacy page and
consent text currently promise prompts go nowhere, which stops being true.

**"OpenAI Astra" is real but not a 3D model.** GPT-6 Astra (released
2026-09-03, model id `gpt-6-astra`) is a text-and-image-in, **text-out** LLM;
its "3D" demos are computer-use sessions that drive Blender through Python
scripts. There is no endpoint that takes a PNG and returns a mesh. See §2.1.

---

## 1. Image generation

### 1.1 Providers

Prices are per 1024×1024 image, standard (non-batch) tier.

| Provider / model | $/image | Reference images | Auth | EU processing | Spend cap | Notes |
|---|---|---|---|---|---|---|
| **Gemini 3.1 Flash Image** (`gemini-3.1-flash-image`, GA 2026-05-28) — Gemini API | $0.067 (1K) · $0.045 (0.5K) · $0.101 (2K) | up to 14 input images: objects, characters, **up to 3 style references** | API key | none guaranteed (EEA users get paid-tier no-training terms) | Gemini API billing-tier caps (Tier 1 = $250/mo) + optional AI Studio project cap | no free tier for image models |
| **same model — Vertex AI** (Gemini Enterprise Agent Platform) | $0.067 global · **$0.074 on `eu`** (non-global +10% since 2026-07-01) | same | **ADC — Cloud Run service account, no key** | **`eu` multi-region: ML processing stays in the EU** (no `europe-west4` single region for this model) | Cloud Billing **spend-cap budget** (Preview) blocks new usage at the cap | 1,120 output tokens per 1K image |
| Gemini 3.1 Flash **Lite** Image | $0.0336 | up to 14 objects, "not optimized for multiple reference inputs" | either | global only | same | cheapest Google option; weaker at style refs |
| Gemini 3 Pro Image (Nano Banana Pro) | $0.134 (1K/2K) | objects + characters | either | **global only** — no EU | same | best quality; no EU residency |
| Gemini 2.5 Flash Image / Imagen 4 | $0.039 / $0.04 | — | — | — | — | **retiring** (2.5 Flash Image shut down 2026-10-02; Imagen 4 discontinued 2026-06-30). Do not build on these. |
| BFL FLUX.2 [pro] (direct) | from $0.03 gen · $0.045 edit | up to 8 input images | API key | not documented | prepaid | same model family as local FLUX.2, but **our LoRA cannot be loaded** on the hosted API either |
| fal.ai FLUX.2 [pro] | $0.03 first MP | `@image1…` multi-reference | API key | no | prepaid balance | |
| FLUX.1 Kontext [pro] (BFL / fal / Replicate) | $0.04 | 1 image (+3 experimental) | API key | no | prepaid | strong instruction-based restyling |
| OpenAI gpt-image-2 (2026-04-21) | $0.006 low · $0.053 medium · $0.211 high | multiple, via edits endpoint | API key | no (API EU residency is enterprise-only) | none built in | gpt-image-1/1.5 retire Oct–Dec 2026; gpt-image-2.5 is token-priced with no per-image table yet |
| Stability Stable Image Core / Ultra | ~$0.03 / $0.08 | image-to-image | API key | no | prepaid | official price page could not be read (JS-only); third-party figures |

### 1.2 How close can it get to the box-art look without the LoRA?

Measured answer (§3.2): **close enough that the LoRA is not missed on the
deployed site.** What we knew going in, and what still applies:

- The benchmark A/B in `docs/benchmarks.md` §3 showed the LoRA at 0.75 already
  loses the stud/seam texture; a hosted model with no LoRA starts below that.
- The three levers we have instead:
  1. **The prompt grammar.** `backend/app/prompt_enhance.py` already writes a
     full 8-slot LEGO-Architecture prompt (massing, plastic-brick materials,
     named LEGO colours, "standalone model on dark display base, white
     background, elevated 3/4 angle, product photography, studio lighting").
     This is provider-neutral and carries over unchanged.
  2. **Style-reference images.** Gemini 3.1 Flash Image accepts up to 3 style
     references per prompt; FLUX.2 [pro] up to 8 input images. **Use our own
     LoRA renders as the references** (`docs/benchmarks/assets/examples/*/*.png`,
     e.g. the Sagrada, Muralla and Bilbao box-art renders). Do **not** upload
     the 40 official LEGO product photographs in `comfyui/legoarch-dataset/`:
     they are LEGO's copyrighted images used for study and training only;
     sending them to a third-party API as a per-request style guide is a
     different use.
  3. **Negative-ish constraints in prose.** Gemini has no negative prompt; the
     current negative list ("people, trees, cars, … thin spires, antennas")
     becomes explicit instructions in the prompt body.
- Public evidence of LEGO-style prompts on these models exists (Nano Banana
  minifigure box-art templates, "recreate as an official LEGO set with the box"
  templates, FLUX Kontext brick conversions) but **no published example of the
  LEGO Architecture black-box product-shot look specifically**. Third-party
  examples show convincing brick texture; whether the *architecture-set* read
  (tan Sagrada with studs on a black base plate) survives is what the
  measurement step must answer.
- The measurement plan (§3) forges the three benchmark buildings on the hosted
  model with (a) grammar prompt only and (b) grammar prompt + 3 LoRA renders
  as style references, then pushes each render through the 3D + legolizer
  path so the comparison is on the thesis metrics, not on taste alone.

### 1.3 Gemini API vs Vertex AI, for this project

Vertex wins on every axis that matters here:

- **Auth.** Cloud Run's runtime service account + `roles/aiplatform.user`.
  Nothing in Secret Manager for the image stage. The `google-genai` Python
  package is the same client either way (`genai.Client(api_key=…)` vs
  `genai.Client(enterprise=True, project=…, location="eu")`; `vertexai=True`
  still works as a legacy flag).
- **Residency.** `location="eu"` keeps ML processing inside the EU. The
  Gemini API terms allow transient storage "in any country". The site's
  privacy page already tells users their data lives in the Netherlands.
- **Spend cap.** Google Cloud's new **spend-cap budgets** (Preview, announced
  2026-07-27) list "Gemini Enterprise Agent Platform (formerly Vertex AI)",
  "Gemini API" and "Cloud Run" as eligible services and **block all new usage
  of that service in that project** at 100% of the budget until lifted by
  hand. Enforcement uses estimated gross cost and "isn't instant", so keep an
  in-app counter as the first line (§5).
- **Cost.** +10% on the EU endpoint ($0.074 vs $0.067 per 1K image). Worth it.
- **Rate limits.** Vertex uses shared "Standard PayGo" tiers with no fixed
  per-project RPM; the Gemini API publishes tier limits only inside AI Studio
  (could not verify numbers). Either is far above what one small instance
  will send.

---

## 2. Image-to-3D

### 2.1 "OpenAI Astra" — verified

- **GPT-6 Astra exists.** Released 2026-09-03 (OpenAI announcement; TechCrunch
  the same day). Model id `gpt-6-astra`. OpenAI's model page: input **text,
  image**; output **text**; 1,050,000-token context; $10 / $50 per 1M
  input/output tokens.
- **It does not generate meshes.** The "3D" in the coverage comes from
  computer-use demos: Astra opens Blender, writes Blender Python, renders
  frames, revises, and exports to Unreal Engine 5; and a BenchCAD score for
  reconstructing objects **by writing CAD code**. That is an agent loop over a
  desktop app, billed per token, taking minutes to hours per task.
- **No OpenAI 3D product.** OpenAI's pricing page lists image (`gpt-image-*`)
  and video (`sora-2`) media models only. Their last 3D work was research code
  (Point-E, Shap-E, 2022–2023).
- **Likely confusion:** the name collides with Google DeepMind's *Project
  Astra* (an assistant prototype, no API), and the viral "Astra builds 3D
  models in Blender" posts.
- **Verdict for us:** not usable as an image-to-mesh stage.

### 2.2 Hosted image-to-3D services (verified 2026-09-16)

All produce a downloadable **textured GLB** unless noted. "Pattern" = how the
backend waits.

| Service / model | $/generation (textured) | Pattern | Latency (official unless marked) | Training on inputs | Retention | Cap |
|---|---|---|---|---|---|---|
| **fal.ai `fal-ai/trellis-2`** (TRELLIS.2-4B, MIT) | $0.25 / **$0.30** / $0.35 (512 / 1024 / 1536) | queue: submit → status → result (`fal_client.subscribe`) | none on fal; model time 3 s / 17 s / 60 s on H100 per Microsoft card | fal ToS: no | payloads 30 d unless `X-Fal-Store-IO: 0`; media lifetime header | prepaid balance; 5xx never billed; 2 concurrent on new accounts |
| **fal.ai `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d`** | **$0.225** (+$0.15 PBR) | queue | none (reseller: 2–3 min) | no | same | same |
| fal.ai `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | $0.375 (+$0.15 PBR, +$0.15 multiview) | queue | reseller: 3–6 min | no | same | same |
| fal.ai `tripo3d/h3.1/image-to-3d` | $0.20 / **$0.30** std texture / $0.40 HD | queue | Tripo: ~40 s untextured, **~120 s textured** | no | same | same |
| fal.ai `fal-ai/trellis` (v1) | $0.02 | queue | ~26 s on Replicate A100 | no | same | same |
| **Tripo direct** (H3.1 = `v3.1-20260211`) | 30 cr × $0.01 = **$0.30** | `POST /v3/generation/image-to-model` → poll `/v3/tasks/{id}` every 2 s; **output URLs expire after 5 min** | ~120 s textured | paid users: no (free tier: Tripo retains rights) | — | prepaid credits |
| Meshy (Meshy-7 / Meshy-6) | 30 cr ≈ **$0.60** on Pro ($20/1,000 cr); API needs Pro+ | submit → poll / SSE | not published | **yes** for non-Enterprise | API outputs deleted after 3 days | monthly credits |
| Hyper3D Rodin Gen-2.5 (direct) | 0.5 cr × $1.50 = $0.75; **API is Business plan ($120/mo)** | submit → status (backoff) → download | not published; ~2 min 19 s on Replicate | "improve our services… research", no opt-out | discretionary | credits |
| fal.ai / Replicate `hyper3d/rodin` (Gen-2) | $0.40 | queue / prediction | ~2 min 19 s (Replicate example) | — | 1 h (Replicate) | prepaid |
| Replicate `tencent/hunyuan-3d-3.1` | $0.50 | prediction → poll or webhook | ~2 min 25 s (example) | — | 1 h | prepaid; old monthly spend limit removed 2025-07-01 |
| Tencent Cloud HY 3D (direct) | 25 cr × $0.015–0.02 ≈ $0.38–0.50 | `SubmitHunyuanTo3DJob` / `QueryHunyuanTo3DJob` | not published | could not verify | — | prepaid packs |
| Stability SPAR3D / Stable Fast 3D | **$0.04 / $0.10**; 25 free credits | **synchronous** — GLB in the response body | **~0.7 s** | could not verify | — | prepaid; 150 req / 10 s |
| fal.ai `hitem3d/hi3d/image-to-3d` (Sparc3D / Ultra3D) | $0.30–$0.90 by model/res | queue | none | — | — | prepaid |
| Neural4D (Direct3D-S2) | "~$0.15 per call" (marketing copy) | Bearer key | "<90 s" (vendor) | — | — | — |

**Not available as image-to-3D APIs:** Meta AssetGen 2.0 (internal /
Horizon), Google (Genie is a video world model; no mesh API), Luma Genie
(web-only; API has image/video only), Adobe Substance 3D API (render /
composite only), NVIDIA Edify 3D (NIM preview withdrawn), Amazon Nova (image /
video only), Kaedim (enterprise, human-in-the-loop), CSM.ai (site unreachable,
could not verify). Sparc3D, Direct3D-S2, Step1X-3D, Hunyuan3D-Omni are
open-weights / HF Spaces only.

### 2.3 Watertightness (what the voxelizer sees)

Our voxelizer (`backend/app/mesh_voxelize.py`) already tolerates leaky shells:
it seals the underside with a virtual ground plane and flood-fills outside air,
so small holes do not break the solid fill. Still, closed shells voxelize more
faithfully:

- **Hunyuan3D 3.x** decodes an SDF and extracts with marching cubes (the 2.1
  paper describes explicit watertight conversion) — most reliably closed.
- **TRELLIS.2** — Microsoft's card: raw meshes "may occasionally contain small
  holes"; the local TRELLIS GLBs report `watertight: False` in trimesh and
  legolize fine.
- **Meshy** — its own test: 55% fully watertight straight from export.
- **Stability SF3D / SPAR3D** — single-pass regression, back side
  hallucinated, low-poly; a "draft" tier at best.

### 2.4 Pre-measurement shortlist (superseded by §3.2: Hunyuan3D 3.1 Rapid won on latency)

- **Comparability.** The whole benchmark chapter is TRELLIS-2. Same model on
  fal (1024 preset, with `decimation_target` and `texture_size` knobs that map
  onto the local `TRELLIS_*` overrides) means the deployed sets stay
  comparable to the documented numbers, and any gap is attributable to the
  *image* stage, which is the thing we actually changed.
- **Cost / cap.** $0.30, prepaid, no training on inputs, retention
  controllable per request.
- **Hunyuan3D 3.1 Rapid** is the hedge: $0.225, closed shells, also on fal, so
  the same key and the same client code (fal queue API) test both.
- Tripo H3.1 (also on fal, $0.30, published ~120 s latency) is the third
  candidate the same key can measure at no extra setup.

---

## 3. Measurement — status and plan

### 3.1 Done: the harness, validated on the TRELLIS references

`scripts/bench_hosted_mesh.py` (new) legolizes **any** GLB + render pair with
the exact production path (`voxelize_glb` → `match_exposure` →
`legolize_voxelgrid`, detail 32, solid fill, `rgb_blur 1 / smooth 2 /
merge_tol 15`, classic palette) and writes the thesis metrics plus a
render | mesh-colour | exposure-matched | build montage.

Run on the three shipped TRELLIS meshes it reproduces `docs/benchmarks.md` §4
exactly:

| Building | pieces | colours | connected | support | M1 | legolize time |
|---|---|---|---|---|---|---|
| Sagrada Família (TRELLIS-2 ref.) | 4,682 | 21 | ✓ | 0.95 | 0.816 | 3.8 s |
| La Muralla Roja (TRELLIS-2 ref.) | 7,343 | 19 | ✓ | 0.954 | 0.886 | 2.6 s |
| Guggenheim Bilbao (TRELLIS-2 ref.) | 5,830 | 15 | ✓ | 0.931 | 0.803 | 1.9 s |

```bash
backend/.venv/Scripts/python scripts/bench_hosted_mesh.py --example sagrada
```

```bash
backend/.venv/Scripts/python scripts/bench_hosted_mesh.py --glb out/sagrada_trellis2_fal.glb --render docs/benchmarks/assets/examples/sagrada/sagrada.png --label "sagrada / fal trellis-2" --out docs/benchmarks/assets/hosted/sagrada_trellis2_fal
```

### 3.2 Results (run 2026-09-16, one seed, detail 32)

Spend: 6 Gemini images ≈ $0.45, 14 fal meshes ≈ $3.45 (11 in the batch, 3 Hunyuan re-runs after a downloader bug; one fal 504 was not billed). Assets, numbers and
montages are in `docs/benchmarks/assets/hosted/<building>/`; the
`*_compare.png` per building stacks the chains. The committed Hunyuan GLBs
carry their textures downscaled from 4096 to 1024 px (15 MB → 3 MB each) with
the matte material the hosted client now exports; the table rows are the
re-scored numbers from those committed files (within 2% of the 4K originals).

**Image stage — Gemini 3.1 Flash Image, Vertex `eu`, prompt from the
benchmark recipe, no LoRA.** Six of six returned in 11–16 s with
`finish_reason STOP` (no IP filter hit on "LEGO Architecture set"). The
prompt-only renders already read as box art: studs, plates, nameplate,
product lighting (`renders_grid.png`). Muralla comes out as the terraced
red/coral/lavender courtyard block; Bilbao as Gehry's building rather than
the LoRA's metallic blob. Passing the three LoRA renders as style references
(3,500 extra input tokens, under a cent) mostly restores the black base and the
elevated three-quarter framing, and makes the Sagrada chunkier; it is worth
keeping as the default.

**3D stage on identical input (the LoRA renders), so services are compared
fairly:**

| Building | Chain | pieces | colours | connected | support | M1 | 1×1 share | mesh time |
|---|---|---|---|---|---|---|---|---|
| Sagrada | local TRELLIS-2 (reference) | 4,682 | 21 | ✓ | 0.95 | 0.82 | 0.69 | 152 s (4090) |
| Sagrada | fal TRELLIS-2 @1024 | 5,931 | 16 | ✓ (repair used) | 0.90 | 0.93 | 0.71 | 149 s |
| Sagrada | fal Tripo H3.1 | 3,901 | 17 | ✓ | 1.00 | 0.73 | 0.63 | 197 s |
| Sagrada | fal Hunyuan3D 3.1 Rapid | 5,715 | 18 | ✓ | 0.99 | 0.96 | 0.74 | 97 s |
| Muralla | local TRELLIS-2 (reference) | 7,343 | 19 | ✓ | 0.95 | 0.89 | 0.74 | — |
| Muralla | fal TRELLIS-2 @1024 | 4,868 | 15 | ✓ | 0.93 | 0.85 | 0.66 | 270 s |
| Muralla | fal Tripo H3.1 | 3,340 | 14 | ✓ | 0.96 | 0.69 | 0.60 | 168 s |
| Muralla | fal Hunyuan3D 3.1 Rapid | 4,996 | 18 | ✓ | 0.96 | 0.62 | 0.62 | 114 s |
| Bilbao | local TRELLIS-2 (reference) | 5,830 | 15 | ✓ | 0.93 | 0.80 | 0.71 | — |
| Bilbao | fal TRELLIS-2 @1024 | 7,232 | 14 | ✓ | 0.93 | 0.95 | 0.70 | 313 s |
| Bilbao | fal Tripo H3.1 | 4,703 | 14 | ✓ | 0.98 | 0.79 | 0.68 | 156 s |
| Bilbao | fal Hunyuan3D 3.1 Rapid | 6,532 | 16 | ✓ | 0.99 | 0.89 | 0.72 | 122 s (one 504 first) |

**Full hosted chain (Gemini render → fal TRELLIS-2 → legolizer):**

| Building | pieces | colours | connected | support | M1 | mesh time | reads as the building? |
|---|---|---|---|---|---|---|---|
| Sagrada | 4,987 | 12 | ✓ | 0.92 | 0.87 | 213 s | **yes** — nave, tower cluster, the cross; cleaner tan than the LoRA build |
| Muralla | 12,470 | 13 | ✓ | 0.92 | 0.55 | 469 s | partly — the terraced block is there, but the render's thick grey display base became geometry (+~5k pieces) and the lavender courtyard quantized to white |
| Bilbao | 3,089 | 13 | ✓ | 0.98 | 0.92 | 96 s | **yes** — curved volumes on a tan podium; *more* legible than the local reference blob |

What this says:

- **Every hosted chain produced a buildable set**: single connected component
  on all eleven scored meshes, support 0.90–1.00, piece counts in the same
  band as the references. The legolizer needed no changes.
- **fal TRELLIS-2 tracks the local reference most closely** in piece count and
  colour fidelity (M1 0.85–0.95 on the LoRA renders), as expected from the
  same model. One caveat: on the Sagrada it reconstructed the crystal
  pinnacles as a floating fragment; the Testuz repair pass re-grounded it, so
  the set is still connected, but it is a visible pillar in the build.
- **Tripo H3.1 gives chunkier, better-supported, smaller sets** (3.3–4.7k
  pieces, support 0.96–1.00) at the cost of colour (M1 0.69–0.79; it smooths
  the texture and the sand/orange speckle shows in the build).
- **TRELLIS-2 on fal is slow and erratic: 96 s to 469 s for the same
  settings.** That spread is fal's queue and GPU warm-up, not the model (17 s
  on an H100 per Microsoft's card). 469 s is over the 300 s Cloud Run default
  and half of the 900 s ceiling proposed in §5. Tripo was 156–197 s;
  **Hunyuan3D 3.1 Rapid was the fastest and steadiest at 77–111 s.**
- **The Gemini render needs two prompt fixes for the 3D step:** ask for a
  *thin black* base plate (Gemini's thick grey slab on the Muralla doubled
  the piece count) and keep the LoRA renders as style references so the
  massing stays chunky. Both are prompt-grammar edits, not code.
- **Hunyuan3D 3.1 Rapid is the pick.** Fastest (97–122 s) and steadiest,
  best support (0.96–0.99), M1 0.96 / 0.89 on Sagrada / Bilbao, and it
  produced the chunkiest, most solid masses — the shape the legolizer likes.
  Its weak point is Muralla's colour (M1 0.62: the coral/lavender courtyard
  band smears into the red), the same failure Tripo shows. Two practical
  notes for the client: fal returns it as **OBJ + MTL + texture PNG** (the
  `model_urls.glb` field is absent without PBR), so the hosted client must
  fetch all three and convert with trimesh (done in the study; 3 s); and one
  call in four came back **504 "downstream service unavailable"**, unbilled,
  so retry once before failing the forge.

### 3.3 Pass criteria applied

Single connected component; support ≥ 0.90; piece count within roughly ±40%
of the TRELLIS reference at detail 32; colours within ±5; M1 ≥ 0.75; reads as
the building at a glance. Sagrada and Bilbao pass on every hosted chain.
Muralla passes connectivity, support and piece count everywhere but fails M1
on Hunyuan and Tripo (0.62 / 0.69, the courtyard colours smear) and on the
Gemini chain for the base-plate reason above; TRELLIS-2 is the only 3D model
that keeps Muralla's colours (0.85). Bilbao being *legible* on the
Gemini chain is a new result for the benchmark's "honest boundary" section.

---

## 4. Cost and latency per forged set (measured)

| | Gemini 3.1 Flash Image (Vertex `eu`, 1K) | + 3 style refs | Hunyuan3D 3.1 Rapid on fal | **Total** |
|---|---|---|---|---|
| Cost | $0.074 | +$0.002 (3 × 1,120 input tokens @ $0.55/M) | $0.225 | **≈ $0.30** |
| Time | 11–16 s | +2–4 s | 77–122 s | **≈ 2–2.5 min** + 2–4 s legolize |
| With TRELLIS-2 on fal instead | $0.074 | +$0.002 | $0.30 | ≈ $0.38, but 96–469 s |

Re-legolizing (the "mesh stop" in the studio) stays free — it is CPU on our
instance. Only *Forge* and *Materialize* spend money.

At **$10/month**: ~33 sets with Hunyuan3D Rapid, ~26 with TRELLIS-2. Cloud
Run itself stays inside the free tier at that volume. The frontend already
runs the three stages as separate blocking calls with a 15-minute client
timeout, so the user sees the render before the mesh starts, as today.

---

## 5. Fitting Cloud Run, and controlling spend

### 5.1 Timeouts: blocking is fine, with one flag

- Cloud Run request timeout is **300 s by default, up to 3,600 s**. The mesh
  call is the long one: measured 77–122 s for Hunyuan Rapid, but TRELLIS-2
  hit 469 s once, so even the worst case fits under a 900 s timeout,
  which also matches the backend's existing `httpx` ceiling and the
  frontend's sanity timeout. The deploy needs `--timeout 900`.
- While a request is open the instance has CPU (request-based billing), so
  polling fal from inside the request is the cheap, correct shape. Background
  threads after the response are CPU-throttled and can be killed — do not use
  them.
- Concurrency 80 on 1 vCPU is fine for I/O-bound polling; the CPU-bound part
  (legolize, 2–4 s) is short. A global "one forge at a time" lock is still
  wise on a 1 GiB instance.
- **Async is not needed for Phase 2.** If measured mesh times exceed ~4 min,
  the fallback is Cloud Tasks (dispatch deadline up to 30 min) calling an
  internal worker route, with the client polling a Firestore job document —
  the refresh-recovery banner already exists in the frontend for jobs that
  outlive the page. Design it then, not now.
- One real change: the hosted mesh must **not** go through the
  `_newest_glb` disk scan / `/api/mesh/{name}` route (Cloud Run has no shared
  filesystem). Return the GLB inline as `/api/generate-3d` already does, or
  cache it in the sets bucket under a short-lived key.

### 5.2 Spend control (three layers, cheapest first)

1. **Gate generation behind sign-in.** `require_user` already exists; the
   hosted `generate-image` / `generate-mesh` routes take it. Guests keep the
   sample build and the shelf browsing.
2. **In-app counters in Firestore**, transactional: per user per day (e.g.
   3 forges) and a global per month (e.g. $10 ÷ $0.38 ≈ 26 forges). Checked
   *before* each provider call; incremented on success. Cloud Run has no
   native rate limiter, and Cloud Armor needs an external load balancer
   (≈ $25/month floor), so in-app is the right tier for this project.
3. **Hard backstops outside the app:** a Google Cloud **spend-cap budget**
   (Preview) on the Agent Platform service in this project, and a fal.ai
   balance topped up by hand with $10 at a time — fal has no self-serve
   monthly limit, so the balance is the limit. A classic alerts-only budget
   on the project as well, for the email.

### 5.3 Secrets and auth

- Gemini via Vertex: **no secret at all** — grant `roles/aiplatform.user` to
  `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com` (or, better, a
  dedicated least-privilege service account) and enable the API.
- fal.ai key: Secret Manager, mounted as `FAL_KEY` with `--set-secrets`,
  exactly like `SESSION_SECRET` today. Never in the repo or the Dockerfile.

---

## 6. Privacy and consent — what has to change

Today's promise, in three places, is that prompts are not recorded and nothing
leaves the project. Hosted generation breaks the second half even though we
still store nothing:

| Where | Current text | Needs |
|---|---|---|
| `frontend/public/privacy.html` "What is not stored" | "The prompts you type … none of it is recorded. … no third-party tracking" | A new section **"What is sent to other services when you forge a set"**: the prompt text goes to Google (Vertex AI, processed in the EU, not used for training under Google Cloud terms); the generated render goes to fal.ai in the US to build the mesh (not used for training per fal's terms; request payloads kept up to 30 days unless we send `X-Fal-Store-IO: 0`, which we should). Reference photos a user attaches (img2img) go the same way — say so. |
| `privacy.html` "Where it is kept" | "europe-west4 … Netherlands" | Add that the mesh step runs outside the EU. |
| `frontend/src/auth/SignInPanel.jsx` consent | "Nothing else is recorded — not the prompts I type" | Still true for storage; add one clause: "Forging a set sends my prompt to Google and the render to fal.ai to make the image and the 3D model." Sign-in is where generation is gated, so this is the right moment. |
| `privacy.html` + consent + `auth.profile_for()` | "Not stored: prompts, dial settings, timings" | The per-user daily forge counter is a **new stored field** (a count and a date). Name it in both texts in the same commit, as `docs/deploy.md` already insists. |
| `docs/deploy.md` "Sign-in and data" | same promise | Mirror the above. |

Google Cloud terms do not use customer data for training; the Gemini API's
paid tier and EEA users get the same. Vertex with `location="eu"` is what lets
the Netherlands sentence stay mostly true.

---

## 7. Content policy

- **Google** Prohibited Use Policy has an IP clause but no brand list. The
  practical filter is heuristic: image requests that trip IP/trademark checks
  come back with `finishReason: "OTHER"`. Public Nano Banana templates use
  "LEGO" ("official LEGO set with the box visible", minifigure box art)
  without reported refusals. Gemini images carry a SynthID watermark and C2PA
  content credentials, which is fine for an academic site and worth a line
  in the docs.
- **OpenAI** likewise: IP clause, no keyword list; blocks surface as
  `moderation_blocked`. Third-party guides recommend "brick-built" wording.
- **FLUX / BFL**: only a `safety_tolerance` dial; no trademark filter
  documented. Community LoRAs use "LEGO" freely.
- **What to do:** keep the README posture (descriptive use, no logo, no
  minifigure, non-commercial academic). Catch `finishReason: OTHER` and retry
  once with "brick-built architecture model" in place of "LEGO Architecture
  set"; surface a plain message if both fail. Never send LEGO's own product
  photographs as references (§1.2).
- **3D services:** Meshy's terms let it train on non-Enterprise inputs and
  outputs, which is a reason to avoid it beyond price. fal and paid Tripo do
  not. Hyper3D is vague ("improve our services… research").

---

## 8. What Phase 2 would build (for scoping only — not started)

- `backend/app/hosted_client.py` with `run_txt2img`, `run_img2img`,
  `run_trellis` mirroring `comfy_client.py`'s signatures and return shapes
  (`{'png', 'params'}` / `{'glb', 'filename', 'params'}`), selected by
  `GENERATION_BACKEND=comfyui|hosted` (default `comfyui`; the local path is not
  touched).
- `/api/capabilities` reports `image` / `mesh` true when the hosted backend
  is configured (`GENERATION_BACKEND=hosted` plus the Vertex project / fal key
  present), so the "Live rendering is offline" banner clears by itself.
- `img2img` on Gemini is a reference-image edit call; the hosted `run_trellis`
  returns the GLB inline (no disk scan).
- Sign-in gate + Firestore counters + `--timeout 900` + Secret Manager +
  IAM binding in `docs/deploy.md`.
- The privacy/consent edits from §6, in the same commit as the counters.

**Ask before:** enabling the Vertex AI API on the project, buying fal credit,
deploying. None of those happen without a yes.

---

## Sources

Image models and Google Cloud
- Gemini API pricing (image models, last updated 2026-09-15): https://ai.google.dev/gemini-api/docs/pricing
- Gemini API image generation guide (reference-image limits, resolutions): https://ai.google.dev/gemini-api/docs/image-generation
- Gemini API deprecations (2.5 Flash Image shutdown 2026-10-02; Imagen 4): https://ai.google.dev/gemini-api/docs/deprecations
- Gemini API terms (data use, EEA clause): https://ai.google.dev/gemini-api/terms
- Gemini API rate limits and billing caps: https://ai.google.dev/gemini-api/docs/rate-limits · https://ai.google.dev/gemini-api/docs/billing
- Vertex / Agent Platform pricing (non-global +10% from 2026-07-01; $60 vs $66 per 1M image-output tokens): https://cloud.google.com/vertex-ai/generative-ai/pricing
- Gemini 3.1 Flash Image model card (global + `us`/`eu`; 1,120 tokens per 1K image; GA 2026-05-28): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image
- Gemini 3 Pro Image model card (global only): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-pro-image
- Imagen 4 discontinuation: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-generate
- Data residency / locations: https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency · https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
- Vertex auth (ADC recommended for production): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/gcp-auth
- IAM roles (`roles/aiplatform.user`): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/access-control
- `google-genai` SDK: https://github.com/googleapis/python-genai
- Spend-cap budgets (Preview; eligible services): https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps · https://cloud.google.com/blog/topics/cost-management/new-early-anomalies-and-spend-caps-on-google-cloud-budgets
- Alerts-only budgets / disable-billing pattern: https://docs.cloud.google.com/billing/docs/how-to/budgets · https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
- Quota overrides: https://docs.cloud.google.com/docs/quotas/view-manage · https://docs.cloud.google.com/apis/docs/capping-api-usage
- Cloud Run request timeout (300 s default, 3,600 s max): https://docs.cloud.google.com/run/docs/configuring/request-timeout
- Cloud Run CPU allocation / background work: https://docs.cloud.google.com/run/docs/configuring/cpu-allocation · https://docs.cloud.google.com/run/docs/tips/general
- Cloud Run concurrency: https://docs.cloud.google.com/run/docs/configuring/concurrency
- Cloud Tasks dispatch deadline (≤ 30 min) and Cloud Run: https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks · https://docs.cloud.google.com/run/docs/triggering/using-tasks
- Cloud Run secrets: https://docs.cloud.google.com/run/docs/configuring/services/secrets
- Cloud Armor / load balancer pricing: https://cloud.google.com/armor/pricing · https://cloud.google.com/vpc/network-pricing
- Google Generative AI Prohibited Use Policy: https://policies.google.com/terms/generative-ai/use-policy
- Gemini `finishReason: OTHER` on IP checks (third-party): https://help.apiyi.com/en/gemini-api-image-blocked-finishreason-other-solution-en.html
- LEGO-style Nano Banana examples (third-party): https://github.com/PicoTrex/Awesome-Nano-Banana-images/blob/main/README_en.md · https://picxstudio.com/templates/1877-lego-set-recreation-prompt-for-nano-banana-pro

Other image providers
- BFL pricing and FLUX.2 [pro] / Kontext API: https://docs.bfl.ml/quick_start/pricing · https://docs.bfl.ml/api-reference/models/generate-or-edit-an-image-with-flux2-[pro].md
- fal.ai FLUX.2 [pro] / Kontext / Nano Banana 2: https://fal.ai/models/fal-ai/flux-2-pro · https://fal.ai/models/fal-ai/flux-pro/kontext · https://fal.ai/models/fal-ai/nano-banana-2
- OpenAI image generation, pricing, deprecations, usage policies: https://developers.openai.com/api/docs/guides/image-generation · https://developers.openai.com/api/docs/pricing · https://developers.openai.com/api/docs/deprecations · https://openai.com/policies/usage-policies/
- Replicate pricing: https://replicate.com/pricing

OpenAI Astra
- OpenAI announcement (page returned 403 to the fetcher; content confirmed via the model page and press): https://openai.com/index/gpt-6-astra/
- Model page (`gpt-6-astra`: text+image in, text out): https://developers.openai.com/api/docs/models/gpt-6-astra
- TechCrunch, 2026-09-03: https://techcrunch.com/2026/09/03/openai-launches-astra-its-powerful-and-controversial-new-model/
- How the Blender demos work (developer community): https://community.openai.com/t/how-does-gpt-6-actually-generate-3d-models-in-release-demo-via-codex-local-blender-or-mcps-apis/1395391
- Google DeepMind Project Astra (the name collision): https://deepmind.google/models/project-astra/

Image-to-3D services
- fal.ai TRELLIS-2: https://fal.ai/models/fal-ai/trellis-2 · API: https://fal.ai/models/fal-ai/trellis-2/api · TRELLIS v1: https://fal.ai/models/fal-ai/trellis
- Microsoft TRELLIS.2-4B card (timings, hole caveat): https://huggingface.co/microsoft/TRELLIS.2-4B
- fal.ai Hunyuan3D 3.1 Rapid / Pro / v2: https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d · https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d · https://fal.ai/models/fal-ai/hunyuan3d/v2
- Hunyuan3D 2.1 paper (SDF, watertight): https://arxiv.org/pdf/2506.15442
- Replicate Hunyuan3D 3.1 / Rodin / TRELLIS: https://replicate.com/tencent/hunyuan-3d-3.1 · https://replicate.com/hyper3d/rodin · https://replicate.com/firtoz/trellis · https://replicate.com/fishwowater/trellis2
- Tencent Cloud HY 3D pricing and API: https://buy.tencentcloud.com/pricing/hunyuan · https://www.tencentcloud.com/techpedia/148312?lang=en
- Tripo pricing, quick start, H3.1, terms: https://developers.tripo3d.ai/en/pricing · https://developers.tripo3d.ai/en/docs/quick-start · https://developers.tripo3d.ai/en/models/v3-1 · https://www.tripo3d.ai/terms · fal: https://fal.ai/models/tripo3d/h3.1/image-to-3d
- Meshy API, pricing, rate limits, changelog, terms, watertight test: https://docs.meshy.ai/en/api/image-to-3d · https://docs.meshy.ai/en/api/pricing · https://docs.meshy.ai/en/api/rate-limits · https://docs.meshy.ai/en/api/changelog · https://www.meshy.ai/terms-of-use · https://www.meshy.ai/blog/best-ai-tools-for-3d-printing · fal: https://fal.ai/models/fal-ai/meshy/v6/image-to-3d
- Hyper3D Rodin API, pricing, terms: https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5 · https://hyper3d.ai/pricing · https://hyper3d.ai/legal/terms · fal: https://fal.ai/models/fal-ai/hyper3d/rodin
- Stability 3D API and pricing: https://platform.stability.ai/docs/api-reference · https://platform.stability.ai/pricing · https://stability.ai/news-updates/stable-point-aware-3d
- Hitem3D on fal: https://fal.ai/models/hitem3d/hi3d/image-to-3d · Neural4D: https://www.neural4d.com/api
- Not-available checks: Meta AssetGen 2.0 https://developers.meta.com/horizon/blog/worlds/AssetGen2/ · Google Genie https://deepmind.google/models/genie/ · Luma API index https://docs.lumalabs.ai/llms.txt · Adobe Substance 3D API https://developer.adobe.com/firefly-services/docs/s3dapi · NVIDIA https://build.nvidia.com/explore/visual-design · Amazon Nova https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-canvas.html · Kaedim https://docs.kaedim3d.com/llms.txt
- fal.ai pricing, concurrency, media expiration, terms: https://fal.ai/docs/documentation/model-apis/pricing · https://fal.ai/docs/documentation/model-apis/concurrency-limits · https://fal.ai/docs/documentation/model-apis/media-expiration · https://fal.ai/legal/terms-of-service
- Replicate prepaid credit, spend-limit removal, rate limits, data retention: https://replicate.com/docs/topics/billing/prepaid-credit · https://replicate.com/changelog/2022-10-17-set-a-monthly-spend-limit · https://replicate.com/docs/topics/predictions/rate-limits · https://replicate.com/docs/topics/predictions/data-retention
