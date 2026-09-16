# Deploying lEgoarCh

One Cloud Run container serves the API and the built SPA together — the same
shape as sensi. One origin, so there is no CORS to configure and no second
service to pay for.

```
  legoarch.charlesabichahine.com          CNAME at GoDaddy → Google
            │
  ┌─────────▼──────────────────────────────────────────────┐
  │ Cloud Run: legoarch          (europe-west4, max 1)     │
  │   FastAPI + uvicorn, Python 3.11                       │
  │   · serves frontend/dist (the Vite SPA)                │
  │   · /api/* — legolizer (CPU), auth, the cloud shelf    │
  │   · scale to zero: idle costs nothing                  │
  └──┬───────────────┬──────────────────┬──────────────────┘
     │               │                  │
  Firestore     Cloud Storage     Secret Manager
  users + the   set payloads      SESSION_SECRET
  shelf index   (>1 MiB)          GOOGLE_CLIENT_ID
     │
  Google Sign-In — ID token, verified server-side
```

The GPU half (ComfyUI FLUX :8188 + TRELLIS :8189) is **not** in the container
and cannot be — it needs ~16 GB of VRAM. The deployed site has two ways to
forge a new building:

- **`GENERATION_BACKEND=hosted`** (the intended production mode): the image
  comes from Gemini on Vertex AI and the 3D mesh from fal.ai, both called from
  the container. Costs about $0.30 per set; gated behind sign-in and limits.
  See *Hosted generation* below and [hosted-generation.md](hosted-generation.md)
  for the study behind the choice.
- **`GENERATION_BACKEND=comfyui`** (the default, and what you run locally):
  the service reports the GPU stages as offline until `COMFYUI_URL` /
  `COMFYUI_3D_URL` point at a live pair.

Everything else — sign-in, the shelf, the CPU legolizer, the sample build —
works without a GPU anywhere, in either mode.

---

## What costs money

| Tier | Cost |
|---|---|
| Cloud Run, scale-to-zero, max 1 instance | ~$0 at demo traffic; free tier covers it |
| Firestore + Cloud Storage at this size | cents/month |
| Hosted generation (Gemini + fal.ai) | **≈ $0.30 per forged set**, capped by `HOSTED_MONTHLY_BUDGET_USD` (default $10 ≈ 33 sets) — see *Hosted generation* |
| ComfyUI FLUX + TRELLIS (your own GPU) | only if you point the service at one — see *Turning generation on* |

## Why the shelf is split across two services

A saved set carries its full `brickModel`, and a detail-48 build is tens of
thousands of bricks — several MB of JSON. Firestore caps a document at 1 MiB, so
the flagship sets are exactly the ones that would fail to save. Firestore holds a
light index (title, counts, thumbs) and Cloud Storage holds the gzipped payload;
the Collection lists from the index and fetches a payload only when a set is
opened. See `backend/app/shelf_store.py`.

---

## One-time setup

### 1. The Google project

```bash
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  firestore.googleapis.com storage.googleapis.com secretmanager.googleapis.com
gcloud firestore databases create --location=eur3
gsutil mb -l europe-west4 gs://<PROJECT_ID>-legoarch-sets
```

### 2. OAuth client for Google Sign-In

In the Cloud console under **APIs & Services → Credentials**, create an
**OAuth 2.0 Client ID** of type *Web application*. Add your site to
**Authorised JavaScript origins** — the deployed origin and, if you want to test
sign-in locally, `http://localhost:8001`:

```
https://legoarch.charlesabichahine.com
http://localhost:8001
```

The client ID is public (it ships in the page); the client *secret* is not used
by this flow at all, because the ID token is verified server-side against
Google's certs.

### 3. The session secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))" | \
  gcloud secrets create legoarch-session-secret --data-file=-
```

`SESSION_SECRET` signs the session cookie. **Rotating it signs everyone out** —
that is the intended way to invalidate all sessions at once.

### 4. Deploy

```bash
gcloud run deploy legoarch --source . --region europe-west4 \
  --allow-unauthenticated --max-instances 1 --memory 1Gi --cpu 1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=<PROJECT_ID> \
  --set-env-vars GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com \
  --set-env-vars SHELF_BUCKET=<PROJECT_ID>-legoarch-sets \
  --set-secrets SESSION_SECRET=legoarch-session-secret:latest
