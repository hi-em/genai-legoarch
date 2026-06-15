"""
build_deck.py — lEgoarCh deck, "Studwork" visual language (see design-system.md).

One fractional-layout spec, two backends that stay in sync:
  - Pillow      -> legoarch-deck.pdf   (fully designed art + type)
  - python-pptx -> legoarch-deck.pptx  (designed art as the slide background;
                   all COPY overlaid as live, editable Archivo/Inter text boxes)

Native diagrams/icons/arrows drawn in primitives — no pasted-figure-as-slide.
Emblem (plate stack) + colored wordmark + footer on every slide. Act 1 has no
slides (live demo). 9 slides: title · pipeline · prompt-eng · colour · boundary ·
reproducible · scale+catalog · contact sheet · end. Re-runnable.

    python presentation/build_deck.py
"""
from __future__ import annotations
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageColor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ASSETS = os.path.join(REPO, "docs", "benchmarks", "assets", "examples")
FONTS = os.path.join(HERE, "fonts")
OUT_PDF = os.path.join(HERE, "legoarch-deck.pdf")
OUT_PPTX = os.path.join(HERE, "legoarch-deck.pptx")
SLIDE_DIR = os.path.join(HERE, "_slides")

W, H = 1920, 1080
IN_W, IN_H = 13.333, 7.5
PT = 2.0  # pt -> px

# palette (frontend/src/styles/tokens.css)
FELT = "#2b2f2c"; FELT_DEEP = "#20241f"
SURFACE = "#f4f5f2"; ELEVATED = "#ffffff"; SUNKEN = "#e7e9e4"
RED = "#c91a09"; YELLOW = "#f6c700"; YELLOW_DK = "#c39e00"
BLUE = "#1e5aa8"; TAN = "#e4cd9e"
INK = "#23271f"; INK_SOFT = "#5b625a"
ON_DARK = "#f4f5f2"; ON_DARK_MUTE = "#aab1a6"
HAIRLINE = "#3a3f39"

WORDMARK = [("l", None), ("E", YELLOW), ("go", None), ("a", RED), ("r", None), ("C", BLUE), ("h", None)]

def img(*p): return os.path.join(ASSETS, *p)
def rgba(c, a=255):
    r, g, b = ImageColor.getrgb(c); return (r, g, b, a)

# =============================================================================
#  fonts
# =============================================================================
_FC = {}; _WN = {800: "ExtraBold", 700: "Bold", 600: "SemiBold", 500: "Medium", 400: "Regular"}
def font(fam, px, w):
    k = (fam, px, w)
    if k in _FC: return _FC[k]
    f = ImageFont.truetype(os.path.join(FONTS, "Archivo-Bold.ttf" if fam == "Archivo" else "Inter-Regular.ttf"), px)
    try: f.set_variation_by_name(_WN.get(w, "Regular"))
    except Exception: pass
    _FC[k] = f; return f

# =============================================================================
#  low-level primitives (px)
# =============================================================================
def _r(d, box, fill, rad):
    d.rounded_rectangle(box, radius=rad, fill=fill)

def stud(d, cx, cy, r, color, hl=True):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    if hl:
        d.ellipse([cx - r, cy - r, cx + r, cy - r * 0.1], fill=rgba("#ffffff", 60))

def arrow(d, p1, p2, color, w):
    d.line([p1, p2], fill=color, width=w)
    ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0]); L = w * 4.2
    tip = p2
    a = (tip[0] - L * math.cos(ang - 0.5), tip[1] - L * math.sin(ang - 0.5))
    b = (tip[0] - L * math.cos(ang + 0.5), tip[1] - L * math.sin(ang + 0.5))
    d.polygon([tip, a, b], fill=color)

def emblem(d, x, y, size):
    s = size / 64.0
    def plate(px, py, w, h, r, fill):
        _r(d, [x + px * s, y + py * s, x + (px + w) * s, y + (py + h) * s], fill, r * s)
    plate(8, 44, 48, 13, 3, BLUE)
    plate(14, 30, 40, 13, 3, RED)
    plate(20, 16, 30, 13, 3, YELLOW)
    plate(30, 9, 10, 8, 2.5, YELLOW)
    _r(d, [x + 30 * s, y + 9 * s, x + 40 * s, y + 12 * s], rgba("#ffffff", 56), 1.5 * s)

def wordmark(d, x, y, px, base=ON_DARK):
    f = font("Archivo", px, 800); cx = x
    for t, c in WORDMARK:
        d.text((cx, y), t, font=f, fill=(c or base))
        cx += d.textlength(t, font=f)
    return cx - x

