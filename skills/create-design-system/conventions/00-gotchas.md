# §0 — Known canvas gotchas (authoritative)

> **Single source of truth.** [`../SKILL.md`](../SKILL.md) links here by anchor. Do **not** paraphrase or renumber in phase files — cite `§0.N` and link back.
>
> Incident history (which Figma files failed, when, and why) lives in [`../CHANGELOG.md`](../CHANGELOG.md). This file holds **rules + code**, not narrative.

## §0.1 Hug-before-resize on rows and body cells

`resize(w, 1)` / `resize(colWidth, 1)` is a width-setter. If the height axis is still `FIXED`, the `1` sticks and the row/cell draws as a 1px sliver. Applies at both levels: row frame (`doc/table/{slug}/row/{tokenPath}`) **and** body cell (`.../row/*/cell/{col}`).

**Rows:**
```js
row.layoutMode            = 'HORIZONTAL';
row.counterAxisSizingMode = 'AUTO';   // Hug height
row.primaryAxisSizingMode = 'FIXED';  // Fixed 1640 width
row.resize(1640, 1);
row.minHeight             = 64;
row.paddingTop            = 16;
row.paddingBottom         = 16;
row.counterAxisAlignItems = 'CENTER';
```

**Body cells:**
```js
cell.layoutMode            = 'VERTICAL';  // or 'HORIZONTAL' for Theme LIGHT/DARK
cell.primaryAxisSizingMode = 'AUTO';      // Hug height
cell.counterAxisSizingMode = 'FIXED';     // Fixed colWidth
cell.resize(colWidth, 1);
cell.paddingLeft  = 20;
cell.paddingRight = 20;
cell.paddingTop   = 4;
cell.paddingBottom= 4;
cell.itemSpacing  = 4;
```

`resizeWithoutConstraints(w, 1)` is equivalent — pick one and use it everywhere.

**Post-`appendChild` re-assert.** Figma may flip `layoutSizingVertical` to `FIXED` (and `counterAxisSizingMode` to `FIXED` on HORIZONTAL rows) when a node is appended into a `STRETCH` parent. Re-assert `AUTO` on the height axis, set `layoutSizingVertical = 'HUG'` (`layoutSizingHorizontal = 'FILL'` on rows / `'FIXED'` on cells), then re-`resize(…, 1)`.

**Table-group wrapper.** `doc/table-group/{slug}` is **`VERTICAL` · primary `AUTO` · counter `FIXED 1640` · `layoutSizingVertical: 'HUG'` · `resizeWithoutConstraints(1640, 1)` · `clipsContent: false`**. Never `resize(1640, 80)` with `primaryAxisSizingMode: 'FIXED'` — it clips the inner `doc/table/{slug}`.

## §0.2 `textAutoResize = 'HEIGHT'` on every TEXT

Immediately after `text.characters = "…"`:
```js
text.resize(colWidth - 40, 1);   // 40 = paddingLeft 20 + paddingRight 20
text.textAutoResize = 'HEIGHT';
```
Mono-line cells use `colWidth - 40` everywhere. `- 32` is wrong.

## §0.3 Theme hex text is a sibling of the mode wrapper, not a child

Theme LIGHT/DARK cell is `HORIZONTAL` with **two siblings**:
1. `doc/theme-preview/{mode}` — holds **only** the chip (bound fill, `setExplicitVariableModeForCollection` applied).
2. `Doc/Code` hex TEXT — **sibling**, not child.

If the hex TEXT is parented inside the Dark wrapper, its `color/background/content` fill resolves to white on white and vanishes.

## §0.4 Doc/* + Effect/shadow-* must exist before 15a/15b bind

`Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`, and `Effect/shadow-{sm,md,lg,xl,2xl}` publish at the **close of Step 11** (`phases/04-step11-push.md` § "Step 11 close"). When phases 02–04 are skipped (variables already present), run the Step 11 close block before 15a so `textStyleId`/`effectStyleId` bind on first pass.

## §0.5 Header cells ≠ body cells

Header cells are **HORIZONTAL + FIXED/FIXED**, resized with explicit header height **before** appending text:
```js
cell.layoutMode            = 'HORIZONTAL';
cell.primaryAxisSizingMode = 'FIXED';  // colWidth
cell.counterAxisSizingMode = 'FIXED';  // 56 (header band)
cell.resize(colWidth, 56);
// then text: characters → resize(colWidth - 40, 1) → textAutoResize = 'HEIGHT' → textStyleId → fill
```

Never reuse the §0.1 body-cell recipe (VERTICAL + Hug + `resize(colWidth, 1)`) for header cells — every header cell collapses to 1px.

## §0.6 `'NONE'` text inside Hug cells still reads as a bug

If `textAutoResize` is still `'NONE'` in a body cell that correctly uses Hug height (§0.1), Figma often leaves the text box at 1–9px tall. Apply §0.2 to **every** table TEXT — header and body.

**Direct TEXT children of `doc/table-group/{slug}`** (the title + caption that sit **before** the inner `doc/table/{slug}`) are not inside `.../cell/`. Scripts that walk only `/cell/` paths miss them. Apply §0.2 to those two texts explicitly.

**Lowercase slug segments** in layer names (`.../cell/token`, `.../cell/ios`) — matches the golden tree; `.../cell/TOKEN` / `.../cell/iOS` breaks grep audits.

## §0.7 Primitives color swatches bind fill to the row's COLOR variable

Every `RECTANGLE` under `doc/table/primitives/color/.../cell/swatch` must bind `fills[0]` to the `Primitives` variable whose `name` equals the row's token path. Resolved hex alone is a hard fail for a variables-first style guide.

```js
const variable = await figma.variables.getVariableByIdAsync(variableMap[row.tokenPath]);
const paint    = { ...rect.fills[0] };
const bound    = figma.variables.setBoundVariableForPaint(paint, 'color', variable);
rect.fills     = [bound];   // return value must be reassigned
```

Stroke still binds per §12 (`color/border/subtle`, Theme · Light). Gate Step 15a completion on a read-only probe that confirms `boundVariables.color` on swatch rects — see [`14-audit.md`](./14-audit.md).

## §0.8 TOC `band-strip/*` — do NOT apply blanket §0.2

`band-strip/{slug}` is a 64px HORIZONTAL strip with `primaryAxisAlignItems: SPACE_BETWEEN`, width **1720**, padding **24**. Applying §0.2 with `parent.width - paddingL - paddingR` yields **1672**, which forces the right-aligned `Doc/Code` count chip to a 1672-wide rail and collapses the strip.

**Required:** for TEXT whose parent name matches `^band-strip/` (but not `…/title-stack`), keep `textAutoResize: 'WIDTH_AND_HEIGHT'` so the chip hugs its string width. §0.2 full-width resize applies to table cells, captions, and full-bleed text only.

**Audit:** band-strip TEXT `width` should be **well under 1600**. If you see 1672, this bug has fired.

## §0.9 Token Overview platform-mapping — one shadow on the section shell only

`/new-project` Phase 05d wraps the platform-mapping block in `token-overview/platform-mapping` and applies `Effect/shadow-sm` **once** on that section shell. The inner `doc/table/token-overview/platform-mapping` and every descendant (`header`, `body`, `row/*`, `cell/*`) must stay flat: `effects = []` and `effectStyleId` cleared.

`/create-design-system` Step 17 pre-pass must **not** assign `shadow-sm` to any frame whose path starts with `doc/table/token-overview/platform-mapping`. Style-guide tables on other pages still apply one `shadow-sm` on the `doc/table/{slug}` root per §12 / §13.
