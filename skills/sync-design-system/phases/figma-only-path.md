# Sync — Figma-only short-circuit (`plan.scope === 'figma-only'`)

> **When to read:** Immediately after Step 0 when scope is **figma-only**. Do **not** run Step 1’s axis-detection table.
>
> **Token formats / errors:** [`../reference/token-formats.md`](../reference/token-formats.md), [`../reference/error-guidance.md`](../reference/error-guidance.md).

---

## Step 1.5 — Figma-only preflight (scope = `figma-only` only)

Skip Step 1's axis-detection table entirely — it's predicated on code-side sources the Figma-only flow never touches.

1. **Resolve Figma file key.** Check `$ARGUMENTS` first, then `plugin/templates/agent-handoff.md:active_file_key`, then call **AskUserQuestion**: "Paste the Figma file URL or file key for the design system file to refresh." Extract the key from a full URL if one is provided.
2. Log: `Scope: figma-only — Figma file <key> will be read; no code-side files will be opened.`

Then continue to **Step 2A.figma** below. The normal Steps 2A/2B/2C, 3, 4, 5, 7–10 are skipped in this scope.

---

### 2A.figma — Figma-only variable read (scope = `figma-only` only)

This is the **only** read that runs in the Figma-only short-circuit. It's a subset of full-path Step 2A (see [`02-read-axes.md`](./02-read-axes.md) for the multi-axis read).

1. **Read Figma variables.** Call `GET /v1/files/:key/variables/local` with the key resolved in Step 1.5. Build the same flat map `{ "collection/token/name": value }` across `Primitives`, `Theme`, `Typography`, `Layout`, `Effects`, with the same mode-aware flattening rules as full-path 2A step 4 (Theme light/dark, Typography 8 modes, Effects light/dark, Primitives + Layout 1 mode). Resolve aliases to **final primitive values** (see resolver below).
2. Tally per collection (e.g. `{ primitives: 124, theme: 72, typography: 60, layout: 18, effects: 14 }`) and **store the flat map on `plan.A.figmaVarsInMemory`**. This map is the authoritative Figma-side read for the rest of the session — Steps 6.figma (canvas chain), 11.5 (continuation), and any follow-on code-side write path **must** reuse it. **Do not** call `GET /v1/files/:key/variables/local` again. **Do not** script a separate alias resolver via `use_figma` to "fill in missing values" — that round-trip is what was dropping light/dark hexes on the floor.
3. Do **not** read `tokens.css`, `tokens.json`, or `tailwind.config.*`. Do **not** call the extractor. Do **not** probe `components.json` or `.figma.tsx`.

**Alias resolver (run once here, entirely in the parent thread against the REST response — no `use_figma` trip).** The REST response shape is:

```
{
  variables: { <variableId>: { name, valuesByMode, resolvedType, variableCollectionId, codeSyntax } },
  variableCollections: { <collectionId>: { name, modes: [{ modeId, name }], defaultModeId } }
}
```

Each `valuesByMode[modeId]` is either (a) a raw value — `{ r, g, b, a? }` for color, `number` for float, `string` for string, `boolean` — or (b) an alias `{ type: 'VARIABLE_ALIAS', id: '<targetVariableId>' }`. To resolve:

```
function resolve(varId, modeId, depth = 0) {
  if (depth > 10) return null;                          // cycle guard
  const v = variables[varId];
  if (!v) return null;
  const val = v.valuesByMode[modeId];
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    const target = variables[val.id];
    if (!target) return null;
    // Cross-collection alias: pick the target collection's matching-name mode
    // if one exists, otherwise its default mode. (Theme → Primitives: Primitives
    // is single-mode, always use that mode.)
    const targetColl = variableCollections[target.variableCollectionId];
    const sameName = targetColl.modes.find(m => m.name === modeName(modeId));
    const nextMode = sameName ? sameName.modeId : targetColl.defaultModeId;
    return resolve(val.id, nextMode, depth + 1);
  }
  return val;                                            // raw value, done
}
```