# ---- flat line icons (ink-on-plate) ----------------------------------------
def icon(d, name, x, y, size, color):
    p = size * 0.16; st = max(3, int(size * 0.075))
    L, T, R, B = x + p, y + p, x + size - p, y + size - p
    cx, cy = x + size / 2, y + size / 2
    def ell(a, b, c, e, **k): d.ellipse([a, b, c, e], **k)
    if name == "prompt":
        d.rounded_rectangle([L, T, R, B - size * 0.12], radius=st * 2, outline=color, width=st)
        d.polygon([(L + size * 0.16, B - size * 0.14), (L + size * 0.30, B - size * 0.14),
                   (L + size * 0.16, B + size * 0.02)], fill=color)
        for i in range(3):
            xx = L + size * 0.18 + i * size * 0.18
            ell(xx, cy - st, xx + st * 1.4, cy + st * 0.4, fill=color)
    elif name == "image":
        d.rounded_rectangle([L, T, R, B], radius=st, outline=color, width=st)
        ell(R - size * 0.22, T + size * 0.10, R - size * 0.10, T + size * 0.22, fill=color)
        d.line([(L + st, B - st), (cx, T + size * 0.28), (cx + size * 0.16, B - size * 0.18),
                (R - st, B - st)], fill=color, width=st, joint="curve")
    elif name == "cube":
        top = [(cx, T), (R, T + size * 0.18), (cx, T + size * 0.36), (L, T + size * 0.18)]
        d.polygon(top, outline=color, width=st)
        d.line([(L, T + size * 0.18), (L, B - size * 0.18), (cx, B)], fill=color, width=st)
        d.line([(R, T + size * 0.18), (R, B - size * 0.18), (cx, B)], fill=color, width=st)
        d.line([(cx, T + size * 0.36), (cx, B)], fill=color, width=st)
    elif name == "voxel":
        n = 3; g = (R - L) / n
        for i in range(n):
            for j in range(n):
                d.rectangle([L + i * g, T + j * g, L + (i + 1) * g, T + (j + 1) * g], outline=color, width=max(2, st - 1))
    elif name == "brick":
        d.rounded_rectangle([L, cy - size * 0.06, R, B], radius=st, outline=color, width=st)
        for i in (0.3, 0.7):
            ell(L + (R - L) * i - size * 0.07, cy - size * 0.20, L + (R - L) * i + size * 0.07, cy - size * 0.06, outline=color, width=st)
    elif name == "dial":
        d.arc([L, T, R, B], 130, 50, fill=color, width=st)
        d.line([(cx, cy), (cx + size * 0.18, cy - size * 0.12)], fill=color, width=st)
        ell(cx - st, cy - st, cx + st, cy + st, fill=color)
    elif name == "curve":
        pts = [(L + (R - L) * t / 20, cy - math.sin(t / 20 * math.pi * 2) * size * 0.16) for t in range(21)]
        d.line(pts, fill=color, width=st, joint="curve")
    elif name == "blob":
        pts = [(cx + math.cos(a) * (size * 0.30 + (size * 0.05 if i % 2 else -size * 0.03)),
                cy + math.sin(a) * (size * 0.28 + (size * 0.04 if i % 3 else 0)))
               for i, a in enumerate([k * math.pi / 5 for k in range(10)])]
        d.polygon(pts, fill=color)
    elif name == "warning":
        d.polygon([(cx, T), (R, B), (L, B)], outline=color, width=st)
        d.line([(cx, T + size * 0.28), (cx, B - size * 0.30)], fill=color, width=st)
        ell(cx - st * 0.7, B - size * 0.22, cx + st * 0.7, B - size * 0.22 + st * 1.4, fill=color)
    elif name == "die":
        d.rounded_rectangle([L, T, R, B], radius=st * 1.6, outline=color, width=st)
        for fx, fy in [(0.3, 0.3), (0.7, 0.3), (0.5, 0.5), (0.3, 0.7), (0.7, 0.7)]:
            xx, yy = L + (R - L) * fx, T + (B - T) * fy
            ell(xx - st * 0.8, yy - st * 0.8, xx + st * 0.8, yy + st * 0.8, fill=color)
    elif name == "equals":
        for yy in (cy - size * 0.10, cy + size * 0.10):
            d.rounded_rectangle([L, yy - st * 0.8, R, yy + st * 0.8], radius=st, fill=color)
    elif name == "box":
        top = [(cx, T), (R, T + size * 0.16), (cx, T + size * 0.32), (L, T + size * 0.16)]
        d.polygon(top, outline=color, width=st)
        d.line([(L, T + size * 0.16), (L, B - size * 0.16), (cx, B)], fill=color, width=st)
        d.line([(R, T + size * 0.16), (R, B - size * 0.16), (cx, B)], fill=color, width=st)
        d.line([(cx, T + size * 0.32), (cx, B)], fill=color, width=st)
        d.line([(cx, T + size * 0.32), (L, T + size * 0.16)], fill=color, width=max(2, st - 1))
    elif name == "booklet":
        d.line([(cx, T + size * 0.04), (cx, B)], fill=color, width=st)
        for sx in (L, cx):
            d.rounded_rectangle([sx, T, sx + (cx - L), B - size * 0.04], radius=st, outline=color, width=st)
        for i in range(3):
            yy = T + size * 0.18 + i * size * 0.16
            d.line([(L + size * 0.06, yy), (cx - size * 0.06, yy)], fill=color, width=max(2, st - 1))
    elif name == "list":
        for i in range(3):
            yy = T + i * (B - T) / 2.4
            d.rounded_rectangle([L, yy, L + size * 0.12, yy + size * 0.12], radius=2, fill=color)
            d.line([(L + size * 0.22, yy + size * 0.06), (R, yy + size * 0.06)], fill=color, width=st)
    elif name == "shelf":
        for yy in (cy - size * 0.16, B - size * 0.02):
            d.line([(L, yy), (R, yy)], fill=color, width=st)
        for bx in (L + size * 0.04, L + size * 0.30, L + size * 0.42):
            d.rectangle([bx, cy - size * 0.16 - size * 0.16, bx + size * 0.16, cy - size * 0.16], outline=color, width=max(2, st - 1))
    elif name == "mesh":
        d.ellipse([L, T, R, B], outline=color, width=st)
        d.line([(L + size * 0.04, cy), (R - size * 0.04, cy)], fill=color, width=max(2, st - 1))
        d.line([(cx, T + size * 0.02), (cx, B - size * 0.02)], fill=color, width=max(2, st - 1))
        d.line([(L + size * 0.12, T + size * 0.18), (R - size * 0.12, B - size * 0.18)], fill=color, width=max(2, st - 1))
        d.line([(R - size * 0.12, T + size * 0.18), (L + size * 0.12, B - size * 0.18)], fill=color, width=max(2, st - 1))

