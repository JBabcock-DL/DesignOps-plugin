# Steps 15a–15c — Style guide canvas

This file owns: which page, which slug, which row set. Canvas rules (geometry, hierarchy, columns, cells, auto-layout, bindings, build order) are baked into [`../canvas-templates/_lib.js`](../canvas-templates/_lib.js) and the per-page templates. §0 rules apply — see index in [`../SKILL.md`](../SKILL.md); full rules in [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md).

### Canvas is template-driven

Each Step 15 page uses a pre-written template from [`../canvas-templates/`](../canvas-templates/). The agent's job per page:

1. Resolve live data: mode IDs, per-row `{ tokenPath, resolvedHex, codeSyntax }` manifest (and related shapes per template), Doc/\* style IDs. The **`{ path → variableId }` map** may be **omitted** from `ctx`: each template calls **`ensureLocalVariableMapOnCtx`** from [`../canvas-templates/_lib.js`](../canvas-templates/_lib.js) at the start of `build(ctx)` and fills `ctx.variableMap` from `figma.variables.getLocalVariablesAsync()` when it is missing or `{}`. Embedding the map in `ctx` remains valid (backward-compatible).
2. Read `_lib.js` and the page template.
3. Compose: `[_lib source] + [template source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"` → pass as `code` to `use_figma`.

No cold script generation. Column widths, cell factories, §0 rules, chrome bindings are in the templates.

### `ctx` resolution (agent's job before each call)

**Optional — `variableMap`:** Skip block **1** below when you want a smaller MCP payload; committed templates hydrate it in-plugin. Keep block **1** when debugging bindings or when not using the standard `_lib` + template bundle.

```js
// 1. variableMap — ALL local variables, path → id (optional if omitted from ctx — see _lib ensureLocalVariableMapOnCtx)
const allVars = await figma.variables.getLocalVariablesAsync();
const variableMap = Object.fromEntries(allVars.map(v => [v.name, v.id]));

// 2. collection mode IDs
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const primColl   = collections.find(c => c.name === 'Primitives');
const themeColl  = collections.find(c => c.name === 'Theme');
const effectsColl= collections.find(c => c.name === 'Effects');
const primitivesModeId = primColl?.modes[0]?.modeId;
const themeLight  = themeColl?.modes.find(m => m.name === 'Light')?.modeId;
const themeDark   = themeColl?.modes.find(m => m.name === 'Dark')?.modeId;
const effectsLight= effectsColl?.modes.find(m => m.name === 'Light')?.modeId;
const effectsDark = effectsColl?.modes.find(m => m.name === 'Dark')?.modeId;

// 3. Doc/* style IDs
const textStyles = await figma.getLocalTextStylesAsync();
const docStyles  = {
  Section:   textStyles.find(s => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find(s => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find(s => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find(s => s.name === 'Doc/Caption')?.id   || null,
};

// 4. rows — per-row { tokenPath, resolvedHex/resolvedPx/resolvedValue, codeSyntax: {WEB, ANDROID, iOS} }
//    Resolved live from variableMap + valuesByMode[primitivesModeId] + variable.codeSyntax
```

**Per-template `ctx` (in addition to `pageId`, `docStyles`; `variableMap` optional — see above):**

