# lEgoarCh on Cloud Run — one container serving the API and the SPA together.
# One origin means no CORS to configure and no second service to pay for.
#
#   gcloud run deploy legoarch --source . --region europe-west4
#
# The GPU half (ComfyUI FLUX + TRELLIS) is NOT in here and cannot be: it needs
# ~16 GB of VRAM. The container runs the CPU legolizer and reports the GPU
# stages as offline until COMFYUI_URL / COMFYUI_3D_URL point at a live pair.

# ---------- stage 1: build the SPA ----------
FROM node:20-slim AS web
WORKDIR /build

# install deps against the lockfile first so this layer caches across code edits
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci

COPY frontend/ ./frontend/
# VITE_API_BASE stays empty on purpose: same origin, so "/api/..." resolves to
# this very container. Setting it here would point the app at a foreign host.
RUN npm --prefix frontend run build


# ---------- stage 2: the runtime ----------
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY comfyui/workflows/ ./comfyui/workflows/
# main.py resolves the SPA at <repo>/frontend/dist — mirror that layout exactly
COPY --from=web /build/frontend/dist ./frontend/dist

# Cloud Run sends traffic to $PORT (8080 by default) and terminates TLS itself.
ENV PORT=8080
EXPOSE 8080

# One worker: the legolizer is CPU-bound and the service is capped at one small
# instance, so a second worker would only contend for the same core.
CMD exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT} --workers 1
