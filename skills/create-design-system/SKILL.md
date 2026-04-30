---
name: create-design-system
description: Push brand tokens into five Figma variable collections — Primitives (including `typeface/display` + `typeface/body` STRING primitives), Theme (Light/Dark modes), Typography (M3 baseline — 15 slots × 4 properties × 8 Android-curve scale modes; font-family aliases typeface primitives), Layout, and Effects. Platform mapping (Web/Android/iOS) is encoded as codeSyntax on every variable instead of separate alias collections. Local tokens.css is optional (explicit opt-in after variables are pushed) and, when written, is paired with a Tailwind theme map (v4 `@theme inline` or v3 `theme.extend`) so shadcn semantic classes (`bg-primary`, `text-primary-foreground`, …) resolve to the design tokens out of the box.
argument-hint: "Optional: --theme brand|baseline (default brand). Optional: --file-key <key-or-figma-design-url> (e.g. when chaining from /new-project). Baseline uses Material 3 static baseline seed hues for Primitives ramps; Brand uses wizard or pasted hexes."
agent: general-purpose
---

# Skill — `/create-design-system`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, build five variable collections with proper Light/Dark and typography scale modes, and push the result to the target Figma file.

**Repo-wide agent policy (MCP):** Inline payloads in each tool call — no `.mcp-*` / scratch staging files in the repo. **Committed** [`canvas-templates/bundles/*.mcp.js`](./canvas-templates/bundles/) payloads are allowed (see [`AGENTS.md`](../../AGENTS.md)). See [`canvas-templates/bundles/README.md`](./canvas-templates/bundles/README.md) for regen and size notes.

**Authoritative table/canvas rules** live in [`conventions/`](./conventions/) **shards** (edit-time reference) and in the **canvas templates** under [`canvas-templates/`](./canvas-templates/) (runtime: the §0 rules are baked into helper functions there). Index and §→file map: [`CONVENTIONS.md`](./CONVENTIONS.md). **Do not** `Read` every shard at session start; follow the **Conventions load map** below for your current phase only.

**Source root (Claude Code desktop + local plugin):** When the designer uses **Claude Code with this skill from the installed DesignOps plugin** (not necessarily an open git checkout of this repo), resolve paths from **this skill’s directory** inside the plugin tree — the same paths as in this repository: [`canvas-templates/`](./canvas-templates/), [`bundles/`](./canvas-templates/bundles/), [`data/`](./data/), [`phases/`](./phases/). Do **not** assume the current workspace root is the skill root.

**Source root (Cursor):** If the open workspace is **not** this plugin tree, **`Read`** bundle paths from whichever workspace folder contains **`skills/create-design-system/canvas-templates/bundles/`** (add that folder via **File → Add Folder to Workspace…** — usually the same directory as `${CLAUDE_PLUGIN_ROOT}` under `~/.claude/plugins/cache/`). See [`.cursor/rules/cursor-designops-skill-root.mdc`](../../.cursor/rules/cursor-designops-skill-root.mdc) and [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) § *Source root — Cursor*.

**MCP canvas runs (Steps 15a–15c + Step 17 Token Overview):** **Prefer** `Task` → [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) (one per slug) so bundle text stays out of the parent thread. **If** subagent `call_mcp` / `use_figma` **fails** on transport (cannot emit full `code`), use the **parent** path in [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) — full-file `Read` of the committed `.min.mcp.js` + `use_figma` in the parent; do not repeat failing `Task`s. Default parent pattern when `Task` works:

```
Task(
  subagent_type: "generalPurpose",
  description: "Draw ↳ Primitives canvas (Step 15a)",
  prompt: "Load skill canvas-bundle-runner. Run step=15a-primitives, fileKey=<key>, description=\"Step 15a — Primitives canvas redraw\". Return the compact JSON summary only — no prose."
)
```

The subagent runs in an isolated context, performs exactly **one `Read`** of the matching bundle and **one `use_figma`** call with the contents verbatim, and returns a compact `{ ok, step, pageName, tableGroups, … }` summary (~200 chars). The parent logs the summary, then runs the **parent-thread gate** in [`conventions/14-audit.md`](./conventions/14-audit.md) § *After canvas-bundle-runner (parent thread)* (explicit PASS/FAIL + minimum lites), then the rest of §14 as needed, and advances. Rationale and token-cost math: [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) § *Canvas runner subagent*. Full contract + prohibitions: [`../canvas-bundle-runner/SKILL.md`](../canvas-bundle-runner/SKILL.md). Bundle map, step → slug, and call count: [`conventions/17-table-redraw-runbook.md`](./conventions/17-table-redraw-runbook.md). 15c is always **three sequential subagent invocations** (Layout → Text Styles → Effects).

