---
name: create-design-system
description: Push brand tokens into five Figma variable collections — Primitives (including `typeface/display` + `typeface/body` STRING primitives), Theme (Light/Dark modes), Typography (M3 baseline — 15 slots × 4 properties × 8 Android-curve scale modes; font-family aliases typeface primitives), Layout, and Effects. Platform mapping (Web/Android/iOS) is encoded as codeSyntax on every variable instead of separate alias collections. Local tokens.css is optional (explicit opt-in after variables are pushed).
argument-hint: "Optional: --theme brand|baseline (default brand). Optional: --file-key <key-or-figma-design-url> (e.g. when chaining from /new-project). Baseline uses Material 3 static baseline seed hues for Primitives ramps; Brand uses wizard or pasted hexes."
agent: general-purpose
---

# Skill — `/create-design-system`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, build five variable collections with proper Light/Dark and typography scale modes, and push the result to the target Figma file.

**Repo-wide agent policy (MCP):** Inline payloads in each tool call — no `.mcp-*` / scratch staging files in the repo. See [`AGENTS.md`](../../AGENTS.md).

**Authoritative table/canvas rules** live in [`conventions/`](./conventions/) **shards** plus this file’s **§0** below — **not** in a single giant read. Index and §→file map: [`CONVENTIONS.md`](./CONVENTIONS.md) (router only, ~90 lines). **Do not** `Read` every shard at session start; follow **Conventions load map** for your current phase only.

**Phase files under [`phases/`](./phases/) orchestrate** — which step, which page, which slug, which row set, which AskUserQuestion to fire, which codeSyntax table to apply. They do **not** own geometry, columns, cells, or auto-layout rules. **When a phase file disagrees with the conventions shards or this §0, the conventions win.**

---

## Known gotchas (§0 — paired with `conventions/00-gotchas.md`)

> **Paired copy:** The same text is in [`conventions/00-gotchas.md`](./conventions/00-gotchas.md). **Edit both together.**

These rules produce every table-collapse / invisible-text / wrong-padding bug observed in real runs (including runs where **§0.1** was applied to body rows but **header cells** or **textAutoResize** were still wrong). Every phase file cross-references this section by anchor — do not paraphrase; do not re-state with different numbers.

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

**Required:** after creating the swatch `RECTANGLE`, resolve the row’s COLOR variable from the cached `path → Variable` map, clone `fills[0]`, call `setBoundVariableForPaint(paint, 'color', variable)`, assign `rect.fills = [newPaint]` (see figma-use: return value **must** be reassigned). Stroke on the chip still binds per §12 in [`conventions/11-cells-12-bindings-13-build-order.md`](./conventions/11-cells-12-bindings-13-build-order.md) (`color/border/subtle`, Theme · Light).

**Do not** mark Step 15a “done” until a read-only probe shows `boundVariables.color` on swatch rects (see optional gate in [`conventions/14-audit.md`](./conventions/14-audit.md)).

### 0.8 TOC `band-strip/*` — do **not** run blanket **§0.2** `resize(parentWidth − padding, 1)` on strip chrome `TEXT`

**Observed failure (MCP / audit-style pass, 2026):** a script walked every `TEXT` under **`📝 Table of Contents` → `_PageContent`** and applied **§0.2** using **`text.resize(parent.width - parent.paddingLeft - parent.paddingRight, 1)`**. For **`TEXT` nodes whose `parent.name` matches `^band-strip/`** (but **not** `…/title-stack`), the parent is the **64px-tall `HORIZONTAL`** strip (**`SPACE_BETWEEN`**, width **1720**, horizontal padding **24**). That formula yields **1720 − 48 = 1672** — the same number as **`CARD_INNER`** in [`new-project/phases/05c-table-of-contents.md`](./new-project/phases/05c-table-of-contents.md), but here it is **wrong**: it forces the right-aligned **`Doc/Code`** line (**`N sections · M pages`**) to a **1672px-wide** text rail, **collapsing** the band strip layout.

**Required:** **§0.2** full-width resize applies to **table cells**, **long captions**, and similar **full-bleed** text — **not** to **`TEXT` that is a direct child of `band-strip/{slug}`**. For those nodes, keep **`textAutoResize: 'WIDTH_AND_HEIGHT'`** (or hug **`HEIGHT`** after a **minimal** `resize` only if still `'NONE'`) so the count chip **hugs** its string width inside the auto-layout row.

