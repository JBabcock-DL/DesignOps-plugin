# Sync — Steps 7–10 (validate + execute Axes B and C)

> **When to read:** After Step 6 for `full` / `code-to-figma`.
>
> **Next:** [`11-report-and-R-mode.md`](./11-report-and-R-mode.md).

---

## Step 7 — Validate Axis B (pre-execution)

**Trigger.** Runs iff Axis B was enabled at preflight AND `plan.B.direction !== 'S'`. When `direction === 'S'`, no validation and no prompt — skipped axes do not receive cascade scrutiny.

When the validation runs but no upstream writes occurred in Step 6, classification is 100% UNCHANGED and the pass completes silently (no pause, no prompt). When upstream writes did occur, classification may produce RESOLVED / ALTERED / NEW items; the pause fires only if ALTERED or NEW items are present.

### 7.1 — Re-compute Axis B diff

Re-run Step 3B against the current state of the world:

- `tokens.css` may have changed from 6.F (Figma-wins) writes. Re-run `resolve-classes.mjs` for each component.
- Figma variables may have changed from 6.C / 6.R writes. Re-run Step 2B's `get_metadata` calls for the affected pages (scoped to components that could bind to any pushed token — in practice, re-read every component page that was originally scanned, since cross-bindings are cheap to re-check).

### 7.2 — Classify each item in `plan.B.items` against the fresh diff

| Classification | Condition | Action |
|---|---|---|
| **UNCHANGED** | same stable key present in both plans, same code/Figma values | execute as planned, no prompt |
| **RESOLVED** | key was in original plan, **absent** from fresh diff | drop silently, append to `plan.upstreamResolvedDropped` with a note: `"A→B: {stable-key} resolved by Axis A"` |
| **ALTERED** | same stable key, values changed (e.g. Figma value now differs from what the user saw) | add to **pause batch** |
| **NEW** | stable key absent from original plan, present in fresh diff | add to **pause batch** |

### 7.3 — Validation pause (fires only if pause batch is non-empty)

One **AskUserQuestion** tool call titled **"Axis B — upstream changes introduced new or altered drift"**. List only the pause-batch items with their diff bucket, code value, and Figma value. Offer three options:

| Reply | Meaning |
|---|---|
| **Same as B** (default) | Take the axis-level direction from `plan.B.direction` and apply it to every pause-batch item |
| **Per item** | Inline F / C / S decision per item |
| **Stop B** | Abandon Axis B (keep UNCHANGED items planned but do not execute anything in B), continue to Axis C |

If the user picks **Per item**, loop through the pause batch with per-item `AskUserQuestion` (same format as Step 5 R-mode loop).

Increment `plan.validationPausesTriggered`. Merge answers into `plan.B.items` with an `addedByValidation: true` flag for reporting.

### 7.4 — No pause batch → proceed silently

If RESOLVED items were dropped but nothing was ALTERED or NEW, log (not prompt):

> `Axis B: {n} items resolved by upstream Axis A writes; no re-prompt needed.`

---

## Step 8 — Execute Axis B

### 8.F — Axis B, direction F (Figma wins → PR)

**Emit a drift-report PR. Do NOT auto-regenerate TSX.**

1. **Render drift markdown.** Use the template at [`../drift-report-template.md`](../drift-report-template.md). One section per drifted component, with:
   - cva variants expected vs. Figma variants present
   - Default variant diff
   - Prop diff (element component properties, code-only props, figma-only props)
   - Token-binding drift (code resolver output vs. Figma binding paths)
   - Bucket: `code-only` / `figma-only` / `variant-axis` / `default` / `prop` / `binding` / `composition`

2. **Write the file.**
   - Preferred path: `.changeset/design-drift-{YYYYMMDD-HHmm}.md` if a `.changeset/` directory exists at the repo root.
   - Fallback: `docs/design-drift/design-drift-{YYYYMMDD-HHmm}.md`, creating the directory if needed.

3. **Open a PR.**
   ```bash
   git checkout -b sync/design-drift-{YYYYMMDD-HHmm}
   git add <drift-file>
   git commit -m "chore(sync): design drift report $(date +%Y-%m-%d)"
   git push -u origin HEAD
   gh pr create --title "Design drift — {YYYY-MM-DD HH:mm}" --body "$(cat <<'EOF'
## Summary
Figma is source of truth for components this run. This report lists every drift the reconciler surfaced so code can be updated manually.

## Drift report
See `<drift-file>` in this PR.

## Recommended actions
- For `code-only` components with no matching ComponentSet, run `/create-component <name>` to draw them.
- For `figma-only` components, scaffold the source in `components/ui/<name>.tsx` using shadcn conventions, then run `/code-connect` to wire the mapping.
- For prop / variant / binding drift, edit the component source or its cva config to match the Figma side.
EOF
)"
   ```

   Record the PR URL.

4. **Do NOT run any Figma writes.** Axis B F-wins is code-side-only.

### 8.C — Axis B, direction C (Code wins → scoped redraw)

