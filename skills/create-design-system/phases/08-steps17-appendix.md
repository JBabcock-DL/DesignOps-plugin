
## Step 17 — Populate Token Overview

**Happy path (MCP):** `Read` [`../canvas-templates/bundles/step-17-token-overview.min.mcp.js`](../canvas-templates/bundles/step-17-token-overview.min.mcp.js) → pass **verbatim** as `use_figma` → `code` (plus runtime `fileKey`, `description`, `skillNames: "figma-use"`). Regenerate bundles after editing [`../canvas-templates/token-overview.js`](../canvas-templates/token-overview.js): `node skills/create-design-system/scripts/bundle-canvas-mcp.mjs`. Transport + bundle index: [`../conventions/17-table-redraw-runbook.md`](../conventions/17-table-redraw-runbook.md).

Data reference: [`../data/platform-mapping-rows.json`](../data/platform-mapping-rows.json) (minimum row set + column widths; mirrored as `STEP17_MIN_PLATFORM_ROWS` in `token-overview.js`). §0 rules apply — see [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md).

The `/new-project` skill's Step 5d drew this page with auto-layout section shells, a `doc/table/token-overview/platform-mapping` table, and amber `placeholder/*` notes. The committed bundle: (a) upgrades doc text to `textStyleId` (heuristic), (b) refreshes platform-mapping cells with live `codeSyntax`, (c) applies §0.9 shadow hygiene on the platform-mapping subtree, (d) rebinds arch boxes + `phone-frame/light|dark` fills, (e) deletes `placeholder/*`, (f) replaces `TBD` in text. It does **not** yet rebind **Typography scale** specimen `fontSize` per mode (appendix **Typography scale** subsection) — extend [`token-overview.js`](../canvas-templates/token-overview.js) if needed.

**Procedural detail** below is the full spec for debugging, manual runs, or future bundle extensions.

**Pre-pass — upgrade text styles + shadows**

