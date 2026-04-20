# 0. Known gotchas (read before every canvas run)

> **Paired copy:** The same text lives under **Known gotchas (§0 — paired with `conventions/00-gotchas.md`)** in [`../SKILL.md`](../SKILL.md). **Edit both together** so agents (skill auto-context) and file readers stay aligned.

These four rules produce every table-collapse / invisible-text / wrong-padding bug observed in real runs. Every phase file cross-references this section by anchor — do not paraphrase; do not re-state with different numbers.

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

### 0.2 Text nodes collapse rows at ~10px unless `textAutoResize = 'HEIGHT'` is set

Immediately after `text.characters = "…"`, call `text.resize(colWidth - 40, 1)` (where `40` = left padding `20` + right padding `20`), then `text.textAutoResize = 'HEIGHT'`. Never leave `'NONE'` — that is the **root cause** of the 10px collapse. Mono-line cells use `colWidth - 40` everywhere. If you see `- 32` in any phase file, it is wrong.

### 0.3 Theme hex text must be a **sibling** of the mode-scoped wrapper, not a child

Theme LIGHT/DARK cells are HORIZONTAL with **two siblings**: [1] `doc/theme-preview/{mode}` holding **only** the chip (bound fill; `setExplicitVariableModeForCollection(themeCollection, modeId)` applied), [2] `Doc/Code` hex text **outside** that wrapper. If the hex text is parented inside the Dark wrapper, its `color/background/content` fill resolves to white on a white cell and vanishes.

### 0.4 `Doc/*` text styles and `Effect/shadow-*` must exist before 15a/15b bind to them

Step 15c § 0 publishes `Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`, and `Effect/shadow-{sm,md,lg,xl,2xl}`. On a **first** run, execute 15c § 0 **before** 15a/15b so the first pass binds `textStyleId` / `effectStyleId` cleanly. Falling back to raw `fontName`/`fontSize` and then re-running 15a/15b to upgrade wastes a full pass.