Delegate to `/create-component` with the new `--components` argument:

```
/create-component --components=<comma-separated-list-of-drifted-components>
```

Scope:
- Step 4.5 extraction runs only for the named subset.
- Step 6 draw runs only for the named subset (redraws the targeted ComponentSets in place on their `↳ {Page}` pages).
- Other Figma pages are untouched.

**Transport:** Step 6 follows [`create-component/EXECUTOR.md`](../../create-component/EXECUTOR.md) — **six** `Task`s → **`create-component-figma-slice-runner`** (parent `handoffJson` per [§13](../../create-component/conventions/13-component-draw-orchestrator.md)). Parent passes **`configBlock`** + **`layout`** (not JSON-only CONFIG); inline or preassembled `use_figma` is the **fallback** (including failed or interrupted `Task`s — reuse the same `configBlock`).

Log redrawn components + variant counts.

For **composition drift** items (`B.*.composition.*`), prefer scoping `/create-component --components=<composite>` after every referenced child atom is healthy in the registry; use `--migrate-to-instances` only when the composite page is still on the **flat** specimen layout and the designer explicitly chose migration over a full redraw.

### 8.R — Axis B, direction R

Apply `plan.B.items` resolutions:
- F-resolved items → roll into the drift-report PR (8.F mechanism, scoped to those items).
- C-resolved items → invoke `/create-component --components=<list>` scoped to their components.
- S-resolved items → skip and log.

If the resolutions are mixed (some F, some C) and both are non-empty, run the PR writer first (code side) and then the redraw (Figma side) — the drift-report PR only documents F-resolved items, so there is no conflict with the redraw.

### 8.S — Axis B, direction S

No writes. Log: `Axis B: skipped by user.`

---

## Step 9 — Validate Axis C (pre-execution)

**Trigger.** Same shape as Step 7: runs iff Axis C was enabled at preflight AND `plan.C.direction !== 'S'`. Same classification machinery against **post-B** state instead of post-A state.

### 9.1 — Re-compute Axis C diff

Re-run Step 3C. Triggers likely to appear:

- **Axis B C-wins added a new element component property** → an existing `.figma.tsx` no longer lists all Figma properties → `stale` entry appears → **ALTERED** if the stable key was already in the plan, **NEW** if not.
- **Axis B C-wins removed a variant** → an existing `.figma.tsx` references a deleted variant → **ALTERED** or **NEW** depending on original plan.
- **Axis B C-wins redrew a ComponentSet with a new ID** (normally IDs are stable; this is rare) → mapping becomes `stale` by ID.
- **Axis B F-wins path** → no Figma changes → usually all items remain **UNCHANGED**.

### 9.2 — Classify each item in `plan.C.items` against the fresh diff

Same four-bucket classification as 7.2: UNCHANGED / RESOLVED / ALTERED / NEW.

### 9.3 — Validation pause (fires only if pause batch non-empty)

One **AskUserQuestion** titled **"Axis C — upstream changes introduced new or altered drift"**. Same three options: **Same as C** (default), **Per item**, **Stop C**. Increment `plan.validationPausesTriggered`.

### 9.4 — No pause batch → proceed silently (log dropped items)

---

## Step 10 — Execute Axis C

### 10.F — Axis C, direction F (Figma wins → sync local)

For each item in `plan.C.items`:
- **missing** → no local file exists; a Figma mapping does → generate a new `.figma.tsx` from the published state (component symbol import, URL, props). Write to disk.
- **stale** → local `.figma.tsx` references something that no longer exists → regenerate that file from published state.
- **orphaned** → local `.figma.tsx` has no matching source file → **delete** the `.figma.tsx` (the source it referenced is gone).
- **unpublished** → local is newer than published; F wins means **discard local changes** → regenerate from published.

Present the set of file writes / deletes before executing via **AskUserQuestion**:

> "Axis C F-wins will write/delete N files under `**/*.figma.tsx`. Reply **yes** to apply, or **no** to abandon Axis C writes."

On `yes`, execute. On `no`, log `Axis C: F-wins abandoned at confirm.` and continue.

Report: `Axis C: refreshed N mappings locally; deleted M orphans.`

### 10.C — Axis C, direction C (Code wins → publish)

Delegate to the `/code-connect` skill. Pass the drifted components as the working set:

> Invoke `/code-connect` with the scoped set derived from `plan.C.items`. The skill runs its existing publish flow (Steps 6–8 of `/code-connect` — generate mapping entries, present for review, `send_code_connect_mappings`).

If `/code-connect` requires interactive confirmation (library-publish gate at its Step 2, per-mapping review at its Step 7), those interactions remain — they are inside `/code-connect`, not re-implemented here.

Record published counts.

### 10.R — Axis C, direction R

Apply `plan.C.items` resolutions. F-resolved items → file writes/deletes (10.F mechanism). C-resolved items → `/code-connect` publish scoped to those items. S-resolved → skip.

### 10.S — Axis C, direction S

No writes. Log.