**When auditing** ([`conventions/14-audit.md`](./conventions/14-audit.md) § TOC + Token Overview): strip **`TEXT`** `width` must stay **well below** **~1600** — if you see **1672**, this bug has fired.

---

## Conventions load map (lazy — required)

`Read` **only** the convention files for the phase you are executing. **§0** is already in this SKILL (and [`conventions/00-gotchas.md`](./conventions/00-gotchas.md)); re-read the file if you need the verbatim anchor in isolation.

| Phase | When | Convention files to open |
|------|------|----------------------------|
| 01 | Steps 1–4 | **None** |
| 02 | Steps 5–9 | [`conventions/01-collections.md`](./conventions/01-collections.md), [`conventions/02-codesyntax.md`](./conventions/02-codesyntax.md) |
| 03 | Step 10 | **None** |
| 04 | Step 11 | **None** |
| 05 | Steps 12–14 | **None** |
| 06 | Canvas documentation spec | [`conventions/03-through-07-geometry-and-doc-styles.md`](./conventions/03-through-07-geometry-and-doc-styles.md), [`conventions/08-hierarchy-and-09-autolayout.md`](./conventions/08-hierarchy-and-09-autolayout.md) |
| 07 | Steps 15a–c / any `use_figma` on style-guide tables | **Ordered:** [`conventions/column-widths.json`](./conventions/column-widths.json) → [`conventions/10-column-spec.md`](./conventions/10-column-spec.md) → [`conventions/11-cells-12-bindings-13-build-order.md`](./conventions/11-cells-12-bindings-13-build-order.md) → [`conventions/08-hierarchy-and-09-autolayout.md`](./conventions/08-hierarchy-and-09-autolayout.md) → [`conventions/03-through-07-geometry-and-doc-styles.md`](./conventions/03-through-07-geometry-and-doc-styles.md) — plus phase file [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) |
| 08 | Steps 17–19; canvas verification | [`conventions/14-audit.md`](./conventions/14-audit.md) when verifying or editing canvas |

**Heavy read liveness (required):** Before the first `Read` of any single file expected to be **~200 lines or more** (notably [`phases/02-steps5-9.md`](./phases/02-steps5-9.md), [`phases/06-canvas-documentation-spec.md`](./phases/06-canvas-documentation-spec.md), [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md), or [`conventions/03-through-07-geometry-and-doc-styles.md`](./conventions/03-through-07-geometry-and-doc-styles.md)), send **one** short user-visible line first, e.g. `Loading skills/create-design-system/phases/07-steps15a-15c.md (~190 lines)…`

---

## Optional — Parse `$ARGUMENTS` for theme source

Before Step 1, parse `$ARGUMENTS` for `--theme` and `--file-key`:

**`--theme`**

- `--theme baseline` → set `THEME_SOURCE` to **`baseline`** and `THEME_FROM_CLI` to **true** (Material 3 static baseline seed colors for Primitives ramps — see Step 5).
- `--theme brand` → set `THEME_SOURCE` to **`brand`** and `THEME_FROM_CLI` to **true**.
- Flag absent or invalid → set `THEME_FROM_CLI` to **false** and leave `THEME_SOURCE` unset until Step 2.5 (wizard path only).

When `THEME_FROM_CLI` is **true** and Step 2 was **no**, skip Step 2.5. When Step 2 is **yes** (pasted tokens), always use **`brand`** for Primitives color ramps (ignore `--theme baseline` for colors).

**`--file-key`** (optional; e.g. read-only plugin install, or when handoff was not written)

- Accept `--file-key <value>` or `--file-key=<value>`. Strip quotes.
- If `<value>` matches `figma.com/design/<KEY>/` or `figma.com/file/<KEY>/`, set `FILE_KEY_FROM_ARGS` to `<KEY>` (the path segment only: letters, digits, hyphens).
- Otherwise treat the whole value as a bare file key. If it matches `^[A-Za-z0-9-]+$`, set `FILE_KEY_FROM_ARGS`. If invalid, ignore the flag (Step 1 will prompt).