**After style-guide tables (15a–15c, 17) — `/create-component` in stages:** If the same session will also install shadcn components and draw them in Figma, do **not** pack table redraws and multiple component draws into a single parent turn. Complete **Phase A** (Steps 15a–c + 17) first; then run **Phase B** as [`/create-component`](../create-component/SKILL.md) **one component at a time** (see [`AGENTS.md`](../../AGENTS.md) § *Session runbook*). **Step 6** = **five** `use_figma` calls in fixed order — **prefer** the same **`Task` → [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md)** pattern as canvas (each call uses `assembledCodePath` after [`assemble-component-use-figma-code.mjs`](../../scripts/assemble-component-use-figma-code.mjs) + `check-payload`); **parent** `Read` → `call_mcp` on transport failure. See [`create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) §0.

Every bundle is self-contained (`_lib.js` + page template + runner fragment concatenated; top-level `await` + `return` — no IIFE required). Regen with [`scripts/bundle-canvas-mcp.mjs`](./scripts/bundle-canvas-mcp.mjs). See [`canvas-templates/bundles/README.md`](./canvas-templates/bundles/README.md). The runner subagent carries the authoritative per-step bundle path table; the parent refers to steps by slug (`15a-primitives`, `15b-theme`, `15c-layout`, `15c-text-styles`, `15c-effects`, `17-token-overview`).

**Debug / fallback only:** if a runner subagent returns `{ ok: false }` with a parse / row-resolution error you can't explain from the summary, **then** you may open [`canvas-templates/_lib.js`](./canvas-templates/_lib.js), the relevant page template in [`canvas-templates/`](./canvas-templates/), the matching runner fragment in [`canvas-templates/bundles/`](./canvas-templates/bundles/), and [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) to diagnose at source level. Fix the source, regenerate bundles (`node skills/create-design-system/scripts/bundle-canvas-mcp.mjs`), and re-delegate to the runner subagent. Inlining `_lib + template + JSON.stringify(ctx)` as `code` directly from the parent thread is a last-resort escape hatch, never the happy path. `ensureLocalVariableMapOnCtx` in `_lib.js` will hydrate `variableMap` in-plugin; never put it in an inline `ctx`.

**Phase files under [`phases/`](./phases/) orchestrate** — which step, which page, which slug, which row set, which AskUserQuestion to fire. They do **not** own geometry, columns, cells, or auto-layout rules. **When a phase file disagrees with the conventions shards or §0, the conventions win.**

---

## §0 — Known gotchas (rule index)

Full rules + code live in [`conventions/00-gotchas.md`](./conventions/00-gotchas.md). Cite by anchor; do not paraphrase.

- **§0.1** Rows & body cells: set height axis to **Hug** *before* `resize(w, 1)`; re-assert after `appendChild` into a STRETCH parent. `doc/table-group/*` is Hug + `clipsContent: false`. → [`00-gotchas.md#§01-hug-before-resize-on-rows-and-body-cells`](./conventions/00-gotchas.md)
- **§0.2** Every TEXT: `characters` → `resize(colWidth - 40, 1)` → `textAutoResize = 'HEIGHT'`. Never leave `'NONE'`.
- **§0.3** Theme hex TEXT is a **sibling** of `doc/theme-preview/{mode}`, not a child.
- **§0.4** `Doc/*` text styles + `Effect/shadow-*` must exist before 15a/15b bind. Under `/create-design-system` these publish at end of Step 11.
- **§0.5** Header cells are **HORIZONTAL + FIXED/FIXED** with explicit header height — never the §0.1 body recipe.
- **§0.6** Apply §0.2 to **all** table TEXT (header + body) *and* to TEXT children of `doc/table-group/*` (title, caption). Lowercase slug segments in layer names.
- **§0.7** Primitives swatch `RECTANGLE`s bind `fills[0]` to the row's `Primitives` COLOR variable via `setBoundVariableForPaint` — reassigning the return value.
- **§0.8** TOC `band-strip/*` TEXT: do **not** apply blanket §0.2 full-width resize. Keep `textAutoResize: 'WIDTH_AND_HEIGHT'` so the count chip hugs.
- **§0.9** `doc/table/token-overview/platform-mapping` and descendants carry **no** `effectStyleId` — one `shadow-sm` lives on the enclosing section shell only.
- **§0.10** **`resize()` resets sizing modes** — never set Hug on a `COMPONENT` / doc shell then `resize(w, 1)` without re-applying `primary`/`counter` after. **HORIZONTAL** `usage` rows need **counter `AUTO`**. Matrix specimen cells: **counter `AUTO`** + **`minHeight`**. → [`00-gotchas.md`](./conventions/00-gotchas.md) §0.10; `/create-component` [`03-auto-layout-invariants.md`](../create-component/conventions/03-auto-layout-invariants.md) §10.2.

Incident history (which Figma files failed and why) is in [`CHANGELOG.md`](./CHANGELOG.md) — not a runtime read.

---

## Conventions load map (lazy — required)

`Read` **only** the convention files for the phase you are executing. The §0 index above is enough for most reads; open [`conventions/00-gotchas.md`](./conventions/00-gotchas.md) only when you need the full rule + code for a specific anchor.

| Phase | When | Convention files to open |
|------|------|----------------------------|
| 01 | Steps 1–4 | **None** |
| 02 | Steps 5–9 | [`conventions/01-collections.md`](./conventions/01-collections.md), [`conventions/02-codesyntax.md`](./conventions/02-codesyntax.md) |
| 03 | Step 10 | **None** |
| 04 | Step 11 | **None** |
| 05 | Steps 12–14 | **None** |
| 06 | Canvas documentation spec | [`conventions/03-through-07-geometry-and-doc-styles.md`](./conventions/03-through-07-geometry-and-doc-styles.md), [`conventions/08-hierarchy-and-09-autolayout.md`](./conventions/08-hierarchy-and-09-autolayout.md) |
| 07 | Steps 15a–c / any `use_figma` on style-guide tables | [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) (required for agents) · [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) · [`canvas-templates/_lib.js`](./canvas-templates/_lib.js) + the page template. Open [`conventions/column-widths.json`](./conventions/column-widths.json) when verifying column math. For debugging bindings only: [`conventions/11-cells-12-bindings-13-build-order.md`](./conventions/11-cells-12-bindings-13-build-order.md), [`conventions/00-gotchas.md`](./conventions/00-gotchas.md). |
| 08 | Steps 17–19; canvas verification | [`conventions/17-table-redraw-runbook.md`](./conventions/17-table-redraw-runbook.md) for Step 17 MCP bundle path; [`conventions/14-audit.md`](./conventions/14-audit.md) when verifying or editing canvas; re-read **§0.9** above before Step 17 on **↳ Token Overview** |

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
- [ ] Optional: write `tokens.css` + Tailwind theme map (your choice — Step 12.5, then Steps 13a–13d if yes)
- [ ] Summarizing results (counts & file links)
- [ ] Publishing Doc/\* text styles + Effect/shadow-\* (at **Step 11 close** — see §0.4; if phases 02–04 were skipped, run the Step 11 close / 15c §0 idempotent block **before** canvas so 15a/15b bind on first pass)
- [ ] Drawing ↳ Primitives style guide (Step 15a)
- [ ] Drawing ↳ Theme style guide (Step 15b)
- [ ] Drawing ↳ Layout + ↳ Text Styles + ↳ Effects (rest of Step 15c)
- [ ] Filling Token Overview from live variables (Step 17)
- [ ] Updating Thumbnail cover (brand gradient) (Step 18)
- [ ] Offering next step (`/create-component`)

**Maps to skill steps:** rows 1–5 → Steps 5–9 · row 6 → Step 10 · rows 7–8 → Steps 11–12 · row 9 → Step 12.5 + Steps 13a–13d (`tokens.css` + Tailwind theme map, skip row 9 body if declined) · row 10 → Step 14 · row 11 → **Step 11 close** (Doc/\* + Effect styles; 15c §0 only when running that idempotent block because styles were missing) · rows 12–14 → Steps 15a–15c canvas bodies · rows 15–16 → Steps 17–18 · row 17 → Step 19.

**Docs-only path** (variables already present — see "After Step 4" below): mark rows 1–10 `[x] (skipped — variables present)`, run **Step 11 close** (row 11 — publish Doc/\* + Effect styles if not already in the file), then continue with rows 12–17.

---

## Phase execution (required)

Work through the phases **in order**, except when **After Step 4 — variables present vs missing** (subsection below) says to **skip 02–04** and go straight to **06 → 07 → 08** (documentation draw/update). For each phase you execute, **`Read` the linked phase file in full** — phase files are authoritative; this orchestrator only routes. Apply **Conventions load map** for that phase **before** `use_figma` canvas work.

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

**Doc/* ordering:** `Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`, and `Effect/shadow-{sm,md,lg,xl,2xl}` publish at the **close of Step 11** (see `phases/04-step11-push.md` § "Step 11 close"). When variables are already present and phases 02–04 are skipped, run the Step 11 close block first so 15a/15b can bind on their first pass. See **§0.4**.

### After Step 4 — variables present vs missing

**Step 4** (phase 01) reads the file’s variable registry. Use it **before** phase 02 to decide whether to **generate and push tokens** or **draw/update documentation only**.

| Situation | What to run |
|-----------|-------------|
| **No or insufficient variables** — e.g. missing **`Primitives`** or **`Theme`**, collections empty, or nothing local to bind the style guide to | Continue in order: **02 → 03 → 04 → 05**, then **06 → 07 → 08** (full pipeline). |
| **Variables already in the file** — the registry shows the expected collections (at minimum **`Primitives`** and **`Theme`**) populated with variables suitable for bindings, and the designer has **not** asked to regenerate or replace tokens | **Skip 02–04** (no new generation, no Step 10 plan for a fresh build). **Read 06**, then run **07** and **08** to **draw or refresh** style-guide canvas work (Steps 15a–c, 17–19). Optionally run **05** Step 12 (verify) after canvas if useful. |
| Designer **explicitly** wants new ramps, Theme changes, or a full token rebuild | Run **02 → 03 → 04** even when variables already exist. |

If the snapshot is **ambiguous** (partial collections, legacy naming, missing `codeSyntax` on some variables), fire **one** `AskUserQuestion` with three options and commit to the answer — do **not** re-probe variables after the user answers, and do **not** second-guess by asking again later:

- **Regenerate** — run phases 02 → 03 → 04 → 05, then 06 → 07 → 08 (full pipeline). Existing variables are overwritten per the plan shown at Step 10.
- **Docs-only** — skip 02–04. Run the Step 11 close block (Doc/* + Effect styles) if those aren't already in the file, then 06 → 07 → 08 against current variables.
- **Abort** — stop, print what's ambiguous, exit with no file writes.

Whichever the designer picks is load-bearing for the rest of the run.

**Also load when applying Theme `codeSyntax`:** [`phases/02b-theme-codesyntax.md`](./phases/02b-theme-codesyntax.md) (supplements Step 6 tables in phase 02).

**Canvas (Steps 15a–17):** **agent-driven, subagent-delegated** — **never** `Read` a `.min.mcp.js` bundle or call `use_figma` for a canvas bundle from this (parent) thread. For each page, emit a `Task(subagent_type: "generalPurpose")` that loads the [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) skill with `step=<slug>`, `fileKey`, `description`; collect the compact JSON summary; run [`conventions/14-audit.md`](./conventions/14-audit.md) § *After canvas-bundle-runner (parent thread)* (PASS/FAIL + minimum lites), then the rest of §14 as needed with only the summary (not the full bundle) in context; advance. 15c always fires **three sequential** subagent invocations (Layout → Text Styles → Effects). Follow [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) § *Canvas runner subagent*, [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md), [`phases/06-canvas-documentation-spec.md`](./phases/06-canvas-documentation-spec.md) § A–H, and the **phase 07** convention shard list in **Conventions load map**. The no-staging-files rule (`.mcp-*` / `*-payload.json`) still applies everywhere.

**Do not** use the repo or this skill folder as a clipboard for Figma work: no canvas helper `.js`, no `.mcp-*` / `_mcp-*` files, no `*-once.js`, no `*-payload.json`, no `_tmp*`, and no folders **under this skill** used only to stage plugin code for MCP or to JSON-escape payloads. Those are throwaways — delete them immediately if created by mistake; the deliverable is the **Figma file state**, not staged source files.

**Foundations page list (shared with `/new-project`):** [`../shared/pages.json`](../shared/pages.json).
