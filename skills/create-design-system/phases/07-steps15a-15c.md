# Steps 15a–15c — Style guide canvas

Orchestration only. **Conventions shards** under [`../conventions/`](../conventions/) plus **§0** in [`../SKILL.md`](../SKILL.md) are authoritative for canvas geometry, table hierarchy, column widths, cell patterns, auto-layout (Hug / Fixed / Fill), bindings, and build order. Router / index: [`../CONVENTIONS.md`](../CONVENTIONS.md). This file owns: which page, which slug, which row set. When something here disagrees with those conventions, **they win**.

**Required reads before any `use_figma` call (strict order):**

1. **§0** — Already in [`../SKILL.md`](../SKILL.md) context; re-open [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md) if you need the isolated file.
2. [`../conventions/column-widths.json`](../conventions/column-widths.json) — structured widths (sum 1640 per table).
3. [`../conventions/10-column-spec.md`](../conventions/10-column-spec.md) — column prose + cell-pattern notes for §10.
4. [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) — §§11–13.
5. [`../conventions/08-hierarchy-and-09-autolayout.md`](../conventions/08-hierarchy-and-09-autolayout.md) — §§8–9.
6. [`../conventions/03-through-07-geometry-and-doc-styles.md`](../conventions/03-through-07-geometry-and-doc-styles.md) — §§3–7 (geometry, pages, Doc/*).
7. [`06-canvas-documentation-spec.md`](./06-canvas-documentation-spec.md) § A–G (visual language).

Use **Heavy read liveness** from [`../SKILL.md`](../SKILL.md) before the first large `Read`.

### Agent-driven only — no workspace scripts

Canvas steps are entirely agent-driven. The agent composes JavaScript inline for each `use_figma` call. Do **not** write, commit, or point designers at standalone `.js` files, helper bundles, `_tmp*` scaffolds, or a `scripts/` folder under this skill.

When this run skipped phases 02–04 because variables were already in the file (see [`SKILL.md`](../SKILL.md) *After Step 4 — variables present vs missing*), these steps still draw/update the canvas against live variables — same structure and bindings as a full run.

---

## Per-page build shape (shared by 15a, 15b, 15c pages)

Every page follows the same 4-step shape. Execute in order:

1. `figma.setCurrentPageAsync` → target page.
2. Delete every node on the page **other than `_Header`**.
3. Assert `_Header` (VERTICAL, `cornerRadius: 0`, width 1800). If the instance width differs, `resize(1800, 320)`. See [`../conventions/03-through-07-geometry-and-doc-styles.md`](../conventions/03-through-07-geometry-and-doc-styles.md) §3 and [`../conventions/08-hierarchy-and-09-autolayout.md`](../conventions/08-hierarchy-and-09-autolayout.md) §8 (do not detach — edit the main component on `Documentation components`).
4. Build **`_PageContent`** per [`../conventions/03-through-07-geometry-and-doc-styles.md`](../conventions/03-through-07-geometry-and-doc-styles.md) §3 (1800 wide at `x: 0, y: 320`, 80 padding all sides, white literal fill, inner content width 1640).
5. Resolve variable IDs once and cache `{ path → variableId }` (Primitives live `getLocalVariablesAsync('COLOR' | 'FLOAT' | 'STRING')`; Theme/Effects mode IDs via `getVariableCollectionByIdAsync`).
6. For each table in the page's table list below, build per **§§8–13** across [`../conventions/08-hierarchy-and-09-autolayout.md`](../conventions/08-hierarchy-and-09-autolayout.md), [`../conventions/10-column-spec.md`](../conventions/10-column-spec.md), [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) (structure, columns, cells, bindings, build order — including the Hug-before-resize rule in §0.1 / [`../SKILL.md`](../SKILL.md)).

**Rebuild rule:** each step is a full redraw under `_PageContent`, not a diff. Every row's token, bindings, value, and `codeSyntax` text must come from the current variable snapshot. As long as the script completes and variables exist locally, tables cannot stay "missing" unless a path is absent from its collection.

---

## Step 15a — ↳ Primitives

One `use_figma` execution against `↳ Primitives`. Follow the per-page shape above.

**Tables (in order)**

| Order | `{slug}` | Group title | Caption | Rows |
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
| 10 | `primitives/font-weight` | Font weight | Shared emphasis weight (Typography `Body/*/emphasis` aliases this Primitive). | 1 row (`font/weight/medium`) |

Column widths and cell content patterns per slug live in [`../conventions/10-column-spec.md`](../conventions/10-column-spec.md) / [`../conventions/column-widths.json`](../conventions/column-widths.json) (**§10**) and [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) **§11** (cells — swatch chip + hex for color ramps, preview bar for Space, preview square for Radius, mono line for Elevation, specimen for Typeface, VALUE + codeSyntax for Font weight). Swatch binding rules live in **§12** of the same file.

On completion, log the Canvas checklist row for 15a (10 tables).

---

## Step 15b — ↳ Theme

One `use_figma` execution against `↳ Theme`. Follow the per-page shape above. Resolve Theme `light` / `dark` `modeId` once and cache.

**Tables (in order)**

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `theme/background` | Background | Surfaces, containers, scrims, and overlays. | 16 (`color/background/*`) |
| 2 | `theme/border` | Border | Stroke tokens for dividers and outlines. | 2 (`color/border/*`) |
| 3 | `theme/primary` | Primary | Primary brand roles and their on-color companions. | 8 (`color/primary/*`) |
| 4 | `theme/secondary` | Secondary | Secondary brand roles for supporting actions. | 8 (`color/secondary/*`) |
| 5 | `theme/tertiary` | Tertiary | Tertiary / decorative accent roles. | 8 (`color/tertiary/*`) |
| 6 | `theme/error` | Error | Feedback color for destructive and error states. | 8 (`color/error/*`) |
| 7 | `theme/component` | Component | shadcn-aligned component tokens (ring, input, muted, popover). | 4 (`color/component/*`) |

Cell patterns (TOKEN, LIGHT / DARK with `setExplicitVariableModeForCollection`, ALIAS →, WEB / ANDROID / iOS) live in [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) **§11**. The **Theme hex-sibling rule** (hex text must be a sibling of the mode-scoped wrapper, never a child) is **§0.3** in [`../SKILL.md`](../SKILL.md) / [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md) — read it before building LIGHT/DARK cells. Fallback when `setExplicitVariableModeForCollection` throws is specified in §11 of that file.

On completion, log the Canvas checklist row for 15b.

---

## Step 15c — ↳ Layout, ↳ Text Styles, ↳ Effects

One `use_figma` execution that visits three pages in order: `↳ Layout` → `↳ Text Styles` → `↳ Effects`. **Before** navigating, publish Doc/slot/effect styles (§ 0 below) so tables on all three pages can assign `textStyleId` / `effectStyleId` directly. This is the first-run ordering rule — see **§0.4** in [`../SKILL.md`](../SKILL.md) / [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md).

### § 0 — Publish `Doc/*`, slot Text styles, and Effect styles (idempotent)

Use `figma.getLocalTextStylesAsync()` / `figma.getLocalEffectStylesAsync()`; `loadFontAsync` for every `fontName` you set.

1. **`Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`** — find or `figma.createTextStyle()`. Bind to the Documentation type ramp in [`06-canvas-documentation-spec.md`](./06-canvas-documentation-spec.md) § A (`Headline/LG/*`, `Label/LG/*`, `Label/SM/*`, `Body/SM/*` / `Label/MD/*` at Typography mode **100**) via `setBoundVariable('fontSize', variable)` and parallel fields; otherwise set resolved literals from mode **100**.

2. **Slot text styles (15 base + 12 body variants = 27)** — for each slot, find or create, then bind `{Slot}/font-size`, `{Slot}/font-family`, `{Slot}/font-weight`, `{Slot}/line-height` (Typography · mode **100**) via `setBoundVariable`. Text styles and collection variables are separate namespaces; every slot needs its own Text style.

   **Body naming rule:** the three base body text styles are named `Body/LG/regular`, `Body/MD/regular`, `Body/SM/regular` so they nest inside the size folder with the 4 variants. Variable paths stay `Body/LG/font-size` etc. If an earlier run created `Body/LG` / `Body/MD` / `Body/SM` at the root of the Body folder, rename them to `Body/{size}/regular` during this step.

   **Base slots (15 — variable group · text style name):** `Display/LG`, `Display/MD`, `Display/SM`, `Headline/LG`, `Headline/MD`, `Headline/SM`, `Title/LG`, `Title/MD`, `Title/SM`, `Body/LG · Body/LG/regular`, `Body/MD · Body/MD/regular`, `Body/SM · Body/SM/regular`, `Label/LG`, `Label/MD`, `Label/SM`.

   **Body variants (12, per § 7b):** `Body/{LG,MD,SM}/{emphasis,italic,link,strikethrough}`. Combined with `Body/{size}/regular` this yields 5 text styles per body size. For each variant, after binding the 4 typography variables:
   - `emphasis` — `fontName = { family, style: 'Medium' }` (loadFontAsync first). If Medium is missing, keep `Regular` family+style and rely on the bound `font-weight = 500`.
   - `italic` — `fontName = { family, style: 'Italic' }`. On error fall back to `Regular` and `console.warn('italic face not loaded for ' + family + ' — Body/' + size + '/italic created without italic glyph; add the Italic face to resolve')`.
   - `link` — `fontName.style = 'Regular'`, `textDecoration = 'UNDERLINE'`.
   - `strikethrough` — `fontName.style = 'Regular'`, `textDecoration = 'STRIKETHROUGH'`.

   Text styles do not carry fill; `link` / `strikethrough` color lives on the text node (see § 7b coupling rule and the Text Styles rendering rule below).

3. **Effect styles** — for each tier in `sm`, `md`, `lg`, `xl`, `2xl`, create or update `Effect/shadow-{tier}`: `effects` = one `DROP_SHADOW` built from resolved `shadow/color` + resolved `shadow/{tier}/blur` (Effects · Light). Remove any legacy duplicates after migrating references.

### ↳ Layout page

Follow the per-page shape above. Tables:

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `layout/spacing` | Spacing | Semantic spacing aliases mapped to Primitive space steps. | All `space/*` |
| 2 | `layout/radius` | Radius | Semantic radius aliases mapped to Primitive corner steps. | All `radius/*` |

Cell patterns (VALUE, ALIAS →, PREVIEW — preview bar for spacing, preview square for radius — WEB/ANDROID/iOS) are in [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) §11.

### ↳ Text Styles page

Follow the per-page shape above. Build the `typography/styles` table per conventions **§§8–13** (same shard list as step 6 above).

Insert **5 category sub-header rows** ([`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) §11 *category sub-header row*, full-width 1640 × 40) in order: **Display**, **Headline**, **Title**, **Body**, **Label**. Each precedes its specimen rows.

Specimen rows (**27 total** — 3 Display + 3 Headline + 3 Title + **15 Body** + 3 Label):
- **Display / Headline / Title / Label:** `{Category}/LG`, `{Category}/MD`, `{Category}/SM`.
- **Body:** each size emits **5 rows in a block** — `Body/{size}/{regular, emphasis, italic, link, strikethrough}` — then the next size. 3 × 5 = 15 Body rows. Regular first so the reader sees the default before decorated variants.

Cell content:

| Column | Cell content |
|---|---|
| `SLOT` | `Doc/TokenName` — published text-style name, e.g. `Headline/LG`, `Body/LG/regular`, `Body/LG/link`. Always use the 3-segment `Body/{size}/{variant}` form for Body rows. |
| `SPECIMEN` | TEXT with `textStyleId` → the published slot/variant style; `characters` = the slot name prose. **Fill binding (variants only — critical):** for `/link` rows bind `fills[0]` to **`color/primary/default`** (the brand hue — **not** `color/primary/content`, which is invisible on neutral backgrounds); for `/strikethrough` rows bind to **`color/background/content-muted`**. Base / `/emphasis` / `/italic` rows keep the default `color/background/content`. Without this binding the published style is correct but the preview lies. Row and text sizing per [`../SKILL.md`](../SKILL.md) §0.1–0.2 and [`../conventions/08-hierarchy-and-09-autolayout.md`](../conventions/08-hierarchy-and-09-autolayout.md) §9. |
| `SIZE / LINE` | VERTICAL stack — two `Doc/Code` lines: resolved `{fontSize}px` / `{lineHeight}px` at mode **100**. Variants resolve through their base-body alias. |
| `WEIGHT / FAMILY` | VERTICAL stack — two `Doc/Code` lines: resolved `{fontWeight}` / `{fontFamily}`. `/emphasis` rows resolve to `500` (via `font/weight/medium`). |
| `WEB` / `ANDROID` / `iOS` | `Doc/Code` from Step 7 / 7b `codeSyntax`. |

Caption under the table title (`Doc/Caption`): *"Specimen renders at mode 100 — full 8-mode scale (85 → 200) ships via the Typography collection. Body variants extend each size with emphasis / italic / link / strikethrough per §7b."*

### ↳ Effects page

Follow the per-page shape above. Resolve Effects `light` / `dark` `modeId` as in 15b. Tables:

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `effects/shadows` | Shadows | Drop shadow tiers — each alias points to an Elevation primitive. | 5 (`sm`, `md`, `lg`, `xl`, `2xl`) |
| 2 | `effects/color` | Shadow Color | Shared shadow color referenced by every tier. | 1 (`shadow/color`) |

Cell patterns (LIGHT / DARK shadow card with `effectStyleId` inside `doc/effect-preview/{mode}/{tier}`, BLUR, ALIAS →, swatch chip + hex for `effects/color`, WEB/ANDROID/iOS) live in [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) §11.

Log the Canvas checklist row for 15c.
