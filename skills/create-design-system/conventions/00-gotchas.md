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

### §0.1.H `primaryAxis` / `counterAxis` flip with `HORIZONTAL` body cells

`primaryAxisSizingMode` refers to the **layout axis**, not the horizontal axis. Default body cells are `VERTICAL` → primary = height (`AUTO`=Hug), counter = width (`FIXED`=colWidth). When a cell is `HORIZONTAL` (Theme `LIGHT`/`DARK` swatch + hex, Spacing / Radius `PREVIEW`, Text Styles category sub-header — anything that calls `makeBodyCell(colWidth, 'HORIZONTAL')` or reassigns `cell.layoutMode = 'HORIZONTAL'` after construction), the axes **flip**: primary = width, counter = height. Reusing the VERTICAL recipe means `primary = 'AUTO'` collapses width to content and `counter = 'FIXED'` pins height at 1px — header cells read `colWidth`, body cells hug to ~110px → every row looks offset from its header.

```js
// HORIZONTAL body cell (inverse of §0.1 VERTICAL defaults)
cell.layoutMode            = 'HORIZONTAL';
cell.primaryAxisSizingMode = 'FIXED';   // horizontal = fixed colWidth
cell.counterAxisSizingMode = 'AUTO';    // vertical   = Hug height
cell.resize(colWidth, 1);
// ... append children, then re-assert after appendChild.
```

`_lib.js` `makeBodyCell` + `rehugCell` branch on `cell.layoutMode` to apply the correct pair — never hand-roll VERTICAL modes on a HORIZONTAL cell. For sites that flip `layoutMode` post-construction (e.g. `layout.js` / `primitives.js` `PREVIEW`), re-assert `primaryAxisSizingMode = 'FIXED'` + `counterAxisSizingMode = 'AUTO'` **inline** right after the reassignment; don't wait for `rehugCell` to clean up because the cell may be resized before the rehug re-asserts.

### §0.1.V Variable value shape in `valuesByMode` — no `.type` / `.value`

Figma Plugin API `Variable.valuesByMode[modeId]` returns one of:

- `{ type: 'VARIABLE_ALIAS', id }` for aliases — the **only** shape with a `.type` field.
- A **raw JS primitive** for terminal values: `number` (FLOAT), `string` (STRING), `boolean` (BOOLEAN), or a plain `{ r, g, b }` / `{ r, g, b, a }` object for COLOR. **None of these carry `.type`**.

Old resolvers in runner fragments used `val.type === 'COLOR' ? colorToHex(val) : '#000000'` (Theme hex) and `val.type === 'FLOAT' ? val.value : 0` (Layout / Effects px). Both guards always fell through to the fallback — every Theme hex collapsed to `#000000`, every numeric token resolved to `0`, preview bars/swatches collapsed to `2px`, and aliases never followed.

```js
// Terminal node — no .type, read the primitive/object directly:
if (typeof val === 'object' && val !== null && val.type === 'VARIABLE_ALIAS') {
  // follow alias, remap modeId by next.variableCollectionId, continue.
}
if (typeof val === 'number') return val;                       // FLOAT
if (typeof val === 'object' && typeof val.r === 'number')       // COLOR
  return colorToHex(val);
return fallback;
```

Audit: if probing a fresh Theme draw returns `#000000` for every row's `cell/light` / `cell/dark` TEXT, or a fresh Layout draw returns `0px` values / PREVIEW bars `w=2`, this bug has fired. The fix lives in `canvas-templates/bundles/_step15b-runner.fragment.js`, `_step15c-layout-runner.fragment.js`, and `_step15c-effects-runner.fragment.js` — re-run [`scripts/bundle-canvas-mcp.mjs`](../scripts/bundle-canvas-mcp.mjs) after editing any of them.

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

## §0.10 Component masters + `/create-component` doc shells — `resize()` resets sizing modes

Figma’s `node.resize(w, h)` **resets** `primaryAxisSizingMode` and `counterAxisSizingMode` on auto-layout frames to **`FIXED`**. Code that sets **`AUTO`** (Hug) **before** `resize(w, 1)` therefore ends with **both axes FIXED** and height **1** — the classic **320×1 variant** and **1640×1 usage row**. This is the same footgun as §0.1 / §10.1 in create-component; it shows up on **`COMPONENT` roots**, inner chrome frames that call `resize` after assigning modes, and **`doc/component/{name}/usage`**.

**VERTICAL `COMPONENT` roots** (field, surface-stack, container, …):

```js
c.layoutMode = 'VERTICAL';
c.resize(width, 1); // width seed; height 1 is intentional until Hug runs
c.primaryAxisSizingMode = 'AUTO';   // Hug stack height — MUST follow resize
c.counterAxisSizingMode = 'FIXED'; // fixed width
// Optional but explicit for Assets / instances:
c.layoutSizingHorizontal = 'FIXED';
c.layoutSizingVertical = 'HUG';
```

**HORIZONTAL doc rows** (e.g. `doc/component/{name}/usage` — Do / Don’t side-by-side): primary = horizontal, **counter = vertical**. `counterAxisSizingMode = 'FIXED'` + `resize(1640, 1)` pins **height at 1px**. Use **`counterAxisSizingMode = 'AUTO'`** so the row hugs the tallest column, and set `layoutSizingVertical = 'HUG'` if Figma pins `FIXED` after `appendChild`.

**Matrix specimen cells** (`matrix/.../cell/{state}`): cells are **HORIZONTAL**. **`counterAxisSizingMode = 'AUTO'`** + **`minHeight`** (e.g. 72) lets the cell **grow with tall instances** (inputs with label + helper) instead of clipping at a fixed 72px band. Keep **`primaryAxisSizingMode = 'FIXED'`** for the column width.

**Inner chrome** (e.g. `field` frame): if you assign `primary`/`counter` then call `resize`, **re-assign** `FIXED`/`FIXED` **after** `resize` so dimensions and modes stay aligned.

**Audit:** any `COMPONENT` or doc-section frame that should stack content but reads **`width > 40` and `height ≤ 2`** with children taller than that — open sizing: almost always **resize-before-AUTO** order or **horizontal frame** missing **counter `AUTO`**.
