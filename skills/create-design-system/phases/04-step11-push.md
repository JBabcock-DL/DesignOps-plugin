# Step 11 — Push all collections to Figma (Plugin API + REST `codeSyntax`)

Execute this phase after Step 10 approval. Load the **figma-use** skill before **every** `use_figma` call (`skillNames: "figma-use"` when required by your connector).

## Overview

Push the five collections in **five sequential collection passes** (Primitives → Theme → Typography → Layout → Effects). **Each pass has two substeps:**

1. **`use_figma` (Figma Plugin API)** — Create the collection (or bind to an existing one from Step 4), create modes, create every variable with explicit `variable.scopes` (avoid default `ALL_SCOPES`; see figma-use `variable-patterns.md`), and call `setValueForMode` for **all** mode/value pairs. **Do not set `codeSyntax` in the Plugin API** for this workflow — it is applied in substep 2 via REST.
2. **REST `PUT`** `https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables` — Body contains **only** `variables`: an array of objects with real `VariableId` strings, `"action": "UPDATE"`, and `"codeSyntax": { "WEB", "ANDROID", "iOS" }`. **Do not** send `variableCollections`, `variableModes`, or `variableModeValues` in these calls — that keeps each REST payload small (Phase 2 vs Phase 1).

Between passes, keep the same **live checklist** UX as Phase 1 (below).

### Why two layers

- **Plugin API** creates structure and values locally (no giant JSON upload of `variableModeValues`).
- **REST** applies platform `codeSyntax` strings in a compact `UPDATE` batch (lookup strings from Steps 5–9 exactly as before).

### Why five passes, not one

- Perceived progress, failure isolation, simpler retries — same rationale as Phase 1.

### Dependency order (non-negotiable)

| # | Collection | Depends on | Modes |
|---|---|---|---|
| 1 | Primitives | — | 1 (`Default`) |
| 2 | Theme | Primitives (color aliases) | 2 (`Light`, `Dark`) |
| 3 | Typography | Primitives (`typeface/*`, `font/weight/medium`, body aliases, …) | 8 (`85` … `200`) |
| 4 | Layout | Primitives (`Space/*`, `Corner/*`) | 1 (`Default`) |
| 5 | Effects | Primitives (`elevation/*`) | 2 (`Light`, `Dark`) |

Do **not** parallelize collection passes.

### `primMap` (Primitive name → VariableId)

Build `primMap` from the **return value** of the Primitives `use_figma` script: for each created variable, `primMap[variable.name] = variable.id`. Later collection scripts **embed** `primMap` as a JSON literal (constructed by the agent) so alias values use `{ type: 'VARIABLE_ALIAS', id: PRIM['color/primary/500'] }` — **never** string names, never `TEMP_VAR_*` across scripts.

### Live checklist (post before first pass; repost after each pass)

```
Pushing variables (0 / 5)
Current: Primitives

- [ ] Primitives   (~{N} vars, 1 mode)
- [ ] Theme        (~{N} vars, 2 modes)
- [ ] Typography   (~{N} vars, 8 modes)
- [ ] Layout       (~{N} vars, 1 mode)
- [ ] Effects      (~{N} vars, 2 modes)
```

Resolve each `{N}` from Steps 5–9. After each **successful** pass (Plugin + REST), advance `[x]`, `Current:`, and the `0 / 5` counter. Do **not** paste full REST bodies into chat — optionally log **byte length** of the REST payload only: `REST codeSyntax payload (bytes): <number>` for Phase 2 verification.

### Pre-announce (one sentence before each pass)

- `Creating Primitives in file via Plugin API ({N} vars, 1 mode) — then REST codeSyntax patch — ~10–25s total.`
- `Creating Theme via Plugin API ({N} vars, 2 modes) — then REST codeSyntax patch — ~8–20s total.`
- `Creating Typography via Plugin API ({N} vars, 8 modes) — then REST codeSyntax patch — ~20–45s total.`
- `Creating Layout via Plugin API ({N} vars, 1 mode) — then REST codeSyntax patch — ~5–12s total.`
- `Creating Effects via Plugin API ({N} vars, 2 modes) — then REST codeSyntax patch — ~5–12s total.`