Doc/* text styles and `Effect/shadow-sm` are published in Step 15c § 0. The scaffold wrote raw `fontName`/`fontSize` fallbacks. Now that styles exist:

1. Load `figma.getLocalTextStylesAsync()` once; cache by name.
2. Traverse the page. For every text node under `_PageContent`, reassign `textStyleId`:
   - Section titles (20px Bold in scaffold) → `Doc/Section`.
   - Token-path labels on cards, `TOKEN` cells, command-card titles → `Doc/TokenName`.
   - Header row cells, body cells, tags, small code strings → `Doc/Code`.
   - Captions, helper lines, mode labels, footer notes → `Doc/Caption`.
3. Load `figma.getLocalEffectStylesAsync()`. For every frame whose name starts with `token-overview/`, `dark-mode-panel`, or `font-scale-panel` and which does **not** already carry an `effectStyleId`, assign `Effect/shadow-sm`. **Do not** apply shadow-sm to `doc/table/token-overview/platform-mapping` or **any** descendant — depth for that block comes only from the parent section shell.

Skip a node silently if assignment throws. Log: `Doc/* upgraded · N nodes · shadow-sm applied · M frames`.

**Architecture diagram (Section 1)**

The scaffold created five `arch-box/{name}` frames already bound to the correct variables:

- `arch-box/Primitives` → `color/primary/default` (Theme)
- `arch-box/Theme` → `color/secondary/default` (Theme)
- `arch-box/Typography` / `arch-box/Layout` / `arch-box/Effects` → `color/neutral/800` (Primitives)

Verify each binding resolves to a variable. If the scaffold wrote only a fallback hex, rebind now using `figma.variables.createVariableAlias(variable)` on the fill paint's `boundVariables.color`. Leave sizes, positions, and arrows unchanged.

**Platform Mapping table (Section 2)**

Locate `doc/table/token-overview/platform-mapping` via `page.findOne(n => n.name === 'doc/table/token-overview/platform-mapping')`. For every row named `doc/table/token-overview/platform-mapping/row/{tokenPath}`:

1. Read `{tokenPath}` from the layer name.
2. Look up the variable by path from the correct collection (Theme for `color/*`, Primitives for raw ramps, Typography for `{Slot}/*/font-size` etc., Layout for `space/*`/`radius/*`, Effects for `shadow/color`).
3. Read the variable's live `codeSyntax`. For each of WEB / ANDROID / iOS:
   - Find the cell `.../row/{tokenPath}/cell/{web|android|ios}`.
   - If the text content differs from live `codeSyntax`, update `text.characters`.
   - Leave the `token` cell text alone.
4. If a row's `{tokenPath}` no longer exists, append ` · stale` to the `token` cell caption.

**Minimum row set** — read from [`../data/platform-mapping-rows.json`](../data/platform-mapping-rows.json) `rows` array. If any row is absent from the scaffolded table, insert it using the same row pattern before the pre-pass deletes placeholders. Column widths are in `columnWidths` in the same file.

Re-apply "last row has no bottom stroke" after any insertion.

**Phone frames (Section 3)**

Find `dark-mode-phone/light` and `dark-mode-phone/dark`. Verify:

- `phone-frame/light` → fill bound to `color/background/default` (Theme, resolves Light).
- `phone-frame/dark` → fill bound to `color/neutral/950` (Primitives) so it reads as dark without Theme Dark mode at render time.

If the Plugin API supports `setExplicitVariableModeForCollection`, you may instead wrap `phone-frame/dark` in a `doc/theme-preview/dark` wrapper and bind fill to `color/background/default` in Dark mode.

**Typography scale (Section 3, right panel)**

Find each `scale-cell/{mode}` cell. If Typography modes expose `Body/LG/font-size`, bind the specimen text's `fontSize` via `setBoundVariable('fontSize', ...)` with explicit mode per cell. Otherwise leave scaffold sizes.

**Placeholder strips from `/new-project` Step 5d**

Delete every node whose **name** starts with `placeholder/`. If any legacy text node still contains `TBD`, replace with the resolved value implied by the nearest section or table row; if ambiguous, use the resolved `color/primary/500` hex.

Log the **Canvas checklist** row for Step 17.

---

## Step 18 — Update Cover with Brand Colors

Navigate to the `Thumbnail` page. Find the frame named `Cover`.

**If `Cover` is found:**

1. Read the frame's `fills` array. Locate the `GRADIENT_LINEAR` fill.
2. Update `gradientStops[0].color` to resolved RGBA for `color/primary/500` (Primitives).
3. Update `gradientStops[1].color` to resolved RGBA for `color/secondary/500` (Primitives).
4. Leave `gradientTransform` completely unchanged.
5. Write updated fills back.

**If `Cover` is not found:** log `Cover frame not found — skipping Step 18` and continue.

Log the **Canvas checklist** row for Step 18 (done or skipped).

---

## Step 19 — Offer next step

If **`WRITE_TOKENS_CSS` is true** and `TOKEN_CSS_PATH` is set, call **AskUserQuestion**:

> "Run `/create-component` now to build UI components and wire them to `{TOKEN_CSS_PATH}`? (yes / no)"

If **yes**, pass `TOKEN_CSS_PATH` as context when invoking `/create-component`. If **no**, close the skill.

If **`WRITE_TOKENS_CSS` is false**, call **AskUserQuestion**:

> "`tokens.css` was not written this run (Figma variables only). Run `/create-component` anyway? (yes / no) — if **yes**, you will need a token CSS file path."

If **yes** without `TOKEN_CSS_PATH`, invoke `/create-component` with clear context that the designer must supply `token_css_path`. If **no**, close the skill.

---

## Error Guidance

| Error | Cause | Resolution |
|---|---|---|
| 403 Permission denied | MCP connector not authenticated or insufficient Figma tier | Re-authenticate in Claude Code settings; confirm Organization/Enterprise tier |
| 404 File not found | File key is wrong or file was deleted | Verify key from URL; re-run `/new-project` if needed |
| Partial write failures (errors in 200 response) | Malformed variable payload or non-existent alias ID | Retry failed variables; report names and reasons if retry fails |
| Variable alias resolution failure | Alias references a Primitive ID that doesn't exist | Confirm Primitives collection was written before alias collections; re-run Primitives step if IDs are missing |
| Typography mode count mismatch | Fewer than 8 modes on Typography collection | Verify all 8 mode names were sent (85, 100, 110, 120, 130, 150, 175, 200) |
