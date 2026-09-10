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
and cannot be — it needs ~16 GB of VRAM. The service reports those stages as
offline until `COMFYUI_URL` / `COMFYUI_3D_URL` point at a live pair. Everything
else — sign-in, the shelf, the CPU legolizer, the sample build — works without
a GPU anywhere.

---

## What costs money

| Tier | Cost |
|---|---|
| Cloud Run, scale-to-zero, max 1 instance | ~$0 at demo traffic; free tier covers it |
| Firestore + Cloud Storage at this size | cents/month |
| ComfyUI FLUX + TRELLIS | **the whole bill** — see *Turning generation on* |

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
  --set-env-vars GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com \
  --set-env-vars SHELF_BUCKET=<PROJECT_ID>-legoarch-sets \
  --set-secrets SESSION_SECRET=legoarch-session-secret:latest
```

`--allow-unauthenticated` lets the public reach the container — correct here,
since the app is open to guests and only *saving* needs an account.
`GOOGLE_CLOUD_PROJECT` is set for you by Cloud Run, and that is what switches the
shelf from local disk to Firestore + Storage.

Give the service account `roles/datastore.user` and
`roles/storage.objectAdmin` on the bucket, or the shelf will 500 on first save.

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
| `GOOGLE_CLOUD_PROJECT` | set by Cloud Run | Switches the shelf to Firestore + Storage. Unset ⇒ `backend/.localshelf` on disk. |
| `SHELF_BUCKET` | `<project>-legoarch-sets` | Payload bucket. |
| `REVIEWER_EMAILS` | _(unset)_ | Allowlist hook — see *Reviewers* below. |
| `ALLOWED_ORIGINS` | _(unset)_ | Only needed for a split-origin deployment. Same-origin needs nothing. |
| `COMFYUI_URL` / `COMFYUI_3D_URL` | localhost | The GPU pair. |

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

Not stored: prompts, dial settings, timings, anything a user did not save. That
promise is kept in one place, `auth.profile_for()` — if you ever widen it, widen
the consent text in `frontend/src/auth/SignInPanel.jsx` in the same commit.

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

## Turning generation on

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