---

## Plugin API — mode setup per collection

| Collection | Mode setup |
|---|---|
| **Primitives** | `createVariableCollection('Primitives')` → rename default mode from `"Mode 1"` to **`Default`**. |
| **Theme** | Rename default mode to **`Light`**, then `collection.addMode('Dark')`. Capture both `modeId`s for `setValueForMode`. |
| **Typography** | Rename default mode to **`100`** (base slot values from Step 7). Add modes **`85`**, **`110`**, **`120`**, **`130`**, **`150`**, **`175`**, **`200`** (seven `addMode` calls). Ensure **eight** distinct mode names exist; assign ramp values per Step 7 / 7b. |
| **Layout** | Single mode **`Default`**. |
| **Effects** | Rename default to **`Light`**, `addMode('Dark')`. |

If Step 4 found **existing** collections (same names), **do not** recreate — resolve existing `VariableCollection` / mode ids from the Step 4 snapshot and create only missing variables.

---

## Plugin API — values and aliases

- **COLOR** values: `{ r, g, b, a }` with channels **0–1**.
- **FLOAT** / **STRING** / **BOOLEAN**: as in figma-use examples.
- **Alias to another variable:** `variable.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: '<VariableId>' })` where `id` is the **real** id from `createVariable` or from `primMap`.

Use the **same** value logic as the Phase 1 REST spec (Steps 5–9): ramps, Theme alias tables, Typography scaling, Layout alias table, Effects shadow table.

---

## REST — `codeSyntax` UPDATE only

After each Plugin pass, build the lookup table of `codeSyntax` for **every variable in that collection** from Steps 5–9 (same cells as Phase 1 — Theme: Step 6 tables + [`06-theme-codesyntax.md`](./06-theme-codesyntax.md) overrides).

**Payload shape (per pass):**

```json
{
  "variables": [
    {
      "id": "VariableId:…",
      "action": "UPDATE",
      "codeSyntax": {
        "WEB": "…",
        "ANDROID": "…",
        "iOS": "…"
      }
    }
  ]
}
```

**Key casing is exact:** `"WEB"`, `"ANDROID"`, `"iOS"` (never `ios` / `IOS`).

**No other top-level keys** in these Phase 2 REST calls.

If Step 4 indicates variables already exist and only need `codeSyntax`, you may issue **UPDATE-only** entries for those ids.

---

## Telemetry (Phase 2 verification)

- Log wall time per collection pass (optional one line).
- Log `REST codeSyntax payload (bytes):` using `JSON.stringify(payload).length`.

---

## Error — `use_figma` / Plugin API

`use_figma` failures are **atomic** (no partial application). Do **not** silently retry immediately — read the error, fix the script, then retry. If the same pass fails twice, call **AskUserQuestion**:

> "The Plugin API script for **{COLLECTION}** failed: `{message}`. Reply **retry** to run a corrected script, **abort** to stop the skill, or **skip** to continue without this collection (not recommended — {downstream})."

Use the same downstream dependency warnings as in § Error — REST below.

---

## Error — partial failure on REST `codeSyntax` UPDATE

If `200` includes a non-empty `errors` array, retry **only** the failed variable ids in a second `PUT` with the same shape.

If that fails, **AskUserQuestion** (skip / retry collection / abort) — same copy as Phase 1 partial REST handling, but say **codeSyntax REST patch** instead of full PUT.

---

## Error — whole REST failure (non-200 or network)

Stop before the next collection. **AskUserQuestion**: retry / abort / skip with downstream warnings:

- Skipping **Primitives** → abort (nothing else can alias).
- Skipping **Theme** → style-guide Theme tables lack bindings; components show raw ramps.
- Skipping **Typography** → text styles in Step 15c cannot bind.
- Skipping **Layout** → no `space/*` / `radius/*` aliases.
- Skipping **Effects** → shadow styles in Step 15c cannot bind.

---

## Step 12 handoff

When all five passes succeed (checklist complete), continue to **Step 12** in the main skill — verification logic is unchanged; confirm `codeSyntax` spot-checks against live file state.
