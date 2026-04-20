# Steps 15a–15c — Style guide canvas

This file owns: which page, which slug, which row set. Canvas rules (geometry, hierarchy, columns, cells, auto-layout, bindings, build order) are baked into [`../canvas-templates/_lib.js`](../canvas-templates/_lib.js) and the per-page templates. §0 rules apply — see index in [`../SKILL.md`](../SKILL.md); full rules in [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md).

### Canvas is bundle-driven, subagent-delivered (happy path)

Each Step 15 / 17 page has a committed self-contained bundle under [`../canvas-templates/bundles/`](../canvas-templates/bundles/). **The parent thread never `Read`s a bundle and never calls `use_figma` for a canvas draw.** For each page, the parent emits one `Task(subagent_type: "generalPurpose")` that loads the [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) skill. The subagent performs exactly **one `Read` + one `use_figma`** in an isolated context and returns a compact JSON summary. This keeps the 18–30k-char bundle text out of the parent's working memory and makes delivery deterministic.

**Per-page parent pattern:**

1. Emit `Task(subagent_type: "generalPurpose", description: "<short>", prompt: "Load skill canvas-bundle-runner. Run step=<slug>, fileKey=<key>, description=\"<short>\". Return the compact JSON summary only — no prose.")` with the `step` slug from the table below.
2. Parse the returned JSON (`{ ok, step, pageName, tableGroups, … }`). On `ok: true` — log the canvas checklist row, run the read-only audit gate from [`../conventions/14-audit.md`](../conventions/14-audit.md) with **only the summary in context** (never re-`Read` the bundle), advance. On `ok: false` — see *Debug / fallback* below.
3. Never chain pages inside one Task. 15c is always **three sequential Task invocations** (Layout → Text Styles → Effects) per [`../conventions/17-table-redraw-runbook.md`](../conventions/17-table-redraw-runbook.md) § 4.

| Step | `step` slug | Bundle (the subagent `Read`s this — parent does not) |
|------|-------------|------------------------------------------------------|
| 15a — Primitives       | `15a-primitives`    | [`../canvas-templates/bundles/step-15a-primitives.min.mcp.js`](../canvas-templates/bundles/step-15a-primitives.min.mcp.js) |
| 15b — Theme            | `15b-theme`         | [`../canvas-templates/bundles/step-15b-theme.min.mcp.js`](../canvas-templates/bundles/step-15b-theme.min.mcp.js) |
| 15c — Layout           | `15c-layout`        | [`../canvas-templates/bundles/step-15c-layout.min.mcp.js`](../canvas-templates/bundles/step-15c-layout.min.mcp.js) |
| 15c — Text Styles      | `15c-text-styles`   | [`../canvas-templates/bundles/step-15c-text-styles.min.mcp.js`](../canvas-templates/bundles/step-15c-text-styles.min.mcp.js) |
| 15c — Effects          | `15c-effects`       | [`../canvas-templates/bundles/step-15c-effects.min.mcp.js`](../canvas-templates/bundles/step-15c-effects.min.mcp.js) |