---

## Interactive input contract

- For **Steps 1–4**, **Step 2.5** (theme source, when needed), **Step 10** (plan approval — `yes` / `details` / change request), **Step 11** when a per-collection push fails (Plugin script or REST `codeSyntax` patch) (`retry` / `skip` / `abort`) or returns partial errors (`retry` / `skip` / `abort`), **Step 12.5** (optional `tokens.css`), **Step 13** (path prompt in 13a when CSS is opted in), and **Step 19**, collect designer input **only** using **AskUserQuestion**. Use **one AskUserQuestion call per question** and wait for each answer before the next call.
- **Do not** print a block of multiple questions as plain markdown before the first AskUserQuestion.
- After any AskUserQuestion, you may show a brief acknowledgment in prose; do not bundle the next question in that same message — call AskUserQuestion again.
- Follow **Progress checklist** below so the designer sees liveness during long wizard and API runs.

---

## Progress checklist (required)

**While collecting answers (Steps 1–4):** After **each** Step 3 `AskUserQuestion` answer, send **one** short line before the next question, e.g. `Collected: base border radius (px)` — no big checklist yet.

**After Step 4 finishes** (current Figma variable state is read), the long work begins. Immediately post the **“Building your design system”** checklist below with **every** line `[ ]` and `Current:` on the **first** row. Then **repost the entire checklist** after each listed item completes (Steps 5–19), updating `[x]` and moving `Current:` to the next row. Do **not** paste JSON, CSS blobs, or full API payloads into these messages.

If a row is **skipped** by skill logic (e.g. no canvas step), mark it `[x]` once and note `(skipped)` in `Current:` when you skip forward.

**On failure**, leave that row `[ ]`, add one line of context, retry that unit before checking later rows.

### Template — use after Step 4 (copy and update)

**Building your design system**

Current: Building Primitives…

- [ ] Building Primitives (color ramps, space, radius, elevation, typeface strings)
- [ ] Building Theme (semantic colors — Light & Dark)
- [ ] Building Typography (type styles × 8 scale modes)
- [ ] Building Layout (spacing & radius aliases)
- [ ] Building Effects (shadows & blur per mode)
- [ ] Preparing plan — waiting for your approval
- [ ] Pushing variable collections to Figma (Plugin API + REST `codeSyntax`)
- [ ] Verifying variables wrote correctly
- [ ] Optional: write `tokens.css` (your choice — Step 12.5, then Step 13 if yes)
- [ ] Summarizing results (counts & file links)
- [ ] Publishing Doc/\* text styles + Effect/shadow-\* (Step 15c § 0 — run **before** 15a/15b on first runs; see §0.4 above)
- [ ] Drawing ↳ Primitives style guide (Step 15a)
- [ ] Drawing ↳ Theme style guide (Step 15b)
- [ ] Drawing ↳ Layout + ↳ Text Styles + ↳ Effects (rest of Step 15c)
- [ ] Filling Token Overview from live variables (Step 17)
- [ ] Updating Thumbnail cover (brand gradient) (Step 18)
- [ ] Offering next step (`/create-component`)

**Maps to skill steps:** rows 1–5 → Steps 5–9 · row 6 → Step 10 · rows 7–8 → Steps 11–12 · row 9 → Step 12.5 + Step 13 (`tokens.css`, skip row 9 body if declined) · row 10 → Step 14 · row 11 → Step 15c § 0 (pre-pass on first runs) · rows 12–14 → Steps 15a–15c bodies · rows 15–16 → Steps 17–18 · row 17 → Step 19.

**Docs-only path** (variables already present — see "After Step 4" below): start the checklist at **row 11** (publish Doc/\* + Effect styles) and continue through row 17. Rows 1–10 are marked `[x] (skipped — variables present)` up front.

---

## Phase execution (required)

Work through the phases **in order**, except when **After Step 4 — variables present vs missing** (subsection below) says to **skip 02–04** and go straight to **06 → 07 → 08** (documentation draw/update). For each phase you execute, **`Read` the linked phase file in full** — phase files are authoritative; this orchestrator only routes. Apply **Conventions load map** for that phase **before** `use_figma` canvas work; use **Heavy read liveness** before large `Read` calls.

