"""Build the real-parts catalog for lEgoarCh.

Downloads the Rebrickable CSV dumps (free for any purpose; we credit
"data from Rebrickable" in the UI) plus the official LDraw colour config,
curates the architecture part palette, validates every colour id against
LDConfig.ldr, and emits two generated files:

    backend/app/catalog/catalog.json     (backend: packing, colours, export)
    frontend/src/lib/catalog.gen.json    (frontend: palette + part metadata)

Rebrickable colour ids follow LDraw colour codes for the production colours
we use; this script *proves* that per colour by checking the code exists in
LDConfig.ldr with a matching-ish name, and drops (with a warning) any that
don't.  Part availability comes from elements.csv: a (part, colour) pair is
allowed only if a real element exists.

Run:  python scripts/build_catalog.py [--refresh]
Stdlib only — no third-party deps.
"""

from __future__ import annotations

import argparse
import csv
import datetime as _dt
import gzip
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "rebrickable"
BACKEND_OUT = ROOT / "backend" / "app" / "catalog" / "catalog.json"
FRONTEND_OUT = ROOT / "frontend" / "src" / "lib" / "catalog.gen.json"

CDN = "https://cdn.rebrickable.com/media/downloads"
CSVS = ["colors.csv.gz", "parts.csv.gz", "elements.csv.gz"]
LDCONFIG_URL = "https://library.ldraw.org/library/official/LDConfig.ldr"

ATTRIBUTION = (
    "Catalog data from Rebrickable (rebrickable.com). "
    "Part geometry and colour definitions from the LDraw Parts Library "
    "(ldraw.org, CC-BY)."
)

# ---------------------------------------------------------------------------
# Curated architecture part palette.
#   id     = canonical id used across engine/renderer/export = LDraw file stem
#   reb    = Rebrickable part_num (differs where LDraw renamed the mould)
#   w, d   = canonical footprint in studs (w = slope axis for slope families)
#   h      = height in plate layers (1 plate = 3.2 mm, brick = 3)
#   place  = engine may auto-place it (False = catalog/renderer support only)
# ---------------------------------------------------------------------------
P = lambda id, reb, name, family, w, d, h, place=True: {
    "id": id, "reb": reb, "name": name, "family": family,
    "w": w, "d": d, "h": h, "place": place,
}

CURATED_PARTS = [
    # --- bricks (h = 3 plates) ---
    P("3005", "3005", "Brick 1 x 1", "brick", 1, 1, 3),
    P("3004", "3004", "Brick 1 x 2", "brick", 1, 2, 3),
    P("3622", "3622", "Brick 1 x 3", "brick", 1, 3, 3),
    P("3010", "3010", "Brick 1 x 4", "brick", 1, 4, 3),
    P("3009", "3009", "Brick 1 x 6", "brick", 1, 6, 3),
    P("3008", "3008", "Brick 1 x 8", "brick", 1, 8, 3),
    P("3003", "3003", "Brick 2 x 2", "brick", 2, 2, 3),
    P("3002", "3002", "Brick 2 x 3", "brick", 2, 3, 3),
    P("3001", "3001", "Brick 2 x 4", "brick", 2, 4, 3),
    P("2456", "2456", "Brick 2 x 6", "brick", 2, 6, 3),
    P("3007", "3007", "Brick 2 x 8", "brick", 2, 8, 3),
    # --- plates (h = 1) ---
    P("3024", "3024", "Plate 1 x 1", "plate", 1, 1, 1),
    P("3023", "3023", "Plate 1 x 2", "plate", 1, 2, 1),
    P("3623", "3623", "Plate 1 x 3", "plate", 1, 3, 1),
    P("3710", "3710", "Plate 1 x 4", "plate", 1, 4, 1),
    P("3666", "3666", "Plate 1 x 6", "plate", 1, 6, 1),
    P("3460", "3460", "Plate 1 x 8", "plate", 1, 8, 1),
    P("3022", "3022", "Plate 2 x 2", "plate", 2, 2, 1),
    P("3021", "3021", "Plate 2 x 3", "plate", 2, 3, 1),
    P("3020", "3020", "Plate 2 x 4", "plate", 2, 4, 1),
    P("3795", "3795", "Plate 2 x 6", "plate", 2, 6, 1),
    P("3034", "3034", "Plate 2 x 8", "plate", 2, 8, 1),
    # --- tiles (h = 1, studless tops) ---
    P("3070b", "3070b", "Tile 1 x 1", "tile", 1, 1, 1),
    P("3069b", "3069b", "Tile 1 x 2", "tile", 1, 2, 1),
    P("63864", "63864", "Tile 1 x 3", "tile", 1, 3, 1),
    P("2431", "2431", "Tile 1 x 4", "tile", 1, 4, 1),
    P("3068b", "3068b", "Tile 2 x 2", "tile", 2, 2, 1),
    P("87079", "87079", "Tile 2 x 4", "tile", 2, 4, 1),
    # --- 45-degree slopes (slope falls along w axis) ---
    P("3040b", "3040", "Slope 45 2 x 1", "slope45", 2, 1, 3),
    P("3039", "3039", "Slope 45 2 x 2", "slope45", 2, 2, 3),
    P("3038", "3038", "Slope 45 2 x 3", "slope45", 2, 3, 3),
    P("3037", "3037", "Slope 45 2 x 4", "slope45", 2, 4, 3),
    # --- 33-degree slopes ---
    P("4286", "4286", "Slope 33 3 x 1", "slope33", 3, 1, 3),
    P("3298", "3298", "Slope 33 3 x 2", "slope33", 3, 2, 3),
    # --- cheese + curved (h = 2 plates) ---
    P("54200", "54200", "Slope 30 1 x 1 x 2/3 (cheese)", "cheese", 1, 1, 2),
    P("11477", "11477", "Slope Curved 2 x 1", "curved", 2, 1, 2),
    P("93273", "93273", "Slope Curved 4 x 1 Double", "curved", 4, 1, 2),
    # --- inverted 45 slopes (under overhangs) ---
    P("3665a", "3665", "Slope Inverted 45 2 x 1", "inverted", 2, 1, 3),
    P("3660b", "3660", "Slope Inverted 45 2 x 2", "inverted", 2, 2, 3),
    # --- narrative / v2 families (renderer + catalog only for now) ---
    P("3455", "3455", "Arch 1 x 6", "arch", 1, 6, 3, place=False),
    P("6183", "6183", "Arch 1 x 6 x 2 Curved Top", "arch", 1, 6, 6, place=False),
    P("60592", "60592", "Window 1 x 2 x 2", "window", 1, 2, 6, place=False),
    P("87552", "87552", "Panel 1 x 2 x 2", "panel", 1, 2, 6, place=False),
    P("2423", "2423", "Plant Leaves 4 x 3", "plant", 4, 3, 1, place=False),
]

