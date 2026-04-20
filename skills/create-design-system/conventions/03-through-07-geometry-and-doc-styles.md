# Geometry, pages, naming, and Doc styles (former §3–§7)

> **Figma auto-layout vocabulary used throughout the conventions shards:** **Hug** (frame fits its children) = Plugin API `primaryAxisSizingMode`/`counterAxisSizingMode = 'AUTO'`. **Fixed** (pinned dimension) = `= 'FIXED'`. **Fill** (frame expands to fill its parent) = `layoutGrow = 1` on the primary axis, or `layoutAlign = 'STRETCH'` on the counter axis (`STRETCH` is the legacy API name — the Figma UI calls this "Fill container"). Every rule below uses Hug / Fixed / Fill in prose and the API literal in code blocks and tables.

---

## 3. Style-guide canvas geometry (the only widths you use)

The five style-guide pages (`↳ Primitives`, `↳ Theme`, `↳ Layout`, `↳ Text Styles`, `↳ Effects`) share one rigid geometry. New projects, existing projects, sync redraws — all use these numbers.

| Layer             | Width       | Notes                                                                                                   |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Page canvas       | **1800px**  | `_Header` and `_PageContent` both span this column.                                                     |
| `_Header` instance | **1800px**  | `layoutMode: VERTICAL`, **FIXED height 320**, **`cornerRadius: 0`** (square bottom seam).              |
| `_PageContent`     | **1800px**  | `x: 0, y: 320`, padding **80 on all 4 sides**, `itemSpacing: 48`, fill `#FFFFFF` literal (not tokened). **Height must Hug the page:** `layoutMode: 'VERTICAL'`, **`primaryAxisSizingMode: 'AUTO'`** (not `FIXED`), **`layoutSizingVertical: 'HUG'`**, **`resizeWithoutConstraints(1800, 1)`** after children exist — **never** a placeholder **`resize(1800, 400)`** (clips every table). Re-assert Hug after bulk `appendChild` if Figma flips sizing (see **§0.1** note in [`00-gotchas.md`](./00-gotchas.md)). Same class of bug as `doc/table-group` — paired rule there. |
| Inner content      | **1640px**  | `1800 − 80 − 80`. Every table / doc group renders at 1640 wide.                                         |
| Table header row   | **1640px**  | `FIXED width 1640`, height 56.                                                                          |
| Table body row     | **1640px**  | `FIXED width 1640`, `AUTO` height, `minHeight: 64`, `counterAxisAlignItems: CENTER`.                    |

Column widths per table are defined in [`10-column-spec.md`](./10-column-spec.md) and [`column-widths.json`](./column-widths.json). **Every table column set sums to exactly 1640.** If you redesign a column, the sum must still equal 1640.

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
| Every fill and stroke                 | `setBoundVariable` against Theme · Light or Primitives ([`11-cells-12-bindings-13-build-order.md`](./11-cells-12-bindings-13-build-order.md) §12); hex literals are fallbacks.                                                                |
| Section shells / cards / panels / tables | `cornerRadius 16` outer, bound `color/background/default` fill + `color/border/subtle` stroke + `effectStyleId: Effect/shadow-sm` once § G Depth is published. |
| Token Overview platform-mapping table | Uses the full § H hierarchy — `doc/table/token-overview/platform-mapping` → `header` → `body` → `row/{tokenPath}` → `cell/{key}` — no absolute `x`/`y` positioning, row `minHeight 64`, cell `paddingH 20`, last row has no bottom stroke. Columns sum to **1640** (TOKEN 400 · WEB 420 · ANDROID 340 · iOS 480). **No effects** on the table root, `body`, rows, or cells — the enclosing `token-overview/platform-mapping` section shell carries the single `shadow-sm` so the block is not double-lit. |
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
