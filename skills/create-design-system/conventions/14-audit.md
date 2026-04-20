# 14. Audit checklist before committing canvas work

## Variables & codeSyntax
- [ ] Did I set `codeSyntax` on every variable, all three platforms (via REST API)?
- [ ] Does every iOS `codeSyntax` use dot-separated lowercase with no camelCase segments?
- [ ] Do Theme `codeSyntax` values come from the Step 6 table (not derived from the path)?

## Canvas geometry
- [ ] Is every style-guide `_PageContent` exactly 1800 wide, padding 80, fill literal white?
- [ ] Is every `_Header` instance 1800 wide with `cornerRadius: 0` and `layoutMode: VERTICAL`?
- [ ] Do TOC + Token Overview use 1800 wide with 40 padding (not 80)?

## Tables
- [ ] Does every table render at 1640 wide with columns summing to exactly 1640?
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
- [ ] Does every fill/stroke bind to a Theme or Primitives variable (hex literals only as scaffold-time fallbacks)?
- [ ] Is the Token Overview platform-mapping table built with § H hierarchy (`doc/table/token-overview/platform-mapping/{header|body|row/*|cell/*}`) — no absolute `x`/`y` positioning?
- [ ] Do platform-mapping columns sum to exactly **1640** (TOKEN 400 · WEB 420 · ANDROID 340 · iOS 480)?
- [ ] Does the TOC have **4 band strips** (`band-strip/foundations`, `…/atoms`, `…/components`, `…/platform`) above 2-column card grids?
- [ ] Do all section cards / panels / platform-mapping table / summary bar carry `effectStyleId: Effect/shadow-sm` once § G Depth is published?

If any box is unchecked, fix before reporting "done."
