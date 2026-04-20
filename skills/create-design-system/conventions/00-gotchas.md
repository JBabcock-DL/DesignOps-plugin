# 0. Known gotchas (read before every canvas run)

> **Paired copy:** The same text lives under **Known gotchas (§0 — paired with `conventions/00-gotchas.md`)** in [`../SKILL.md`](../SKILL.md). **Edit both together** so agents (skill auto-context) and file readers stay aligned.

These rules produce every table-collapse / invisible-text / wrong-padding bug observed in real runs (including runs where weaker models **partially** followed §0.1 yet still shipped broken headers). Every phase file cross-references this section by anchor — do not paraphrase; do not re-state with different numbers.

### 0.1 Row AND cell height stays **Fixed at 1** unless you set the height axis to **Hug** first

Applies at BOTH levels — `doc/table/{slug}/row/{tokenPath}` (row frame) AND `doc/table/{slug}/row/{tokenPath}/cell/{col}` (body cell). The `1` in `resize(1640, 1)` / `resize(colWidth, 1)` is a **width-setting placeholder** — if the height axis isn't already **Hug** before the resize call, the `1` sticks as a permanent **Fixed** height and the row/cell draws as a 1px sliver.

**Required order — rows (`doc/table/{slug}/row/{tokenPath}`):**

```js
row.layoutMode              = 'HORIZONTAL';
row.counterAxisSizingMode   = 'AUTO';    // height: Hug tallest cell
row.primaryAxisSizingMode   = 'FIXED';   // width: Fixed 1640
row.resize(1640, 1);                     // safe now — height axis is Hug
row.minHeight               = 64;
row.paddingTop              = 16;
row.paddingBottom           = 16;
row.counterAxisAlignItems   = 'CENTER';
```

**Required order — body cells (`.../row/*/cell/{col}`):**

```js
cell.layoutMode             = 'VERTICAL'; // or 'HORIZONTAL' for Theme LIGHT/DARK
cell.primaryAxisSizingMode  = 'AUTO';     // height: Hug content
cell.counterAxisSizingMode  = 'FIXED';    // width: Fixed colWidth
cell.resize(colWidth, 1);                 // safe now — height axis is Hug
cell.paddingLeft            = 20;
cell.paddingRight           = 20;
cell.paddingTop             = 4;
cell.paddingBottom          = 4;
cell.itemSpacing            = 4;
```

Equivalent: call `resizeWithoutConstraints(w, 1)` — the same trick already used on `doc/table/{slug}`. Either approach works; pick one and use it everywhere.

**After `appendChild` into a STRETCH parent,** Figma may assign **`layoutSizingVertical: 'FIXED'`** (and **`counterAxisSizingMode: 'FIXED'`** on `HORIZONTAL` rows) even when you intended Hug height — rows and body cells **lock to ~1px or minHeight-only** and code reads as “fixed height collapse.” **Re-assert** `counterAxisSizingMode = 'AUTO'` on body rows, `primaryAxisSizingMode = 'AUTO'` on **VERTICAL** body cells, and set **`layoutSizingVertical = 'HUG'`** (and `layoutSizingHorizontal = 'FIXED'` on cells / `'FILL'` on rows) **after** the node is in the tree, then `resizeWithoutConstraints(1640, 1)` / `resize(colWidth, 1)` again.

**`doc/table-group/{slug}` must never use a placeholder `resize(1640, 80)` (or any fixed height) with `primaryAxisSizingMode: 'FIXED'`** — that frame **clips** the full `doc/table/{slug}` (often `clipsContent: true`), so the UI shows a **~80px band** with overlapped titles and **invisible** rows. Table groups are **`VERTICAL` · primary `AUTO` (Hug)** · counter **`FIXED` 1640** · `layoutSizingVertical: 'HUG'` · `resizeWithoutConstraints(1640, 1)` · `clipsContent: false`** (clipping belongs on the inner **`doc/table/{slug}`** chrome only, per §8).

### 0.2 Text nodes collapse rows at ~10px unless `textAutoResize = 'HEIGHT'` is set

Immediately after `text.characters = "…"`, call `text.resize(colWidth - 40, 1)` (where `40` = left padding `20` + right padding `20`), then `text.textAutoResize = 'HEIGHT'`. Never leave `'NONE'` — that is the **root cause** of the 10px collapse. Mono-line cells use `colWidth - 40` everywhere. If you see `- 32` in any phase file, it is wrong.

### 0.3 Theme hex text must be a **sibling** of the mode-scoped wrapper, not a child

Theme LIGHT/DARK cells are HORIZONTAL with **two siblings**: [1] `doc/theme-preview/{mode}` holding **only** the chip (bound fill; `setExplicitVariableModeForCollection(themeCollection, modeId)` applied), [2] `Doc/Code` hex text **outside** that wrapper. If the hex text is parented inside the Dark wrapper, its `color/background/content` fill resolves to white on a white cell and vanishes.

