# Steps 15a–15c — Style guide canvas

Before each `use_figma` script in these steps, **prepend** the JavaScript from **[`../helpers/canvas.js`](../helpers/canvas.js)** (paste the file body at the top of the plugin script, or concatenate in your tooling). Then follow the **Canvas documentation visual spec** in [`06-canvas-documentation-spec.md`](./06-canvas-documentation-spec.md).

---

## Step 15a — Draw Style Guide: ↳ Primitives

Run **one** `use_figma` execution against **`↳ Primitives` only**. All tables drawn here MUST follow **§ H** (hierarchy, auto-layout rules, column widths, binding map, build order). The agent does not re-derive geometry — it reads § H and emits frames accordingly.

**Script skeleton**

1. `figma.setCurrentPageAsync` → `↳ Primitives`.
2. Delete every node on the page **other than `_Header`** (the doc header instance stays). The `_Header` occupies `y: 0–320`; the old cream `y > 360` cutoff is obsolete now that `_PageContent` starts at `y: 320`.
3. Ensure the `_Header` instance has `layoutMode: VERTICAL`, `cornerRadius: 0`, `width: 1800` (see § A `_Header component`). If it is an instance, detaching is **not** allowed — edit its main component on the `Documentation components` page once, per § A; here, just assert and `resize(1800, 320)` on the instance if the width differs.
4. Create **`_PageContent`** at `(0, 320)` — **VERTICAL**, `primaryAxisSizingMode: AUTO`, `counterAxisSizingMode: FIXED`, **width 1800**, **padding 80 on all four sides** (`paddingTop/Bottom/Left/Right = 80`), `itemSpacing 48`, `layoutAlign: STRETCH`. **Fill: literal `#FFFFFF` (not token-bound).** Inner content width = **1640** for every table/section child.
5. Resolve Primitives variable IDs once (read from Step 4 REST snapshot or live `figma.variables.getLocalVariablesAsync('COLOR' | 'FLOAT' | 'STRING')`). Cache `{ path → variableId }` keyed by canonical path.
6. For each **table spec row** below, call the shared `buildTable(spec)` helper (see § H.7 checklist) with the slug, group title, caption, column spec from § H.3, and the row list resolved from the cached Primitives variables.

**Tables to draw (in order)**

| Order | `{slug}` | Group title | Caption (`Doc/Caption`) | Rows |
|---|---|---|---|---|
| 1 | `primitives/color/primary` | Primary | Brand anchor — used for the most prominent actions, links, and focus. | 11 stops `color/primary/{50 … 950}` |
| 2 | `primitives/color/secondary` | Secondary | Supporting brand color for secondary actions and decorative surfaces. | 11 stops `color/secondary/*` |
| 3 | `primitives/color/tertiary` | Tertiary | Accent hue for highlights, chips, and illustrative moments. | 11 stops `color/tertiary/*` |
| 4 | `primitives/color/error` | Error | Destructive and error feedback — do not use for incidental UI. | 11 stops `color/error/*` |
| 5 | `primitives/color/neutral` | Neutral | Greyscale foundation for text, borders, and calm surfaces. | 11 stops `color/neutral/*` |
| 6 | `primitives/space` | Space | Spacing scale on a 4px base grid. | All `Space/*` FLOATs |
| 7 | `primitives/radius` | Corner Radius | Corner rounding primitives from square through pill. | All `Corner/*` FLOATs |
| 8 | `primitives/elevation` | Elevation | Raw blur steps consumed by `shadow/*/blur` aliases in Effects. | All `elevation/*` FLOATs |
| 9 | `primitives/typeface` | Typeface | Font family primitives. Display for headings, Body for paragraph text. | 2 rows (`typeface/display`, `typeface/body`) |

**Column definitions per slug** are in **§ H.3**. Cell content patterns are in **§ H.4** (use the *swatch chip + hex* pattern for the 5 color-ramp tables, *preview bar* for Space, *preview square* for Radius, *mono line* for Elevation, *specimen* for Typeface).

**Swatch binding (color ramp tables):** the 48×48 rect in the `SWATCH` cell must bind `boundVariables.color` → `figma.variables.createVariableAlias(primitiveVariable)` for the row's own Primitives variable (§ D / § H.5). The `HEX` column prints the resolved hex.

On completion, log the **Canvas checklist** row for Step 15a, including total table count (**9**) and total row count.

---

## Step 15b — Draw Style Guide: ↳ Theme

