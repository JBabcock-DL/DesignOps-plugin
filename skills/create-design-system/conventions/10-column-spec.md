# 10. Column specs per page (every set sums to 1640)

Structured widths also live in [`column-widths.json`](./column-widths.json) for quick lookup — read JSON first when you only need numbers; keep this file for cell-pattern notes.

### ↳ Primitives

**Color ramps** — one table per ramp (`primary`, `secondary`, `tertiary`, `error`, `neutral`); 11 rows each (stops 50 → 950):

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `TOKEN` | 320 | Doc/Code — path (`color/primary/500`) |
| 2 | `SWATCH` | 96 | 48×48 rounded-rect · cornerRadius 10 · stroke `color/border/subtle` · fill bound to the row's Primitives variable |
| 3 | `HEX` | 120 | Doc/Code — uppercase hex |
| 4 | `WEB` | 360 | Doc/Code — `var(--color-primary-500)` |
| 5 | `ANDROID` | 340 | Doc/Code |
| 6 | `iOS` | 404 | Doc/Code |

**Space / Radius / Elevation / Typeface / Font weight** (one table each):

| Slug | Col widths (sum 1640) |
|---|---|
| `primitives/space` | TOKEN 260 · VALUE 100 · PREVIEW 260 · WEB 340 · ANDROID 320 · iOS 360 |
| `primitives/radius` | TOKEN 260 · VALUE 100 · PREVIEW 260 · WEB 340 · ANDROID 320 · iOS 360 |
| `primitives/elevation` | TOKEN 260 · VALUE 100 · WEB 400 · ANDROID 380 · iOS 500 |
| `primitives/typeface` | TOKEN 320 · SPECIMEN 460 · VALUE 200 · WEB 320 · ANDROID 160 · iOS 180 |
| `primitives/font-weight` | TOKEN 260 · VALUE 100 · WEB 400 · ANDROID 380 · iOS 500 |

- Space PREVIEW: bar height 16, cornerRadius 4, fill `color/primary/200` (bound); width bound to the `Space/*` variable (or resolved px clamped to 200).
- Radius PREVIEW: 64×64 square, fill `color/neutral/100`, stroke `color/border/subtle`; `cornerRadius` bound to the `Corner/*` variable.
- Typeface SPECIMEN: single line `"The quick brown fox jumps over 1234567890"` at 24px using the bound typeface primitive.
- Font weight **VALUE:** `Doc/Code` — resolved numeric weight (**500** for `font/weight/medium`). **WEB / ANDROID / iOS:** from that variable’s `codeSyntax` (Step 11). Same cell layout pattern as Elevation (no swatch).

### ↳ Theme (one table per semantic group — 7 tables)

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `TOKEN` | 320 | Doc/Code — Figma path |
| 2 | `LIGHT` | 140 | See §12 in [`11-cells-12-bindings-13-build-order.md`](./11-cells-12-bindings-13-build-order.md) (Theme swatch pattern — mode-scoped wrapper + hex sibling) |
| 3 | `DARK` | 140 | Same structure with Dark modeId. **Hex text MUST stay outside the wrapper.** |
| 4 | `ALIAS →` | 260 | Doc/Code — resolved alias path(s); separate modes with ` · ` when they differ |
| 5 | `WEB` | 320 | Doc/Code |
| 6 | `ANDROID` | 220 | Doc/Code |
| 7 | `iOS` | 240 | Doc/Code — fully dot-separated |

**Sum: 320 + 140 + 140 + 260 + 320 + 220 + 240 = 1640.** Row `minHeight 64`, `paddingV 16`, `counterAxisAlignItems: CENTER`. Cell `paddingH: 20` uniformly (do not drop to 16 — that is the crowding source).

### ↳ Layout (two tables — `layout/spacing`, `layout/radius`)

| Col | Header | Width |
|---|---|---|
| 1 | `TOKEN` | 280 |
| 2 | `VALUE` | 100 |
| 3 | `ALIAS →` | 280 |
| 4 | `PREVIEW` | 240 |
| 5 | `WEB` | 320 |
| 6 | `ANDROID` | 220 |
| 7 | `iOS` | 200 |

**Sum: 1640.** Previews: spacing bar (bound width), radius square (bound cornerRadius) — same patterns as Primitives.

### ↳ Text Styles (single table `typography/styles`, 27 specimen rows + 5 sub-headers)

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `SLOT` | 220 | Doc/TokenName — slot name (`Headline/LG`, `Body/LG/strikethrough`) |
| 2 | `SPECIMEN` | 360 | TEXT with `textStyleId` → published slot style; characters = slot name prose; resize(320, 1) → `textAutoResize = 'HEIGHT'` |
| 3 | `SIZE / LINE` | 140 | VERTICAL stack — two Doc/Code lines: `{size}px` / `{lineHeight}px` |
| 4 | `WEIGHT / FAMILY` | 180 | VERTICAL stack — two Doc/Code lines: `{weight}` / `{family}` |
| 5 | `WEB` | 280 | Doc/Code |
| 6 | `ANDROID` | 200 | Doc/Code |
| 7 | `iOS` | 260 | Doc/Code — 5- to 6-segment dot path |

**Sum: 1640.** Row order: 3 Display + 3 Headline + 3 Title + 15 Body + 3 Label, with **5 category sub-header rows** (full-width 1640 × 40, fill `color/background/variant`) preceding each category.

**Body block order per size (fixed):** `regular → emphasis → italic → link → strikethrough`. Regular is always first so the reader sees the default before decorated variants.

**Specimen fill binding (variants only — critical):**
- `/link` rows → bind specimen fill to `color/primary/default` (the brand hue, NOT `color/primary/content` which is the text-on-primary pairing)
- `/strikethrough` rows → bind to `color/background/content-muted`
- Base / `/emphasis` / `/italic` rows → leave default `color/background/content`

### ↳ Effects

**`effects/shadows` (5 rows — `sm`, `md`, `lg`, `xl`, `2xl`):**

| Col | Header | Width |
|---|---|---|
| 1 | `TIER` | 140 |
| 2 | `LIGHT` | 180 |
| 3 | `DARK` | 180 |
| 4 | `BLUR` | 120 |
| 5 | `ALIAS →` | 200 |
| 6 | `WEB` | 300 |
| 7 | `ANDROID` | 260 |
| 8 | `iOS` | 260 |

**Sum: 1640.** LIGHT/DARK cells: `doc/effect-preview/{mode}/{tier}` wrapper with explicit Effects mode → 88×88 card `cornerRadius 12` fill `color/background/default` `effectStyleId Effect/shadow-{tier}` + small Doc/Code label inside.

**`effects/color` (1 row — `shadow/color`):** TOKEN 320 · LIGHT 180 · DARK 180 · VALUE 220 · WEB 320 · ANDROID 220 · iOS 200 (**sum 1640**). Swatch chip + hex pattern, 32×32 chip bound to `shadow/color` in each mode's wrapper.