- **15a — [`primitives.js`](../canvas-templates/primitives.js):** `primitivesModeId`, `rows: { colorRamps: { primary|… }, space, radius, elevation, typeface, fontWeight }` — same shapes as the template header comment.
- **15b — [`theme.js`](../canvas-templates/theme.js):** `themeCollectionId`, `themeLightModeId`, `themeDarkModeId`, `rows: { background, border, primary, secondary, tertiary, error, component }`. Each row: `{ tokenPath, resolvedHexLight, resolvedHexDark, aliasLight, aliasDark, codeSyntax }` (from live Theme variables + [`theme-aliases.json`](../data/theme-aliases.json) for alias targets). Include `rawLiterals` rows (e.g. scrim/shadow) in `background` when present.
- **15c — Layout — [`layout.js`](../canvas-templates/layout.js):** `rows: { spacing: [...], radius: [...] }` with `{ tokenPath, resolvedPx, aliasPath, codeSyntax }` per [`layout-effects.json`](../data/layout-effects.json).
- **15c — Text Styles — [`text-styles.js`](../canvas-templates/text-styles.js):** `rows` = ordered mix of `{ type: 'category', label }` and `{ type: 'slot', tokenPath, styleId, specimenChars, sizeLine1, sizeLine2, weightLine1, weightLine2, codeSyntax, variant? }` (27 slot rows + 5 categories). Resolve `styleId` from published local text-style names; `codeSyntax` from Step 7/7b.
- **15c — Effects — [`effects.js`](../canvas-templates/effects.js):** `effectsCollectionId`, `effectsLightModeId`, `effectsDarkModeId`, `rows: { shadows: [{ tokenPath, tier, blurPx, aliasPath, codeSyntax }], shadowColor: [{ tokenPath, resolvedHexLight, resolvedHexDark, codeSyntax }] }` per [`layout-effects.json`](../data/layout-effects.json).

### No workspace scripts

No `.mcp-*`, `*-once.js`, `*-payload.json`, or scratch files. The deliverable is Figma file state. If a script is large, split across multiple `use_figma` calls — each self-contained — see [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md). When this run skipped phases 02–04 (variables already present), these steps still draw/update the canvas against live variables — same structure and bindings as a full run.

---

## Per-page build shape (shared by 15a, 15b, 15c)

Every page:

1. `figma.setCurrentPageAsync` → target page.
2. Delete every node except `_Header`.
3. Assert `_Header`: VERTICAL, `cornerRadius: 0`, width 1800. If instance width differs, `resize(1800, 320)`. Do not detach — edit the main component on `Documentation components`.
4. Build `_PageContent`: VERTICAL Hug, 1800 wide, `x: 0 y: 320`, padding 80 all sides, white literal fill. `resizeWithoutConstraints(1800, 1)`. Re-assert `layoutSizingVertical = 'HUG'` after build. Direct TEXT children of `doc/table-group/*` (title, caption) need `textAutoResize = 'HEIGHT'` same as cell text (§0.6).
5. Resolve variable IDs once and cache `{ path → variableId }` (`getLocalVariablesAsync` for Primitives; `getVariableCollectionByIdAsync` for Theme/Effects mode IDs).
6. For each table: call `buildTable(manifest)` from `_lib.js`. Post-table: run optional read-only audit gate from [`../conventions/14-audit.md`](../conventions/14-audit.md).

**Rebuild rule:** full redraw under `_PageContent`, not a diff. Every row's token, bindings, value, and codeSyntax text must come from the current variable snapshot.

---

## Step 15a — ↳ Primitives

Typically **one** `use_figma` call; use **multiple self-contained calls** if the concatenated `code` approaches the ~50k limit — [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md). Template: [`../canvas-templates/primitives.js`](../canvas-templates/primitives.js).

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `primitives/color/primary`    | Primary       | Brand anchor — used for the most prominent actions, links, and focus.       | 11 stops `color/primary/{50…950}` |
| 2 | `primitives/color/secondary`  | Secondary     | Supporting brand color for secondary actions and decorative surfaces.       | 11 stops `color/secondary/*` |
| 3 | `primitives/color/tertiary`   | Tertiary      | Accent hue for highlights, chips, and illustrative moments.                 | 11 stops `color/tertiary/*` |
| 4 | `primitives/color/error`      | Error         | Destructive and error feedback — do not use for incidental UI.              | 11 stops `color/error/*` |
| 5 | `primitives/color/neutral`    | Neutral       | Greyscale foundation for text, borders, and calm surfaces.                  | 11 stops `color/neutral/*` |
| 6 | `primitives/space`            | Space         | Spacing scale on a 4px base grid.                                           | All `Space/*` FLOATs |
| 7 | `primitives/radius`           | Corner Radius | Corner rounding primitives from square through pill.                        | All `Corner/*` FLOATs |
| 8 | `primitives/elevation`        | Elevation     | Raw blur steps consumed by `shadow/*/blur` aliases in Effects.              | All `elevation/*` FLOATs |
| 9 | `primitives/typeface`         | Typeface      | Font family primitives. Display for headings, Body for paragraph text.      | 2 rows (`typeface/display`, `typeface/body`) |
| 10 | `primitives/font-weight`     | Font weight   | Shared emphasis weight (Typography `Body/*/emphasis` aliases this Primitive).| 1 row (`font/weight/medium`) |