# =============================================================================
#  spec helpers (fractions). element kinds:
#    rect plate emblem stud line arrow icon photo wordmark dot scatter | text
# =============================================================================
ART = {"rect", "plate", "emblem", "stud", "line", "arrow", "icon", "photo", "wordmark", "dot", "scatter"}

def P(x, y, w, h, fill=SURFACE, rad=14, studs=0, scolor=None, top=None):
    return {"k": "plate", "xy": (x, y, w, h), "fill": fill, "rad": rad, "studs": studs,
            "scolor": scolor, "top": top}
def T(x, y, w, h, t, sz, wt=400, c=ON_DARK, fam="Inter", align="left", va="top", lead=1.3, tr=0.0):
    return {"k": "text", "xy": (x, y, w, h), "t": t, "sz": sz, "w": wt, "c": c, "fam": fam,
            "align": align, "va": va, "lead": lead, "tr": tr}
def IC(name, x, y, s, c=INK):
    return {"k": "icon", "name": name, "xy": (x, y, s, s), "c": c}
def PH(path, x, y, w, h):
    return {"k": "photo", "xy": (x, y, w, h), "path": path}
def AR(p1, p2, c=TAN, w=5):
    return {"k": "arrow", "p1": p1, "p2": p2, "c": c, "w": w}

def header(label, color=YELLOW):
    return [{"k": "emblem", "x": 0.055, "y": 0.05, "h": 0.052},
            T(0.105, 0.052, 0.7, 0.05, label.upper(), 15, 600, color, tr=0.16)]
def footer(page):
    return [{"k": "rect", "xy": (0.055, 0.905, 0.89, 0.0016), "fill": HAIRLINE, "rad": 0},
            {"k": "emblem", "x": 0.055, "y": 0.918, "h": 0.04},
            {"k": "wordmark", "x": 0.092, "y": 0.92, "px": 26},
            T(0.50, 0.922, 0.36, 0.04, "Generative AI · 2026", 12, 400, ON_DARK_MUTE),
            T(0.80, 0.922, 0.145, 0.04, f"{page:02d} / 09", 12, 500, ON_DARK_MUTE, align="right")]
def title(t, sz=40):
    return T(0.055, 0.135, 0.89, 0.12, t, sz, 700, ON_DARK, fam="Archivo")

