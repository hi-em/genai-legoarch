# start-app.ps1 — one-line launcher for lEgoarCh (backend + frontend).
# Run from anywhere:   .\start-app.ps1      (from the repo root)
# Opens the backend (FastAPI :8000) and frontend (Vite :5173) each in its own
# window, then opens the app in your browser. Bypasses conda by calling the
# venv's Python directly. Press Ctrl+C in either window to stop that server.
#
# NOTE: this starts the app WITHOUT the two ComfyUI servers — enough for the
# pre-baked shelf, the dev-sample reveal, slide review, and UI screenshots.
# To render a brand-new building live you still start ComfyUI FLUX (:8188) and
# TRELLIS (:8189) yourself from their own installs first (needs the GPU).

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$venvPy = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $venvPy)) {
    Write-Host "Backend venv not found at $venvPy" -ForegroundColor Red
    Write-Host "Run the one-time setup first (see README.md):" -ForegroundColor Yellow
    Write-Host "  cd backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt"
    exit 1
}
if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
    Write-Host "Frontend deps not installed. Run once:  cd frontend; npm install" -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting lEgoarCh ..." -ForegroundColor Cyan

# Terminal 1 — backend (uses the venv python directly; ignores conda (base))
$backend = "`$host.UI.RawUI.WindowTitle='lEgoarCh backend :8000'; " +
           "Set-Location '$root\backend'; " +
           "& '$venvPy' -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backend

# Terminal 2 — frontend (Vite dev server)
$frontend = "`$host.UI.RawUI.WindowTitle='lEgoarCh frontend :5173'; " +
            "Set-Location '$root\frontend'; " +
            "npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontend

# give Vite a moment to boot, then open the app
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host "Backend  -> http://127.0.0.1:8000/health" -ForegroundColor Green
Write-Host "Frontend -> http://localhost:5173  (opening in your browser)" -ForegroundColor Green
Write-Host "Two windows opened. Press Ctrl+C inside either to stop that server." -ForegroundColor DarkGray