The flat-map entry for each mode/variable pair stores both the **resolved primitive value** (the raw `{r,g,b,a}` / number / string returned above, formatted as a hex string `#RRGGBB` or `#RRGGBBAA` for colors, `px` / unitless for floats) **and** the **first-hop alias path** (target variable's `name`, or `null` if the Theme variable holds a raw value). Both are needed downstream: the resolved value for `tokens.css` writes (Step 11.5b), the alias path for canvas L/D labels (now handled live by the canvas bundle since the 15b fix — skill doesn't pass this through anymore, but keep it on the map for reporting).

If the API call fails, report the error (see [`../reference/error-guidance.md`](../reference/error-guidance.md)) and stop.

---

## Figma-only short-circuit (Steps 4.figma / 5.figma / 6.figma / 11.figma)

When `plan.scope === 'figma-only'`, Steps 3 / 4 / 5 / 7 / 8 / 9 / 10 of the normal flow are **skipped**. The skill goes directly from Step 2A.figma to the short-circuit steps below, then to Step 11 and Step 11.5.

### 4.figma — Variable summary (no diff)

Print a compact, non-blocking summary derived from the Step 2A.figma read. There is no code-side to diff against, so this is informational only:

```
── Figma variable summary ─────────────────────────────────────────
File: <figma file key>
  Primitives:   124 variables
  Theme:         72 variables  (Light + Dark)
  Typography:    60 variables  (8 Android-curve scale modes)
  Layout:        18 variables
  Effects:       14 variables  (Light + Dark)
  Total:        288 variables
───────────────────────────────────────────────────────────────────
```

If any legacy collections (`Web`, `Android/M3`, `iOS/HIG` from pre-refactor runs) are still present, list them as a one-line deprecation note — the Figma-only scope does not rewrite legacy collections; it only refreshes doc pages that render from the current collections.

### 5.figma — Page picker (short-circuit decision)

Call **AskUserQuestion** **once**, with **`allow_multiple: true`**, listing all seven style-guide pages as options. Do **not** split this into a mode picker ("all/select/cancel") followed by a per-page selector — agents flatten that into a single-select UI and drop options. One question, one multi-select.

Prompt body:

> "Refresh the Figma style-guide docs to reflect the current variables. Select every page you want redrawn — you can pick any combination, or Skip to redraw nothing."

Options (all seven, in this order):

1. `↳ Primitives`
2. `↳ Theme`
3. `↳ Layout`
4. `↳ Text Styles`
5. `↳ Effects`
6. `↳ Token Overview`
7. `Thumbnail Cover`

All seven options **must** be present in the tool call even when you believe only a subset is affected — the user is the source of truth for scope, not the agent's inference.

**Result handling:**

- Any non-empty selection → record as the affected-page set; advance to Step 6.figma.
- Empty selection or user-skipped the question → record an empty set; skip Step 6.figma entirely and advance directly to Step 11 (zero redraw rows) and Step 11.5. Do **not** re-prompt.

If you want to hint at a recommended subset (e.g. "given the primitive / theme edits observed in 2A.figma, `↳ Primitives` and `↳ Theme` are the likely minimum"), put that in a one-line comment **above** the prompt body — never as a separate question. The picker itself stays flat.

### 6.figma — Canvas refresh only

Run the canvas chain (6.Canvas.9b / 9d / 9e) **scoped to the user's selection** from Step 5.figma. No Axis A token push happens — the Figma variables are already the source of truth; only the rendered docs are being refreshed.

- For each selected style-guide page (↳ Primitives / Theme / Layout / Text Styles / Effects), run 6.Canvas.9b's matching canvas-bundle-runner subagent Task (slug mapping table in [`06-axis-A-and-canvas.md`](./06-axis-A-and-canvas.md) §6.Canvas.9b). 15c pages fire as three sequential Tasks in Layout → Text Styles → Effects order when multiple are selected.
- If `↳ Token Overview` is in the selection, run 6.Canvas.9d.
- If `Thumbnail Cover` is in the selection, run 6.Canvas.9e.
- Everything else about the canvas chain ([`../../../AGENTS.md`](../../../AGENTS.md) inline-payload rule, subagent delegation, §0.9 platform-mapping flatness, codeSyntax hygiene) is unchanged — see AGENTS § *Canvas bundles — subagent delegation*.