def data_plate(x, y, w, h, label, value, vsz=34, accent=YELLOW_DK, vcol=INK):
    return [P(x, y, w, h, SURFACE, 14, studs=1, scolor=accent),
            T(x + 0.014, y + 0.028, w - 0.028, 0.05, label.upper(), 12, 600, accent, tr=0.1),
            T(x + 0.014, y + 0.06, w - 0.028, h - 0.07, value, vsz, 700 if vsz >= 30 else 500,
              vcol, fam="Archivo" if vsz >= 30 else "Inter", lead=1.15)]

def flat(xs):
    o = []
    for e in xs: o.extend(e) if isinstance(e, list) else o.append(e)
    return o

# =============================================================================
#  slides
# =============================================================================
def build_slides():
    S = []

    # 1 — TITLE ----------------------------------------------------------
    S.append((flat([
        {"k": "emblem", "x": 0.055, "y": 0.16, "h": 0.26},
        {"k": "wordmark", "x": 0.055, "y": 0.46, "px": 150},
        T(0.058, 0.63, 0.8, 0.08, "Name a building. Get a buildable LEGO set.", 30, 500, TAN),
        T(0.058, 0.73, 0.84, 0.06, "Generative AI proposes the form · deterministic computation proves it's buildable.",
          18, 400, ON_DARK_MUTE),
        T(0.058, 0.90, 0.89, 0.05, "Generative AI · final presentation · Emilie Chidiac & Charles · 2026",
          14, 400, ON_DARK_MUTE),
    ]), "Cold open is LIVE (no slide). This title holds at the very top/tail. Emilie: 'Watch this — I'll name a building, and we build it.'"))

    # 2 — PIPELINE (the spine) -------------------------------------------
    pipe = header("how it works") + [title("Three steps. One build.")]
    pipe += [T(0.055, 0.245, 0.89, 0.05,
               "A model proposes the shape; plain code proves you can actually build it.", 18, 400, TAN)]
    stages = [("prompt", "you name a building", TAN, "prompt"),
              ("FLUX render", "image, LEGO style", BLUE, "image"),
              ("TRELLIS 3D", "rebuild hidden sides", BLUE, "cube"),
              ("voxelize", "grid · colour-match", YELLOW, "voxel"),
              ("brick solve", "real parts · stability", RED, "brick")]
    n = len(stages); x0 = 0.055; pw = 0.158; gap = (0.89 - n * pw) / (n - 1)
    cy, ch = 0.40, 0.30
    for i, (h, g, ac, icn) in enumerate(stages):
        x = x0 + i * (pw + gap)
        pipe += [P(x, cy, pw, ch, SURFACE, 14, top=ac),
                 IC(icn, x + pw / 2 - 0.035, cy + 0.045, 0.07, INK),
                 T(x + 0.012, cy + 0.16, pw - 0.024, 0.06, h, 18, 700, INK, fam="Archivo"),
                 T(x + 0.012, cy + 0.225, pw - 0.024, 0.07, g, 13, 400, INK_SOFT, lead=1.2)]
        if i < n - 1:
            sx = x + pw + gap / 2; sy = cy + ch / 2
            pipe += [{"k": "stud", "cx": sx, "cy": sy, "r": 0.011, "c": ON_DARK_MUTE},
                     AR((x + pw + 0.006, sy), (x + pw + gap - 0.006, sy), TAN, 5)]
    pipe += [T(0.055, 0.76, 0.89, 0.05,
               "blue = generative   ·   yellow = deterministic compute   ·   red = the real catalog",
               15, 500, ON_DARK_MUTE)]
    pipe += footer(2)
    S.append((flat(pipe),
              "Charles: prompt -> FLUX render -> TRELLIS 3D -> voxelize + colour-match -> brick solve. Generative up front, plain deterministic code at the back. That back half is the part we're proud of."))

    # 3 — PROMPT ENGINEERING ---------------------------------------------
    pe = header("we tuned this by hand") + [title("Getting the render right.")]
    pe += [PH(img("ab_cfg.png"), 0.055, 0.30, 0.46, 0.55),
           T(0.055, 0.86, 0.46, 0.05, "same three buildings, one setting swept at a time — winner ringed",
             13, 400, ON_DARK_MUTE),
           IC("dial", 0.55, 0.295, 0.07, YELLOW)]
    pe += data_plate(0.64, 0.31, 0.14, 0.15, "steps", "28", 40)
    pe += data_plate(0.80, 0.31, 0.14, 0.15, "guidance", "5.0", 40)
    pe += data_plate(0.64, 0.49, 0.14, 0.15, "LoRA", "1.0", 40)
    pe += data_plate(0.80, 0.49, 0.14, 0.15, "negative", "on", 40)
    pe += [T(0.55, 0.67, 0.39, 0.16,
             "Turn the LoRA down and the studs literally fade away — that's where the LEGO look lives. "
             "The prompt itself is an 8-part grammar that keeps the shape fused so it survives the 3D step.",
             16, 400, TAN, lead=1.45)]
    pe += footer(3)
    S.append((flat(pe),
              "Charles, conversational: we had to tune this by hand. 28 steps, guidance 5, LoRA at full, negative prompt on. Below 0.75 the studs fade — that's where the LEGO-ness lives."))

    # 4 — COLOUR DENOISE (confetti -> plate) -----------------------------
    co = header("a cleanup step") + [title("Fewer bricks, same building.")]
    # confetti scatter (left)
    conf = []
    import random as _rnd
    rng = _rnd.Random(7)
    cols = [RED, "#e8736a", "#f2a59c", YELLOW, "#8ea9c9", TAN, "#b48f6b"]
    for _ in range(120):
        cx = 0.07 + rng.random() * 0.20; cy = 0.34 + rng.random() * 0.34
        s = 0.006 + rng.random() * 0.006
        conf.append({"k": "rect", "xy": (cx, cy, s, s * W / H), "fill": rng.choice(cols), "rad": 1})
    co += conf
    co += [T(0.07, 0.71, 0.21, 0.05, "every speck = its own 1×1 brick", 14, 400, ON_DARK_MUTE)]
    co += [AR((0.305, 0.50), (0.40, 0.50), TAN, 7)]
    # merged plate (right of arrow)
    co += [P(0.42, 0.345, 0.20, 0.30, SURFACE, 16, studs=4, scolor=RED),
           T(0.42, 0.55, 0.20, 0.06, "merged onto the true colour", 14, 400, INK_SOFT, align="center")]
    # big delta + why
    co += [T(0.66, 0.31, 0.30, 0.045, "up to", 18, 500, TAN),
           T(0.652, 0.35, 0.31, 0.13, "−46%", 78, 700, YELLOW, fam="Archivo"),
           T(0.66, 0.505, 0.30, 0.05, "fewer pieces  ·  −19% on La Muralla", 16, 500, TAN)]
    co += data_plate(0.66, 0.575, 0.285, 0.145, "why fewer is good", "cheaper · simpler to build · no loss of stability", 17)
    co += footer(4)
    S.append((flat(co),
              "Charles: the 3D model bakes in colour speckle, and each speck would force its own brick. We blur it onto the render's true colour first — 19 to 46 percent fewer pieces, and nothing gets wobblier."))

    # 5 — HONEST BOUNDARY (curve -> grid -> blob) ------------------------
    bd = header("where it breaks") + [title("And here's where it falls apart.")]
    panels = [("curve", BLUE, "smooth Gehry curves"), ("voxel", YELLOW_DK, "forced onto a grid"),
              ("blob", "#9aa0a6", "a blob — not Bilbao")]
    px0 = 0.055; ppw = 0.225; pgap = 0.05
    for i, (icn, ic_c, lab) in enumerate(panels):
        x = px0 + i * (ppw + pgap)
        bd += [P(x, 0.32, ppw, 0.30, SURFACE, 16),
               IC(icn, x + ppw / 2 - 0.055, 0.37, 0.11, ic_c),
               T(x, 0.555, ppw, 0.05, lab, 15, 500, INK_SOFT, align="center")]
        if i < 2:
            sy = 0.47; sx = x + ppw + pgap / 2
            bd += [AR((x + ppw + 0.006, sy), (x + ppw + pgap - 0.006, sy), TAN, 6)]
    bd += [IC("warning", 0.72, 0.345, 0.05, RED),
           PH(img("bilbao", "bilbao_build_app.png"), 0.80, 0.30, 0.145, 0.30)]
    bd += [P(0.055, 0.67, 0.89, 0.16, FELT_DEEP, 14),
           T(0.075, 0.69, 0.85, 0.06,
             "Still structurally sound — connected, 93% supported. It just isn't legible.", 19, 500, ON_DARK),
           T(0.075, 0.755, 0.85, 0.06,
             "Voxels can't hold a curve. We like that we know exactly where the method ends.", 15, 400, ON_DARK_MUTE)]
    bd += footer(5)
    S.append((flat(bd),
              "Charles, humble: this is the honest part. Gehry's curves are too smooth for a voxel grid, so Bilbao builds as a blob. It stands up fine — it's just not legible. Knowing the limit is part of the work."))

    # 6 — REPRODUCIBLE (seed equation) -----------------------------------
    rp = header("this surprised us") + [title("Same prompt, same set.")]
    rp += [P(0.055, 0.34, 0.30, 0.30, SURFACE, 16, studs=3, scolor=BLUE),
           IC("die", 0.075, 0.36, 0.07, INK),
           T(0.16, 0.375, 0.18, 0.05, "seed 1001", 18, 700, INK, fam="Archivo"),
           PH(img("muralla", "muralla_build_app.png"), 0.075, 0.45, 0.26, 0.165)]
    rp += [IC("equals", 0.40, 0.45, 0.07, ON_DARK_MUTE)]
    rp += [P(0.49, 0.34, 0.30, 0.30, SURFACE, 16, studs=3, scolor=RED),
           IC("die", 0.51, 0.36, 0.07, INK),
           T(0.595, 0.375, 0.18, 0.05, "seed 2002", 18, 700, INK, fam="Archivo"),
           PH(img("muralla", "muralla_s2002.png"), 0.51, 0.45, 0.26, 0.165)]
    rp += [AR((0.80, 0.49), (0.86, 0.49), TAN, 6),
           T(0.86, 0.40, 0.09, 0.20, "same buildable set", 18, 600, YELLOW, lead=1.25)]
    rp += [T(0.055, 0.70, 0.89, 0.1,
             "A new seed is a different generation — the pieces vary — but it's always a single, connected, "
             "recognizable set. The result is the method, not a lucky seed.", 18, 400, TAN, lead=1.45)]
    rp += footer(6)
    S.append((flat(rp),
              "Charles: same prompt, a different seed -> a different generation but the same outcome: a connected buildable set. Determinism, in a field built on randomness. Honestly, that surprised us."))

    # 7 — SCALE + CATALOG (stud grid) ------------------------------------
    sc = header("buildable means orderable") + [title("Real parts. Three sizes.")]
    # stud grid of 48
    grid = []
    palette = [BLUE, RED, YELLOW, TAN, "#6b8e23", "#5b9bd5", "#c0504d", "#e8a33d",
               "#8064a2", "#4bacc6", "#9bbb59", "#d99694"]
    gx, gy, cols_n, rows_n = 0.055, 0.315, 8, 6
    cw = 0.30 / cols_n
    for r in range(rows_n):
        for c in range(cols_n):
            grid.append({"k": "dot", "cx": gx + c * cw + cw / 2, "cy": gy + r * cw * W / H + cw * W / H / 2,
                         "r": 0.013, "c": palette[(r * cols_n + c) % len(palette)]})
    sc += grid
    sc += [T(0.055, 0.76, 0.30, 0.05, "48 LEGO colours", 16, 600, TAN)]
    sc += data_plate(0.40, 0.34, 0.255, 0.18, "real parts", "44", 56)
    sc += data_plate(0.40, 0.55, 0.255, 0.15, "validated combos", "1,598", 40)
    # scale steps
    sc += [P(0.685, 0.34, 0.26, 0.34, SURFACE, 16)]
    for i, (lab, hh) in enumerate([("24", 0.05), ("32", 0.085), ("48", 0.13)]):
        bx = 0.715 + i * 0.075
        sc += [{"k": "rect", "xy": (bx, 0.55 - hh, 0.05, hh), "fill": [BLUE, RED, YELLOW][i], "rad": 4},
               T(bx - 0.005, 0.565, 0.06, 0.04, lab, 14, 600, INK_SOFT, align="center")]
    sc += [T(0.685, 0.61, 0.26, 0.06, "≈ 2k draft · 4.7k set · 22k flagship", 14, 400, INK_SOFT, align="center")]
    sc += [T(0.685, 0.30, 0.26, 0.04, "one model · three sizes", 13, 500, ON_DARK_MUTE)]
    sc += footer(7)
    S.append((flat(sc),
              "Charles: every piece is a real BrickLink part — 48 colours, 44 parts, 1,598 validated combinations, CIEDE2000-matched. And one model scales from a 2k draft to a 22k flagship."))

    # 8 — CONTACT SHEET (the ending) -------------------------------------
    cs = header("from a sentence to a set") + [title("Everything you get.")]
    cards = [("3D mesh", "mesh", img("muralla", "muralla_mesh_app.png")),
             ("legolized build", "brick", img("muralla", "muralla_build_app.png")),
             ("the boxed set", "box", None),
             ("instruction booklet", "booklet", None),
             ("parts list + price", "list", None),
             ("your shelf", "shelf", None)]
    cw2, chh = 0.283, 0.225; gx2, gy2 = 0.055, 0.30; gpx, gpy = 0.0185, 0.03
    for i, (lab, icn, ph) in enumerate(cards):
        r, c = divmod(i, 3)
        x = gx2 + c * (cw2 + gpx); y = gy2 + r * (chh + gpy)
        cs += [P(x, y, cw2, chh, SURFACE if ph else SUNKEN, 14)]
        if ph:
            cs += [PH(ph, x + 0.008, y + 0.008, cw2 - 0.016, chh - 0.05)]
        else:
            cs += [IC(icn, x + cw2 / 2 - 0.038, y + 0.052, 0.076, "#9aa0a6"),
                   T(x + 0.014, y + 0.02, cw2 - 0.028, 0.03, "add screenshot", 10, 500, "#90978c", tr=0.08)]
        cs += [T(x + 0.014, y + chh - 0.045, cw2 - 0.028, 0.04, lab, 14, 600, INK, fam="Archivo")]
    cs += footer(8)
    S.append((flat(cs),
              "Both. Charles: 'From a sentence—' Emilie: '—to a set you can build.' Emilie: the 3D model, the build, a boxed set, an instruction booklet, a real parts list with a price. An architect's idea becomes a box on your table."))

    # 9 — END CARD -------------------------------------------------------
    S.append((flat([
        {"k": "emblem", "x": 0.435, "y": 0.20, "h": 0.20},
        {"k": "wordmark", "x": "center", "y": 0.46, "px": 120},
        T(0.055, 0.625, 0.89, 0.06, "From a sentence to a set you can build.", 26, 500, TAN, align="center"),
        T(0.055, 0.71, 0.89, 0.05, "Emilie Chidiac · Charles · Generative AI · 2026", 16, 400, ON_DARK_MUTE, align="center"),
    ]), "End card under the final line."))

    return S

