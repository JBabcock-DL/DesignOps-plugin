# `/create-design-system` follow-up work (Phases 2 + 3)

> Companion doc to `C:\Users\jbabc\.claude\plans\create-a-detailed-plan-ethereal-mochi.md`.
> Phase 1 (5 sequential PUTs + per-collection checklist + Step 10 summary card) is already implemented in [skills/create-design-system/SKILL.md](../skills/create-design-system/SKILL.md). This doc captures the two deferred phases so the context isn't lost.

---

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Split Step 11 into 5 sequential PUTs, add live checklist, Step 10 summary card | ✅ Done |
| 2 | Plugin-API + REST split (biggest REST payload reduction) | ⏸ Deferred — do after Phase 1 is tested |
| 3 | Structural refactor of the 2,765-line SKILL.md + duplicated helpers | ⏸ Deferred — do after Phase 2 |

Recommended sequencing: **test Phase 1 → land Phase 2 → land Phase 3 as a single refactor**. Splitting Phase 3 into smaller passes just churns the same files.

---

## Phase 2 — Plugin-API + REST split

### Why

Step 11 currently uses REST exclusively because the Figma Plugin API exposes `codeSyntax` as read-only ([skills/create-design-system/SKILL.md:1227](../skills/create-design-system/SKILL.md#L1227) area — the `Do NOT use use_figma` note). But collection/variable/mode-value **creation** works fine via the Plugin API:

- `figma.variables.createVariableCollection(name)`
- `figma.variables.createVariable(name, collection, resolvedType)`
- `variable.setValueForMode(modeId, value)` (aliases and primitives both)
- `collection.addMode(name)`

The Plugin API is faster (no HTTP round-trip), gives richer error messages, and avoids JSON payload bloat. The REST endpoint is **only** needed for `codeSyntax`.

### New per-collection sequence (replaces the REST-only flow in Phase 1)

For each of the 5 collections in dependency order:

1. **`use_figma`** — create the collection, modes, variables, and mode values via Plugin API. Capture the resulting `variable.id` (real `VariableId:...` strings) into a `primMap` / `themeMap` / etc. as the script runs.
2. **Return** the `{ name → id }` map from the `use_figma` script (set `figma.ui.postMessage` or the script's return value).
3. **REST `PUT /v1/files/{TARGET_FILE_KEY}/variables`** — only `variables` entries with `action: "UPDATE"` and the `id` + `codeSyntax` fields. No `variableCollections`, no `variableModes`, no `variableModeValues`.

### Expected payload-size reduction

- REST payload drops `variableModeValues` (the single largest array — 11 stops × 5 ramps = 55 entries for Primitives alone, 54 × 2 modes = 108 for Theme, 15 slot-properties × 8 modes = 120 for Typography, etc.).
- REST payload drops `variableModes` and `variableCollections`.
- Per-collection REST call becomes ~60–70% smaller.
- Plugin API path emits native progress (can log `Created: color/primary/500` etc. as it goes) — the checklist stays but each collection can show finer-grained progress inside.

### Gotchas

- **Plugin API `setValueForMode` for aliases:** the value is `{ type: 'VARIABLE_ALIAS', id: otherVariable.id }` using the **real** `id` returned by `createVariable`, never a string name.
- **Collection mode 0** already exists after `createVariableCollection` and is named `"Mode 1"`. Rename via `collection.renameMode(collection.modes[0].modeId, "Light")` before adding `Dark`, etc. Typography needs 8 modes → rename the default plus `addMode` seven more.
- **String variables** (`typeface/display`, `typeface/body`) — `resolvedType: 'STRING'`, value is just the string. Confirmed working in current code paths.
- **REST update-only payload:** `action: "UPDATE"` on each variable entry, and the entry must carry the real `id` string from step 1 of this PUT — not a `TEMP_VAR_*`. No `variableCollectionId`, no `resolvedType` needed on an UPDATE.
- **Failure modes are different:** Plugin API throws per-call; REST returns a partial-errors array. Retry semantics differ — the current Phase 1 retry block only handles the REST shape. Need a parallel Plugin-API retry block.

### Files to modify

- [skills/create-design-system/SKILL.md:1065+](../skills/create-design-system/SKILL.md#L1065) — rewrite Step 11 execution block from "assemble REST payload" to "use_figma + REST UPDATE for codeSyntax".
- Error handling sections (§Error — partial write failure within a PUT, §Error — whole-PUT failure) — add Plugin-API error path alongside the REST path.

### Verification (adds to Phase 1 verification)

- Time the push on a fresh Foundations file. Phase 2 should be **noticeably faster** than Phase 1 (which is already faster than the pre-split baseline).
- Confirm REST payload size per collection is <1/3 of Phase 1 payload (spot-check via whatever logging the MCP connector exposes).
- All codeSyntax spot-checks from Step 12 still pass.

---

## Phase 3 — Structural refactor

### 3a. Split [skills/create-design-system/SKILL.md](../skills/create-design-system/SKILL.md) (2,765 lines) into phase files

Match the pattern from [skills/new-project/phases/](../skills/new-project/phases/). Proposed layout:

```
skills/create-design-system/
  SKILL.md                              (orchestrator — ~250 lines)
  CONVENTIONS.md                        (unchanged)
  helpers/
    canvas.js                           (3b below)
  phases/
    01-intake.md
    02-existing-file-check.md
    02_5-theme-source.md
    03-fonts.md
    04-collections.md
    05-primitives.md
    06-theme.md
    07-typography.md
    08-layout.md
    09-effects.md
    10-approval.md
    11a-push-primitives.md
    11b-push-theme.md
    11c-push-typography.md
    11d-push-layout.md
    11e-push-effects.md
    12-verify.md
    12_5-tokens-css.md
    13-token-css.md
    14-token-overview-page.md
    15a-style-guide-primitives.md
    15b-style-guide-theme.md
    15c-style-guide-typography.md
    15d-style-guide-layout.md
    15e-style-guide-effects.md
    16-effect-styles.md
    17-brand-assets.md
    18-cover.md
    19-handoff.md
```

Only the phase currently running is loaded into context per turn — matches the `/new-project` model exactly. Expected context-per-turn reduction: ~70–85% (orchestrator + one phase file instead of the full SKILL.md).

SKILL.md becomes an orchestrator with: intake, phase sequencing rules, error-handling cross-reference, progress-checklist template, and a table of phase-file paths (like [skills/new-project/SKILL.md:111-126](../skills/new-project/SKILL.md#L111-L126)).

### 3b. Centralize per-page canvas helpers

Steps 13–17 in the current SKILL.md (style-guide drawing) re-declare the same helpers inside every `use_figma` block:

- `bindThemeColor(node, themeVarName)`
- `bindPrimColor(node, primVarName)`
- `bindThemeStroke(node, themeVarName)`
- `applyDocStyle(textNode, typographyMode, styleName)`
- `tryApplyEffectStyle(node, effectStyleName)`

Cuts ~800 lines of duplicated JS. Extract into `skills/create-design-system/helpers/canvas.js` as a single `const HELPERS = \`...\`;` string, then prepend `HELPERS + "\n"` to each phase's `use_figma` script at invocation time. Phase files reference `// loads helpers/canvas.js` as a one-line comment instead of pasting the code.

Alternative: emit the helpers block inline but define it once in the orchestrator as a template variable, so phase files say `{{HELPERS}}` and the orchestrator substitutes before calling `use_figma`.

### 3c. Derive codeSyntax instead of hand-listing

The Step 6 Theme table ([skills/create-design-system/SKILL.md:883-944](../skills/create-design-system/SKILL.md#L883-L944)) is ~150 cells listing WEB/ANDROID/iOS values. Most follow a rule:

- **WEB:** `var(--{kebab(path)})`  (with a small handful of overrides — e.g. `var(--color-danger)` for the `color/error/*` row)
- **ANDROID:** M3 `ColorScheme` role (from a 30-row lookup, not 150)
- **iOS:** `.{PascalSegment}.{camelLeaf}` derived from the path, with overrides for the `.Status.*`, `.Foreground.*`, `.Palette.*` namespaces that don't match the Figma path 1:1.

Replace the 150-cell table with:

1. 30-row **ANDROID M3-role map** (one entry per Theme variable — the only thing that truly can't be derived).
2. Three derivation rules for WEB and iOS, with an override map for the documented exceptions.
3. A short examples block showing the derivation on 3 rows.

Net: ~100 lines → ~40 lines, and the rules are mechanically verifiable.

### 3d. Single page-list source of truth

The hardcoded page list currently lives in [skills/new-project/phases/05-scaffold-pages.md](../skills/new-project/phases/05-scaffold-pages.md) and is re-referenced in create-design-system Steps 13–17 (by page name). Risk: if the list drifts between skills, `/create-design-system` will try to draw on a page that doesn't exist (or miss a new page).

Extract to `skills/shared/pages.json`:

```json
{
  "pages": [
    { "name": "Thumbnail", "emoji": "" },
    { "name": "📝 Table of Contents", "emoji": "📝" },
    { "name": "Token Overview", "emoji": "" },
    { "name": "Primitives", "section": "Style Guide" },
    ...
  ]
}
```

Both `/new-project` and `/create-design-system` read from it. Update [skills/new-project/phases/05-scaffold-pages.md](../skills/new-project/phases/05-scaffold-pages.md) and the relevant create-design-system phase files to reference the JSON.

### Files affected by Phase 3

- [skills/create-design-system/SKILL.md](../skills/create-design-system/SKILL.md) — split into orchestrator + ~25 phase files.
- [skills/create-design-system/phases/](../skills/create-design-system/phases/) — new directory with ~25 files.
- [skills/create-design-system/helpers/canvas.js](../skills/create-design-system/helpers/canvas.js) — new file.
- [skills/new-project/phases/05-scaffold-pages.md](../skills/new-project/phases/05-scaffold-pages.md) — read page list from shared JSON.
- `skills/shared/pages.json` — new file.

---

## Order of operations (when we pick this back up)

1. Test Phase 1 end-to-end against a fresh `/new-project`-generated Foundations file. Confirm:
   - Summary card appears; `yes` skips the full table.
   - 5-item checklist ticks one per PUT.
   - Each PUT pre-announced with a 1-line message.
   - Final codeSyntax Step 12 checks still pass.
2. If Phase 1 is clean, start Phase 2: rewrite the Step 11 execution block to `use_figma` + REST-UPDATE-for-codeSyntax.
3. Once Phase 2 lands and is tested, start Phase 3 as a single PR: split SKILL.md, extract helpers, derive codeSyntax, extract page list.

---

## Out of scope

Unchanged from the original plan:

- `/new-project` changes — the 05b header rewrite is already in.
- `sync-design-system` — different push path; not in this audit.
- `tokens.css` export (Step 12.5) — stays as-is.
- 5-collection architecture, codeSyntax 3-key format — per [memory](../../../../.claude/projects/c--Users-jbabc-Documents-GitHub-DesignOps-plugin/memory/project_design_system_architecture.md).