Run **one** `use_figma` execution against **`↳ Theme` only`. All tables follow **§ H**.

**Script skeleton**

1. `figma.setCurrentPageAsync` → `↳ Theme`.
2. Delete every node other than `_Header`.
3. Ensure `_Header` has `layoutMode: VERTICAL`, `cornerRadius: 0`, `width: 1800` (§ A). Resize instance to 1800 if needed.
4. Create **`_PageContent`** per Step 15a rules (1800 wide, `x: 0, y: 320`, 80 padding all sides, white fill).
5. Resolve the Theme collection's `light` and `dark` `modeId` once via `figma.variables.getVariableCollectionByIdAsync(themeCollectionId)` → `modes`. Cache.
6. For each semantic group, call `buildTable(spec)` with slug `theme/{group}`, columns per § H.3, rows = the group's Theme variables.

**Tables to draw (in order)**

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `theme/background` | Background | Surfaces, containers, scrims, and overlays. | 16 (`color/background/*`) |
| 2 | `theme/border` | Border | Stroke tokens for dividers and outlines. | 2 (`color/border/*`) |
| 3 | `theme/primary` | Primary | Primary brand roles and their on-color companions. | 8 (`color/primary/*`) |
| 4 | `theme/secondary` | Secondary | Secondary brand roles for supporting actions. | 8 (`color/secondary/*`) |
| 5 | `theme/tertiary` | Tertiary | Tertiary / decorative accent roles. | 8 (`color/tertiary/*`) |
| 6 | `theme/error` | Error | Feedback color for destructive and error states. | 8 (`color/error/*`) |
| 7 | `theme/component` | Component | shadcn-aligned component tokens (ring, input, muted, popover). | 4 (`color/component/*`) |

**Per-row cell content:**

- `TOKEN` cell → `Doc/Code` with the Figma path (e.g. `color/background/default`).
- `LIGHT` cell → follow § H.4 **Theme** swatch pattern exactly: the cell is a HORIZONTAL `AUTO` frame with **two siblings** — [a] inner wrapper **`doc/theme-preview/light`** that calls `setExplicitVariableModeForCollection(themeCollection, lightModeId)` and contains **only** the 28×28 chip (bound to the row's Theme variable, § D), and [b] the `Doc/Code` hex text node placed as a **sibling** of the wrapper, **not a child**. The hex text's fill binds to `color/background/content` and must resolve in the page's normal mode.
- `DARK` cell → same structure, wrapper **`doc/theme-preview/dark`** + Dark `modeId`. **Critical:** never parent the hex text under the Dark-scoped wrapper — inside that wrapper `color/background/content` resolves to white and the text disappears on the white cell. This is the single most common Theme-table bug; § H.4 and this step spell out the fix.
- `ALIAS →` cell → resolved Primitives path for Light and Dark. If both modes alias the same primitive, print one line; if different, print two `Doc/Code` lines `light · {path}` / `dark · {path}`.
- `WEB` / `ANDROID` / `iOS` cells → `Doc/Code`, pulled from Step 6 `codeSyntax` — never derived.

**Fallback:** when `setExplicitVariableModeForCollection` throws, bind only the LIGHT chip, add a `Doc/Caption` line under the DARK chip with the resolved Dark hex, and log `Theme dual-preview: explicit mode unsupported` once per table.

On completion, log the **Canvas checklist** row for Step 15b.

---

## Step 15c — Draw Style Guide: ↳ Layout, ↳ Text Styles, ↳ Effects

Run **one** `use_figma` execution that visits three pages in order: `↳ Layout` → `↳ Text Styles` → `↳ Effects`. **Before** navigating to any page, publish **Doc / slot / effect styles** (subsection **0** below) so tables on all three pages can assign `textStyleId` and `effectStyleId` without fallbacks.

### 0 — Publish `Doc/*`, slot Text styles, and Effect styles (idempotent)

Use `figma.getLocalTextStylesAsync()` / `figma.getLocalEffectStylesAsync()`; `loadFontAsync` for every `fontName` you set.

1. **`Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`** — find or `figma.createTextStyle()`. Bind fields to the Documentation type ramp in § **A** (`Headline/LG/*`, `Label/LG/*`, `Label/SM/*`, `Body/SM/*` or `Label/MD/*` at Typography mode **100**) via `setBoundVariable('fontSize', variable)` and parallel fields when the API allows; otherwise set resolved literals from mode **100**.
2. **Slot text styles (15 base + 12 body variants = 27)** — for each slot in order below, find or create `{Slot}`, then bind `{Slot}/font-size`, `{Slot}/font-family`, `{Slot}/font-weight`, `{Slot}/line-height` (Typography · mode **100**) with `setBoundVariable`. Collection variables and Text styles are different objects — every slot needs its own Text style.

   **Important naming rule for Body slots:** the three base body **text styles** are named `Body/LG/regular`, `Body/MD/regular`, `Body/SM/regular` (not `Body/LG`) so they nest inside the size folder alongside the 4 variants in Figma's Text Styles panel. The underlying **variable** paths stay `Body/LG/font-size`, `Body/LG/font-weight`, `Body/LG/font-family`, `Body/LG/line-height` — text-style names and variable names are separate namespaces, so the bindings are unchanged. If an earlier run created `Body/LG`, `Body/MD`, `Body/SM` at the root of the Body folder, rename them to `Body/{size}/regular` during this step.

   **Base slot order (15 — variable group path · text style name):**
   - `Display/LG` · `Display/LG`
   - `Display/MD` · `Display/MD`
   - `Display/SM` · `Display/SM`
   - `Headline/LG` · `Headline/LG`
   - `Headline/MD` · `Headline/MD`
   - `Headline/SM` · `Headline/SM`
   - `Title/LG` · `Title/LG`
   - `Title/MD` · `Title/MD`
   - `Title/SM` · `Title/SM`
   - `Body/LG` · **`Body/LG/regular`**
   - `Body/MD` · **`Body/MD/regular`**
   - `Body/SM` · **`Body/SM/regular`**
   - `Label/LG` · `Label/LG`
   - `Label/MD` · `Label/MD`
   - `Label/SM` · `Label/SM`

   **Body variant slots (12 — per § 7b):** `Body/LG/emphasis`, `Body/LG/italic`, `Body/LG/link`, `Body/LG/strikethrough`, `Body/MD/emphasis`, `Body/MD/italic`, `Body/MD/link`, `Body/MD/strikethrough`, `Body/SM/emphasis`, `Body/SM/italic`, `Body/SM/link`, `Body/SM/strikethrough`. These combined with `Body/{size}/regular` yield five text styles per body size, all nested inside the `Body/{size}/` folder: `regular`, `emphasis`, `italic`, `link`, `strikethrough`.

   For each variant style, after binding the 4 typography variables:
   - `emphasis` — set `fontName = { family, style: 'Medium' }` (loadFontAsync first). If the Medium face isn't available, leave the base `Regular` family+style and rely on the bound `font-weight = 500` variable.
   - `italic` — set `fontName = { family, style: 'Italic' }`. On error (face missing), fall back to `{ family, style: 'Regular' }` and `console.warn('italic face not loaded for ' + family + ' — Body/' + size + '/italic style created without italic glyph; add the Italic font face to the Figma file to resolve')`.
   - `link` — `fontName.style = 'Regular'`, `textDecoration = 'UNDERLINE'`.
   - `strikethrough` — `fontName.style = 'Regular'`, `textDecoration = 'STRIKETHROUGH'`.

   Text styles **do not** carry fill; the `link` / `strikethrough` color lives on the text node (see § 7b coupling rule and the Text Styles page row-rendering rule below).

3. **Effect styles** — for each tier in `sm`, `md`, `lg`, `xl`, `2xl`, create or update `Effect/shadow-{tier}`: `effects` = one `DROP_SHADOW` built from resolved `shadow/color` + resolved `shadow/{tier}/blur` (Effects · Light). Remove any legacy duplicates after migrating references.

### ↳ Layout page

1. `figma.setCurrentPageAsync` → `↳ Layout`. Delete every node **other than `_Header`** (or whose `y >= 320`). Build `_PageContent` per § A rules (1800 wide, `x: 0, y: 320`, 80 padding all sides, white fill).
2. Call `buildTable(spec)` **twice** with § H tables:

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `layout/spacing` | Spacing | Semantic spacing aliases mapped to Primitive space steps. | All `space/*` |
| 2 | `layout/radius` | Radius | Semantic radius aliases mapped to Primitive corner steps. | All `radius/*` |

- `VALUE` cell → `Doc/Code` resolved px.
- `ALIAS →` cell → `Doc/Code` primitive path (e.g. `Space/400`).
- `PREVIEW` cell → *preview bar* (spacing) or *preview square* (radius) per § H.4, bound to the row's own Layout variable.
- `WEB` / `ANDROID` / `iOS` cells → `Doc/Code` from Step 8 `codeSyntax`.

### ↳ Text Styles page

1. `figma.setCurrentPageAsync` → `↳ Text Styles`. Delete every node **other than `_Header`** (or whose `y >= 320`). Build `_PageContent` per § A rules.
2. Call `buildTable(spec)` **once** with `{slug}` = `typography/styles`.
3. Insert **5 category sub-header rows** (§ H.4 *category sub-header row* pattern, full-width 1640 × 40) in this order: **Display**, **Headline**, **Title**, **Body**, **Label**. Each sub-header precedes its specimen rows for that category.
4. Specimen rows (**27 total** — 3 Display + 3 Headline + 3 Title + **15 Body** + 3 Label), in this order within each category:
   - **Display / Headline / Title / Label:** `{Category}/LG`, `{Category}/MD`, `{Category}/SM` (3 rows each).
   - **Body:** each size emits **5 rows in a block** — `Body/{size}/regular`, `Body/{size}/emphasis`, `Body/{size}/italic`, `Body/{size}/link`, `Body/{size}/strikethrough` — then the next size repeats. 3 sizes × 5 variants = 15 Body rows. **Order inside each block is fixed** — regular first so the reader sees the default before the decorated variants below it. The regular row binds to the `Body/{size}/regular` text style (§ 8 step 2).

Common cell content for every specimen row:

| Column | Cell content |
|---|---|
| `SLOT` | `Doc/TokenName` — the published text-style name, e.g. `Headline/LG`, `Body/LG/regular`, `Body/LG/link`. For Body rows always use the 3-segment `Body/{size}/{variant}` form so the label matches the style name shown in the Text Styles panel. |
| `SPECIMEN` | TEXT node with `textStyleId` → the published slot or variant style; `characters` = the slot name prose (`Headline LG`, `Body LG emphasis`, `Body LG link`, …). `resize(420, 1)` then `textAutoResize = 'HEIGHT'`. Row `primaryAxisSizingMode: AUTO` so Display/LG (~96px) expands naturally while Body variants stay compact. **Fill binding (variants only — critical):** for any `/link` row the specimen text node's `fills[0]` **must** be bound to **`color/primary/default`** via `setBoundVariableForPaint` (the brand hue — **not** `color/primary/content`, which is the text-on-primary pairing and is invisible on neutral backgrounds); for `/strikethrough` rows bind to **`color/background/content-muted`**. For base / `/emphasis` / `/italic` rows leave fill as the default `color/background/content`. Without this binding the styles publish correctly but the preview lies about the intended presentation. |
| `SIZE / LINE` | VERTICAL stack — two `Doc/Code` lines: resolved `{fontSize}px` / `{lineHeight}px` at mode **100**. Variants resolve through their base-body alias, so values match the base row in the block. |
| `WEIGHT / FAMILY` | VERTICAL stack — two `Doc/Code` lines: resolved `{fontWeight}` / `{fontFamily}`. `/emphasis` rows resolve to `500` (via `font/weight/medium`); other variants share the base weight. |
| `WEB` | `Doc/Code` — from Step 7 / 7b `codeSyntax`. Variants show the 4-segment `var(--body-{size}-{variant}-font-size)`. |
| `ANDROID` | `Doc/Code` — matching kebab for the slot (e.g. `body-lg-link-font-size`). |
| `iOS` | `Doc/Code` — 5-segment dot path for variants (e.g. `.Typography.body.lg.link.font.size`). |

Caption under the table title: `Doc/Caption` — "Specimen renders at mode 100 — full 8-mode scale (85 → 200) ships via the Typography collection. Body variants extend each size with emphasis / italic / link / strikethrough per §7b." This tells the reader the table shows base values only, while Dev Mode surfaces all 8 modes.

### ↳ Effects page

1. `figma.setCurrentPageAsync` → `↳ Effects`. Delete every node **other than `_Header`** (or whose `y >= 320`). Build `_PageContent` per § A rules.
2. Resolve Effects collection `light` / `dark` `modeId` as in Step 15b.
3. Call `buildTable(spec)` twice:

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `effects/shadows` | Shadows | Drop shadow tiers — each alias points to an Elevation primitive. | 5 (`sm`, `md`, `lg`, `xl`, `2xl`) |
| 2 | `effects/color` | Shadow Color | Shared shadow color referenced by every tier. | 1 (`shadow/color`) |

- `effects/shadows` `LIGHT` / `DARK` cells → 88×88 `cornerRadius 12` card inside `doc/effect-preview/{mode}/{tier}` wrapper with explicit Effects mode set; card fill `color/background/default` + `effectStyleId = Effect/shadow-{tier}` + a small inner `Doc/Code` label showing the tier name.
- `effects/shadows` `BLUR` / `ALIAS →` → `Doc/Code` (blur value in px; alias path `elevation/{step}`).
- `effects/color` `LIGHT` / `DARK` cells → *swatch chip + hex* pattern, 32×32 chip bound to `shadow/color` in the wrapper's mode.
- `WEB` / `ANDROID` / `iOS` cells → `Doc/Code` from Step 9 `codeSyntax`.

Log the **Canvas checklist** row for Step 15c.

---

*If any instruction in an earlier section of this file conflicts with § H or with the step rewrites above, § H and the rewrites win (stable table hierarchy, Light doc mode, Dev Mode bindings, auto-layout hug rules).*

---
