# Deploying lEgoarCh

The app is three tiers, and only one of them costs money.

| Tier | Needs | Cost |
|---|---|---|
| Frontend (`frontend/`) | static file hosting | **$0** — free tier anywhere |
| Backend (`backend/`) | CPU: numpy / scipy / trimesh | **$0–7/mo** |
| ComfyUI FLUX + TRELLIS | an NVIDIA GPU, ~16 GB VRAM | **the whole bill** |

ComfyUI is not a service you call — it is a program that runs on a physical GPU.
When no GPU is running, the render and mesh steps have nowhere to happen. That is
the fact the deployment has to be designed around, not a bug to work around.

---

## The default: the demo-only deployment

**Deploy the site permanently for free; run the GPU only when you demo.**

The site is fully usable without a backend: the intro wall, the studio, a real
solved set assembling course by course, the box, the instruction booklet, the
parts list and prices, PNG / STL / LDraw / CSV exports, and the collection
(which lives in `localStorage`, so there is no database to provision).

What it cannot do without a GPU is forge a *new* building. Rather than let that
fail four minutes in, the frontend probes `GET /capabilities` on load and, when
the GPU is unreachable, says so on the intro screen and offers the sample build
instead. `Visualize it` is disabled with a reason.

### Deploy it

Leave `VITE_API_BASE` **unset** — that is what selects the demo build.

```bash
cd frontend && npm install && npm run build   # -> frontend/dist
```

- **Netlify** — [`netlify.toml`](../netlify.toml) is committed; connect the repo, no settings needed.
- **Vercel** — [`vercel.json`](../vercel.json) is committed; same.
- **GitHub Pages** — assets are served from `/<repo>/`, so the base path must be baked in:
  ```bash
  cd frontend && VITE_BASE=/genai-legoarch/ npm run build
  ```

There is no client-side router, so no SPA rewrite rules are needed.

### The domain

The site lives at **`legoarch.charlesabichahine.com`**.

Note that hostnames are case-insensitive: `lEgoarCh.charlesabichahine.com` and
`legoarch.charlesabichahine.com` are the same name, and browsers lowercase it in
the address bar. The capital **E** and **C** survive in the page title, the
wordmark and the docs — not in the URL.

Point it at the host from your DNS provider (wherever `charlesabichahine.com` is
managed), then add the custom domain in the host's dashboard so it issues a
certificate:

| Host | Record | Value |
|---|---|---|
| Netlify | `CNAME legoarch` | `<your-site>.netlify.app` |
| Vercel | `CNAME legoarch` | `cname.vercel-dns.com` |
| GitHub Pages | `CNAME legoarch` | `<user>.github.io` (+ a `CNAME` file in the published root) |

With a custom domain on GitHub Pages the site is served from the root, so build
**without** `VITE_BASE` — that variable is only for the `<user>.github.io/<repo>/`
form.

If you later run the backend behind the same domain, give it its own subdomain
(`api.legoarch.charlesabichahine.com`) rather than a path — the frontend host and
the GPU box are different machines, and a path split would need a proxy in front
of both.

---

## Turning generation on

Point the site at a backend by setting `VITE_API_BASE` and rebuilding, and allow
the site's origin on the backend with `ALLOWED_ORIGINS`. Both are required — a
missing `ALLOWED_ORIGINS` fails as a CORS block in the browser, which looks
exactly like the backend being down.

```bash
# frontend — build time, no trailing slash
VITE_API_BASE=https://api.legoarch.charlesabichahine.com npm run build

# backend — comma-separated
ALLOWED_ORIGINS=https://legoarch.charlesabichahine.com uvicorn app.main:app --port 8000
```

**Keep the backend on the same machine as the GPU.** TRELLIS's export node writes
its `.glb` to disk without registering it in ComfyUI's `/history`, so the backend
reads it off the local filesystem (`COMFYUI_3D_OUTPUT`, `comfy_client._newest_glb`).
That assumes a shared filesystem. Splitting the backend onto a separate CPU host
means promoting the HTTP `/view` fallback in `run_trellis` to the primary path and
caching the fetched mesh locally so `/mesh/{name}` and re-legolize keep working.

### Where the GPU runs

| | Cost | Notes |
|---|---|---|
| **Your own machine**, exposed with a Cloudflare Tunnel | $0 + electricity | free, no port forwarding, no static IP. The right answer for a seminar project. |
| **Rented always-on GPU** (RunPod, Vast.ai) | ~$0.30–0.80/hr → **~$250–550/mo** | bills while idle. Verify current rates. |
| **Serverless GPU** (RunPod Serverless, Modal) | cents per set | pay per second, but ComfyUI + the custom TRELLIS2 nodes + the LoRA have to be containerized, and cold starts load tens of GB of weights before the first request answers. Days of work. |

A public URL that triggers GPU jobs is an open invitation — add a shared-token
header before pointing one at a card you are paying for.

`ANTHROPIC_API_KEY` is optional everywhere: without it the set-designer copy
falls back to a local template.
