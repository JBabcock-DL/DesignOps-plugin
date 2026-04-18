# Design System Conventions — Quick Reference

> **Audience:** AI agents (Claude, Sonnet, etc.) ramping up on `/new-project`, `/create-design-system`, or `/sync-design-system`. Read this **before** running any of those skills so you match the house style on the first pass.
>
> **Authoritative source:** [`skills/create-design-system/SKILL.md`](./SKILL.md) — this file is a curated summary. When it disagrees with the skill, the skill wins.

---

## 1. Five variable collections (the only collections you ever create)

| Collection   | Modes                                                  | Contents                                                                                                                                   |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Primitives` | Default                                                | Raw color ramps (50–950), `Space/*`, `Corner/*`, `elevation/*` floats, `typeface/display` + `typeface/body` STRING primitives              |
| `Theme`      | **Light**, **Dark**                                    | 54 semantic color aliases in 7 groups (`background/`, `border/`, `primary/`, `secondary/`, `tertiary/`, `error/`, `component/`)            |
| `Typography` | **85 · 100 · 110 · 120 · 130 · 150 · 175 · 200**       | 15 M3 slots (Display / Headline / Title / Body / Label × LG/MD/SM) × 4 properties — `font-family` aliases `typeface/*`; sizes scale per mode |
| `Layout`     | Default                                                | `space/*` + `radius/*` semantic aliases into Primitives                                                                                   |
| `Effects`    | **Light**, **Dark**                                    | `shadow/color` (opacity per mode) + `shadow/{tier}/blur` aliases into `elevation/*`                                                         |

**Never create** `Web`, `Android/M3`, or `iOS/HIG` alias collections — platform mapping lives on each variable's `codeSyntax`.

---

## 2. `codeSyntax` is explicit and MANDATORY on every variable

Figma API fact: `codeSyntax` is **read-only** from `use_figma`. Set it via the **Variables REST API** (`PUT /v1/files/:key/variables`) — that is the only path that works.

Every variable carries three strings: **WEB**, **ANDROID**, **iOS**.

### WEB — Tailwind-friendly CSS custom property

```
var(--color-background-container-high)
var(--headline-lg-font-size)
var(--space-md)
```

Single `--color-*` namespace so values drop straight into [Tailwind v4 `@theme`](https://tailwindcss.com/docs/theme).

### ANDROID — kebab-case M3 role

```
surface-container-high
on-primary
headline-lg-font-size
space-md
```

Same semantic roles as [Jetpack Compose `ColorScheme`](https://developer.android.com/jetpack/compose/designsystems/material3), but **kebab-case**, never Compose API camelCase (`surfaceContainerHigh` is wrong).

### iOS — fully dot-separated lowercase path (NEVER camelCase)

The rule: **every word is its own segment separated by a period.** Split on both `/` and kebab `-`; lowercase every tail segment; keep only the top-level domain capitalized.

```
.Background.container.high
.Status.on.error.fixed.muted
.Typography.headline.lg.font.size
.Corner.extra.small
.Font.weight.medium
```

**Wrong:** `.Background.containerHigh` · `.Status.onErrorFixedMuted` · `.Typography.headline.lg.fontSize` · `.Corner.extraSmall` · `.FontWeight.medium`

If you find yourself typing a camelCase segment in an iOS codeSyntax string, stop and flatten it.

### Theme codeSyntax is set from a **table**, not derived from the path

The Figma path (`color/background/content-muted`) is a **designer label**. The three `codeSyntax` values are **independent**:

| Figma path                      | WEB                            | ANDROID              | iOS                      |
| ------------------------------- | ------------------------------ | -------------------- | ------------------------ |
| `color/background/content-muted` | `var(--color-content-muted)`  | `on-surface-variant` | `.Foreground.secondary`  |
| `color/primary/subtle`          | `var(--color-primary-subtle)`  | `primary-container`  | `.Primary.subtle`        |
| `color/error/default`           | `var(--color-danger)`          | `error`              | `.Status.error`          |

Always read Theme codeSyntax from **Step 6** in `SKILL.md`. Never transform the path.

---

## 3. Style-guide canvas geometry (the only widths you use)

The five style-guide pages (`↳ Primitives`, `↳ Theme`, `↳ Layout`, `↳ Text Styles`, `↳ Effects`) share one rigid geometry. New projects, existing projects, sync redraws — all use these numbers.

| Layer             | Width       | Notes                                                                                                   |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Page canvas       | **1800px**  | `_Header` and `_PageContent` both span this column.                                                     |
| `_Header` instance | **1800px**  | `layoutMode: VERTICAL`, **FIXED height 320**, **`cornerRadius: 0`** (square bottom seam).              |
| `_PageContent`     | **1800px**  | `x: 0, y: 320`, padding **80 on all 4 sides**, `itemSpacing: 48`, fill `#FFFFFF` literal (not tokened). |
| Inner content      | **1640px**  | `1800 − 80 − 80`. Every table / doc group renders at 1640 wide.                                         |
| Table header row   | **1640px**  | `FIXED width 1640`, height 56.                                                                          |
| Table body row     | **1640px**  | `FIXED width 1640`, `AUTO` height, `minHeight: 64`, `counterAxisAlignItems: CENTER`.                    |

Column widths per table are defined in §11 below. **Every table column set sums to exactly 1640.** If you redesign a column, the sum must still equal 1640.

### TOC + Token Overview use the same outer width

| Page               | `_PageContent` width | Inner content | Padding (all 4 sides) | `y` | Fill |
| ------------------ | -------------------- | ------------- | --------------------- | --- | ---- |
| `📝 Table of Contents` | **1800**          | **1720**      | **40**                | **320** | **`#FFFFFF` literal** (not tokened) |
| `↳ Token Overview` | **1800**            | **1720**      | **40**                | **320** | **`#FFFFFF` literal** (not tokened) |

(Padding is 40 on all 4 sides of these index pages, not 80. Only the **style guide** pages use 80. `_PageContent.y = 320` matches the style-guide seam — `_Header` ends at 320, `_PageContent` starts at 320 with zero gap. `_PageContent` fill is **literal `#FFFFFF`** — do **not** bind to `color/background/default`; the token may resolve to an off-white tint and will break the visual match with the rest of the documentation.)

### TOC + Token Overview render with the same chrome as style-guide pages

Both pages now follow the full style-guide visual language — there is **no** "simpler" markup path for index pages:

| Element                               | Treatment                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every text node                       | Assigns `textStyleId` to `Doc/Section`, `Doc/TokenName`, `Doc/Code`, or `Doc/Caption` (§ 7); raw `fontName`/`fontSize` only as a **scaffold-time fallback** that `/create-design-system` Step 17 upgrades. |
| Every fill and stroke                 | `setBoundVariable` against Theme · Light or Primitives (§ 12); hex literals are fallbacks.                                                                |
| Section shells / cards / panels / tables | `cornerRadius 16` outer, bound `color/background/default` fill + `color/border/subtle` stroke + `effectStyleId: Effect/shadow-sm` once § G Depth is published. |
| Token Overview platform-mapping table | Uses the full § H hierarchy — `doc/table/token-overview/platform-mapping` → `header` → `body` → `row/{tokenPath}` → `cell/{key}` — no absolute `x`/`y` positioning, row `minHeight 64`, cell `paddingH 20`, last row has no bottom stroke. Columns sum to **1640** (TOKEN 400 · WEB 420 · ANDROID 340 · iOS 480). |
| TOC band strips                       | **64px full-width strips** named `band-strip/{foundations\|atoms\|components\|platform}` with fill `color/background/variant` and `cornerRadius 12`, containing a `Doc/Caption` uppercase title (letter-spacing +0.08em) over a `Doc/Caption` subtitle + right-aligned `Doc/Code` count. Each strip is followed by a **`band-list/{slug}`** — a **single-column VERTICAL stack** of full-width **`toc-card/{title}`** section cards (each card spans the full **1720** inner width; no 2-column grid). Section cards hug their content height; there is no `band-grid` wrapper. |
| TOC section card                      | Full-width card (**1720** × auto) with `cornerRadius 16`, bound `color/background/default` fill + `color/border/subtle` stroke + `shadow-sm`, `padding 24` all sides. Header: `Doc/Section` title + 1px underline in `color/border/subtle`. Body: stacked **`toc-link/{page}`** rows (HORIZONTAL auto-layout, `primaryAxisAlignItems: SPACE_BETWEEN`, fixed 40 tall) with `Doc/TokenName` page name on the left and `Doc/Caption` `→` arrow on the right, separated by 1px `color/border/subtle` row dividers. |
| TOC summary bar                       | Dark `color/neutral/950` (Primitives) bar at 72px, `Doc/Caption` centered `color/neutral/50` text, `cornerRadius 12`, shadow-sm.                            |

---

## 4. Pages that exist (and pages that don't)

**Do exist** — page scaffold creates:

```
Thumbnail
📝 Table of Contents
↳ Token Overview
🖍️ Style Guide
  ↳ Primitives
  ↳ Theme
  ↳ Layout
  ↳ Text Styles
  ↳ Effects
… (Brand, Atoms, component groups) …
Documentation components
Grids
parking lot
```

**Does NOT exist — do not reintroduce:**

- `↳ MCP Tokens` (removed; was redundant)
- `[MCP] Token Manifest` frame (removed; was redundant)
- `Step 16` MCP build, `Step 9c` MCP redraw — both removed from their skills

If you see a reference in old agent transcripts or docs, treat it as historical. The current scaffold is Thumbnail → TOC → Token Overview → Style Guide → … and sync/redraw runs Steps **9b / 9d / 9e** only.

---

## 5. Body text variants (Text Styles page)

Each Body size (LG/MD/SM) emits **5 slots** living in its own folder:

```
Body/LG/regular
Body/LG/emphasis      → font-weight medium (500)
Body/LG/italic        → italic font face
Body/LG/link          → underline decoration, fill bound to color/primary/default
Body/LG/strikethrough → strikethrough decoration, fill bound to color/background/content-muted
```

Total: 3 sizes × 5 variants = **15 body specimen rows**. Category dividers on Text Styles use a full-width 1640 sub-header row (single HORIZONTAL cell, fill `color/background/variant`, Doc/Caption uppercase).

---

## 6. Naming conventions that matter

| What                                   | Convention                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| File title                             | `<Project Name> — <File Type>` — em dash U+2014, space on each side. Never a hyphen.                    |
| Page prefix                            | `↳ ` (U+21B3 + space) for sub-pages under a section header.                                             |
| Doc chrome frames                      | `doc/{page}/{kind}/{slug}` — e.g. `doc/primitives/ramp-row/primary`, `doc/table/theme-background/row/…` |
| Theme preview wrappers                 | `doc/theme-preview/light` and `doc/theme-preview/dark` (explicit mode on wrapper, not on the swatch).    |
| Section roots inside `_PageContent`    | `doc/{page}/section/{slug}` (VERTICAL, STRETCH).                                                        |
| Token Overview section roots           | `token-overview/{slug}` — e.g. `token-overview/architecture`, `token-overview/platform-mapping`.         |
| Placeholder nodes (pre-design-system)  | `placeholder/{slug}` — `/create-design-system` deletes these when it populates Token Overview.           |

---

## 7. `Doc/*` text styles (mandatory for every cell)

Step 15c §0 publishes these 4 styles by binding to Typography mode **100**. Once they exist, **every** heading, label, and cell text node MUST assign `textStyleId` — never raw `fontName`/`fontSize`. This is the single rule that separates shipping docs from a spreadsheet dump.

| Style           | Role                                          | Binds to (Typography · mode 100)                                          |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `Doc/Section`   | Section strips + page-level titles            | `Headline/LG/*` (font-size, font-family, font-weight, line-height)        |
| `Doc/TokenName` | Token path on cards, TOKEN-column emphasis    | `Label/LG/*` or `Headline/SM/*` (16–18px minimum)                         |
| `Doc/Code`      | WEB / ANDROID / iOS lines, dense table cells  | `Label/SM/*` (13–14px mono, line-height ≥ 1.45)                           |
| `Doc/Caption`   | Light/Dark labels, helper lines, column hints | `Body/SM/*` or `Label/MD/*` (12–14px)                                     |

**Fill bindings (apply on the text node, not on the style):**
- Primary cell text (TOKEN, HEX, VALUE, codeSyntax) → `color/background/content`
- Muted cell text (second lines, alias, caption) → `color/background/content-muted`
- Header row cell text → `color/background/content-muted`
- Category sub-header text (Text Styles only) → `color/background/content-muted`, uppercase, letter-spacing `+0.08em`

**First-run fallback:** if `Doc/*` don't exist yet on first invocation, set resolved literals from Typography mode 100; log a warning and re-run 15a–15b after 15c to upgrade.

---

## 8. Table component hierarchy (every table, every page)

Every table on every style-guide page uses the **same** parent chain. No orphan cells, no direct-child rows on `_PageContent`.

```
_PageContent                                       VERTICAL · AUTO · FIXED · width 1800 · padding 80 · fill #FFFFFF · x=0 y=320
└── doc/table-group/{slug}                         VERTICAL · AUTO · STRETCH · itemSpacing 12
    ├── doc/table-group/{slug}/title               TEXT · Doc/Section · fill color/background/content
    ├── doc/table-group/{slug}/caption             TEXT · Doc/Caption · fill color/background/content-muted  (optional, 1 line)
    └── doc/table/{slug}                           VERTICAL · AUTO · STRETCH · cornerRadius 16 · clipsContent
        │                                          stroke 1 color/border/subtle · fill color/background/default
        │                                          effectStyleId Effect/shadow-sm (when published — § G Depth)
        ├── doc/table/{slug}/header                HORIZONTAL · FIXED height 56 · width 1640 · fill color/background/variant
        │                                          bottom 1px stroke color/border/subtle
        │   └── doc/table/{slug}/header/cell/{col} FIXED width per §11 · paddingH 20 · counterAxisAlignItems CENTER
        │       └── TEXT · Doc/Code (uppercase, tracking +0.04em) · fill color/background/content-muted
        └── doc/table/{slug}/body                  VERTICAL · AUTO · STRETCH
            └── doc/table/{slug}/row/{tokenPath}   HORIZONTAL · FIXED width 1640 · AUTO height · minHeight 64
                │                                  paddingV 16 · paddingH 0 · bottom 1px stroke color/border/subtle
                │                                  counterAxisAlignItems CENTER
                │                                  (omit bottom stroke on the last child)
                └── doc/table/{slug}/row/.../cell/{col}  VERTICAL (default) or HORIZONTAL (Theme LIGHT/DARK) · AUTO height · FIXED width
                    │                              paddingH 20 · paddingV 4 · itemSpacing 4 · cross-axis CENTER
                    └── cell content — see §12 cell patterns
```

**Slug values per page:**

| Page | `{slug}` values |
|---|---|
| ↳ Primitives | `primitives/color/{ramp}`, `primitives/space`, `primitives/radius`, `primitives/elevation`, `primitives/typeface` |
| ↳ Theme | `theme/background`, `theme/border`, `theme/primary`, `theme/secondary`, `theme/tertiary`, `theme/error`, `theme/component` |
| ↳ Layout | `layout/spacing`, `layout/radius` |
| ↳ Text Styles | `typography/styles` |
| ↳ Effects | `effects/shadows`, `effects/color` |

Rows are named **full token path** (e.g. `doc/table/primitives/color/primary/row/color/primary/500`) so follow-up scripts can address a row by name.

---

## 9. Auto-layout rules that prevent the 10px-collapse bug

These rules are **mandatory** on every frame inside a table. Failing any one of them produces clipped, collapsed tables.

| Frame | `layoutMode` | `primaryAxisSizingMode` | `counterAxisSizingMode` | `layoutAlign` | Notes |
|---|---|---|---|---|---|
| `doc/table/{slug}` | VERTICAL | AUTO | FIXED | STRETCH | Call `resizeWithoutConstraints(1640, 1)` after creation. |
| `doc/table/{slug}/header` | HORIZONTAL | FIXED (56) | FIXED (1640) | STRETCH | `resize(1640, 56)` **before** appending cells. `counterAxisAlignItems: CENTER`. |
| Header cells | HORIZONTAL | FIXED (56) | FIXED (col width) | INHERIT | `resize(colWidth, 56)` before appending text. `paddingH: 20`, center-aligned. |
| `doc/table/{slug}/body` | VERTICAL | AUTO | FIXED (1640) | STRETCH | |
| Body rows | HORIZONTAL | FIXED (1640) | AUTO | STRETCH | `minHeight: 64`, `paddingV: 16`, `counterAxisAlignItems: CENTER`. |
| Body cells | VERTICAL or HORIZONTAL | AUTO | FIXED (col width) | INHERIT | `resize(colWidth, 1)` before content. `paddingH: 20`, `paddingV: 4`, `itemSpacing: 4`. Vertical cells: `primaryAxisAlignItems: CENTER`, `counterAxisAlignItems: MIN`. |
| Cell text nodes | — | — | — | — | **Immediately after `text.characters`:** `text.resize(colWidth - 40, 1)` → `text.textAutoResize = 'HEIGHT'`. Never leave `'NONE'` — that is the **root cause** of the 10px collapse. |
| Cell inline wrappers | HORIZONTAL | AUTO | AUTO | INHERIT | `itemSpacing: 10`, `counterAxisAlignItems: CENTER`. |

**Never** `resize(w, h)` with `h < 20` as a scaffold — rely on `AUTO` for every height that depends on children.

**The #1 bug you will hit:** forgetting `text.textAutoResize = 'HEIGHT'` after setting characters. The text node defaults to `'NONE'`, contributes ~10px to the row's layout, and the entire row collapses. Always set it.

---

## 10. Column specs per page (every set sums to 1640)

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

**Space / Radius / Elevation / Typeface** (one table each):

| Slug | Col widths (sum 1640) |
|---|---|
| `primitives/space` | TOKEN 260 · VALUE 100 · PREVIEW 260 · WEB 340 · ANDROID 320 · iOS 360 |
| `primitives/radius` | TOKEN 260 · VALUE 100 · PREVIEW 260 · WEB 340 · ANDROID 320 · iOS 360 |
| `primitives/elevation` | TOKEN 260 · VALUE 100 · WEB 400 · ANDROID 380 · iOS 500 |
| `primitives/typeface` | TOKEN 320 · SPECIMEN 460 · VALUE 200 · WEB 320 · ANDROID 160 · iOS 180 |

- Space PREVIEW: bar height 16, cornerRadius 4, fill `color/primary/200` (bound); width bound to the `Space/*` variable (or resolved px clamped to 200).
- Radius PREVIEW: 64×64 square, fill `color/neutral/100`, stroke `color/border/subtle`; `cornerRadius` bound to the `Corner/*` variable.
- Typeface SPECIMEN: single line `"The quick brown fox jumps over 1234567890"` at 24px using the bound typeface primitive.

### ↳ Theme (one table per semantic group — 7 tables)

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `TOKEN` | 320 | Doc/Code — Figma path |
| 2 | `LIGHT` | 140 | See §12 Theme swatch pattern (mode-scoped wrapper + hex sibling) |
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

---

## 11. Cell content patterns

Use these exactly. Cells default to **VERTICAL AUTO** so multi-line stacks (Theme LIGHT/DARK, Typography SIZE/LINE) grow without collapsing the row.

| Pattern | Structure |
|---|---|
| **Mono line** (TOKEN, HEX, WEB, ANDROID, iOS, VALUE) | One Doc/Code text node. `text.resize(colWidth - 40, 1)` → `textAutoResize = 'HEIGHT'`. |
| **Swatch chip + hex — Primitives** (combined SWATCH + HEX column) | HORIZONTAL wrapper · itemSpacing 10 · cross-axis CENTER · children: [rounded-rect 28×28 cornerRadius 8 stroke `color/border/subtle` fill bound to variable] + [Doc/Code hex text, fill `color/background/content`]. |
| **Swatch chip + hex — Theme LIGHT/DARK** | **#1 dark-mode bug.** Cell is HORIZONTAL with **two siblings**: [1] mode-scoped wrapper `doc/theme-preview/{mode}` that calls `setExplicitVariableModeForCollection(themeCollection, modeId)` and contains **only** the 28×28 chip (bound fill); [2] Doc/Code hex text as a **sibling** of the wrapper, **not a child**. Hex fill binds to `color/background/content` and MUST resolve in the page's Light mode. If you parent the hex inside the Dark wrapper, the fill resolves to white on the white cell and disappears. Layer tree: `cell (HORIZONTAL, AUTO) → [doc/theme-preview/{mode}, chip only] + [doc/code text sibling]`. |
| **Preview bar** (Space, Layout spacing) | HORIZONTAL wrapper · cross-axis CENTER · single rectangle height 16 cornerRadius 4 fill `color/primary/200` (bound); width bound to the `Space/*` variable (or resolved px). |
| **Preview square** (Radius) | HORIZONTAL wrapper · single 64×64 rect fill `color/neutral/100` stroke `color/border/subtle` cornerRadius bound to the `Corner/*` variable. |
| **Two-line meta** (Typography SIZE/LINE, WEIGHT/FAMILY) | VERTICAL stack · itemSpacing 4 · two Doc/Code text nodes; the second line may use `color/background/content-muted` for visual hierarchy. |
| **Category sub-header row** (Text Styles only) | Single row frame width 1640 minHeight 40 fill `color/background/variant`; single cell paddingH 24 with Doc/Caption uppercase text, letter-spacing +0.08em. |
| **Alias →** | Doc/Code text, fill `color/background/content-muted`, prefixed with `↳ ` (U+21B3) when the alias resolves to a primitive; `— (raw)` when the value is a hard-coded literal. |

**Theme dual-preview fallback:** if `setExplicitVariableModeForCollection` throws, bind only the LIGHT chip, print the Dark hex as Doc/Caption text below the chip, and log `Theme dual-preview: explicit mode unsupported` once per table.

---

## 12. Table chrome → variable binding map

Every chrome element below **must** use `setBoundVariable` / variable-bound paints. Only fall back to resolved values when the Plugin API refuses.

| Table element | Variable | Collection · mode |
|---|---|---|
| Table outer fill | `color/background/default` | Theme · Light |
| Table outer stroke | `color/border/subtle` | Theme · Light |
| Table shadow (guide tables only) | `Effect/shadow-sm` (effectStyleId) | Effects · Light |
| Header row fill | `color/background/variant` | Theme · Light |
| Header row bottom stroke | `color/border/subtle` | Theme · Light |
| Header text | `color/background/content-muted` | Theme · Light |
| Body row bottom stroke | `color/border/subtle` | Theme · Light |
| Primary cell text (TOKEN, HEX, VALUE, codeSyntax) | `color/background/content` | Theme · Light |
| Muted cell text (second lines, alias, caption) | `color/background/content-muted` | Theme · Light |
| Swatch chip stroke | `color/border/subtle` | Theme · Light |
| Swatch chip fill | The row's own variable (Primitives or Theme) | per row |
| Radius preview square fill | `color/neutral/100` | Primitives |
| Radius preview square stroke | `color/border/subtle` | Theme · Light |
| Spacing preview bar fill | `color/primary/200` | Primitives |
| Effects preview card fill | `color/background/default` | Theme · Light |
| Category sub-header row fill | `color/background/variant` | Theme · Light |

---

## 13. Build-order checklist (every table in every Step 15a–15c script)

1. **Create** `doc/table/{slug}` → set `layoutMode`, both sizing modes, `layoutAlign`, radius, clipping, fill + stroke bindings. `resizeWithoutConstraints(1640, 1)`. Do **not** call `resize(1640, 10)` — AUTO will expand.
2. **Create** `doc/table/{slug}/header` → `resize(1640, 56)` → append cells in column order; each cell `resize(colWidth, 56)` **before** appending its text node.
3. **Create** `doc/table/{slug}/body` → do **not** resize; STRETCH + AUTO handles it.
4. For each data row: **create** the row frame → `resize(1640, 1)` → set `minHeight 64`, `paddingTop/paddingBottom 16`, `counterAxisAlignItems: CENTER` → append cells (each cell `resize(colWidth, 1)` before appending content, with `paddingLeft/paddingRight 20`).
5. For each text node: set `characters` → `resize(textWidth, 1)` → `textAutoResize = 'HEIGHT'` → assign `textStyleId` (or fallback literals) → bind fill.
6. After all rows are appended, remove the bottom stroke from the last row (`row.strokes = []` or `strokeBottomWeight = 0`) so the outer `clipsContent` radius reads clean.
7. Apply `effectStyleId` to the outer `doc/table/{slug}` frame **only** if `Effect/shadow-sm` already exists in the file (Step 15c §0 publishes it; 15a/15b may skip on first run).

Step 15a draws **9 tables** on ↳ Primitives (5 color ramps + Space + Radius + Elevation + Typeface). Step 15b draws **7 tables** on ↳ Theme (one per semantic group). Step 15c draws **2 + 1 + 2 = 5 tables** across ↳ Layout, ↳ Text Styles, ↳ Effects.

---

## 14. Audit checklist before committing canvas work

### Variables & codeSyntax
- [ ] Did I set `codeSyntax` on every variable, all three platforms (via REST API)?
- [ ] Does every iOS `codeSyntax` use dot-separated lowercase with no camelCase segments?
- [ ] Do Theme `codeSyntax` values come from the Step 6 table (not derived from the path)?

### Canvas geometry
- [ ] Is every style-guide `_PageContent` exactly 1800 wide, padding 80, fill literal white?
- [ ] Is every `_Header` instance 1800 wide with `cornerRadius: 0` and `layoutMode: VERTICAL`?
- [ ] Do TOC + Token Overview use 1800 wide with 40 padding (not 80)?

### Tables
- [ ] Does every table render at 1640 wide with columns summing to exactly 1640?
- [ ] Does every row have `minHeight: 64`, `paddingV: 16`, `counterAxisAlignItems: CENTER`?
- [ ] Does every body cell have `paddingH: 20` (not 16)?
- [ ] Did I call `textAutoResize = 'HEIGHT'` after every `text.characters` assignment?
- [ ] Did I use `resizeWithoutConstraints(1640, 1)` on table roots instead of `resize(1640, 10)`?
- [ ] On Theme LIGHT/DARK cells: is the hex text a **sibling** of the mode-scoped wrapper (not a child)?
- [ ] Did I remove the bottom stroke from the last row of every table?
- [ ] Did I apply `Effect/shadow-sm` only after Step 15c §0 published it?

### Text & bindings
- [ ] Is every cell bound to `Doc/Section`, `Doc/TokenName`, `Doc/Code`, or `Doc/Caption` (never raw `fontName`/`fontSize`)?
- [ ] Are all chrome fills/strokes bound per §12 (no hard-coded neutrals)?
- [ ] Are swatch chip fills bound to the row's own variable (not resolved hex)?
- [ ] Preview bars/squares: width/cornerRadius bound to the row's `Space/*` or `Corner/*` variable?

### Text Styles specifics
- [ ] Do Body slots include all 5 variants (`regular` / `emphasis` / `italic` / `link` / `strikethrough`) nested inside `Body/{size}/`?
- [ ] Do `/link` specimen rows bind fill to `color/primary/default` and `/strikethrough` to `color/background/content-muted`?
- [ ] Are the 5 category sub-header rows present (Display / Headline / Title / Body / Label)?

### Pages
- [ ] Did I avoid creating `↳ MCP Tokens` or `[MCP] Token Manifest`?

### TOC + Token Overview
- [ ] Do both pages render at `1800` wide with `40` padding (not `80`)?
- [ ] Does every text node on both pages carry `textStyleId` (`Doc/Section` / `Doc/TokenName` / `Doc/Code` / `Doc/Caption`) — not raw `fontName`/`fontSize`?
- [ ] Does every fill/stroke bind to a Theme or Primitives variable (hex literals only as scaffold-time fallbacks)?
- [ ] Is the Token Overview platform-mapping table built with § H hierarchy (`doc/table/token-overview/platform-mapping/{header|body|row/*|cell/*}`) — no absolute `x`/`y` positioning?
- [ ] Do platform-mapping columns sum to exactly **1640** (TOKEN 400 · WEB 420 · ANDROID 340 · iOS 480)?
- [ ] Does the TOC have **4 band strips** (`band-strip/foundations`, `…/atoms`, `…/components`, `…/platform`) above 2-column card grids?
- [ ] Do all section cards / panels / platform-mapping table / summary bar carry `effectStyleId: Effect/shadow-sm` once § G Depth is published?

If any box is unchecked, fix before reporting "done."

---

## 15. Where the authoritative rules live

| Topic                              | File                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Full skill orchestration           | [`skills/create-design-system/SKILL.md`](./SKILL.md)                       |
| Canvas geometry + auto-layout rules | [`skills/create-design-system/SKILL.md`](./SKILL.md) § **A–G**             |
| Table format spec (hierarchy, columns, cells, bindings) | [`skills/create-design-system/SKILL.md`](./SKILL.md) § **H** |
| Theme codeSyntax table (explicit)  | [`skills/create-design-system/SKILL.md`](./SKILL.md) § **6**               |
| Typography codeSyntax rule         | [`skills/create-design-system/SKILL.md`](./SKILL.md) § **7b**              |
| Body text variant rules            | [`skills/create-design-system/SKILL.md`](./SKILL.md) § **7b** + Step 15c §0 |
| Sync redraw steps (9b, 9d, 9e)     | [`skills/sync-design-system/SKILL.md`](../sync-design-system/SKILL.md)     |
| New-project page scaffold          | [`skills/new-project/phases/05-scaffold-pages.md`](../new-project/phases/05-scaffold-pages.md) |
| `_Header` template                 | [`skills/new-project/phases/05b-documentation-headers.md`](../new-project/phases/05b-documentation-headers.md) |

When you are unsure, **`Read` the relevant file** rather than guessing. All these files live under `skills/` and are designed to be read in full by the agent before executing the relevant step.