# =============================================================================
#  Pillow render
# =============================================================================
def _wrap(d, text, f, maxw, tr=0.0):
    out = []
    for para in text.split("\n"):
        line = ""
        for w in para.split(" "):
            cand = (line + " " + w).strip()
            if d.textlength(cand, font=f) + tr * len(cand) <= maxw or not line:
                line = cand
            else:
                out.append(line); line = w
        out.append(line)
    return out

def draw_text(d, e):
    x, y, w, h = e["xy"]; px = int(round(e["sz"] * PT))
    f = font(e["fam"], px, e.get("w", 400)); tr = e.get("tr", 0.0) * px
    maxw = w * W; lines = _wrap(d, e["t"], f, maxw, tr); lh = px * e.get("lead", 1.2)
    by = y * H
    if e.get("va") == "middle": by += (h * H - lh * len(lines)) / 2
    for i, ln in enumerate(lines):
        ly = by + i * lh; lw = d.textlength(ln, font=f) + tr * len(ln); lx = x * W
        if e.get("align") == "center": lx += (maxw - lw) / 2
        elif e.get("align") == "right": lx += (maxw - lw)
        if tr:
            cx = lx
            for ch in ln:
                d.text((cx, ly), ch, font=f, fill=e["c"]); cx += d.textlength(ch, font=f) + tr
        else:
            d.text((lx, ly), ln, font=f, fill=e["c"])