```

`--allow-unauthenticated` lets the public reach the container — correct here,
since the app is open to guests and only *saving* needs an account.
`GOOGLE_CLOUD_PROJECT` is what switches the shelf from local disk to Firestore +
Storage (and, in hosted mode, points the image stage at Vertex AI). **Cloud Run
does not set it for you** — an earlier version of this doc said it did, and the
live service ran for a while with the shelf on the container's own disk, which
is wiped on every restart. Set it explicitly.

### Grant the runtime service account access

Three roles, all on `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`.
The Secret Manager one is needed for the deploy to succeed AT ALL — without it
the container builds fine and then the revision is refused, which reads as a
deploy failure rather than a permissions problem:

```bash
gcloud secrets add-iam-policy-binding legoarch-session-secret   --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com"   --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding <PROJECT_ID>   --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com"   --role="roles/datastore.user"

gcloud storage buckets add-iam-policy-binding gs://<PROJECT_ID>-legoarch-sets   --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com"   --role="roles/storage.objectAdmin"
```

The last two are not needed to deploy, but the shelf 500s on first save without
them.

### 5. The domain

```
CNAME  legoarch  →  ghs.googlehosted.com
```

...then **Cloud Run → Manage custom domains → Add mapping**, and Google issues
the certificate. Use whatever record the console shows you rather than copying
this table — the target differs by region and mapping type.

Hostnames are case-insensitive: `lEgoarCh.charlesabichahine.com` resolves as
`legoarch.charlesabichahine.com`, and browsers lowercase it. The capital **E**
and **C** live in the page title and wordmark, not the URL.

---

## Environment

| Var | Default | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | _(unset)_ | OAuth web client. **Unset ⇒ the sign-in doors are hidden entirely** and the app runs guest-only. |
| `SESSION_SECRET` | dev fallback | Signs the session cookie. Required on Cloud Run — the app refuses to start without it. |
| `SESSION_DAYS` | `30` | Cookie lifetime. |
| `GOOGLE_CLOUD_PROJECT` | _(unset)_ — **set it on Cloud Run** | Switches the shelf to Firestore + Storage and the hosted image stage to Vertex AI. Unset ⇒ `backend/.localshelf` on disk, which on Cloud Run means "lost on restart". |
| `SHELF_BUCKET` | `<project>-legoarch-sets` | Payload bucket. |
| `REVIEWER_EMAILS` | _(unset)_ | Allowlist hook — see *Reviewers* below. |
| `ALLOWED_ORIGINS` | _(unset)_ | Only needed for a split-origin deployment. Same-origin needs nothing. |
| `COMFYUI_URL` / `COMFYUI_3D_URL` | localhost | The GPU pair (`comfyui` mode). |
| `GENERATION_BACKEND` | `comfyui` | `hosted` = Gemini + fal.ai instead of ComfyUI. |
| `FAL_KEY` | _(unset)_ | fal.ai API key — **Secret Manager**, never an env literal. `hosted` mode reports the 3D stage offline without it. |
| `HOSTED_3D_MODEL` | `hunyuan` | `hunyuan` (Hunyuan3D 3.1 Rapid, fastest) or `trellis2` (closest to the local pipeline, slower on fal). |
| `HOSTED_GEMINI_LOCATION` | `eu` | Vertex AI location for the image model; `eu` keeps ML processing in the EU. |
| `HOSTED_USER_DAILY_IMAGES` / `HOSTED_USER_DAILY_MESHES` | `3` / `3` | Per-person, per-UTC-day forge limits. |
| `HOSTED_MONTHLY_BUDGET_USD` | `10` | Global hard stop, per calendar month, counted in-app before every provider call. |

## Running the deployed shape locally

`frontend/dist` must exist — FastAPI only mounts the SPA if it is there:

```bash
cd frontend && npm run build && cd ..
GOOGLE_CLIENT_ID=<client-id> backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --port 8001
```

Open http://localhost:8001. With no `GOOGLE_CLOUD_PROJECT` the shelf writes to
`backend/.localshelf/`, so the whole flow works with no GCP project at all.

The `/api` prefix is the same in dev and production — the Vite proxy forwards it
unchanged. Do not reintroduce a rewrite: the SPA catch-all would swallow every
API call and return `index.html`.

---

## Sign-in and data

Signing in is **optional**. Anyone can explore, build and watch a set assemble
without an account; signing in is what gives a packed set somewhere to live. The
ask appears in two places only — the intro's second door, and pressing Pack as a
guest — and never blocks the app. Consent is collected before Google's button is
rendered at all, and the backend stores only what that consent names:

- **Identity** — name, email, profile picture, last seen (`users/{uid}`)
- **Saved sets** — only what the user explicitly packs
- **A daily forge count** — `users/{uid}/quota/{YYYY-MM-DD}` holds how many
  renders and meshes the account forged that day (`app.quota`). Hosted mode
  only; it is what the per-person limit is checked against.

Not stored: prompts, dial settings, timings, anything a user did not save. That
promise is kept in two places, `auth.profile_for()` and `quota.py` — if you
ever widen either, widen the consent text in `frontend/src/auth/SignInPanel.jsx`
and `frontend/public/privacy.html` in the same commit.

In hosted mode the prompt does leave the project for the length of the
request: it goes to Gemini (Vertex AI, EU multi-region, not used for training
under Google Cloud terms) and the *render* goes to fal.ai in the US (not used
for training per fal's terms; the request asks fal not to retain the payload).
The privacy page says exactly this.

A guest's work is never silently lost: the build lives in the store, so signing
in from the Pack prompt leaves the set exactly where it was, ready to pack. What
a guest does NOT get is persistence — nothing is written anywhere until there is
an account to write to (`useCollection` guards every shelf call on `useAuth`).

### Reviewers

Because signing in is optional, a marker or external reviewer can see the whole
project without an account. `REVIEWER_EMAILS` / `auth.is_reviewer` remain as a
hook if you ever need to treat specific accounts differently; nothing uses it
today.

### Deleting a user's data

There is no self-service delete yet. To honour a request by hand:

```bash
gcloud firestore documents delete "users/<uid>" --recursive
gsutil -m rm -r gs://<PROJECT_ID>-legoarch-sets/sets/<uid>
```

---

## Hosted generation (the deployed site)

The study in [hosted-generation.md](hosted-generation.md) measured Gemini
3.1 Flash Image (Vertex AI, `eu`) + Hunyuan3D 3.1 Rapid (fal.ai) against the
local pipeline on the three benchmark buildings: every set came out connected
and buildable, at ≈ $0.30 and ≈ 2–2.5 minutes per set. Turning it on:

```bash
# 1. the image model: no key — the runtime service account calls Vertex AI
gcloud services enable aiplatform.googleapis.com
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 2. the 3D model: a prepaid fal.ai key, in Secret Manager
printf '%s' '<fal key>' | gcloud secrets create legoarch-fal-key --data-file=-
gcloud secrets add-iam-policy-binding legoarch-fal-key \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3. switch the service over — and give the mesh call room (measured 77–122 s,
#    worst case seen 469 s on TRELLIS-2; the default is 300 s)
gcloud run services update legoarch --region europe-west4 \
  --timeout 900 \
  --update-env-vars GENERATION_BACKEND=hosted,HOSTED_3D_MODEL=hunyuan \
  --update-secrets FAL_KEY=legoarch-fal-key:latest
```

`/api/capabilities` then reports `image` and `mesh` as available and the
"Live rendering is offline" banner clears on its own. Forging needs a signed-in
user and is counted against `HOSTED_USER_DAILY_*` and
`HOSTED_MONTHLY_BUDGET_USD` **before** each provider call (`app.quota`), so the
in-app budget is the first stop. Two backstops outside the app:

- a **spend-cap budget** (Cloud Billing → Budgets, *Preview*) on the *Gemini
  Enterprise Agent Platform* service in this project, which pauses new usage
  at the cap;
- **fal's prepaid balance** — fal has no self-serve monthly limit, so top up
  by hand ($10 at a time) and leave auto top-up off. Set the low-balance email.

Meshes are cached in the instance's `/tmp` (`HOSTED_MESH_DIR`) so the
re-legolize "mesh stop" works without re-paying; an instance restart forgets
them, which the frontend already handles as `mesh_not_found` → "materialize
again".

## Turning generation on (your own GPU)

Point the service at a live ComfyUI pair and redeploy:

```bash
gcloud run services update legoarch --region europe-west4 \
  --set-env-vars COMFYUI_URL=https://flux.example.com,COMFYUI_3D_URL=https://trellis.example.com
```

**The backend must share a filesystem with the TRELLIS box.** Its export node
writes the `.glb` to disk without registering it in ComfyUI's `/history`, so the
backend reads it off the local filesystem (`COMFYUI_3D_OUTPUT`,
`comfy_client._newest_glb`). Cloud Run has no such share — so with the backend on
Cloud Run, `/api/generate-mesh` will not work until the HTTP `/view` fallback in
`run_trellis` is promoted to the primary path and the fetched mesh is cached
locally. Until then, treat the GPU stages as demo-only from a machine that has
the mount.

### Where the GPU runs

| | Cost | Notes |
|---|---|---|
| Your own machine + Cloudflare Tunnel | $0 + electricity | no port forwarding, no static IP. The right answer for a seminar project. |
| Rented always-on GPU (RunPod, Vast.ai) | ~$0.30–0.80/hr → **~$250–550/mo** | bills while idle. Verify current rates. |
| Serverless GPU (RunPod Serverless, Modal) | cents per set | ComfyUI + the custom TRELLIS2 nodes + the LoRA must be containerized; cold starts load tens of GB. Days of work. |

`ANTHROPIC_API_KEY` is optional everywhere: without it the set-designer copy
falls back to a local template.
