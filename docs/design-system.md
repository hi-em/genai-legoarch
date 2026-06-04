# lEgoarCh design system

Grounded in deep research on LEGO's real visual language (cited below). Goal: read as an **architecture set**, not a toy bin — and stay **trademark-safe**.

## Brand
- **Wordmark:** `lEgoarCh` — the capital **E** (red tile) and **C** (yellow tile) stand for **E**milie and **C**harles. This is our own mark; we never use the LEGO logo.
- **Mark:** an abstract 2×2 brick (`public/brick.svg`) — deliberately **not** the trademarked 2×4 silhouette.

## Color tokens (brick-accurate, LDraw)
Lean on neutrals; red/yellow are *sparing accents only*.

| Token | Hex | Role |
|---|---|---|
| `--c-white` | `#f4f5f2` | pearl-white plate (cards) |
| `--c-pearl` | `#e7e9e4` | tiles / insets |
| `--c-lbg` | `#a0a5a9` | Light Bluish Gray (LDraw) |
| `--c-dbg` | `#6c6e68` | Dark Bluish Gray |
| `--c-stone` | `#4b4f4c` | header / ink surfaces |
| `--c-tan` | `#e4cd9e` | Tan / Brick Yellow |
| `--c-red` | `#b40000` | brick "Bright Red" — primary CTA only |
| `--c-yellow` | `#f6c700` | active state / highlight |

> Note: `#b40000` is the *brick* red (authentic), distinct from LEGO's *logo* red `#e3000b`. We use the brick red so surfaces read "built", not "branded".

## Geometry tokens (physical brick → CSS)
- **Module:** 8 mm stud pitch → **8 px spacing grid** (`--u: 8px`; all spacing in multiples).
- **Brick : plate = 3 : 1** (9.6 mm : 3.2 mm) → row-height ratio for brick vs plate UI.
- **Fillets:** small radii — `--r: 6px`, `--r-lg: 12px`.
- **Studs:** decorative Ø ≈ 60% of pitch (`--stud: 15px`), rendered with a top highlight.
- **Matte-ABS elevation:** inset top highlight + a *grounded* hard-offset shadow + soft ambient (`--shadow-plate`, `--shadow-brick`). Cards look **snapped onto** the baseplate, not floating.

## Type
LEGO's "Typewell" font isn't licensable → free substitutes:
- **Nunito** (rounded, friendly) — display / wordmark / headings.
- **DM Sans** — body copy.

## Icons
**Lucide** (24×24, 2 px stroke, round caps + round joins) — the round geometry optically matches brick fillets. No emojis anywhere.

## Do / Don't (tasteful + trademark-safe)
**Do**
- Use brick-accurate neutrals with red/yellow as accents.
- Make cards feel like plates (studs, ABS bevel, grounded shadow).
- Use "LEGO" only as an adjective ("built of LEGO bricks").
- Keep the footer disclaimer on every page.

**Don't**
- ❌ Use the LEGO logo (no non-commercial carve-out — ever).
- ❌ Depict the minifigure or the exact 2×4 brick silhouette.
- ❌ Say "LEGOs" or use "LEGO" as a noun.
- ❌ Drown the UI in saturated primary colors ("toy bin").

## Sources
- LEGO Fair Play & personal-projects policy (trademark rules): https://www.lego.com/en-us/legal/notices-and-policies/fair-play
- BrickLink color catalog (214 colors): https://www.bricklink.com/catalogColors.asp
- Swooshable / Ryan Howerter color cross-reference: https://swooshable.com/parts/colors
- Brick dimensions (3:1 plate ratio, 8 mm module): https://www.bricklink.com/help.asp?helpID=261
- Lucide icon design guide: https://lucide.dev/contribute/icon-design-guide