**After each canvas-bundle-runner Task returns:** run the parent-thread gate in [`../../create-design-system/conventions/14-audit.md`](../../create-design-system/conventions/14-audit.md) § *After canvas-bundle-runner (parent thread)* before logging the page done.

Log one checklist row per executed page (same format as 6.Canvas's blocking checklist). Pages not selected are logged as `skipped (not selected)`.

### 11.figma — Report (Figma-only shape)

Skip the Axis A / B / C sub-blocks of Step 11. Emit:

```
Figma-only sync complete.

  Scope:                       figma-only
  Figma file:                  <file key>
  Variables read:              <n>
  Style-guide pages refreshed: <comma-separated or "—">
  Canvas checklist:            <per-page done/skipped lines>
```

Then run **Step 11.5** unconditionally (it runs even when no pages were refreshed — the user may still want to continue to code).

---

## Step 11.5 — Continuation prompt (Figma-only only)

This step runs **only** when `plan.scope === 'figma-only'`. For `full` and `code-to-figma` runs, skip it entirely.

Call **AskUserQuestion** once:

> "Figma-only sync finished. Do you want to continue with a code-side reconcile now?
> - **continue-figma-to-code** — **Fastest path.** Push the Figma variables already in memory (from 2A.figma) directly into the code-side token file (e.g. `tokens.css`). **No** second Figma fetch, **no** diff, **no** per-axis prompt — just overwrite the token file with the current Figma values and show the write summary. Pick this when you know Figma is right and you only want to update code.
> - **continue-full** — Re-enter the skill with `scope = full`. Reads `tokens.css` / `tokens.json` / components / Code Connect, diffs against the in-memory Figma state, and asks per-axis direction at Step 5. The Figma read is reused — no second REST call.
> - **continue-code-to-figma** — Re-enter the skill with `scope = code-to-figma`. Pushes code as source of truth back into Figma with a single confirmation per axis. The Figma read is reused for the diff.
> - **done** — Stop here. Re-run `/sync-design-system` later if you want a code reconcile."

Record the answer:

- **continue-figma-to-code** → keep `plan.scope = 'figma-only'` (this is a Figma-only variant, not a scope flip) and jump to **Step 11.5b** below. Do **not** re-enter Step 1.
- **continue-full** → set `plan.scope = 'full'` and jump to **Step 1** in [`00-scope-preflight.md`](./00-scope-preflight.md) (the normal preflight axis-detection table). `plan.A.figmaVarsInMemory` from 2A.figma is reused by Step 2A step 4 — do not re-fetch.
- **continue-code-to-figma** → set `plan.scope = 'code-to-figma'` and jump to **Step 1**. Same reuse rule.
- **done** → finish the skill. Print: `Figma-only sync closed without code reconcile.`

For **continue-full** / **continue-code-to-figma**, the recursive entry at Step 1 runs axis-detect, read (Step 2A/2B/2C — Axis A reuses `plan.A.figmaVarsInMemory`), diff (Step 3), present (Step 4), bundled decision (Step 5), and executes the rest of the flow normally with the chosen scope. Do **not** re-prompt Step 0; `plan.scope` is already pinned. When the second pass reaches Step 11, its report block supersedes the Figma-only summary printed earlier.

If the user picks a continuation path and the code-side preflight finds zero axes active (e.g. no `tokens.css` and no `components.json`), stop with a clear message and do not loop back to Step 11.5.

---

## Step 11.5b — Direct Figma → code write (continue-figma-to-code only)

This step runs **only** when the user picked `continue-figma-to-code` at Step 11.5. It is the fastest path from "figma-only sync finished" to "code stylesheet updated" — one token-file locate, one write, one report. No Figma round-trip. No diff. No per-axis prompt.

**Preconditions.** `plan.A.figmaVarsInMemory` must be populated from Step 2A.figma (it always is if you reached Step 11.5). If it isn't, this step is a bug — fail fast with `Step 11.5b: no in-memory Figma variables (plan.A.figmaVarsInMemory missing). Refusing to write.`

### 1. Locate the token source file

Same locator as full-path Step 2A step 1 ([`02-read-axes.md`](./02-read-axes.md)):

1. Read `plugin/.claude/settings.local.json` for `token_schema_path`.
2. If missing or file not found, call **AskUserQuestion**: "Paste the path to the token file you want me to write the Figma variables into (e.g. `src/tokens.json`, `tailwind.config.js`, or `src/styles/tokens.css`)."
3. Detect the format (CSS custom properties, JSON, Tailwind config) via [`../reference/token-formats.md`](../reference/token-formats.md). If the format can't be determined, ask: "I can't tell what format this file uses. Is it (1) CSS custom properties, (2) JSON, (3) Tailwind config, or (4) something else — I should stop?"

### 2. Render the new file content

Build the new token-file body **locally** from `plan.A.figmaVarsInMemory`. Do **not** call `use_figma`. Do **not** re-fetch variables.

- **CSS custom properties** (`tokens.css`): one `--token-name: value;` per resolved entry, grouped by collection as `/* === Primitives === */`, etc. Theme variables in multi-mode collections emit one selector per mode (`:root { --color-… }` for Light, `.dark { --color-… }` or `@media (prefers-color-scheme: dark) { :root { --color-… } }` for Dark — match the existing file's convention; if the file is empty / new, use `:root` + `.dark` class-based scoping).
- **JSON** (`tokens.json`): nested object following the existing file's shape, or flat `{ "collection/token/name": value }` if the existing file is flat.
- **Tailwind config** (`tailwind.config.js` / `.ts`): emit into the `theme.extend.colors` / `theme.extend.spacing` / etc. namespaces per existing conventions. If the file mixes code and data in a way the agent can't round-trip safely, **stop** and recommend `continue-full` instead.

Preserve any non-token content the existing file contained outside the collection regions (header comments, `@import`s, custom utilities). Only overwrite the variable section — never rewrite the whole file verbatim if other content is present.

### 3. Confirm before writing

Call **AskUserQuestion** once with a **single** sub-question:

> "Ready to write `N` tokens from Figma into `<token-file-path>`. Diff summary:
> - Unchanged: `U` tokens (already match Figma)
> - Updated: `M` tokens (values differ)
> - Added: `A` tokens (not in code yet)
> - Removed: `R` tokens (in code, not in Figma) — `keep` | `delete`
>
> Proceed?"

Options: `yes` | `yes + delete removed` | `preview full diff` | `cancel`.

- `preview full diff` → print a unified diff (code file → new file), then re-prompt with the same three remaining options.
- `cancel` → stop. Print `Step 11.5b: write cancelled. Figma state unchanged, code file unchanged.`

### 4. Write the file

On `yes` or `yes + delete removed`, write the rendered content to the token-file path atomically (write to a temp, rename, or use the host writer's atomic mode). If the repo is a git worktree, leave the write uncommitted — the user stages / commits / PRs it themselves per repo conventions.

### 5. Report

Print:

```
── Step 11.5b report ─────────────────────────────────────────────
scope:                 figma-only → continue-figma-to-code
file written:          <token-file-path>
updated:               M tokens
added:                 A tokens
removed:               R tokens (deleted: yes/no)
unchanged:             U tokens
figma re-fetches:      0   ← in-memory reuse only
canvas redraws:        0   ← code-side write only
elapsed:               <s>
```

Then finish the skill. Do **not** run the 6.Canvas chain (nothing changed in Figma).