Cell patterns per slug: color ramps = swatch chip (§0.7 bound fill) + hex; Space = preview bar; Radius = preview square; Elevation/Typeface/Font weight = mono line or specimen. Column widths in [`../conventions/column-widths.json`](../conventions/column-widths.json) (or baked into template).

Log Canvas checklist row for 15a (10 tables).

---

## Step 15b — ↳ Theme

Typically **one** `use_figma` call; split if needed per [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md). Template: [`../canvas-templates/theme.js`](../canvas-templates/theme.js). Resolve Theme `light`/`dark` modeId once and cache.

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `theme/background` | Background | Surfaces, containers, scrims, and overlays.                      | 16 (`color/background/*`) |
| 2 | `theme/border`     | Border     | Stroke tokens for dividers and outlines.                         | 2 (`color/border/*`) |
| 3 | `theme/primary`    | Primary    | Primary brand roles and their on-color companions.               | 8 (`color/primary/*`) |
| 4 | `theme/secondary`  | Secondary  | Secondary brand roles for supporting actions.                    | 8 (`color/secondary/*`) |
| 5 | `theme/tertiary`   | Tertiary   | Tertiary / decorative accent roles.                              | 8 (`color/tertiary/*`) |
| 6 | `theme/error`      | Error      | Feedback color for destructive and error states.                 | 8 (`color/error/*`) |
| 7 | `theme/component`  | Component  | shadcn-aligned component tokens (ring, input, muted, popover).   | 4 (`color/component/*`) |

Cell pattern: TOKEN, LIGHT/DARK dual-preview with `setExplicitVariableModeForCollection` (§0.3: hex TEXT is a sibling of the mode wrapper, never a child), ALIAS →, WEB/ANDROID/iOS. Fallback when explicit-mode throws: bind LIGHT chip only, print Dark hex as Doc/Caption.

Log Canvas checklist row for 15b.

---

## Step 15c — ↳ Layout, ↳ Text Styles, ↳ Effects

**Three sequential `use_figma` calls** (one self-contained script each — `_lib.js` + template + `ctx` — so payloads stay under the ~50k limit): (1) page **`↳ Layout`** + [`layout.js`](../canvas-templates/layout.js), (2) **`↳ Text Styles`** + [`text-styles.js`](../canvas-templates/text-styles.js), (3) **`↳ Effects`** + [`effects.js`](../canvas-templates/effects.js). Each template calls `setCurrentPageAsync` for its target page.

