# 14. Audit checklist before committing canvas work

## Variables & codeSyntax
- [ ] Did I set `codeSyntax` on every variable, all three platforms (via REST API)?
- [ ] Does every iOS `codeSyntax` use dot-separated lowercase with no camelCase segments?
- [ ] Do Theme `codeSyntax` values come from the Step 6 table (not derived from the path)?

## Canvas geometry
- [ ] Is every style-guide `_PageContent` exactly **1800** wide, padding **80**, fill literal white?
- [ ] **§0.1 (shell)** — Is `_PageContent` **Hug height** (`primaryAxisSizingMode: 'AUTO'`, `layoutSizingVertical: 'HUG'`, `resizeWithoutConstraints(1800, 1)`) — **not** a fixed placeholder height that clips tables (e.g. 400px)?
- [ ] **§0.1 (groups)** — Is every **`doc/table-group/*`** **Hug height** with **`clipsContent: false`** — **not** `resize(1640, 80)` + **`clipsContent: true`** (clips the full `doc/table/*`)?
- [ ] Is every `_Header` instance 1800 wide with `cornerRadius: 0` and `layoutMode: VERTICAL`?
- [ ] Do TOC + Token Overview use 1800 wide with 40 padding (not 80)?

## Tables
- [ ] Does every table render at 1640 wide with columns summing to exactly 1640?
- [ ] **§ 0.5** — Is every `doc/table/.../header/cell/*` frame **`layoutMode: 'HORIZONTAL'`** with **FIXED / FIXED** sizing and **explicit** `resize(colWidth, 56)` (not VERTICAL + AUTO height)?
- [ ] **§ 0.6** — Does **every** table `TEXT` (header labels included) use `textAutoResize: 'HEIGHT'` — never `'NONE'` on shipped tables?
- [ ] Does every row have `minHeight: 64`, `paddingV: 16`, `counterAxisAlignItems: CENTER`?
- [ ] Does every body cell have `paddingH: 20` (not 16)?
- [ ] **§ 0.1** — Did I set `counterAxisSizingMode: 'AUTO'` (Hug) on every body row **before** `resize(1640, 1)`? (Symptom when missed: 1px-tall rows.)
- [ ] **§ 0.1** — Did I set `primaryAxisSizingMode: 'AUTO'` (Hug) on every body cell **before** `resize(colWidth, 1)`? (Symptom when missed: 1px-tall cells inside a taller row.)
- [ ] **§ 0.2** — Did I call `textAutoResize = 'HEIGHT'` after every `text.characters` assignment?
- [ ] Did I use `resizeWithoutConstraints(1640, 1)` on table roots instead of `resize(1640, 10)`?
- [ ] **§ 0.3** — On Theme LIGHT/DARK cells: is the hex text a **sibling** of the mode-scoped wrapper (not a child)?
- [ ] Did I remove the bottom stroke from the last row of every table?
- [ ] **§ 0.4** — Did I apply `Effect/shadow-sm` only after Step 15c §0 published it?

## Text & bindings
- [ ] Is every cell bound to `Doc/Section`, `Doc/TokenName`, `Doc/Code`, or `Doc/Caption` (never raw `fontName`/`fontSize`)?
- [ ] Are all chrome fills/strokes bound per §12 (no hard-coded neutrals)?
- [ ] Are swatch chip fills bound to the row's own variable (not resolved hex)?
- [ ] Preview bars/squares: width/cornerRadius bound to the row's `Space/*` or `Corner/*` variable?

## Text Styles specifics
- [ ] Do Body slots include all 5 variants (`regular` / `emphasis` / `italic` / `link` / `strikethrough`) nested inside `Body/{size}/`?
- [ ] Do `/link` specimen rows bind fill to `color/primary/default` and `/strikethrough` to `color/background/content-muted`?
- [ ] Are the 5 category sub-header rows present (Display / Headline / Title / Body / Label)?