def fit(iw, ih, bx, by, bw, bh):
    ar, bar = iw / ih, bw / bh
    if ar > bar: w = bw; hh = bw / ar
    else: hh = bh; w = bh * ar
    return bx + (bw - w) / 2, by + (bh - hh) / 2, w, hh

def draw_art(base, d, e):
    k = e["k"]
    if k == "rect":
        x, y, w, h = e["xy"]; _r(d, [x * W, y * H, (x + w) * W, (y + h) * H], e["fill"], e.get("rad", 0))
    elif k == "plate":
        x, y, w, h = e["xy"]; _r(d, [x * W, y * H, (x + w) * W, (y + h) * H], e["fill"], e["rad"])
        if e.get("top"):
            _r(d, [x * W, y * H, (x + w) * W, y * H + 9], e["top"], e["rad"])
            d.rectangle([x * W, y * H + 5, (x + w) * W, y * H + 9], fill=e["top"])
        for i in range(e.get("studs", 0)):
            n = e["studs"]; sx = (x + w * (i + 0.5) / n) * W
            stud(d, sx, y * H - 7, 9, e.get("scolor") or YELLOW)
    elif k == "stud":
        stud(d, e["cx"] * W, e["cy"] * H, e["r"] * W, e["c"])
    elif k == "dot":
        r = e["r"] * W; cx, cy = e["cx"] * W, e["cy"] * H
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=e["c"])
        d.ellipse([cx - r, cy - r, cx + r, cy - r * 0.2], fill=rgba("#ffffff", 55))
    elif k == "line":
        d.line([(e["p1"][0] * W, e["p1"][1] * H), (e["p2"][0] * W, e["p2"][1] * H)], fill=e["c"], width=e["w"])
    elif k == "arrow":
        arrow(d, (e["p1"][0] * W, e["p1"][1] * H), (e["p2"][0] * W, e["p2"][1] * H), e["c"], e["w"])
    elif k == "icon":
        x, y, s, _ = e["xy"]; icon(d, e["name"], x * W, y * H, s * W, e["c"])
    elif k == "emblem":
        emblem(d, e["x"] * W, e["y"] * H, e["h"] * H)
    elif k == "wordmark":
        xx = e["x"]
        if xx == "center":
            f = font("Archivo", e["px"], 800); tw = sum(d.textlength(t, font=f) for t, _ in WORDMARK)
            xx = (W - tw) / 2 / W
        wordmark(d, xx * W, e["y"] * H, e["px"])
    elif k == "photo":
        x, y, w, h = e["xy"]; bx, by, bw, bh = x * W, y * H, w * W, h * H
        im = Image.open(e["path"]).convert("RGB")
        fx, fy, fw, fh = fit(im.width, im.height, bx, by, bw, bh)
        _r(d, [fx - 10, fy - 10, fx + fw + 10, fy + fh + 10], SURFACE, 12)
        base.paste(im.resize((max(1, int(fw)), max(1, int(fh))), Image.LANCZOS), (int(fx), int(fy)))