# Classic tier: the LEGO Architecture staples.  Rebrickable id == LDraw code
# for all of these (validated against LDConfig below).
CLASSIC_COLOR_IDS = [
    15,   # White
    71,   # Light Bluish Gray
    72,   # Dark Bluish Gray
    0,    # Black
    19,   # Tan
    28,   # Dark Tan
    70,   # Reddish Brown
    308,  # Dark Brown
    4,    # Red
    320,  # Dark Red
    14,   # Yellow
    191,  # Bright Light Orange
    25,   # Orange
    484,  # Dark Orange
    1,    # Blue
    272,  # Dark Blue
    379,  # Sand Blue
    2,    # Green
    288,  # Dark Green
    378,  # Sand Green
    330,  # Olive Green
    84,   # Medium Nougat
    92,   # Nougat
    47,   # Trans-Clear
    46,   # Trans-Yellow
]

FULL_MIN_PARTS = 300       # colour must exist on >= this many distinct parts
FULL_MIN_LAST_YEAR = 2018  # and still be in production this recently
FULL_CAP = 48


def _fetch(url: str, dest: Path, refresh: bool) -> bytes:
    if dest.exists() and not refresh:
        return dest.read_bytes()
    print(f"  downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "lEgoarCh-catalog/1.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return data


def _read_csv(gz_bytes: bytes) -> list[dict]:
    text = gzip.decompress(gz_bytes).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


_NORM = re.compile(r"[^a-z0-9]+")


def _norm_name(name: str) -> str:
    """Normalise colour names so 'Light_Bluish_Grey' matches 'Light Bluish Gray'."""
    return _NORM.sub("", name.lower().replace("grey", "gray"))


def _parse_ldconfig(text: str) -> dict[int, dict]:
    """LDConfig.ldr lines: 0 !COLOUR <name> CODE <n> VALUE #RRGGBB EDGE ..."""
    out: dict[int, dict] = {}
    pat = re.compile(
        r"^0\s+!COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+#([0-9A-Fa-f]{6})", re.M
    )
    for m in pat.finditer(text):
        out[int(m.group(2))] = {"name": m.group(1), "hex": m.group(3).upper()}
    return out


def _reb_candidates(part: dict) -> list[str]:
    """Rebrickable part_num lookup chain for an LDraw id."""
    cands = [part["reb"], part["id"]]
    stripped = re.sub(r"[a-z]+$", "", part["id"])
    cands += [stripped, stripped + "b", stripped + "a"]
    seen, out = set(), []
    for c in cands:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download sources")
    args = ap.parse_args()

    print("[1/5] fetching sources")
    raw = {n: _fetch(f"{CDN}/{n}", CACHE / n, args.refresh) for n in CSVS}
    ldconfig_text = _fetch(LDCONFIG_URL, CACHE / "LDConfig.ldr", args.refresh).decode(
        "utf-8", errors="replace"
    )

    print("[2/5] parsing")
    colors_rows = _read_csv(raw["colors.csv.gz"])
    parts_rows = _read_csv(raw["parts.csv.gz"])
    elements_rows = _read_csv(raw["elements.csv.gz"])
    ldconfig = _parse_ldconfig(ldconfig_text)
    print(f"  colors={len(colors_rows)} parts={len(parts_rows)} "
          f"elements={len(elements_rows)} ldconfig_codes={len(ldconfig)}")

    reb_colors = {int(r["id"]): r for r in colors_rows if r["id"].lstrip("-").isdigit()}
    reb_parts = {r["part_num"]: r for r in parts_rows}

    # ---- full palette candidates --------------------------------------
    print("[3/5] building palettes (validated against LDConfig)")
    full_ids: list[int] = []
    dropped: list[str] = []
    candidates = set(CLASSIC_COLOR_IDS)
    for cid, row in reb_colors.items():
        if row["is_trans"] == "t":
            continue
        try:
            num_parts = int(row["num_parts"] or 0)
            y2 = int(row["y2"] or 0)
        except ValueError:
            continue
        if num_parts >= FULL_MIN_PARTS and y2 >= FULL_MIN_LAST_YEAR:
            candidates.add(cid)

    for cid in sorted(candidates):
        row = reb_colors.get(cid)
        if row is None:
            dropped.append(f"{cid}: not in colors.csv")
            continue
        ld = ldconfig.get(cid)
        if ld is None:
            dropped.append(f"{cid} ({row['name']}): no LDraw code {cid} in LDConfig")
            continue
        if _norm_name(ld["name"]) != _norm_name(row["name"]):
            # Name mismatch = the id alignment assumption failed for this colour.
            dropped.append(
                f"{cid}: name mismatch Rebrickable '{row['name']}' vs LDraw '{ld['name']}'"
            )
            continue
        full_ids.append(cid)

    full_ids.sort(key=lambda c: -int(reb_colors[c]["num_parts"] or 0))
    full_ids = full_ids[:FULL_CAP]
    classic_ids = [c for c in CLASSIC_COLOR_IDS if c in full_ids]
    missing_classic = [c for c in CLASSIC_COLOR_IDS if c not in full_ids]
    if missing_classic:
        print(f"  WARNING classic colours dropped by validation: {missing_classic}")
    for d in dropped:
        if any(str(c) == d.split(":")[0].split(" ")[0] for c in CLASSIC_COLOR_IDS):
            print(f"  DROPPED (classic!): {d}")

    colors_out = []
    for cid in full_ids:
        row = reb_colors[cid]
        hexv = row["rgb"].upper()
        colors_out.append({
            "code": cid,
            "name": row["name"],
            "hex": f"#{hexv}",
            "rgb": [int(hexv[i:i + 2], 16) for i in (0, 2, 4)],
            "is_trans": row["is_trans"] == "t",
        })

    # ---- part availability from elements.csv ---------------------------
    print("[4/5] part+colour availability from elements.csv")
    full_set = set(full_ids)
    elem_by_part: dict[str, set[int]] = {}
    for r in elements_rows:
        try:
            cid = int(r["color_id"])
        except ValueError:
            continue
        if cid in full_set:
            elem_by_part.setdefault(r["part_num"], set()).add(cid)

    part_colors: dict[str, list[int]] = {}
    parts_out = []
    for part in CURATED_PARTS:
        avail: set[int] = set()
        matched = None
        for cand in _reb_candidates(part):
            if cand in elem_by_part:
                avail |= elem_by_part[cand]
                matched = matched or cand
        name = None
        for cand in _reb_candidates(part):
            if cand in reb_parts:
                name = reb_parts[cand]["name"]
                break
        parts_out.append({**part, "reb_matched": matched, "reb_name": name})
        part_colors[part["id"]] = sorted(avail)
        flag = "" if len(avail) >= 8 else "  <-- few colours!"
        print(f"  {part['id']:>6}  {part['name']:<34} colours={len(avail):>3}{flag}")

    no_colors = [p["id"] for p in parts_out if not part_colors[p["id"]]]
    if no_colors:
        print(f"  WARNING parts with NO element match (check reb ids): {no_colors}")

    # ---- emit -----------------------------------------------------------
    print("[5/5] writing catalog")
    catalog = {
        "version": 1,
        "generated": _dt.date.today().isoformat(),
        "attribution": ATTRIBUTION,
        "colors": colors_out,
        "palettes": {"classic": classic_ids, "full": [c["code"] for c in colors_out]},
        "parts": parts_out,
        "part_colors": part_colors,
    }
    for dest in (BACKEND_OUT, FRONTEND_OUT):
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(catalog, indent=1), encoding="utf-8")
        print(f"  wrote {dest.relative_to(ROOT)}  "
              f"({dest.stat().st_size / 1024:.1f} KB)")

    print(f"\nOK: {len(colors_out)} colours (classic {len(classic_ids)}), "
          f"{len(parts_out)} parts, "
          f"{sum(len(v) for v in part_colors.values())} part-colour combos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
