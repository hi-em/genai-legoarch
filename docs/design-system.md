# lEgoarCh design system

Grounded in research on LEGO's real visual language (cited below). Goal: read as a **premium architecture set on a table**, not a toy bin — and stay **trademark-safe**. The source of truth is `frontend/src/styles/tokens.css` (with a JS mirror in `frontend/src/lib/tokens.js` for three.js).

## Brand
- **Wordmark:** `lEgoarCh` — the accented capital **E** and **C** stand for **E**milie and **C**harles. Our own mark; we never use the LEGO logo.
- **Mascot:** **BrickBuddy**, an abstract 2×2 brick with a face (inline SVG) — deliberately **not** the trademarked minifigure or the 2×4 brick silhouette.

## Colour tokens (the real values in `tokens.css`)
Neutrals carry the UI; brand accents are used sparingly.

| Token | Hex | Role |
|---|---|---|
| `--surface` | `#f4f5f2` | pearl-white plate (cards) |
| `--elevated` | `#ffffff` | inner cards / modals |
| `--sunken` | `#e7e9e4` | tiles / insets |
| `--table` / `--table-deep` | `#2b2f2c` / `#20241f` | dark **felt** build-table surface (the hero backdrop) |
| `--ink` / `--muted` | `#20262b` / `#5a6168` | text on light |
| `--on-dark` | `#e9ebe6` | text on the felt |
| `--brand-red` | `#c91a09` | LDraw "Bright Red" — primary CTA only |
| `--brand-yellow` | `#f6c700` | active state / highlight / mascot |
| `--brand-blue` | `#1e5aa8` | progress / focus / links |
| `--brand-tan` | `#e4cd9e` | secondary warmth |
| baseplate | edge `#4e6743` · top `#6f8a5f` · stud `#7c9669` | muted-green studded baseplate in the 3D viewers |

The box-art trophy uses its own matte-black surface (`#0e0f0e`) to read as an official Architecture box.

## Geometry tokens (physical brick → CSS)
- **Module:** 8 mm stud pitch → **8 px spacing grid** (`--u: 8px`; spacing in multiples).
- **Fillets:** small radii — `--r: 6px`; pill `999px`; a LEGO-stud radius for loaders.
- **Matte-ABS elevation:** inset top highlight + grounded hard-offset shadow + soft ambient (`--shadow-plate`, `--shadow-brick`, `--shadow-pop`). Cards read **snapped onto** the table, not floating.
- **Felt:** the dark hero surface carries a faint stud-grid texture + vignette (premium table, not plastic bin).

## Type
- **Nunito** (rounded) — display / wordmark / headings.
- **DM Sans** — body copy.

## Motion & sound
- Motion vocabulary in `lib/motion.js` (spring presets `snap`/`soft`/`bouncy`; standard easings). All animation respects `prefers-reduced-motion`.
- Synthesized **snap** (per assembled course) and **pop** (on reveal / add-to-shelf) via Web Audio (`lib/sound.js`); a **mute** toggle lives in the header.

## Icons
**Lucide** (24×24, 2 px stroke, round caps/joins) — the round geometry matches brick fillets. No emojis.

## Component kit (lean, in `components/ui/`)
`Button` · `Chip` · `Textarea` · `StatTile` · `StudLoader` · `Tooltip` · `Toast`. The old infinite-canvas screens and their one-off components were removed in the rebuild.

## Do / Don't (tasteful + trademark-safe)
**Do** — brick-accurate neutrals with red/yellow/blue as sparing accents; cards that feel like plates; "LEGO" only as an adjective ("built of LEGO bricks"); keep the footer disclaimer.

**Don't** — ❌ the LEGO logo (no carve-out, ever) · ❌ the minifigure or the exact 2×4 silhouette · ❌ "LEGOs" or "LEGO" as a noun · ❌ a saturated-primary "toy bin".

## Sources
- LEGO Fair Play / personal-projects policy: https://www.lego.com/en-us/legal/notices-and-policies/fair-play
- BrickLink colour catalog (214 colours): https://www.bricklink.com/catalogColors.asp
- Swooshable / Ryan Howerter colour cross-reference: https://swooshable.com/parts/colors
- Brick dimensions (8 mm module, 3:1 plate ratio): https://www.bricklink.com/help.asp?helpID=261
- Lucide icon design guide: https://lucide.dev/contribute/icon-design-guide