def render(elements, do_text=True, do_art=True):
    base = Image.new("RGB", (W, H), FELT); d = ImageDraw.Draw(base, "RGBA")
    for e in elements:
        if e["k"] in ART and do_art: draw_art(base, d, e)
        elif e["k"] == "text" and do_text: draw_text(d, e)
    return base

def build_pdf(slides):
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    os.makedirs(SLIDE_DIR, exist_ok=True)
    pg = (IN_W * 72, IN_H * 72); c = canvas.Canvas(OUT_PDF, pagesize=pg)
    for i, (els, _) in enumerate(slides, 1):
        im = render(els, True, True); p = os.path.join(SLIDE_DIR, f"slide_{i:02d}.png"); im.save(p)
        c.drawImage(ImageReader(p), 0, 0, width=pg[0], height=pg[1]); c.showPage()
    c.save(); print(f"PDF  -> {OUT_PDF}  ({len(slides)} slides)")

def build_pptx(slides):
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
    def rc(c): return RGBColor.from_string(c.lstrip("#").upper())
    prs = Presentation(); prs.slide_width = Inches(IN_W); prs.slide_height = Inches(IN_H)
    blank = prs.slide_layouts[6]; os.makedirs(SLIDE_DIR, exist_ok=True)
    for i, (els, notes) in enumerate(slides, 1):
        bg = render(els, do_text=False, do_art=True)
        bp = os.path.join(SLIDE_DIR, f"bg_{i:02d}.png"); bg.save(bp)
        s = prs.slides.add_slide(blank)
        s.shapes.add_picture(bp, 0, 0, Inches(IN_W), Inches(IN_H))
        for e in els:
            if e["k"] != "text": continue
            x, y, w, h = e["xy"]
            tb = s.shapes.add_textbox(Inches(x * IN_W), Inches(y * IN_H), Inches(w * IN_W), Inches(h * IN_H))
            tf = tb.text_frame; tf.word_wrap = True
            tf.margin_top = 0; tf.margin_bottom = 0; tf.margin_left = 0; tf.margin_right = 0
            tf.vertical_anchor = MSO_ANCHOR.MIDDLE if e.get("va") == "middle" else MSO_ANCHOR.TOP
            for j, line in enumerate(e["t"].split("\n")):
                p = tf.paragraphs[0] if j == 0 else tf.add_paragraph()
                p.alignment = {"center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}.get(e.get("align"), PP_ALIGN.LEFT)
                p.line_spacing = e.get("lead", 1.1)
                rn = p.add_run(); rn.text = line
                rn.font.name = e["fam"]; rn.font.size = Pt(e["sz"])
                rn.font.bold = e.get("w", 400) >= 600; rn.font.color.rgb = rc(e["c"])
        if notes: s.notes_slide.notes_text_frame.text = notes
    prs.save(OUT_PPTX); print(f"PPTX -> {OUT_PPTX}  ({len(slides)} slides)")

if __name__ == "__main__":
    sl = build_slides(); build_pdf(sl); build_pptx(sl); print("done.")
