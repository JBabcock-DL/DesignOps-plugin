# Sync — Steps 4 & 5 (present + bundled decision)

> **When to read:** After Step 3 for `full` / `code-to-figma`.
>
> **Next:** [`06-axis-A-and-canvas.md`](./06-axis-A-and-canvas.md) (Step 6).

---

## Step 4 — Present all diffs

Print **one** markdown block with three sub-sections, in order. This happens before any `AskUserQuestion` call — the user sees the complete reconcile picture before deciding anything.

```
── Reconcile summary ──────────────────────────────────────────────

Axis A — Variables

  NEW (in code, not in Figma): 12 tokens
    color/brand/500        #1D4ED8
    color/brand/600        #1E40AF
    …

  MISSING (in Figma, not in code): 3 tokens
    color/deprecated/red   #EF4444
    …

  CONFLICTS (different values): 5 tokens
    Token                  Code         Figma
    color/primary          #2563EB      #1D4ED8
    …

  In sync: 247 tokens.

Axis B — Components

  VARIANT-AXIS MISMATCH: 1
    button.variant — code has [default, destructive, outline, secondary, ghost, link]; Figma has [default, destructive, outline, secondary, ghost]
  DEFAULT MISMATCH: 0
  PROP MISMATCH: 2
    badge.prop.Leading icon — missing in Figma
    card.prop.asChild — code-only
  TOKEN-BINDING DRIFT: 1
    button.binding.bg.base — code → color/primary/default, Figma → color/primary/subtle
  CODE-ONLY: 0
  FIGMA-ONLY: 1
    switch — no source file
  COMPOSITION DRIFT: 1
    pagination.composition.button.detached-instance — matrix cell uses detached shapes instead of Button instances
  Unresolvable (skipped): 0

  In sync: 12 components.

Axis C — Code Connect mappings

  MISSING: 1
    alert.mapping.missing — ComponentSet `Alert` has no .figma.tsx
  STALE: 0
  ORPHANED: 0
  UNPUBLISHED: 2
    button.mapping.unpublished, badge.mapping.unpublished

  In sync: 7 mappings.

────────────────────────────────────────────────────────────────────
```

Clean axes collapse to one line (`Axis C — Code Connect mappings: in sync (7 mappings checked).`). Axes that were disabled by preflight are not printed.

If every enabled axis is in sync (diff is empty everywhere), stop:

> "All axes are in sync. No changes are needed."

---

## Step 5 — Bundled decision

**This is the only mandatory direction decision in a clean run.** Shape depends on `plan.scope`. Scope `figma-only` does not reach this step — it runs the short-circuit ([`figma-only-path.md`](./figma-only-path.md)).

### 5.a — `plan.scope === 'full'`

Call **AskUserQuestion** with **one sub-question per axis that has drift**. Axes in sync are omitted. Each sub-question offers the same four options:

| Reply | Meaning |
|---|---|
| **F** | Figma wins for this axis — pull Figma state into code |
| **C** | Code wins for this axis — push code state into Figma |
| **R** | Review each drift item one at a time |
| **S** | Skip this axis — record decision, make no writes |

The question body for each sub-question is:

> "**Axis {name}** — {n} drift items.
> - **F** Figma wins (pull into code)
> - **C** Code wins (push to Figma)
> - **R** Review each item
> - **S** Skip this axis"

### 5.b — `plan.scope === 'code-to-figma'`

Direction is pre-locked to **C** on every axis that has drift. Call **AskUserQuestion** with one sub-question per drifted axis, each offering **three** options:

| Reply | Meaning |
|---|---|
| **Apply C** | Confirm code-wins push for this axis (equivalent to direction `C`) |
| **Review** | Walk each drift item one at a time, deciding **C** (push) or **S** (skip) per item — **F** is not offered in this scope |
| **Skip** | Skip this axis — record decision, make no writes |

The question body for each sub-question is:

> "**Axis {name}** — {n} drift items. Scope is code → Figma, so every drift defaults to pushing the code value up.
> - **Apply C** Push code as-is for this axis
> - **Review** Review each item (C or S only)
> - **Skip** Skip this axis"

Record `Apply C` as `plan.{axis}.direction = 'C'`, `Review` as `'R'` with a scope-hint that suppresses the **F** option in the per-item loop, and `Skip` as `'S'`.

### Post-bundle: per-item review for any axis that got R

Any axis where the user replied **R** (or **Review** in scope = `code-to-figma`) now runs a per-item review loop **immediately**, before any execution. For each drifted item in stable-key order, call **AskUserQuestion**:

> "**{axis} — item {i} of {N}** — `{stable-key}`
> - Code side: `{code-value}`
> - Figma side: `{figma-value}`
> Reply **F** (Figma wins → update code), **C** (Code wins → update Figma), or **S** (skip)."

When `plan.scope === 'code-to-figma'`, omit the **F** option from the per-item prompt — that direction is out of scope for this run. Offer only **C** and **S**.

Record each decision at the item level. At the end of Step 5, `plan.{A,B,C}.items` holds one resolution per drift item on every non-skipped axis.

**Axis A's existing F / C / Both / Review prompt is superseded by this bundled prompt.** There is no longer a standalone Step 7 axis-A direction question — the bundled Step 5 is the single source of all direction decisions.