Each bundle concatenates `_lib.js` + page template + a per-step runner fragment. The runner resolves the live variable registry, data aliases, Doc/* style IDs, and target page inside the plugin and calls `await build(ctx)`. **Never assemble `ctx` in the Task prompt**, **never pass `ctx.variableMap`**, and **never stage the bundle as a `.mcp-*` / `*-payload.json`** — the subagent reads the `.min.mcp.js` directly and passes its contents to `use_figma` verbatim.

Regenerate after editing `_lib.js`, any `canvas-templates/*.js`, or any `bundles/_*-runner.fragment.js`:

```
node skills/create-design-system/scripts/bundle-canvas-mcp.mjs
```

See [`../canvas-templates/bundles/README.md`](../canvas-templates/bundles/README.md).

### Debug / fallback path (only when a runner subagent returns `ok: false`)

If a runner subagent returns a real error and the fix needs source-level edits, **then** (and only then) the parent may open [`../canvas-templates/_lib.js`](../canvas-templates/_lib.js), the relevant page template in [`../canvas-templates/`](../canvas-templates/), and the runner fragment in [`../canvas-templates/bundles/`](../canvas-templates/bundles/) to diagnose. Fix the source, regenerate bundles (`node skills/create-design-system/scripts/bundle-canvas-mcp.mjs`), and re-delegate to the runner subagent — do **not** hand-compose a payload in the parent thread. The last-resort escape hatch (inline `[_lib source] + [template source] + "const ctx = " + JSON.stringify(ctx) + "; await build(ctx);"` as `code` from the parent) exists only when the runner subagent cannot reach the MCP at all. [`ensureLocalVariableMapOnCtx`](../canvas-templates/_lib.js) hydrates `variableMap` inside `build(ctx)`; keep it out of any inline `ctx`.

**Template `ctx` shapes** (what each runner constructs inside the plugin — reference only):

- **15a — [`primitives.js`](../canvas-templates/primitives.js):** `primitivesModeId`, `rows: { colorRamps: { primary|… }, space, radius, elevation, typeface, fontWeight }`.
- **15b — [`theme.js`](../canvas-templates/theme.js):** `themeCollectionId`, `themeLightModeId`, `themeDarkModeId`, `rows: { background, border, primary, secondary, tertiary, error, component }`. `rawLiterals` (scrim/shadow) appended to `background`.
- **15c — Layout — [`layout.js`](../canvas-templates/layout.js):** `rows: { spacing, radius }` (`resolvedPx` 9999 marks `radius/full`).
- **15c — Text Styles — [`text-styles.js`](../canvas-templates/text-styles.js):** ordered mix of `{ type: 'category', label }` and `{ type: 'slot', tokenPath, styleId, specimenChars, sizeLine1, sizeLine2, weightLine1, weightLine2, codeSyntax, variant? }` (27 slot rows + 5 categories).
- **15c — Effects — [`effects.js`](../canvas-templates/effects.js):** `effectsCollectionId`, `effectsLightModeId`, `effectsDarkModeId`, `rows: { shadows, shadowColor }`.

### Distribution § (MCP — bundles and source root)

- **Claude Code + local plugin:** read paths from **this skill's install directory**, not an unrelated project workspace — see [`../SKILL.md`](../SKILL.md) and [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md) **Source root**.
- **Research / verification:** payload math, bundle size, and Tier notes live in [`../MCP-PAYLOAD-RESEARCH.md`](../MCP-PAYLOAD-RESEARCH.md) **Distribution §** ([§12](../MCP-PAYLOAD-RESEARCH.md#12-distribution-and-bundled-code-stable-workflow)) and [`../VERIFICATION.md`](../VERIFICATION.md).

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

**Happy path:** Delegate to the [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) subagent with `step=15a-primitives` (the subagent `Read`s [`../canvas-templates/bundles/step-15a-primitives.min.mcp.js`](../canvas-templates/bundles/step-15a-primitives.min.mcp.js) and calls `use_figma`; parent never touches the bundle). Collect the summary, log the checklist row, run §14 audit. Template source (for debug only): [`../canvas-templates/primitives.js`](../canvas-templates/primitives.js).

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

**Happy path:** Delegate to the [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) subagent with `step=15b-theme` (subagent bundle: [`../canvas-templates/bundles/step-15b-theme.min.mcp.js`](../canvas-templates/bundles/step-15b-theme.min.mcp.js)). The runner resolves Theme Light/Dark mode IDs, walks each row's alias chain to its resolved hex per mode, and inlines scrim/shadow rawLiterals into the background group — all inside the plugin. Template source (for debug only): [`../canvas-templates/theme.js`](../canvas-templates/theme.js).

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

**Happy path — three sequential [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) subagent invocations**, one bundle each, one Task per page. Run strictly in order; await each summary, log the checklist row, run §14 audit, then fire the next:

1. `step=15c-layout` → subagent bundle [`../canvas-templates/bundles/step-15c-layout.min.mcp.js`](../canvas-templates/bundles/step-15c-layout.min.mcp.js) → page **`↳ Layout`** (template, debug only: [`layout.js`](../canvas-templates/layout.js))
2. `step=15c-text-styles` → [`../canvas-templates/bundles/step-15c-text-styles.min.mcp.js`](../canvas-templates/bundles/step-15c-text-styles.min.mcp.js) → page **`↳ Text Styles`** (template, debug only: [`text-styles.js`](../canvas-templates/text-styles.js))
3. `step=15c-effects` → [`../canvas-templates/bundles/step-15c-effects.min.mcp.js`](../canvas-templates/bundles/step-15c-effects.min.mcp.js) → page **`↳ Effects`** (template, debug only: [`effects.js`](../canvas-templates/effects.js))

Each bundle calls `setCurrentPageAsync` for its target page in-plugin; no ctx assembly in the Task prompt. The parent never `Read`s any of these `.min.mcp.js` files.

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
