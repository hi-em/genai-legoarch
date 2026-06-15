# lEgoarCh — App setup checklist (before you hit record)

Do this once, in order. Goal: Act 1 records clean on the first sitting, the shelf is already
populated, and the slow steps are the only things you ever speed‑ramp.

## 1. Servers up
- [ ] **Shortcut:** from the repo root run `.\start-app.ps1` — starts backend + frontend in their own windows and opens the browser. (Manual lines below if you prefer.)
- [ ] **Backend:** from `backend/` → `uvicorn app.main:app --reload --port 8000`
      (ComfyUI must be reachable: FLUX image on `:8188`, TRELLIS 3D on `:8189` — see `docs/benchmarks.md:4`).
- [ ] **Frontend:** from `frontend/` → `npm run dev` → open `http://localhost:5173`.
- [ ] Confirm the backend indicator dot is live (single source of truth) and a test render returns.

## 2. Pre‑bake the shelf (the 3 benchmark sets)
The shelf persists in `localStorage` (`lEgoarCh.shelf.v2`, survives reloads, cap 20).
- [ ] Generate **Sagrada Família**, **La Muralla Roja**, **Guggenheim Bilbao** through the app (example chips),
      let each finish to the reveal, and **Pack** each so it saves to the shelf.
      *(If cached GLB/brickModel results exist from the benchmark runs, reuse them to skip re‑forging.)*
- [ ] Open **Go to shelf** → confirm all three are displayed (3D orbit shelf or list view).
- [ ] **Hard‑refresh** (Ctrl+F5) → confirm all three are still there (proves persistence on camera).

## 3. Pre‑warm + pin for the live demo (Saint Basil's)
- [ ] Run **one throwaway** `Saint Basil's Cathedral` render so model weights are hot → the on‑camera render returns fast, not a cold‑start.
- [ ] In the render TinkerPanel, **pin the seed** (dice → fix a value) and **write it down** — re‑shoots must match.
- [ ] Decide the **fallback** now: if St Basil's shatters (slim onion‑dome necks), use **Taj Mahal / Himeji Castle / Great Pyramid**, or the dev‑sample reveal. (`frontend/src/hero/examples.js:9–18`)
- [ ] Confirm the dev‑only **"▶ Preview the assembly (dev sample)"** button works as a safety net.

## 4. Clean recording surface
- [ ] Skip / pre‑clear the intro splash (it plays every load; "skip intro — click or press esc").
- [ ] Lock window size + browser zoom (pick one and don't change it mid‑shoot — keeps text legible).
- [ ] OS + browser **notifications off**; close unrelated tabs; **sound on** (snap/chime fire during assembly + pack).
- [ ] Set the prompt screen as the starting frame (heading *"Name a building. Get a buildable LEGO set."*).

## 5. Dry‑run once (no recording)
- [ ] Walk Segments 1–5 of `demo-script.md` end‑to‑end on St Basil's.
- [ ] Confirm the **recipe card** flips and the prompt / seed / **FLUX.2 Klein + legoarch LoRA** are legible.
- [ ] Note the **live stat numbers** from the St Basil's reveal → fill the blanks in `slide-script.md` Slide 5 and the spoken line.

## 6. Optional captures for the deck
- [ ] Screenshot the St Basil's **reveal** (for the closing gallery, if you want a 4th tile).
- [ ] Screenshot the legible **recipe card** (a clean still beats a video frame for the deck).

> Everything for the **slides** already exists under `docs/benchmarks/assets/` — no extra captures
> needed there. The only new footage is the Act 1 St Basil's recording.