**Doc/* ordering (§0.4):** These styles are published at the close of Step 11. If you are here and they are absent (e.g. phases 02–04 were skipped without running the Step 11 close block), run the § 0 block below now — it is idempotent.

### § 0 — Publish Doc/\*, slot Text styles, and Effect styles (idempotent — normally runs at Step 11 close)

`figma.getLocalTextStylesAsync()` / `figma.getLocalEffectStylesAsync()`; `loadFontAsync` for every `fontName` set.

1. **`Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`** — find or `createTextStyle()`. Bind to Typography mode **100** variables (`Headline/LG/*`, `Label/LG/*`, `Label/SM/*`, `Body/SM/*`/`Label/MD/*`) via `setBoundVariable`; fall back to resolved literals from mode 100.

2. **Slot text styles (15 base + 12 body variants = 27)** — find or create per slot; bind `{Slot}/font-size`, `font-family`, `font-weight`, `line-height` (Typography · mode 100). Slot list in [`../data/typography-slots.json`](../data/typography-slots.json) `baseSlots` + `bodyVariants`.

   Body text style naming: `Body/LG/regular`, `Body/MD/regular`, `Body/SM/regular` (rename from `Body/LG` etc. if an earlier run created them at root).

   Body variant bindings — from `bodyVariants.variants`:
   - `emphasis` — `fontName.style = 'Medium'` (loadFont first; keep Regular + weight binding if Medium missing).
   - `italic` — `fontName.style = 'Italic'` (warn + fall back to Regular if face missing).
   - `link` — Regular, `textDecoration = 'UNDERLINE'`.
   - `strikethrough` — Regular, `textDecoration = 'STRIKETHROUGH'`.

   Text styles do not carry fill — `link`/`strikethrough` fill lives on the text node at call sites.

3. **Effect styles** — for `sm`, `md`, `lg`, `xl`, `2xl`: find or create `Effect/shadow-{tier}` with one DROP_SHADOW from resolved `shadow/color` + `shadow/{tier}/blur` (Effects · Light). Remove legacy duplicates.

### ↳ Layout page

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `layout/spacing` | Spacing | Semantic spacing aliases mapped to Primitive space steps. | All `space/*` |
| 2 | `layout/radius`  | Radius  | Semantic radius aliases mapped to Primitive corner steps. | All `radius/*` |

Cell pattern: VALUE, ALIAS →, PREVIEW (bar for spacing, square for radius), WEB/ANDROID/iOS.

### ↳ Text Styles page

Build the `typography/styles` table. Insert **5 category sub-header rows** (full-width 1640 × 40) before each group: **Display**, **Headline**, **Title**, **Body**, **Label**.

Specimen rows (**27 total**): Display/Headline/Title/Label each emit 3 rows (LG/MD/SM). Body emits 5-row blocks — `Body/{size}/{regular, emphasis, italic, link, strikethrough}` — for each of LG/MD/SM. Regular first.

| Column | Content |
|---|---|
| `SLOT` | `Doc/TokenName` — published text-style name (`Headline/LG`, `Body/LG/regular`, `Body/LG/link`). Always use 3-segment form for Body. |
| `SPECIMEN` | TEXT with `textStyleId` → the slot/variant style. `characters` = slot name prose. Fill binding (variants only): `/link` → `color/primary/default`; `/strikethrough` → `color/background/content-muted`; base/emphasis/italic → `color/background/content`. |
| `SIZE / LINE` | VERTICAL stack: two Doc/Code lines — resolved `{fontSize}px` / `{lineHeight}px` at mode 100. |
| `WEIGHT / FAMILY` | VERTICAL stack: two Doc/Code lines — resolved weight / family. `/emphasis` resolves to 500. |
| `WEB` / `ANDROID` / `iOS` | Doc/Code from Step 7/7b codeSyntax. |

Caption: *"Specimen renders at mode 100 — full 8-mode scale (85 → 200) ships via the Typography collection. Body variants extend each size with emphasis / italic / link / strikethrough per §7b."*

### ↳ Effects page

Resolve Effects `light`/`dark` modeId as in 15b.

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `effects/shadows` | Shadows      | Drop shadow tiers — each alias points to an Elevation primitive. | 5 (`sm`, `md`, `lg`, `xl`, `2xl`) |
| 2 | `effects/color`   | Shadow Color | Shared shadow color referenced by every tier.                    | 1 (`shadow/color`) |

Cell pattern: shadows = LIGHT/DARK 88×88 preview card with `effectStyleId`, TOKEN, BLUR (resolved px), ALIAS →, WEB/ANDROID/iOS. Shadow Color = 6 columns: swatch chip + rgba text per mode.

Log Canvas checklist row for 15c.