| Phase | Scope | Read path |
|------|--------|-----------|
| 01 | Steps 1–4 — file key, tokens, wizard, read registry | [`phases/01-steps1-4.md`](./phases/01-steps1-4.md) |
| 02 | Steps 5–9 — generate Primitives, Theme, Typography (+7b), Layout, Effects | [`phases/02-steps5-9.md`](./phases/02-steps5-9.md) |
| 03 | Step 10 — plan approval | [`phases/03-step10.md`](./phases/03-step10.md) |
| 04 | Step 11 — push (Plugin API + REST `codeSyntax`) | [`phases/04-step11-push.md`](./phases/04-step11-push.md) |
| 05 | Steps 12–14 — verify, optional CSS, confirm | [`phases/05-steps12-through14.md`](./phases/05-steps12-through14.md) |
| 06 | Canvas documentation visual spec (§A–H) | [`phases/06-canvas-documentation-spec.md`](./phases/06-canvas-documentation-spec.md) |
| 07 | Steps 15a–15c — style-guide pages | [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) |
| 08 | Steps 17–19 + appendix | [`phases/08-steps17-appendix.md`](./phases/08-steps17-appendix.md) |

**First-run ordering (important):** On the first invocation of a session, execute phase 07's **Step 15c § 0** (publish `Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`, and `Effect/shadow-{sm,md,lg,xl,2xl}`) **before** 15a/15b so the first pass can bind `textStyleId` / `effectStyleId` directly instead of emitting fallback `fontName`/`fontSize` literals that a second pass would need to upgrade. See **§0.4** above.

### After Step 4 — variables present vs missing

**Step 4** (phase 01) reads the file’s variable registry. Use it **before** phase 02 to decide whether to **generate and push tokens** or **draw/update documentation only**.

| Situation | What to run |
|-----------|-------------|
| **No or insufficient variables** — e.g. missing **`Primitives`** or **`Theme`**, collections empty, or nothing local to bind the style guide to | Continue in order: **02 → 03 → 04 → 05**, then **06 → 07 → 08** (full pipeline). |
| **Variables already in the file** — the registry shows the expected collections (at minimum **`Primitives`** and **`Theme`**) populated with variables suitable for bindings, and the designer has **not** asked to regenerate or replace tokens | **Skip 02–04** (no new generation, no Step 10 plan for a fresh build). **Read 06**, then run **07** and **08** to **draw or refresh** style-guide canvas work (Steps 15a–c, 17–19). Optionally run **05** Step 12 (verify) after canvas if useful. |
| Designer **explicitly** wants new ramps, Theme changes, or a full token rebuild | Run **02 → 03 → 04** even when variables already exist. |

If the snapshot is **ambiguous** (partial collections, legacy naming), call **AskUserQuestion** once: **regenerate tokens** vs **documentation-only refresh** — then follow the matching row above.

**Also load when applying Theme `codeSyntax`:** [`phases/02b-theme-codesyntax.md`](./phases/02b-theme-codesyntax.md) (supplements Step 6 tables in phase 02).

**Canvas (Steps 15a–17):** **agent-driven only** — the agent composes plain Figma Plugin API JavaScript **only** as the **`code` string** on each **`use_figma` MCP** invocation (load the **`figma-use`** skill first whenever the Figma / `use_figma` tool docs require it). Follow [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md), [`phases/06-canvas-documentation-spec.md`](./phases/06-canvas-documentation-spec.md) § A–H, and the **phase 07** convention shard list in **Conventions load map**. If you hit the ~50k `code` limit, run **multiple sequential `use_figma` calls** (e.g. one logical page or table batch per call), each with a **fresh self-contained** script — **not** by writing partial scripts to disk.

**Do not** use the repo or this skill folder as a clipboard for Figma work: no canvas helper `.js`, no `.mcp-*` / `_mcp-*` files, no `*-once.js`, no `*-payload.json`, no `_tmp*`, and no folders **under this skill** used only to stage plugin code for MCP or to JSON-escape payloads. Those are throwaways — delete them immediately if created by mistake; the deliverable is the **Figma file state**, not staged source files.

**Foundations page list (shared with `/new-project`):** [`../shared/pages.json`](../shared/pages.json).