## Pages
- [ ] Did I avoid creating `↳ MCP Tokens` or `[MCP] Token Manifest`?

## TOC + Token Overview
- [ ] Do both pages render at `1800` wide with `40` padding (not `80`)?
- [ ] Does every text node on both pages carry `textStyleId` (`Doc/Section` / `Doc/TokenName` / `Doc/Code` / `Doc/Caption`) — not raw `fontName`/`fontSize`?
- [ ] **§0.8 guard — TOC band strips:** `TEXT` **direct children of `band-strip/{slug}`** (the horizontal strip row, e.g. the **`Doc/Code`** “`N sections · M pages`” line) must **not** use **§0.2**’s **`resize(parent.width − horizontalPadding, 1)`** — that yields **~1672px** width on a **1720** strip with **24** side padding and **destroys** `SPACE_BETWEEN` layout. If any such `TEXT` has **`width ≈ 1672`**, revert to **`textAutoResize: 'WIDTH_AND_HEIGHT'`** (hug). See [`00-gotchas.md`](./00-gotchas.md) **§0.8**.
- [ ] Does every fill/stroke bind to a Theme or Primitives variable (hex literals only as scaffold-time fallbacks)?
- [ ] Is the Token Overview platform-mapping table built with § H hierarchy (`doc/table/token-overview/platform-mapping/{header|body|row/*|cell/*}`) — no absolute `x`/`y` positioning?
- [ ] Do platform-mapping columns sum to exactly **1640** (TOKEN 400 · WEB 420 · ANDROID 340 · iOS 480)?
- [ ] Does the TOC have **4 band strips** (`band-strip/foundations`, `…/atoms`, `…/components`, `…/platform`) above 2-column card grids?
- [ ] Do **TOC section cards**, **Token Overview section shells** (`token-overview/*` from `/new-project` 05d), **Dark Mode / Font Scale panels**, and the **TOC summary bar** carry `effectStyleId: Effect/shadow-sm` on their **outer** frames once § G Depth is published?
- [ ] Does **`doc/table/token-overview/platform-mapping`** (table root, `header`, `body`, every `row/*`, `cell/*`) have **no** shadow — `effects` empty and **`effectStyleId` cleared** — with depth coming **only** from the parent **`token-overview/platform-mapping`** shell (no double elevation)?

If any box is unchecked, fix before reporting "done."

---

## Optional machine gate (read-only `use_figma`)

After the first full table exists on a style-guide page, run **one** small script that `return`s **violations** (empty arrays = pass):

- **`badHeaderCells`** — any `FRAME` whose `name` matches `/header\\/cell\\//` and (`layoutMode !== 'HORIZONTAL'` **or** `counterAxisSizingMode !== 'FIXED'` **or** `height < 8`).
- **`badTableText`** — any `TEXT` whose `name` or `parent.name` includes `/cell/` and `textAutoResize === 'NONE'`.
- **`badSwatchFills`** — any `RECTANGLE` under a `.../cell/swatch` frame (case-insensitive `swatch`) on a **`doc/table/primitives/color/...`** row where `fills[0]` is `SOLID` and **not** bound (`!fills[0].boundVariables || !fills[0].boundVariables.color`).
- **`badPageContent`** — any `_PageContent` on a style-guide page where `primaryAxisSizingMode !== 'AUTO'` or `layoutSizingVertical === 'FIXED'` with height **under ~2000px** while it has **`doc/table-group`** descendants (likely clipped).
- **`badTableGroups`** — any `FRAME` named `doc/table-group/*` with `clipsContent === true` **or** `primaryAxisSizingMode === 'FIXED'` **or** height **under ~200px** while a child `doc/table/*` is **over ~300px** tall (group is clipping the table).

Do **not** treat “the header row frame is 56px tall” as success if `badHeaderCells` is non-empty — child frames can still be 1px slivers. Do **not** treat “the swatch shows color” as success if `badSwatchFills` is non-empty — that is only resolved paint, not token-linked.
