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
| 2 | `LIGHT` | 140 | See §12 in [`11-cells-12-bindings-13-build-order.md`](./11-cells-12-bindings-13-build-order.md) (Theme swatch pattern — mode-scoped wrapper + hex sibling). **Cell frame must stay FIXED 140 wide** (chip wrapper 28 + gap + hex); never let the LIGHT/DARK cell Hug wider than 140 or the row misaligns and iOS clips. |
| 3 | `DARK` | 140 | Same structure with Dark modeId. **Hex text MUST stay outside the wrapper.** Same **FIXED 140** width rule as LIGHT. |
| 4 | `ALIAS →` | 260 | Doc/Code — when Light and Dark alias targets **differ**, show `primitiveLight - primitiveDark` (plain paths, hyphen). When only one side aliases, prefix with `↳ `. When both match, single `↳ path`. |
| 5 | `WEB` | 320 | Doc/Code |
| 6 | `ANDROID` | 220 | Doc/Code |
| 7 | `iOS` | 240 | Doc/Code — fully dot-separated |

**Sum: 320 + 140 + 140 + 260 + 320 + 220 + 240 = 1640.** Row `minHeight 64`, `paddingV 16`, `counterAxisAlignItems: CENTER`. Cell `paddingH: 20` uniformly (do not drop to 16 — that is the crowding source).

### ↳ Layout (two tables — `layout/spacing`, `layout/radius`)

| Col | Header | Width |
|---|---|---|
| 1 | `TOKEN` | 280 |
| 2 | `VALUE` | 100 |
| 3 | `ALIAS →` | 280 | Header label must use the arrow character **→** (`ALIAS →`), not `ALIAS` alone. |
| 4 | `PREVIEW` | 240 |
| 5 | `WEB` | 320 |
| 6 | `ANDROID` | 220 |
| 7 | `iOS` | 200 |

**Sum: 1640.** Previews: spacing bar (bound width), radius square (bound cornerRadius) — same patterns as Primitives.

### ↳ Text Styles (single table `typography/styles`, 27 specimen rows + 5 sub-headers)

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `SLOT` | 220 | Doc/TokenName — slot name (`Headline/LG`, `Body/LG/strikethrough`) |
| 2 | `SPECIMEN` | 360 | TEXT with `textStyleId` → published slot style. **Copy (gold):** Display / Headline / Title → `Aa Gg 12`. Body (all variants) and Label → `The quick brown fox jumps over the lazy dog.` (not the slot path as specimen). `resize(colW-40, 1)` → `textAutoResize = 'HEIGHT'`. |
| 3 | `SIZE / LINE` | 140 | **Single** Doc/Code line: `{fontSize} / {lineHeight}px` (e.g. `57 / 64px`) — gold standard is one line, not a two-line stack. |
| 4 | `WEIGHT / FAMILY` | 180 | **Single** Doc/Code line: `{weight} / {family}` (e.g. `400 / Inter`). |
| 5 | `WEB` | 280 | Doc/Code |
| 6 | `ANDROID` | 200 | Doc/Code |
| 7 | `iOS` | 260 | Doc/Code — 5- to 6-segment dot path |

**Sum: 1640.** **Page group title (gold):** `Type Styles` (not “Typography styles”). Row order: 3 Display + 3 Headline + 3 Title + 15 Body + 3 Label, with **5 category sub-header rows** (full-width 1640 × 40, fill `color/background/variant`) preceding each category — **sentence-case** category label on `Doc/Caption` (e.g. `Display`, `Body`), not all-caps unless the brand template says otherwise.

**Body block order per size (fixed):** `regular → emphasis → italic → link → strikethrough`. Regular is always first so the reader sees the default before decorated variants.

**Specimen fill binding (variants only — critical):**
- `/link` rows → bind specimen fill to `color/primary/default` (the brand hue, NOT `color/primary/content` which is the text-on-primary pairing)
- `/strikethrough` rows → bind to `color/background/content-muted`
- Base / `/emphasis` / `/italic` rows → leave default `color/background/content`

### ↳ Effects

**`effects/shadows` (5 rows — token paths `shadow/{tier}/blur`):**

| Col | Header | Width |
|---|---|---|
| 1 | `TOKEN` | 140 |
| 2 | `LIGHT` | 180 |
| 3 | `DARK` | 180 |
| 4 | `BLUR` | 120 |
| 5 | `ALIAS →` | 200 |
| 6 | `WEB` | 300 |
| 7 | `ANDROID` | 260 |
| 8 | `iOS` | 260 |

**Sum: 1640.** Row **TOKEN** cells show the full variable path (e.g. `shadow/sm/blur`). **BLUR** column: resolved numeric blur from the row variable (Effects · Light), formatted with `px`. LIGHT/DARK cells: `doc/effect-preview/{mode}/{tier}` wrapper calls `setExplicitVariableModeForCollection` for **Effects** · Light/Dark. The **`doc/effect-preview/{mode}/{tier}`** wrapper itself (e.g. **`doc/effect-preview/light/sm`**) must **not** stay `fills = []` — bind the same surface as the mat (**Theme ·** `color/background/default` for **light/***, **Primitives ·** `color/neutral/950` for **dark/***) so the full **180×96** preview chrome reads as white vs black, `cornerRadius` **12**, and **center** the mat child on both axes. **Gold contrast:** insert **`doc/effect-preview-mat/{light|dark}`** (96×96 · `cornerRadius` 12 · `clipsContent`) inside the wrapper — mat repeats the same surface fill — then parent the **88×88** card inside the mat (centered). Card fill: **Light** → `color/background/default`; **Dark** → `color/neutral/900` (slightly above the mat) so the drop shadow reads against a clearly **white vs near-black** field. Card keeps `effectStyleId Effect/shadow-{tier}`. Table caption should mention that previews resolve in Light and Dark Effects modes.

**`effects/color` (1 row — `shadow/color`) — 6 columns (gold, sum 1640):** TOKEN 320 · LIGHT 220 · DARK 220 · WEB 340 · ANDROID 280 · iOS 260. **No separate VALUE column** — LIGHT/DARK each use mode-scoped wrapper + **32×32** chip bound to `shadow/color` + **rgba(...)** text sibling (resolved alpha differs Light vs Dark). Use the **same mat treatment** behind the chip (40×40 mat · `neutral/950` vs `background/default`) so Light/Dark columns do not both read as white-on-white. Platform columns from `codeSyntax`.