### 0.4 `Doc/*` text styles and `Effect/shadow-*` must exist before 15a/15b bind to them

Step 15c § 0 publishes `Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`, and `Effect/shadow-{sm,md,lg,xl,2xl}`. On a **first** run, execute 15c § 0 **before** 15a/15b so the first pass binds `textStyleId` / `effectStyleId` cleanly. Falling back to raw `fontName`/`fontSize` and then re-running 15a/15b to upgrade wastes a full pass.

### 0.5 Header cells must **not** reuse the body-cell factory (VERTICAL + Hug is wrong here)

**Observed failure mode (MCP diff, 2026):** A “good” table ([`testingUpdates — Foundations`](https://www.figma.com/design/BLcvn6UptGIgtNzNfLU4TU/testingUpdates-%E2%80%94-Foundations?node-id=204-7)) uses **`doc/table/.../header/cell/*` as `layoutMode: 'HORIZONTAL'`** with **`primaryAxisSizingMode: 'FIXED'`** and **`counterAxisSizingMode: 'FIXED'`**, explicit `resize(colWidth, headerHeight)` **before** text, and header text with **`textAutoResize: 'HEIGHT'`**. A broken run ([`v44-updates — Foundations`](https://www.figma.com/design/uCpQaRsW4oiXW3DsC6cLZm/v44-updates-%E2%80%94-Foundations?node-id=106-10)) reused **body** rules (`VERTICAL` + primary `AUTO` + `resize(colWidth, 1)` while text was still `'NONE'`) for header cells → **every header cell height stuck at 1px** while the header **row** stayed ~56px tall — unreadable chrome.

**Required pattern — each `doc/table/{slug}/header/cell/{col}` (Primitives / Theme / Layout / Effects / Token Overview):**

```js
cell.layoutMode              = 'HORIZONTAL';
cell.primaryAxisSizingMode   = 'FIXED';   // width: colWidth
cell.counterAxisSizingMode   = 'FIXED';   // height: header band (56 per §8 / build-order; do not leave Hug here)
cell.resize(colWidth, 56);               // before appendChild(labelText)
// then mono-line text: characters → resize(colWidth - 40, 1) → textAutoResize = 'HEIGHT' → textStyleId → fill
```

Body cells stay **§ 0.1** (`VERTICAL`, Hug-then-resize). **Never** call the same “create body cell” helper for header cells without swapping to the block above.

### 0.6 `'NONE'` on text inside Hug-height body cells still reads as a bug (~9px rails)

If `textAutoResize` is still `'NONE'` when the parent body cell correctly uses Hug height (**§ 0.1**), Figma often leaves the text bounding box at **~1–9px** tall. Rows can look “open” because `minHeight` / swatch cells hold the row height, but **TOKEN / HEX / WEB** columns look crushed. Apply **§ 0.2** to **every** table `TEXT` (header **and** body) before moving on.

**Section title + caption:** **`TEXT` nodes that are direct children of `doc/table-group/{slug}`** (before the inner `doc/table/{slug}` frame) are **not** inside `.../cell/` — scripts that only walk **`/cell/`** paths will **miss** them. They still default to **`textAutoResize: 'NONE'`** and **1px** height, so the **Doc/Section** title and **Doc/Caption** line **stack on top of each other** and over the table header. Apply **§ 0.2** to those two texts explicitly.

**Layer paths:** Prefer **lowercase** slug segments in names (`.../cell/token`, `.../cell/ios`) to match the golden reference tree — avoid `.../cell/TOKEN` / `.../cell/iOS` drift that makes grep-based audits miss cells.

### 0.7 Primitives color **swatch** rectangles must bind fill → the row’s **COLOR** variable

**Observed failure (MCP, same v44 file):** every `RECTANGLE` under `doc/table/primitives/color/.../cell/swatch` (or `.../cell/SWATCH`) had a plain **`SOLID`** fill with **no** `boundVariables.color`. The golden file binds **`figma.variables.setBoundVariableForPaint`** on that fill to the **`Primitives`** variable whose **`name`** equals the row token path (the segment after `/row/` in the row frame name, e.g. `color/primary/500`). Leaving resolved hex on the chip is a **hard fail** for a variables-first style guide — swatches will not track token edits.

**Required:** after creating the swatch `RECTANGLE`, resolve the row’s COLOR variable from the cached `path → Variable` map, clone `fills[0]`, call `setBoundVariableForPaint(paint, 'color', variable)`, assign `rect.fills = [newPaint]` (see figma-use: return value **must** be reassigned). Stroke on the chip still binds per §12 in [`11-cells-12-bindings-13-build-order.md`](./11-cells-12-bindings-13-build-order.md) (`color/border/subtle`, Theme · Light).

**Do not** mark Step 15a “done” until a read-only probe shows `boundVariables.color` on swatch rects (see optional gate in [`14-audit.md`](./14-audit.md)).
